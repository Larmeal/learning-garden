"""A small rule registry for the Data Quality exercises.

A rule is more than a SQL query. DMBOK2 section 2.7.1 says rules should be documented consistently, defined in terms
of a dimension, tied to business impact, backed by data analysis and confirmed by a subject matter expert. Section 4.4
adds that a metric needs an owner who is accountable, a threshold that says what is acceptable, and must be something
someone can act on. The Rule dataclass keeps those fields next to the SQL, and lint() flags a rule that lacks them.

The thresholds, owners and impacts below are examples written for this course. They are not from the books.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import duckdb

import dqlab

DIMENSIONS = {"completeness", "validity", "uniqueness", "consistency", "integrity", "timeliness", "accuracy", "reasonability"}
EMAIL_OK = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


@dataclass(frozen=True)
class Rule:
    id: str
    dimension: str
    table: str
    statement: str  # what must be true, in words a business person can confirm
    sql: str  # returns one row: (rows that break the rule, rows the rule applies to)
    max_bad_pct: float  # acceptability threshold: at most this share may break the rule
    severity: str  # "error" blocks publishing, "warn" only reports
    owner: str
    impact: str
    origin: str  # "business", "technical" or "statistical"
    status: str = "active"  # "proposed" until a subject matter expert confirms
    confirmed_by: str | None = None
    planted: str | None = None  # key in dqlab.PLANTED, for the self-check


@dataclass(frozen=True)
class Result:
    rule: Rule
    bad: int
    total: int

    @property
    def bad_pct(self) -> float:
        return 100 * self.bad / self.total if self.total else 0.0

    @property
    def passed(self) -> bool:
        return self.bad_pct <= self.rule.max_bad_pct


def _r(**kw) -> Rule:
    return Rule(**kw)


RULES: list[Rule] = [
    _r(id="CUST-EMAIL-POPULATED", dimension="completeness", table="customers",
       statement="Every customer has an email",
       sql="SELECT count(*) FILTER (WHERE email IS NULL), count(*) FROM customers",
       max_bad_pct=2.0, severity="warn", owner="crm-team", impact="campaign email cannot be sent",
       origin="business", confirmed_by="marketing lead", planted="customers_email_null"),
    _r(id="CUST-EMAIL-SHAPE", dimension="validity", table="customers",
       statement="A non-empty email looks like a@b.c",
       sql=f"SELECT count(*) FILTER (WHERE NOT regexp_matches(email, '{EMAIL_OK}')), count(email) FROM customers",
       max_bad_pct=1.0, severity="warn", owner="crm-team", impact="bounced campaign email",
       origin="technical", confirmed_by="marketing lead", planted="customers_email_malformed"),
    _r(id="CUST-EMAIL-UNIQUE", dimension="uniqueness", table="customers",
       statement="One customer per email",
       sql="SELECT count(email) - count(DISTINCT email), count(email) FROM customers",
       max_bad_pct=0.5, severity="warn", owner="crm-team", impact="duplicate mailings, split customer history",
       origin="business", confirmed_by="marketing lead", planted="customers_email_duplicate_rows"),
    _r(id="CUST-COUNTRY-DOMAIN", dimension="validity", table="customers",
       statement="Country is one of TH, SG, JP, US",
       sql="SELECT count(*) FILTER (WHERE country NOT IN ('TH','SG','JP','US')), count(*) FROM customers",
       max_bad_pct=0.0, severity="error", owner="crm-team", impact="regional reports drop the customer",
       origin="technical", confirmed_by="regional ops", planted="customers_country_off_domain"),
    _r(id="CUST-BIRTH-RANGE", dimension="validity", table="customers",
       statement="Birth date is between 1900-01-01 and today",
       sql=f"SELECT count(*) FILTER (WHERE birth_date NOT BETWEEN DATE '1900-01-01' AND DATE '{dqlab.AS_OF:%Y-%m-%d}'), count(*) FROM customers",
       max_bad_pct=0.0, severity="warn", owner="crm-team", impact="age segments are wrong",
       origin="business", confirmed_by="marketing lead", planted="customers_birth_out_of_range"),
    _r(id="ORD-CUST-POPULATED", dimension="completeness", table="orders",
       statement="Every order has a customer_id",
       sql="SELECT count(*) FILTER (WHERE customer_id IS NULL), count(*) FROM orders",
       max_bad_pct=0.0, severity="error", owner="orders-platform", impact="revenue cannot be attributed",
       origin="business", confirmed_by="finance analyst", planted="orders_customer_null"),
    _r(id="ORD-ID-UNIQUE", dimension="uniqueness", table="orders",
       statement="One row per order_id",
       sql="SELECT count(*) - count(DISTINCT order_id), count(*) FROM orders",
       max_bad_pct=0.0, severity="error", owner="orders-platform", impact="revenue is double counted",
       origin="technical", confirmed_by="finance analyst", planted="orders_duplicate_rows"),
    _r(id="ORD-TOTAL-SIGN", dimension="validity", table="orders",
       statement="total_amount is not negative",
       sql="SELECT count(*) FILTER (WHERE total_amount < 0), count(*) FROM orders",
       max_bad_pct=0.0, severity="warn", owner="orders-platform", impact="revenue is understated",
       origin="statistical", status="proposed", confirmed_by=None, planted="orders_total_negative"),
    _r(id="ORD-SHIPPED-HAS-TS", dimension="consistency", table="orders",
       statement="A SHIPPED order has shipped_ts",
       sql="SELECT count(*) FILTER (WHERE status = 'SHIPPED' AND shipped_ts IS NULL), count(*) FILTER (WHERE status = 'SHIPPED') FROM orders",
       max_bad_pct=0.5, severity="warn", owner="orders-platform", impact="delivery SLA report is wrong",
       origin="business", confirmed_by="logistics lead", planted="orders_shipped_without_ts"),
    _r(id="ORD-SHIP-AFTER-ORDER", dimension="consistency", table="orders",
       statement="shipped_ts is not before order_ts",
       sql="SELECT count(*) FILTER (WHERE shipped_ts < order_ts), count(shipped_ts) FROM orders",
       max_bad_pct=0.0, severity="warn", owner="orders-platform", impact="delivery time is negative",
       origin="technical", confirmed_by="logistics lead", planted="orders_shipped_before_order"),
    _r(id="ORD-CUST-EXISTS", dimension="integrity", table="orders",
       statement="Every non-null customer_id exists in customers",
       sql="SELECT count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.customer_id = o.customer_id)),"
           " count(customer_id) FROM orders o WHERE customer_id IS NOT NULL",
       max_bad_pct=0.1, severity="error", owner="orders-platform", impact="orders cannot be joined to a customer",
       origin="technical", confirmed_by="finance analyst", planted="orders_customer_orphan"),
    _r(id="PAY-ORDER-EXISTS", dimension="integrity", table="payments",
       statement="Every payment belongs to an existing order",
       sql="SELECT count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.order_id = p.order_id)), count(*) FROM payments p",
       max_bad_pct=0.0, severity="error", owner="payments-team", impact="money received with no order",
       origin="technical", confirmed_by="finance analyst", planted="payments_order_orphan"),
    _r(id="ORD-ARRIVES-24H", dimension="timeliness", table="orders",
       statement="An order reaches the warehouse within 24 hours",
       sql="SELECT count(*) FILTER (WHERE ingested_at - order_ts > INTERVAL 24 HOUR), count(*) FROM orders",
       max_bad_pct=1.0, severity="warn", owner="orders-platform", impact="morning dashboards miss orders",
       origin="business", confirmed_by="finance analyst", planted="orders_late_arrival"),
    _r(id="ORD-TOTAL-MATCHES-PAID", dimension="accuracy", table="orders",
       statement="Order total equals the sum of payments (payment system is the record)",
       sql="WITH o AS (SELECT DISTINCT order_id, total_amount FROM orders WHERE status <> 'CANCELLED'),"
           " p AS (SELECT order_id, sum(amount) AS paid FROM payments GROUP BY order_id)"
           " SELECT count(*) FILTER (WHERE abs(o.total_amount - p.paid) > 0.005), count(*) FROM o JOIN p USING (order_id)",
       max_bad_pct=0.1, severity="error", owner="payments-team", impact="reported revenue differs from cash",
       origin="business", confirmed_by="finance analyst", planted="orders_payment_mismatch"),
]


def run(con: duckdb.DuckDBPyConnection, rules: list[Rule] | None = None) -> list[Result]:
    out = []
    for rule in rules or RULES:
        bad, total = con.execute(rule.sql).fetchone()
        out.append(Result(rule, bad, total))
    return out


def lint(rule: Rule) -> list[str]:
    """Problems that make a rule hard to trust or to act on. An empty list means the rule is well formed."""
    problems = []
    if rule.dimension not in DIMENSIONS:
        problems.append(f"dimension '{rule.dimension}' is not one of the agreed names")
    if not rule.owner:
        problems.append("no owner: nobody is accountable when it fails")
    if not rule.impact:
        problems.append("no business impact: why is this measured?")
    if not 0 <= rule.max_bad_pct <= 100:
        problems.append("threshold must be a percentage between 0 and 100")
    if rule.severity not in {"error", "warn"}:
        problems.append("severity must be 'error' or 'warn'")
    if rule.status == "active" and not rule.confirmed_by:
        problems.append("active rule has not been confirmed by a subject matter expert")
    if rule.severity == "error" and rule.status != "active":
        problems.append("a rule that can block publishing must be active")
    return problems


def gating(results: list[Result]) -> list[Result]:
    """Only active rules with severity 'error' that fail can stop a pipeline."""
    return [r for r in results if r.rule.status == "active" and r.rule.severity == "error" and not r.passed]


def ensure_planted(results: list[Result]) -> None:
    for r in results:
        if r.rule.planted:
            dqlab.check(r.rule.id, r.bad, dqlab.PLANTED[r.rule.planted])
