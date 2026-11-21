"""Lesson 6: the lazy API. A LazyFrame records a plan, the optimizer rewrites it, and collect() runs it."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import polars as pl

from plab import big_orders, workdir

LAB_DIR = Path(__file__).resolve().parents[4] / "site" / "src" / "components" / "labs" / "polars"
d = workdir("06_lazy")
n = 200_000
big = big_orders(n)
big.write_csv(d / "o.csv")
big.write_parquet(d / "o.parquet")

# ---- 1. a LazyFrame is a plan, not data ----
lf = big.lazy()
assert isinstance(lf, pl.LazyFrame)
q = lf.with_columns(total=pl.col("qty") * pl.col("price")).filter(pl.col("region") == "north")
assert not hasattr(q, "shape")                      # there are no rows yet
assert isinstance(q.collect(), pl.DataFrame)
assert q.collect_schema().names()[-1] == "total"    # the schema is known without running anything
assert q.collect_schema()["total"] == pl.Float64    # qty is Int64 and price Float64, so the product is Float64

# ---- 2. what the optimizer does to a plan ----
query = (
    pl.scan_parquet(d / "o.parquet")
    .with_columns(total=pl.col("qty") * pl.col("price"))
    .filter(pl.col("region") == "north")
    .group_by("product")
    .agg(pl.col("total").sum())
    .sort("product")
)
raw = query.explain(optimized=False)
opt = query.explain()
print("--- as written ---\n" + raw + "\n--- optimized ---\n" + opt)

assert "PROJECT */7 COLUMNS" in raw                 # as written, the scan reads all 7 columns
assert "FILTER" in raw and raw.index("FILTER") < raw.index("Parquet SCAN")   # the filter sits above the scan

assert "PROJECT 4/7 COLUMNS" in opt                 # projection pushdown: product, qty, price, region are enough
assert 'SELECTION: col("region") == "north"' in opt # predicate pushdown: the filter moved into the scan

# the same plan with each optimization switched off
no_pred = query.explain(optimizations=pl.QueryOptFlags(predicate_pushdown=False))
assert "SELECTION" not in no_pred and "FILTER" in no_pred
no_proj = query.explain(optimizations=pl.QueryOptFlags(projection_pushdown=False))
assert "PROJECT */7 COLUMNS" in no_proj
none = query.explain(optimizations=pl.QueryOptFlags.none())
assert "PROJECT */7 COLUMNS" in none and "SELECTION" not in none

# the answer does not change, only the work
a = query.collect()
b = query.collect(optimizations=pl.QueryOptFlags.none())
assert a.equals(b)
assert a.height == 6

# ---- 3. a CSV scan pushes the filter and the columns too ----
cq = pl.scan_csv(d / "o.csv").select("region", "qty").filter(pl.col("qty") > 5)
ce = cq.explain()
assert "PROJECT 2/7 COLUMNS" in ce and 'SELECTION: col("qty") > 5' in ce
print(ce)

# ---- 4. the optimizer merges and reorders ----
two = big.lazy().with_columns(a=pl.col("qty") + 1).with_columns(b=pl.col("price") * 2)
assert two.explain().count("WITH_COLUMNS") == 1     # two with_columns calls become one
assert two.explain(optimizations=pl.QueryOptFlags.none()).count("WITH_COLUMNS") == 2

# the same expression used twice is computed once (common subexpression elimination)
cse = big.lazy().select((pl.col("qty") * pl.col("price")).alias("x"), (pl.col("qty") * pl.col("price") + 1).alias("y"))
assert "__POLARS_CSER" in cse.explain()
assert "__POLARS_CSER" not in cse.explain(optimizations=pl.QueryOptFlags(comm_subexpr_elim=False))

# a slice is pushed down: reading 5 rows of a file does not read the file
head = pl.scan_parquet(d / "o.parquet").head(5)
assert "SLICE: Positive { offset: 0, len: 5 }" in head.explain()
print(head.explain())

# ---- 5. which engine runs it ----
assert query.collect(engine="streaming").equals(query.collect(engine="in-memory"))
print("default engine affinity:", pl.Config.state().get("POLARS_ENGINE_AFFINITY"))

# ---- 6. removed in 2.0: profile() ----
try:
    query.profile()
    raise AssertionError("expected an error")
except pl.exceptions.AttributeRemovedError as e:
    assert "removed in version 2.0" in str(e)

# ---- 7. eager is lazy underneath ----
assert big.filter(pl.col("region") == "north").equals(big.lazy().filter(pl.col("region") == "north").collect())

# ---- 8. the data of the plan lab (python exercises/06_lazy_and_optimizer.py --write) ----
if "--write" in sys.argv:
    import json

    import tempfile

    TMP = tempfile.gettempdir().replace("\\", "/")  # the plans name the folder of the scratch file: keep the name of the user out of the lab data

    def tail(plan: str) -> list[str]:
        plan = plan.replace(TMP, "/tmp")
        lines = [ln.rstrip() for ln in plan.splitlines() if ln.strip()]
        return lines

    flags = {
        "both": pl.QueryOptFlags(),
        "no_predicate": pl.QueryOptFlags(predicate_pushdown=False),
        "no_projection": pl.QueryOptFlags(projection_pushdown=False),
        "none": pl.QueryOptFlags.none(),
    }
    out = {k: tail(query.explain(optimizations=v)) for k, v in flags.items()}
    sample = big.head(12)
    payload = {
        "plans": out,
        "as_written": tail(raw),
        "columns": sample.columns,
        "rows": [[str(v) for v in r] for r in sample.rows()],
        "n_rows": n,
    }
    dest = LAB_DIR / "plans.json"
    dest.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote", dest)

print("ok")
