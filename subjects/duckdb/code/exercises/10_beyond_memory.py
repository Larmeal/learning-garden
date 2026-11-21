"""Lesson 10: more data than memory, and more than one user. A memory limit makes big operators spill to a temp folder, and one process at a time may write a database file.

Asserts that the same GROUP BY over 20 million rows gives the same answer under every memory limit, that it writes nothing to the temp folder at 1 GB and writes hundreds of megabytes at 200 MB
(and takes longer), that an operator that cannot spill (a list of 50 million numbers in one cell) stops with an out-of-memory error that names the limit, that a Parquet file larger than the limit is
still summed, that a second process cannot open a database that a first process has open for writing, that two processes can both read it when it is opened read only, and that two transactions that change the same row
do not both succeed. `--write` saves the table of limits for SpillLab (`spill.json`).
"""

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ddb import LABS, check, connect, fresh_dir, main_guard, show, table, write_json  # noqa: E402

WRITE = "--write" in sys.argv
HERE = Path(__file__).resolve().parent.parent


def main() -> None:
    work = fresh_dir("10")
    tmp = work / "tmp"
    tmp.mkdir()
    prof = work / "p.json"
    con = connect()
    con.execute(f"set temp_directory='{tmp.as_posix()}'")

    def run(sql: str) -> tuple[list, dict]:
        con.execute("pragma enable_profiling='json'")
        con.execute(f"pragma profiling_output='{prof.as_posix()}'")
        rows = con.execute(sql).fetchall()
        con.execute("pragma disable_profiling")
        return rows, json.loads(prof.read_text(encoding="utf-8"))

    # ---- 1. the same query under smaller and smaller limits ----
    q = "select count(*), sum(c) from (select hash(i) % 8000000 as k, count(*) as c from range(20000000) t(i) group by k)"
    table_rows = []
    answers = set()
    for lim in ("2GB", "1GB", "600MB", "400MB", "200MB", "100MB"):
        con.execute(f"set memory_limit='{lim}'")
        rows, p = run(q)
        answers.add(rows[0])
        table_rows.append({"limit": lim, "tempMB": round(p["system_peak_temp_dir_size"] / 1e6), "seconds": round(p["latency"], 2)})
    con.execute("set memory_limit='8GB'")
    show("the same GROUP BY with 7.3 million groups under six memory limits", table([[r["limit"], r["tempMB"], r["seconds"]] for r in table_rows], ["memory_limit", "peak temp folder (MB)", "seconds"]))
    check("every limit gives the same answer: (7344514 groups, 20000000 rows)", answers == {(7_344_514, 20_000_000)}, str(answers))
    by = {r["limit"]: r for r in table_rows}
    check("with 1 GB (or more) nothing is written to the temp folder", by["2GB"]["tempMB"] == 0 and by["1GB"]["tempMB"] == 0)
    check("with 200 MB more than 100 MB goes to the temp folder", by["200MB"]["tempMB"] > 100, str(by["200MB"]))
    check("the less memory, the more it spills: 400 MB <= 200 MB", by["400MB"]["tempMB"] <= by["200MB"]["tempMB"])
    check("and the slower it runs: 200 MB takes longer than 1 GB", by["200MB"]["seconds"] > by["1GB"]["seconds"], f"{by['200MB']['seconds']} vs {by['1GB']['seconds']}")
    check("the temp folder is empty again after the query", not any(tmp.iterdir()))

    # ---- 2. what cannot spill ----
    con.execute("set memory_limit='100MB'")
    try:
        con.execute("select len(list(i)) from range(50000000) t(i)").fetchall()
        raise AssertionError("one list of 50 million numbers cannot fit in 100 MB")
    except Exception as e:  # noqa: BLE001
        msg = str(e)
    check("a list of 50 million numbers in one cell stops with an out-of-memory error", "Out of Memory" in msg, msg[:80])
    check("and the message names the limit and the setting that changes it", "100.0 MiB" in msg or "100MB" in msg or "memory_limit" in msg, msg[:300])
    con.execute("set memory_limit='8GB'")
    check("the connection still works after the error", con.sql("select 1").fetchone() == (1,))

    # ---- 3. a file bigger than the limit ----
    big = work / "big.parquet"
    con.execute(f"copy (select i as id, hash(i) as h, (i % 1000)::int as g from range(30000000) t(i)) to '{big.as_posix()}' (format parquet)")
    size = big.stat().st_size
    con.execute("set memory_limit='64MB'")
    got = con.sql(f"select count(*), sum(g) from '{big.as_posix()}'").fetchone()
    con.execute("set memory_limit='8GB'")
    check(f"a Parquet file of {size / 1e6:.0f} MB is read and summed with a 64 MB limit (it streams)", size > 64_000_000 and got == (30_000_000, sum(i % 1000 for i in range(30_000_000))), f"{got}")

    # ---- 4. one writer, many readers ----
    db = work / "shop.duckdb"
    w = connect(db)
    w.execute("create table t as select i as id, 0 as v from range(10) t(i)")
    w.execute("checkpoint")
    child = f"import duckdb, sys; c = duckdb.connect(sys.argv[1], read_only={{ro}}); print(c.sql('select count(*) from t').fetchone()[0])"
    rw = subprocess.run([sys.executable, "-I", "-c", child.format(ro=False), str(db)], capture_output=True, text=True, cwd=HERE)
    check("a second process cannot open a database that the first has open for writing", rw.returncode != 0 and ("already open" in rw.stderr.lower() or "lock" in rw.stderr.lower()), rw.stderr.strip()[-200:])
    ro = subprocess.run([sys.executable, "-I", "-c", child.format(ro=True), str(db)], capture_output=True, text=True, cwd=HERE)
    check("not even a read only open works while the writer is open", ro.returncode != 0, ro.stdout)
    w.close()
    outs = []
    procs = [subprocess.Popen([sys.executable, "-I", "-c", child.format(ro=True), str(db)], stdout=subprocess.PIPE, text=True, cwd=HERE) for _ in range(3)]
    for p in procs:
        outs.append(p.communicate()[0].strip())
    check("after the writer closes, three processes can read the file at the same time", outs == ["10", "10", "10"], str(outs))

    # ---- 5. two transactions, one row ----
    w = connect(db)
    a, b = w.cursor(), w.cursor()
    a.execute("begin")
    b.execute("begin")
    a.execute("update t set v = 1 where id = 3")
    try:
        b.execute("update t set v = 2 where id = 3")
        conflict = ""
    except Exception as e:  # noqa: BLE001
        conflict = str(e)
    check("the second update of the same row fails right away with a conflict", "conflict" in conflict.lower(), conflict[:100])
    b.execute("rollback")
    a.execute("commit")
    check("the first update stands", w.sql("select v from t where id = 3").fetchone()[0] == 1)
    a.execute("begin")
    b.execute("begin")
    a.execute("update t set v = 5 where id = 4")
    b.execute("update t set v = 6 where id = 5")
    a.execute("commit")
    b.execute("commit")
    check("updates of two different rows both succeed", w.sql("select v from t where id in (4, 5) order by id").fetchall() == [(5,), (6,)])

    if WRITE:
        write_json(LABS / "spill.json", {"query": q, "limits": table_rows})


main_guard(main)
