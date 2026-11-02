"""Lesson: checkpoints. Where to check, and what to do with data that fails.

A small bronze to gold step: raw orders in, revenue by country out. Three policies for the same raw data:
  A. no checks, publish whatever arrived
  B. quarantine: reject the rows that break technical rules, keep the rest. This is the "store the bad data
     apart" half of what Building Medallion Architectures calls intrusive processing; the other half is halting
  C. circuit breaker: if any blocking rule fails, publish nothing (DQF chapter 3). This is the halting half

Run: uv run python 05_checkpoints.py
"""

import dqlab
import dqrules

P = dqlab.PLANTED

REVENUE_BY_COUNTRY = """
SELECT c.country, round(sum(o.total_amount), 2) AS revenue, count(*) AS orders
FROM {orders} o JOIN customers c USING (customer_id)
WHERE o.status <> 'CANCELLED'
GROUP BY 1 ORDER BY 1
"""


def total(con, orders="orders") -> float:
    return con.execute(f"SELECT round(sum(revenue), 2) FROM ({REVENUE_BY_COUNTRY.format(orders=orders)})").fetchone()[0]


con = dqlab.connect()

# ---- A. no checks ---------------------------------------------------------------------------------------------------
revenue_a = total(con)
print("A. publish raw orders, inner join to customers")
dqlab.show(con, REVENUE_BY_COUNTRY.format(orders="orders"))
print(f"   total revenue: {revenue_a}")

# ---- B. quarantine --------------------------------------------------------------------------------------------------
con.execute(
    """
    CREATE TABLE orders_checked AS
    SELECT *,
      CASE
        WHEN rn > 1 THEN 'duplicate order_id'
        WHEN customer_id IS NULL THEN 'customer_id is null'
        WHEN NOT EXISTS (SELECT 1 FROM customers c WHERE c.customer_id = t.customer_id) THEN 'unknown customer'
        WHEN total_amount < 0 THEN 'negative total'
      END AS reject_reason
    FROM (SELECT *, row_number() OVER (PARTITION BY order_id ORDER BY ingested_at) AS rn FROM orders) t
    """
)
con.execute("CREATE TABLE orders_valid AS SELECT * EXCLUDE (rn, reject_reason) FROM orders_checked WHERE reject_reason IS NULL")
print("\nB. quarantine: rows kept apart, by reason")
dqlab.show(con, "SELECT reject_reason, count(*) AS rows, round(sum(total_amount), 2) AS amount FROM orders_checked WHERE reject_reason IS NOT NULL GROUP BY 1 ORDER BY 2 DESC")
revenue_b = total(con, "orders_valid")
print(f"   total revenue from valid rows: {revenue_b}")

# The gap between A and B is exactly the extra copies and the negative totals that A let through.
dup_extra = con.execute("SELECT coalesce(sum(total_amount), 0) FROM orders_checked WHERE reject_reason = 'duplicate order_id' AND status <> 'CANCELLED'").fetchone()[0]
negative = con.execute("SELECT coalesce(sum(total_amount), 0) FROM orders_checked WHERE reject_reason = 'negative total' AND status <> 'CANCELLED'").fetchone()[0]
print(f"\nA minus B = {round(revenue_a - revenue_b, 2)}  (extra copies counted twice: +{round(dup_extra, 2)}, negative totals: {round(negative, 2)})")
assert round(revenue_a - revenue_b, 2) == round(dup_extra + negative, 2)

counts = dict(con.execute("SELECT reject_reason, count(*) FROM orders_checked WHERE reject_reason IS NOT NULL GROUP BY 1").fetchall())
print("\nSelf-check against what was planted:")
dqlab.check("quarantined as duplicate", counts["duplicate order_id"], P["orders_duplicate_rows"])
dqlab.check("quarantined as customer_id null", counts["customer_id is null"], P["orders_customer_null"])
dqlab.check("quarantined as unknown customer", counts["unknown customer"], P["orders_customer_orphan"])
dqlab.check("quarantined as negative total", counts["negative total"], P["orders_total_negative"])

# ---- C. circuit breaker ---------------------------------------------------------------------------------------------
def breaker(c) -> tuple[str, list[str]]:
    blockers = [r.rule.id for r in dqrules.gating(dqrules.run(c))]
    return ("open" if blockers else "closed", blockers)


state_raw, blockers_raw = breaker(con)
print(f"\nC. circuit breaker on raw data: {state_raw}; blockers: {blockers_raw}")

# Run the same rules on a connection where orders holds only the valid rows.
con_after = dqlab.connect()
con_after.register("_valid", con.execute("SELECT * FROM orders_valid").df())
con_after.execute("CREATE OR REPLACE TABLE orders AS SELECT * FROM _valid")
state_after, blockers_after = breaker(con_after)
print(f"   after quarantine: {state_after}; blockers left: {blockers_after}")
print("   Quarantine removed the technical blockers. What is left is an accuracy question (do orders match payments?)")
print("   and problems in other tables. Decide which of these deserve to stop the pipeline, because a stopped")
print("   pipeline publishes nothing, not even the data that is fine.")
assert "ORD-ID-UNIQUE" in blockers_raw and "ORD-ID-UNIQUE" not in blockers_after
assert "ORD-TOTAL-MATCHES-PAID" in blockers_after

# ---- granularity of checks (DMBOK2 Table 31) -------------------------------------------------------------------------
print("\nWhat level does each check work at, and can it run in the stream?")
rows = [
    ("element", "email has the shape a@b.c", "yes: look at one value", dqlab.one(con, f"SELECT count(*) FROM customers WHERE email IS NOT NULL AND NOT regexp_matches(email, '{dqrules.EMAIL_OK}')")),
    ("record", "shipped_ts is not before order_ts", "yes: look at one row", dqlab.one(con, "SELECT count(*) FROM orders WHERE shipped_ts < order_ts")),
    ("data set", "order_id is unique", "no: needs the whole set", dqlab.one(con, "SELECT count(*) - count(DISTINCT order_id) FROM orders")),
    ("data set", "newest order is under 24 h old", "no: needs the whole set", dqlab.one(con, f"SELECT CASE WHEN TIMESTAMP '{dqlab.AS_OF:%Y-%m-%d %H:%M:%S}' - max(order_ts) > INTERVAL 24 HOUR THEN 1 ELSE 0 END FROM orders")),
]
print(f"{'level':9s} {'check':36s} {'in-stream?':26s} {'found':>5s}")
for level, check, stream, found in rows:
    print(f"{level:9s} {check:36s} {stream:26s} {found:5d}")
