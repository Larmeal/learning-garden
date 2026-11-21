"""Lesson 2: query files without loading them. CSV, Parquet and JSON are tables, a folder is a table, and a column in a folder name can skip whole files.

Asserts what the CSV sniffer finds in a messy file and what each option changes (types, decimal separator, nullstr, store_rejects), that a Parquet file is smaller than
the CSV it came from and carries its own column types, that a Hive layout (`y=2025/m=3/`) lets a filter on `m` open one file out of twelve and that a filter on a column
that is not in the folder name opens all twelve, and that a newline-delimited JSON file reads like a table. `--write` saves the layout for GlobLab (`files.json`).
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ddb import LABS, check, connect, fresh_dir, main_guard, make_shop, show, table, write_json  # noqa: E402

WRITE = "--write" in sys.argv


def scan_info(con, sql: str, work: Path) -> dict:
    """Run `sql` with profiling on and return the scan node of its plan (files read, rows). The profile is the one the engine itself writes."""
    prof = work / "profile.json"
    con.execute("pragma enable_profiling='json'")
    con.execute(f"pragma profiling_output='{prof.as_posix()}'")
    con.execute(sql).fetchall()
    con.execute("pragma disable_profiling")
    found = []

    def walk(n):
        if "Total Files Read" in n.get("extra_info", {}):
            found.append(n)
        for c in n.get("children", []):
            walk(c)

    walk(json.loads(prof.read_text(encoding="utf-8")))
    return {"files": int(found[0]["extra_info"]["Total Files Read"]), "rows": found[0]["operator_cardinality"]}


def main() -> None:
    work = fresh_dir("02")
    con = connect()

    # ---- 1. a messy CSV, and what the sniffer finds ----
    messy = work / "messy.csv"
    messy.write_bytes(
        b'id;name;joined;score;note\n1;Anna;2025-01-03;7,5;"likes ""quotes"""\n2;Bo;2025-02-03;8,0;\n3;Chai;2025-02-30;n/a;multi\n4;Dee;2025-03-01;9,25;ok\n'
    )
    p = messy.as_posix()
    sn = con.sql(f"select Delimiter, Quote, Escape, HasHeader, Columns from sniff_csv('{p}')").fetchone()
    show("sniff_csv on a file with ; as delimiter, a decimal comma and a doubled quote", f"delimiter {sn[0]!r}  quote {sn[1]!r}  header {sn[3]}\n" + "\n".join(f"{c['name']:7} {c['type']}" for c in sn[4]))
    check("the sniffer finds the delimiter ; the quote and the header", (sn[0], sn[1], sn[3]) == (";", '"', True))
    types = {c["name"]: c["type"] for c in sn[4]}
    check("it types id as a number but leaves score and joined as text (a comma decimal, a date that does not exist)", types == {"id": "BIGINT", "name": "VARCHAR", "joined": "VARCHAR", "score": "VARCHAR", "note": "VARCHAR"}, str(types))
    row1 = con.sql(f"select * from read_csv('{p}') where id = 1").fetchone()
    check("a doubled quote inside quotes is read as one quote", row1[4] == 'likes "quotes"', row1[4])
    check("an empty field is NULL by default", con.sql(f"select note from read_csv('{p}') where id = 2").fetchone()[0] is None)

    try:
        con.sql(f"select * from read_csv('{p}', types={{'score': 'DOUBLE'}})").fetchall()
        raise AssertionError("forcing DOUBLE should fail on 7,5")
    except Exception as e:  # noqa: BLE001
        msg = str(e)
    check("forcing score to DOUBLE fails and the message names the line and the value", "Line: 2" in msg and '"7,5"' in msg, msg[:80])

    ok = con.sql(f"select * from read_csv('{p}', decimal_separator=',', nullstr='n/a') order by id").fetchall()
    check("decimal_separator and nullstr fix score (n/a becomes NULL)", [r[3] for r in ok] == [7.5, 8.0, None, 9.25], str([r[3] for r in ok]))
    check("nullstr replaces the default: the empty note of Bo is now an empty string, not NULL", ok[1][4] == "", repr(ok[1][4]))

    good = con.sql(
        f"select * from read_csv('{p}', decimal_separator=',', nullstr='n/a', types={{'joined': 'DATE'}}, ignore_errors=true, store_rejects=true) order by id"
    ).fetchall()
    rej = con.sql("select line, column_name, error_type, csv_line from reject_errors").fetchall()
    show("rows read with joined as DATE, and the reject table", table([list(r)[:3] for r in good], ["id", "name", "joined"]) + "\n\nreject_errors:\n" + table([[r[0], r[1], r[2]] for r in rej], ["line", "column", "error"]))
    check("the row with 2025-02-30 is left out and 3 rows are read", [r[0] for r in good] == [1, 2, 4])
    check("reject_errors names line 4, column joined, a CAST error", [(r[0], r[1], r[2]) for r in rej] == [(4, "joined", "CAST")], str(rej))

    # ---- 2. CSV, Parquet and DuckDB file, same table ----
    make_shop(con)
    csv, pq = work / "orders.csv", work / "orders.parquet"
    con.execute(f"copy orders to '{csv.as_posix()}' (header)")
    con.execute(f"copy orders to '{pq.as_posix()}' (format parquet)")
    sizes = {"csv": csv.stat().st_size, "parquet": pq.stat().st_size}
    show("the same one million orders in two files", table([[k, f"{v:,}", f"{v / sizes['csv']:.0%}"] for k, v in sizes.items()], ["file", "bytes", "of the CSV"]))
    check("the Parquet file is under half the size of the CSV", sizes["parquet"] < sizes["csv"] / 2)
    ct = con.sql(f"describe select * from '{csv.as_posix()}'").fetchall()
    pt = con.sql(f"describe select * from '{pq.as_posix()}'").fetchall()
    show("the types DuckDB reads from each file", table([[a[0], a[1], b[1]] for a, b in zip(ct, pt)], ["column", "from the CSV (guessed)", "from the Parquet (stored)"]))
    check("the order_ts column is a TIMESTAMP from both files", dict((a[0], a[1]) for a in pt)["order_ts"] == "TIMESTAMP" and dict((a[0], a[1]) for a in ct)["order_ts"] == "TIMESTAMP")
    n_csv = con.sql(f"select count(*) from '{csv.as_posix()}'").fetchone()[0]
    n_pq = con.sql(f"select count(*) from '{pq.as_posix()}'").fetchone()[0]
    check("a quoted file name in FROM is a table: both files hold one million rows", n_csv == n_pq == 1_000_000)

    # ---- 3. a folder as a table, Hive layout ----
    root = work / "by_month"
    con.execute(f"copy (select *, year(order_ts) as y, month(order_ts) as m from orders) to '{root.as_posix()}' (format parquet, partition_by (y, m))")
    parts = sorted(root.rglob("*.parquet"), key=lambda q: int(q.parent.name[2:]))
    check("twelve folders y=2025/m=1 to m=12, one file each", len(parts) == 12 and parts[0].parent.name == "m=1", str([p.parent.name for p in parts]))
    glob = f"{root.as_posix()}/*/*/*.parquet"
    base = f"select count(*), sum(qty * unit_price) from read_parquet('{glob}', hive_partitioning=true)"
    cases = [
        ("no filter", base),
        ("where m = 3", base + " where m = 3"),
        ("where m in (3, 4)", base + " where m in (3, 4)"),
        ("where y = 2024", base + " where y = 2024"),
        ("where order_ts >= '2025-12-01' (not in a folder name)", base + " where order_ts >= timestamp '2025-12-01'"),
        ("where status = 'refunded' (not in a folder name)", base + " where status = 'refunded'"),
    ]
    layout = []
    for label, sql in cases:
        info = scan_info(con, sql, work)
        layout.append({"filter": label, **info})
    show("how many of the 12 files each filter opens", table([[c["filter"], c["files"], f"{c['rows']:,}"] for c in layout], ["filter", "files opened", "rows the scan returned"]))
    by = {c["filter"]: c for c in layout}
    check("without a filter all 12 files are opened", by["no filter"]["files"] == 12)
    check("a filter on m opens 1 file, and m in (3, 4) opens 2", by["where m = 3"]["files"] == 1 and by["where m in (3, 4)"]["files"] == 2)
    check("a filter on a year that has no folder opens none", by["where y = 2024"]["files"] == 0)
    check("a filter on a column inside the files still opens all 12 (the folder name says nothing about it)", by["where status = 'refunded' (not in a folder name)"]["files"] == 12)
    month3 = con.sql("select count(*) from orders where month(order_ts) = 3").fetchone()[0]
    got = con.sql(base + " where m = 3").fetchone()[0]
    check("the rows of month 3 are the same whether read from the folder or from the table", got == month3, f"{got} vs {month3}")
    filename = con.sql(f"select distinct filename from read_parquet('{glob}', hive_partitioning=true, filename=true) where m = 3").fetchall()
    check("filename=true names the file each row came from", len(filename) == 1 and "m=3" in filename[0][0].replace("\\", "/"))

    # ---- 4. JSON, newline delimited ----
    js = work / "events.json"
    js.write_bytes(
        b'{"id": 1, "user": {"name": "Anna", "tags": ["a", "b"]}, "amount": 12.5}\n{"id": 2, "user": {"name": "Bo", "tags": []}, "amount": 3}\n{"id": 3, "user": {"name": "Chai", "tags": ["c"]}, "amount": null}\n'
    )
    d = con.sql(f"describe select * from '{js.as_posix()}'").fetchall()
    show("describe of a JSON file with a nested object", table([[r[0], r[1]] for r in d], ["column", "type"]))
    check("JSON becomes typed columns, the nested object becomes a STRUCT and the array a list", {r[0]: r[1] for r in d} == {"id": "BIGINT", "user": 'STRUCT("name" VARCHAR, tags VARCHAR[])', "amount": "DOUBLE"}, str(d))
    names = con.sql(f"select user.name from '{js.as_posix()}' order by id").fetchall()
    check("a dot reaches into the STRUCT", names == [("Anna",), ("Bo",), ("Chai",)])

    if WRITE:
        rows = [{"path": f"y=2025/m={i}/data_0.parquet", "month": i, "rows": con.sql(f"select count(*) from read_parquet('{q.as_posix()}')").fetchone()[0]} for i, q in enumerate(parts, 1)]
        write_json(LABS / "files.json", {"files": rows, "cases": layout})


main_guard(main)
