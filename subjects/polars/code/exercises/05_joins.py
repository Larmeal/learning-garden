"""Lesson 5: joins (how, keys, null keys, validate, suffix), semi and anti, asof, concat."""

import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import polars as pl

from plab import small_customers, small_orders

orders = small_orders().select("order_id", "customer", "qty")
cust = small_customers()   # Ann, Bob, Cat, Eve (no Dan in the customers, no orders for Eve)

# ---- 1. the kinds of join ----
inner = orders.join(cust, on="customer", how="inner")
assert inner.height == 7 and "Dan" not in inner["customer"].to_list()       # Dan has no customer row
left = orders.join(cust, on="customer", how="left")
assert left.height == 8 and left.filter(pl.col("customer") == "Dan")["tier"].item() is None
right = orders.join(cust, on="customer", how="right")
assert right.height == 8 and "Eve" in right["customer"].to_list()      # Eve has no order, and still appears
full = orders.join(cust, on="customer", how="full")
print(full.columns)
assert full.height == 9
assert "customer_right" in full.columns                                     # a full join keeps both key columns
coalesced = orders.join(cust, on="customer", how="full", coalesce=True)
assert "customer_right" not in coalesced.columns and coalesced.height == 9
semi = orders.join(cust, on="customer", how="semi")
assert semi.columns == orders.columns and semi.height == 7                  # rows of the left that have a match, no new columns
anti = orders.join(cust, on="customer", how="anti")
assert anti["order_id"].to_list() == [7]                                    # rows of the left with no match: Dan
cross = cust.join(cust.select(pl.col("customer").alias("other")), how="cross")
assert cross.height == 16

# ---- 2. the row order of a join ----
assert left["order_id"].to_list() == [1, 2, 3, 4, 5, 6, 7, 8]               # a left join keeps the left order here
# (the documentation says order is only promised with maintain_order=; see the next line)
m = orders.join(cust, on="customer", how="left", maintain_order="left")
assert m["order_id"].to_list() == [1, 2, 3, 4, 5, 6, 7, 8]

# ---- 3. null keys do not match, unless you say so ----
a = pl.DataFrame({"k": [1, None], "x": ["a", "b"]})
b = pl.DataFrame({"k": [1, None], "y": ["c", "d"]})
assert a.join(b, on="k", how="inner").height == 1
assert a.join(b, on="k", how="inner", nulls_equal=True).height == 2

# ---- 4. a duplicate key multiplies rows ----
dup = pl.DataFrame({"customer": ["Ann", "Ann", "Bob"], "phone": ["1", "2", "3"]})
j = orders.join(dup, on="customer", how="left")
assert j.height == 11           # Ann: 3 orders x 2 phones = 6 rows, the other 5 orders stay one row each
print("rows after joining a table with a repeated key:", j.height, "from", orders.height)
try:
    orders.join(dup, on="customer", how="left", validate="m:1")
    raise AssertionError("expected an error")
except pl.exceptions.ComputeError as e:
    assert "m:1" in str(e) or "join keys" in str(e)
assert orders.join(cust, on="customer", how="left", validate="m:1").height == 8

# ---- 5. different names and clashing columns ----
c2 = cust.rename({"customer": "name", "tier": "qty"})
o = orders.join(c2, left_on="customer", right_on="name", how="left")
assert o.columns == ["order_id", "customer", "qty", "qty_right"]            # the clash gets a _right suffix
o2 = orders.join(c2, left_on="customer", right_on="name", how="left", suffix="_cust")
assert o2.columns[-1] == "qty_cust"

# ---- 6. join_where (a join on a condition) ----
t = pl.DataFrame({"lo": [0, 5], "hi": [5, 100], "band": ["small", "big"]})
bands = orders.join_where(t, pl.col("qty") >= pl.col("lo"), pl.col("qty") < pl.col("hi"))
assert bands.filter(pl.col("order_id") == 3)["band"].item() == "big"
assert bands.height == 7                                                     # the null qty matches no band

# ---- 7. asof: the nearest earlier row ----
trades = pl.DataFrame({"t": [dt.datetime(2026, 1, 1, 10, 0, 5), dt.datetime(2026, 1, 1, 10, 0, 20)], "n": [1, 2]})
quotes = pl.DataFrame({"t": [dt.datetime(2026, 1, 1, 10, 0, 0), dt.datetime(2026, 1, 1, 10, 0, 10), dt.datetime(2026, 1, 1, 10, 0, 30)], "px": [100.0, 101.0, 102.0]})
aj = trades.join_asof(quotes, on="t", strategy="backward")
assert aj["px"].to_list() == [100.0, 101.0]                                  # last quote at or before each trade
fw = trades.join_asof(quotes, on="t", strategy="forward")
assert fw["px"].to_list() == [101.0, 102.0]
nr = trades.join_asof(quotes, on="t", strategy="backward", tolerance=dt.timedelta(seconds=6))
assert nr["px"].to_list() == [100.0, None]                                   # the quote for trade 2 is 10 s old, more than the tolerance

# ---- 8. stacking: concat ----
v = pl.concat([orders.head(2), orders.tail(2)], how="vertical")
assert v.height == 4
try:
    pl.concat([orders, cust])
    raise AssertionError("expected an error")
except (pl.exceptions.SchemaError, pl.exceptions.ShapeError):
    pass                                                                     # the schemas differ, so a vertical concat refuses
d = pl.concat([orders.head(2), cust.head(2).rename({"customer": "x"})], how="diagonal")
assert d.columns == ["order_id", "customer", "qty", "x", "tier"] and d.height == 4
try:
    pl.concat([orders.head(3), cust.head(3)], how="horizontal")      # both have a column "customer"
    raise AssertionError("expected an error")
except pl.exceptions.DuplicateError:
    pass
h = pl.concat([orders.head(3), cust.head(3).rename({"customer": "c"})], how="horizontal")
assert h.shape == (3, 5)

print("ok")
