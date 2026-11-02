"""Lesson: agreements. A contract written as data, checked by code, compared across versions.

Checks the orders table against contracts/orders.v1.yaml (schema, quality rules, freshness), classifies the
differences between v1 and v2 as breaking or not, and contrasts two ways to enforce a contract: test after loading,
and reject before loading.

Run: uv run python 06_contract.py
"""

import dqcontract
import dqlab

con = dqlab.connect()
v1 = dqcontract.load("orders.v1.yaml")
v2 = dqcontract.load("orders.v2.yaml")

print(f"contract {v1['dataset']} v{v1['version']}: owner={v1['owner']}, consumers={v1['consumers']}")
print(f"on breach: tell {v1['on_breach']['notify']}, respond within {v1['on_breach']['respond_within_hours']} h, "
      f"resolve within {v1['on_breach']['resolve_within_business_days']} business day")

print("\n== does the data conform to v1? ==")
schema_problems = dqcontract.check_schema(con, v1)
for p in schema_problems:
    print("  schema:", p)
for r in dqcontract.check_quality(con, v1):
    print(f"  rule {r.rule.id:24s} {r.bad_pct:5.2f}% bad, allowed {r.rule.max_bad_pct}% -> {'ok' if r.passed else 'BREACH'}")
age = dqcontract.freshness_hours(con, v1, dqlab.AS_OF)
limit = v1["freshness"]["max_age_hours"]
print(f"  freshness: newest {v1['freshness']['column']} is {age:.1f} h old, limit {limit} h -> {'ok' if age <= limit else 'BREACH'}")

# What we expect to find, from the planted defects.
assert "column customer_id must not be null but has 15 nulls" in schema_problems
assert "column order_id must be unique but has 20 extra rows" in schema_problems
assert len(schema_problems) == 2, schema_problems
assert age > limit

print("\n== v1 -> v2: what would a consumer feel? ==")
changes = dqcontract.diff(v1, v2)
for change, kind in changes:
    print(f"  {kind:8s} {change}")
got = {change: kind for change, kind in changes}
assert got["total_amount renamed to amount_total"] == "breaking"
assert got["customer_id type BIGINT -> VARCHAR"] == "breaking"
assert got["order_ts may now be null"] == "breaking"
assert got["status gains values ['RETURNED']"] == "review"
assert got["column channel added (optional)"] == "safe"
assert got["column currency added (required)"] == "safe"
print(f"  summary: {sum(k == 'breaking' for _, k in changes)} breaking, {sum(k == 'review' for _, k in changes)} to review, "
      f"{sum(k == 'safe' for _, k in changes)} safe")

print("\n== two ways to enforce ==")
# A producer renames total_amount and sends a batch. The batch columns as they arrive:
incoming = {c["name"]: c["type"] for c in v2["schema"]}

# 1. Test after load: the batch is already in the table when the test runs.
con.execute("CREATE TABLE orders_landing AS SELECT * FROM orders WHERE false")
con.execute("ALTER TABLE orders_landing RENAME COLUMN total_amount TO amount_total")
landed = dqcontract.check_schema(con, v1, table="orders_landing")
print("  test after load: the table now holds the new shape; the test says:")
for p in landed:
    print("   -", p)
assert any("total_amount is missing" in p for p in landed) or any("column total_amount is missing" in p for p in landed)

# 2. Reject before load: the batch never enters the table.
try:
    dqcontract.enforce_on_ingest(incoming, v1)
    raise AssertionError("the batch should have been rejected")
except dqcontract.ContractError as e:
    print("  reject before load: batch refused, table untouched. Reason:")
    print("   -", e)
