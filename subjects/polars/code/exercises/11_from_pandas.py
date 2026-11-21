"""Lesson 11: coming from pandas. The same questions asked both ways, and what Polars refuses to do."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd
import polars as pl

from plab import small_customers, small_orders

pl_df = small_orders()
pd_df = pl_df.to_pandas()

# ---- 1. no index ----
assert list(pd_df.index) == list(range(8))
assert not hasattr(pl_df, "index")
assert pd_df.set_index("order_id").loc[3, "customer"] == "Ann"          # pandas: label lookup
assert pl_df.filter(pl.col("order_id") == 3)["customer"].item() == "Ann"  # Polars: a filter on a column
# after a filter, pandas keeps the old labels and Polars does not have any
assert list(pd_df[pd_df.qty > 2].index) == [2, 4, 6]
assert pl_df.filter(pl.col("qty") > 2).height == 3

# ---- 2. no assignment into a frame ----
try:
    pl_df["total"] = pl_df["qty"] * pl_df["price"]
    raise AssertionError("expected an error")
except TypeError as e:
    assert "does not support item assignment" in str(e) or "assignment" in str(e)
pd_df["total"] = pd_df.qty * pd_df.price                                  # pandas: changes pd_df
assert "total" in pd_df.columns
pl_total = pl_df.with_columns(total=pl.col("qty") * pl.col("price"))      # Polars: a new frame
assert "total" not in pl_df.columns

# ---- 3. the same questions ----
# a filter
assert pd_df[(pd_df.region == "north") & (pd_df.qty > 1)].order_id.tolist() == [1, 3, 6]
assert pl_df.filter((pl.col("region") == "north") & (pl.col("qty") > 1))["order_id"].to_list() == [1, 3, 6]
# a missing value in a comparison: pandas gives False, Polars gives null (and filter drops it)
assert (pd_df.region == "north").tolist()[6] == False  # noqa: E712
assert pl_df.select(pl.col("region") == "north")["region"].to_list()[6] is None
# group by
g_pd = pd_df.groupby("customer")["total"].sum().to_dict()
g_pl = dict(pl_total.group_by("customer").agg(pl.col("total").sum()).iter_rows())
assert g_pd == g_pl == {"Ann": 34.5, "Bob": 12.5, "Cat": 12.0, "Dan": 32.0}
# transform is over
t_pd = pd_df.groupby("customer")["total"].transform("sum").tolist()
t_pl = pl_total.select(pl.col("total").sum().over("customer"))["total"].to_list()
assert t_pd == t_pl == [34.5, 12.5, 34.5, 12.0, 12.5, 34.5, 32.0, 12.0]
# merge is join
m_pd = pd_df.merge(small_customers().to_pandas(), on="customer", how="left")
m_pl = pl_df.join(small_customers(), on="customer", how="left")
assert m_pl["tier"].null_count() == 1 and m_pd.tier.isna().sum() == 1

# ---- 4. missing values ----
assert pd_df.qty.dtype == "float64"                                       # one missing value turned the pandas ints into floats
assert pl_df["qty"].dtype == pl.Int64                                     # Polars keeps the integer
assert pd_df.region.isna().tolist()[6]
assert pd.isna(pd_df.qty).sum() == pl_df["qty"].null_count() == 1
# the pandas result of mean on a column with missing values skips them too
assert pd_df.qty.mean() == pl_df["qty"].mean()

# ---- 5. row by row loops ----
total_loop = 0.0
for row in pl_df.iter_rows(named=True):
    if row["qty"] is not None:
        total_loop += row["qty"] * row["price"]
assert total_loop == pl_df.select((pl.col("qty") * pl.col("price")).sum()).item() == 91.0
assert pl_df.iter_rows(named=True).__next__()["customer"] == "Ann"

# ---- 6. moving between the two ----
back = pl.from_pandas(pd_df.drop(columns="total"))
assert back.schema["qty"] == pl.Float64 and back["qty"].null_count() == 1   # the NaN pandas used for missing: turned into null
assert back.schema["region"] == pl.String
nan_frame = pl.from_pandas(pd.DataFrame({"a": [1.0, float("nan")]}))
assert nan_frame["a"].null_count() == 1                                     # from_pandas turns NaN into null by default
kept = pl.from_pandas(pd.DataFrame({"a": [1.0, float("nan")]}), nan_to_null=False)
assert kept["a"].null_count() == 0 and kept["a"].is_nan().sum() == 1
to_pd = pl_df.to_pandas()
assert to_pd.qty.isna().sum() == 1 and to_pd.qty.dtype == "float64"       # pandas turns the ints back into floats
assert pl_df.to_pandas(use_pyarrow_extension_array=True).qty.dtype == "int64[pyarrow]"   # keeps the ints and the nulls

# ---- 7. a pandas-style call that Polars answers with an error ----
assert pl_df[0, "qty"] == 2                                                 # a row and a column does work
assert pl_df["qty"][0] == 2
try:
    pl_df.groupby("customer")                                                # the pandas name
    raise AssertionError("expected an error")
except AttributeError as e:
    assert "no attribute 'groupby'" in str(e)                                # the message does not tell you the Polars name
assert not hasattr(pl_df, "apply") and not hasattr(pl_df, "iterrows") and not hasattr(pl_df, "iloc")

print("ok")
