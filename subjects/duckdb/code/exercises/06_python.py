"""Lesson 6: DuckDB from Python. A relation is a lazy query, a DataFrame in a variable is a table, and the same answer comes out as pandas, Arrow, Polars or NumPy.

Asserts that a relation does not run until it is fetched (it sees rows inserted after it was made), that composing a relation with filter/aggregate/order gives the same rows as the SQL
of the same query, that a pandas DataFrame and a Polars DataFrame can be read by name in SQL, that the answer of a group-by agrees across DuckDB, pandas and Polars, that the result can be
taken as pandas, Arrow, Polars or NumPy, that a Python function can be a SQL function (one value at a time and a whole vector at a time) and that parameters are bound, not pasted.
"""

import sys
from pathlib import Path

import pandas as pd
import polars as pl
import pyarrow as pa

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ddb import check, connect, main_guard, make_shop, show, table, timed  # noqa: E402

import duckdb  # noqa: E402
import duckdb.sqltypes  # noqa: E402


def main() -> None:
    con = connect()
    make_shop(con)

    # ---- 1. a relation is lazy ----
    con.execute("create table t (x int)")
    con.execute("insert into t values (1), (2)")
    rel = con.table("t").filter("x > 0")
    con.execute("insert into t values (3)")
    check("a relation made before an INSERT sees the new row when it is fetched", rel.count("*").fetchone()[0] == 3)
    text = str(con.sql("select * from orders where status = 'paid'"))
    check("printing a relation shows the first rows and the column types, it does not hold the result", "int64" in text and "order_id" in text)

    # ---- 2. build a query with methods, get the same rows as the SQL ----
    # revenue is rounded to cents: a sum of doubles added by several threads in a different order can differ in the last bits between two runs, and the rows of the two queries would then differ
    api = con.table("orders").filter("status = 'paid'").aggregate("customer_id, count(*) as n, round(sum(qty * unit_price), 2) as revenue", "customer_id").order("revenue desc, customer_id").limit(3)
    sql = con.sql("select customer_id, count(*) as n, round(sum(qty * unit_price), 2) as revenue from orders where status = 'paid' group by customer_id order by revenue desc, customer_id limit 3")
    check("filter, aggregate, order and limit give the rows of the SQL of the same query", api.fetchall() == sql.fetchall(), str(api.fetchall()))
    show("the three best customers by revenue of paid orders", table(sql.fetchall(), ["customer_id", "orders", "revenue"]))

    # ---- 3. a DataFrame in a variable is a table ----
    df = con.sql("select * from orders where order_id <= 1000").df()
    check("a relation turns into a pandas DataFrame", isinstance(df, pd.DataFrame) and df.shape == (1000, 7))
    got = con.sql("select count(*), sum(qty) from df").fetchone()
    check("SQL reads the variable `df` by its name (a replacement scan) and gets the same numbers as pandas", got == (len(df), int(df["qty"].sum())), str(got))
    plf = pl.from_pandas(df)
    got_pl = con.sql("select count(*), sum(qty) from plf").fetchone()
    check("it reads a Polars DataFrame by name too", got_pl == got)
    tbl = pa.Table.from_pandas(df)
    check("and an Arrow table", con.sql("select count(*) from tbl").fetchone()[0] == 1000)

    # ---- 4. the same group-by in three engines ----
    big = con.sql("select * from orders").df()
    d = con.sql("select status, count(*) as n, round(sum(qty * unit_price), 2) as revenue from big group by status order by status").fetchall()
    pdres = big.assign(total=big.qty * big.unit_price).groupby("status").agg(n=("order_id", "count"), revenue=("total", "sum")).round(2).reset_index().sort_values("status")
    plres = pl.from_pandas(big).group_by("status").agg(n=pl.len(), revenue=(pl.col("qty") * pl.col("unit_price")).sum().round(2)).sort("status")
    check("DuckDB, pandas and Polars agree on the four counts", [r[1] for r in d] == list(pdres["n"]) == plres["n"].to_list(), str(d))
    check("and on the revenue of each status to the cent", all(abs(a[2] - b) < 0.011 and abs(a[2] - c) < 0.011 for a, b, c in zip(d, pdres["revenue"], plres["revenue"])))
    def duck_group(big):  # the name `big` must be a local of the function that runs the SQL: that is where DuckDB looks for a DataFrame
        return con.sql("select status, count(*), sum(qty * unit_price) from big group by status").fetchall()

    def best(fn, n=5):
        return min(timed(fn)[1] for _ in range(n))

    plbig = pl.from_pandas(big)
    t_duck = best(lambda: duck_group(big))
    t_native = best(lambda: con.sql("select status, count(*), sum(qty * unit_price) from orders group by status").fetchall())
    t_pd = best(lambda: big.assign(total=big.qty * big.unit_price).groupby("status").agg(n=("order_id", "count"), revenue=("total", "sum")))
    t_pl = best(lambda: plbig.group_by("status").agg(pl.len(), (pl.col("qty") * pl.col("unit_price")).sum()))
    print(f"  group by over one million rows already in memory, best of 5: DuckDB on the DataFrame {t_duck * 1000:.0f} ms, DuckDB on its own table {t_native * 1000:.0f} ms, pandas {t_pd * 1000:.0f} ms, Polars {t_pl * 1000:.0f} ms (printed, not asserted)")

    # ---- 5. one result, many shapes ----
    r = con.sql("select order_id, qty, status from orders where order_id <= 5 order by order_id")
    check("fetchall gives tuples", r.fetchall()[0] == (1, r.fetchall()[0][1], r.fetchall()[0][2]))
    check("df() gives pandas, arrow() gives Arrow, pl() gives Polars, fetchnumpy() gives a dict of arrays",
          type(r.df()).__name__ == "DataFrame" and type(r.arrow()).__name__ in ("Table", "RecordBatchReader") and type(r.pl()).__name__ == "DataFrame" and sorted(r.fetchnumpy()) == ["order_id", "qty", "status"])
    arr = con.sql("select order_id, status from orders where order_id <= 5").arrow()
    check("an Arrow result keeps the types: BIGINT is int64", str(arr.schema.field("order_id").type) == "int64", str(arr.schema))

    # ---- 6. a Python function as a SQL function ----
    def with_tax(x: float) -> float:
        return round(x * 1.07, 2)

    con.create_function("with_tax", with_tax, [duckdb.sqltypes.DOUBLE], duckdb.sqltypes.DOUBLE)
    check("a Python function called from SQL gives the same value as calling it in Python", con.sql("select with_tax(100.0)").fetchone()[0] == with_tax(100.0))

    import pyarrow.compute as pc

    def with_tax_vec(x: pa.Array) -> pa.Array:
        return pc.round(pc.multiply(x, 1.07), 2)

    con.create_function("with_tax_vec", with_tax_vec, [duckdb.sqltypes.DOUBLE], duckdb.sqltypes.DOUBLE, type="arrow")
    rows = con.sql("select unit_price from orders where order_id <= 200000").fetchall()
    one, t_one = timed(lambda: con.sql("select sum(with_tax(unit_price)) from orders where order_id <= 200000").fetchone()[0])
    vec, t_vec = timed(lambda: con.sql("select sum(with_tax_vec(unit_price)) from orders where order_id <= 200000").fetchone()[0])
    check("a UDF that takes a whole vector gives the same sum as the one that takes a value", abs(one - vec) < 0.01 * len(rows) * 0.01, f"{one} vs {vec}")
    print(f"  200,000 rows through a Python UDF: one value at a time {t_one * 1000:.0f} ms, one vector (Arrow) at a time {t_vec * 1000:.0f} ms (printed, not asserted)")
    check("the vector UDF is faster than the one-value UDF", t_vec < t_one, f"{t_vec:.3f}s vs {t_one:.3f}s")

    # ---- 7. parameters are values, not text ----
    evil = "paid' or '1'='1"
    got = con.execute("select count(*) from orders where status = ?", [evil]).fetchone()[0]
    check("a bound parameter is one value: the injection text matches no row", got == 0)
    named = con.execute("select count(*) from orders where status = $s and qty >= $q", {"s": "paid", "q": 5}).fetchone()[0]
    ref = con.sql("select count(*) from orders where status = 'paid' and qty >= 5").fetchone()[0]
    check("named parameters work too and give the same count", named == ref, f"{named} vs {ref}")


main_guard(main)
