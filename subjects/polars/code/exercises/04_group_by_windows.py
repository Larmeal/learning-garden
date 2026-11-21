"""Lesson 4: group_by, aggregation, window expressions (over), sorting and pivot."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import polars as pl

from plab import small_orders

df = small_orders().with_columns(total=pl.col("qty") * pl.col("price"))

# ---- 1. group_by + agg: one row per group ----
g = df.group_by("customer", maintain_order=True).agg(
    pl.len().alias("orders"),
    pl.col("qty").sum().alias("qty"),
    pl.col("total").sum().alias("spent"),
    pl.col("product").unique().sort().alias("products"),
)
print(g)
assert g.columns == ["customer", "orders", "qty", "spent", "products"]
assert g.row(0) == ("Ann", 3, 9, 34.5, ["book", "pen"])
assert g.row(3) == ("Dan", 1, 4, 32.0, ["ink"])

# the order of groups is not promised unless you ask for it
assert sorted(df.group_by("customer").len()["customer"].to_list()) == ["Ann", "Bob", "Cat", "Dan"]
assert df.group_by("customer", maintain_order=True).len()["customer"].to_list() == ["Ann", "Bob", "Cat", "Dan"]

# an aggregate skips nulls; len counts rows, count counts non-nulls
r = df.group_by("customer", maintain_order=True).agg(
    pl.len().alias("rows"), pl.col("qty").count().alias("qty_count"), pl.col("qty").sum().alias("qty_sum")
)
assert r.filter(pl.col("customer") == "Cat").row(0) == ("Cat", 2, 1, 1)    # Cat has a null qty
# the sum of a group whose values are all null is 0, the mean is null
allnull = pl.DataFrame({"k": ["a", "a"], "v": [None, None]}, schema={"k": pl.String, "v": pl.Int64})
assert allnull.group_by("k").agg(pl.col("v").sum().alias("s"), pl.col("v").mean().alias("m")).row(0) == ("a", 0, None)

# group by an expression, group by two keys
by_month = df.group_by(pl.col("ordered_at").dt.month().alias("month")).agg(pl.col("total").sum())
assert by_month.row(0) == (1, 91.0)                         # 3+8+7.5+12+4.5+24+32, and the null row adds nothing
two = df.group_by("customer", "product", maintain_order=True).agg(pl.col("order_id"))
assert two.row(0) == ("Ann", "pen", [1, 3])
assert two.shape == (7, 3)

# ---- 2. a window expression: the same grouping, but the result keeps every row ----
w = df.with_columns(
    customer_total=pl.col("total").sum().over("customer"),
    share=(pl.col("total") / pl.col("total").sum().over("customer")).round(3),
    rank=pl.col("total").rank("dense", descending=True).over("customer"),
)
assert w.height == df.height                                # nothing collapsed
assert w["customer_total"].to_list() == [34.5, 12.5, 34.5, 12.0, 12.5, 34.5, 32.0, 12.0]
assert w["rank"].to_list()[:3] == [3, 1, 2]                  # Ann: 24.0 is first, 7.5 second, 3.0 third
print(w.select("order_id", "customer", "total", "customer_total", "share"))

# cumulative and neighbouring rows inside a group
c = df.sort("order_id").with_columns(
    running=pl.col("total").cum_sum().over("customer"),
    prev=pl.col("total").shift(1).over("customer"),
)
assert c.filter(pl.col("customer") == "Ann")["running"].to_list() == [3.0, 10.5, 34.5]
assert c.filter(pl.col("customer") == "Ann")["prev"].to_list() == [None, 3.0, 7.5]

# the biggest order of each customer, without a join
top = df.filter(pl.col("total") == pl.col("total").max().over("customer"))
assert sorted(top["order_id"].to_list()) == [2, 4, 6, 7]
print("top order per customer:", sorted(top["order_id"].to_list()))

# ---- 3. sort, top-k, unique ----
assert df.sort("total", descending=True, nulls_last=True)["order_id"].to_list()[:3] == [7, 6, 4]
assert df.top_k(2, by="total")["order_id"].to_list() == [7, 6]
assert df.sort("customer", "total", descending=[False, True], nulls_last=True)["order_id"].to_list()[:3] == [6, 3, 1]
assert df.unique(subset="customer", keep="first", maintain_order=True)["order_id"].to_list() == [1, 2, 4, 7]
assert df["customer"].value_counts(sort=True).row(0)[1] == 3

# ---- 4. pivot and unpivot ----
p = df.pivot(on="product", index="customer", values="qty", aggregate_function="sum").sort("customer")
print(p)
assert set(p.columns) == {"customer", "pen", "ink", "book"}
assert p.filter(pl.col("customer") == "Ann").row(0, named=True) == {"customer": "Ann", "pen": 7, "ink": 0, "book": 2}      # no ink order for Ann: sum of nothing is 0, not null
u = p.unpivot(index="customer", variable_name="product", value_name="qty").sort("customer", "product")
assert u.height == 12                                       # 4 customers x 3 products, the zeros come back as rows
assert u.filter(pl.col("customer") == "Ann")["qty"].to_list() == [2, 0, 7]   # book, ink, pen

# ---- 5. group_by_dynamic: time buckets ----
wk = df.sort("ordered_at").group_by_dynamic("ordered_at", every="1w").agg(pl.col("total").sum())
print(wk)
import datetime as dt
assert wk.rows() == [(dt.date(2025, 12, 29), 11.0), (dt.date(2026, 1, 5), 80.0), (dt.date(2026, 1, 12), 0.0)]   # weeks start on Monday

print("ok")
