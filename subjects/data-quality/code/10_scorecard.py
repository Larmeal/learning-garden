"""Lesson: scorecard. Ownership, a scorecard that does not fool you, data downtime as an SLO, and certification.

Four small pieces:
  1. A scorecard over the 14 rules, read three ways. One average looks fine while every blocking rule fails.
  2. A trend: five remediation steps applied one after another, scored after each (DMBOK2 2.7.5: trends over time).
  3. Data downtime = incidents x (time to detect + time to resolve), checked against an SLO (DQF chapter 5 and 8).
  4. A certification check for a dataset (DQF chapter 8, seven steps, reduced to what code can check).

The thresholds, the incident log and the SLO target are made up for this course.

Run: uv run python 10_scorecard.py
"""

import dqlab
import dqrules

con = dqlab.connect()

# ---- 1. one scorecard, three readings -------------------------------------------------------------------------------
results = dqrules.run(con)
mean_valid = sum(100 - r.bad_pct for r in results) / len(results)
within = sum(r.passed for r in results)
blocking = dqrules.gating(results)
print("== 1. the same results, three readings ==")
print(f"  average valid% over {len(results)} rules : {mean_valid:.2f}%   <- looks healthy")
print(f"  rules within their own threshold : {within} of {len(results)}")
print(f"  blocking rules failing           : {len(blocking)}  {[r.rule.id for r in blocking]}")
assert mean_valid > 98 and within == 0 and len(blocking) == 6

print("\n  by dimension (worst rule per dimension):")
by_dim: dict[str, dqrules.Result] = {}
for r in results:
    cur = by_dim.get(r.rule.dimension)
    if cur is None or r.bad_pct > cur.bad_pct:
        by_dim[r.rule.dimension] = r
for dim, r in sorted(by_dim.items()):
    print(f"    {dim:12s} worst {r.bad_pct:5.2f}% bad ({r.rule.id}), owner {r.rule.owner}")

print("\n  who is paged for what (failing rules by owner):")
owners: dict[str, list[str]] = {}
for r in results:
    if not r.passed:
        owners.setdefault(r.rule.owner, []).append(r.rule.id)
for o, ids in sorted(owners.items()):
    print(f"    {o:16s} {len(ids)} rules")

# ---- 2. a trend over five remediation steps -------------------------------------------------------------------------
FIXES = [
    ("baseline", None),
    ("remove duplicate orders", "CREATE OR REPLACE TABLE orders AS SELECT DISTINCT * FROM orders"),
    ("standardise country to TH", "UPDATE customers SET country = 'TH' WHERE country IN ('Thailand','th','THA','ไทย','T.H.')"),
    ("drop orders without a real customer", "DELETE FROM orders WHERE customer_id IS NULL OR customer_id NOT IN (SELECT customer_id FROM customers)"),
    ("drop payments without an order", "DELETE FROM payments WHERE order_id NOT IN (SELECT order_id FROM orders)"),
    ("take the payment amount as the total", "UPDATE orders SET total_amount = p.paid FROM (SELECT order_id, sum(amount) AS paid FROM payments GROUP BY 1) p WHERE orders.order_id = p.order_id AND abs(orders.total_amount - p.paid) > 0.005"),
]
print("\n== 2. trend: score after each step ==")
print(f"  {'step':40s} {'within':>7s} {'blocking':>9s} {'avg valid%':>11s}")
history = []
pay_orphans: list[int] = []  # PAY-ORDER-EXISTS failures after each step
for label, sql in FIXES:
    if sql:
        con.execute(sql)
    res = dqrules.run(con)
    history.append((label, sum(r.passed for r in res), len(dqrules.gating(res)), sum(100 - r.bad_pct for r in res) / len(res)))
    print(f"  {label:40s} {history[-1][1]:5d}/14 {history[-1][2]:9d} {history[-1][3]:11.2f}")
    pay_orphans.append(next(r.bad for r in res if r.rule.id == "PAY-ORDER-EXISTS"))
assert history[0][2] == 6 and history[-1][2] == 0
print(f"  payments without an order after each step: {pay_orphans}")
# Dropping orders orphans the payments that belonged to them, so a fix in one table breaks a rule on another.
assert pay_orphans[:4] == [20, 20, 20, 58] and pay_orphans[-1] == 0, pay_orphans
assert history[3][3] < history[2][3], "the average dips at the step that drops orders, although blockers fall"
assert [h[2] for h in history] == sorted((h[2] for h in history), reverse=True), "blocking failures should only go down"
still = [r.rule.id for r in dqrules.run(con) if not r.passed]
print(f"  still failing after all steps: {still}")
print("  Each step above rewrote data in this copy. In a real system these are fixes at the source or quarantine,")
print("  not silent edits, and the accuracy step needs the finance owner to agree that payments are the record.")

# ---- 3. data downtime and an SLO -------------------------------------------------------------------------------------
incidents = [  # (id, hours to detect, hours to resolve), invented
    ("INC-101 duplicate load", 30, 6), ("INC-102 country spellings", 72, 8), ("INC-103 late partner file", 4, 3), ("INC-104 schema rename", 1, 2),
]
downtime = sum(ttd + ttr for _, ttd, ttr in incidents)
slo_hours = 80
share_detect = sum(ttd for _, ttd, _ in incidents) / downtime
print("\n== 3. data downtime = sum of (time to detect + time to resolve) ==")
for name, ttd, ttr in incidents:
    print(f"  {name:28s} detect {ttd:3d} h + resolve {ttr:3d} h = {ttd + ttr:3d} h")
print(f"  total {downtime} h in the quarter, SLO {slo_hours} h -> {'met' if downtime <= slo_hours else 'MISSED'}")
print(f"  {100 * share_detect:.0f}% of the downtime is time spent not knowing")
halved = sum(ttd / 2 + ttr for _, ttd, ttr in incidents)
print(f"  if detection were twice as fast: {halved:.0f} h -> {'met' if halved <= slo_hours else 'MISSED'}")
assert downtime == 126 and halved < downtime

# ---- 4. certification ------------------------------------------------------------------------------------------------
CHECKLIST = [  # (step in DQF ch.8, field a dataset record must carry)
    ("observability in place", "monitors"), ("a named owner", "owner"), ("a definition of good data", "rules"),
    ("an SLA with a response time", "sla"), ("an incident and communication process", "channel"), ("tagged as certified", "tag"),
]


def certify(asset: dict) -> list[str]:
    return [step for step, field in CHECKLIST if not asset.get(field)]


assets = {
    "orders": {"monitors": ["volume", "freshness"], "owner": "orders-platform", "rules": ["ORD-ID-UNIQUE"], "sla": {"respond_h": 2}, "channel": "#orders-data", "tag": None},
    "customers": {"monitors": [], "owner": "crm-team", "rules": [], "sla": None, "channel": None, "tag": None},
}
print("\n== 4. what stands between a dataset and certification ==")
for name, asset in assets.items():
    missing = certify(asset)
    print(f"  {name:10s} {'ready to certify' if not missing else 'missing: ' + '; '.join(missing)}")
assets["orders"]["tag"] = "certified"
assert certify(assets["orders"]) == [] and len(certify(assets["customers"])) == 5
