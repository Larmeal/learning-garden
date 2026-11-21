"""Lesson 1: the first DataFrame. Columns with one dtype each, no index, and every operation returns a new frame."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import polars as pl

from plab import EXPECTED_VERSION, small_orders

assert pl.__version__ == EXPECTED_VERSION

# ---- 1. a Series is one column, with a name and one dtype ----
s = pl.Series("qty", [2, 1, 5])
assert s.dtype == pl.Int64 and s.name == "qty" and s.len() == 3
try:
    pl.Series([1, 2.5])                                   # strict: the first value says Int64, 2.5 is not an int
    raise AssertionError("expected TypeError")
except TypeError as e:
    assert "Int64" in str(e) and "2.5" in str(e)
assert pl.Series([1, 2.5], strict=False).dtype == pl.Float64
assert pl.Series(["a", None]).dtype == pl.String        # None does not change the dtype
assert pl.Series([None, None]).dtype == pl.Null         # only when everything is None
print("Series dtypes:", s.dtype, pl.Series([1, 2.5], strict=False).dtype, pl.Series(["a", None]).dtype, pl.Series([None, None]).dtype)

# ---- 2. a DataFrame is a list of Series of the same length ----
df = small_orders()
assert df.shape == (8, 7)
assert df.columns == ["order_id", "customer", "region", "product", "qty", "price", "ordered_at"]
assert [str(t) for t in df.dtypes] == ["Int64", "String", "String", "String", "Int64", "Float64", "Date"]
print(df.schema)

# every column is a Series, and there is no index: the row number is not part of the data
assert isinstance(df["qty"], pl.Series)
assert not hasattr(df, "index")
assert df.row(0) == (1, "Ann", "north", "pen", 2, 1.5, df["ordered_at"][0])
assert df.row(by_predicate=pl.col("order_id") == 4)[1] == "Cat"
assert df["qty"].to_list() == [2, 1, 5, 1, 3, 2, 4, None]

# ---- 3. nothing changes in place ----
before = df.estimated_size()
bigger = df.with_columns(total=pl.col("qty") * pl.col("price"))
assert df.columns == ["order_id", "customer", "region", "product", "qty", "price", "ordered_at"]   # unchanged
assert bigger.columns[-1] == "total" and bigger.width == 8
assert df.estimated_size() == before
print("estimated_size (bytes):", df.estimated_size())

# a column that is not changed is shared, not copied: both frames point at the same buffer
def addr(s: pl.Series) -> int:
    return s.to_arrow().buffers()[1].address     # the address of the values buffer (zero copy for a column without nulls)


assert addr(df["order_id"]) == addr(bigger["order_id"])
recomputed = df.select(pl.col("order_id") + 0)["order_id"]
assert addr(recomputed) != addr(df["order_id"])  # a computed column gets its own memory

# ---- 4. looking at a frame ----
assert df.head(2).height == 2 and df.tail(3)["order_id"].to_list() == [6, 7, 8]
assert df.glimpse(return_type="string").startswith("Rows: 8\nColumns: 7")
d = df.describe()
assert d.columns[0] == "statistic"
assert d.filter(pl.col("statistic") == "null_count")["qty"].item() == 1.0

# ---- 5. getting data out ----
assert df.select("order_id", "customer").rows()[:2] == [(1, "Ann"), (2, "Bob")]
assert df.select("order_id", "customer").to_dicts()[0] == {"order_id": 1, "customer": "Ann"}
assert df.height == len(df) == 8

print("ok")
