"""Lesson: dimensions. One SQL check per dimension, each reported the way DMBOK2 Table 30 does it.

Table 30 reports every rule as a positive percentage (share that conforms) and a negative one (share that does not).
The dimension names are the DAMA UK six (completeness, uniqueness, timeliness, validity, accuracy, consistency) plus
integrity from DMBOK2 Table 29. The book says there is no single agreed set, so treat the names as vocabulary.

Run: uv run python 02_dimensions.py
"""

import dqlab

con = dqlab.connect()
P = dqlab.PLANTED
AS_OF = dqlab.AS_OF
EMAIL_OK = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"

# (dimension, rule, SQL returning (bad, total), planted key)
RULES = [
    ("completeness", "customers.email is populated",
     "SELECT count(*) FILTER (WHERE email IS NULL), count(*) FROM customers", "customers_email_null"),
    ("completeness", "orders.customer_id is populated",
     "SELECT count(*) FILTER (WHERE customer_id IS NULL), count(*) FROM orders", "orders_customer_null"),
    ("validity", "email has the shape a@b.c (non-null only)",
     f"SELECT count(*) FILTER (WHERE NOT regexp_matches(email, '{EMAIL_OK}')), count(email) FROM customers",
     "customers_email_malformed"),
    ("validity", "country is one of TH, SG, JP, US",
     "SELECT count(*) FILTER (WHERE country NOT IN ('TH','SG','JP','US')), count(*) FROM customers",
     "customers_country_off_domain"),
    ("validity", "birth_date between 1900-01-01 and as-of",
     f"SELECT count(*) FILTER (WHERE birth_date NOT BETWEEN DATE '1900-01-01' AND DATE '{AS_OF:%Y-%m-%d}'), count(*) FROM customers",
     "customers_birth_out_of_range"),
    ("validity", "orders.total_amount >= 0",
     "SELECT count(*) FILTER (WHERE total_amount < 0), count(*) FROM orders", "orders_total_negative"),
    ("uniqueness", "one customer per email (extra rows)",
     "SELECT count(email) - count(DISTINCT email), count(email) FROM customers", "customers_email_duplicate_rows"),
    ("uniqueness", "one row per order_id (extra rows)",
     "SELECT count(*) - count(DISTINCT order_id), count(*) FROM orders", "orders_duplicate_rows"),
    ("consistency", "SHIPPED implies shipped_ts is set",
     "SELECT count(*) FILTER (WHERE status = 'SHIPPED' AND shipped_ts IS NULL), count(*) FILTER (WHERE status = 'SHIPPED') FROM orders",
     "orders_shipped_without_ts"),
    ("consistency", "shipped_ts is not before order_ts",
     "SELECT count(*) FILTER (WHERE shipped_ts < order_ts), count(shipped_ts) FROM orders", "orders_shipped_before_order"),
    ("integrity", "orders.customer_id exists in customers",
     "SELECT count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.customer_id = o.customer_id)),"
     " count(customer_id) FROM orders o WHERE customer_id IS NOT NULL", "orders_customer_orphan"),
    ("integrity", "payments.order_id exists in orders",
     "SELECT count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.order_id = p.order_id)), count(*) FROM payments p",
     "payments_order_orphan"),
    ("timeliness", "order reaches the warehouse within 24 hours",
     "SELECT count(*) FILTER (WHERE ingested_at - order_ts > INTERVAL 24 HOUR), count(*) FROM orders", "orders_late_arrival"),
    ("accuracy", "order total equals the payment system (system of record)",
     "WITH o AS (SELECT DISTINCT order_id, total_amount FROM orders WHERE status <> 'CANCELLED'),"
     " p AS (SELECT order_id, sum(amount) AS paid FROM payments GROUP BY order_id)"
     " SELECT count(*) FILTER (WHERE abs(o.total_amount - p.paid) > 0.005), count(*) FROM o JOIN p USING (order_id)",
     "orders_payment_mismatch"),
]

print(f"{'dimension':13s} {'rule':56s} {'bad':>5s} {'total':>6s} {'valid%':>8s} {'invalid%':>9s}")
for dimension, rule, sql, key in RULES:
    bad, total = con.execute(sql).fetchone()
    print(f"{dimension:13s} {rule:56s} {bad:5d} {total:6d} {100 * (total - bad) / total:7.2f}% {100 * bad / total:8.2f}%")

# Table-level timeliness is a different kind of check: how old is the newest row?
lag = con.execute(f"SELECT TIMESTAMP '{AS_OF:%Y-%m-%d %H:%M:%S}' - max(order_ts) FROM orders").fetchone()[0]
print(f"\nfreshness: newest order is {lag} older than as-of ({AS_OF:%Y-%m-%d %H:%M}); a 24 hour promise is broken")
assert lag.total_seconds() > 24 * 3600

print("\nSelf-check against what was planted:")
for dimension, rule, sql, key in RULES:
    dqlab.check(f"{dimension}: {rule[:36]}", con.execute(sql).fetchone()[0], P[key])

# A defect can belong to more than one dimension. 'THA' for a country is off the valid list (validity) and also
# written differently from 'TH' elsewhere (consistency of representation). DMBOK2 Figure 92 shows these overlaps.
print("\ncountry values that mean Thailand but are not 'TH':")
dqlab.show(con, "SELECT country, count(*) AS rows FROM customers WHERE country NOT IN ('TH','SG','JP','US') GROUP BY 1 ORDER BY 2 DESC")
