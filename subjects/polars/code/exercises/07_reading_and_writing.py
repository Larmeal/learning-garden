"""Lesson 7: reading and writing. CSV schema inference, Parquet statistics and row groups, hive folders, scan, sink, glob."""

import io
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import polars as pl
import pyarrow.parquet as pq

from plab import big_orders, small_orders, workdir

d = workdir("07_io")
df = small_orders()

# ---- 1. CSV: a file has no types, so Polars guesses ----
df.write_csv(d / "s.csv")
text = (d / "s.csv").read_text()
assert text.splitlines()[0] == "order_id,customer,region,product,qty,price,ordered_at"
assert text.splitlines()[7] == "7,Dan,,ink,4,8.0,2026-01-09"      # a null is an empty field
back = pl.read_csv(d / "s.csv")
assert back.schema["qty"] == pl.Int64 and back.schema["price"] == pl.Float64
assert back.schema["ordered_at"] == pl.String                     # dates stay text unless you ask
assert pl.read_csv(d / "s.csv", try_parse_dates=True).schema["ordered_at"] == pl.Date
assert pl.read_csv(d / "s.csv", schema_overrides={"ordered_at": pl.Date}).schema["ordered_at"] == pl.Date
assert back["region"].null_count() == 1 and back["qty"].null_count() == 1   # an empty field is null again

# the guess looks at the first rows only
late = "a\n1\n2\nx\n"
try:
    pl.read_csv(io.StringIO(late), infer_schema_length=2)
    raise AssertionError("expected an error")
except pl.exceptions.ComputeError as e:
    assert "could not parse `x` as dtype `i64`" in str(e)
assert pl.read_csv(io.StringIO(late), infer_schema=False).schema["a"] == pl.String      # every column text
assert pl.read_csv(io.StringIO(late)).schema["a"] == pl.String                           # the default looks at 100 rows, so it saw x
na = pl.read_csv(io.StringIO("a,b\n1,\n2,NA\n"), null_values=["NA"])
assert na["b"].null_count() == 2

# ---- 2. Parquet: types, statistics and row groups are in the file ----
df.write_parquet(d / "s.parquet")
assert pl.read_parquet_schema(d / "s.parquet") == df.schema        # the schema comes back without guessing
md = pq.ParquetFile(d / "s.parquet").metadata
qty = md.row_group(0).column(4).statistics
assert (qty.min, qty.max, qty.null_count) == (1, 5, 1)             # min, max and null count of a column, per row group

big = big_orders(1_000_000)
big.write_csv(d / "b.csv")
big.write_parquet(d / "b.parquet")
big.write_parquet(d / "b_plain.parquet", compression="uncompressed")
big.write_ipc(d / "b.arrow")
size = {f: os.path.getsize(d / f) for f in ["b.csv", "b.parquet", "b_plain.parquet", "b.arrow"]}
print({k: round(v / 1e6, 1) for k, v in size.items()}, "MB")
assert size["b.parquet"] < size["b_plain.parquet"] < size["b.csv"] < size["b.arrow"]
assert size["b.csv"] > 4 * size["b.parquet"]

big.write_parquet(d / "b_rg.parquet", row_group_size=100_000)
assert pq.ParquetFile(d / "b_rg.parquet").metadata.num_row_groups == 10
assert pl.read_parquet(d / "b_rg.parquet").equals(big)             # the data is the same, only the layout differs

# a filter can skip a whole row group when its min and max rule it out
sorted_big = big.sort("order_id")
sorted_big.write_parquet(d / "b_sorted.parquet", row_group_size=100_000)
stats = pq.ParquetFile(d / "b_sorted.parquet").metadata
assert [stats.row_group(i).column(0).statistics.min for i in range(3)] == [1, 100_001, 200_001]
assert [stats.row_group(i).column(0).statistics.max for i in range(3)] == [100_000, 200_000, 300_000]

# the same rows in a random order: every row group now holds small and large ids together, so the statistics rule nothing out
shuffled = big.sample(fraction=1.0, shuffle=True, seed=3)
shuffled.write_parquet(d / "b_shuffled.parquet", row_group_size=100_000)
sm = pq.ParquetFile(d / "b_shuffled.parquet").metadata
spans = [(sm.row_group(i).column(0).statistics.min, sm.row_group(i).column(0).statistics.max) for i in range(10)]
assert all(lo < 2_000 and hi > 998_000 for lo, hi in spans)      # every group spans nearly the whole range of order_id

# ---- 3. scan, and a folder written by partition ----
import shutil
shutil.rmtree(d / "hive", ignore_errors=True)
big.write_parquet(d / "hive", partition_by="region")
names = sorted(p.name for p in (d / "hive").iterdir())
assert names == ["region=east", "region=north", "region=south", "region=west"]
plan = pl.scan_parquet(d / "hive").filter(pl.col("region") == "north").explain()
assert plan.count("Parquet SCAN") == 1 and "region=north" in plan   # the other three folders are not even opened
assert "PROJECT 6/7 COLUMNS" in plan                                # region lives in the folder name, not in the file
assert pl.scan_parquet(d / "hive").select(pl.len()).collect().item() == 1_000_000

# ---- 4. sink: write the result of a query without holding it ----
pl.scan_csv(d / "b.csv").filter(pl.col("qty") > 8).sink_parquet(d / "sink.parquet")
assert pl.read_parquet(d / "sink.parquet").height == big.filter(pl.col("qty") > 8).height == 111_408

# ---- 5. many files, one scan ----
big.head(10).write_csv(d / "p1.csv")
big.tail(10).write_csv(d / "p2.csv")
both = pl.scan_csv(d / "p*.csv", include_file_paths="path").collect()
assert both.height == 20 and both["path"].n_unique() == 2

# ---- 6. other formats ----
df.write_ndjson(d / "s.ndjson")
assert pl.read_ndjson(d / "s.ndjson").height == 8
df.write_ipc(d / "s.arrow")
assert pl.read_ipc(d / "s.arrow").equals(df)

# ---- 7. the data of the row group lab (python exercises/07_reading_and_writing.py --write) ----
if "--write" in sys.argv:
    import json

    def groups(path: Path) -> list[list[int]]:
        md = pq.ParquetFile(path).metadata
        return [[md.row_group(i).column(0).statistics.min, md.row_group(i).column(0).statistics.max] for i in range(md.num_row_groups)]

    payload = {
        "sorted": groups(d / "b_sorted.parquet"),
        "unsorted": groups(d / "b_shuffled.parquet"),
        "rows": 1_000_000,
        "group_size": 100_000,
    }
    assert len(payload["sorted"]) == len(payload["unsorted"]) == 10
    dest = Path(__file__).resolve().parents[4] / "site" / "src" / "components" / "labs" / "polars" / "rowgroups.json"
    dest.write_text(json.dumps(payload, indent=1), encoding="utf-8")
    print("wrote", dest)

print("ok")
