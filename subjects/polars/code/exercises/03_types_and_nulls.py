"""Lesson 3: dtypes, casting and missing values. null is a missing value of any dtype, NaN is a float, and arithmetic does not check overflow."""

import datetime as dt
import math
import sys
import warnings
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import polars as pl

from plab import small_orders

df = small_orders()
nan = float("nan")

# ---- 1. casting is strict by default ----
s = pl.Series("v", ["1", "x", "3"])
try:
    s.cast(pl.Int64)
    raise AssertionError("expected an error")
except pl.exceptions.InvalidOperationError as e:
    assert "conversion from `str` to `i64` failed" in str(e) and '["x"]' in str(e)
assert s.cast(pl.Int64, strict=False).to_list() == [1, None, 3]    # the value that fails becomes null
assert pl.Series([1.9, -1.9]).cast(pl.Int64).to_list() == [1, -1]  # float to int truncates toward zero
try:
    pl.Series([300]).cast(pl.UInt8)
    raise AssertionError("expected an error")
except pl.exceptions.InvalidOperationError:
    pass                                                          # 300 does not fit in 8 bits, so the cast refuses

# ---- 2. arithmetic between dtypes ----
assert (pl.Series([1, 2]) + pl.Series([0.5, 0.5])).dtype == pl.Float64   # int and float meet at float
assert (pl.Series([1, 2]) / pl.Series([2, 2])).to_list() == [0.5, 1.0]   # / always gives a float
assert (pl.Series([5, -5]) // pl.Series([2, 2])).to_list() == [2, -3]    # // rounds down, not toward zero
try:
    pl.Series([1]) + pl.Series(["a"])
    raise AssertionError("expected an error")
except pl.exceptions.InvalidOperationError as e:
    assert "arithmetic on dtypes i64 and str is not allowed" in str(e)

# the surprise: + does not check overflow, sum() does not overflow
small = pl.Series([100, 100], dtype=pl.Int8)
assert (small + small).to_list() == [-56, -56]       # 200 wraps around in 8 bits, silently
assert small.sum() == 200                            # sum() widens to Int64 first
print("Int8 100 + 100 =", (small + small).to_list()[0], "but sum =", small.sum())

# ---- 3. null and NaN ----
f = pl.Series("f", [1.0, nan, None])
assert f.is_null().to_list() == [False, False, True]
assert f.is_nan().to_list() == [False, True, None]       # asking a null whether it is NaN gives null, not False
assert pl.Series([1.0, None, 3.0]).mean() == 2.0         # null is skipped, so 4 / 2
assert math.isnan(pl.Series([1.0, nan, 3.0]).mean())     # NaN is not skipped, it spreads
assert pl.Series([1.0, nan]).fill_nan(None).to_list() == [1.0, None]
assert pl.Series([nan]).eq(nan).to_list() == [True]      # in Polars NaN equals NaN, unlike IEEE 754 and pandas

# a comparison with a null is null, and filter keeps only True
assert df.select(pl.col("qty") > 2)["qty"].to_list() == [False, False, True, False, True, False, True, None]
assert df.filter(pl.col("qty") > 2).height == 3
assert df.filter(pl.col("qty").is_null()).height == 1
assert df.filter(pl.col("qty").ne_missing(2)).height == 6   # ne_missing treats null as a value: 8 rows minus the two 2s

# == null is null; eq_missing is the comparison that treats null as a value
assert pl.DataFrame({"a": [1, None]}).select(pl.col("a").eq_missing(None))["a"].to_list() == [False, True]
with warnings.catch_warnings(record=True) as w:
    warnings.simplefilter("always")
    pl.select(pl.lit(1) == None)  # noqa: E711
    assert any("Comparisons with None always result in null" in str(x.message) for x in w)

# ---- 4. filling and counting ----
assert pl.Series([1, None, None, 4]).fill_null(strategy="forward").to_list() == [1, 1, 1, 4]
assert pl.Series([1, None]).fill_null(0).to_list() == [1, 0]
assert df.null_count().row(0) == (0, 0, 1, 0, 1, 0, 0)    # one null in region, one in qty
assert pl.Series([None, None], dtype=pl.Int64).sum() == 0 # the sum of nothing is 0, not null
assert pl.Series([3, None, 1]).sort().to_list() == [None, 1, 3]            # nulls first by default
assert pl.Series([3, None, 1]).sort(nulls_last=True).to_list() == [1, 3, None]
assert pl.Series([3, None, 1]).max() == 3
assert pl.Series([1, None, None]).n_unique() == 2         # null counts as one distinct value
assert df.group_by("region").len().filter(pl.col("region").is_null())["len"].item() == 1   # null is its own group

# ---- 5. floats are floats ----
assert pl.Series([0.1] * 10).sum() != 1.0                 # binary floating point
d = pl.Series(["1.10", "2.20"]).cast(pl.Decimal(10, 2))
assert str(d.sum()) == "3.30"                              # Decimal keeps the cents
assert pl.Series([True, False, True]).sum() == 2           # a bool sums as 0 and 1

# ---- 6. categorical and enum ----
c = pl.Series(["a", "b", "a"], dtype=pl.Categorical)
assert c.to_physical().to_list() == [0, 1, 0]             # a number per distinct string
e = pl.Series(["a", "b"], dtype=pl.Enum(["a", "b", "c"]))
assert e.dtype == pl.Enum(["a", "b", "c"])
try:
    pl.Series(["z"], dtype=pl.Enum(["a", "b", "c"]))
    raise AssertionError("expected an error")
except pl.exceptions.InvalidOperationError as err:
    assert "not present in the categories" in str(err) or "present in the categories" in str(err)

# ---- 7. strings count characters or bytes ----
th = pl.Series(["กข", "ab"])
assert th.str.len_chars().to_list() == [2, 2]
assert th.str.len_bytes().to_list() == [6, 2]            # a Thai letter is 3 bytes in UTF-8

# ---- 8. dates ----
assert pl.Series(["2026-01-03"]).str.to_date().dtype == pl.Date
assert pl.Series(["03/01/2026"]).str.to_date("%d/%m/%Y").to_list() == [dt.date(2026, 1, 3)]
assert pl.Series(["03/01/2026"]).str.to_date().to_list() == [dt.date(2026, 1, 3)]       # no format given: it guessed day/month/year
assert df["ordered_at"].dt.weekday().to_list() == [6, 6, 1, 2, 4, 5, 5, 1]    # Monday is 1, so 2026-01-03 is a Saturday
assert df.select(pl.col("ordered_at") + pl.duration(days=7))["ordered_at"][0] == dt.date(2026, 1, 10)
assert df.select(pl.col("ordered_at").diff())["ordered_at"][2] == dt.timedelta(days=2)
bkk = pl.Series([dt.datetime(2026, 1, 1)]).dt.replace_time_zone("UTC").dt.convert_time_zone("Asia/Bangkok")
assert bkk[0].hour == 7                                  # midnight UTC is 07:00 in Bangkok

print("ok")
