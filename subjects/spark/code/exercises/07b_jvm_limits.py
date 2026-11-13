"""Chapter 7, parts that need JVM settings fixed before the session starts.

    uv run python exercises/07b_jvm_limits.py maxresult   # driver.maxResultSize stops a big collect()
    uv run python exercises/07b_jvm_limits.py spill       # a sort that does not fit in memory spills to disk
    uv run python exercises/07b_jvm_limits.py levels      # MEMORY_ONLY, MEMORY_AND_DISK, DISK_ONLY when memory is short
    uv run python exercises/07b_jvm_limits.py lost_shuffle  # shuffle files deleted: the part before the shuffle runs again

Each mode builds its own session, so run them as separate processes (07_performance_tuning.py does that).
"""

import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pyspark.sql import SparkSession  # noqa: E402
from pyspark.sql import functions as F  # noqa: E402


def session(app, **conf):
    os.environ.pop("SPARK_HOME", None)
    os.environ["PYSPARK_PYTHON"] = sys.executable
    os.environ["PYSPARK_DRIVER_PYTHON"] = sys.executable
    b = SparkSession.builder.master("local[4]").appName(app)
    for k, v in conf.items():
        b = b.config(k, v)
    s = b.getOrCreate()
    s.sparkContext.setLogLevel("OFF")
    return s


def max_result():
    spark = session("maxresult", **{"spark.driver.maxResultSize": "1m"})
    try:
        spark.range(0, 2_000_000).collect()
    except Exception as e:  # noqa: BLE001
        assert "spark.driver.maxResultSize" in str(e), str(e)[:500]
        print("maxresult ok: collect() of 2M rows stopped by spark.driver.maxResultSize=1m")
    else:
        raise AssertionError("collect() should have been stopped")
    finally:
        spark.stop()


def spill():
    spark = session(
        "spill",
        **{
            "spark.driver.memory": "600m",
            "spark.sql.shuffle.partitions": "2",
            "spark.sql.adaptive.enabled": "false",
        },
    )
    df = spark.range(6_000_000).select(F.rand(3).alias("r"), F.md5(F.col("id").cast("string")).alias("s"))
    df.orderBy("r").write.format("noop").mode("overwrite").save()
    sc = spark.sparkContext
    base = sc.uiWebUrl.replace(sc.uiWebUrl.split("//")[1].split(":")[0], "localhost")
    app = sc.applicationId
    stages = json.load(urllib.request.urlopen(f"{base}/api/v1/applications/{app}/stages"))
    mem = max(s["memoryBytesSpilled"] for s in stages)
    disk = max(s["diskBytesSpilled"] for s in stages)
    assert mem > 0 and disk > 0, (mem, disk)
    assert mem >= disk, "the in-memory size of spilled data is at least the compressed size on disk"
    print(f"spill ok: memoryBytesSpilled={mem / 2**20:.0f} MiB, diskBytesSpilled={disk / 2**20:.0f} MiB")
    spark.stop()


def levels():
    """Where each StorageLevel puts 6 partitions that do not all fit in memory (CacheLab, lesson 7).

    The storage memory of a 450m driver is about 94 MB and the data is about 171 MB (random hex strings do not compress).
    """
    from pyspark import StorageLevel
    from pyspark.accumulators import AccumulatorParam

    class Counts(AccumulatorParam):
        def zero(self, v):
            return 0

        def addInPlace(self, a, b):
            return a + b

    spark = session("levels", **{"spark.driver.memory": "450m", "spark.ui.enabled": "false"})
    sc = spark.sparkContext
    room = sc._jsc.sc().env().memoryManager().maxOnHeapStorageMemory() / 1e6
    seen = {}
    for name, level in (
        ("MEMORY_ONLY", StorageLevel.MEMORY_ONLY),
        ("MEMORY_AND_DISK", StorageLevel.MEMORY_AND_DISK),
        ("DISK_ONLY", StorageLevel.DISK_ONLY),
    ):
        built = sc.accumulator(0, Counts())

        def make(idx, it, built=built):
            built.add(1)
            for _ in it:
                for _ in range(30000):
                    yield os.urandom(500).hex()

        d = sc.parallelize(range(6), 6).mapPartitionsWithIndex(make).persist(level)
        d.count()
        first = built.value
        info = [r for r in sc._jsc.sc().getRDDStorageInfo() if r.id() == d.id()][0]
        d.count()
        seen[name] = (info.numCachedPartitions(), info.memSize() / 1e6, info.diskSize() / 1e6, built.value - first)
        d.unpersist(blocking=True)
    mo, md, do = seen["MEMORY_ONLY"], seen["MEMORY_AND_DISK"], seen["DISK_ONLY"]
    assert mo[0] < 6 and mo[3] == 6 - mo[0] and mo[2] == 0, mo  # what did not fit is built again in the next action
    assert md[0] == 6 and md[2] > 0 and md[3] == 0, md  # the overflow went to disk and nothing is built again
    assert do[0] == 6 and do[1] == 0 and do[3] == 0, do  # everything on disk
    assert mo[1] <= room and md[1] <= room, (room, mo, md)
    total = do[2]
    print(
        f"levels ok: storage memory {room:.0f} MB, data {total:.0f} MB; MEMORY_ONLY kept {mo[0]} of 6 "
        f"(built {mo[3]} again), MEMORY_AND_DISK kept 6 ({md[1]:.0f} MB memory + {md[2]:.0f} MB disk, built {md[3]} again), "
        f"DISK_ONLY {do[2]:.0f} MB disk"
    )
    spark.stop()


def lost_shuffle():
    """LineageLab (lesson 2): the part before a shuffle or a join runs again only when the shuffle files are gone too.

    A Python UDF counts the rows that reach the expensive step (4 partitions of 1000 rows). Deleting the shuffle files makes
    Spark treat the local executor as lost, so this needs a session of its own.
    """
    import glob

    from pyspark.sql.functions import udf

    spark = session(
        "lostshuffle",
        **{"spark.sql.adaptive.enabled": "false", "spark.sql.shuffle.partitions": "4", "spark.sql.autoBroadcastJoinThreshold": "-1"},
    )
    sc = spark.sparkContext
    seen = sc.accumulator(0)

    @udf("long", useArrow=False)
    def slow(x):
        seen.add(1)
        return x * 2

    def base():
        return spark.range(0, 4000, numPartitions=4).withColumn("v", slow("id")).withColumn("k", F.col("id") % 4)

    def ran(fn):
        before = seen.value
        fn()
        return seen.value - before

    def delete_shuffle_files():
        dirs = [str(d) for d in sc._jsc.sc().env().blockManager().diskBlockManager().localDirs()]
        files = [f for d in dirs for f in glob.glob(os.path.join(d, "**", "shuffle_*"), recursive=True)]
        for f in files:
            os.remove(f)
        assert files

    agg = base().groupBy("k").agg(F.sum("v"))
    assert (ran(agg.collect), ran(agg.collect)) == (4000, 0)  # the files are used again
    delete_shuffle_files()
    assert ran(agg.collect) == 4000  # gone: the whole part before the shuffle runs again
    small = spark.range(0, 4).withColumnRenamed("id", "k")
    j = base().join(small, "k").groupBy("k").agg(F.sum("v"))
    assert (ran(j.collect), ran(j.collect)) == (4000, 0)
    delete_shuffle_files()
    assert ran(j.collect) == 4000  # the same for a sort merge join
    print("lost_shuffle ok: groupBy and join ran the part before the shuffle again (4000 of 4000 rows) once the shuffle files were deleted")
    spark.stop()


if __name__ == "__main__":
    {"maxresult": max_result, "spill": spill, "levels": levels, "lost_shuffle": lost_shuffle}[sys.argv[1]]()
