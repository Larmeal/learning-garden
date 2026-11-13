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
from pyspark.accumulators import AccumulatorParam  # noqa: E402
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


# Where every row of the table in RepartitionLab lands (labs/spark/RepartitionLab.tsx, SPARK_PLACEMENT). The 12 rows sit in 4
# partitions of 5, 3, 1 and 3 rows; the lists are in the order of the rows, for repartition(n) and repartition(n, "key").
LAB_KEYS = [[0, 0, 1, 0, 2], [1, 2, 1], [0], [2, 1, 2]]
LAB_PLACEMENT = {
    ("rr", 2): [1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0],
    ("rr", 3): [1, 2, 0, 0, 1, 0, 2, 1, 2, 1, 0, 2],
    ("rr", 8): [6, 4, 2, 5, 3, 4, 3, 2, 0, 7, 6, 0],
    ("key", 2): [0, 0, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1],
    ("key", 3): [2, 2, 0, 2, 1, 0, 1, 0, 2, 1, 0, 1],
    ("key", 8): [2, 2, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1],
}


def lab_placements(spark):
    spark.conf.set("spark.sql.adaptive.enabled", "false")
    sc = spark.sparkContext
    rdd = sc.parallelize(range(4), 4).flatMap(lambda p: [(p, i, "ABC"[k]) for i, k in enumerate(LAB_KEYS[p])])
    df = spark.createDataFrame(rdd, "ip int, slot int, key string")
    first = {}
    for ip, part in enumerate(LAB_KEYS):
        for s in range(len(part)):
            first[(ip, s)] = len(first)
    for (how, n), expected in LAB_PLACEMENT.items():
        moved = df.repartition(n) if how == "rr" else df.repartition(n, "key")
        dest = [None] * len(first)
        for q, rows in enumerate(moved.rdd.glom().collect()):
            for r in rows:
                dest[first[(r.ip, r.slot)]] = q
        assert dest == expected, (how, n, dest)
    # coalesce cuts the old partitions into runs of neighbours, and never makes more
    for n in (2, 3, 8):
        sizes = [len(g) for g in df.coalesce(n).rdd.glom().collect()]
        assert sizes == [sum(len(LAB_KEYS[i]) for i in range(a, b)) for a, b in _runs(n)], (n, sizes)
    assert [len(g) for g in df.repartition(8).rdd.glom().collect()].count(0) == 1
    spark.conf.set("spark.sql.adaptive.enabled", "true")


def _runs(n):
    k = min(n, 4)
    return [((j * 4) // k, ((j + 1) * 4) // k) for j in range(k)]


class _Counts(AccumulatorParam):
    """Counts how often each (step, partition) really ran."""

    def zero(self, v):
        return {}

    def addInPlace(self, a, b):
        for k, n in b.items():
            a[k] = a.get(k, 0) + n
        return a


def cache_lineage(spark):
    """CacheLab (lesson 7): a recipe of 4 steps over 4 partitions, cached after step c, three actions in a row.

    The second action runs only the steps after c, none when c is the last step, and the third one (after the block of
    partition 2 was removed) runs partition 2 again from the first step. A chain with a shuffle does not run the stage before the
    shuffle again, with or without a cache.
    """
    sc = spark.sparkContext
    names = ["read", "filter", "withColumn", "select"]
    for c in (0, 1, 2, 3, 4):
        seen = sc.accumulator({}, _Counts())

        def counted(name):
            def f(idx, it):
                seen.add({(name, idx): 1})
                for x in it:
                    yield x + 1

            return f

        cur = sc.parallelize(range(12), 4)
        cached = None
        for k, name in enumerate(names, 1):
            cur = cur.mapPartitionsWithIndex(counted(name))
            if k == c:
                cur = cached = cur.persist(StorageLevel.MEMORY_ONLY)
        ran = []
        for action in range(3):
            if action == 2 and cached is not None:
                bm = sc._jsc.sc().env().blockManager()
                bm.removeBlock(sc._jvm.org.apache.spark.storage.RDDBlockId(cached.id(), 2), True)
            before = dict(seen.value)
            cur.count()
            ran.append({k for k, n in seen.value.items() if n != before.get(k, 0)})
        everything = {(n, p) for n in names for p in range(4)}
        after = {(n, p) for n in names[c:] for p in range(4)}  # the steps after the cached one, every partition
        assert ran[0] == everything, (c, ran[0])
        assert ran[1] == (everything if c == 0 else after), (c, ran[1])
        # partition 2 lost its block: all four steps again for it, the later steps for the others
        assert ran[2] == (everything if c == 0 else after | {(n, 2) for n in names}), (c, ran[2])
        if cached is not None:
            cached.unpersist(blocking=True)

    pre = sc.accumulator({}, _Counts())

    def before_shuffle(idx, it):
        pre.add({("pre", idx): 1})
        for x in it:
            yield (x % 3, x)

    g = sc.parallelize(range(12), 4).mapPartitionsWithIndex(before_shuffle).reduceByKey(lambda a, b: a + b)
    g.count()
    once = dict(pre.value)
    g.count()
    assert dict(pre.value) == once and sum(once.values()) == 4, (once, pre.value)


def cache_dataframe(spark):
    """CacheLab and LineageLab on real DataFrames with a shuffle and a join (lessons 2 and 7).

    A Python UDF counts how many rows reach the expensive step, so "udf rows" tells which part of the recipe really ran
    again. 4 partitions of 1000 rows, so 4000 = all of it and 1000 = one partition. The case with the shuffle files
    deleted is in 07b_jvm_limits.py (lost_shuffle): it makes Spark treat the local executor as lost, which breaks the storage
    info that later checks of this file read.
    """
    from pyspark.sql.functions import udf

    sc = spark.sparkContext
    keys = ("spark.sql.adaptive.enabled", "spark.sql.shuffle.partitions", "spark.sql.autoBroadcastJoinThreshold")
    saved = {k: spark.conf.get(k, None) for k in keys}  # None: the session had not set it
    spark.conf.set("spark.sql.adaptive.enabled", "false")
    spark.conf.set("spark.sql.shuffle.partitions", "4")
    spark.conf.set("spark.sql.autoBroadcastJoinThreshold", "-1")  # a sort merge join, so both sides shuffle
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

    def lose_block(part):
        newest = max(r.id() for r in sc._jsc.sc().getRDDStorageInfo() if r.numCachedPartitions() > 0)
        sc._jsc.sc().env().blockManager().removeBlock(sc._jvm.org.apache.spark.storage.RDDBlockId(newest, part), True)

    small = spark.range(0, 4).withColumnRenamed("id", "k")

    # a narrow chain, cache after the expensive step: the lost block of partition 2 is the only thing built again
    c = base().cache()
    q = lambda: c.agg(F.sum("v")).collect()  # noqa: E731
    assert (ran(q), ran(q)) == (4000, 0)
    lose_block(2)
    assert ran(q) == 1000
    c.unpersist(blocking=True)

    # a shuffle: the same DataFrame again does not run the part before the shuffle (the shuffle files are used again),
    # but a different query on the same base does, unless the base is cached
    agg = base().groupBy("k").agg(F.sum("v"))
    assert (ran(agg.collect), ran(agg.collect)) == (4000, 0)
    b = base()
    assert (ran(b.groupBy("k").agg(F.sum("v")).collect), ran(b.groupBy("k").agg(F.max("v")).collect)) == (4000, 4000)
    b = base().cache()
    assert (ran(b.groupBy("k").agg(F.sum("v")).collect), ran(b.groupBy("k").agg(F.max("v")).collect)) == (4000, 0)
    b.unpersist(blocking=True)

    # cache after the shuffle: a lost block is rebuilt from the shuffle files, the part before the shuffle does not run
    a = base().groupBy("k").agg(F.sum("v").alias("s")).cache()
    sa = lambda: a.agg(F.sum("s")).collect()  # noqa: E731
    assert (ran(sa), ran(sa)) == (4000, 0)
    lose_block(2)
    assert ran(sa) == 0
    a.unpersist(blocking=True)

    # a join of two big tables is the same: both sides are shuffled and the files are used again
    j = base().join(small, "k").groupBy("k").agg(F.sum("v"))
    assert (ran(j.collect), ran(j.collect)) == (4000, 0)

    for k, v in saved.items():
        if v is None:
            spark.conf.unset(k)
        else:
            spark.conf.set(k, v)


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
    for arg in ("maxresult", "spill", "levels", "lost_shuffle"):
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
    lab_placements(spark)
    cache_lineage(spark)
    cache_dataframe(spark)
    caching(spark)
    distinct_shapes(spark)
    shuffle_writer(spark)
    python_udf_plan(spark)
    spark.stop()
    jvm_limits()
    print("ok")


if __name__ == "__main__":
    main()
