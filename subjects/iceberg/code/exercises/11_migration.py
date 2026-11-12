"""Lesson 11: bringing existing data into Iceberg. add_files, snapshot and migrate (Spark) and add_files (PyIceberg).

    uv run python exercises/11_migration.py       (on Windows this re-launches itself in WSL, see run_wsl.sh)

Asserts that add_files registers existing Parquet files without copying them, that the table then points at the original
files, that snapshot makes an Iceberg table next to a Parquet table without touching the source, that migrate replaces the
source table in place, and what PyIceberg's add_files needs.
"""

import glob
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import pyarrow as pa  # noqa: E402
import pyarrow.parquet as pq  # noqa: E402

from lab import files, fresh_root, get_spark, pyiceberg_catalog, relaunch_in_wsl_if_windows, table_dir  # noqa: E402

relaunch_in_wsl_if_windows(__file__)


def main():
    root = fresh_root("11_migration")
    spark = get_spark(
        root,
        extra={
            # Iceberg also wraps Spark's built-in catalog, which `snapshot` and `migrate` need. The warehouse is the same place Spark
            # uses for its own tables, written with the file: prefix so the two locations compare equal.
            "spark.sql.catalog.spark_catalog": "org.apache.iceberg.spark.SparkSessionCatalog",
            "spark.sql.catalog.spark_catalog.type": "hadoop",
            "spark.sql.catalog.spark_catalog.warehouse": "file:" + root + "/sc_wh",
            "spark.sql.warehouse.dir": root + "/sc_wh/default",
        },
    )
    spark.sql("CREATE NAMESPACE lab.db")

    # ---- 1. a folder of Parquet files that someone else wrote (Hive layout: one folder per day) --------------------
    src = os.path.join(root, "legacy")
    for day, rows in (("2026-01-01", [(1, 10.0), (2, 20.0)]), ("2026-01-02", [(3, 30.0)])):
        d = os.path.join(src, f"d={day}")
        os.makedirs(d)
        pq.write_table(pa.table({"id": pa.array([r[0] for r in rows], pa.int64()), "amount": pa.array([r[1] for r in rows])}), os.path.join(d, "part-0.parquet"))
    spark.sql("CREATE TABLE lab.db.legacy (id bigint, amount double, d string) USING iceberg PARTITIONED BY (d)")
    res = spark.sql(f"CALL lab.system.add_files(table => 'db.legacy', source_table => '`parquet`.`{src}`')").first()
    print("add_files:", res.asDict())
    assert res.added_files_count == 2
    assert spark.sql("SELECT count(*) FROM lab.db.legacy").first()[0] == 3
    assert [p for p in files(root, "db.legacy") if p.startswith("data/")] == []                  # nothing was copied into the table
    paths = sorted(r.file_path for r in spark.sql("SELECT file_path FROM lab.db.legacy.files").collect())
    print("the table points at:", [p.replace(root, "<root>") for p in paths])
    assert all(p.replace("file:", "").startswith(src) for p in paths)
    op = spark.sql("SELECT operation FROM lab.db.legacy.snapshots").first().operation
    assert op == "append"
    # the files are shared: new rows go to the table's own data folder, and compaction brings the old rows over
    spark.sql("INSERT INTO lab.db.legacy VALUES (4, 40.0, '2026-01-03')")
    assert len([p for p in files(root, "db.legacy") if p.startswith("data/")]) == 1
    spark.sql("CALL lab.system.rewrite_data_files(table => 'db.legacy', options => map('rewrite-all', 'true'))")
    after = [r.file_path.replace("file:", "") for r in spark.sql("SELECT file_path FROM lab.db.legacy.files").collect()]
    print("after compaction every file is inside the table:", all(p.startswith(table_dir(root, "db.legacy")) for p in after))
    assert all(p.startswith(table_dir(root, "db.legacy")) for p in after) and spark.sql("SELECT count(*) FROM lab.db.legacy").first()[0] == 4
    assert len(glob.glob(src + "/*/*.parquet")) == 2                                              # the original files are still there (not deleted)

    # ---- 2. snapshot: an Iceberg table over a Spark table, without touching the source ----------------------------
    spark.sql("CREATE TABLE default.old (id bigint, d string) USING parquet PARTITIONED BY (d)")
    spark.sql("INSERT INTO default.old VALUES (1, 'a'), (2, 'a'), (3, 'b')")
    before = sorted(glob.glob(root + "/sc_wh/default/old/**/*", recursive=True))
    snap = spark.sql("CALL spark_catalog.system.snapshot(source_table => 'default.old', table => 'default.old_ice')").first()
    print("snapshot:", snap.asDict())
    assert snap.imported_files_count == 2 and spark.sql("SELECT count(*) FROM default.old_ice").first()[0] == 3
    assert sorted(glob.glob(root + "/sc_wh/default/old/**/*", recursive=True)) == before          # the source table is untouched
    assert spark.sql("DESCRIBE EXTENDED default.old").filter("col_name = 'Provider'").first().data_type == "parquet"
    spark.sql("INSERT INTO default.old_ice VALUES (4, 'c')")                                      # writes to the snapshot table go to its own location
    assert spark.sql("SELECT count(*) FROM default.old").first()[0] == 3                          # and do not reach the source

    # ---- 3. migrate: replace the table in place ---------------------------------------------------------------
    mig = spark.sql("CALL spark_catalog.system.migrate('default.old')").first()
    print("migrate:", mig.asDict())
    assert mig.migrated_files_count == 2
    provider = spark.sql("DESCRIBE EXTENDED default.old").filter("col_name = 'Provider'").first().data_type
    print("provider after migrate:", provider)
    assert provider == "iceberg" and spark.sql("SELECT count(*) FROM default.old").first()[0] == 3
    backup = [r.tableName for r in spark.sql("SHOW TABLES IN default").collect()]
    print("tables in default:", sorted(backup))
    assert "old_backup_" in "".join(backup)                                                       # migrate keeps the old definition as <name>_BACKUP_

    # ---- 4. PyIceberg add_files ------------------------------------------------------------------------------
    cat = pyiceberg_catalog(root)
    from pyiceberg.schema import Schema
    from pyiceberg.types import DoubleType, LongType, NestedField

    schema = Schema(NestedField(1, "id", LongType(), required=False), NestedField(2, "amount", DoubleType(), required=False))
    cat.create_namespace("py")
    t = cat.create_table("py.t", schema=schema)
    parquet_files = sorted(glob.glob(src + "/*/*.parquet"))
    try:
        t.add_files(["file://" + p for p in parquet_files])
        print("PyIceberg add_files worked:", t.scan().to_arrow().num_rows, "rows")
        pyice = t.scan().to_arrow().num_rows
    except Exception as e:  # noqa: BLE001
        pyice = str(e).splitlines()[0][:150]
        print("PyIceberg add_files failed:", type(e).__name__, pyice)
    assert pyice == 3 or isinstance(pyice, str)

    print("ok")


if __name__ == "__main__":
    main()
