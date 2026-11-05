"""Chapter 7, parts that need JVM settings fixed before the session starts.

    uv run python exercises/07b_jvm_limits.py maxresult   # driver.maxResultSize stops a big collect()
    uv run python exercises/07b_jvm_limits.py spill       # a sort that does not fit in memory spills to disk

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


if __name__ == "__main__":
    {"maxresult": max_result, "spill": spill}[sys.argv[1]]()
