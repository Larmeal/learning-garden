"""Lesson: incident. Detect, find the root cause in five steps, fix, backfill, and write the postmortem.

The incident is INJECTED into a clean copy of the orders so that the cause is known and the five-step root cause
analysis from DQF chapter 6 can be followed with real queries:
  1. lineage   2. code   3. data   4. operational environment   5. peers

Story: on 12 and 13 September the ingest job is retried and loads the day twice. At the same time a change to the
staging query drops a DISTINCT. Neither alone would reach the dashboard; together they double those two days.

Run: uv run python 09_incident.py
"""

import difflib

import dqlab

con = dqlab.connect()
D1, D2 = "2026-09-12", "2026-09-13"

# A clean copy of the orders, one row per order, so that only the injected incident is in play.
con.execute(
    """CREATE TABLE clean_orders AS
       SELECT DISTINCT order_id, customer_id, CAST(order_ts AS DATE) AS order_date, status, total_amount
       FROM orders WHERE customer_id IN (SELECT customer_id FROM customers) AND total_amount >= 0 AND status <> 'CANCELLED'"""
)
# Bronze: the clean rows, plus a second load of the two retried days.
con.execute("CREATE TABLE raw_orders AS SELECT *, 'B' || strftime(order_date, '%Y%m%d') AS batch_id, 1 AS attempt FROM clean_orders")
con.execute(f"INSERT INTO raw_orders SELECT *, 'B' || strftime(order_date, '%Y%m%d'), 2 FROM clean_orders WHERE order_date IN (DATE '{D1}', DATE '{D2}')")
con.execute(
    """CREATE TABLE load_log AS
       SELECT batch_id, max(attempt) AS attempts, count(*) AS rows_loaded, CASE WHEN max(attempt) > 1 THEN 'RETRIED' ELSE 'OK' END AS status
       FROM raw_orders GROUP BY 1"""
)

STG_V1 = "SELECT DISTINCT order_id, customer_id, order_date, total_amount FROM raw_orders"
STG_V2 = "SELECT order_id, customer_id, order_date, total_amount FROM raw_orders"
GOLD = "SELECT order_date, round(sum(total_amount), 2) AS revenue, count(*) AS orders FROM ({stg}) GROUP BY 1 ORDER BY 1"

LINEAGE = {  # node -> what it feeds
    "raw_orders": ["stg_orders"], "stg_orders": ["daily_revenue"], "daily_revenue": ["finance_dashboard", "forecast_model"],
    "finance_dashboard": [], "forecast_model": [],
}
OWNERS = {"raw_orders": "ingest team", "stg_orders": "analytics engineering", "daily_revenue": "analytics engineering", "finance_dashboard": "finance"}

# ---- detect ---------------------------------------------------------------------------------------------------------
gold_bad = con.execute(GOLD.format(stg=STG_V2)).df().set_index("order_date")
gold_ok = con.execute(GOLD.format(stg=STG_V1)).df().set_index("order_date")
ratio = (gold_bad["revenue"] / gold_ok["revenue"]).round(2)
flagged = ratio[ratio > 1.5]
print("== detect: daily revenue compared with what it should be ==")
flagged_days = [str(d)[:10] for d in flagged.index]
print(f"days where revenue is more than 1.5x the expected value: {flagged_days}  ratio {flagged.tolist()}")
assert flagged_days == [D1, D2] and all(flagged == 2.0)

# ---- RCA 1: lineage -------------------------------------------------------------------------------------------------
print("\n== RCA 1: lineage. Find the most upstream node that shows the problem ==")
def dup_extra(sql: str) -> int:
    return con.execute(f"SELECT count(*) - count(DISTINCT order_id) FROM ({sql}) WHERE order_date IN (DATE '{D1}', DATE '{D2}')").fetchone()[0]

for node, sql in [("raw_orders", "SELECT * FROM raw_orders"), ("stg_orders (v2)", STG_V2), ("stg_orders (v1)", STG_V1)]:
    print(f"  {node:16s} duplicate order_ids on the two days: {dup_extra(sql)}")
assert dup_extra("SELECT * FROM raw_orders") > 0 and dup_extra(STG_V1) == 0

# ---- RCA 2: code ----------------------------------------------------------------------------------------------------
print("\n== RCA 2: code. What changed in the query that builds stg_orders? ==")
for line in difflib.unified_diff([STG_V1], [STG_V2], "stg_orders v1", "stg_orders v2 (deployed 12 Sep 17:00)", lineterm="", n=0):
    print("  " + line)

# ---- RCA 3: data ----------------------------------------------------------------------------------------------------
print("\n== RCA 3: data. Is it all rows, a period, or a segment? ==")
print("  by day (days with duplicates only):")
dqlab.show(con, "SELECT order_date, count(*) - count(DISTINCT order_id) AS duplicated FROM raw_orders GROUP BY 1 HAVING count(*) > count(DISTINCT order_id) ORDER BY 1")
print("  by country (share of duplicated rows, against share of all rows):")
dqlab.show(
    con,
    """SELECT c.country,
              round(100.0 * count(*) FILTER (WHERE r.attempt = 2) / (SELECT count(*) FROM raw_orders WHERE attempt = 2), 1) AS pct_of_duplicates,
              round(100.0 * count(*) / (SELECT count(*) FROM raw_orders), 1) AS pct_of_all
       FROM raw_orders r JOIN customers c USING (customer_id) GROUP BY 1 ORDER BY 1""",
)
whole_days = con.execute(
    "SELECT count(*) FROM (SELECT order_date, count(*) AS n, count(DISTINCT order_id) AS u FROM raw_orders GROUP BY 1 HAVING n = 2 * u)"
).fetchone()[0]
print(f"  The duplicates follow the calendar: on {whole_days} days every order appears twice, and no other day has a duplicate.")
print("  By country there are only 30 duplicated rows, too few to show a pattern, so a segment explanation has no support.")
assert whole_days == 2

# ---- RCA 4: operational environment ---------------------------------------------------------------------------------
print("\n== RCA 4: operational environment. What do the job logs say? ==")
dqlab.show(con, "SELECT * FROM load_log WHERE status <> 'OK' ORDER BY batch_id")
retried = [r[0] for r in con.execute("SELECT batch_id FROM load_log WHERE status = 'RETRIED' ORDER BY 1").fetchall()]
assert retried == ["B20260912", "B20260913"]

# ---- RCA 5: peers ---------------------------------------------------------------------------------------------------
print("\n== RCA 5: peers. Who owns it, who uses it? ==")
def downstream(node: str, seen=None) -> list[str]:
    seen = seen if seen is not None else []
    for nxt in LINEAGE[node]:
        if nxt not in seen:
            seen.append(nxt)
            downstream(nxt, seen)
    return seen

blast = downstream("raw_orders")
print(f"  owner of the broken source: {OWNERS['raw_orders']}; owner of the changed query: {OWNERS['stg_orders']}")
print(f"  blast radius from raw_orders: {blast}")
assert blast == ["stg_orders", "daily_revenue", "finance_dashboard", "forecast_model"]

overstated = round(float((gold_bad["revenue"] - gold_ok["revenue"]).sum()), 2)
print(f"\nrevenue overstated on the two days: {overstated}")

# ---- the five whys, written as data ---------------------------------------------------------------------------------
whys = [
    ("Why did revenue double on 12 and 13 Sep?", "Each order was counted twice in daily_revenue."),
    ("Why were orders counted twice?", "stg_orders passed duplicate rows through."),
    ("Could it have been prevented? Why did stg_orders let them through?", "Change v2 removed the DISTINCT that hid the duplicates."),
    ("Why were there duplicates in raw_orders?", "The ingest job retried both batches and loaded each twice."),
    ("Why was a double load possible, and why was it not caught?", "The load is not idempotent, and no uniqueness test ran on stg_orders."),
]
print("\n== five whys ==")
for i, (q, a) in enumerate(whys, 1):
    print(f"  {i}. {q}\n     {a}")

# ---- resolution and backfill ----------------------------------------------------------------------------------------
print("\n== resolution ==")
print("  initial: pause the finance_dashboard refresh (open the circuit) so nobody reads the doubled numbers")
print("  final: restore DISTINCT, make the load idempotent on batch_id, add a uniqueness test on stg_orders")
fixed = con.execute(GOLD.format(stg=STG_V1)).df().set_index("order_date")  # backfill: rebuild with the fixed query
assert (fixed["revenue"] == gold_ok["revenue"]).all()
print(f"  backfill: daily_revenue rebuilt for {len(fixed)} days; the two affected days now match the expected values")

# ---- postmortem record ----------------------------------------------------------------------------------------------
TTD, TTR, HOURLY = 30, 6, 300  # made-up timeline of this story, in hours and in currency per hour
postmortem = {
    "summary": "Revenue on 12 and 13 Sep was shown at 2x for finance and the forecast",
    "impact": f"overstated by {overstated}; consumers: finance_dashboard, forecast_model",
    "time_to_detect_h": TTD, "time_to_resolve_h": TTR, "cost": (TTD + TTR) * HOURLY,
    "causes": ["retried ingest loaded two days twice", "DISTINCT removed from stg_orders", "no uniqueness test on stg_orders"],
    "actions": ["idempotent load keyed on batch_id (ingest team)", "restore DISTINCT and add test (analytics engineering)", "volume vs same-weekday baseline monitor (analytics engineering)"],
    "blameless": True,
}
print("\n== postmortem (blameless: the system allowed it) ==")
for k, v in postmortem.items():
    print(f"  {k}: {v}")
assert postmortem["cost"] == 10800
