"""Lesson: capstone. One small pipeline that uses every piece from lessons 1 to 10.

For each day's batch of orders it runs, in order:
  1. contract check on arrival   reject the batch if columns or types differ (lesson 6)
  2. freshness                   an empty batch means the source went quiet (lesson 7)
  3. row checks and quarantine   bad rows are set aside with a reason (lessons 4 and 5)
  4. circuit breaker             too many bad rows, or too few rows against the weekday baseline, hold the batch
  5. publish or hold, and open a ticket addressed to the owner named in the contract (lessons 9 and 10)

Six scenarios run through it. The thresholds (10% bad rows, 50% of the baseline) are examples written for this course.

Run: uv run python 11_capstone.py
"""

import statistics
from collections import Counter

import pandas as pd

import dqcontract
import dqlab

con = dqlab.connect()
contract = dqcontract.load("orders.v1.yaml")
MAX_BAD_SHARE = 0.10
MIN_VOLUME_RATIO = 0.50
SQL_TYPES = {"int64": "BIGINT", "Int64": "BIGINT", "float64": "DOUBLE", "object": "VARCHAR", "str": "VARCHAR", "string": "VARCHAR"}

# History of good orders: one row per order, with a real customer and a non-negative total.
con.execute(
    """CREATE TABLE history AS
       SELECT DISTINCT order_id, customer_id, order_ts, ingested_at, status, total_amount, shipped_ts
       FROM orders WHERE customer_id IN (SELECT customer_id FROM customers) AND total_amount >= 0"""
)
history = con.execute("SELECT * FROM history").df()
history["day"] = history["order_ts"].dt.date
daily = history.groupby("day").size()
gold: dict[str, dict] = {}  # what has been published, keyed by day so a re-run replaces and never adds (lesson 9)
tickets: list[dict] = []


def baseline(day) -> float:
    """Median rows on the same weekday over the previous four weeks."""
    prev = [daily.get(day - pd.Timedelta(days=7 * k), 0) for k in range(1, 5)]
    return statistics.median([p for p in prev if p > 0])


def sql_type(dtype) -> str:
    name = str(dtype)
    return "TIMESTAMP" if name.startswith("datetime64") else SQL_TYPES[name]


def run_pipeline(day, batch: pd.DataFrame) -> dict:
    out = {"day": str(day), "rows": len(batch), "decision": "", "why": "", "quarantined": Counter()}

    def hold(why: str, severity: str) -> dict:
        out.update(decision="HELD", why=why)
        tickets.append({"day": str(day), "severity": severity, "to": contract["owner"], "notify": contract["on_breach"]["notify"],
                        "respond_within_h": contract["on_breach"]["respond_within_hours"], "why": why})
        return out

    # 1. contract on arrival
    try:
        dqcontract.enforce_on_ingest({c: sql_type(t) for c, t in batch.dtypes.items()}, contract)
    except dqcontract.ContractError as e:
        return hold(f"contract: {e}", "high")
    # 2. freshness
    if len(batch) == 0:
        return hold("no rows arrived (source silent)", "high")
    # 3. row checks
    con.register("batch", batch)
    checked = con.execute(
        """SELECT *, CASE
             WHEN rn > 1 THEN 'duplicate order_id'
             WHEN customer_id IS NULL THEN 'customer_id is null'
             WHEN NOT EXISTS (SELECT 1 FROM customers c WHERE c.customer_id = t.customer_id) THEN 'unknown customer'
             WHEN total_amount < 0 THEN 'negative total'
           END AS reject_reason
           FROM (SELECT *, row_number() OVER (PARTITION BY order_id ORDER BY ingested_at) AS rn FROM batch) t"""
    ).df()
    bad = checked[checked["reject_reason"].notna()]
    good = checked[checked["reject_reason"].isna()]
    out["quarantined"] = Counter(bad["reject_reason"])
    # 4. circuit breaker
    share = len(bad) / len(batch)
    if share > MAX_BAD_SHARE:
        return hold(f"{100 * share:.0f}% of rows broke a row check (limit {100 * MAX_BAD_SHARE:.0f}%)", "high")
    ratio = len(good) / baseline(day)
    if ratio < MIN_VOLUME_RATIO:
        return hold(f"volume is {100 * ratio:.0f}% of the same-weekday baseline (limit {100 * MIN_VOLUME_RATIO:.0f}%)", "medium")
    # 5. publish
    gold[str(day)] = {"orders": len(good), "revenue": round(float(good["total_amount"].sum()), 2)}
    out.update(decision="PUBLISHED" if bad.empty else "PUBLISHED, bad rows quarantined", why=f"volume {100 * ratio:.0f}% of baseline")
    return out


# ---- the six scenarios ----------------------------------------------------------------------------------------------
DAY = pd.Timestamp("2026-10-20").date()
day_rows = history[history["day"] == DAY].drop(columns="day").reset_index(drop=True)
print(f"batch for {DAY}: {len(day_rows)} rows; same-weekday baseline {baseline(DAY):.0f}\n")


def scenario(name: str, batch: pd.DataFrame) -> dict:
    result = run_pipeline(DAY, batch)
    result["name"] = name
    return result


tolerable = pd.concat([day_rows, day_rows.iloc[[0]]], ignore_index=True)  # one repeated row
messy = day_rows.copy()
messy.loc[:2, "total_amount"] = -5.0
messy.loc[3:4, "customer_id"] = 99999
messy = pd.concat([messy, day_rows.iloc[:4]], ignore_index=True)  # four repeated rows

runs = [
    scenario("1 clean day", day_rows),
    scenario("2 one repeated row", tolerable),
    scenario("3 many broken rows", messy),
    scenario("4 column renamed", day_rows.rename(columns={"total_amount": "amount_total"})),
    scenario("5 nothing arrived", day_rows.iloc[0:0]),
    scenario("6 partial load (30%)", day_rows.iloc[: max(1, int(len(day_rows) * 0.3))]),
]

print(f"{'scenario':24s} {'decision':34s} reason")
for r in runs:
    print(f"{r['name']:24s} {r['decision']:34s} {r['why']}" + (f"  quarantined={dict(r['quarantined'])}" if r["quarantined"] else ""))

print("\ntickets opened:")
for t in tickets:
    print(f"  [{t['severity']:6s}] to {t['to']} via {t['notify']}, respond within {t['respond_within_h']} h: {t['why']}")
print(f"\npublished to gold: {gold}")

decisions = [r["decision"] for r in runs]
assert decisions == ["PUBLISHED", "PUBLISHED, bad rows quarantined", "HELD", "HELD", "HELD", "HELD"], decisions
assert runs[1]["quarantined"] == Counter({"duplicate order_id": 1})
assert len(tickets) == 4 and len(gold) == 1
assert "total_amount is missing" in runs[3]["why"] or "missing column total_amount" in runs[3]["why"]
print("\nself-check passed: 2 batches published, 4 held, 4 tickets, one quarantined row")
