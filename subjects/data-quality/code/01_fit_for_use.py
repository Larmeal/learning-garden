"""Lesson: assurance-basics. The same data can be good for one consumer and bad for another.

Quality is measured against what a consumer needs (DMBOK2 section 1.3.1: "fit for the purposes"). Here two consumers
read the same dataset and each has its own threshold. The second half prices a data incident with the formula from
Data Quality Fundamentals chapter 5. Its numbers are made up for the example.

Run: uv run python 01_fit_for_use.py
"""

import dqlab

con = dqlab.connect()

EMAIL_OK = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"

usable_email = dqlab.one(con, f"SELECT count(*) FROM customers WHERE regexp_matches(email, '{EMAIL_OK}')")
customers = dqlab.one(con, "SELECT count(*) FROM customers")

# Finance reads orders and wants each order total to equal what the payment system recorded for it.
finance = con.execute(
    """
    WITH o AS (SELECT DISTINCT order_id, total_amount FROM orders WHERE status <> 'CANCELLED'),
         p AS (SELECT order_id, sum(amount) AS paid FROM payments GROUP BY order_id)
    SELECT count(*) AS orders_checked,
           count(*) FILTER (WHERE abs(o.total_amount - p.paid) <= 0.005) AS matching
    FROM o JOIN p USING (order_id)
    """
).fetchone()
orders_checked, matching = finance

print("Two consumers, one dataset\n")
rows = [
    ("Marketing", "customers.email is usable", usable_email, customers, 98.0),
    ("Finance", "order total equals payments", matching, orders_checked, 99.9),
]
print(f"{'consumer':10s} {'need':30s} {'good':>6s} {'total':>6s} {'score':>8s} {'needs':>7s}  verdict")
for who, need, good, total, bar in rows:
    score = 100 * good / total
    print(f"{who:10s} {need:30s} {good:6d} {total:6d} {score:7.1f}% {bar:6.1f}%  {'fit' if score >= bar else 'NOT fit'}")

print("\nThe 98% bar for marketing comes from the example in DMBOK2 section 1.3.3. The 99.9% bar for finance is ours.")
print("Neither number is a standard. Each consumer has to say what it can tolerate.")

# What a failing score costs: (time to detect + time to resolve) x hourly cost of the downtime.
ttd_hours, ttr_hours, hourly_cost = 30, 6, 300
print("\nCost of one data incident (all three inputs are made up):")
print(f"  ({ttd_hours} + {ttr_hours}) h x {hourly_cost} per h = {(ttd_hours + ttr_hours) * hourly_cost} per incident")

# Self-check against the planted defects.
bad_email = dqlab.PLANTED["customers_email_null"] + dqlab.PLANTED["customers_email_malformed"]
dqlab.check("customers without a usable email", customers - usable_email, bad_email)
dqlab.check("non-cancelled orders where total <> paid", orders_checked - matching, dqlab.PLANTED["orders_payment_mismatch"])
