"""Lesson 12 (capstone): a messy CSV goes through one lazy pipeline: read as text, clean, check, join, aggregate, write.

The defects are planted in fixed numbers, and the pipeline has to find exactly those.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np
import polars as pl

from plab import PRICES, PRODUCTS, REGIONS, workdir

d = workdir("12_capstone")
N = 100_000
rng = np.random.default_rng(12)

# ---- 1. make the messy file ----
pidx = rng.integers(0, len(PRODUCTS), N)
day = rng.integers(0, 84, N)                      # 3 months of 28 days, so every generated date exists
raw = pl.DataFrame(
    {
        "order_id": np.arange(1, N + 1).astype(str),
        "customer_id": rng.integers(1, 2_001, N).astype(str),
        "region": np.array(REGIONS)[rng.integers(0, 4, N)],
        "product": np.array(PRODUCTS)[pidx],
        "qty": rng.integers(1, 10, N).astype(str),
        "price": np.array(PRICES)[pidx].astype(str),
        "ordered_at": [f"2026-{1 + x // 28:02d}-{1 + x % 28:02d}" for x in day],
    }
)
# plant the defects at fixed row numbers
i = pl.col("i")
raw = (
    raw.with_row_index("i")
    .with_columns(pl.when(i < 500).then(pl.lit("-1")).otherwise(pl.col("qty")).alias("qty"))                       # 500 negative quantities
    .with_columns(pl.when(i.is_between(500, 749)).then(pl.lit("many")).otherwise(pl.col("qty")).alias("qty"))      # 250 quantities that are not numbers
    .with_columns(pl.when(i.is_between(1000, 1299)).then(pl.lit("  ") + pl.col("region").str.to_uppercase() + pl.lit(" ")).otherwise(pl.col("region")).alias("region"))   # 300 regions with spaces and capitals
    .with_columns(pl.when(i.is_between(2000, 2199)).then(pl.lit("31/02/2026")).otherwise(pl.col("ordered_at")).alias("ordered_at"))   # 200 dates that do not exist
    .with_columns(pl.when(i.is_between(3000, 3099)).then(pl.lit("gizmo")).otherwise(pl.col("product")).alias("product"))   # 100 unknown products
    .drop("i")
)
dupes = raw.slice(5000, 150)                                                      # 150 rows repeated
raw = pl.concat([raw, dupes])
raw.write_csv(d / "orders.csv")
customers = pl.DataFrame({"customer_id": np.arange(1, 1_801), "tier": np.where(np.arange(1, 1_801) % 3 == 0, "gold", "silver")})
customers.write_parquet(d / "customers.parquet")   # 1,800 customers: ids 1801 to 2000 are missing from this table
assert raw.height == N + 150

# ---- 2. one lazy pipeline ----
src = pl.scan_csv(d / "orders.csv", infer_schema=False)        # every column is text, so nothing is guessed
typed = src.select(
    pl.col("order_id").cast(pl.Int64),
    pl.col("customer_id").cast(pl.Int64),
    pl.col("region").str.strip_chars().str.to_lowercase(),
    pl.col("product"),
    pl.col("qty").cast(pl.Int64, strict=False),
    pl.col("price").cast(pl.Float64),
    pl.col("ordered_at").str.to_date("%Y-%m-%d", strict=False),
)

# ---- 3. check before you clean ----
checks = typed.select(
    rows=pl.len(),
    duplicate_ids=pl.len() - pl.col("order_id").n_unique(),
    qty_not_a_number=pl.col("qty").is_null().sum(),
    qty_not_positive=(pl.col("qty") <= 0).sum(),
    bad_date=pl.col("ordered_at").is_null().sum(),
    unknown_product=(~pl.col("product").is_in(PRODUCTS)).sum(),
    dirty_region=(~pl.col("region").is_in(REGIONS)).sum(),
).collect().row(0, named=True)
print(checks)
assert checks == {
    "rows": 100_150,
    "duplicate_ids": 150,
    "qty_not_a_number": 250,
    "qty_not_positive": 500,
    "bad_date": 200,
    "unknown_product": 100,
    "dirty_region": 0,                      # the strip and lowercase in step 2 already fixed the 300 dirty regions
}
raw_regions = src.select(pl.col("region").is_in(REGIONS).not_().sum()).collect().item()
assert raw_regions == 300                   # the same check on the raw text finds them

# ---- 4. clean ----
clean = (
    typed.unique(subset="order_id", keep="first", maintain_order=True)
    .filter(pl.col("qty") > 0, pl.col("ordered_at").is_not_null(), pl.col("product").is_in(PRODUCTS))
    .with_columns(revenue=pl.col("qty") * pl.col("price"))
)
kept = clean.select(pl.len()).collect().item()
# 100,000 unique rows minus 500 + 250 + 200 + 100 planted bad rows (the sets do not overlap)
assert kept == 100_000 - 500 - 250 - 200 - 100 == 98_950

# ---- 5. join and aggregate ----
report = (
    clean.join(customers.lazy(), on="customer_id", how="left")
    .with_columns(pl.col("tier").fill_null("unknown"))
    .group_by("tier")
    .agg(pl.len().alias("orders"), pl.col("revenue").sum().round(2).alias("revenue"))
    .sort("tier")
)
res = report.collect()
print(res)
assert res["tier"].to_list() == ["gold", "silver", "unknown"]
assert res["orders"].sum() == kept
assert res.filter(pl.col("tier") == "unknown")["orders"].item() > 0     # the 200 customers missing from the table still have orders
total_revenue = clean.select(pl.col("revenue").sum()).collect().item()
assert abs(res["revenue"].sum() - total_revenue) < 1                    # the three tiers add up to the whole

monthly = (
    clean.group_by(pl.col("ordered_at").dt.month().alias("month")).agg(pl.col("revenue").sum()).sort("month")
)
assert monthly.collect()["month"].to_list() == [1, 2, 3]
top = (
    clean.group_by("customer_id").agg(pl.col("revenue").sum())
    .with_columns(rank=pl.col("revenue").rank("dense", descending=True))
    .filter(pl.col("rank") <= 3)
    .sort("rank")
)
assert top.collect().height == 3

# ---- 6. the plan reads only what it needs, then writes ----
plan = clean.join(customers.lazy(), on="customer_id", how="left").group_by("tier").agg(pl.col("revenue").sum()).explain()
import re

read = int(re.search(r"Csv SCAN.*?PROJECT (\d)/7 COLUMNS", plan, re.S).group(1))
assert read < 7                              # the scan reads fewer than the 7 columns of the file
print("columns read from the CSV:", read, "of 7")
clean.sink_parquet(d / "clean.parquet")
out = pl.read_parquet(d / "clean.parquet")
assert out.height == 98_950 and out.schema["ordered_at"] == pl.Date and out.schema["qty"] == pl.Int64

print("ok")
