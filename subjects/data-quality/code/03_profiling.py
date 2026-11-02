"""Lesson: profiling. Look at the data before writing any rule.

A profile is statistics about the contents: how many nulls, how many distinct values, the smallest and largest value,
and the shape of strings. It says what the data IS, not what it SHOULD be. Rules come after, and a person who knows
the business has to confirm them (DMBOK2 section 2.7.1: "backed by data analysis", "confirmed by SMEs").

Run: uv run python 03_profiling.py
"""

import dqlab

con = dqlab.connect()
P = dqlab.PLANTED

# 1. A generic profile of every column, with no knowledge of what the columns mean.
print("== column profile ==")
cols = con.execute(
    "SELECT table_name, column_name, data_type FROM information_schema.columns "
    "WHERE table_name IN ('customers','orders','payments') ORDER BY table_name, ordinal_position"
).fetchall()
print(f"{'column':26s} {'type':10s} {'rows':>5s} {'null%':>6s} {'distinct':>8s}  min .. max")
for table, col, dtype in cols:
    rows, nulls, distinct, lo, hi = con.execute(
        f'SELECT count(*), count(*) FILTER (WHERE "{col}" IS NULL), count(DISTINCT "{col}"), min("{col}")::VARCHAR, max("{col}")::VARCHAR FROM {table}'
    ).fetchone()
    print(f"{table + '.' + col:26s} {dtype[:10]:10s} {rows:5d} {100 * nulls / rows:5.1f}% {distinct:8d}  {lo} .. {hi}")

# 2. Pattern profile of a string column: replace each run of letters with 'a' and each run of digits with '9'.
print("\n== shape of customers.email ==")
MASK = "regexp_replace(regexp_replace(email, '[A-Za-z]+', 'a', 'g'), '[0-9]+', '9', 'g')"
dqlab.show(con, f"SELECT {MASK} AS shape, count(*) AS rows FROM customers GROUP BY 1 ORDER BY 2 DESC")

# 3. Frequency of a low-cardinality column.
print("\n== values of customers.country ==")
dqlab.show(con, "SELECT country, count(*) AS rows FROM customers GROUP BY 1 ORDER BY 2 DESC")

print("\n== values of orders.status ==")
dqlab.show(con, "SELECT status, count(*) AS rows FROM orders GROUP BY 1 ORDER BY 2 DESC")

# 4. What the profile hints at, before any rule exists.
print("\n== hints a reader can take from the profile ==")
hints = [
    ("customers.email has nulls and a second shape", "completeness and validity rules on email"),
    ("customers.country has 9 values, 5 of them look like Thailand", "a valid-value list, or a mapping table"),
    ("customers.birth_date runs from 1850 to 2030", "a range rule, then ask what the real limits are"),
    ("orders rows exceed distinct order_id", "uniqueness on order_id"),
    ("orders.customer_id max is far above customers.customer_id max", "referential integrity to customers"),
    ("orders.total_amount has a negative minimum", "a sign rule, unless refunds are stored here (ask)"),
]
for seen, candidate in hints:
    print(f"  saw: {seen}\n       candidate rule: {candidate}")

# 5. The same profile in pandas, for the two numbers most people look at first.
frames = dqlab.build_frames()
c = frames["customers"]
print("\n== pandas parity ==")
print("null rate of email :", round(c["email"].isna().mean() * 100, 1), "%")
print("distinct emails    :", c["email"].nunique())
assert c["email"].isna().sum() == P["customers_email_null"]

# 6. A sample can miss rare defects. Profile whole columns (aggregates are cheap), do not eyeball a sample.
full = dqlab.one(con, "SELECT count(*) FROM customers WHERE birth_date NOT BETWEEN DATE '1900-01-01' AND DATE '2026-11-01'")
in_sample = dqlab.one(
    con,
    "SELECT count(*) FROM (SELECT * FROM customers USING SAMPLE 10% (bernoulli, 7)) "
    "WHERE birth_date NOT BETWEEN DATE '1900-01-01' AND DATE '2026-11-01'",
)
print(f"\nbirth_date outliers: {full} in the full table, {in_sample} in a 10% sample")

tally: dict[int, int] = {}
for seed in range(1, 41):
    found = dqlab.one(
        con,
        f"SELECT count(*) FROM (SELECT * FROM customers USING SAMPLE 10% (bernoulli, {seed})) "
        "WHERE birth_date NOT BETWEEN DATE '1900-01-01' AND DATE '2026-11-01'",
    )
    tally[found] = tally.get(found, 0) + 1
print("40 different seeds, outliers found -> number of seeds:", dict(sorted(tally.items())))
assert max(tally) < full, "no 10% sample was expected to catch every outlier"

print("\nSelf-check:")
dqlab.check("null count of customers.email", dqlab.one(con, "SELECT count(*) FROM customers WHERE email IS NULL"), P["customers_email_null"])
dqlab.check("country values off the list", dqlab.one(con, "SELECT count(DISTINCT country) FROM customers WHERE country NOT IN ('TH','SG','JP','US')"), 5)
dqlab.check("extra rows in orders vs order_id", dqlab.one(con, "SELECT count(*) - count(DISTINCT order_id) FROM orders"), P["orders_duplicate_rows"])
dqlab.check("birth_date outliers in full table", full, P["customers_birth_out_of_range"])
