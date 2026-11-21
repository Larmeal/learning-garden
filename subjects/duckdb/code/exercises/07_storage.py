"""Lesson 7: how DuckDB stores a table. A file of row groups, each column compressed on its own, with the minimum and the maximum of every column kept beside it.

Asserts that a table of one million rows is cut into row groups of 122,880 rows (nine of them, the last one short), that each column of a row group is stored with its own compression,
that the minimum and maximum of order_ts of the nine groups do not overlap, that a filter on order_ts reads one group while a filter on customer_id reads every group, that the file is
much smaller than the CSV, that a committed change sits in a `.wal` file until a checkpoint folds it into the main file, and that ROLLBACK undoes a change and a second connection does not see it before COMMIT.
`--write` saves the row groups and what each filter read as `storage.json` for RowGroupLab.
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ddb import LABS, check, connect, fresh_dir, main_guard, make_shop, show, table, write_json  # noqa: E402

WRITE = "--write" in sys.argv
ROW_GROUP = 122_880


def rows_scanned(con, sql: str, prof: Path) -> tuple[int, int]:
    """(rows the scan looked at, rows that passed the filter) for the one table scan of `sql`, from the engine's own JSON profile."""
    con.execute("pragma enable_profiling='json'")
    con.execute(f"pragma profiling_output='{prof.as_posix()}'")
    con.execute(sql).fetchall()
    con.execute("pragma disable_profiling")
    found = []

    def walk(n):
        if n.get("operator_type") == "TABLE_SCAN":
            found.append(n)
        for c in n.get("children", []):
            walk(c)

    walk(json.loads(prof.read_text(encoding="utf-8")))
    return found[0]["operator_rows_scanned"], found[0]["operator_cardinality"]


def main() -> None:
    work = fresh_dir("07")
    path = work / "shop.duckdb"
    con = connect(path)
    make_shop(con)
    con.execute("checkpoint")

    # ---- 1. row groups ----
    groups = con.sql("select row_group_id, max(count) from pragma_storage_info('orders') where segment_type != 'VALIDITY' group by all order by 1").fetchall()
    show("rows in each row group of orders", table(groups, ["row group", "rows"]))
    check("nine row groups", len(groups) == 9)
    check("eight of 122,880 rows and a last one that holds the rest, 16,960", [g[1] for g in groups] == [ROW_GROUP] * 8 + [1_000_000 - 8 * ROW_GROUP])
    check("122,880 is 60 vectors of 2,048 rows", ROW_GROUP == 60 * 2048)

    # ---- 2. every column has its own compression ----
    comp = con.sql("select column_name, compression, count(*) from pragma_storage_info('orders') where segment_type != 'VALIDITY' and row_group_id = 0 group by all order by column_name").fetchall()
    show("compression of each column in row group 0", table(comp, ["column", "compression", "segments"]))
    by = {c[0]: c[1] for c in comp}
    check("the ids and small numbers are bit-packed", by["order_id"] == "BitPacking" and by["qty"] == "BitPacking" and by["customer_id"] == "BitPacking")
    check("status (four distinct strings) is stored as a dictionary", "DICT" in by["status"].upper(), by["status"])
    check("the decimal prices use a different method from the integers (ALP)", by["unit_price"] == "ALP", by["unit_price"])

    # ---- 3. min and max of each group ----
    stats = con.sql("select row_group_id, stats from pragma_storage_info('orders') where column_name = 'order_ts' and segment_type = 'TIMESTAMP' order by 1").fetchall()
    ts = [tuple(re.findall(r"Min: ([^,\]]+), Max: ([^\]]+?)\]", s)[0]) for _, s in stats]
    show("order_ts: the minimum and the maximum kept for each row group", table([[i, a, b] for i, (a, b) in enumerate(ts)], ["row group", "min", "max"]))
    check("the nine ranges of order_ts follow each other and never overlap", all(ts[i][1] < ts[i + 1][0] for i in range(8)))
    cust = [tuple(re.findall(r"Min: (\d+), Max: (\d+)", s)[0]) for _, s in con.sql("select row_group_id, stats from pragma_storage_info('orders') where column_name = 'customer_id' and segment_type = 'UBIGINT' order by 1").fetchall()]
    check("customer_id is 1 to 5000 in every group, so its min and max say nothing", all(c == ("1", "5000") for c in cust), str(cust[:2]))

    # ---- 4. what a filter reads ----
    prof = work / "p.json"
    stats_of = {}
    for col in ("order_id", "customer_id", "status"):
        rows = con.sql(f"select row_group_id, stats from pragma_storage_info('orders') where column_name = '{col}' and segment_type != 'VALIDITY' order by 1").fetchall()
        stats_of[col] = [re.search(r"Min: ([^,\]]+), Max: ([^,\]\[]+?)(?:\]|,)", s_).groups() for _, s_ in rows]
    stats_of["order_ts"] = ts
    # (label, condition, column, test of a [min, max] range of that column)
    filters = [
        ("order_ts >= '2025-12-26' (the last days)", "order_ts >= timestamp '2025-12-26'", "order_ts", lambda lo, hi: hi >= "2025-12-26"),
        ("order_ts in March", "order_ts >= timestamp '2025-03-01' and order_ts < timestamp '2025-04-01'", "order_ts", lambda lo, hi: hi >= "2025-03-01" and lo < "2025-04-01"),
        ("order_id = 777", "order_id = 777", "order_id", lambda lo, hi: int(lo) <= 777 <= int(hi)),
        ("customer_id = 5", "customer_id = 5", "customer_id", lambda lo, hi: int(lo) <= 5 <= int(hi)),
        ("status = 'refunded'", "status = 'refunded'", "status", lambda lo, hi: lo <= "refunded" <= hi),
        ("no filter", "true", None, None),
    ]
    read = []
    sizes = [g[1] for g in groups]
    for label, cond, col, test in filters:
        scanned, passed = rows_scanned(con, f"select count(*) from orders where {cond}", prof)
        keep = [i for i in range(len(groups)) if test is None or test(*stats_of[col][i])]
        read.append({"filter": label, "scanned": scanned, "passed": passed, "groups": keep})
        check(f"the row groups whose min and max overlap the filter hold exactly the rows that the scan looked at ({label})", sum(sizes[i] for i in keep) == scanned, f"{keep} {scanned}")
    show("rows the scan looked at, for a filter on each column", table([[r["filter"], f"{r['scanned']:,}", len(r["groups"]), f"{r['passed']:,}"] for r in read], ["filter", "rows looked at", "row groups read", "rows that matched"]))
    r = {x["filter"]: x for x in read}
    check("the last days of order_ts live in the last row group: 16,960 rows looked at", r["order_ts >= '2025-12-26' (the last days)"]["scanned"] == 16_960)
    check("order_id = 777 looks at one row group: 122,880 rows", r["order_id = 777"]["scanned"] == ROW_GROUP)
    check("March spans two row groups: 245,760 rows looked at", r["order_ts in March"]["scanned"] == 2 * ROW_GROUP, str(r["order_ts in March"]["scanned"]))
    check("customer_id = 5 looks at all one million rows although only 189 match", r["customer_id = 5"]["scanned"] == 1_000_000 and r["customer_id = 5"]["passed"] == 189)
    check("status = 'refunded' also looks at everything", r["status = 'refunded'"]["scanned"] == 1_000_000)

    # ---- 5. the file against the CSV ----
    con.execute(f"copy orders to '{(work / 'orders.csv').as_posix()}' (header)")
    con.execute("checkpoint")
    db, csv = path.stat().st_size, (work / "orders.csv").stat().st_size
    show("the same one million orders", table([["orders.csv", f"{csv:,}"], ["shop.duckdb (with customers)", f"{db:,}"]], ["file", "bytes"]))
    check("the DuckDB file is under a quarter of the CSV", db < csv / 4, f"{db:,} vs {csv:,}")

    # ---- 6. the write-ahead log ----
    con.close()
    con = connect(path)
    wal = Path(str(path) + ".wal")
    check("after a clean close and reopen there is no .wal file", not wal.exists())
    con.execute("create table notes (id int, txt varchar)")
    con.execute("insert into notes values (1, 'a'), (2, 'b')")
    check("a committed change shows up in the .wal file before any checkpoint", wal.exists() and wal.stat().st_size > 0, str(list(work.iterdir())))
    wal_size = wal.stat().st_size
    con.execute("checkpoint")
    check("CHECKPOINT folds the log into the main file and the .wal file is gone", not wal.exists())
    print(f"  the log held {wal_size:,} bytes for two rows before the checkpoint")

    # ---- 7. transactions ----
    con.execute("begin")
    con.execute("insert into notes values (3, 'c')")
    inside = con.sql("select count(*) from notes").fetchone()[0]
    cur = con.cursor()
    outside = cur.sql("select count(*) from notes").fetchone()[0]
    con.execute("rollback")
    after = con.sql("select count(*) from notes").fetchone()[0]
    check("inside the transaction the new row is visible: 3", inside == 3)
    check("another connection of the same database does not see it before COMMIT: 2", outside == 2)
    check("ROLLBACK removes it: 2", after == 2)
    con.execute("begin")
    con.execute("insert into notes values (3, 'c')")
    con.execute("commit")
    check("COMMIT keeps it and the second connection sees it now", cur.sql("select count(*) from notes").fetchone()[0] == 3)

    if WRITE:
        groups_json = [{"id": i, "rows": g[1], "min": ts[i][0], "max": ts[i][1]} for i, g in enumerate(groups)]
        write_json(LABS / "storage.json", {"rowGroup": ROW_GROUP, "groups": groups_json, "filters": read, "compression": [{"column": c[0], "compression": c[1]} for c in comp], "bytes": {"csv": csv, "duckdb": db}})


main_guard(main)
