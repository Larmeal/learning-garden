"""Chapter 4: data I/O, measured with real CSV and Parquet files.

Runs in WSL on Windows (Parquet cannot be written there). From the code folder:

    uv run python exercises/04_data_io.py

Bytes read are the `inputBytes` the Spark UI shows for the stages of one action, read from its REST API.
Sizes and byte counts are printed; the lesson quotes them as measured on one machine, the asserts check the shape
(Parquet reads far less than CSV, pushdown skips row groups, partition pruning skips folders, ...).
"""

import glob
import json
import os
import random
import sys
import tempfile
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))

from common import explain, get_spark, relaunch_in_wsl_if_windows  # noqa: E402

relaunch_in_wsl_if_windows(__file__)

from pyspark.sql import functions as F  # noqa: E402


def du(path):
    return sum(os.path.getsize(f) for f in glob.glob(path + "/**/*", recursive=True) if os.path.isfile(f))


class Meter:
    """Run an action and report the bytes Spark read for it (sum of inputBytes of the stages it created)."""

    def __init__(self, spark):
        sc = spark.sparkContext
        self.base = f"http://127.0.0.1:{sc.uiWebUrl.rsplit(':', 1)[1]}/api/v1/applications/{sc.applicationId}"

    def stages(self):
        return {s["stageId"]: s for s in json.load(urllib.request.urlopen(self.base + "/stages"))}

    def scan_rows(self):
        """`number of output rows` of the scan node of the most recent SQL query (rows the file reader emitted)."""
        queries = json.load(urllib.request.urlopen(self.base + "/sql?details=true&planDescription=false&length=100"))
        last = sorted(queries, key=lambda q: q["id"])[-1]
        for node in last["nodes"]:
            if "Scan" in node["nodeName"]:
                return int({m["name"]: m["value"] for m in node["metrics"]}["number of output rows"].replace(",", ""))
        raise AssertionError("no scan node")

    def bytes_read(self, action):
        before = set(self.stages())
        action()
        after = self.stages()
        return sum(s["inputBytes"] for sid, s in after.items() if sid not in before)


def make_table(spark, n=600_000):
    """Rows that look like orders: a few low-cardinality columns and two high-entropy strings."""
    df = (
        spark.range(n)
        .withColumn("country", F.element_at(F.array(*[F.lit(c) for c in ["th", "jp", "sg", "vn", "id"]]), (F.col("id") % 5 + 1).cast("int")))
        .withColumn("status", F.element_at(F.array(F.lit("new"), F.lit("paid"), F.lit("shipped"), F.lit("done")), (F.col("id") % 4 + 1).cast("int")))
        .withColumn("user", (F.col("id") * 7919 % 5000).cast("int"))
        .withColumn("amount", F.round(F.rand(1) * 1000, 2))
        .withColumn("qty", (F.rand(2) * 20).cast("int"))
        .withColumn("ts", F.timestamp_seconds(F.lit(1_700_000_000) + F.col("id") * 3))
        .withColumn("token", F.md5(F.col("id").cast("string")))
        .withColumn("note", F.md5(F.concat(F.col("id").cast("string"), F.lit("n"))))
    )
    return df.repartition(4)  # a few files


def main():
    spark = get_spark("ch04")
    spark.sparkContext.setLogLevel("ERROR")
    spark.conf.set("spark.sql.adaptive.enabled", "false")
    meter = Meter(spark)
    root = tempfile.mkdtemp(prefix="ch04_")
    df = make_table(spark)
    ncols = len(df.columns)

    # ---- 1. Same data, two formats ----------------------------------------------------------------------
    csv_path, pq_path = root + "/t_csv", root + "/t_parquet"
    df.write.option("header", True).csv(csv_path)
    df.write.parquet(pq_path)
    csv_bytes, pq_bytes = du(csv_path), du(pq_path)
    assert pq_bytes < csv_bytes, (pq_bytes, csv_bytes)
    print(f"{df.count():,} rows x {ncols} columns on disk: CSV {csv_bytes/2**20:.1f} MiB, Parquet {pq_bytes/2**20:.1f} MiB")

    csv_df = spark.read.option("header", True).schema(df.schema).csv(csv_path)
    pq_df = spark.read.parquet(pq_path)

    # ---- 2. Reading one column of twelve -----------------------------------------------------------------
    q = lambda d: d.agg(F.sum("amount")).collect()  # noqa: E731
    b_csv = meter.bytes_read(lambda: q(csv_df))
    b_pq = meter.bytes_read(lambda: q(pq_df))
    plan = explain(pq_df.agg(F.sum("amount")))
    assert "ReadSchema: struct<amount:double>" in plan, plan
    assert b_csv >= 0.9 * csv_bytes, "CSV has to read every line to find one column"
    assert b_pq < 0.2 * pq_bytes, (b_pq, pq_bytes)
    print(f"sum(amount): CSV read {b_csv/2**20:.1f} MiB (of {csv_bytes/2**20:.1f}), Parquet read {b_pq/2**20:.2f} MiB (of {pq_bytes/2**20:.1f})")

    # ---- 3. Predicate pushdown and row groups -------------------------------------------------------------
    sorted_path, shuffled_path = root + "/sorted", root + "/shuffled"
    # Small row groups make the statistics useful on a small table.
    spark.conf.set("parquet.block.size", str(256 * 1024))
    df.orderBy("id").coalesce(1).write.parquet(sorted_path)
    df.orderBy("note").coalesce(1).write.parquet(shuffled_path)  # same rows, ids scattered over the file
    spark.conf.unset("parquet.block.size")
    import pyarrow.parquet as pq

    f = glob.glob(sorted_path + "/*.parquet")[0]
    meta = pq.ParquetFile(f).metadata
    assert meta.num_row_groups > 5, meta.num_row_groups
    id_col = [i for i in range(meta.num_columns) if meta.row_group(0).column(i).path_in_schema == "id"][0]
    mins = [meta.row_group(g).column(id_col).statistics.min for g in range(meta.num_row_groups)]
    maxs = [meta.row_group(g).column(id_col).statistics.max for g in range(meta.num_row_groups)]
    assert all(maxs[i] < mins[i + 1] for i in range(len(mins) - 1)), "sorted file: row groups have disjoint id ranges"

    s_df, u_df = spark.read.parquet(sorted_path), spark.read.parquet(shuffled_path)
    cond = "id BETWEEN 1000 AND 1999"
    plan = explain(s_df.where(cond).select("amount"))
    assert "PushedFilters: [IsNotNull(id), GreaterThanOrEqual(id,1000), LessThanOrEqual(id,1999)]" in plan, plan
    assert "Filter" in plan, "the Filter stays above the scan"
    total = s_df.count()
    s_df.where(cond).agg(F.sum("amount")).collect()
    rows_sorted = meter.scan_rows()
    u_df.where(cond).agg(F.sum("amount")).collect()
    rows_scattered = meter.scan_rows()
    group_rows = meta.row_group(0).num_rows
    assert rows_sorted <= 2 * group_rows, "only the row group(s) whose id range matches are read"
    assert rows_scattered > 0.8 * total, "the same filter skips nothing when ids are spread over every row group"
    print(f"filter on id: file reader emitted {rows_sorted:,} of {total:,} rows when sorted ({meta.num_row_groups} row groups of {group_rows:,}), {rows_scattered:,} when scattered")

    # ---- 4. partitionBy and partition pruning -------------------------------------------------------------
    part_path = root + "/by_country"
    df.write.partitionBy("country").parquet(part_path)
    dirs = sorted(d for d in os.listdir(part_path) if d.startswith("country="))
    assert dirs == ["country=id", "country=jp", "country=sg", "country=th", "country=vn"], dirs
    inside = pq.ParquetFile(glob.glob(part_path + "/country=th/*.parquet")[0]).schema_arrow.names
    assert "country" not in inside, "the partition value lives in the folder name, not in the file"
    p_df = spark.read.parquet(part_path)
    plan = explain(p_df.where("country = 'th'").select("amount"))
    assert "PartitionFilters: [isnotnull(country#" in plan and "(country#" in plan and "= th)" in plan, plan
    assert "country" in p_df.columns, "Spark adds the column back when reading"
    p_df.agg(F.sum("amount")).collect()
    r_all = meter.scan_rows()
    p_df.where("country = 'th'").agg(F.sum("amount")).collect()
    r_th = meter.scan_rows()
    assert (r_all, r_th) == (600_000, 120_000), (r_all, r_th)
    print(f"partition pruning: all folders {r_all:,} rows, country=th only {r_th:,} rows")

    # ---- 5. How many files a write produces ---------------------------------------------------------------
    def files(path):
        return len(glob.glob(path + "/*.parquet"))

    base = spark.range(100_000, numPartitions=16)
    base.write.parquet(root + "/w16")
    base.repartition(50).write.parquet(root + "/w50")
    base.coalesce(1).write.parquet(root + "/w1")
    assert (files(root + "/w16"), files(root + "/w50"), files(root + "/w1")) == (16, 50, 1)
    # partitionBy multiplies it: every task writes one file per partition value it holds.
    many = root + "/many"
    spark.range(100_000, numPartitions=16).withColumn("k", F.col("id") % 5).write.partitionBy("k").parquet(many)
    n_many = len(glob.glob(many + "/k=*/*.parquet"))
    assert n_many == 16 * 5, n_many
    print("files: 16 partitions -> 16, repartition(50) -> 50, coalesce(1) -> 1; 16 tasks x 5 partition values -> 80 files")

    # ---- 6. How many tasks read a file --------------------------------------------------------------------
    assert spark.conf.get("spark.sql.files.maxPartitionBytes") == "134217728b"
    big = spark.read.parquet(root + "/w16")
    n_default = big.rdd.getNumPartitions()
    spark.conf.set("spark.sql.files.maxPartitionBytes", "20000")
    n_small = spark.read.parquet(root + "/w16").rdd.getNumPartitions()
    spark.conf.unset("spark.sql.files.maxPartitionBytes")
    assert n_default <= 16 < n_small, (n_default, n_small)
    print(f"read partitions: default {n_default} (about one per small file), maxPartitionBytes=20000 -> {n_small}")

    # ---- 7. Write modes -----------------------------------------------------------------------------------
    target = root + "/modes"
    spark.range(10).write.parquet(target)
    try:
        spark.range(10).write.parquet(target)
        raise AssertionError("mode error (default) must fail on an existing path")
    except Exception as e:  # noqa: BLE001
        assert "PATH_ALREADY_EXISTS" in str(e)
    spark.range(5).write.mode("ignore").parquet(target)
    assert spark.read.parquet(target).count() == 10, "ignore leaves the existing data alone"
    spark.range(10).write.mode("append").parquet(target)
    assert spark.read.parquet(target).count() == 20
    spark.range(3).write.mode("overwrite").parquet(target)
    assert spark.read.parquet(target).count() == 3

    # ---- 8. What inferSchema costs ------------------------------------------------------------------------
    sc = spark.sparkContext
    sc.setJobGroup("infer", "infer")
    inferred = spark.read.option("header", True).option("inferSchema", True).csv(csv_path)
    n_infer = len(sc.statusTracker().getJobIdsForGroup("infer"))
    sc.setJobGroup("given", "given")
    given = spark.read.option("header", True).schema(df.schema).csv(csv_path)
    n_given = len(sc.statusTracker().getJobIdsForGroup("given"))
    assert n_infer >= 1 and n_given == 0, (n_infer, n_given)  # inferSchema reads the data before any action
    print(f"jobs started by read.csv before any action: inferSchema {n_infer}, explicit schema {n_given}")
    assert dict(inferred.dtypes)["qty"] == "int" and dict(inferred.dtypes)["amount"] == "double"
    assert dict(given.dtypes) == dict(df.dtypes)
    spark.stop()
    print("ok")


if __name__ == "__main__":
    main()
