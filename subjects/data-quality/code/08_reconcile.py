"""Lesson: reconciliation. Prove a derived table agrees with its source, and test the SQL that builds it.

Part 1 reconciles a revenue mart with the payment system by row count and by sum, with the differences explained.
A mart built with a plain JOIN double counts the 20 duplicated orders, and the reconciliation shows it.
Part 2 tests the transformation on a tiny golden dataset, so the same bug is caught before it runs on real data.

DDIA ("Trust, but Verify", "The end-to-end argument") says low-level guarantees do not prove the whole pipeline is
right, and that integrity should be checked end to end. A count and a sum compared across the pipeline is the
cheapest end-to-end check there is.

Run: uv run python 08_reconcile.py
"""

import duckdb

import dqlab

con = dqlab.connect()
P = dqlab.PLANTED


def recon(label: str, a: tuple, b: tuple, a_name: str, b_name: str) -> bool:
    """Compare (count, sum) of two sides and print the differences."""
    d_count, d_sum = b[0] - a[0], round(b[1] - a[1], 2)
    ok = d_count == 0 and d_sum == 0
    print(f"  {label}: {a_name} rows={a[0]} sum={a[1]:.2f} | {b_name} rows={b[0]} sum={b[1]:.2f} | diff rows={d_count:+d} sum={d_sum:+.2f} -> {'MATCH' if ok else 'DIFFERENT'}")
    return ok


# ---- Part 1: reconcile a mart with its source -----------------------------------------------------------------------
SOURCE = """
SELECT count(*), round(sum(amount), 2) FROM payments p
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.order_id = p.order_id AND o.status <> 'CANCELLED')
"""
source = con.execute(SOURCE).fetchone()

con.execute(
    """CREATE TABLE mart_plain_join AS
       SELECT o.order_id, o.total_amount, p.amount AS paid FROM orders o JOIN payments p USING (order_id) WHERE o.status <> 'CANCELLED'"""
)
con.execute(
    """CREATE TABLE mart_deduped AS
       SELECT o.order_id, o.total_amount, p.amount AS paid
       FROM (SELECT DISTINCT * FROM orders) o JOIN payments p USING (order_id) WHERE o.status <> 'CANCELLED'"""
)

print("== reconcile the mart with the payment system (count and sum) ==")
for name in ("mart_plain_join", "mart_deduped"):
    mart = con.execute(f"SELECT count(*), round(sum(paid), 2) FROM {name}").fetchone()
    ok = recon(name, source, mart, "payments", name)
    if name == "mart_plain_join":
        assert not ok
        extra_rows = con.execute("SELECT count(*) - count(DISTINCT order_id) FROM orders WHERE status <> 'CANCELLED'").fetchone()[0]
        assert mart[0] - source[0] == extra_rows, "the row difference should equal the duplicated orders that have a payment"
        print(f"    the {extra_rows} extra rows are the duplicated, non-cancelled orders")
    else:
        assert ok

print("\n== which keys explain the difference? (compare the key sets of the two sides) ==")
extra = con.execute("SELECT order_id, count(*) AS copies FROM mart_plain_join GROUP BY 1 HAVING count(*) > 1 ORDER BY 1 LIMIT 5").fetchall()
print("  first keys that appear more than once in the mart:", extra)

# ---- orders against payments, with the differences accounted for ----------------------------------------------------
print("\n== orders against payments: what is explained, what is left? ==")
o_total = con.execute("SELECT round(sum(total_amount), 2) FROM (SELECT DISTINCT order_id, total_amount FROM orders WHERE status <> 'CANCELLED')").fetchone()[0]
p_total = con.execute("SELECT round(sum(amount), 2) FROM payments").fetchone()[0]
orphan_payments = con.execute("SELECT round(coalesce(sum(amount), 0), 2) FROM payments p WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.order_id = p.order_id)").fetchone()[0]
mismatch = con.execute(
    """WITH o AS (SELECT DISTINCT order_id, total_amount FROM orders WHERE status <> 'CANCELLED'),
            p AS (SELECT order_id, sum(amount) AS paid FROM payments GROUP BY order_id)
       SELECT count(*), round(sum(o.total_amount - p.paid), 2) FROM o JOIN p USING (order_id) WHERE abs(o.total_amount - p.paid) > 0.005"""
).fetchone()
raw_gap = round(o_total - p_total, 2)
explained = round(mismatch[1] + (-orphan_payments), 2)
print(f"  orders {o_total:.2f} minus payments {p_total:.2f} = {raw_gap:+.2f}")
print(f"  explained by {mismatch[0]} orders whose total differs from the payment: {mismatch[1]:+.2f}")
print(f"  explained by payments to unknown orders: {-orphan_payments:+.2f}")
print(f"  unexplained: {round(raw_gap - explained, 2):+.2f}")
assert mismatch[0] == P["orders_payment_mismatch"]
assert round(raw_gap - explained, 2) == 0

# ---- Part 2: test the transformation on a tiny golden dataset -------------------------------------------------------
MART_SQL = {
    "plain join": "SELECT sum(p.amount) FROM orders o JOIN payments p USING (order_id) WHERE o.status <> 'CANCELLED'",
    "deduped": "SELECT sum(p.amount) FROM (SELECT DISTINCT * FROM orders) o JOIN payments p USING (order_id) WHERE o.status <> 'CANCELLED'",
}


def golden(case_orders: list[tuple], case_payments: list[tuple]) -> duckdb.DuckDBPyConnection:
    c = duckdb.connect()
    c.execute("CREATE TABLE orders (order_id INT, status VARCHAR, total_amount DOUBLE)")
    c.execute("CREATE TABLE payments (payment_id INT, order_id INT, amount DOUBLE)")
    c.executemany("INSERT INTO orders VALUES (?, ?, ?)", case_orders)
    c.executemany("INSERT INTO payments VALUES (?, ?, ?)", case_payments)
    return c


CASES = [
    ("two plain orders", [(1, "SHIPPED", 100.0), (2, "PLACED", 50.0)], [(1, 1, 100.0), (2, 2, 50.0)], 150.0),
    ("a cancelled order is left out", [(1, "SHIPPED", 100.0), (2, "CANCELLED", 70.0)], [(1, 1, 100.0)], 100.0),
    ("a duplicated order row counts once", [(1, "SHIPPED", 100.0), (1, "SHIPPED", 100.0)], [(1, 1, 100.0)], 100.0),
]

print("\n== unit tests of the transformation on tiny data ==")
for variant, sql in MART_SQL.items():
    results = []
    for name, orders, payments, want in CASES:
        got = golden(orders, payments).execute(sql).fetchone()[0]
        results.append((name, got == want, got, want))
    verdict = "all pass" if all(r[1] for r in results) else "FAILS: " + ", ".join(f"'{r[0]}' (got {r[2]}, want {r[3]})" for r in results if not r[1])
    print(f"  {variant:10s} -> {verdict}")
    if variant == "plain join":
        assert [r[1] for r in results] == [True, True, False]
    else:
        assert all(r[1] for r in results)

# A singular test in the dbt style: a query that returns the rows that break the rule. The test passes when it is empty.
print("\n== singular test: no order appears twice in the mart ==")
for name in ("mart_plain_join", "mart_deduped"):
    failing = con.execute(f"SELECT order_id FROM {name} GROUP BY 1 HAVING count(*) > 1").fetchall()
    print(f"  {name}: {len(failing)} failing rows -> {'FAIL' if failing else 'pass'}")
    assert bool(failing) == (name == "mart_plain_join")
