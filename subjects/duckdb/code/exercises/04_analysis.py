"""Lesson 4: analysis. Grouping sets, window functions and their frames, FILTER, PIVOT, ASOF JOIN and LATERAL.

Asserts that ROLLUP, CUBE and GROUPING SETS add the subtotal rows you would otherwise get from several queries and a UNION, that a window frame of ROWS and a frame of RANGE
pick different rows when two rows share a day, that FILTER and a CASE inside an aggregate agree, that PIVOT turns the values of a column into columns, that an ASOF JOIN picks
the latest price at or before each order, and that LATERAL lets a subquery use the row on its left. `--write` saves the small tables of the window and ASOF labs (`analysis.json`).
"""

import sys
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ddb import LABS, check, connect, main_guard, make_shop, show, table, write_json  # noqa: E402

WRITE = "--write" in sys.argv


def main() -> None:
    con = connect()
    make_shop(con)
    con.execute("create view o as select o.*, c.country, month(order_ts) as m from orders o join customers c using (customer_id)")

    # ---- 1. grouping sets ----
    plain = con.sql("select country, status, count(*) n from o group by country, status").fetchall()
    rollup = con.sql("select country, status, count(*) n from o group by rollup (country, status)").fetchall()
    by_country = sum(1 for r in rollup if r[0] is not None and r[1] is None)
    grand = [r for r in rollup if r[0] is None and r[1] is None]
    check("GROUP BY ROLLUP adds one subtotal row per country and one grand total", len(plain) == 32 and by_country == 8 and len(grand) == 1 and len(rollup) == 32 + 8 + 1, str(len(rollup)))
    check("the grand total row counts all one million orders", grand[0][2] == 1_000_000)
    cube = con.sql("select country, status, count(*) from o group by cube (country, status)").fetchall()
    check("CUBE adds the subtotals of both columns: 32 + 8 + 4 + 1 rows", len(cube) == 45, str(len(cube)))
    gs = con.sql("select country, status, count(*) from o group by grouping sets ((country), (status), ())").fetchall()
    check("GROUPING SETS asks for exactly the groupings you list: 8 + 4 + 1 rows", len(gs) == 13)
    g = con.sql("select country, grouping(country) as g, count(*) from o group by rollup (country) order by g, country").fetchall()
    check("grouping() tells a subtotal row from a real NULL: it is 1 on the total row", g[-1][1] == 1 and g[-1][0] is None and all(r[1] == 0 for r in g[:-1]))

    # ---- 2. FILTER inside an aggregate ----
    a = con.sql("select count(*) filter (where status = 'refunded') as r, sum(qty) filter (where status = 'paid') as s from orders").fetchone()
    b = con.sql("select sum(case when status = 'refunded' then 1 else 0 end), sum(case when status = 'paid' then qty end) from orders").fetchone()
    check("count(*) FILTER (WHERE ...) gives what SUM(CASE ...) gives", a == b, f"{a} vs {b}")
    print(f"  refunded orders: {a[0]}; items in paid orders: {a[1]}")

    # ---- 3. window functions and their frames ----
    con.execute("create table daily (day date, amount int)")
    rows = [(date(2025, 3, 1), 10), (date(2025, 3, 2), 20), (date(2025, 3, 3), 5), (date(2025, 3, 3), 30), (date(2025, 3, 6), 40), (date(2025, 3, 7), 50)]
    con.executemany("insert into daily values (?, ?)", rows)
    sql_rows = "select day, amount, sum(amount) over (order by day, amount rows between 1 preceding and 1 following) as s from daily order by day, amount"
    sql_range = "select day, amount, sum(amount) over (order by day range between interval 1 day preceding and current row) as s from daily order by day, amount"
    sql_run = "select day, amount, sum(amount) over (order by day, amount) as s from daily order by day, amount"
    r_rows = [r[2] for r in con.sql(sql_rows).fetchall()]
    r_range = [r[2] for r in con.sql(sql_range).fetchall()]
    r_run = [r[2] for r in con.sql(sql_run).fetchall()]
    show("the same six days under three frames", table([[str(d), a, x, y, z] for (d, a), x, y, z in zip(sorted(rows), r_rows, r_range, r_run)], ["day", "amount", "ROWS 1 before to 1 after", "RANGE 1 day before", "running total"]))
    check("ROWS counts rows: each row adds its neighbours", r_rows == [30, 35, 55, 75, 120, 90], str(r_rows))
    check("RANGE counts days: the two rows of 3 March are peers: both see the day before and each other", r_range == [10, 30, 55, 55, 40, 90], str(r_range))
    check("a running total adds every row up to the current one", r_run == [10, 30, 35, 65, 105, 155], str(r_run))
    nm = con.sql("select amount, lag(amount) over w as prev, lead(amount) over w as nxt from daily window w as (order by day, amount) order by day, amount").fetchall()
    check("a named window is written once and lag and lead read the row before and after", nm[0] == (10, None, 20) and nm[2] == (5, 20, 30), str(nm[:3]))
    big = con.sql("select customer_id, order_id, sum(qty * unit_price) over (partition by customer_id order by order_id) as running from orders where customer_id <= 3 order by customer_id, order_id").fetchall()
    last = {}
    for c, _, r in big:
        last[c] = r
    tot = dict(con.sql("select customer_id, sum(qty * unit_price) from orders where customer_id <= 3 group by all").fetchall())
    check("the last running total of a customer is the customer's total", all(abs(last[c] - tot[c]) < 1e-6 for c in last))

    # ---- 4. PIVOT ----
    pv = con.sql("pivot (select country, status, qty from o) on status using sum(qty) group by country order by country").fetchall()
    cols = [d[0] for d in con.sql("pivot (select country, status, qty from o) on status using sum(qty) group by country").description]
    check("PIVOT turns the four values of status into four columns", cols == ["country", "cancelled", "paid", "refunded", "shipped"], str(cols))
    long = dict(((c, s), v) for c, s, v in con.sql("select country, status, sum(qty) from o group by all").fetchall())
    check("a cell of the pivot is the sum of the long table for that country and status", all(pv[i][j + 1] == long[(pv[i][0], cols[j + 1])] for i in range(8) for j in range(4)))
    un = con.sql("unpivot (pivot (select country, status, qty from o) on status using sum(qty) group by country) on cancelled, paid, refunded, shipped into name status value qty").fetchall()
    check("UNPIVOT turns them back into 32 rows", len(un) == 32)

    # ---- 5. ASOF JOIN ----
    con.execute("create table prices (ts timestamp, price decimal(6, 2))")
    con.execute("create table trades (ts timestamp, qty int)")
    prices = [(datetime(2025, 3, 1, 9, 0), 10.00), (datetime(2025, 3, 1, 9, 30), 10.50), (datetime(2025, 3, 1, 10, 15), 9.80)]
    trades = [(datetime(2025, 3, 1, 8, 59), 1), (datetime(2025, 3, 1, 9, 0), 2), (datetime(2025, 3, 1, 9, 45), 3), (datetime(2025, 3, 1, 11, 0), 4)]
    con.executemany("insert into prices values (?, ?)", prices)
    con.executemany("insert into trades values (?, ?)", trades)
    inner = con.sql("select t.ts, t.qty, p.ts as price_ts, p.price from trades t asof join prices p on t.ts >= p.ts order by t.ts").fetchall()
    left = con.sql("select t.ts, t.qty, p.ts as price_ts, p.price from trades t asof left join prices p on t.ts >= p.ts order by t.ts").fetchall()
    show("each trade with the price in force", table([[str(r[0])[11:16], r[1], str(r[2])[11:16], r[3]] for r in left], ["trade at", "qty", "price set at", "price"]))
    check("ASOF JOIN drops the trade at 08:59 because no price existed yet", len(inner) == 3)
    check("ASOF LEFT JOIN keeps it with NULL", left[0][3] is None and len(left) == 4)
    check("a trade at exactly 09:00 takes the 09:00 price (>= includes equal)", str(left[1][3]) == "10.00" and str(left[2][3]) == "10.50" and str(left[3][3]) == "9.80", str([r[3] for r in left]))
    range_join = con.sql("select count(*) from trades t join prices p on p.ts <= t.ts").fetchone()[0]
    check("the plain join on the same condition returns every earlier price, not the nearest: 1 + 2 + 3 = 6 rows (the 08:59 trade has none)", range_join == 0 + 1 + 2 + 3, str(range_join))

    # ---- 6. LATERAL ----
    lat = con.sql(
        """select c.customer_id, top.order_id, top.total from customers c,
           lateral (select order_id, qty * unit_price as total from orders o where o.customer_id = c.customer_id order by total desc, order_id limit 2) top
           where c.customer_id <= 2 order by c.customer_id, top.total desc"""
    ).fetchall()
    check("LATERAL gives the top two orders of each customer (the subquery reads c.customer_id from the row on its left)", [r[0] for r in lat] == [1, 1, 2, 2], str(lat))
    ref = con.sql("select customer_id, order_id from orders where customer_id <= 2 qualify row_number() over (partition by customer_id order by qty * unit_price desc, order_id) <= 2 order by customer_id").fetchall()
    check("and the same orders come out of QUALIFY", sorted((r[0], r[1]) for r in lat) == sorted(ref))

    if WRITE:
        write_json(
            LABS / "analysis.json",
            {
                "daily": [{"day": str(d), "amount": a, "rows": x, "range": y, "running": z} for (d, a), x, y, z in zip(sorted(rows), r_rows, r_range, r_run)],
                "asof": {"prices": [[str(t)[11:16], float(p)] for t, p in prices], "trades": [{"at": str(t)[11:16], "qty": q, "price": (None if r[3] is None else float(r[3]))} for (t, q), r in zip(trades, left)]},
            },
        )


main_guard(main)
