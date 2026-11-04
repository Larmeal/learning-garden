"""Lesson: dimensions, deep-dive pages. One demonstration per way a dimension is easy to misread.

Each block prints the numbers that the pages of the dimensions lesson quote. Most blocks run on the shared dataset. A
few use a tiny table or a modified copy that is built here and labeled as such, because the shared dataset has no
planted defect of that kind. Everything is asserted, so a change to dqlab.py that moves a number stops the script.

Run: uv run python 13_dimension_pitfalls.py
"""

import duckdb
import pandas as pd

import dqlab

con = dqlab.connect()
P = dqlab.PLANTED
EMAIL_OK = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


def section(title: str) -> None:
    print(f"\n=== {title}")


def expect(label: str, got, want) -> None:
    ok = got == want
    print(f"  {'OK ' if ok else 'BAD'} {label}: {got}")
    assert ok, f"{label}: got {got}, expected {want}"


# ---- completeness -----------------------------------------------------------------------------------------------------
section("completeness: a NULL is not always a defect, and a filled value is not always real")

null_ship, orders = con.execute("SELECT count(*) FILTER (WHERE shipped_ts IS NULL), count(*) FROM orders").fetchall()[0]
unshipped_ok = con.execute(
    "SELECT count(*) FILTER (WHERE shipped_ts IS NULL AND status <> 'SHIPPED') FROM orders"
).fetchall()[0][0]
shipped_missing = con.execute(
    "SELECT count(*) FILTER (WHERE shipped_ts IS NULL AND status = 'SHIPPED') FROM orders"
).fetchall()[0][0]
print(f"  orders.shipped_ts is NULL in {null_ship} of {orders} rows ({100 * null_ship / orders:.1f}%)")
print(f"  {unshipped_ok} of them are PLACED or CANCELLED orders: nothing has shipped, so NULL is right")
print(f"  {shipped_missing} are SHIPPED orders without a time: those are the defects")
expect("conditional rule finds only the planted rows", shipped_missing, P["orders_shipped_without_ts"])
assert null_ship == unshipped_ok + shipped_missing

# A tiny table: the value is present but means nothing. Plain IS NULL calls all of it complete.
phones = pd.DataFrame({"phone": ["0812345678", "", "N/A", "000-000-0000", None, "0898765432", "  ", "-"]})
con.register("_phones", phones)
null_only = con.execute("SELECT count(*) FILTER (WHERE phone IS NULL) FROM _phones").fetchall()[0][0]
placeholder = con.execute(
    "SELECT count(*) FILTER (WHERE phone IS NULL OR trim(phone) IN ('', 'N/A', '-') OR phone = '000-000-0000') FROM _phones"
).fetchall()[0][0]
print(f"  tiny phone table (8 rows): IS NULL finds {null_only}, a check for blanks and placeholders finds {placeholder}")
expect("IS NULL alone misses the placeholders", (null_only, placeholder), (1, 6))

# Data set level: every row that arrived can be fully populated while rows are missing. The shared dataset has no planted
# gap, so build one in a copy: keep only a fifth of the orders of one day.
by_day = con.execute(
    "SELECT CAST(order_ts AS DATE) AS d, count(*) AS n FROM (SELECT DISTINCT * FROM orders) GROUP BY 1 ORDER BY 1"
).df()
gap_day = pd.Timestamp(by_day.iloc[60]["d"]).date()
full = con.execute("SELECT DISTINCT * FROM orders").df()
on_gap_day = pd.to_datetime(full["order_ts"]).dt.date == gap_day
kept = pd.concat([full[~on_gap_day], full[on_gap_day].iloc[::5]])  # every fifth row of that day survives
con.register("_gap", kept)
gap_counts = con.execute(
    "SELECT CAST(order_ts AS DATE) AS d, count(*) AS n FROM _gap GROUP BY 1 ORDER BY 1"
).df()
history = gap_counts[gap_counts["d"] != pd.Timestamp(gap_day)]["n"]
hist_mean, hist_sd = history.mean(), history.std()
n_gap = int(gap_counts[gap_counts["d"] == pd.Timestamp(gap_day)]["n"].iloc[0])
n_orig = int(by_day[by_day["d"] == pd.Timestamp(gap_day)]["n"].iloc[0])
row_level = con.execute("SELECT count(*) FILTER (WHERE status IS NOT NULL AND total_amount IS NOT NULL), count(*) FROM _gap").fetchall()[0]
print(f"  copy with 4 of 5 orders of {gap_day} removed: that day has {n_gap} rows instead of {n_orig}")
print(f"  rows per day on the other days: mean {hist_mean:.1f}, sd {hist_sd:.1f}, so the lowest usual day is about {hist_mean - 3 * hist_sd:.1f}")
print(f"  row-level check (status and total_amount present) on the copy: {row_level[0]} of {row_level[1]} rows pass")
assert row_level[0] == row_level[1]
assert n_gap < hist_mean - 3 * hist_sd
expect("rows on the gap day, before and after", (n_orig, n_gap), (30, 6))

# ---- validity ---------------------------------------------------------------------------------------------------------
section("validity: passing the rule says nothing about being right")

passes_total_rule = con.execute(
    """
    WITH o AS (SELECT DISTINCT order_id, total_amount FROM orders WHERE status <> 'CANCELLED'),
         p AS (SELECT order_id, sum(amount) AS paid FROM payments GROUP BY order_id)
    SELECT count(*) FILTER (WHERE abs(o.total_amount - p.paid) > 0.005),
           count(*) FILTER (WHERE abs(o.total_amount - p.paid) > 0.005 AND o.total_amount >= 0)
    FROM o JOIN p USING (order_id)
    """
).fetchall()[0]
print(f"  orders whose total differs from the payment system: {passes_total_rule[0]}; "
      f"of those, {passes_total_rule[1]} pass the validity rule total_amount >= 0")
expect("every wrong total is a valid total", passes_total_rule, (P["orders_payment_mismatch"],) * 2)

# duplicates also pass the email format rule
dup_valid = con.execute(
    f"""
    WITH d AS (SELECT email FROM customers WHERE email IS NOT NULL GROUP BY email HAVING count(*) > 1)
    SELECT count(*) FILTER (WHERE regexp_matches(c.email, '{EMAIL_OK}')), count(*)
    FROM customers c JOIN d USING (email)
    """
).fetchall()[0]
print(f"  customers that share an email with someone else: {dup_valid[1]}, all of the shape a@b.c: {dup_valid[0]}")
expect("duplicated emails are all valid", dup_valid, (20, 20))

# a loose pattern accepts rubbish
junk = pd.DataFrame({"email": ["a@b.c", "x@y.z", "nobody@nowhere.zz", "ann@example.com", "ann@@example.com", "ann@example"]})
con.register("_junk", junk)
accepted = con.execute(f"SELECT count(*) FILTER (WHERE regexp_matches(email, '{EMAIL_OK}')) FROM _junk").fetchall()[0][0]
print(f"  tiny email table (6 rows): the pattern accepts {accepted}, including a@b.c and nobody@nowhere.zz")
expect("the pattern accepts four of six", accepted, 4)

# the same dates, read two ways
dates = pd.DataFrame({"raw": ["09/05/2026", "13/05/2026", "05/13/2026"]})
con.register("_dates", dates)
day_first = con.execute("SELECT count(try_strptime(raw, '%d/%m/%Y')) FROM _dates").fetchall()[0][0]
month_first = con.execute("SELECT count(try_strptime(raw, '%m/%d/%Y')) FROM _dates").fetchall()[0][0]
print(f"  tiny date table (3 rows): day-first parses {day_first}, month-first parses {month_first}; 09/05/2026 parses both ways")
expect("each reading fails on a different row", (day_first, month_first), (2, 2))

# ---- uniqueness -------------------------------------------------------------------------------------------------------
section("uniqueness: how you count, and what DISTINCT hides")

extra, in_groups = con.execute(
    """
    WITH g AS (SELECT order_id, count(*) AS n FROM orders GROUP BY order_id HAVING count(*) > 1)
    SELECT sum(n - 1), sum(n) FROM g
    """
).fetchall()[0]
print(f"  duplicated orders: {extra} extra rows, or {in_groups} rows that belong to a duplicate group")
expect("extra rows", int(extra), P["orders_duplicate_rows"])
expect("rows in a group", int(in_groups), 2 * P["orders_duplicate_rows"])

gross, net = con.execute(
    "SELECT sum(total_amount), (SELECT sum(total_amount) FROM (SELECT DISTINCT * FROM orders)) FROM orders"
).fetchall()[0]
print(f"  sum(total_amount) over orders: {gross:,.2f}; after removing the exact copies: {net:,.2f}; overstated by {gross - net:,.2f}")
assert gross > net

# a key that is unique does not mean the entity is
email_keys = con.execute(
    "SELECT count(DISTINCT customer_id) = count(*), count(email), count(DISTINCT email) FROM customers"
).fetchall()[0]
print(f"  customers: customer_id is unique ({email_keys[0]}), yet {email_keys[1]} emails hold only {email_keys[2]} distinct values")
expect("ten customers repeat an email", (email_keys[0], email_keys[1] - email_keys[2]), (True, P["customers_email_duplicate_rows"]))

people = pd.DataFrame({"email": ["ann@example.com", "Ann@Example.com", "ann@example.com ", "bob@example.com"]})
con.register("_people", people)
exact, normalized = con.execute(
    "SELECT count(DISTINCT email), count(DISTINCT lower(trim(email))) FROM _people"
).fetchall()[0]
print(f"  tiny table (4 rows): {exact} distinct by exact text, {normalized} after lower() and trim()")
expect("normalizing finds two more copies", (exact, normalized), (4, 2))

# ---- consistency ------------------------------------------------------------------------------------------------------
section("consistency: agreement is not correctness")

# same value written five ways
spell = con.execute(
    "SELECT count(DISTINCT country) FILTER (WHERE upper(country) IN ('TH','THA','THAILAND') OR country IN ('ไทย','T.H.')) "
    "FROM customers"
).fetchall()[0][0]
print(f"  customers.country has {spell} different spellings for Thailand")
expect("spellings of Thailand", spell, 6)

# a source that is consistently wrong: two columns agree and both are wrong
agree = pd.DataFrame(
    {"order_id": [1, 2, 3], "total_amount": [100.0, 250.0, 80.0], "total_in_report": [100.0, 250.0, 80.0], "paid": [90.0, 250.0, 70.0]}
)
con.register("_agree", agree)
same_as_report, same_as_payment = con.execute(
    "SELECT count(*) FILTER (WHERE total_amount = total_in_report), count(*) FILTER (WHERE total_amount = paid) FROM _agree"
).fetchall()[0]
print(f"  tiny table (3 orders): total_amount matches the report copy in {same_as_report} of 3, the payment system in {same_as_payment} of 3")
expect("agreeing with a copy proves nothing", (same_as_report, same_as_payment), (3, 1))

# a business rule across rows of the same entity, not found by looking at one column
rule_zero = con.execute("SELECT count(*) FILTER (WHERE status = 'PLACED' AND shipped_ts IS NOT NULL) FROM orders").fetchall()[0][0]
print(f"  rule 'PLACED must not have shipped_ts' finds {rule_zero} rows: it holds, and holding is information too")
expect("no PLACED order has shipped", rule_zero, 0)

# ---- integrity --------------------------------------------------------------------------------------------------------
section("integrity: NOT IN, NULL keys and the direction of the check")

not_in = con.execute(
    "SELECT count(*) FROM orders WHERE customer_id NOT IN (SELECT customer_id FROM customers)"
).fetchall()[0][0]
not_exists = con.execute(
    "SELECT count(*) FROM orders o WHERE o.customer_id IS NOT NULL "
    "AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.customer_id = o.customer_id)"
).fetchall()[0][0]
print(f"  orphan orders: NOT IN gives {not_in}, NOT EXISTS gives {not_exists}")
expect("both agree while the parent has no NULL key", (not_in, not_exists), (30, 30))

not_in_null = con.execute(
    "SELECT count(*) FROM orders WHERE customer_id NOT IN (SELECT customer_id FROM customers UNION ALL SELECT NULL)"
).fetchall()[0][0]
print(f"  add one NULL row to the parent list and NOT IN gives {not_in_null}: the check silently reports a clean table")
expect("one NULL in the list hides every orphan", not_in_null, 0)

unlinked = con.execute("SELECT count(*) FROM orders WHERE customer_id IS NULL").fetchall()[0][0]
print(f"  orders that cannot be tied to a customer: {not_exists} orphans + {unlinked} NULL keys = {not_exists + unlinked}")
expect("two different problems, one effect", not_exists + unlinked, 45)

no_orders = con.execute(
    "SELECT count(*) FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id)"
).fetchall()[0][0]
print(f"  customers with no orders: {no_orders}. Had there been some, that would be a customer who has not bought yet, not an orphan")
assert no_orders == 0

# ---- timeliness -------------------------------------------------------------------------------------------------------
section("timeliness: the load time is not the event time")

last_load, last_event = con.execute("SELECT max(ingested_at), max(order_ts) FROM orders").fetchall()[0]
as_of = dqlab.AS_OF
print(f"  as-of {as_of:%Y-%m-%d %H:%M}; newest ingested_at {last_load:%Y-%m-%d %H:%M} "
      f"({(as_of - last_load).total_seconds() / 60:.0f} min ago); newest order_ts {last_event:%Y-%m-%d %H:%M} "
      f"({(as_of - last_event).total_seconds() / 3600:.1f} h ago)")
assert (as_of - last_load).total_seconds() < 6 * 3600 and (as_of - last_event).total_seconds() > 24 * 3600

# latency and currency are different questions
latency = con.execute(
    "SELECT quantile_cont(epoch(ingested_at - order_ts) / 60, 0.5), max(epoch(ingested_at - order_ts) / 3600) FROM orders"
).fetchall()[0]
print(f"  latency per row: median {latency[0]:.0f} min, worst {latency[1]:.0f} h; 24 h bar is missed by {P['orders_late_arrival']} rows")
expect("late rows", con.execute("SELECT count(*) FILTER (WHERE ingested_at - order_ts > INTERVAL 24 HOUR) FROM orders").fetchall()[0][0],
       P["orders_late_arrival"])

# ---- accuracy ---------------------------------------------------------------------------------------------------------
section("accuracy: the tolerance and the coverage decide the number")

base = """
WITH o AS (SELECT DISTINCT order_id, total_amount FROM orders WHERE status <> 'CANCELLED'),
     p AS (SELECT order_id, sum(amount) AS paid FROM payments GROUP BY order_id)
"""
TOLERANCES = (0.005, 1.0, 11.0, 60.0)
for tol in TOLERANCES:
    n = con.execute(base + f"SELECT count(*) FILTER (WHERE abs(o.total_amount - p.paid) > {tol}), count(*) FROM o JOIN p USING (order_id)").fetchall()[0]
    print(f"  tolerance {tol:>6}: {n[0]:3d} mismatches of {n[1]}")
tol_counts = [con.execute(base + f"SELECT count(*) FILTER (WHERE abs(o.total_amount - p.paid) > {t}) FROM o JOIN p USING (order_id)").fetchall()[0][0]
              for t in TOLERANCES]
assert tol_counts[0] == P["orders_payment_mismatch"] and tol_counts == sorted(set(tol_counts), reverse=True)

coverage = con.execute(base + "SELECT (SELECT count(*) FROM o), (SELECT count(*) FROM o JOIN p USING (order_id))").fetchall()[0]
unmatched_payments = con.execute(
    "SELECT count(*) FROM payments p WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.order_id = p.order_id)"
).fetchall()[0][0]
print(f"  non-cancelled orders {coverage[0]}, compared {coverage[1]}: here every order has a payment, so coverage is full")
print(f"  {unmatched_payments} payments name an order that does not exist: the reference has its own problems, so it cannot judge them")
assert coverage[0] == coverage[1] and unmatched_payments == P["payments_order_orphan"]

# ---- reasonability ----------------------------------------------------------------------------------------------------
section("reasonability: values that are valid one by one, wrong as a pattern")

# The shared dataset has no planted reasonability defect, so build one in a copy: one day where totals are in satang
# instead of baht (divided by 100). Every row still passes total_amount >= 0.
daily = con.execute(
    "SELECT CAST(order_ts AS DATE) AS d, count(*) AS n, avg(total_amount) AS avg_total FROM "
    "(SELECT DISTINCT * FROM orders WHERE total_amount >= 0) GROUP BY 1 ORDER BY 1"
).df()
bad_day = pd.Timestamp(daily.iloc[60]["d"]).date()
rows = con.execute("SELECT * FROM (SELECT DISTINCT * FROM orders WHERE total_amount >= 0)").df()
rows.loc[pd.to_datetime(rows["order_ts"]).dt.date == bad_day, "total_amount"] /= 100
con.register("_shifted", rows)
shifted = con.execute(
    "SELECT CAST(order_ts AS DATE) AS d, count(*) AS n, avg(total_amount) AS avg_total FROM _shifted GROUP BY 1 ORDER BY 1"
).df()
validity_fail = con.execute("SELECT count(*) FILTER (WHERE total_amount < 0) FROM _shifted").fetchall()[0][0]
mean, sd = shifted["avg_total"].mean(), shifted["avg_total"].std()
flagged_baseline = daily[(daily["avg_total"] - daily["avg_total"].mean()).abs() > 3 * daily["avg_total"].std()]
flagged = shifted[(shifted["avg_total"] - mean).abs() > 3 * sd]
print(f"  copy with {bad_day} divided by 100: validity rule finds {validity_fail} rows")
print(f"  daily average total: overall {mean:,.0f}, sd {sd:,.0f}; days beyond 3 sd: {len(flagged)} ({flagged.iloc[0]['d']}, avg {flagged.iloc[0]['avg_total']:,.2f})")
print(f"  the same rule on the untouched data flags {len(flagged_baseline)} days")
base_mean, base_sd = daily["avg_total"].mean(), daily["avg_total"].std()
print(f"  untouched daily averages: mean {base_mean:,.0f}, sd {base_sd:,.0f}; with the bad day inside the history the sd grows to {sd:,.0f}")
assert sd > base_sd
expect("validity sees nothing", validity_fail, 0)
expect("reasonability sees the bad day", (len(flagged), len(flagged_baseline)), (1, 0))

counts_mean, counts_sd = daily["n"].mean(), daily["n"].std()
history = daily["n"].rolling(30).mean().shift(1)
with_history = history.notna()
over = int((daily["n"][with_history] > 1.05 * history[with_history]).sum())
print(f"  orders per day: mean {counts_mean:.1f}, sd {counts_sd:.1f}. DMBOK2's example bar (a day above 105% of the previous 30 day average)")
print(f"  would fire on {over} of {int(with_history.sum())} days here, because a daily count is noisy: a bar needs the spread, not only the mean")
assert over > 0.2 * with_history.sum()

print("\nAll pitfall checks behaved as the lessons describe.")
