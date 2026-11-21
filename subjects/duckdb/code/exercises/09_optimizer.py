"""Lesson 9: the optimizer. The query you write is not the query that runs: filters move into the scan, unused columns are never read, constants are folded, and the small side of a join is built.

Asserts, with the optimizer on and off, that the answers are the same, that a filter written after a join is pushed down into the scan of its table (642 customers instead of 5,000, and a join that
produces 128,403 rows instead of one million), that the scan of `select sum(qty)` reads one column, that `2 + 1` is folded to 3 and `1 + 1 = 2` disappears, that the smaller table is the one a hash join builds,
and that the number of rows the optimizer expects is close for one column and far off for a string column (250,000 expected, 30,104 real). `--write` saves the plans for PlanLab (`optimizer.json`).
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ddb import LABS, check, connect, fresh_dir, main_guard, make_shop, show, table, write_json  # noqa: E402

WRITE = "--write" in sys.argv


class Lab:
    def __init__(self, work: Path):
        self.con = connect()
        make_shop(self.con)
        self.prof = work / "p.json"

    def profile(self, sql: str) -> dict:
        self.con.execute("pragma enable_profiling='json'")
        self.con.execute(f"pragma profiling_output='{self.prof.as_posix()}'")
        rows = self.con.execute(sql).fetchall()
        self.con.execute("pragma disable_profiling")
        p = json.loads(self.prof.read_text(encoding="utf-8"))
        p["answer"] = rows
        return p


def ops(node: dict, depth: int = 0, out: list | None = None) -> list[dict]:
    out = [] if out is None else out
    if node.get("operator_type") and node["operator_type"] != "EXPLAIN_ANALYZE":
        e = node.get("extra_info", {})
        out.append({"depth": depth, "name": node["operator_name"], "rows": node["operator_cardinality"], "scanned": node.get("operator_rows_scanned", 0),
                    "table": e.get("Table", "").split(".")[-1], "filters": e.get("Filters"), "projections": e.get("Projections"), "estimate": int(e["Estimated Cardinality"]) if "Estimated Cardinality" in e else None})
        depth += 1
    for c in node.get("children", []):
        ops(c, depth, out)
    return out


def main() -> None:
    lab = Lab(fresh_dir("09"))
    con = lab.con

    # ---- 1. a filter written after the join ----
    q = "select count(*), sum(o.qty * o.unit_price) from orders o join customers c using (customer_id) where c.country = 'TH'"
    on = lab.profile(q)
    con.execute("pragma disable_optimizer")
    off = lab.profile(q)
    con.execute("pragma enable_optimizer")
    o_on, o_off = ops(on), ops(off)
    show("optimizer on", table([["  " * o["depth"] + o["name"], o["table"], f"{o['rows']:,}", o["filters"] or ""] for o in o_on], ["operator", "table", "rows out", "filter"]))
    show("optimizer off", table([["  " * o["depth"] + o["name"], o["table"], f"{o['rows']:,}", o["filters"] or ""] for o in o_off], ["operator", "table", "rows out", "filter"]))
    check("the answer is the same with the optimizer on and off", on["answer"][0][0] == off["answer"][0][0] == 128_403 and abs(on["answer"][0][1] - off["answer"][0][1]) < 1e-3, f"{on['answer']} {off['answer']}")
    names_on = [o["name"] for o in o_on]
    names_off = [o["name"] for o in o_off]
    check("on: no FILTER operator, the condition on country is inside the scan of customers", "FILTER" not in names_on and any(o["table"] == "customers" and o["filters"] == "country='TH'" for o in o_on))
    check("off: the condition runs in a FILTER after the join", names_off == ["UNGROUPED_AGGREGATE", "PROJECTION", "FILTER", "HASH_JOIN", "SEQ_SCAN", "SEQ_SCAN"], str(names_off))
    join_on = next(o for o in o_on if o["name"] == "HASH_JOIN")
    join_off = next(o for o in o_off if o["name"] == "HASH_JOIN")
    check("the join produces 128,403 rows with the filter pushed down and 1,000,000 without it", (join_on["rows"], join_off["rows"]) == (128_403, 1_000_000), f"{join_on['rows']} {join_off['rows']}")
    cust_on = next(o for o in o_on if o["table"] == "customers")
    cust_off = next(o for o in o_off if o["table"] == "customers")
    check("the scan of customers returns 642 rows instead of 5,000", (cust_on["rows"], cust_off["rows"]) == (642, 5000))
    kids_on = [o for o in o_on if o["depth"] == join_on["depth"] + 1]
    check("the hash join is built from the small side: the first child is orders (probe) and the second customers (build)", [k["table"] for k in kids_on] == ["orders", "customers"], str([k["table"] for k in kids_on]))

    # ---- 2. only the columns that are used, and constants folded ----
    p = ops(lab.profile("select sum(qty) from orders"))[-1]
    check("select sum(qty) reads one column: Projections is qty", p["projections"] == "qty", str(p["projections"]))
    p_all = ops(lab.profile("select * from orders"))[-1]
    check("select * reads all seven", len(p_all["projections"]) == 7)
    plan_on = con.sql("explain select sum(qty) from orders").fetchone()[1]
    con.execute("set disabled_optimizers='unused_columns'")
    plan_off = con.sql("explain select sum(qty) from orders").fetchone()[1]
    con.execute("set disabled_optimizers=''")
    check("the plan text of the scan lists `Projections: qty` with the optimizer and no list at all without unused_columns", "Projections" in plan_on and "Projections" not in plan_off)
    fold = ops(lab.profile("select count(*) from orders where status = 'paid' and qty = 2 + 1 and 1 + 1 = 2"))[-1]
    check("2 + 1 is folded to 3 and `1 + 1 = 2` is gone: only two conditions are left", len(fold["filters"]) == 2 and "= 3" in fold["filters"][1] and "1" not in fold["filters"][0].replace("paid", ""), str(fold["filters"]))
    check("the scan returns the 139,611 rows that pass both", fold["rows"] == 139_611)

    # ---- 3. what the optimizer expects and what it gets ----
    est = []
    for cond in ("customer_id = 5", "qty = 3 and status = 'paid'", "status = 'refunded'", "unit_price > 90"):
        scan = next(o for o in ops(lab.profile(f"select count(*) from orders where {cond}")) if o["name"] == "SEQ_SCAN")
        est.append({"filter": cond, "expected": scan["estimate"], "real": scan["rows"]})
    show("rows expected by the optimizer against rows returned", table([[e["filter"], f"{e['expected']:,}", f"{e['real']:,}"] for e in est], ["filter", "expected", "real"]))
    e = {x["filter"]: x for x in est}
    check("for customer_id = 5 the guess is close: 178 against 189", (e["customer_id = 5"]["expected"], e["customer_id = 5"]["real"]) == (178, 189))
    check("for a string column it is far off: 250,000 expected, 30,104 real", (e["status = 'refunded'"]["expected"], e["status = 'refunded'"]["real"]) == (250_000, 30_104))
    check("and for a range on a double: 200,000 expected, 53,525 real", (e["unit_price > 90"]["expected"], e["unit_price > 90"]["real"]) == (200_000, 53_525))

    # ---- 4. switch one optimizer off at a time ----
    for name in ("filter_pushdown", "join_order", "statistics_propagation", "unused_columns", "expression_rewriter", "build_side_probe_side"):
        con.execute(f"set disabled_optimizers='{name}'")
        same = con.sql(q).fetchone()[0] == 128_403
        check(f"with {name} off the answer is still 128,403", same)
    con.execute("set disabled_optimizers=''")
    con.execute("set disabled_optimizers='filter_pushdown'")
    one_off = [o["name"] for o in ops(lab.profile(q))]
    con.execute("set disabled_optimizers=''")
    check("switching off only filter_pushdown brings the FILTER operator back", "FILTER" in one_off, str(one_off))

    if WRITE:
        def shape(lst):
            return [{"depth": o["depth"], "name": o["name"], "table": o["table"], "rows": o["rows"], "filter": o["filters"]} for o in lst]

        write_json(LABS / "optimizer.json", {"sql": q, "on": shape(o_on), "off": shape(o_off), "estimates": est})


main_guard(main)
