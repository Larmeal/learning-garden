"""Lesson 9: catalogs. Where the pointer lives (a database or the directory itself), how engines are configured, drop and rename.

    uv run python exercises/09_catalogs.py       (on Windows this re-launches itself in WSL, see run_wsl.sh)

Asserts what the Hadoop catalog writes (version-hint.text, vN.metadata.json), that PyIceberg can open such a table by its
metadata file, that register_table attaches an existing table to another catalog, how PyIceberg is configured through
environment variables, that Spark's catalog cache hides another engine's commit unless it is switched off, and what DROP TABLE,
DROP TABLE PURGE and RENAME do to the files.
"""

import glob
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

# PyIceberg reads PYICEBERG_* variables once, when it is imported, so they are set before the first import of it.
_ROOT = "/tmp/iceberg-lab/09_catalogs"
os.environ["PYICEBERG_CATALOG__LAB__TYPE"] = "sql"
os.environ["PYICEBERG_CATALOG__LAB__URI"] = "sqlite:///" + _ROOT + "/catalog.db"
os.environ["PYICEBERG_CATALOG__LAB__WAREHOUSE"] = "file://" + _ROOT + "/wh"

import pyarrow as pa  # noqa: E402

from lab import files, fresh_root, get_spark, metadata_files, pyiceberg_catalog, relaunch_in_wsl_if_windows, table_dir  # noqa: E402

relaunch_in_wsl_if_windows(__file__)


def main():
    root = fresh_root("09_catalogs")
    assert root == _ROOT
    root_h = os.path.join(root, "hadoop_wh")
    os.makedirs(root_h)
    spark = get_spark(
        root,
        kind="jdbc",
        extra={
            "spark.sql.catalog.lab.cache-enabled": "false",
            "spark.sql.catalog.hlab": "org.apache.iceberg.spark.SparkCatalog",     # a second catalog in the same session
            "spark.sql.catalog.hlab.type": "hadoop",
            "spark.sql.catalog.hlab.warehouse": root_h,
        },
    )

    # ---- 1. Hadoop catalog: the directory is the catalog ----------------------------------------------------
    spark.sql("CREATE NAMESPACE hlab.db")
    spark.sql("CREATE TABLE hlab.db.t (id bigint) USING iceberg")
    spark.sql("INSERT INTO hlab.db.t VALUES (1)")
    spark.sql("INSERT INTO hlab.db.t VALUES (2)")
    tdir = os.path.join(root_h, "db", "t")
    meta = sorted(os.path.relpath(p, tdir) for p in glob.glob(tdir + "/metadata/*") if not p.endswith(".avro"))
    print("Hadoop catalog metadata files:", meta)
    assert meta == ["metadata/v1.metadata.json", "metadata/v2.metadata.json", "metadata/v3.metadata.json", "metadata/version-hint.text"]
    hint = open(os.path.join(tdir, "metadata", "version-hint.text")).read().strip()
    assert hint == "3"                                                              # the pointer is a file that holds the latest version number
    # PyIceberg has no Hadoop catalog, but any table can be opened from its metadata file
    from pyiceberg.table import StaticTable

    st = StaticTable.from_metadata("file://" + os.path.join(tdir, "metadata", "v3.metadata.json"))
    assert sorted(r["id"] for r in st.scan().to_arrow().to_pylist()) == [1, 2]

    # ---- 2. JDBC catalog: the pointer is a row; register_table attaches an existing table elsewhere -----------
    spark.sql("CREATE NAMESPACE lab.db")
    spark.sql("CREATE TABLE lab.db.t (id bigint, v string) USING iceberg")
    spark.sql("INSERT INTO lab.db.t VALUES (1, 'a'), (2, 'b')")
    latest = metadata_files(root, "db.t")[-1]
    spark.sql("CREATE NAMESPACE lab.other")
    spark.sql(f"CALL lab.system.register_table(table => 'other.copy', metadata_file => '{latest}')")
    assert spark.sql("SELECT count(*) FROM lab.other.copy").first()[0] == 2
    print("registered:", [r.tableName for r in spark.sql("SHOW TABLES IN lab.other").collect()], "and the same files:", len(files(root, "db.t")) == len(files(root, "db.t")))

    # ---- 3. the catalog cache of Spark -----------------------------------------------------------------------
    cat = pyiceberg_catalog(root)
    t = cat.load_table("db.t")
    t.append(pa.table({"id": pa.array([3], pa.int64()), "v": ["c"]}))
    seen = spark.sql("SELECT count(*) FROM lab.db.t").first()[0]
    print("cache-enabled=false: Spark sees the PyIceberg commit without REFRESH:", seen)
    assert seen == 3                                                                # with the cache on (lesson 1) this stays at 2 until REFRESH TABLE

    # ---- 4. PyIceberg is configured from environment variables or .pyiceberg.yaml -----------------------------
    from pyiceberg.catalog import load_catalog

    c2 = load_catalog("lab")                                                       # no arguments: everything comes from the environment
    assert c2.list_tables("db") == [("db", "t")] and c2.load_table("db.t").scan().to_arrow().num_rows == 3
    print("PyIceberg catalog loaded from PYICEBERG_CATALOG__LAB__* variables")

    # ---- 5. rename, drop, purge ---------------------------------------------------------------------------------
    where = table_dir(root, "db.t")
    spark.sql("ALTER TABLE lab.db.t RENAME TO db.t2")
    assert os.path.isdir(where) and not os.path.isdir(table_dir(root, "db.t2"))       # the files did not move: only the catalog row changed
    assert spark.sql("SELECT count(*) FROM lab.db.t2").first()[0] == 3
    spark.sql("DROP TABLE lab.db.t2")                                               # without PURGE: only the catalog row goes
    assert not any("t2" == r.tableName for r in spark.sql("SHOW TABLES IN lab.db").collect())
    n_after_drop = len(files(root, "db.t"))
    print("files left after DROP TABLE:", n_after_drop)
    assert n_after_drop > 0 and spark.sql("SELECT count(*) FROM lab.other.copy").first()[0] == 2   # the registered copy still reads them
    spark.sql("CREATE TABLE lab.db.p (id bigint) USING iceberg")
    spark.sql("INSERT INTO lab.db.p VALUES (1)")
    assert len(files(root, "db.p")) > 0
    spark.sql("DROP TABLE lab.db.p PURGE")
    left = files(root, "db.p")
    print("files left after DROP TABLE PURGE:", left)
    assert left == []

    print("ok")


if __name__ == "__main__":
    main()
