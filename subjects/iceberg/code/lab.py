"""Shared helpers of the Iceberg exercises.

Every exercise builds its own throwaway warehouse under /tmp/iceberg-lab/<name> (WSL), starts a Spark session whose catalog
`lab` is an Iceberg catalog, and can open the same catalog from PyIceberg. Two catalog kinds are used:

- "jdbc": Iceberg's JdbcCatalog on a SQLite file. PyIceberg's SqlCatalog reads and writes the same two tables, so both
  engines work on the same tables. This is the default.
- "hadoop": the HadoopCatalog, where the catalog is the directory layout itself (version-hint.text). Spark only.
"""

import glob
import json
import os
import shutil
import subprocess
import sys

# The two jars that setup.sh downloads. Set ICEBERG_LAB_JARS to keep them somewhere else.
JARS = os.environ.get("ICEBERG_LAB_JARS", os.path.expanduser("~/iceberg-lab/jars"))
ROOT = "/tmp/iceberg-lab"
CATALOG = "lab"


def relaunch_in_wsl_if_windows(script_path):
    """On Windows run this script again inside WSL through run_wsl.sh and exit with its status."""
    if os.name != "nt":
        return
    code_dir = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(script_path)), ".."))
    drive, rest = os.path.splitdrive(code_dir)
    wsl_dir = "/mnt/" + drive[0].lower() + rest.replace("\\", "/")
    name = os.path.basename(script_path)
    extra = " ".join(sys.argv[1:])
    cmd = f"cd '{wsl_dir}' && ./run_wsl.sh exercises/{name} {extra}"
    out = subprocess.run(["wsl.exe", "-d", "Ubuntu", "--", "bash", "-lc", cmd], capture_output=True, text=True)
    print(out.stdout.replace("\x00", "")[-6000:])
    if out.returncode != 0:
        print(out.stderr.replace("\x00", "")[-3000:])
    raise SystemExit(out.returncode)


def fresh_root(name):
    """An empty directory /tmp/iceberg-lab/<name> with a `wh` folder (warehouse) inside."""
    root = os.path.join(ROOT, name)
    shutil.rmtree(root, ignore_errors=True)
    os.makedirs(os.path.join(root, "wh"))
    return root


def get_spark(root, kind="jdbc", extra=None, app="iceberg-lab", cores=1):
    """A local SparkSession with the Iceberg extensions and a catalog called `lab` (see the module docstring).

    One core by default, so one write task and one data file per partition value: the file counts the lessons print stay fixed.
    """
    os.environ.pop("SPARK_HOME", None)
    os.environ["PYSPARK_PYTHON"] = sys.executable
    from pyspark.sql import SparkSession

    jars = [f for f in glob.glob(JARS + "/*.jar")]
    b = (
        SparkSession.Builder().master(f"local[{cores}]")
        .appName(app)
        .config("spark.jars", ",".join(jars))
        .config("spark.ui.enabled", "false")
        .config("spark.sql.shuffle.partitions", "2")
        .config("spark.driver.host", "127.0.0.1")
        .config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions")
        .config(f"spark.sql.catalog.{CATALOG}", "org.apache.iceberg.spark.SparkCatalog")
        .config(f"spark.sql.catalog.{CATALOG}.warehouse", os.path.join(root, "wh"))
    )
    if kind == "jdbc":
        b = (
            b.config(f"spark.sql.catalog.{CATALOG}.catalog-impl", "org.apache.iceberg.jdbc.JdbcCatalog")
            .config(f"spark.sql.catalog.{CATALOG}.uri", "jdbc:sqlite:" + os.path.join(root, "catalog.db"))
            .config(f"spark.sql.catalog.{CATALOG}.jdbc.schema-version", "V1")
        )
    elif kind == "hadoop":
        b = b.config(f"spark.sql.catalog.{CATALOG}.type", "hadoop")
    else:
        raise ValueError(kind)
    for k, v in (extra or {}).items():
        b = b.config(k, v)
    spark = b.getOrCreate()
    spark.sparkContext.setLogLevel("ERROR")
    return spark


def pyiceberg_catalog(root):
    """The same catalog that get_spark(root, "jdbc") uses, opened from PyIceberg."""
    from pyiceberg.catalog import load_catalog

    return load_catalog(
        CATALOG, **{"type": "sql", "uri": "sqlite:///" + os.path.join(root, "catalog.db"), "warehouse": "file://" + os.path.join(root, "wh")}
    )


def table_dir(root, ident):
    """Directory of a table `db.t` in the warehouse."""
    return os.path.join(root, "wh", *ident.split("."))


def files(root, ident, sub=""):
    """Sorted relative paths of every file under a table's directory (or under `sub` of it)."""
    base = table_dir(root, ident)
    out = []
    for p in glob.glob(os.path.join(base, sub, "**", "*"), recursive=True):
        if os.path.isfile(p):
            out.append(os.path.relpath(p, base))
    return sorted(out)


def metadata_files(root, ident):
    """The metadata.json files of a table, oldest first."""
    return sorted(glob.glob(os.path.join(table_dir(root, ident), "metadata", "*.metadata.json")))


def current_metadata(root, ident):
    """(path, parsed JSON) of the newest metadata.json, as an engine reads it for a Hadoop-style table."""
    p = metadata_files(root, ident)[-1]
    with open(p) as f:
        return p, json.load(f)


def show(df, n=20, truncate=False):
    """Print a Spark DataFrame the way the lessons show it."""
    df.show(n, truncate=truncate)
