"""Chapter 8: Python UDFs.

Needs pandas and pyarrow (both are in this project's pyproject.toml). Run from this folder:

    uv run python exercises/08_udf.py

Plans are read from explain(). Timings are printed, only their order is asserted.
"""

import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))

import pandas as pd  # noqa: E402
from pyspark.errors import PythonException  # noqa: E402
from pyspark.sql import functions as F  # noqa: E402
from pyspark.sql.functions import pandas_udf, udf  # noqa: E402

from common import explain, get_spark  # noqa: E402


def optimized(df):
    text = explain(df, True)
    m = re.search(r"== Optimized Logical Plan ==\n(.*?)\n\n== Physical Plan", text, re.S)
    return m.group(1)


def physical(df):
    return explain(df)


def below(plan, upper, lower):
    """True when `upper` is printed above `lower` in a plan tree (so `lower` is nearer the data)."""
    return plan.index(upper) < plan.index(lower)


def plans(spark):
    assert spark.conf.get("spark.sql.execution.pythonUDF.arrow.enabled") == "true"
    assert spark.conf.get("spark.sql.execution.arrow.maxRecordsPerBatch") == "10000"
    assert spark.conf.get("spark.sql.execution.python.udf.maxRecordsPerBatch") == "100"

    df = spark.range(10).withColumn("v", F.col("id") * 2)

    @udf("long")
    def plus1(x):
        return x + 1

    @udf("long", useArrow=False)
    def plus1_pickle(x):
        return x + 1

    @pandas_udf("long")
    def plus1_pd(s: pd.Series) -> pd.Series:
        return s + 1

    assert plus1.evalType == 101 and plus1_pickle.evalType == 100 and plus1_pd.evalType == 200
    p = physical(df.select(plus1("id")))
    assert re.search(r"ArrowEvalPython .*, 101", p), p
    assert re.search(r"BatchEvalPython", physical(df.select(plus1_pickle("id"))))
    assert re.search(r"ArrowEvalPython .*, 200", physical(df.select(plus1_pd("id"))))

    builtin = physical(df.select((F.col("id") + 1).alias("x")))
    assert "EvalPython" not in builtin
    # The eval node splits whole-stage codegen: *(1) below it and *(2) above it.
    assert "*(1)" in p and "*(2)" in p

    # The conf is read when the UDF object is created, not when it runs.
    spark.conf.set("spark.sql.execution.pythonUDF.arrow.enabled", "false")
    late_off = udf(lambda x: x + 1, "long")
    assert late_off.evalType == 100
    spark.conf.set("spark.sql.execution.pythonUDF.arrow.enabled", "true")
    assert plus1.evalType == 101
    spark.conf.set("spark.sql.execution.pythonUDF.arrow.enabled", "false")
    assert "ArrowEvalPython" in physical(df.select(plus1("id"))), "a UDF defined earlier keeps eval type 101"
    spark.conf.set("spark.sql.execution.pythonUDF.arrow.enabled", "true")

    # Other Python nodes.
    def pdf_double(pdf):
        return pdf.assign(v=pdf.v * 2)

    assert "MapInPandas" in physical(df.mapInPandas(lambda it: (x for x in it), "id long, v long"))
    g = df.withColumn("k", F.col("id") % 2).groupBy("k").applyInPandas(lambda pdf: pdf, "k long, id long, v long")
    pg = physical(g)
    assert "FlatMapGroupsInPandas" in pg and "Exchange hashpartitioning" in pg and "Sort [" in pg

    @pandas_udf("long")
    def pagg(v: pd.Series) -> int:
        return int(v.sum())

    ga = df.withColumn("k", F.col("id") % 2).groupBy("k").agg(pagg("v"))
    assert re.search(r"ArrowAggregatePython .*, 202", physical(ga))
    assert "Exchange hashpartitioning" in physical(ga)

    # A UDF inside a built-in aggregate runs before the partial aggregation.
    inside = physical(df.withColumn("k", F.col("id") % 2).groupBy("k").agg(F.sum(plus1("v"))))
    assert below(inside, "partial_sum", "ArrowEvalPython")

    # Extraction details.
    fused = optimized(df.select(plus1(plus1("id")), plus1("v")))
    assert fused.count("ArrowEvalPython") == 1, "siblings and chains of one kind share one node"
    mixed = physical(df.select(plus1_pickle("id"), plus1("v")))
    assert "BatchEvalPython" in mixed and "ArrowEvalPython" in mixed, "mixed kinds are two Python round trips"
    wrapped = physical(df.select((plus1("id") + 1).alias("x")))
    assert re.search(r"\(pythonUDF0#\d+L \+ 1\)", wrapped), "only the UDF is extracted, + 1 stays in the JVM"
    folded = optimized(df.select((F.lit(1) + F.lit(2)).alias("b"), plus1(F.lit(1)).alias("c")))
    assert "3 AS b" in folded and "ArrowEvalPython" in folded, "a UDF call is never constant-folded"

    return df, plus1


def barrier(spark, df, plus1):
    # F1: a deterministic filter on another column goes below the UDF.
    f1 = optimized(df.withColumn("u", plus1("id")).filter(F.col("v") > 4))
    assert below(f1, "ArrowEvalPython", "Filter"), f1
    # F2: a filter on the UDF output stays above it, and the UDF is evaluated twice.
    f2 = optimized(df.withColumn("u", plus1("id")).filter(F.col("u") > 4))
    assert f2.count("ArrowEvalPython") == 2, f2
    # F3: a UDF inside the filter runs on every row first.
    f3 = optimized(df.filter(plus1("id") > 4))
    assert below(f3, "Filter", "ArrowEvalPython"), f3
    # F4: a non-deterministic UDF blocks pushdown of an unrelated filter.
    rnd = udf(lambda x: x, "long").asNondeterministic()
    assert plus1.deterministic and not rnd.deterministic
    f4 = optimized(df.withColumn("u", rnd("id")).filter(F.col("v") > 4))
    assert below(f4, "Filter", "ArrowEvalPython"), f4


def nulls_and_types(spark):
    one_null = spark.createDataFrame([(1,), (None,)], "x int").coalesce(1)

    for use_arrow in (False, True):
        inc = udf(lambda x: x + 1, "int", useArrow=use_arrow)
        try:
            one_null.select(inc("x")).collect()
            raise AssertionError("expected an error")
        except PythonException as e:
            assert "TypeError" in str(e) and "NoneType" in str(e)
            assert e.getCondition() == "PYTHON_EXCEPTION" and e.getSqlState() == "38000"
        safe = udf(lambda x: None if x is None else x + 1, "int", useArrow=use_arrow)
        assert [r[0] for r in one_null.select(safe("x")).collect()] == [2, None]

    @pandas_udf("double")
    def inc_pd(s: pd.Series) -> pd.Series:
        return s + 1

    assert [r[0] for r in one_null.select(inc_pd("x")).collect()] == [2.0, None]

    seen = []

    @pandas_udf("string")
    def dtype_of(s: pd.Series) -> pd.Series:
        return pd.Series([str(s.dtype)] * len(s))

    with_null = one_null.select(dtype_of("x")).collect()[0][0]
    without = spark.createDataFrame([(1,), (2,)], "x int").coalesce(1).select(dtype_of("x")).collect()[0][0]
    assert with_null.startswith("float") and without.startswith("int"), (with_null, without)
    seen.append((with_null, without))
    print("pandas dtype with a NULL / without:", seen[0])

    # Return type coercion: declared type vs the Python value that comes back.
    src = spark.createDataFrame([(1,)], "one int").coalesce(1)

    def run(value, dtype, arrow):
        f = udf(lambda x: value, dtype, useArrow=arrow)
        try:
            return src.select(f("one")).collect()[0][0]
        except PythonException:
            return "ERROR"

    table = [
        (1.5, "int", None, 1),
        ("5", "int", None, 5),
        ("a", "int", None, "ERROR"),
        (3, "double", None, 3.0),
        (5, "string", "5", "5"),
        (1.5, "string", "1.5", "1.5"),
        (None, "int", None, None),
        (2**40, "int", 0, "ERROR"),
    ]
    for value, dtype, pickled, arrowed in table:
        got_p, got_a = run(value, dtype, False), run(value, dtype, True)
        assert (got_p, got_a) == (pickled, arrowed), (value, dtype, got_p, got_a)

    # A pandas UDF whose Series does not match the declared type.
    @pandas_udf("long")
    def bad(s: pd.Series) -> pd.Series:
        return pd.Series(["a"] * len(s))

    try:
        src.select(bad("one")).collect()
        raise AssertionError("expected an error")
    except PythonException:
        pass


def error_shape(spark):
    @udf("int")
    def boom(x):
        if x == 2:
            raise ValueError("bad value 2")
        return x

    try:
        spark.range(5).select(boom("id")).collect()
    except PythonException as e:
        text = str(e)
        assert "An exception was thrown from the Python worker" in text
        assert "ValueError: bad value 2" in text
        assert "08_udf.py" in text, "the traceback shows the user's file"
        assert e.getCondition() == "PYTHON_EXCEPTION"
    else:
        raise AssertionError("expected PythonException")


def per_row_cost(spark):
    spark.conf.set("spark.sql.adaptive.enabled", "false")
    n = 5_000_000
    df = spark.range(0, n, 1, 1)  # one partition: one Python worker, so start-up is not the story

    @udf("long", useArrow=False)
    def pickled(x):
        return x + 1

    @udf("long")
    def arrow(x):
        return x + 1

    @pandas_udf("long")
    def vect(s: pd.Series) -> pd.Series:
        return s + 1

    def run(col):
        t = time.perf_counter()
        df.select(col.alias("r")).agg(F.sum("r")).collect()
        return time.perf_counter() - t

    run(vect("id"))  # warm up
    t_builtin = min(run(F.col("id") + 1) for _ in range(2))
    t_vect = min(run(vect("id")) for _ in range(2))
    t_arrow = min(run(arrow("id")) for _ in range(2))
    t_pickle = min(run(pickled("id")) for _ in range(2))
    print(
        f"per-row cost, 1 partition, {n:,} rows: built-in {t_builtin:.2f}s, pandas_udf {t_vect:.2f}s, "
        f"arrow udf {t_arrow:.2f}s, pickle udf {t_pickle:.2f}s"
    )
    assert t_builtin * 5 < t_vect < t_arrow < t_pickle, (t_builtin, t_vect, t_arrow, t_pickle)
    spark.conf.set("spark.sql.adaptive.enabled", "true")


def main():
    spark = get_spark("ch08")
    spark.sparkContext.setLogLevel("ERROR")
    df, plus1 = plans(spark)
    barrier(spark, df, plus1)
    nulls_and_types(spark)
    error_shape(spark)
    per_row_cost(spark)
    spark.stop()
    print("ok")


if __name__ == "__main__":
    main()
