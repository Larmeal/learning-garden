"""Helpers shared by the DuckDB exercises.

Every exercise runs against DuckDB 1.5.6 from Python and asserts what its lesson prints. The data is synthetic and built by DuckDB itself from `range()` and `hash()`,
so it is the same on every run and every machine, and nothing is downloaded. Files an exercise writes go to a throwaway folder under the system temp folder.
"""

import json
import shutil
import sys
import tempfile
import time
from pathlib import Path

import duckdb

HERE = Path(__file__).resolve().parent
LABS = HERE.parent.parent.parent / "site" / "src" / "components" / "labs" / "duckdb"
VERSION = "1.5.6"

COUNTRIES = ["TH", "JP", "DE", "US", "BR", "IN", "FR", "ZA"]
STATUSES = ["paid", "shipped", "cancelled", "refunded"]


def fresh_dir(label: str) -> Path:
    """An empty folder under the system temp folder, for files an exercise writes."""
    root = Path(tempfile.gettempdir()) / "duckdb-lessons" / label
    if root.exists():
        shutil.rmtree(root, ignore_errors=True)
    root.mkdir(parents=True)
    return root


def connect(path: str | Path = ":memory:", **config) -> duckdb.DuckDBPyConnection:
    """A new connection. `threads` is the only setting most exercises change."""
    return duckdb.connect(str(path), config=config)


def make_shop(con: duckdb.DuckDBPyConnection, orders: int = 1_000_000, customers: int = 5_000) -> None:
    """Create `customers` and `orders` in `con`. Every column is a function of the row number, so the table is the same on every run.

    orders.order_ts grows with order_id (one order every 31.5 seconds, a year in all), so the rows of a row group cover a narrow time range.
    status is 'paid' for about 70% of the rows, 'shipped' 20%, 'cancelled' 7% and 'refunded' 3%.
    """
    con.execute(
        f"""
        create or replace table customers as
        select i as customer_id,
               'cust_' || lpad(i::varchar, 4, '0') as name,
               (['TH','JP','DE','US','BR','IN','FR','ZA'])[1 + (hash(i) % 8)::int] as country,
               date '2023-01-01' + (hash(i * 7) % 700)::int as signup_date
        from range(1, {customers} + 1) t(i)
        """
    )
    con.execute(
        f"""
        create or replace table orders as
        select i as order_id,
               1 + hash(i * 13) % {customers} as customer_id,
               1 + hash(i * 17) % 200 as product_id,
               1 + hash(i * 19) % 5 as qty,
               (5 + hash(i * 23) % 9500) / 100.0 as unit_price,
               case when hash(i * 29) % 100 < 70 then 'paid'
                    when hash(i * 29) % 100 < 90 then 'shipped'
                    when hash(i * 29) % 100 < 97 then 'cancelled'
                    else 'refunded' end as status,
               timestamp '2025-01-01 00:00:00' + to_seconds((i - 1) * 31.5) as order_ts
        from range(1, {orders} + 1) t(i)
        """
    )


def check(label: str, ok: bool, detail: str = "") -> None:
    """Print one result line and fail loudly, because the lessons quote these results."""
    print(f"  {'ok  ' if ok else 'FAIL'} {label}" + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        sys.exit(f"FAILED: {label} {detail}")


def show(title: str, text: str = "") -> None:
    print(f"\n$ {title}" if title else "")
    if text:
        print("\n".join("  " + line for line in str(text).splitlines()))


def table(rows: list, headers: list[str]) -> str:
    cells = [[str(c) for c in r] + [""] * (len(headers) - len(r)) for r in rows]
    widths = [max(len(h), *(len(r[i]) for r in cells)) for i, h in enumerate(headers)]
    line = lambda r: "  ".join(c.ljust(w) for c, w in zip(r, widths)).rstrip()  # noqa: E731
    return "\n".join([line(headers), line(["-" * w for w in widths]), *(line(r) for r in cells)])


def timed(fn):
    t = time.perf_counter()
    value = fn()
    return value, time.perf_counter() - t


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  wrote {path.relative_to(LABS.parents[3])}")


def main_guard(fn) -> None:
    """Run an exercise and end with the `ok` line that verify.py looks for."""
    fn()
    print("\nok")
