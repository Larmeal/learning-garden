"""Chapter 13: internals. RDD lineage, stages, shuffle files, the unified memory manager and code generation.

    uv run python exercises/13_internals.py

The memory part needs a JVM with a known heap, so it runs in a child process of this script (`... memory`).
Timings are printed, never asserted.
"""

import glob
import os
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(__file__))

from pyspark import StorageLevel  # noqa: E402
from pyspark.sql import SparkSession  # noqa: E402
from pyspark.sql import functions as F  # noqa: E402

from common import explain  # noqa: E402


def session(app, **conf):
    os.environ.pop("SPARK_HOME", None)
    os.environ["PYSPARK_PYTHON"] = sys.executable
    os.environ["PYSPARK_DRIVER_PYTHON"] = sys.executable
    b = SparkSession.builder.master("local[4]").appName(app)
    for k, v in conf.items():
        b = b.config(k, v)
    spark = b.getOrCreate()
    spark.sparkContext.setLogLevel("ERROR")
    return spark


def stages_of_last_job(sc, group):
    tracker = sc.statusTracker()
    jobs = tracker.getJobIdsForGroup(group)
    assert len(jobs) == 1, jobs
    info = tracker.getJobInfo(jobs[0])
    return [tracker.getStageInfo(s).numTasks for s in sorted(info.stageIds)]


def rdd_and_stages(spark):
    sc = spark.sparkContext
    base = sc.parallelize(range(100), 4)
    narrow = base.map(lambda x: x + 1).filter(lambda x: x % 2 == 0).map(lambda x: x * 2)
    pairs = base.map(lambda x: (x % 5, 1))
    reduced = pairs.reduceByKey(lambda a, b: a + b)

    # Lineage: a shuffle appears as a ShuffledRDD, narrow steps are pipelined (PythonRDD wraps several functions).
    assert "ShuffledRDD" not in narrow.toDebugString().decode()
    assert "ShuffledRDD" in reduced.toDebugString().decode()
    assert narrow.getNumPartitions() == 4 and reduced.getNumPartitions() == 4
    assert reduced.partitioner is not None and narrow.partitioner is None

    sc.setJobGroup("narrow", "narrow")
    narrow.collect()
    assert stages_of_last_job(sc, "narrow") == [4], "map and filter run in one stage"
    sc.setJobGroup("reduce", "reduce")
    reduced.collect()
    assert stages_of_last_job(sc, "reduce") == [4, 4], "a shuffle cuts the job into two stages"

    # Two shuffles in a row give three stages.
    twice = reduced.map(lambda kv: (kv[1] % 3, kv[0])).reduceByKey(lambda a, b: a + b)
    sc.setJobGroup("twice", "twice")
    twice.collect()
    tasks = stages_of_last_job(sc, "twice")
    assert tasks == [4, 4, 4], tasks

    # PySpark's RDD join unions both sides and shuffles once, so it is two stages, not three.
    other = sc.parallelize(range(100), 2).map(lambda x: (x % 5, "b"))
    sc.setJobGroup("join", "join")
    pairs.join(other).collect()
    joined = stages_of_last_job(sc, "join")
    assert joined == [6, 6], joined  # 4 + 2 partitions of the union, then 6 result tasks
    print("stages (tasks): narrow", [4], "reduceByKey", [4, 4], "two shuffles", tasks, "join", joined)

    # A DataFrame is built on RDDs too.
    df = spark.range(0, 1000, 1, 8).groupBy((F.col("id") % 7).alias("k")).count()
    assert df.rdd.getNumPartitions() in (1, 6, 200)


def shuffle_files():
    local_dir = tempfile.mkdtemp(prefix="ch13_local_")
    spark = session(
        "shuffle-files", **{"spark.local.dir": local_dir, "spark.sql.adaptive.enabled": "false", "spark.sql.shuffle.partitions": "6"}
    )
    spark.range(0, 100_000, 1, 8).groupBy((F.col("id") % 7).alias("k")).count().collect()
    files = [os.path.basename(f) for f in glob.glob(local_dir + "/**/shuffle_*", recursive=True)]
    data = [f for f in files if f.endswith(".data")]
    index = [f for f in files if f.endswith(".index")]
    assert len(data) == len(index) == 8, "one data and one index file per map task"
    assert sorted(data)[0].startswith("shuffle_0_0_0") and all(f.startswith("shuffle_0_") and f.endswith("_0.data") for f in data)
    assert len(files) == 24 and sum(1 for f in files if f.endswith(".checksum.ADLER32")) == 8
    print("shuffle files for 8 map tasks:", len(files), sorted(set(f.split(".", 1)[1] for f in files)))
    spark.stop()


def memory_part():
    spark = session(
        "memory",
        **{"spark.driver.memory": "600m", "spark.sql.adaptive.enabled": "false", "spark.sql.shuffle.partitions": "2"},
    )
    sc = spark.sparkContext
    jvm = sc._jvm
    mm = jvm.org.apache.spark.SparkEnv.get().memoryManager()
    assert mm.getClass().getSimpleName() == "UnifiedMemoryManager"
    heap = jvm.java.lang.Runtime.getRuntime().maxMemory()
    reserved = 300 * 1024 * 1024
    unified = int((heap - reserved) * 0.6)  # spark.memory.fraction = 0.6
    assert mm.maxHeapMemory() == unified == 188_743_680, (mm.maxHeapMemory(), unified)
    region = mm.maxOnHeapStorageMemory() // 2  # spark.memory.storageFraction = 0.5

    df = spark.range(0, 4_000_000, 1, 4).select("id", F.rand().alias("r"), F.md5(F.col("id").cast("string")).alias("s"))
    df.persist(StorageLevel.MEMORY_ONLY)
    df.count()
    cached = mm.storageMemoryUsed()
    assert cached > region, "storage borrowed free memory beyond its own half"
    assert mm.executionMemoryUsed() == 0
    n_before = sc._jsc.sc().getRDDStorageInfo()[0].numCachedPartitions()

    # Execution needs memory: it takes it back from storage by evicting cached blocks.
    spark.range(0, 6_000_000, 1, 2).orderBy(F.rand()).write.format("noop").mode("overwrite").save()
    after = mm.storageMemoryUsed()
    n_after = sc._jsc.sc().getRDDStorageInfo()[0].numCachedPartitions()
    assert after < cached and n_after < n_before, (cached, after, n_before, n_after)
    mib = lambda b: round(b / 2**20, 1)  # noqa: E731
    print(
        f"heap {mib(heap)} MiB, unified {mib(unified)} MiB, storage region {mib(region)} MiB; "
        f"cached {mib(cached)} MiB in {n_before} partitions, after a sort {mib(after)} MiB in {n_after}"
    )
    spark.stop()


def codegen(spark):
    df = spark.range(0, 1000).filter("id % 3 = 0").selectExpr("id * 2 AS x")
    text = explain(df, "codegen")
    assert "Found 1 WholeStageCodegen subtrees" in text
    assert "GeneratedIteratorForCodegenStage1" in text and "processNext" in text
    assert "*(1) Project" in explain(df)

    grouped = spark.range(0, 1000).groupBy((F.col("id") % 7).alias("k")).count()
    spark.conf.set("spark.sql.adaptive.enabled", "false")
    plan = explain(spark.range(0, 1000).groupBy((F.col("id") % 7).alias("k")).count())
    assert "*(1)" in plan and "*(2)" in plan and "Exchange" in plan, plan
    # The Exchange is outside any generated class: it splits the plan into two codegen stages.
    exchange_line = [ln for ln in plan.splitlines() if "Exchange" in ln][0]
    assert "*(" not in exchange_line

    spark.conf.set("spark.sql.codegen.wholeStage", "false")
    off = explain(spark.range(0, 1000).filter("id % 3 = 0").selectExpr("id * 2 AS x"))
    assert "*(" not in off and "Filter" in off
    spark.conf.set("spark.sql.codegen.wholeStage", "true")
    del grouped

    def run(on):
        spark.conf.set("spark.sql.codegen.wholeStage", "true" if on else "false")
        q = spark.range(0, 30_000_000).filter("id % 3 = 0").selectExpr("id * 2 AS x").agg(F.sum("x"))
        t = time.perf_counter()
        q.collect()
        return time.perf_counter() - t

    run(True)
    on, off_t = min(run(True) for _ in range(2)), min(run(False) for _ in range(2))
    print(f"codegen timing (30M rows, one machine): whole-stage on {on:.2f}s, off {off_t:.2f}s")
    spark.conf.set("spark.sql.codegen.wholeStage", "true")
    spark.conf.set("spark.sql.adaptive.enabled", "true")


def main():
    if sys.argv[1:] == ["memory"]:
        memory_part()
        return
    spark = session("ch13", **{"spark.sql.shuffle.partitions": "6"})
    rdd_and_stages(spark)
    codegen(spark)
    spark.stop()
    shuffle_files()
    out = subprocess.run([sys.executable, os.path.abspath(__file__), "memory"], capture_output=True, text=True, timeout=600)
    assert out.returncode == 0, out.stdout[-1500:] + out.stderr[-1500:]
    print([ln for ln in out.stdout.splitlines() if ln.startswith("heap ")][-1])
    print("ok")


if __name__ == "__main__":
    main()
