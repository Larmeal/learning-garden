"""Chapter 1: architecture. What a local session really is, and how PySpark reaches the JVM.

    uv run python exercises/01_architecture.py

On Windows this re-launches itself in WSL (see 03_dataframe_sql.py for why).
"""

import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))

from common import get_spark, relaunch_in_wsl_if_windows  # noqa: E402

relaunch_in_wsl_if_windows(__file__)

from pyspark.sql import SparkSession  # noqa: E402
from pyspark.sql import functions as F  # noqa: E402


def main():
    spark = get_spark("ch01")
    spark.sparkContext.setLogLevel("ERROR")
    sc = spark.sparkContext

    # ---- local[*]: one process, as many task slots as cores --------------------------------------------------
    cores = os.cpu_count()
    assert sc.master == "local[*]" and sc.defaultParallelism == cores and sc.version == "4.2.0" == spark.version
    assert SparkSession.builder.getOrCreate() is spark, "getOrCreate hands back the session that already exists"
    base = f"http://127.0.0.1:{sc.uiWebUrl.rsplit(':', 1)[1]}/api/v1/applications/{sc.applicationId}"
    executors = json.load(urllib.request.urlopen(base + "/executors"))
    assert [e["id"] for e in executors] == ["driver"], "in local mode the driver is the only executor"
    assert executors[0]["totalCores"] == cores
    assert spark.range(1_000_000).rdd.getNumPartitions() == cores, "range splits into one partition per core"

    # ---- PySpark is a thin client of a JVM ------------------------------------------------------------------------
    jvm = sc._jvm
    assert type(spark).__module__ == "pyspark.sql.session"
    assert jvm.org.apache.spark.sql.SparkSession.active().version() == "4.2.0", "the Python object calls the JVM SparkSession"
    java = jvm.java.lang.System.getProperty("java.version")
    assert int(java.split(".")[0]) >= 17, java
    df = spark.range(10)
    assert type(df._jdf).__name__ == "JavaObject", "a DataFrame holds a handle to a Dataset that lives in the JVM"
    assert df._jdf.count() == 10 and df.count() == 10

    # ---- where memory is ------------------------------------------------------------------------------------------
    # The driver of a local session has 1 GiB by default; Spark manages (heap - 300 MiB) x 0.6 of it (chapter 13).
    heap = jvm.java.lang.Runtime.getRuntime().maxMemory()
    assert executors[0]["maxMemory"] == int((heap - 300 * 1024 * 1024) * 0.6), (executors[0]["maxMemory"], heap)
    assert sc.getConf().get("spark.driver.memory", "1g") == "1g"

    # ---- what comes back to the driver ----------------------------------------------------------------------------
    rows = spark.range(5).withColumn("sq", F.col("id") * F.col("id")).collect()
    assert [tuple(r) for r in rows] == [(0, 0), (1, 1), (2, 4), (3, 9), (4, 16)], "collect() returns Row objects in the driver"
    assert spark.range(5).show() is None, "show() prints and returns nothing"
    assert spark.range(5).limit(2).toPandas().shape == (2, 1), "toPandas() copies the result into driver memory as well"
    print(f"cores {cores}, java {java}, driver memory managed by Spark {executors[0]['maxMemory']:,} B")
    spark.stop()
    print("ok")


if __name__ == "__main__":
    main()
