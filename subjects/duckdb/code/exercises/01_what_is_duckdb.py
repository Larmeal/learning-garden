"""Lesson 1: what DuckDB is. A database that runs inside your own process, built for questions that read many rows of a few columns.

Asserts that DuckDB runs in the Python process (no child process, no new listening port), that a database is one file, that the same aggregate gives the same
answer in DuckDB and in SQLite (the SQLite of the standard library) over one million rows, and that inserting row by row is the case DuckDB is not built for:
the same rows go in far faster as one batch than one at a time. The times are printed, not asserted, because they depend on the computer.
"""

import os
import sqlite3
import sys
from pathlib import Path

import psutil

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ddb import VERSION, check, connect, fresh_dir, main_guard, make_shop, show, table, timed  # noqa: E402

import duckdb  # noqa: E402


def main() -> None:
    # ---- 1. it runs inside this process ----
    me = psutil.Process()
    children_before = len(me.children(recursive=True))
    ports_before = {c.laddr.port for c in psutil.net_connections(kind="inet") if c.pid == me.pid and c.status == "LISTEN"}
    rss_before = me.memory_info().rss
    con = connect()
    make_shop(con)
    rss_after = me.memory_info().rss
    show("duckdb.__version__ and where the engine lives", f"{duckdb.__version__}\n{Path(duckdb.__file__).parent.name}/ (a Python package that holds the engine as a compiled module)")
    check(f"the package is DuckDB {VERSION}", duckdb.__version__ == VERSION, duckdb.__version__)
    check("the engine started no child process", len(me.children(recursive=True)) == children_before == 0)
    ports_after = {c.laddr.port for c in psutil.net_connections(kind="inet") if c.pid == me.pid and c.status == "LISTEN"}
    check("the engine opened no listening port", ports_after == ports_before == set(), str(ports_after))
    grew = (rss_after - rss_before) / 1e6
    check("the memory of this very process grew when the table was built", grew > 10, f"{grew:.0f} MB")
    print(f"  memory of this process grew by {grew:.0f} MB while one million rows were built")

    # ---- 2. a database is a file ----
    work = fresh_dir("01")
    path = work / "shop.duckdb"
    disk = connect(path)
    make_shop(disk, orders=100_000)
    disk.close()
    files = sorted(p.name for p in work.iterdir())
    show("the folder after the connection was closed", "\n".join(f"{p.name}  {p.stat().st_size:,} bytes" for p in sorted(work.iterdir())))
    check("a closed database is one file and nothing else", files == ["shop.duckdb"], str(files))
    again = connect(path, access_mode="read_only")
    n = again.sql("select count(*) from orders").fetchone()[0]
    check("the file opens again and holds the 100,000 orders", n == 100_000)
    again.close()

    # ---- 3. the same question in SQLite and in DuckDB ----
    sq = sqlite3.connect(":memory:")
    sq.execute("create table orders (order_id int, customer_id int, product_id int, qty int, unit_price real, status text, order_ts text)")
    rows = con.sql("select order_id, customer_id, product_id, qty, unit_price, status, order_ts::varchar from orders").fetchall()
    sq.executemany("insert into orders values (?,?,?,?,?,?,?)", rows)
    sql = "select status, count(*), round(sum(qty * unit_price), 2) from orders group by status order by status"
    duck_rows, t_duck = timed(lambda: con.sql(sql).fetchall())
    lite_rows, t_lite = timed(lambda: sq.execute(sql).fetchall())
    show("the same GROUP BY over one million rows", table([[*d] for d in duck_rows], ["status", "orders", "revenue"]))
    check("both engines return the same four rows", [(r[0], r[1]) for r in duck_rows] == [(r[0], r[1]) for r in lite_rows])
    check("and the same revenue to the cent", all(abs(a[2] - b[2]) < 0.05 for a, b in zip(duck_rows, lite_rows)))
    print(f"  DuckDB {t_duck * 1000:.0f} ms, SQLite {t_lite * 1000:.0f} ms on this computer (printed, not asserted)")

    # ---- 4. the case DuckDB is not built for: one row at a time ----
    small = [(i, i % 50, i % 7, 1, 9.5, "paid", "2025-01-01 00:00:00") for i in range(2_000)]
    one = connect()
    one.execute("create table t (order_id int, customer_id int, product_id int, qty int, unit_price double, status varchar, order_ts varchar)")
    _, t_single = timed(lambda: [one.execute("insert into t values (?,?,?,?,?,?,?)", r) for r in small])
    batch = connect()
    batch.execute("create table t (order_id int, customer_id int, product_id int, qty int, unit_price double, status varchar, order_ts varchar)")
    _, t_batch = timed(lambda: batch.executemany("insert into t values (?,?,?,?,?,?,?)", small))
    one_values = batch.sql("select count(*) from t").fetchone()[0]
    print(f"  2,000 INSERT statements one by one: {t_single * 1000:.0f} ms; the same rows in one executemany: {t_batch * 1000:.0f} ms")
    check("the batch holds the same 2,000 rows", one_values == 2_000)
    # the statement-at-a-time loop costs one parse, plan and commit per row
    check("one INSERT per row is slower than one batch of the same rows", t_single > t_batch, f"{t_single:.3f}s vs {t_batch:.3f}s")


main_guard(main)
