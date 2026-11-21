"""Lesson 8: how a query runs. A table is read a vector (2,048 rows) at a time, the vectors pass through a pipeline of operators, and the threads each take a whole row group.

Asserts that a scan hands over vectors of 2,048 rows (488 full ones and one of 576 for a million rows), that a filter makes the vectors that follow it smaller instead of refilling them,
that the operators of a plan are the ones the lesson draws and report the row counts the lesson prints, that a table of one row group cannot use more than one thread while a table of nine
row groups can, that more threads give a CPU time that is larger than the wall time, and that the answer does not depend on the number of threads. `--write` saves the numbers for VectorLab (`execution.json`).
"""

import collections
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ddb import LABS, check, connect, fresh_dir, main_guard, make_shop, show, table, write_json  # noqa: E402

WRITE = "--write" in sys.argv


def chunk_sizes(con, sql: str) -> list[int]:
    res = con.execute(sql)
    out = []
    while True:
        df = res.fetch_df_chunk(1)
        if len(df) == 0:
            return out
        out.append(len(df))


def profile(con, sql: str, prof: Path) -> dict:
    con.execute("pragma enable_profiling='json'")
    con.execute(f"pragma profiling_output='{prof.as_posix()}'")
    con.execute(sql).fetchall()
    con.execute("pragma disable_profiling")
    return json.loads(prof.read_text(encoding="utf-8"))


def operators(node: dict, out: list | None = None) -> list[dict]:
    """The operators of a profile, from the top of the plan to the scan."""
    out = [] if out is None else out
    if node.get("operator_type") and node["operator_type"] != "EXPLAIN_ANALYZE":
        out.append({"name": node["operator_name"], "rows": node["operator_cardinality"], "extra": node.get("extra_info", {})})
    for c in node.get("children", []):
        operators(c, out)
    return out


def main() -> None:
    work = fresh_dir("08")
    prof = work / "p.json"
    con = connect()
    make_shop(con)

    # ---- 1. vectors ----
    scan = chunk_sizes(con, "select * from orders")
    show("sizes of the chunks that a scan of one million rows hands over", f"{collections.Counter(scan).most_common()}")
    check("488 chunks of 2,048 rows and one of 576", collections.Counter(scan) == {2048: 488, 576: 1}, str(collections.Counter(scan)))
    check("together they are the one million rows", sum(scan) == 1_000_000)
    check("2,048 x 488 + 576 = 1,000,000", 2048 * 488 + 576 == 1_000_000)
    filt = chunk_sizes(con, "select order_id from orders where status = 'paid'")
    check("a filter on 70% of the rows gives 489 chunks and not 342: each vector shrinks, it is not refilled", len(filt) == 489 and sum(filt) == 699_821, f"{len(filt)} chunks, {sum(filt)} rows")
    check("no chunk after the filter is larger than 2,048 rows", max(filt) <= 2048)
    check("and most are smaller", sum(1 for x in filt if x < 2048) > 400, str(sum(1 for x in filt if x < 2048)))
    avg = sum(filt) / len(filt)
    print(f"  the filtered chunks hold {avg:.0f} rows on average (the first five: {filt[:5]})")

    # ---- 2. operators of a plan ----
    sql = "select sum(qty * unit_price) as revenue from orders where qty >= 3"
    ops = operators(profile(con, sql, prof))
    show("operators of the plan, top to bottom, with the rows each one produced", table([[o["name"], f"{o['rows']:,}"] for o in ops], ["operator", "rows out"]))
    names = [o["name"] for o in ops]
    check("the plan is a scan, a projection and an aggregate", names == ["UNGROUPED_AGGREGATE", "PROJECTION", "SEQ_SCAN"], str(names))
    check("the filter is inside the scan: qty >= 3 is among its filters", "qty" in json.dumps(ops[-1]["extra"].get("Filters", "")))
    kept = con.sql("select count(*) from orders where qty >= 3").fetchone()[0]
    check("the scan returns only the rows that pass: 600,389 of one million have qty >= 3", ops[-1]["rows"] == ops[1]["rows"] == kept == 600_389, f"{ops[-1]['rows']} vs {kept}")
    check("the aggregate returns one row", ops[0]["rows"] == 1)
    grouped = operators(profile(con, "select status, sum(qty * unit_price) as revenue from orders where qty >= 3 group by status", prof))
    gnames = [o["name"] for o in grouped]
    check("grouping by a string adds two projections that compress the string into a number and decompress it after the aggregate",
          gnames == ["PROJECTION", "HASH_GROUP_BY", "PROJECTION", "PROJECTION", "SEQ_SCAN"], str(gnames))
    check("the hash aggregate returns one row per status: 4", grouped[1]["rows"] == 4)

    # ---- 3. threads and row groups ----
    con.execute("create table big as select i, i::varchar as s from range(1000000) t(i)")
    con.execute("create table mid as select i, i::varchar as s from range(300000) t(i)")
    con.execute("create table small as select i, i::varchar as s from range(100000) t(i)")
    heavy = "select sum(length(sha256(s || s || s))) from {t}"
    results = {}
    for t, rg in (("small", 1), ("mid", 3), ("big", 9)):
        for th in (1, 4, 8):
            con.execute(f"set threads={th}")
            best = min((profile(con, heavy.format(t=t), prof) for _ in range(3)), key=lambda p: p["latency"])
            results[(t, th)] = (best["latency"], best["cpu_time"])
    con.execute("set threads=16")
    show("wall time and cpu time in milliseconds (best of 3)", table([[t, rg, th, f"{results[(t, th)][0] * 1000:.0f}", f"{results[(t, th)][1] * 1000:.0f}", f"{results[(t, th)][1] / results[(t, th)][0]:.1f}"] for t, rg in (("small", 1), ("mid", 3), ("big", 9)) for th in (1, 4, 8)], ["table", "row groups", "threads", "wall", "cpu", "cpu / wall"]))
    check("with one thread the cpu time equals the wall time (a ratio of 1)", all(abs(results[(t, 1)][1] / results[(t, 1)][0] - 1) < 0.1 for t in ("small", "mid", "big")))
    check("a table of one row group uses one thread however many are allowed (cpu / wall stays near 1)", results[("small", 8)][1] / results[("small", 8)][0] < 1.2)
    check("and 8 threads do not make it twice as fast (wall time stays above half of the single-thread time)", results[("small", 8)][0] > 0.5 * results[("small", 1)][0])
    check("a table of nine row groups on 8 threads uses several cores at once (cpu / wall above 2)", results[("big", 8)][1] / results[("big", 8)][0] > 2)
    check("and finishes in under 0.7 of the single-thread time", results[("big", 8)][0] < 0.7 * results[("big", 1)][0], f"{results[('big', 8)][0]:.3f} vs {results[('big', 1)][0]:.3f}")
    check("three row groups use about three threads at most (cpu / wall between 1.3 and 3.3)", 1.3 < results[("mid", 8)][1] / results[("mid", 8)][0] < 3.3, f"{results[('mid', 8)][1] / results[('mid', 8)][0]:.2f}")

    # ---- 4. the answer does not depend on the threads ----
    answers = {}
    for th in (1, 4, 16):
        con.execute(f"set threads={th}")
        answers[th] = con.sql("select count(*), sum(qty), sum(order_id) from orders").fetchone()
    check("an integer aggregate gives the same answer on 1, 4 and 16 threads", len(set(answers.values())) == 1, str(answers))
    first = con.sql("select order_id from orders limit 5").fetchall()
    check("a query without ORDER BY still returns the rows in the order they were inserted (preserve_insertion_order is on)", first == [(1,), (2,), (3,), (4,), (5,)], str(first))
    check("preserve_insertion_order is on by default", con.sql("select current_setting('preserve_insertion_order')").fetchone()[0] is True)
    con.execute("set threads=16")

    if WRITE:
        write_json(LABS / "execution.json", {
            "vector": 2048, "rowGroup": 122_880,
            "scanChunks": {"full": 488, "last": 576, "rows": 1_000_000},
            "filteredChunks": {"count": len(filt), "rows": sum(filt), "first": filt[:12]},
            "plan": {"sql": sql, "operators": [{"name": o["name"], "rows": o["rows"]} for o in ops]},
            "threads": [{"table": t, "rowGroups": rg, "threads": th, "wallMs": round(results[(t, th)][0] * 1000), "cpuMs": round(results[(t, th)][1] * 1000)} for t, rg in (("small", 1), ("mid", 3), ("big", 9)) for th in (1, 4, 8)],
        })


main_guard(main)
