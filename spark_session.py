"""Shared SparkSession factory for the exercises in this project.

The machine has a system-wide SPARK_HOME pointing at Spark 3.5.0, which would
shadow the PySpark that uv installs into .venv. Drop it for this process so the
bundled PySpark jars are used, and make workers use the venv interpreter.
"""

import os
import sys

from pyspark.sql import SparkSession


def get_spark(app_name: str = "learning-spark", master: str = "local[*]") -> SparkSession:
    os.environ.pop("SPARK_HOME", None)
    os.environ["PYSPARK_PYTHON"] = sys.executable
    os.environ["PYSPARK_DRIVER_PYTHON"] = sys.executable
    return SparkSession.builder.master(master).appName(app_name).getOrCreate()
