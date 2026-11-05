"""Chapter 10: table formats, shown with Delta Lake 4.4.1 on Spark 4.2.0.

Runs inside WSL (Hadoop cannot write local files on this Windows machine) and needs network the first time, to fetch
the Delta jar from Maven Central into ~/.ivy2. Started on Windows it re-launches itself in WSL. From the code folder:

    uv run python exercises/10_table_formats.py

Iceberg and Hudi are not exercised here: the Iceberg runtime built for Spark 4.1 fails on 4.2.0 (see the lesson) and no
Iceberg 4.2 build existed on Maven Central when this was written.
"""

import glob
import json
import os
import subprocess
import sys
import tempfile
import threading

HERE = os.path.dirname(os.path.abspath(__file__))
DELTA = "io.delta:delta-spark_2.13:4.4.1"


def relaunch_in_wsl():
    code_dir = os.path.normpath(os.path.join(HERE, ".."))
    drive, rest = os.path.splitdrive(code_dir)
    wsl_dir = "/mnt/" + drive[0].lower() + rest.replace("\\", "/")
    cmd = f"cd '{wsl_dir}' && ./run_wsl.sh exercises/10_table_formats.py"
    out = subprocess.run(["wsl.exe", "-d", "Ubuntu", "--", "bash", "-lc", cmd], capture_output=True, text=True)
    print(out.stdout.replace("\x00", "")[-3000:])
    if out.returncode != 0:
        print(out.stderr.replace("\x00", "")[-2000:])
        raise SystemExit(out.returncode)
    raise SystemExit(0)


if os.name == "nt":
    relaunch_in_wsl()

from pyspark.sql import SparkSession  # noqa: E402
from pyspark.sql import functions as F  # noqa: E402


def session():
    os.environ.pop("SPARK_HOME", None)
    spark = (
        SparkSession.builder.master("local[4]").appName("ch10")
        .config("spark.jars.packages", DELTA)
        .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
        .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
        .config("spark.databricks.delta.retentionDurationCheck.enabled", "false")
        .config("spark.sql.shuffle.partitions", "4")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("ERROR")
    return spark


def actions(path, version):
    out = []
    with open(f"{path}/_delta_log/{version:020d}.json") as f:
        for line in f:
            d = json.loads(line)
            out.append((next(iter(d)), d))
    return out


def parquet_files(path):
    return glob.glob(path + "/*.parquet")


def layout_and_copy_on_write(spark, root):
    p = root + "/t"
    spark.range(0, 100, 1, 4).withColumn("g", F.col("id") % 5).write.format("delta").save(p)
    v0 = actions(p, 0)
    kinds = [k for k, _ in v0]
    assert kinds[:3] == ["commitInfo", "metaData", "protocol"] and kinds.count("add") == 4, kinds
    add = next(d["add"] for k, d in v0 if k == "add")
    assert {"path", "size", "partitionValues", "modificationTime", "dataChange", "stats"} <= set(add)
    stats = json.loads(add["stats"])
    assert stats["numRecords"] == 25 and "minValues" in stats and "maxValues" in stats and "nullCount" in stats
    assert len(parquet_files(p)) == 4

    spark.sql(f"UPDATE delta.`{p}` SET g = 99 WHERE id < 10")
    kinds = sorted(k for k, _ in actions(p, 1))
    assert kinds == ["add", "commitInfo", "remove"], kinds  # files are never edited: one removed, one added
    assert len(parquet_files(p)) == 5, "the old file is still on disk until VACUUM"
    raw = spark.read.parquet(p).count()
    via_log = spark.read.format("delta").load(p).count()
    assert (raw, via_log) == (125, 100), (raw, via_log)  # raw parquet reads the removed file too

    spark.sql(f"DELETE FROM delta.`{p}` WHERE id >= 90")
    spark.sql(
        f"MERGE INTO delta.`{p}` t USING (SELECT 5 AS id, 7 AS g) s ON t.id = s.id WHEN MATCHED THEN UPDATE SET g = s.g"
    )
    hist = [(r.version, r.operation) for r in spark.sql(f"DESCRIBE HISTORY delta.`{p}`").collect()]
    assert sorted(hist) == [(0, "WRITE"), (1, "UPDATE"), (2, "DELETE"), (3, "MERGE")], hist
    counts = [spark.read.format("delta").option("versionAsOf", v).load(p).count() for v in range(4)]
    assert counts == [100, 100, 90, 90], counts
    old = spark.read.format("delta").option("versionAsOf", 0).load(p).where("id = 5").collect()[0].g
    new = spark.read.format("delta").load(p).where("id = 5").collect()[0].g
    assert (old, new) == (0, 7)
    return p


def schema_rules(spark, p):
    try:
        spark.range(3).withColumn("g", F.lit("x")).write.format("delta").mode("append").save(p)
        raise AssertionError("a string where a bigint was expected must be rejected")
    except Exception as e:  # noqa: BLE001
        assert "DELTA_FAILED_TO_MERGE_FIELDS" in str(e)
    wide = spark.range(3).withColumn("g", F.col("id")).withColumn("extra", F.lit(1))
    try:
        wide.write.format("delta").mode("append").save(p)
        raise AssertionError("an extra column must be rejected")
    except Exception as e:  # noqa: BLE001
        assert "DELTA_METADATA_MISMATCH" in str(e)
    wide.write.format("delta").mode("append").option("mergeSchema", "true").save(p)
    assert spark.read.format("delta").load(p).columns == ["id", "g", "extra"]


def compaction_and_vacuum(spark, p):
    detail = spark.sql(f"DESCRIBE DETAIL delta.`{p}`").collect()[0]
    before_files, before_disk = detail.numFiles, len(parquet_files(p))
    assert before_disk > before_files, "removed files are still on disk"
    spark.sql(f"OPTIMIZE delta.`{p}`")
    detail = spark.sql(f"DESCRIBE DETAIL delta.`{p}`").collect()[0]
    assert detail.numFiles == 1 < before_files
    assert len(parquet_files(p)) > detail.numFiles, "OPTIMIZE adds a file, it does not delete the old ones"
    spark.sql(f"VACUUM delta.`{p}` RETAIN 0 HOURS")
    assert len(parquet_files(p)) == detail.numFiles == 1
    try:
        spark.read.format("delta").option("versionAsOf", 0).load(p).collect()
        raise AssertionError("time travel to a vacuumed version must fail")
    except Exception as e:  # noqa: BLE001
        assert "FILE_NOT_EXIST" in str(e)
    print(f"files in the table: {before_files} -> 1 after OPTIMIZE; on disk {before_disk} -> 1 after VACUUM")


def checkpoints_and_skipping(spark, root):
    p = root + "/many"
    spark.range(0, 100, 1, 4).write.format("delta").save(p)
    for i in range(11):
        spark.range(1).write.format("delta").mode("append").save(p)
    files = os.listdir(p + "/_delta_log")
    assert any(f.endswith(".checkpoint.parquet") for f in files), "a checkpoint every 10 commits"
    assert "_last_checkpoint" in files

    s = root + "/skip"
    spark.range(0, 100, 1, 4).write.format("delta").save(s)
    hit = spark.read.format("delta").load(s).where("id > 95")
    assert len(hit.inputFiles()) == 1, "min/max statistics skip the other three files"
    assert hit.count() == 4


def conflicts(spark, root):
    outcomes = []
    for attempt in range(3):
        p = f"{root}/conflict{attempt}"
        spark.range(0, 3_000_000, 1, 1).select("id", F.md5(F.col("id").cast("string")).alias("s")).write.format("delta").save(p)
        barrier = threading.Barrier(2)
        res = {}

        def upd(name, val):
            barrier.wait()
            try:
                spark.sql(f"UPDATE delta.`{p}` SET s = 'x' WHERE id = {val}")
                res[name] = "ok"
            except Exception as e:  # noqa: BLE001
                res[name] = "ConcurrentAppendException" if "DELTA_CONCURRENT_APPEND" in str(e) else str(e)[:120]

        threads = [threading.Thread(target=upd, args=(n, v)) for n, v in (("A", 1), ("B", 2))]
        [t.start() for t in threads]
        [t.join() for t in threads]
        versions = len([f for f in os.listdir(p + "/_delta_log") if f.endswith(".json")])
        changed = spark.read.format("delta").load(p).where("s = 'x'").count()
        assert changed == sum(1 for v in res.values() if v == "ok") and versions == 1 + changed, (res, versions, changed)
        outcomes.append(res)
        if "ConcurrentAppendException" in res.values():
            break
    assert any("ConcurrentAppendException" in r.values() for r in outcomes), outcomes
    print("concurrent writers:", outcomes[-1])


def plain_parquet_baseline(spark, root):
    p = root + "/plain"
    spark.range(3).write.parquet(p)
    spark.range(3).withColumn("extra", F.lit(1)).write.mode("append").parquet(p)  # no schema check
    assert spark.read.parquet(p).count() == 6
    assert "extra" not in spark.read.parquet(p).columns, "the reader takes the schema of one file"
    assert "extra" in spark.read.option("mergeSchema", "true").parquet(p).columns


def hooks(spark):
    assert spark.conf.get("spark.sql.extensions") == "io.delta.sql.DeltaSparkSessionExtension"
    assert spark.conf.get("spark.sql.catalog.spark_catalog").endswith("DeltaCatalog")
    assert spark.version == "4.2.0"


def main():
    spark = session()
    root = tempfile.mkdtemp(prefix="ch10_")
    hooks(spark)
    p = layout_and_copy_on_write(spark, root)
    schema_rules(spark, p)
    compaction_and_vacuum(spark, p)
    checkpoints_and_skipping(spark, root)
    plain_parquet_baseline(spark, root)
    conflicts(spark, root)
    spark.stop()
    print("ok")


if __name__ == "__main__":
    main()
