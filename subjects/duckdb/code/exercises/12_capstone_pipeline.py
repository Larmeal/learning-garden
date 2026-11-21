"""Lesson 12 (capstone): a daily load with DuckDB. Ten CSV files of orders land with six kinds of defect planted in fixed numbers, and one script reads, checks, separates, loads and reports them.

Asserts the count of each planted defect, that every row ends in exactly one place (clean, quarantined or removed as a duplicate), that a load which fails halfway leaves the database as it was, that running the
same load twice adds nothing, that the clean table written as Parquet by month reads back to the same numbers, and that pandas, given the same rules, ends with the same clean rows and the same revenue.
`--write` saves the row counts of each stage for PipelineLab (`pipeline.json`).
"""

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ddb import LABS, check, connect, fresh_dir, main_guard, make_shop, show, table, write_json  # noqa: E402

WRITE = "--write" in sys.argv

def land(con, landing: Path) -> dict:
    """Write ten daily CSV files from the first 10 days of orders, with defects planted by the order number."""
    make_shop(con)
    con.execute(
        """create or replace table src as
           select order_id,
                  case when order_id % 1000 = 0 then '' else customer_id::varchar end as customer_id,
                  product_id, case when order_id % 700 = 0 then -(qty::int) else qty::int end as qty,
                  case when order_id % 1500 = 0 then 'N/A' else unit_price::varchar end as unit_price,
                  case when order_id % 900 = 0 then 'PAID ' when order_id % 1100 = 0 then 'delivered' else status end as status,
                  case when order_id % 1300 = 0 then order_ts + interval 10 years else order_ts end as order_ts, order_ts::date as day
           from orders where order_ts < timestamp '2025-01-11'"""
    )
    con.execute("create or replace table dup as select * from src where order_id % 200 = 0")
    for d in range(1, 11):
        day = f"2025-01-{d:02d}"
        con.execute(
            f"""copy (select * exclude (day) from (select * from src union all select * from dup) where day = date '{day}')
                to '{(landing / f'orders_{day}.csv').as_posix()}' (header)"""
        )
    return {"files": len(list(landing.glob("*.csv"))), "source_rows": con.sql("select count(*) from src").fetchone()[0], "duplicates": con.sql("select count(*) from dup").fetchone()[0]}


RULES = """
    case when customer_id is null then 'missing_customer'
         when qty <= 0 then 'negative_qty'
         when unit_price is null then 'bad_price'
         when status not in ('paid', 'shipped', 'cancelled', 'refunded') then 'unknown_status'
         when order_ts > timestamp '2025-12-31 23:59:59' then 'future_date' end
"""


def load(con, landing: Path) -> dict:
    """The whole load, in one transaction. Returns the counts of each stage."""
    con.execute("begin")
    con.execute(
        f"""create or replace temp table raw as
            select * from read_csv('{landing.as_posix()}/orders_*.csv', all_varchar = true, union_by_name = true, filename = true)"""
    )
    n_raw = con.sql("select count(*) from raw").fetchone()[0]
    con.execute(
        """create or replace temp table typed as
           select order_id::bigint as order_id, try_cast(nullif(customer_id, '') as bigint) as customer_id, product_id::bigint as product_id,
                  qty::int as qty, try_cast(unit_price as double) as unit_price, status, try_cast(order_ts as timestamp) as order_ts, filename
           from raw"""
    )
    con.execute("create or replace temp table dedup as select * from typed qualify row_number() over (partition by order_id order by filename) = 1")
    n_dup = con.sql("select count(*) from typed").fetchone()[0] - con.sql("select count(*) from dedup").fetchone()[0]
    con.execute(f"create or replace temp table judged as select *, {RULES} as reason from dedup")
    con.execute("create table if not exists clean (order_id bigint primary key, customer_id bigint, product_id bigint, qty int, unit_price double, status varchar, order_ts timestamp)")
    con.execute("create table if not exists quarantine (order_id bigint, reason varchar, filename varchar)")
    before = con.sql("select count(*) from clean").fetchone()[0]
    con.execute("insert into clean select order_id, customer_id, product_id, qty, unit_price, status, order_ts from judged where reason is null on conflict do nothing")
    con.execute("insert into quarantine select order_id, reason, filename from judged where reason is not null and order_id not in (select order_id from quarantine)")
    added = con.sql("select count(*) from clean").fetchone()[0] - before
    con.execute("commit")
    return {"raw": n_raw, "duplicate": n_dup, "judged": con.sql("select count(*) from judged").fetchone()[0], "added": added}


def main() -> None:
    work = fresh_dir("12")
    landing = work / "landing"
    landing.mkdir()
    con = connect()
    info = land(con, landing)
    show("the landing folder", f"{info['files']} files, {info['source_rows']:,} orders, {info['duplicates']:,} of them delivered twice")
    check("ten daily files", info["files"] == 10)

    # ---- 1. load, check, separate ----
    db = connect(work / "warehouse.duckdb")
    got = load(db, landing)
    q = dict(db.sql("select reason, count(*) from quarantine group by all").fetchall())
    clean = db.sql("select count(*) from clean").fetchone()[0]
    stages = [["raw rows read", got["raw"]], ["removed as duplicate", got["duplicate"]], ["judged", got["judged"]], ["quarantined", sum(q.values())], ["clean", clean]]
    show("rows at each stage", table(stages, ["stage", "rows"]))
    show("quarantine by reason", table(sorted(q.items()), ["reason", "rows"]))
    check("the files hold the source rows plus the duplicates", got["raw"] == info["source_rows"] + info["duplicates"], f"{got['raw']}")
    check("every duplicate is found once and removed", got["duplicate"] == info["duplicates"])
    check("every row is in exactly one place: clean + quarantined = judged", clean + sum(q.values()) == got["judged"] == info["source_rows"])
    src_counts = con.sql(
        """select count(*) filter (where order_id % 1000 = 0) as missing_customer,
                  count(*) filter (where order_id % 1000 != 0 and order_id % 700 = 0) as negative_qty,
                  count(*) filter (where order_id % 1000 != 0 and order_id % 700 != 0 and order_id % 1500 = 0) as bad_price,
                  count(*) filter (where order_id % 1000 != 0 and order_id % 700 != 0 and order_id % 1500 != 0 and (order_id % 900 = 0 or order_id % 1100 = 0)) as unknown_status,
                  count(*) filter (where order_id % 1000 != 0 and order_id % 700 != 0 and order_id % 1500 != 0 and order_id % 900 != 0 and order_id % 1100 != 0 and order_id % 1300 = 0) as future_date
           from src"""
    ).fetchone()
    names = ["missing_customer", "negative_qty", "bad_price", "unknown_status", "future_date"]
    planted = dict(zip(names, src_counts))
    show("planted by the generator (first failing rule wins) against found by the load", table([[k, planted[k], q.get(k, 0)] for k in names], ["rule", "planted", "found"]))
    for k in names:
        check(f"{k}: found = planted", q.get(k, 0) == planted[k], f"{q.get(k, 0)} vs {planted[k]}")
    check("the planted numbers are the ones the lesson prints", planted == {"missing_customer": 27, "negative_qty": 36, "bad_price": 8, "unknown_status": 36, "future_date": 12}, str(planted))

    # ---- 2. one transaction: a failure leaves nothing behind ----
    before = db.sql("select (select count(*) from clean), (select count(*) from quarantine)").fetchone()
    broken = work / "landing2"
    broken.mkdir()
    (broken / "orders_2025-02-01.csv").write_bytes(b"order_id,customer_id,product_id,qty,unit_price,status,order_ts\n999999999,1,1,1,9.5,paid,2025-02-01 00:00:00\nnot-a-number,1,1,1,9.5,paid,2025-02-01 00:00:01\n")
    try:
        load(db, broken)
        raise AssertionError("order_id 'not-a-number' cannot be cast to bigint")
    except Exception as e:  # noqa: BLE001
        msg = str(e)
    db.execute("rollback")
    after = db.sql("select (select count(*) from clean), (select count(*) from quarantine)").fetchone()
    check("a file with a row that cannot be read stops the load with a conversion error", "Conversion Error" in msg and "not-a-number" in msg, msg[:100])
    check("and clean and quarantine are exactly as they were", before == after, f"{before} vs {after}")

    # ---- 3. the same load twice ----
    again = load(db, landing)
    check("a second run of the same files adds no clean row", again["added"] == 0)
    check("and no quarantine row (each is listed once)", db.sql("select count(*) from quarantine").fetchone()[0] == sum(q.values()))

    # ---- 4. Parquet by month, and a report ----
    out = work / "clean"
    db.execute(f"copy (select *, month(order_ts) as m from clean) to '{out.as_posix()}' (format parquet, partition_by (m))")
    back = db.sql(f"select count(*), round(sum(qty * unit_price), 2) from read_parquet('{out.as_posix()}/*/*.parquet')").fetchone()
    live = db.sql("select count(*), round(sum(qty * unit_price), 2) from clean").fetchone()
    check("the Parquet folder reads back to the same count and the same revenue", back == live, f"{back} vs {live}")
    rep = db.sql("select status, count(*) as orders, round(sum(qty * unit_price), 2) as revenue from clean group by all order by all").fetchall()
    show("report: revenue by status", table(rep, ["status", "orders", "revenue"]))
    check("the report has the four real statuses and no 'PAID ' or 'delivered'", [r[0] for r in rep] == ["cancelled", "paid", "refunded", "shipped"])

    # ---- 5. pandas, same rules ----
    frames = [pd.read_csv(p, dtype=str, keep_default_na=False) for p in sorted(landing.glob("orders_*.csv"))]
    pdf = pd.concat(frames).drop_duplicates(subset="order_id", keep="first")
    pdf["customer_id"] = pd.to_numeric(pdf["customer_id"].replace("", None), errors="coerce")
    pdf["qty"] = pdf["qty"].astype(int)
    pdf["unit_price"] = pd.to_numeric(pdf["unit_price"], errors="coerce")
    pdf["order_ts"] = pd.to_datetime(pdf["order_ts"], format="ISO8601")  # without this hint pandas stops at "...:00.5": a timestamp with half a second has a different length
    ok = (
        pdf["customer_id"].notna() & (pdf["qty"] > 0) & pdf["unit_price"].notna() & pdf["status"].isin(["paid", "shipped", "cancelled", "refunded"]) & (pdf["order_ts"] <= pd.Timestamp("2025-12-31 23:59:59"))
    )
    pclean = pdf[ok]
    check("pandas with the same rules keeps the same number of clean rows", len(pclean) == clean, f"{len(pclean)} vs {clean}")
    check("and the same revenue to the cent", abs((pclean.qty * pclean.unit_price).sum() - live[1]) < 0.01)

    if WRITE:
        write_json(LABS / "pipeline.json", {"files": info["files"], "stages": {"raw": got["raw"], "duplicate": got["duplicate"], "judged": got["judged"], "clean": clean, "quarantine": sum(q.values())}, "quarantine": q, "planted": planted})


main_guard(main)
