"""Lesson 2: expressions. An expression describes a computation, and a context (select, with_columns, filter, group_by) runs it."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import polars as pl
import polars.selectors as cs

from plab import small_orders

df = small_orders()

# ---- 1. an expression is a value that has not run ----
total = pl.col("qty") * pl.col("price")
assert isinstance(total, pl.Expr)
print("repr:", total)
assert str(total) == '[(col("qty")) * (col("price"))]'
assert total.meta.root_names() == ["qty", "price"]      # the columns it reads
assert total.meta.output_name() == "qty"                 # a result is named after its first column unless you alias it

# ---- 2. the same expression, in four contexts ----
sel = df.select(total.alias("total"))
assert sel.columns == ["total"] and sel.height == 8      # select keeps only what you ask for
assert sel["total"].to_list() == [3.0, 8.0, 7.5, 12.0, 4.5, 24.0, 32.0, None]   # null in, null out

wc = df.with_columns(total.alias("total"))
assert wc.width == 8 and wc.columns[-1] == "total"       # with_columns keeps the others and adds

fl = df.filter(total > 10)
assert fl["order_id"].to_list() == [4, 6, 7]             # a null is not > 10, so row 8 is dropped

gb = df.group_by("customer", maintain_order=True).agg(total.sum().alias("spent"))
assert gb.to_dicts() == [
    {"customer": "Ann", "spent": 34.5},
    {"customer": "Bob", "spent": 12.5},
    {"customer": "Cat", "spent": 12.0},
    {"customer": "Dan", "spent": 32.0},
]
print(gb)

# ---- 3. the length of a result: a column keeps it, a scalar is broadcast ----
mix = df.select("order_id", pl.col("qty").sum().alias("all_qty"))
assert mix["all_qty"].to_list() == [18] * 8              # 2+1+5+1+3+2+4 = 18, null skipped
try:
    df.select(pl.col("order_id").head(3), pl.col("customer"))   # lengths 3 and 8
    raise AssertionError("expected an error")
except pl.exceptions.ShapeError as e:
    assert "3" in str(e) and "8" in str(e)

# ---- 4. expressions in one call do not see each other ----
try:
    df.with_columns(total=total, doubled=pl.col("total") * 2)
    raise AssertionError("expected ColumnNotFoundError")
except pl.exceptions.ColumnNotFoundError as e:
    assert "total" in str(e)
two = df.with_columns(total=total).with_columns(doubled=pl.col("total") * 2)   # two calls: the second sees the first
assert two["doubled"][0] == 6.0

# ---- 5. when / then / otherwise ----
size = (
    pl.when(pl.col("qty").is_null()).then(pl.lit("unknown"))
    .when(pl.col("qty") >= 4).then(pl.lit("big"))
    .otherwise(pl.lit("small"))
    .alias("size")
)
assert df.select(size)["size"].to_list() == ["small", "small", "big", "small", "small", "small", "big", "unknown"]

# the order of the branches matters: a null condition is not true, so it falls through to the next branch
wrong = pl.when(pl.col("qty") >= 4).then(pl.lit("big")).otherwise(pl.lit("small"))
assert df.select(wrong.alias("s"))["s"].to_list()[7] == "small"          # the null qty is called small

# ---- 6. several columns at once ----
assert df.select(pl.col("qty", "price").max()).row(0) == (5, 12.0)
assert df.select(pl.all().exclude("ordered_at").null_count()).row(0) == (0, 0, 1, 0, 1, 0)
assert df.select(cs.numeric()).columns == ["order_id", "qty", "price"]
assert df.select(cs.string() & ~cs.by_name("region")).columns == ["customer", "product"]
assert df.select((cs.numeric() * 2).name.suffix("_x2")).columns == ["order_id_x2", "qty_x2", "price_x2"]

# ---- 7. the result of a method is a new expression, so they chain ----
shout = pl.col("customer").str.to_uppercase().str.slice(0, 2)
assert df.select(shout.alias("c"))["c"].to_list()[:3] == ["AN", "BO", "AN"]

print("ok")
