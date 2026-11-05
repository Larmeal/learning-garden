#!/usr/bin/env bash
# Run a Python script inside WSL (Linux). Windows cannot write Hadoop checkpoints without hadoop.dll, so the
# streaming exercises run here. One-time setup lives in ~/spark-lab: a JDK (Temurin 21) and a venv with
# pyspark 4.2.0, pandas and pyarrow. Usage, from this folder:
#   wsl.exe -d Ubuntu -- bash -lc "cd /mnt/e/Development/Project/learning/subjects/spark/code && ./run_wsl.sh exercises/09_streaming.py"
export JAVA_HOME="$HOME/spark-lab/jdk"
exec "$HOME/spark-lab/venv/bin/python" "$@"
