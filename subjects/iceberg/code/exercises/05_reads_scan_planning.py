"""Lesson 5: reading. How a query skips manifests and files, and how to look at the table from Spark and PyIceberg.

    uv run python exercises/05_reads_scan_planning.py       (on Windows this re-launches itself in WSL, see run_wsl.sh)

Builds a table of 8 data files (4 days, 2 files a day, ids sorted inside a day) and asserts how many files a scan plans
for a partition filter, for a filter that only column statistics can use, and for a filter that nothing can use. Then it checks the
metadata tables of Spark and `table.inspect` of PyIceberg against each other.
"""

import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import pyarrow as pa  # noqa: E402

from lab import fresh_root, get_spark, pyiceberg_catalog, relaunch_in_wsl_if_windows, show  # noqa: E402

relaunch_in_wsl_if_windows(__file__)


def main():
    root = fresh_root("05_reads_scan_planning")
    spark = get_spark(root)
    spark.sql("CREATE NAMESPACE lab.db")
    spark.sql(
        "CREATE TABLE lab.db.orders (order_id bigint, customer string, amount double, ordered_at timestamp) "
        "USING iceberg PARTITIONED BY (days(ordered_at))"
    )
    # 4 days, 2 INSERTs a day, each INSERT writes one file with 5 rows: ids are 1..5 (morning), 6..10 (evening) of day 1, then 11..20 of day 2 ...
    n = 0
    for day in range(1, 5):
        for half in range(2):
            vals = []
            for _ in range(5):
                n += 1
                vals.append(f"({n}, '{'cu' + str(n % 3)}', {n * 10.0}, TIMESTAMP'2026-01-0{day} {8 + half * 8}:00:00')")
            spark.sql("INSERT INTO lab.db.orders VALUES " + ",".join(vals))
    assert n == 40

    cat = pyiceberg_catalog(root)
    t = cat.load_table("db.orders")

    def planned(flt=None):
        sc = t.scan(row_filter=flt) if flt else t.scan()
        return len(list(sc.plan_files()))

    # ---- 1. how many files does a scan plan --------------------------------------------------------------
    result = {
        "no filter": planned(),
        "one day (partition)": planned("ordered_at >= '2026-01-02T00:00:00+00:00' and ordered_at < '2026-01-03T00:00:00+00:00'"),
        "order_id = 7 (min/max)": planned("order_id = 7"),
        "order_id > 35 (min/max)": planned("order_id > 35"),
        "customer = 'cu1' (no help)": planned("customer = 'cu1'"),
        "amount < 0 (nothing matches)": planned("amount < 0"),
    }
    for k, v in result.items():
        print(f"{k:32s} {v} of 8 files")
    assert result == {
        "no filter": 8,
        "one day (partition)": 2,
        "order_id = 7 (min/max)": 1,
        "order_id > 35 (min/max)": 1,
        "customer = 'cu1' (no help)": 8,
        "amount < 0 (nothing matches)": 0,
    }

    # PyIceberg's plan only prunes by files; the rows come back exact because the filter is applied again after reading
    rows = t.scan(row_filter="order_id = 7", selected_fields=("order_id", "customer")).to_arrow().to_pylist()
    assert rows == [{"order_id": 7, "customer": "cu1"}]

    # ---- 2. the same pruning in Spark: the scan node of the plan lists the pushed-down filter ----------------
    plan = spark.sql("SELECT * FROM lab.db.orders WHERE order_id = 7")._jdf.queryExecution().executedPlan().toString()
    scan_lines = [ln.strip() for ln in plan.splitlines() if "BatchScan" in ln]
    print("Spark scan node:", scan_lines[0][:200])
    assert scan_lines and "order_id" in scan_lines[0]
    assert spark.sql("SELECT * FROM lab.db.orders WHERE order_id = 7").count() == 1

    # ---- 3. the metadata tables of Spark and table.inspect of PyIceberg tell the same story --------------------
    files = spark.sql("SELECT file_path, record_count, partition FROM lab.db.orders.files")
    assert files.count() == 8 and sum(r.record_count for r in files.collect()) == 40
    insp = t.inspect.files().to_pylist()
    assert len(insp) == 8 and {r["file_path"] for r in insp} == {r.file_path for r in files.collect()}
    snaps = t.inspect.snapshots().to_pylist()
    assert len(snaps) == 8 and snaps[-1]["operation"] == "append"
    parts = spark.sql("SELECT partition, record_count, file_count FROM lab.db.orders.partitions ORDER BY partition")
    show(parts)
    assert [(r.record_count, r.file_count) for r in parts.collect()] == [(10, 2)] * 4
    man = t.inspect.manifests().to_pylist()
    print("manifests:", len(man), "| partition summary of the first:", man[0]["partition_summaries"])
    assert len(man) == 8
    # the manifest list already says which days each manifest holds, so a one-day query can skip 6 of the 8 manifests unopened
    day2 = "2026-01-02"
    overlapping = [m for m in man if m["partition_summaries"][0]["lower_bound"] <= day2 <= m["partition_summaries"][0]["upper_bound"]]
    print("manifests that can hold", day2, ":", len(overlapping), "of", len(man))
    assert len(overlapping) == 2

    # Spark can ask for the readable column statistics of the files too
    stats = spark.sql(
        "SELECT readable_metrics.order_id.lower_bound AS lo, readable_metrics.order_id.upper_bound AS hi "
        "FROM lab.db.orders.files ORDER BY lo"
    )
    show(stats)
    bounds = [(r.lo, r.hi) for r in stats.collect()]
    assert bounds[0] == (1, 5) and bounds[-1] == (36, 40)

    # ---- 4. projection: only the columns asked for are read ------------------------------------------------
    narrow = t.scan(selected_fields=("order_id",)).to_arrow()
    assert narrow.column_names == ["order_id"] and narrow.num_rows == 40

    # ---- 5. a data file is a plain Parquet file: any Parquet reader opens it ------------------------------------
    import pyarrow.parquet as pq

    one = insp[0]["file_path"].replace("file://", "").replace("file:", "")
    assert pq.read_table(one).num_rows == 5

    # ---- 6. PyIceberg hands the result to other libraries ----------------------------------------------------
    df = t.scan(row_filter="order_id <= 5").to_pandas()
    assert list(df["order_id"].sort_values()) == [1, 2, 3, 4, 5]

    print("ok")


if __name__ == "__main__":
    main()
