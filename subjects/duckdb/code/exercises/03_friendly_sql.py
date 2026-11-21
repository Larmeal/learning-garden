"""Lesson 3: friendly SQL. The parts of DuckDB's SQL that exist to save you typing, each checked against the long way of writing the same thing.

Asserts EXCLUDE, REPLACE, COLUMNS, GROUP BY ALL, ORDER BY ALL, FROM first, a column alias used in the same SELECT and in WHERE, QUALIFY, USING SAMPLE with a seed,
INSERT ... BY NAME, UNION BY NAME, SUMMARIZE, list comprehensions, string slicing and method-style calls. In each case the short form returns what the long form returns.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ddb import check, connect, main_guard, make_shop, show, table  # noqa: E402


def main() -> None:
    con = connect()
    make_shop(con)

    # ---- 1. choose columns by what they are not, and by pattern ----
    cols = [r[0] for r in con.sql("describe orders").fetchall()]
    short = con.sql("select * exclude (qty, unit_price) from orders limit 1").description
    check("EXCLUDE drops the named columns and keeps the rest in order", [d[0] for d in short] == [c for c in cols if c not in ("qty", "unit_price")], str([d[0] for d in short]))
    rep = con.sql("select * replace (qty * 10 as qty) from orders where order_id = 1").fetchone()
    base = con.sql("select * from orders where order_id = 1").fetchone()
    check("REPLACE changes one column and keeps its place", rep[3] == base[3] * 10 and rep[:3] == base[:3] and rep[4:] == base[4:])
    ids = [d[0] for d in con.sql("select columns('.*_id') from orders limit 1").description]
    check("COLUMNS('.*_id') picks the columns whose name matches a pattern", ids == ["order_id", "customer_id", "product_id"], str(ids))
    mx = con.sql("select max(columns('.*_id')) from orders").fetchone()
    check("an aggregate over COLUMNS runs once per matching column", mx == (1_000_000, 5000, 200), str(mx))

    # ---- 2. say less in GROUP BY and ORDER BY ----
    long = con.sql("select status, country_pick, count(*) from (select status, 'x' as country_pick from orders) group by status, country_pick order by status, country_pick").fetchall()
    short_ = con.sql("select status, 'x' as country_pick, count(*) from orders group by all order by all").fetchall()
    check("GROUP BY ALL groups by every column that is not an aggregate, ORDER BY ALL sorts by every column", long == short_, str(short_))
    first = con.sql("from orders select status, count(*) as n group by all order by n desc limit 1").fetchone()
    check("FROM can come first, and SELECT can be left out altogether", first == ("paid", 699821), str(first))
    check("`from orders limit 3` is a whole query", len(con.sql("from orders limit 3").fetchall()) == 3)

    # ---- 3. an alias is a name you can use ----
    a = con.sql("select qty * unit_price as total, total * 0.07 as vat from orders where total > 450 order by order_id limit 3").fetchall()
    b = con.sql("select qty * unit_price as total, qty * unit_price * 0.07 as vat from orders where qty * unit_price > 450 order by order_id limit 3").fetchall()
    check("an alias works later in the same SELECT and in WHERE, and gives the same rows as writing the expression out", a == b and len(a) == 3, str(a))

    # ---- 4. QUALIFY: filter on a window function ----
    top = con.sql(
        "select customer_id, order_id, qty * unit_price as total from orders qualify row_number() over (partition by customer_id order by qty * unit_price desc, order_id) = 1"
    ).fetchall()
    long = con.sql(
        """select customer_id, order_id, total from (
             select customer_id, order_id, qty * unit_price as total,
                    row_number() over (partition by customer_id order by qty * unit_price desc, order_id) as rn from orders) where rn = 1"""
    ).fetchall()
    check("QUALIFY keeps the biggest order of every customer, one row each", len(top) == 5000 and sorted(top) == sorted(long))
    show("the biggest order of three customers", table(sorted(top)[:3], ["customer_id", "order_id", "total"]))

    # ---- 5. sampling ----
    n1 = con.sql("select count(*) from (select * from orders using sample 1000 rows (reservoir, 42))").fetchone()[0]
    s1 = con.sql("select order_id from orders using sample reservoir(1000 rows) repeatable (42) order by order_id").fetchall()
    s2 = con.sql("select order_id from orders using sample reservoir(1000 rows) repeatable (42) order by order_id").fetchall()
    check("a sample of 1000 rows has 1000 rows, and the same seed gives the same sample", n1 == 1000 and s1 == s2)

    # ---- 6. INSERT BY NAME and UNION BY NAME ----
    con.execute("create table t (a int, b varchar, c double)")
    con.execute("insert into t by name select 'x' as b, 1 as a")
    check("INSERT ... BY NAME matches columns by name, and the one left out is NULL", con.sql("select * from t").fetchall() == [(1, "x", None)])
    u = con.sql("select 1 as a, 'x' as b union all by name select 2.5 as c, 'y' as b").fetchall()
    check("UNION ALL BY NAME lines up columns by name and fills the gaps with NULL", sorted(u, key=lambda r: str(r[1])) == [(1, "x", None), (None, "y", 2.5)], str(u))

    # ---- 7. look at a table in one statement ----
    s = con.sql("summarize orders").fetchall()
    names = [d[0] for d in con.sql("summarize orders").description]
    by = {r[0]: dict(zip(names, r)) for r in s}
    show("summarize orders (some columns)", table([[r[0], r[1], r[2], r[3], r[4]] for r in s], names[:5]))
    check("SUMMARIZE returns one row per column with min, max, approx_unique, avg, std, quartiles, count and null_percentage",
          {"column_name", "column_type", "min", "max", "approx_unique", "avg", "std", "q25", "q50", "q75", "count", "null_percentage"} == set(names), str(names))
    check("order_id runs from 1 to 1,000,000 and nothing is NULL", (by["order_id"]["min"], by["order_id"]["max"], float(by["order_id"]["null_percentage"])) == ("1", "1000000", 0.0))
    check("approx_unique of status is 4 (exact for a small number of values)", by["status"]["approx_unique"] == 4)
    check("approx_unique of order_id is an estimate: 953,281 for a column of one million different values", by["order_id"]["approx_unique"] == 953281, str(by["order_id"]["approx_unique"]))

    # ---- 8. small things that read well ----
    check("a list comprehension", con.sql("select [x * 2 for x in [1, 2, 3] if x > 1]").fetchone()[0] == [4, 6])
    check("string slicing from 1, both ends included", con.sql("select 'DuckDB'[1:4]").fetchone()[0] == "Duck")
    check("a function can be called on a value with a dot", con.sql("select ('duck').upper()").fetchone()[0] == "DUCK")
    check("a trailing comma is allowed in the SELECT list", con.sql("select 1 as a, 2 as b, ").fetchone() == (1, 2))


main_guard(main)
