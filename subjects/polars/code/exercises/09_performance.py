"""Lesson 9: what makes Polars fast, measured. Timings are loose bounds (a ratio, never an exact time) and are printed.

Timing sensitive: do not run a build or a crawl at the same time.
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import polars as pl
import psutil

from plab import big_orders, run_child, workdir

d = workdir("09_perf")
N = 5_000_000
big = big_orders(N)
big.write_parquet(d / "b.parquet")
big.write_csv(d / "b.csv")


def best(f, k=3) -> float:
    t = []
    for _ in range(k):
        s = time.perf_counter()
        f()
        t.append(time.perf_counter() - s)
    return min(t)


# ---- 1. Polars and pandas on the same group-by (5,000,000 rows, 2 keys, one multiplication) ----
pdf = big.to_pandas()
t_pl = best(lambda: big.group_by("product", "region").agg((pl.col("qty") * pl.col("price")).sum().alias("t")))
t_pd = best(lambda: pdf.assign(t=pdf.qty * pdf.price).groupby(["product", "region"])["t"].sum())
print(f"group_by: polars {t_pl*1000:.0f} ms, pandas {t_pd*1000:.0f} ms, ratio {t_pd/t_pl:.0f}x")
assert t_pd > 3 * t_pl
# the answers agree
a = big.group_by("product", "region").agg((pl.col("qty") * pl.col("price")).sum().alias("t")).sort("product", "region")
b = pdf.assign(t=pdf.qty * pdf.price).groupby(["product", "region"], as_index=False)["t"].sum().sort_values(["product", "region"])
assert a["t"].to_list() == b["t"].to_list()

# ---- 2. read everything then filter, or tell the reader what you need ----
def eager():
    return pl.read_parquet(d / "b.parquet").filter(pl.col("region") == "north").select("product", "qty").group_by("product").agg(pl.col("qty").sum())

def lazy():
    return pl.scan_parquet(d / "b.parquet").filter(pl.col("region") == "north").select("product", "qty").group_by("product").agg(pl.col("qty").sum()).collect()

assert eager().sort("product").equals(lazy().sort("product"))
t_e, t_l = best(eager), best(lazy)
print(f"parquet: read first {t_e*1000:.0f} ms, scan {t_l*1000:.0f} ms, ratio {t_e/t_l:.1f}x")
assert t_e > 2 * t_l

def eager_csv():
    return pl.read_csv(d / "b.csv").filter(pl.col("region") == "north").select("product", "qty").group_by("product").agg(pl.col("qty").sum())

def lazy_csv():
    return pl.scan_csv(d / "b.csv").filter(pl.col("region") == "north").select("product", "qty").group_by("product").agg(pl.col("qty").sum()).collect()

t_ce, t_cl = best(eager_csv, 2), best(lazy_csv, 2)
print(f"csv: read first {t_ce*1000:.0f} ms, scan {t_cl*1000:.0f} ms, ratio {t_ce/t_cl:.1f}x")
assert t_ce < 3 * t_cl                              # a small gain at most: every byte of a CSV still has to be parsed to find the rows

# ---- 3. threads: the same query with 1 thread, 4 threads, and the default ----
code = '''
import time, polars as pl
from plab import *
d = workdir("09_perf")
df = pl.read_parquet(d / "b.parquet")
t = time.perf_counter()
for _ in range(3):
    df.group_by("customer_id").agg((pl.col("qty") * pl.col("price")).sum())
print(pl.thread_pool_size(), round((time.perf_counter() - t) / 3, 4))
'''
res = {}
for label, env in [("1", {"POLARS_MAX_THREADS": "1"}), ("4", {"POLARS_MAX_THREADS": "4"}), ("default", None)]:
    threads, secs = run_child(code, env).split()
    res[label] = (int(threads), float(secs))
print("threads and seconds:", res)
assert res["1"][0] == 1 and res["4"][0] == 4 and res["default"][0] == pl.thread_pool_size()
assert res["1"][1] > 1.5 * res["default"][1]        # more threads, less time (the gain stops short of linear)

# ---- 4. engines give the same answer; memory on this size is about the same ----
q = pl.scan_csv(d / "b.csv").group_by("product").agg((pl.col("qty") * pl.col("price")).sum().alias("t")).sort("product")
assert q.collect(engine="streaming").equals(q.collect(engine="in-memory"))

mem = '''
import time, polars as pl, psutil
from plab import *
d = workdir("09_perf")
pl.scan_csv(d / "b.csv").group_by("product").agg((pl.col("qty") * pl.col("price")).sum()).collect(engine=ENGINE)
print(round(psutil.Process().memory_info().peak_wset / 1e6))
'''
if sys.platform == "win32":
    base = int(run_child("import psutil, polars\nprint(round(psutil.Process().memory_info().peak_wset / 1e6))"))
    inmem = int(run_child(mem.replace("ENGINE", "'in-memory'")))
    stream = int(run_child(mem.replace("ENGINE", "'streaming'")))
    print(f"peak working set MB: import only {base}, in-memory {inmem}, streaming {stream}")
    assert inmem < 2000 and stream < 2000           # this size fits in memory either way; the lesson says what that does and does not show

print("ok")
