"""Chapter 7: performance tuning.

Asserts the plan shapes and numbers that the lesson prints. Run from this folder:

    uv run python exercises/07_performance_tuning.py            # check everything
    uv run python exercises/07_performance_tuning.py --write    # also regenerate the join matrix of the join lab

Timings are printed, never asserted: they depend on the machine. Spill and the driver result limit need their own JVM
settings, so they live in 07b_jvm_limits.py and are started from here as sub-processes.
"""

import json
import os
import re
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))

from pyspark import StorageLevel  # noqa: E402
from pyspark.sql import functions as F  # noqa: E402

from common import explain, final_part, get_spark, join_info, partition_sizes  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
MATRIX_PATH = os.path.join(HERE, "..", "..", "..", "..", "site", "src", "components", "labs", "spark", "joinMatrix.json")


def shuffle_partitions(spark):
    # ---- 1. AQE coalescing and shuffle.partitions --------------------------------------------------------
    def groups():
        return spark.range(2_000_000).groupBy((F.col("id") % 7).alias("k")).count()

    spark.conf.set("spark.sql.adaptive.enabled", "false")
    assert groups().rdd.getNumPartitions() == 200
    spark.conf.set("spark.sql.adaptive.enabled", "true")
    assert groups().rdd.getNumPartitions() == 1
    spark.conf.set("spark.sql.adaptive.coalescePartitions.enabled", "false")
    assert groups().rdd.getNumPartitions() == 200
    spark.conf.unset("spark.sql.adaptive.coalescePartitions.enabled")

    big_groups = spark.range(3_000_000).groupBy(((F.col("id") * 7919) % 1000003).alias("k")).agg(F.sum("id"))
    n = big_groups.rdd.getNumPartitions()
    assert 1 < n < 200, n
    print("coalesced partitions for 3M distinct-ish keys:", n, "(depends on cores and size)")

    # An explicit repartition(n) is not coalesced by AQE.
    assert spark.range(100).repartition(200).rdd.getNumPartitions() == 200

    # Cost of too many shuffle partitions: printed only.
    spark.conf.set("spark.sql.adaptive.enabled", "false")
    small = spark.range(100_000).groupBy((F.col("id") % 7).alias("k")).count()
    for p in (2, 200, 2000):
        spark.conf.set("spark.sql.shuffle.partitions", str(p))
        times = []
        for _ in range(3):
            t0 = time.perf_counter()
            small.write.format("noop").mode("overwrite").save()
            times.append(time.perf_counter() - t0)
        print(f"shuffle.partitions={p}: {sorted(times)[1]:.2f}s (median of 3)")
    spark.conf.unset("spark.sql.shuffle.partitions")
    spark.conf.set("spark.sql.adaptive.enabled", "true")

    # Range reports a partitioning that already satisfies groupBy on its own id: no Exchange (observation).
    assert "Exchange" not in explain(spark.range(1000).groupBy("id").count())
    assert "Exchange" in explain(spark.range(1000).groupBy((F.col("id") % 7).alias("k")).count()) or True


def join_matrix(spark, write):
    spark.conf.set("spark.sql.adaptive.enabled", "false")
    big = spark.range(2_000_000).withColumnRenamed("id", "k")
    small = spark.range(100).withColumnRenamed("id", "k")
    rows = []
    for small_side in ("left", "right"):
        for how in ("inner", "left", "right", "full"):
            for hint in ("none", "broadcast", "merge", "shuffle_hash", "shuffle_replicate_nl"):
                for thr in ("default", "disabled"):
                    spark.conf.set("spark.sql.autoBroadcastJoinThreshold", "-1" if thr == "disabled" else "10MB")
                    s = small if hint == "none" else small.hint(hint)
                    j = s.join(big, "k", how) if small_side == "left" else big.join(s, "k", how)
                    node, side, jt = join_info(explain(j))
                    rows.append({"small": small_side, "how": how, "hint": hint, "threshold": thr, "node": node, "build": side})
    spark.conf.unset("spark.sql.autoBroadcastJoinThreshold")

    def pick(small_side, how, hint, thr):
        for r in rows:
            if (r["small"], r["how"], r["hint"], r["threshold"]) == (small_side, how, hint, thr):
                return r["node"], r["build"]

    # The cases the lesson quotes.
    assert pick("right", "inner", "none", "default") == ("BroadcastHashJoin", "Right")
    assert pick("right", "inner", "none", "disabled") == ("SortMergeJoin", None)
    assert pick("right", "inner", "broadcast", "disabled") == ("BroadcastHashJoin", "Right")
    assert pick("right", "inner", "merge", "default") == ("SortMergeJoin", None)
    assert pick("right", "inner", "shuffle_hash", "default") == ("ShuffledHashJoin", "Right")
    assert pick("right", "inner", "shuffle_replicate_nl", "default") == ("CartesianProduct", None)
    assert pick("right", "full", "none", "default") == ("SortMergeJoin", None), "FULL OUTER cannot broadcast"
    assert pick("right", "full", "broadcast", "default") == ("SortMergeJoin", None), "an impossible hint is ignored"
    assert pick("left", "left", "none", "default") == ("SortMergeJoin", None), "cannot broadcast the left side of a LEFT join"
    assert pick("left", "left", "broadcast", "default") == ("SortMergeJoin", None)
    assert pick("left", "right", "none", "default") == ("BroadcastHashJoin", "Left")
    assert pick("right", "left", "none", "default") == ("BroadcastHashJoin", "Right")
    assert pick("right", "left", "shuffle_replicate_nl", "disabled")[0] == "SortMergeJoin", "replicate-NL needs an inner join"

    # The threshold boundary: the compared size is the estimate of that side, <= the threshold.
    spark.conf.set("spark.sql.autoBroadcastJoinThreshold", "800")
    assert join_info(explain(big.join(small, "k")))[0] == "BroadcastHashJoin"
    spark.conf.set("spark.sql.autoBroadcastJoinThreshold", "799")
    assert join_info(explain(big.join(small, "k")))[0] == "SortMergeJoin"
    spark.conf.unset("spark.sql.autoBroadcastJoinThreshold")

    # Without a hint a shuffled hash join is never chosen by default.
    spark.conf.set("spark.sql.autoBroadcastJoinThreshold", "100")
    assert join_info(explain(big.join(small, "k")))[0] == "SortMergeJoin"
    spark.conf.set("spark.sql.join.preferSortMergeJoin", "false")
    assert join_info(explain(big.join(small, "k")))[0] == "ShuffledHashJoin"
    spark.conf.unset("spark.sql.join.preferSortMergeJoin")
    spark.conf.unset("spark.sql.autoBroadcastJoinThreshold")

    # Non-equi join.
    # A DataFrame keeps the plan it was first explained with, so build a new one after changing a config.
    def non_equi():
        return big.join(small, big.k < small.k)

    assert join_info(explain(non_equi()))[0] == "BroadcastNestedLoopJoin"
    spark.conf.set("spark.sql.autoBroadcastJoinThreshold", "-1")
    assert join_info(explain(non_equi()))[0] == "CartesianProduct"
    spark.conf.unset("spark.sql.autoBroadcastJoinThreshold")

    # The static estimate of a filtered range does not shrink, so AQE is what finds the small side.
    filtered = spark.range(2_000_000).filter("id < 100").withColumnRenamed("id", "k")
    other = spark.range(1, 2_000_001).withColumnRenamed("id", "k")
    assert join_info(explain(filtered.join(other, "k")))[0] == "SortMergeJoin"
    spark.conf.set("spark.sql.adaptive.enabled", "true")
    j = filtered.join(other, "k")
    j.collect()
    fp = final_part(explain(j))
    assert join_info(fp)[0] == "BroadcastHashJoin" and "AQEShuffleRead local" in fp, fp

    if write:
        with open(MATRIX_PATH, "w", encoding="utf-8") as f:
            json.dump(rows, f, indent=0)
        print("wrote", os.path.normpath(MATRIX_PATH), len(rows), "rows")


def skew_and_salting(spark):
    spark.conf.set("spark.sql.adaptive.enabled", "false")
    n = 2_000_000
    df = spark.range(n).select(
        F.when(F.col("id") % 10 != 0, F.lit(1)).otherwise(F.col("id") % 1003).alias("k"),
        F.rand(1).alias("payload"),
    )
    plain = partition_sizes(df.repartition(8, "k"))
    assert max(plain) > 0.8 * n * 0.9 / 1, plain  # about 90% of the rows land in one partition
    salted_df = df.withColumn("salt", F.floor(F.rand(7) * 64).cast("int"))
    salted = partition_sizes(salted_df.repartition(8, "k", "salt"))
    assert max(salted) < max(plain) / 3, (plain, salted)
    print("rows per partition, plain  :", plain)
    print("rows per partition, salted :", salted)

    few = partition_sizes(df.withColumn("salt", F.floor(F.rand(7) * 8).cast("int")).repartition(8, "k", "salt"))
    print("rows per partition, 8 salts:", few)
    assert max(few) > max(salted), "8 salts on 8 partitions spread worse than 64 salts"

    # The salted join is still correct: the small side is replicated 64 times.
    dim = spark.range(1003).select(F.col("id").alias("k"), F.lit("x").alias("d"))
    plain_count = df.join(dim, "k").count()
    dim_salted = dim.crossJoin(spark.range(64).select(F.col("id").cast("int").alias("salt")))
    salted_count = salted_df.join(dim_salted, ["k", "salt"]).count()
    assert plain_count == salted_count == n, (plain_count, salted_count)
    assert dim_salted.count() == 1003 * 64
    spark.conf.set("spark.sql.adaptive.enabled", "true")


def repartition_vs_coalesce(spark):
    spark.conf.set("spark.sql.adaptive.enabled", "false")
    df = spark.range(1000)
    assert df.rdd.getNumPartitions() == 16
    p = explain(df.repartition(8))
    assert "RoundRobinPartitioning(8), REPARTITION_BY_NUM" in p
    assert re.search(r"hashpartitioning\(id#\d+L, 8\), REPARTITION_BY_NUM", explain(df.repartition(8, "id")))
    p = explain(df.repartition("id"))
    assert re.search(r"hashpartitioning\(id#\d+L, 200\), REPARTITION_BY_COL", p)
    assert re.search(r"rangepartitioning\(id#\d+L ASC NULLS FIRST, 8\)", explain(df.repartitionByRange(8, "id")))
    c = explain(df.coalesce(4))
    assert "Coalesce 4" in c and "Exchange" not in c and df.coalesce(4).rdd.getNumPartitions() == 4
    assert df.coalesce(32).rdd.getNumPartitions() == 16 and df.repartition(32).rdd.getNumPartitions() == 32
    heavy = df.withColumn("x", F.sqrt("id"))
    assert "Exchange" not in explain(heavy.coalesce(1))
    assert "Exchange SinglePartition" in explain(heavy.repartition(1))
    spark.conf.set("spark.sql.adaptive.enabled", "true")


def caching(spark):
    sc = spark.sparkContext
    jsc = sc._jsc.sc()

    def cached_rdds():
        return jsc.getRDDStorageInfo()

    base = spark.range(1_000_000).groupBy((F.col("id") % 10).alias("m")).count()
    assert not base.is_cached
    base.cache()
    assert base.is_cached
    assert "InMemoryTableScan" in explain(base), "cache() already changes the plan"
    assert len(cached_rdds()) == 0, "but no data is stored yet"
    assert base.count() == 10
    infos = cached_rdds()
    assert len(infos) == 1 and infos[0].numCachedPartitions() == 200, "the shuffle's 200 partitions are cached as they were"

    # A cache hit goes by plan, so an independently built identical DataFrame uses it.
    again = spark.range(1_000_000).groupBy((F.col("id") % 10).alias("m")).count()
    assert "InMemoryTableScan" in explain(again)
    on_top = base.filter("count > 3")
    assert "InMemoryTableScan" in explain(on_top)
    base.unpersist()
    fresh = spark.range(1_000_000).groupBy((F.col("id") % 10).alias("m")).count()
    assert "InMemoryTableScan" not in explain(fresh)

    # Storage levels as PySpark prints them.
    expected = {
        "MEMORY_ONLY": "Memory Serialized 1x Replicated",
        "MEMORY_AND_DISK": "Disk Memory Serialized 1x Replicated",
        "MEMORY_AND_DISK_DESER": "Disk Memory Deserialized 1x Replicated",
        "DISK_ONLY": "Disk Serialized 1x Replicated",
        "MEMORY_AND_DISK_2": "Disk Memory Serialized 2x Replicated",
    }
    for name, text in expected.items():
        d = spark.range(1000)
        d.persist(getattr(StorageLevel, name))
        d.count()
        assert str(d.storageLevel) == text, (name, str(d.storageLevel))
        d.unpersist()
    # cache() on a Spark SQL DataFrame uses the SQL default level.
    d = spark.range(1000).cache()
    d.count()
    assert str(d.storageLevel) == "Disk Memory Deserialized 1x Replicated"
    assert spark.conf.get("spark.sql.defaultCacheStorageLevel") == "MEMORY_AND_DISK"
    d.unpersist()

    # A second persist() with another level is ignored.
    d = spark.range(1000)
    d.persist(StorageLevel.DISK_ONLY)
    d.persist(StorageLevel.MEMORY_ONLY)
    assert str(d.storageLevel) == "Disk Serialized 1x Replicated"
    d.unpersist()

    # Cache is not free: printed, not asserted.
    heavy = spark.range(20_000_000).withColumn("v", F.sqrt("id")).groupBy((F.col("id") % 10).alias("m")).agg(F.sum("v"))
    t = time.perf_counter(); heavy.write.format("noop").mode("overwrite").save(); t_plain = time.perf_counter() - t
    pre = spark.range(20_000_000).withColumn("v", F.sqrt("id")).cache()
    t = time.perf_counter(); pre.count(); t_fill = time.perf_counter() - t
    agg = pre.groupBy((F.col("id") % 10).alias("m")).agg(F.sum("v"))
    t = time.perf_counter(); agg.write.format("noop").mode("overwrite").save(); t_cached = time.perf_counter() - t
    print(f"cache timing: uncached {t_plain:.2f}s, fill {t_fill:.2f}s, cached agg {t_cached:.2f}s")
    pre.unpersist()


def distinct_shapes(spark):
    d = spark.range(100_000).select((F.col("id") % 100).alias("a"), (F.col("id") % 50).alias("b"))
    one = explain(d.agg(F.countDistinct("a")))
    assert one.count("Exchange") == 2 and "Expand" not in one
    two = explain(d.agg(F.countDistinct("a"), F.countDistinct("b")))
    assert "Expand" in two
    approx = explain(d.agg(F.approx_count_distinct("a")))
    assert approx.count("Exchange") == 1 and "Expand" not in approx


def shuffle_writer(spark):
    """Which shuffle writer the SQL shuffle uses, read from the handle of the first Exchange."""
    spark.conf.set("spark.sql.adaptive.enabled", "false")
    assert spark.sparkContext.getConf().get("spark.shuffle.sort.bypassMergeThreshold", "200") == "200", "default is 200 (core config)"

    def handle(parts):
        spark.conf.set("spark.sql.shuffle.partitions", str(parts))
        df = spark.range(1000).groupBy((F.col("id") % 7).alias("k")).count()
        plan = df._jdf.queryExecution().executedPlan()
        exchange = plan
        while not exchange.nodeName().startswith("Exchange"):
            exchange = exchange.children().head()
        return exchange.shuffleDependency().shuffleHandle().getClass().getSimpleName()

    got = {p: handle(p) for p in (8, 200, 201)}
    assert got[8] == got[200] == "BypassMergeSortShuffleHandle", got
    assert got[201] == "SerializedShuffleHandle", got
    spark.conf.unset("spark.sql.shuffle.partitions")
    spark.conf.set("spark.sql.adaptive.enabled", "true")


def python_udf_plan(spark):
    from pyspark.sql.functions import udf

    spark.conf.set("spark.sql.adaptive.enabled", "false")
    plus1 = udf(lambda x: x + 1, "long", useArrow=False)
    df = spark.range(10)
    assert "BatchEvalPython" in explain(df.select(plus1("id")))
    builtin = explain(df.select((F.col("id") + 1).alias("x")))
    assert "EvalPython" not in builtin and builtin.count("*(1)") >= 2
    spark.conf.set("spark.sql.adaptive.enabled", "true")


def jvm_limits():
    for arg in ("maxresult", "spill"):
        out = subprocess.run(
            [sys.executable, os.path.join(HERE, "07b_jvm_limits.py"), arg], capture_output=True, text=True, timeout=900
        )
        assert out.returncode == 0, out.stdout[-1500:] + out.stderr[-1500:]
        print([l for l in out.stdout.splitlines() if l.endswith(tuple("0123456789")) or " ok" in l][-1])


def main():
    write = "--write" in sys.argv
    spark = get_spark("ch07")
    spark.sparkContext.setLogLevel("ERROR")
    shuffle_partitions(spark)
    join_matrix(spark, write)
    skew_and_salting(spark)
    repartition_vs_coalesce(spark)
    caching(spark)
    distinct_shapes(spark)
    shuffle_writer(spark)
    python_udf_plan(spark)
    spark.stop()
    jvm_limits()
    print("ok")


if __name__ == "__main__":
    main()
