"""Shared data and helpers for the Polars exercises.

`small_orders()` is the table that the lessons print (8 rows, a few nulls planted on purpose).
`big_orders(n)` makes n synthetic orders from a fixed seed, for the exercises that measure something.
Nothing here reads a network or a real data set.
"""

from __future__ import annotations

import datetime as dt
import tempfile
from pathlib import Path

import numpy as np
import polars as pl

EXPECTED_VERSION = "2.1.0"


def small_orders() -> pl.DataFrame:
    return pl.DataFrame(
        {
            "order_id": [1, 2, 3, 4, 5, 6, 7, 8],
            "customer": ["Ann", "Bob", "Ann", "Cat", "Bob", "Ann", "Dan", "Cat"],
            "region": ["north", "south", "north", "east", "south", "north", None, "east"],
            "product": ["pen", "ink", "pen", "book", "pen", "book", "ink", "pen"],
            "qty": [2, 1, 5, 1, 3, 2, 4, None],
            "price": [1.5, 8.0, 1.5, 12.0, 1.5, 12.0, 8.0, 1.5],
            "ordered_at": [dt.date(2026, 1, d) for d in (3, 3, 5, 6, 8, 9, 9, 12)],
        }
    )


def small_customers() -> pl.DataFrame:
    return pl.DataFrame(
        {
            "customer": ["Ann", "Bob", "Cat", "Eve"],
            "tier": ["gold", "silver", "silver", "gold"],
        }
    )


REGIONS = ["north", "south", "east", "west"]
PRODUCTS = ["pen", "ink", "book", "lamp", "desk", "chair"]
PRICES = [1.5, 8.0, 12.0, 25.0, 140.0, 85.0]


def big_orders(n: int = 1_000_000, seed: int = 7) -> pl.DataFrame:
    rng = np.random.default_rng(seed)
    pidx = rng.integers(0, len(PRODUCTS), n)
    day = rng.integers(0, 365, n)
    return pl.DataFrame(
        {
            "order_id": np.arange(1, n + 1),
            "customer_id": rng.integers(1, 20_001, n),
            "region": np.array(REGIONS)[rng.integers(0, len(REGIONS), n)],
            "product": np.array(PRODUCTS)[pidx],
            "qty": rng.integers(1, 10, n),
            "price": np.array(PRICES)[pidx],
            "day": day,
        }
    ).with_columns(ordered_at=pl.date(2026, 1, 1) + pl.duration(days=pl.col("day"))).drop("day")


def workdir(name: str) -> Path:
    d = Path(tempfile.gettempdir()) / "polars-lab" / name
    d.mkdir(parents=True, exist_ok=True)
    return d


def run_child(code: str, env: dict[str, str] | None = None) -> str:
    """Run a snippet in a fresh Python (so thread counts and peak memory are its own) and return its last stdout line."""
    import os
    import subprocess
    import sys

    here = str(Path(__file__).resolve().parent)
    full = f"import sys; sys.path.insert(0, {here!r})\n" + code
    done = subprocess.run(
        [sys.executable, "-c", full], capture_output=True, text=True, encoding="utf-8", env={**os.environ, **(env or {})}
    )
    if done.returncode != 0:
        raise RuntimeError(done.stderr[-800:])
    return done.stdout.strip().splitlines()[-1]
