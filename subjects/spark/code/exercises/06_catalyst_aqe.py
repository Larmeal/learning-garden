"""Chapter 6: Catalyst, AQE and explain().

Every number and plan shape that the lesson prints is asserted here. Run from this folder:

    uv run python exercises/06_catalyst_aqe.py

Expression ids (#0L) and plan_id values change between runs, so the checks use regular expressions
and never compare whole plans.
"""

import contextlib
import csv
import io
import os
import re
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pyspark.sql import functions as F  # noqa: E402

from spark_session import get_spark  # noqa: E402


def explain(df, mode=None):
    """Return what df.explain(...) prints (PySpark prints from Python, so stdout can be captured)."""
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        if mode is None:
            df.explain()
        else:
            df.explain(mode)
    return buf.getvalue()


def section(text, name):
    """Text of one '== name ==' section of explain(True)."""
    m = re.search(rf"== {name} ==\n(.*?)(?=\n== |\Z)", text, re.S)
    assert m, f"missing section {name}"
    return m.group(1)


def jobs_in_group(spark, group):
    return len(spark.sparkContext.statusTracker().getJobIdsForGroup(group))


def main():
    spark = get_spark("ch06")
    spark.sparkContext.setLogLevel("ERROR")
    sc = spark.sparkContext

    # ---- 1. The four plans -------------------------------------------------------------------------
    df = spark.range(1000).withColumn("x", F.col("id") * 2 + (1 + 2)).filter("id > 10 AND 1 = 1")
    sc.setJobGroup("plans", "plans")
    text = explain(df, True)
    explain(df)
    assert jobs_in_group(spark, "plans") == 0, "explain must not run a job"

    parsed = section(text, "Parsed Logical Plan")
    analyzed = section(text, "Analyzed Logical Plan")
    optimized = section(text, "Optimized Logical Plan")
    physical = section(text, "Physical Plan")
    assert "'Filter" in parsed, "unresolved names carry a quote mark"
    assert "1 = 1" in analyzed and "1 = 1" not in optimized, "BooleanSimplification and ConstantFolding remove 1 = 1"
    assert re.search(r"cast\(10 as bigint\)", analyzed), "type coercion shows up after analysis"
    # Pushdown: in the optimized plan the Filter sits below the Project.
    assert optimized.index("Project") < optimized.index("Filter"), "filter moved below project"
    assert re.search(r"\*\(1\) Project", physical), "whole-stage codegen marks operators with *(n)"

    formatted = explain(df, "formatted")
    assert "Parsed Logical Plan" not in formatted, "formatted prints the physical plan only"
    assert "(1) Range" in formatted and "codegen id : 1" in formatted

    # ---- 2. SQL and DataFrame reach the same optimized plan -----------------------------------------
    orders = spark.createDataFrame(
        [(1, "th", 4.0), (2, "th", 9.0), (3, "jp", 12.0)], "id int, country string, amt double"
    )
    orders.createOrReplaceTempView("o")

    def strip_ids(s):
        return re.sub(r"#\d+L?", "#N", s)

    via_sql = spark.sql("SELECT country, sum(amt) AS total FROM o WHERE amt > 5 GROUP BY country")
    via_df = orders.filter(F.col("amt") > 5).groupBy("country").agg(F.sum("amt").alias("total"))
    opt_sql = strip_ids(section(explain(via_sql, True), "Optimized Logical Plan"))
    opt_df = strip_ids(section(explain(via_df, True), "Optimized Logical Plan"))
    assert opt_sql == opt_df, "SQL and DataFrame give the same optimized plan"

    # ---- 3. Column pruning and predicate pushdown to a CSV scan ------------------------------------
    tmp = tempfile.mkdtemp(prefix="ch06_")
    path = os.path.join(tmp, "orders.csv")
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "name", "amount", "country"])
        for i in range(1000):
            w.writerow([i, f"n{i}", float(i % 300), "th" if i % 3 == 0 else "jp"])
    csv_df = spark.read.option("header", True).option("inferSchema", True).csv(path)
    csv_df.createOrReplaceTempView("orders")
    q = spark.sql("SELECT name FROM orders WHERE amount > 100 AND country = 'th'")
    phys = explain(q)
    assert "ReadSchema: struct<name:string,amount:double,country:string>" in phys, "id is pruned"
    assert "PushedFilters: [IsNotNull(amount), IsNotNull(country), GreaterThan(amount,100.0), EqualTo(country,th)]" in phys
    assert re.search(r"\n\s*\+- \*\(1\) Filter", phys) or "Filter (" in phys, "the Filter node stays above the scan"

    # ---- 4. Filter pushed through a join lands on both sides ---------------------------------------
    spark.conf.set("spark.sql.adaptive.enabled", "false")
    spark.range(1000).selectExpr("id AS a_id").createOrReplaceTempView("a")
    spark.range(1000).selectExpr("id AS c_id").createOrReplaceTempView("c")
    j = spark.sql("SELECT * FROM a JOIN c ON a_id = c_id WHERE a_id > 990")
    opt = section(explain(j, True), "Optimized Logical Plan")
    assert len(re.findall(r"Filter \(id#\d+L > 990\)", opt)) == 2, "the filter is inferred onto the other side"

    # ---- 5. Broadcast or sort-merge ---------------------------------------------------------------
    big = spark.range(5_000_000).withColumnRenamed("id", "k")
    small = spark.range(100).withColumnRenamed("id", "k")
    assert spark.conf.get("spark.sql.autoBroadcastJoinThreshold") == "10485760b"
    p_bhj = explain(big.join(small, "k"))
    assert "BroadcastHashJoin" in p_bhj and "BroadcastExchange" in p_bhj and "Exchange hashpartitioning" not in p_bhj
    spark.conf.set("spark.sql.autoBroadcastJoinThreshold", "-1")
    p_smj = explain(big.join(small, "k"))
    assert "SortMergeJoin" in p_smj and p_smj.count("Exchange hashpartitioning") == 2 and p_smj.count("Sort [") == 2
    p_hint = explain(big.join(F.broadcast(small), "k"))
    assert "BroadcastHashJoin" in p_hint, "a hint wins over the threshold"
    spark.conf.unset("spark.sql.autoBroadcastJoinThreshold")

    # ---- 6. Cost-based reorder is off, rule-based ReorderJoin avoids a cartesian product -------------
    assert spark.conf.get("spark.sql.cbo.enabled") == "false"
    assert spark.conf.get("spark.sql.cbo.joinReorder.enabled") == "false"
    spark.range(1000).selectExpr("id AS b_id").createOrReplaceTempView("b")
    r = spark.sql("SELECT * FROM a, b, c WHERE a.a_id = c.c_id AND b.b_id = c.c_id")
    opt = section(explain(r, True), "Optimized Logical Plan")
    assert "Join Cross" not in opt and opt.count("Join Inner") == 2

    # ---- 7. AQE defaults and isFinalPlan ---------------------------------------------------------
    spark.conf.set("spark.sql.adaptive.enabled", "true")
    defaults = {
        "spark.sql.adaptive.enabled": "true",
        "spark.sql.adaptive.coalescePartitions.enabled": "true",
        "spark.sql.adaptive.advisoryPartitionSizeInBytes": "67108864b",
        "spark.sql.adaptive.coalescePartitions.minPartitionSize": "1048576b",
        "spark.sql.adaptive.skewJoin.enabled": "true",
        "spark.sql.adaptive.skewJoin.skewedPartitionFactor": "5.0",
        "spark.sql.adaptive.skewJoin.skewedPartitionThresholdInBytes": "268435456b",
        "spark.sql.shuffle.partitions": "200",
    }
    for k, v in defaults.items():
        assert spark.conf.get(k) == v, (k, spark.conf.get(k))

    plain = spark.range(100).filter("id > 5")
    assert "AdaptiveSparkPlan" not in explain(plain), "no exchange, no AdaptiveSparkPlan"

    g = spark.range(1_000_000).groupBy((F.col("id") % 3).alias("k")).count()
    before = explain(g)
    assert before.startswith("== Physical Plan ==\nAdaptiveSparkPlan isFinalPlan=false")
    g.count()  # a different query: the original DataFrame never ran
    assert "isFinalPlan=false" in explain(g)
    g.collect()
    after = explain(g)
    assert "isFinalPlan=true" in after and "== Final Plan ==" in after and "== Initial Plan ==" in after
    assert "AQEShuffleRead coalesced" in after and "ResultQueryStage" in after
    assert g.rdd.getNumPartitions() == 1, "AQE coalesced 200 tiny partitions to 1"

    # ---- 8. The same query with AQE off or coalescing off ---------------------------------------------
    for key, value in [
        ("spark.sql.adaptive.enabled", "false"),
        ("spark.sql.adaptive.coalescePartitions.enabled", "false"),
    ]:
        spark.conf.set(key, value)
        g2 = spark.range(1_000_000).groupBy((F.col("id") % 3).alias("k")).count()
        assert g2.rdd.getNumPartitions() == 200, key
        spark.conf.unset(key)
    spark.conf.set("spark.sql.adaptive.enabled", "true")

    def coalesced_parts(**conf):
        for key, value in conf.items():
            spark.conf.set(key, value)
        n = spark.range(1_000_000).groupBy((F.col("id") % 3).alias("k")).count().rdd.getNumPartitions()
        for key in conf:
            spark.conf.unset(key)
        return n

    assert coalesced_parts(**{"spark.sql.adaptive.coalescePartitions.parallelismFirst": "false"}) == 1
    assert coalesced_parts(
        **{
            "spark.sql.adaptive.advisoryPartitionSizeInBytes": "1b",
            "spark.sql.adaptive.coalescePartitions.minPartitionSize": "1b",
        }
    ) == 3, "only 3 of the 200 shuffle partitions hold data"

    # ---- 8b. ANSI mode is fixed when the DataFrame is analyzed ------------------------------------------
    spark.conf.set("spark.sql.ansi.enabled", "true")
    cast_df = spark.createDataFrame([("abc",)], "s string").selectExpr("cast(s as int) AS i")
    spark.conf.set("spark.sql.ansi.enabled", "false")
    try:
        cast_df.collect()
        raise AssertionError("expected CAST_INVALID_INPUT")
    except Exception as e:  # noqa: BLE001
        assert "CAST_INVALID_INPUT" in str(e)
    late_df = spark.createDataFrame([("abc",)], "s string").selectExpr("cast(s as int) AS i")
    assert late_df.collect()[0].i is None, "defined with ANSI off: NULL"
    spark.conf.set("spark.sql.ansi.enabled", "true")

    # ---- 9. Runtime SortMergeJoin -> BroadcastHashJoin -------------------------------------------------
    left = spark.range(5_000_000).withColumnRenamed("id", "k")
    right = (
        spark.range(5_000_000).groupBy((F.col("id") % 5).alias("k")).count()
    )
    jn = left.join(right, "k")
    assert "SortMergeJoin" in explain(jn), "static estimate is large"
    jn.collect()
    fin = explain(jn)
    final_part = fin.split("== Initial Plan ==")[0]
    assert "BroadcastHashJoin" in final_part and "AQEShuffleRead local" in final_part, final_part

    # ---- 9b. A small side spread over mostly empty partitions is not broadcast ---------------------------
    def tiny_join():
        l = spark.range(5_000_000).withColumnRenamed("id", "k").repartition("k")
        r = spark.range(5_000_000).filter("id < 4").withColumnRenamed("id", "k").repartition("k")
        return l.join(r, "k")

    t = tiny_join()
    t.collect()
    assert "SortMergeJoin" in explain(t).split("== Initial Plan ==")[0], "4 rows in 200 partitions: ratio < 0.2"
    spark.conf.set("spark.sql.adaptive.nonEmptyPartitionRatioForBroadcastJoin", "0")
    t = tiny_join()
    t.collect()
    assert "BroadcastHashJoin" in explain(t).split("== Initial Plan ==")[0]
    spark.conf.unset("spark.sql.adaptive.nonEmptyPartitionRatioForBroadcastJoin")

    # ---- 10. Skew join: only fires after lowering the thresholds ----------------------------------
    spark.conf.set("spark.sql.autoBroadcastJoinThreshold", "-1")
    spark.conf.set("spark.sql.shuffle.partitions", "8")
    skew_left = spark.range(400_000).select(
        F.when(F.col("id") % 10 != 0, F.lit(0)).otherwise(F.col("id") % 50).alias("k"),
        F.concat(F.lit("payload-"), F.col("id").cast("string")).alias("v"),
    )
    skew_right = spark.range(50).select(F.col("id").alias("k"), F.lit("dim").alias("d"))

    def skew_final(extra):
        saved = {}
        for k, v in extra.items():
            saved[k] = spark.conf.get(k, None)
            spark.conf.set(k, v)
        d = skew_left.join(skew_right, "k")
        d.collect()
        out = explain(d).split("== Initial Plan ==")[0] if "isFinalPlan=true" in explain(d) else explain(d)
        n = d.rdd.getNumPartitions()
        for k, v in saved.items():
            if v is None:
                spark.conf.unset(k)
            else:
                spark.conf.set(k, v)
        return out, n

    out_default, n_default = skew_final({})
    assert "skew=true" not in out_default and "AQEShuffleRead coalesced" in out_default
    lowered = {
        "spark.sql.adaptive.skewJoin.skewedPartitionThresholdInBytes": "50KB",
        "spark.sql.adaptive.advisoryPartitionSizeInBytes": "100KB",
        "spark.sql.adaptive.coalescePartitions.enabled": "false",
    }
    out_skew, n_skew = skew_final(lowered)
    assert "SortMergeJoin(skew=true)" in out_skew and "AQEShuffleRead skewed" in out_skew, out_skew
    assert n_skew > 8, n_skew
    out_off, n_off = skew_final({**lowered, "spark.sql.adaptive.skewJoin.enabled": "false"})
    assert "skew=true" not in out_off and n_off == 8
    print("skew partitions: default", n_default, "lowered", n_skew, "skew off", n_off)

    spark.stop()
    print("ok")


if __name__ == "__main__":
    main()
