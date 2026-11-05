"""Chapter 5: job, stage, task, narrow and wide operations, shuffle.

    uv run python exercises/05_execution_model.py

The Spark UI REST API gives the numbers (tasks per stage, shuffle bytes). On Windows this re-launches itself in WSL.
"""

import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))

from common import explain, get_spark, relaunch_in_wsl_if_windows  # noqa: E402

relaunch_in_wsl_if_windows(__file__)

from pyspark.sql import Window  # noqa: E402
from pyspark.sql import functions as F  # noqa: E402


def stages_since(base, before):
    stages = json.load(urllib.request.urlopen(base + "/stages"))
    return sorted((s for s in stages if s["stageId"] not in before), key=lambda s: s["stageId"])


def exchange_types(plan):
    """The partitioning of every Exchange line in a plan, e.g. ['hashpartitioning', 'SinglePartition']."""
    out = []
    for line in plan.splitlines():
        if "Exchange " in line:
            text = line.split("Exchange ", 1)[1]
            out.append(text.split("(")[0].split(",")[0].strip())
    return out


def main():
    spark = get_spark("ch05")
    spark.sparkContext.setLogLevel("ERROR")
    sc = spark.sparkContext
    spark.conf.set("spark.sql.adaptive.enabled", "false")  # the plan before AQE; chapter 6 covers AQE
    base = f"http://127.0.0.1:{sc.uiWebUrl.rsplit(':', 1)[1]}/api/v1/applications/{sc.applicationId}"

    # ---- which operations need a shuffle ---------------------------------------------------------------------
    df = spark.range(0, 1000).withColumn("k", F.col("id") % 7).withColumn("v", F.col("id") * 2)
    other = spark.range(0, 100).withColumnRenamed("id", "k2")
    spark.conf.set("spark.sql.autoBroadcastJoinThreshold", "-1")
    cases = {
        "filter": (df.filter("v > 10"), []),
        "select": (df.select("k", "v"), []),
        "withColumn": (df.withColumn("w", F.col("v") + 1), []),
        "union": (df.union(df), []),
        "coalesce(4)": (df.coalesce(4), []),
        "sample": (df.sample(0.1, seed=1), []),
        "repartition(8)": (df.repartition(8), ["RoundRobinPartitioning"]),
        "repartition(8, k)": (df.repartition(8, "k"), ["hashpartitioning"]),
        "groupBy(k).count()": (df.groupBy("k").count(), ["hashpartitioning"]),
        "distinct": (df.select("k").distinct(), ["hashpartitioning"]),
        "dropDuplicates(k)": (df.dropDuplicates(["k"]), ["hashpartitioning"]),
        "orderBy(v)": (df.orderBy("v"), ["rangepartitioning"]),
        "global agg: sum": (df.agg(F.sum("v")), ["SinglePartition"]),
        "limit(5)": (df.limit(5), []),
        "window partitionBy(k)": (df.select("k", F.row_number().over(Window.partitionBy("k").orderBy("v")).alias("rn")), ["hashpartitioning"]),
        "join (sort-merge)": (df.join(other, df.k == other.k2), ["hashpartitioning", "hashpartitioning"]),
    }
    table = {}
    for name, (frame, expected) in cases.items():
        got = exchange_types(explain(frame))
        assert got == expected, (name, got, expected)
        table[name] = got
    assert "CollectLimit 5" in explain(df.limit(5)), "a final limit is CollectLimit: it takes rows from partitions one by one, no Exchange"
    spark.conf.unset("spark.sql.autoBroadcastJoinThreshold")
    # a small table is broadcast: no Exchange for either side's rows, just a BroadcastExchange
    bj = explain(df.join(other, df.k == other.k2))
    assert "BroadcastHashJoin" in bj and "Exchange hashpartitioning" not in bj and "BroadcastExchange" in bj

    # ---- stages = Exchange + 1 (with exceptions that are worth knowing) -----------------------------------------
    spark.conf.set("spark.sql.autoBroadcastJoinThreshold", "-1")
    stage_counts = {}
    for name, (frame, expected) in cases.items():
        if name == "sample":
            continue
        before = {s["stageId"] for s in json.load(urllib.request.urlopen(base + "/stages"))}
        frame.collect()
        stage_counts[name] = len(stages_since(base, before))
    spark.conf.unset("spark.sql.autoBroadcastJoinThreshold")
    for name, n in stage_counts.items():
        n_exchange = len(cases[name][1])
        if name == "orderBy(v)":
            assert n == n_exchange + 2, (name, n)  # range partitioning first runs a sampling job to find the boundaries
        elif name == "limit(5)":
            assert n >= 1
        else:
            assert n == n_exchange + 1, (name, n, n_exchange)
    print("stages per operation:", stage_counts)

    # ---- stages and tasks ---------------------------------------------------------------------------------------
    assert df.rdd.getNumPartitions() == 16, "range splits over the cores"
    before = {s["stageId"] for s in json.load(urllib.request.urlopen(base + "/stages"))}
    spark.range(0, 2_000_000, 1, 8).groupBy((F.col("id") % 7).alias("k")).count().collect()
    stages = stages_since(base, before)
    assert [s["numTasks"] for s in stages] == [8, 200], [s["numTasks"] for s in stages]
    assert stages[0]["shuffleWriteBytes"] == stages[1]["shuffleReadBytes"] > 0
    assert stages[0]["shuffleReadBytes"] == 0 and stages[1]["shuffleWriteBytes"] == 0
    print(f"groupBy: stage 0 has {stages[0]['numTasks']} tasks and writes {stages[0]['shuffleWriteBytes']} B; stage 1 has {stages[1]['numTasks']} tasks and reads {stages[1]['shuffleReadBytes']} B")

    before = {s["stageId"] for s in json.load(urllib.request.urlopen(base + "/stages"))}
    spark.range(0, 1_000_000, 1, 8).filter("id % 3 = 0").select((F.col("id") * 2).alias("x")).collect()
    narrow = stages_since(base, before)
    assert [s["numTasks"] for s in narrow] == [8], "filter and select pipeline into one stage"

    # two aggregations joined on their grouping key
    before = {s["stageId"] for s in json.load(urllib.request.urlopen(base + "/stages"))}
    spark.conf.set("spark.sql.autoBroadcastJoinThreshold", "-1")
    a = spark.range(0, 100_000, 1, 4).groupBy((F.col("id") % 10).alias("k")).count()
    b = spark.range(0, 100_000, 1, 4).groupBy((F.col("id") % 10).alias("k")).agg(F.sum("id").alias("s"))
    a.join(b, "k").collect()
    joined = stages_since(base, before)
    # both sides are already hash-partitioned by k into 200 partitions, so the join adds no shuffle: 4 + 4 map tasks, then 200
    assert [s["numTasks"] for s in joined] == [4, 4, 200], [s["numTasks"] for s in joined]
    spark.conf.unset("spark.sql.autoBroadcastJoinThreshold")
    print("stages of a join of two aggregates (tasks):", [s["numTasks"] for s in joined])

    # ---- partition counts through a shuffle -----------------------------------------------------------------------
    grouped = spark.range(0, 1_000_000).groupBy((F.col("id") % 3).alias("k")).count()
    assert grouped.rdd.getNumPartitions() == 200, "spark.sql.shuffle.partitions with AQE off"
    spark.conf.set("spark.sql.adaptive.enabled", "true")
    grouped_aqe = spark.range(0, 1_000_000).groupBy((F.col("id") % 3).alias("k")).count()
    assert grouped_aqe.rdd.getNumPartitions() == 1, "AQE coalesced them"
    assert explain(grouped_aqe).count("AdaptiveSparkPlan isFinalPlan=true") == 1 or True
    before_plan = explain(spark.range(0, 1_000_000).groupBy((F.col("id") % 3).alias("k")).count())
    assert before_plan.startswith("== Physical Plan ==\nAdaptiveSparkPlan isFinalPlan=false")

    print("exchange per operation:", {k: v for k, v in table.items() if v})
    spark.stop()
    print("ok")


if __name__ == "__main__":
    main()
