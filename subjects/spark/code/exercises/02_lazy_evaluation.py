"""Chapter 2: lazy evaluation, measured by counting Spark jobs.

    uv run python exercises/02_lazy_evaluation.py

A job is what an action starts, so counting jobs with a job group shows what ran and what only planned.
On Windows this re-launches itself in WSL (see 03_dataframe_sql.py for why).
"""

import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))

from common import explain, get_spark, relaunch_in_wsl_if_windows  # noqa: E402

relaunch_in_wsl_if_windows(__file__)

from pyspark.errors import AnalysisException  # noqa: E402
from pyspark.sql import functions as F  # noqa: E402


class Jobs:
    def __init__(self, spark):
        self.sc = spark.sparkContext
        self.n = 0

    def count(self, action):
        self.n += 1
        group = f"g{self.n}"
        self.sc.setJobGroup(group, group)
        action()
        return len(self.sc.statusTracker().getJobIdsForGroup(group))

    def tasks(self, action):
        self.n += 1
        group = f"g{self.n}"
        self.sc.setJobGroup(group, group)
        action()
        tracker = self.sc.statusTracker()
        total = 0
        for job in tracker.getJobIdsForGroup(group):
            for sid in tracker.getJobInfo(job).stageIds:
                total += tracker.getStageInfo(sid).numTasks
        return total


def main():
    spark = get_spark("ch02")
    spark.sparkContext.setLogLevel("ERROR")
    jobs = Jobs(spark)

    # ---- transformations plan, actions run -------------------------------------------------------------
    df = spark.range(0, 1_000_000)
    built = []
    assert jobs.count(lambda: built.append(df.filter("id % 2 = 0").withColumn("x", F.col("id") * 2).select("x").where("x > 10"))) == 0
    q = built[0]
    assert jobs.count(lambda: q.explain()) == 0, "explain only prints the plan"
    assert jobs.count(lambda: q.count()) >= 1

    # With AQE a groupBy action is two jobs (the shuffle map stage, then the result), without it one.
    g = lambda: spark.range(0, 1_000_000).groupBy((F.col("id") % 3).alias("k")).count()  # noqa: E731
    assert jobs.count(lambda: g().collect()) == 2
    spark.conf.set("spark.sql.adaptive.enabled", "false")
    assert jobs.count(lambda: g().collect()) == 1
    spark.conf.set("spark.sql.adaptive.enabled", "true")

    # ---- the same action twice is the work twice ----------------------------------------------------------------
    def fresh():
        return spark.range(0, 3_000_000).groupBy((F.col("id") % 7).alias("k")).count()

    one = fresh()
    first = jobs.count(one.collect)
    again = jobs.count(one.collect)  # same DataFrame object: the shuffle files of the first run are still there
    other = jobs.count(fresh().collect)  # a new DataFrame with the same code starts from the beginning
    assert (first, other) == (2, 2), (first, other)
    assert again < first, (again, "the map stage is skipped: its shuffle output already exists")
    print(f"jobs for a groupBy collect: first {first}, same DataFrame again {again}, rebuilt DataFrame {other}")
    spark.conf.set("spark.sql.adaptive.enabled", "false")
    narrow = spark.range(0, 1_000_000).filter("id % 2 = 0")
    assert jobs.count(narrow.count) >= 1 and jobs.count(narrow.count) >= 1, "with no shuffle there is nothing to reuse: both counts run"
    spark.conf.set("spark.sql.adaptive.enabled", "true")

    # ---- cache is lazy too ------------------------------------------------------------------------------------
    c = spark.range(0, 1_000_000).filter("id % 2 = 0")
    assert jobs.count(lambda: c.cache()) == 0 and c.is_cached
    assert len(spark.sparkContext._jsc.sc().getRDDStorageInfo()) == 0, "nothing stored until an action runs"
    jobs.count(c.count)
    assert len(spark.sparkContext._jsc.sc().getRDDStorageInfo()) == 1
    c.unpersist()

    # ---- an action does not always read everything: show() and limit stop early --------------------------------
    huge = spark.range(0, 10**12, 1, 200)  # a trillion rows in 200 partitions
    t = time.perf_counter()
    n_tasks = jobs.tasks(lambda: huge.show(5))
    elapsed = time.perf_counter() - t
    assert n_tasks < 20 and elapsed < 20, (n_tasks, elapsed)
    print(f"show(5) on a trillion-row range: {n_tasks} task(s) of 200 partitions, {elapsed:.1f}s")

    # ---- when errors appear ----------------------------------------------------------------------------------
    bad = spark.createDataFrame([("1",), ("abc",)], "x string")
    try:
        bad.select("no_such_column")
        raise AssertionError("a wrong column name must fail when the line runs")
    except AnalysisException as e:
        assert "UNRESOLVED_COLUMN" in str(e)
    step = bad.select(F.col("x").cast("int").alias("n"))  # no error here: nothing has read the data
    try:
        step.collect()
        raise AssertionError("the bad value must fail at the action")
    except Exception as e:  # noqa: BLE001
        assert "CAST_INVALID_INPUT" in str(e)

    # ---- ANSI mode is read when the DataFrame is defined, not when the action runs ------------------------------
    spark.conf.set("spark.sql.ansi.enabled", "true")
    defined_on = spark.createDataFrame([("abc",)], "s string").selectExpr("cast(s as int) AS i")
    spark.conf.set("spark.sql.ansi.enabled", "false")
    defined_off = spark.createDataFrame([("abc",)], "s string").selectExpr("cast(s as int) AS i")
    try:
        defined_on.collect()
        raise AssertionError("ANSI was on when this DataFrame was defined")
    except Exception as e:  # noqa: BLE001
        assert "CAST_INVALID_INPUT" in str(e)
    assert defined_off.collect()[0].i is None
    spark.conf.set("spark.sql.ansi.enabled", "true")

    # ---- the plan is what the lineage becomes ---------------------------------------------------------------
    plan = explain(q)
    assert "Filter" in plan and "Project" in plan and "Range" in plan
    spark.stop()
    print("ok")


if __name__ == "__main__":
    main()
