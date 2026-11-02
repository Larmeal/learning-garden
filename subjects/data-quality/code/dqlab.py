"""Shared helpers for the Data Quality exercises.

Builds one small e-commerce dataset (customers, orders, payments) in an in-memory DuckDB. Every defect is planted
on purpose and in a fixed number, and PLANTED records those numbers. An exercise that finds exactly the planted
number has shown that its check works. The data is deterministic: the same seed gives the same rows.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta

import duckdb
import pandas as pd

SEED = 20261101
AS_OF = datetime(2026, 11, 1, 8, 0)  # "now" for every freshness question, so results never depend on the clock
N_CUSTOMERS = 500
N_ORDERS = 3000

# How many of each defect were planted. The exercises assert against these.
PLANTED: dict[str, int] = {
    "customers_email_null": 40,
    "customers_email_malformed": 15,
    "customers_email_duplicate_rows": 10,
    "customers_country_off_domain": 25,
    "customers_birth_out_of_range": 6,
    "orders_customer_null": 15,
    "orders_customer_orphan": 30,
    "orders_duplicate_rows": 20,
    "orders_total_negative": 12,
    "orders_shipped_without_ts": 25,
    "orders_shipped_before_order": 10,
    "orders_late_arrival": 40,
    "orders_payment_mismatch": 35,
    "payments_order_orphan": 20,
}


def _take(pool: list[int], n: int) -> list[int]:
    """Remove and return the first n ids of the pool, so planted sets never overlap."""
    taken = pool[:n]
    del pool[:n]
    return taken


def build_frames() -> dict[str, pd.DataFrame]:
    rng = random.Random(SEED)

    # ---- customers ------------------------------------------------------------------------------------------------
    ids = list(range(1, N_CUSTOMERS + 1))
    email = {i: f"user{i}@example.com" for i in ids}
    country = {i: rng.choices(["TH", "SG", "JP", "US"], weights=[70, 12, 10, 8])[0] for i in ids}
    birth = {i: datetime(1960, 1, 1) + timedelta(days=rng.randint(0, 46 * 365)) for i in ids}
    signup = {i: datetime(2025, 1, 1) + timedelta(days=rng.randint(0, 540)) for i in ids}

    # ids 1..10 and 491..500 are reserved for the duplicate-email pairs, the rest are shuffled into pools
    for first, copy in zip(range(1, 11), range(491, 501)):
        email[copy] = email[first]
    pool = list(range(11, 491))
    rng.shuffle(pool)
    for i in _take(pool, PLANTED["customers_email_null"]):
        email[i] = None
    for i in _take(pool, PLANTED["customers_email_malformed"]):
        email[i] = email[i].replace("@", "", 1)  # "user7example.com"
    for n, i in enumerate(_take(pool, PLANTED["customers_country_off_domain"])):
        country[i] = ["Thailand", "th", "THA", "ไทย", "T.H."][n % 5]
    for n, i in enumerate(_take(pool, PLANTED["customers_birth_out_of_range"])):
        birth[i] = [datetime(1890, 5, 1), datetime(1899, 1, 1), datetime(2027, 3, 1), datetime(2030, 1, 1),
                    datetime(2026, 12, 25), datetime(1850, 1, 1)][n]

    customers = pd.DataFrame(
        {
            "customer_id": ids,
            "email": [email[i] for i in ids],
            "country": [country[i] for i in ids],
            "birth_date": [birth[i].date() for i in ids],
            "signup_date": [signup[i].date() for i in ids],
        }
    )

    # ---- orders ---------------------------------------------------------------------------------------------------
    oids = list(range(1, N_ORDERS + 1))
    start = datetime(2026, 7, 1)
    span_minutes = int((datetime(2026, 10, 29, 23, 59) - start).total_seconds() // 60)
    order_ts = {o: start + timedelta(minutes=rng.randint(0, span_minutes)) for o in oids}
    # the latest order is on 29 Oct, which is 2 days before AS_OF: the table is stale against a 24 hour promise
    order_ts[oids[0]] = datetime(2026, 10, 29, 23, 59)
    cust = {o: rng.randint(1, N_CUSTOMERS) for o in oids}
    status = {o: rng.choices(["PLACED", "SHIPPED", "CANCELLED"], weights=[25, 60, 15])[0] for o in oids}
    total = {o: round(rng.uniform(100, 5000), 2) for o in oids}
    ingest_lag = {o: timedelta(minutes=rng.randint(1, 30)) for o in oids}

    pool = oids[1:]
    rng.shuffle(pool)
    neg = _take(pool, PLANTED["orders_total_negative"])
    no_ts = _take(pool, PLANTED["orders_shipped_without_ts"])
    before = _take(pool, PLANTED["orders_shipped_before_order"])
    late = _take(pool, PLANTED["orders_late_arrival"])
    mismatch = _take(pool, PLANTED["orders_payment_mismatch"])
    null_c = _take(pool, PLANTED["orders_customer_null"])
    orphan_c = _take(pool, PLANTED["orders_customer_orphan"])
    dup = _take(pool, PLANTED["orders_duplicate_rows"])

    for o in neg:
        total[o] = -round(rng.uniform(10, 500), 2)
    for o in no_ts + before:
        status[o] = "SHIPPED"
    for o in mismatch:
        status[o] = rng.choice(["PLACED", "SHIPPED"])  # a payment must exist for the comparison
    for o in late:
        ingest_lag[o] = timedelta(days=rng.randint(2, 5))
    for o in null_c:
        cust[o] = None
    for n, o in enumerate(orphan_c):
        cust[o] = 9001 + n

    shipped_ts: dict[int, datetime | None] = {}
    for o in oids:
        shipped_ts[o] = order_ts[o] + timedelta(days=rng.randint(1, 2)) if status[o] == "SHIPPED" else None
    for o in no_ts:
        shipped_ts[o] = None
    for o in before:
        shipped_ts[o] = order_ts[o] - timedelta(days=1)

    orders = pd.DataFrame(
        {
            "order_id": oids,
            "customer_id": pd.array([cust[o] for o in oids], dtype="Int64"),
            "order_ts": [order_ts[o] for o in oids],
            # nothing may arrive after AS_OF, otherwise the data would contain an unplanted defect
            "ingested_at": [min(order_ts[o] + ingest_lag[o], AS_OF - timedelta(minutes=1)) for o in oids],
            "status": [status[o] for o in oids],
            "total_amount": [total[o] for o in oids],
            "shipped_ts": pd.to_datetime([shipped_ts[o] for o in oids]),
        }
    )
    orders = pd.concat([orders, orders[orders["order_id"].isin(dup)]], ignore_index=True)  # exact copies

    # ---- payments -------------------------------------------------------------------------------------------------
    rows = []
    for o in oids:
        if status[o] == "CANCELLED":
            continue
        amount = total[o]
        if o in mismatch:
            amount = round(amount + rng.choice([-50.0, -1.0, 10.5, 120.0]), 2)
        rows.append((len(rows) + 1, o, amount, order_ts[o] + timedelta(minutes=rng.randint(1, 60))))
    for n in range(PLANTED["payments_order_orphan"]):
        rows.append((len(rows) + 1, 9001 + n, round(rng.uniform(100, 3000), 2), datetime(2026, 10, 20) + timedelta(hours=n)))
    payments = pd.DataFrame(rows, columns=["payment_id", "order_id", "amount", "paid_ts"])

    return {"customers": customers, "orders": orders, "payments": payments}


def connect() -> duckdb.DuckDBPyConnection:
    """An in-memory DuckDB with the three tables loaded."""
    con = duckdb.connect()
    for name, frame in build_frames().items():
        con.register(f"_{name}", frame)
        con.execute(f"CREATE TABLE {name} AS SELECT * FROM _{name}")
    return con


def one(con: duckdb.DuckDBPyConnection, sql: str):
    """Run a query that returns a single value."""
    return con.execute(sql).fetchone()[0]


def show(con: duckdb.DuckDBPyConnection, sql: str) -> None:
    print(con.execute(sql).df().to_string(index=False))


def check(label: str, got, want) -> None:
    """Print a result next to the planted number and stop if they differ."""
    ok = got == want
    print(f"  {'OK ' if ok else 'BAD'} {label:46s} found={got!s:>6}  planted={want!s:>6}")
    assert ok, f"{label}: found {got}, planted {want}"
