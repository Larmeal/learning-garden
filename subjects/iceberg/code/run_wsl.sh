#!/usr/bin/env bash
# Run a Python script inside WSL (Linux). Iceberg on Spark writes local files through Hadoop, which cannot do that on the
# owner's Windows machine (no hadoop.dll), so every exercise of this subject runs here. One-time setup, in WSL:
#
#   export PATH=$HOME/spark-lab/uvdl:$PATH           # uv, installed for the Spark subject
#   mkdir -p ~/iceberg-lab/jars && cd ~/iceberg-lab
#   uv venv --python 3.12 venv
#   uv pip install --python venv/bin/python "pyspark==4.1.3" "pyiceberg[sql-sqlite,pyiceberg-core]==0.12.0" pyarrow pandas fastavro
#   curl -L -o jars/iceberg-spark-runtime-4.1_2.13-1.12.0.jar \
#     https://repo1.maven.org/maven2/org/apache/iceberg/iceberg-spark-runtime-4.1_2.13/1.12.0/iceberg-spark-runtime-4.1_2.13-1.12.0.jar
#   curl -L -o jars/sqlite-jdbc.jar https://repo1.maven.org/maven2/org/xerial/sqlite-jdbc/3.46.1.3/sqlite-jdbc-3.46.1.3.jar
#
# The JDK is the one of the Spark subject (~/spark-lab/jdk, Temurin 21). Iceberg 1.12.0 has runtimes for Spark 4.0 and 4.1 only
# (nothing for 4.2 on Maven Central on 2026-11-12), so this subject uses PySpark 4.1.3, the version Iceberg 1.12.0 is built against.
# Usage, from this folder:
#   wsl.exe -d Ubuntu -- bash -lc "cd /mnt/e/Development/Project/learning/subjects/iceberg/code && ./run_wsl.sh exercises/01_first_table.py"
export JAVA_HOME="$HOME/spark-lab/jdk"
exec "$HOME/iceberg-lab/venv/bin/python" "$@"
