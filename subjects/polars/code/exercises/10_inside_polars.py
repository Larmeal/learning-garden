"""Lesson 10: inside Polars. Arrow columns (values buffer and validity bitmap), chunks, zero copy, and morsels in the streaming engine."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np
import polars as pl
import pyarrow as pa
import pyarrow.parquet as pq

from plab import big_orders, run_child, small_orders, workdir

df = small_orders()

# ---- 1. a column is a values buffer, and a validity bitmap only when there is a null ----
qty = df["qty"].to_arrow()                       # [2, 1, 5, 1, 3, 2, 4, null]
validity, values = qty.buffers()[0], qty.buffers()[1]
assert qty.type == pa.int64() and qty.null_count == 1
assert values.size >= 8 * 8                      # 8 rows x 8 bytes
assert np.frombuffer(values, dtype=np.int64, count=8)[:7].tolist() == [2, 1, 5, 1, 3, 2, 4]
assert validity.to_pybytes()[0] == 0b01111111    # one bit per row, row 8 is the 0 at the top: 127
print("validity byte:", format(validity.to_pybytes()[0], "08b"), "(bit 0 is row 1)")
assert df["order_id"].to_arrow().buffers()[0] is None   # no null in the column, so there is no bitmap at all

# the bit decides whether the value is read, not what the value bytes are
assert df["qty"].is_null().to_list() == [False] * 7 + [True]
assert df["qty"].null_count() == 1

# an Int64 column costs 8 bytes a row; the bitmap costs one bit a row
n = pl.Series(range(1_000_000))
assert n.estimated_size() == 8_000_000
withnull = pl.Series([1] * 1_000_000 + [None])
assert 125_000 <= withnull.estimated_size() - 8_000_000 < 130_000          # about 125,000 bytes for the bitmap
print("1M Int64:", n.estimated_size(), "bytes, with one null:", withnull.estimated_size())

# a small integer type is a smaller buffer
assert pl.Series([1] * 1000, dtype=pl.Int8).estimated_size() == 1000
assert pl.Series([1] * 1000, dtype=pl.Int64).estimated_size() == 8000
assert pl.Series([True] * 1000).estimated_size() == 125            # a bool is one bit

# ---- 2. strings: Arrow has two layouts, and Polars keeps the newer one inside ----
assert df["customer"].to_arrow().type == pa.large_string()         # the classic layout: offsets and bytes (a copy is made)
newest = df["customer"].to_arrow(compat_level=pl.CompatLevel.newest())
assert newest.type == pa.string_view()                             # 16-byte views into a buffer of text
offs, data = df["customer"].to_arrow().buffers()[1], df["customer"].to_arrow().buffers()[2]
assert (offs.size, data.size) == (72, 24)              # 9 offsets of 8 bytes, and 24 bytes of text for the 8 names
print("string layouts:", df["customer"].to_arrow().type, newest.type)

# ---- 3. zero copy: numpy sees the same memory when it can ----
x = pl.Series([1, 2, 3])
arr = x.to_numpy(allow_copy=False)
assert arr.tolist() == [1, 2, 3] and not arr.flags["WRITEABLE"]    # a view of Polars memory, so read only
try:
    pl.Series([1, None]).to_numpy(allow_copy=False)                 # a null needs a bitmap, numpy has none
    raise AssertionError("expected an error")
except RuntimeError as e:
    assert "copy not allowed" in str(e)

# ---- 4. chunks: a column is a list of arrays ----
assert df["order_id"].n_chunks() == 1
two = pl.concat([df, df])
assert two.n_chunks() == 2 and two["order_id"].chunk_lengths() == [8, 8]    # concat joins by pointing, it does not copy
assert two.rechunk().n_chunks() == 1                                          # rechunk copies into one buffer
assert pl.concat([df, df], rechunk=True).n_chunks() == 1

# ---- 5. categorical and enum are integers with a dictionary ----
c = pl.Series(["b", "a", "b", "c"], dtype=pl.Categorical)
assert c.to_physical().dtype == pl.UInt32
e = pl.Series(["b", "a"], dtype=pl.Enum(["a", "b", "c"]))
assert e.to_physical().to_list() == [1, 0]                                    # the position in the list you gave

# ---- 6. morsels: the streaming engine moves batches, not the whole column ----
d = workdir("10_inside")
big = big_orders(5_000_000)
big.write_parquet(d / "b.parquet")
probe = '''
import polars as pl
from plab import *
d = workdir("10_inside")
seen = []
def f(s):
    seen.append(len(s))
    return s
q = (
    pl.scan_parquet(d / "b.parquet")
    .select(pl.col("order_id").map_batches(f, is_elementwise=True, return_dtype=pl.Int64))
    .select(pl.col("order_id").sum())
)
total = q.collect(engine="ENGINE").item()
print(total, len(seen), max(seen), sum(seen))
'''
def probe_run(engine, env=None):
    t, k, mx, s = run_child(probe.replace("ENGINE", engine), env).split()
    return int(t), int(k), int(mx), int(s)

expected = 5_000_000 * 5_000_001 // 2
t, k, mx, s = probe_run("streaming")
assert t == expected and s == 5_000_000
print("streaming, default morsel size: calls", k, "largest batch", mx)
assert mx > 100_000                                    # the ideal size is 100,000 rows; a Parquet row group of 121,951 rows arrives as it is

t2, k2, mx2, s2 = probe_run("streaming", {"POLARS_IDEAL_MORSEL_SIZE": "20000"})
print("streaming, ideal morsel 20000: calls", k2, "largest batch", mx2)
assert t2 == expected and s2 == 5_000_000
assert mx2 < 25_000 and k2 > 4 * k                     # smaller morsels, many more calls

t3, k3, mx3, s3 = probe_run("in-memory")
print("in-memory: calls", k3, "largest batch", mx3)
assert t3 == expected and k3 == 41 and mx3 > 100_000   # one call per chunk, and each of the 41 Parquet row groups was read as one chunk
assert pq.ParquetFile(d / "b.parquet").metadata.num_row_groups == 41

# ---- 7. the data of the columnar lab and the morsel lab (python exercises/10_inside_polars.py --write) ----
if "--write" in sys.argv:
    import json

    cols = {}
    for name in df.columns:
        s = df[name]
        a = s.to_arrow()
        vb = a.buffers()[0]
        bits = None if vb is None else format(vb.to_pybytes()[0], "08b")[::-1]   # bit 0 first = row 1 first
        cols[name] = {
            "dtype": str(s.dtype),
            "values": [None if v is None else str(v) for v in s.to_list()],
            "validity": bits,
            "null_count": s.null_count(),
        }
    morsel = {
        "rows": 5_000_000,
        "streaming": {"calls": k, "largest": mx},
        "streaming_20000": {"calls": k2, "largest": mx2},
        "in_memory": {"calls": k3, "largest": mx3},
        "ideal": 100_000,
    }
    lab = Path(__file__).resolve().parents[4] / "site" / "src" / "components" / "labs" / "polars"
    (lab / "columnar.json").write_text(json.dumps({"columns": cols, "order": df.columns}, ensure_ascii=False, indent=1), encoding="utf-8")
    (lab / "morsel.json").write_text(json.dumps(morsel, indent=1), encoding="utf-8")
    print("wrote", lab)

print("ok")
