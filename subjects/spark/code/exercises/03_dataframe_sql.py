"""Chapter 3: DataFrame and Spark SQL. NULL logic, joins, windows, ANSI mode and number types.

    uv run python exercises/03_dataframe_sql.py

On Windows it re-launches itself in WSL: the Python to JVM sockets on the author's Windows machine reset now and then
(ConnectionResetError), which Linux does not.

Every result the lesson prints is asserted here.
"""

import os
import sys
from decimal import Decimal

sys.path.insert(0, os.path.dirname(__file__))

from common import get_spark, relaunch_in_wsl_if_windows  # noqa: E402

relaunch_in_wsl_if_windows(__file__)

from pyspark.sql import Window  # noqa: E402
from pyspark.sql import functions as F  # noqa: E402


def one(spark, sql):
    return spark.sql(sql).collect()[0][0]


def null_logic(spark):
    row = spark.sql("SELECT NULL = NULL AS eq, NULL <=> NULL AS safe_eq, 1 = NULL AS one_eq, NULL AND false AS and_f, NULL OR true AS or_t, NOT NULL AS not_n").collect()[0]
    assert (row.eq, row.safe_eq, row.one_eq, row.and_f, row.or_t, row.not_n) == (None, True, None, False, True, None)

    rows = [("th", "bkk", 120), ("th", "cnx", 80), ("jp", "tyo", 200), ("jp", "osa", None), ("sg", "sin", 90), (None, "xx", 5)]
    df = spark.createDataFrame(rows, "country string, city string, sales int")
    df.createOrReplaceTempView("sales")

    agg = {r.country: r for r in df.groupBy("country").agg(F.sum("sales").alias("total"), F.count("sales").alias("n_sales"), F.count("*").alias("n_rows")).collect()}
    assert (agg["jp"].total, agg["jp"].n_sales, agg["jp"].n_rows) == (200, 1, 2)
    assert (agg["th"].total, agg["th"].n_sales, agg["th"].n_rows) == (200, 2, 2)
    assert agg[None].n_rows == 1, "NULL is one group of its own"
    only_null = spark.createDataFrame([("a", None)], "k string, v int").groupBy("k").agg(F.sum("v").alias("s")).collect()[0].s
    assert only_null is None, "the sum of nothing but NULL is NULL, not 0"
    assert df.select(F.count_distinct("country")).collect()[0][0] == 3, "count(distinct) ignores NULL"
    assert df.select("country").distinct().count() == 4, "distinct keeps one NULL"

    # Comparing with None
    assert df.filter(F.col("sales") == None).count() == 0  # noqa: E711
    assert df.filter(F.col("sales").isNull()).count() == 1
    assert df.filter(F.col("sales").eqNullSafe(None)).count() == 1
    assert df.filter(F.col("sales") != 100).count() == 5, "the NULL row is dropped by != too"

    # NOT IN with a NULL in the list returns nothing, NOT EXISTS does not.
    spark.createDataFrame([(1,), (2,), (3,)], "x int").createOrReplaceTempView("a")
    spark.createDataFrame([(1,), (None,)], "y int").createOrReplaceTempView("b")
    assert spark.sql("SELECT x FROM a WHERE x NOT IN (SELECT y FROM b)").count() == 0
    assert sorted(r.x for r in spark.sql("SELECT x FROM a WHERE NOT EXISTS (SELECT 1 FROM b WHERE b.y = a.x)").collect()) == [2, 3]

    # Order of NULLs
    order = lambda e: [r.sales for r in df.orderBy(e).collect()]  # noqa: E731
    assert order(F.col("sales").asc())[0] is None and order(F.col("sales").desc())[-1] is None
    assert order(F.col("sales").asc_nulls_last())[-1] is None
    assert one(spark, "SELECT coalesce(NULL, NULL, 3)") == 3 and one(spark, "SELECT nullif(2, 2)") is None


def joins(spark):
    left = spark.createDataFrame([(1, "a"), (2, "b"), (None, "n")], "id int, l string")
    right = spark.createDataFrame([(1, "x"), (3, "y"), (None, "m")], "id int, r string")
    kinds = {
        "inner": 1, "left": 3, "right": 3, "full": 5, "left_semi": 1, "left_anti": 2, "cross": 9,
    }
    for how, expected in kinds.items():
        got = left.crossJoin(right).count() if how == "cross" else left.join(right, "id", how).count()
        assert got == expected, (how, got, expected)
    assert left.join(right, left.id.eqNullSafe(right.id), "inner").count() == 2, "a null-safe condition matches NULL with NULL"
    assert left.join(right, "id", "left_anti").count() == 2, "anti keeps the NULL-key row: NULL never matches"


def windows(spark):
    df = spark.createDataFrame([("a", 10), ("a", 20), ("a", 20), ("a", 30), ("b", 5), ("b", 7)], "g string, v int")
    w = Window.partitionBy("g").orderBy("v")
    res = df.select(
        "g", "v", F.row_number().over(w).alias("rn"), F.rank().over(w).alias("rk"), F.dense_rank().over(w).alias("dr"),
        F.lag("v").over(w).alias("prev"), F.sum("v").over(w).alias("run_range"),
        F.sum("v").over(w.rowsBetween(Window.unboundedPreceding, Window.currentRow)).alias("run_rows"),
    ).where("g = 'a'").orderBy("v", "rn").collect()
    got = [(r.v, r.rn, r.rk, r.dr, r.prev, r.run_range, r.run_rows) for r in res]
    # ties on v = 20: rank skips (1,2,2,4), dense_rank does not (1,2,2,3); row_number is arbitrary among ties
    assert [(g[0], g[2], g[3]) for g in got] == [(10, 1, 1), (20, 2, 2), (20, 2, 2), (30, 4, 3)], got
    assert sorted(g[1] for g in got) == [1, 2, 3, 4]
    # The default frame with ORDER BY is RANGE: peers share a running total. ROWS counts one row at a time.
    assert [g[5] for g in got] == [10, 50, 50, 80]
    assert sorted(g[6] for g in got if g[0] == 20) == [30, 50]


def ansi_and_numbers(spark):
    assert spark.conf.get("spark.sql.ansi.enabled") == "true"
    for sql, code in [("SELECT 1 / 0", "DIVIDE_BY_ZERO"), ("SELECT CAST('abc' AS INT)", "CAST_INVALID_INPUT"), ("SELECT 2147483647 + 1", "ARITHMETIC_OVERFLOW")]:
        try:
            spark.sql(sql).collect()
            raise AssertionError(sql)
        except Exception as e:  # noqa: BLE001
            assert code in str(e), (sql, str(e)[:200])
    assert one(spark, "SELECT try_divide(1, 0)") is None
    assert one(spark, "SELECT try_cast('abc' AS INT)") is None
    assert one(spark, "SELECT try_add(2147483647, 1)") is None

    # A SQL literal 0.1 is a decimal, a Python float is a double.
    assert one(spark, "SELECT 0.1 + 0.2 = 0.3") is True
    assert spark.createDataFrame([(0.1, 0.2)], "a double, b double").select((F.col("a") + F.col("b") == F.lit(0.3)).alias("x")).collect()[0].x is False
    assert one(spark, "SELECT CAST(0.1 AS DOUBLE) + CAST(0.2 AS DOUBLE)") == 0.30000000000000004
    assert one(spark, "SELECT 1 + 0.5") == Decimal("1.5") and dict(spark.sql("SELECT 1 + 0.5 AS x").dtypes)["x"].startswith("decimal(")
    assert one(spark, "SELECT 7 / 2") == Decimal("3.500000") and one(spark, "SELECT 7 DIV 2") == 3, "/ is not integer division"
    assert dict(spark.sql("SELECT 1 AS a, 1L AS b, 1.0 AS c, 1D AS d, 'x' AS e").dtypes) == {"a": "int", "b": "bigint", "c": "decimal(2,1)", "d": "double", "e": "string"}


def api_and_sql_agree(spark):
    df = spark.createDataFrame([("th", 120), ("th", 80), ("jp", 200)], "country string, sales int")
    df.createOrReplaceTempView("t")
    a = df.groupBy("country").agg(F.sum("sales").alias("total")).orderBy("country").collect()
    b = spark.sql("SELECT country, SUM(sales) AS total FROM t GROUP BY country ORDER BY country").collect()
    assert a == b
    # selectExpr and expr let SQL text live inside the API
    assert [r.d for r in df.selectExpr("sales * 2 AS d").collect()] == [240, 160, 400]
    assert df.where("sales > 100 AND country = 'th'").count() == 1


def main():
    spark = get_spark("ch03")
    spark.sparkContext.setLogLevel("ERROR")
    null_logic(spark)
    joins(spark)
    windows(spark)
    ansi_and_numbers(spark)
    api_and_sql_agree(spark)
    spark.stop()
    print("ok")


if __name__ == "__main__":
    main()
