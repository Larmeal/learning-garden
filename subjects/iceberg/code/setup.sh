#!/usr/bin/env bash
# One-time setup of the Iceberg exercises on Linux, macOS or inside WSL: checks for Java, downloads the two jars the
# exercises load into Spark, and installs the Python packages with uv. Run it from this folder:
#
#   bash setup.sh
#   uv run python exercises/01_first_table.py
#   uv run python verify.py                     # every exercise, about 6 minutes
#
# Iceberg 1.12.0 has Spark runtimes for Spark 4.0 and 4.1 only (nothing for 4.2 when the lessons were written), so this
# subject pins PySpark 4.1.3. The jars go to ~/iceberg-lab/jars; set ICEBERG_LAB_JARS to put them somewhere else (set it
# again whenever you run an exercise).
set -euo pipefail

JARS="${ICEBERG_LAB_JARS:-$HOME/iceberg-lab/jars}"
ICEBERG_VERSION=1.12.0
SQLITE_VERSION=3.46.1.3
MAVEN=https://repo1.maven.org/maven2

if ! command -v java >/dev/null 2>&1; then
  echo "Java is missing. Install a JDK 17 or 21 (for example Temurin) and make sure \`java\` is on your PATH." >&2
  exit 1
fi
if ! command -v uv >/dev/null 2>&1; then
  echo "uv is missing. Install it from https://docs.astral.sh/uv/ and run this script again." >&2
  exit 1
fi

mkdir -p "$JARS"
cd "$(dirname "$0")"

fetch() { # fetch <url> <file>: skip a jar that is already there
  if [ -s "$JARS/$2" ]; then
    echo "have $2"
  else
    echo "download $2"
    curl -fL --retry 3 -o "$JARS/$2.part" "$1" && mv "$JARS/$2.part" "$JARS/$2"
  fi
}

fetch "$MAVEN/org/apache/iceberg/iceberg-spark-runtime-4.1_2.13/$ICEBERG_VERSION/iceberg-spark-runtime-4.1_2.13-$ICEBERG_VERSION.jar" \
  "iceberg-spark-runtime-4.1_2.13-$ICEBERG_VERSION.jar"
fetch "$MAVEN/org/xerial/sqlite-jdbc/$SQLITE_VERSION/sqlite-jdbc-$SQLITE_VERSION.jar" "sqlite-jdbc.jar"

uv sync
echo "done. jars are in $JARS"
