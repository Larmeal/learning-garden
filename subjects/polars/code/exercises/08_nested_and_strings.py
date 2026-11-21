"""Lesson 8: list and struct columns, explode, string and regex expressions, and the cost of map_elements."""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import polars as pl

from plab import big_orders, small_orders

df = small_orders().with_columns(total=pl.col("qty") * pl.col("price"))

# ---- 1. a list column: one cell holds many values ----
per = df.group_by("customer", maintain_order=True).agg(pl.col("product"), pl.col("qty"))
assert per.schema["product"] == pl.List(pl.String)
assert per.row(0) == ("Ann", ["pen", "pen", "book"], [2, 5, 2])
l = per.select(
    "customer",
    n=pl.col("product").list.len(),
    kinds=pl.col("product").list.n_unique(),
    biggest=pl.col("qty").list.max(),
    first=pl.col("product").list.first(),
    has_book=pl.col("product").list.contains("book"),
)
assert l.row(0) == ("Ann", 3, 2, 5, "pen", True)
assert per.select(s=pl.col("qty").list.sum())["s"].to_list() == [9, 4, 1, 4]
# list.eval runs an expression on the elements of each list
dbl = per.select(d=pl.col("qty").list.eval(pl.element() * 2))["d"].to_list()
assert dbl[0] == [4, 10, 4]

# explode turns each element into its own row
ex = per.explode("product", "qty")
assert ex.height == 8 and ex.columns == ["customer", "product", "qty"]
assert per.select("customer", "product").explode("product").height == 8
# an empty list has no element, so its row disappears; a null list keeps one row (both are options of explode)
e = pl.DataFrame({"k": [1, 2, 3], "v": [[1, 2], [], None]})
assert e.explode("v").rows() == [(1, 1), (1, 2), (3, None)]
assert e.explode("v", empty_as_null=True).rows() == [(1, 1), (1, 2), (2, None), (3, None)]
assert e.explode("v", keep_nulls=False).rows() == [(1, 1), (1, 2)]

# ---- 2. a struct column: named fields in one cell ----
s = df.select("order_id", item=pl.struct("product", "qty"))
assert s.schema["item"] == pl.Struct({"product": pl.String, "qty": pl.Int64})
assert s["item"][0] == {"product": "pen", "qty": 2}
assert s.select(p=pl.col("item").struct.field("product"))["p"][1] == "ink"
assert s.unnest("item").columns == ["order_id", "product", "qty"]
# value_counts gives a struct column in a Series, and a frame with a count column
vc = df["product"].value_counts(sort=True)
assert vc.columns == ["product", "count"] and vc.row(0) == ("pen", 4)

# ---- 3. strings ----
names = pl.DataFrame({"s": ["  Ann Lee ", "bob_smith", "Cat-Doe", None]})
assert names.select(pl.col("s").str.strip_chars())["s"].to_list()[0] == "Ann Lee"
assert names.select(pl.col("s").str.to_lowercase())["s"].to_list()[2] == "cat-doe"
assert names.select(pl.col("s").str.contains("_|-"))["s"].to_list() == [False, True, True, None]   # null stays null
assert names.select(pl.col("s").str.replace_all(r"[_-]", " "))["s"].to_list()[1:3] == ["bob smith", "Cat Doe"]
assert names.select(pl.col("s").str.split("_"))["s"].to_list()[1] == ["bob", "smith"]
assert names.select(pl.col("s").str.extract(r"(\w+)[_-](\w+)", 2))["s"].to_list() == [None, "smith", "Doe", None]
assert pl.DataFrame({"s": ["a1b22", "c333"]}).select(m=pl.col("s").str.extract_all(r"\d+"))["m"].to_list() == [["1", "22"], ["333"]]
assert pl.DataFrame({"s": ["a-1", "b-2"]}).select(pl.col("s").str.split_exact("-", 1).alias("p")).unnest("p").columns == ["field_0", "field_1"]
assert df.select(label=pl.format("{} x{}", pl.col("product"), pl.col("qty")))["label"].to_list()[:2] == ["pen x2", "ink x1"]
assert df.select(pl.concat_str("customer", pl.lit("@"), "region", separator="", ignore_nulls=False))["customer"].to_list()[6] is None   # one null makes the whole string null

# ---- 4. map_elements: a Python function per value is slow ----
big = big_orders(1_000_000)

t0 = time.perf_counter()
fast = big.select(label=pl.col("product").str.to_uppercase())
t_fast = time.perf_counter() - t0

sub = big.head(200_000)
import warnings

with warnings.catch_warnings():
    warnings.simplefilter("ignore")                     # the warning is shown at the end of this exercise
    t0 = time.perf_counter()
    slow = sub.select(label=pl.col("product").map_elements(lambda x: x.upper(), return_dtype=pl.String))
    t_slow = time.perf_counter() - t0
assert slow["label"].equals(fast["label"].head(200_000))
per_row_fast = t_fast / 1_000_000
per_row_slow = t_slow / 200_000
print(f"expression {per_row_fast*1e9:.0f} ns per row, map_elements {per_row_slow*1e9:.0f} ns per row")
assert per_row_slow > 3 * per_row_fast                  # a loose bound: the gap measured here is about 6 times for this cheap function

# the warning that tells you
with warnings.catch_warnings(record=True) as w:
    warnings.simplefilter("always")
    pl.DataFrame({"x": [1, 2]}).select(pl.col("x").map_elements(lambda v: v + 1, return_dtype=pl.Int64))
    assert any("Expr.map_elements is significantly slower than the native expressions API" in str(x.message) for x in w)

print("ok")
