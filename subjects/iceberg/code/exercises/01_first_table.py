"""Lesson 1: a first Iceberg table, written by Spark and read (and written) by PyIceberg.

    uv run python exercises/01_first_table.py       (on Windows this re-launches itself in WSL, see run_wsl.sh)

Asserts what the lesson says: what files a table is made of, where the catalog keeps the pointer, that PyIceberg sees the
rows Spark wrote, and that a second engine's commit is not visible to a Spark session until it refreshes the table.
"""

import os
import sqlite3
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from lab import (  # noqa: E402
    current_metadata,
    files,
    fresh_root,
    get_spark,
    metadata_files,
    pyiceberg_catalog,
    relaunch_in_wsl_if_windows,
    show,
)

relaunch_in_wsl_if_windows(__file__)


def main():
    root = fresh_root("01_first_table")
    spark = get_spark(root)

    # ---- 1. Spark creates a table and writes four rows -----------------------------------------------------
    spark.sql("CREATE NAMESPACE lab.db")
    spark.sql(
        """CREATE TABLE lab.db.orders (order_id bigint, customer string, amount double, ordered_at timestamp)
           USING iceberg PARTITIONED BY (days(ordered_at))"""
    )
    spark.sql(
        """INSERT INTO lab.db.orders VALUES
           (1, 'ann',  120.0, TIMESTAMP'2026-01-01 09:00:00'),
           (2, 'bob',   80.5, TIMESTAMP'2026-01-01 15:30:00'),
           (3, 'ann',   42.0, TIMESTAMP'2026-01-02 10:00:00'),
           (4, 'cara', 300.0, TIMESTAMP'2026-01-02 18:45:00')"""
    )
    assert spark.sql("SELECT count(*) FROM lab.db.orders").first()[0] == 4

    # ---- 2. What is on disk ------------------------------------------------------------------------------------
    listing = files(root, "db.orders")
    print("files of the table:")
    for p in listing:
        print("  ", p)
    data = [p for p in listing if p.startswith("data/")]
    meta = [p for p in listing if p.startswith("metadata/")]
    assert len(data) == 2 and all(p.endswith(".parquet") for p in data)           # one Parquet file per day
    assert {p.split("/")[1] for p in data} == {"ordered_at_day=2026-01-01", "ordered_at_day=2026-01-02"}
    assert len([p for p in meta if p.endswith(".metadata.json")]) == 2             # CREATE TABLE, then INSERT
    assert len([p for p in meta if p.endswith("-m0.avro")]) == 1                   # one manifest
    assert len([p for p in meta if p.startswith("metadata/snap-")]) == 1           # one manifest list

    # ---- 3. The catalog only stores a pointer ------------------------------------------------------------------
    con = sqlite3.connect(os.path.join(root, "catalog.db"))
    cols = [r[1] for r in con.execute("PRAGMA table_info(iceberg_tables)")]
    row = dict(zip(cols, con.execute("SELECT * FROM iceberg_tables").fetchone()))
    print("catalog row:", {k: (os.path.basename(v) if k.endswith("location") else v) for k, v in row.items()})
    path, md = current_metadata(root, "db.orders")
    assert row["metadata_location"] == path and row["previous_metadata_location"] == metadata_files(root, "db.orders")[0]
    assert row["table_namespace"] == "db" and row["table_name"] == "orders" and row["catalog_name"] == "lab"

    # ---- 4. Inside the metadata.json ---------------------------------------------------------------------------
    print("metadata.json keys:", sorted(md))
    assert md["format-version"] == 2 and md["location"].endswith("/wh/db/orders")
    assert [f["name"] for f in md["schemas"][0]["fields"]] == ["order_id", "customer", "amount", "ordered_at"]
    assert [f["id"] for f in md["schemas"][0]["fields"]] == [1, 2, 3, 4]           # every column has a field id
    assert len(md["snapshots"]) == 1 and md["current-snapshot-id"] == md["snapshots"][0]["snapshot-id"]
    summary = md["snapshots"][0]["summary"]
    print("snapshot summary:", summary)
    assert summary["operation"] == "append" and summary["added-records"] == "4" and summary["added-data-files"] == "2"
    assert summary["total-records"] == "4"

    # ---- 5. PyIceberg opens the same table through the same catalog -----------------------------------------
    cat = pyiceberg_catalog(root)
    assert cat.list_namespaces() == [("db",)] and cat.list_tables("db") == [("db", "orders")]
    tbl = cat.load_table("db.orders")
    print(tbl.schema())
    rows = tbl.scan().to_arrow().sort_by("order_id").to_pylist()
    assert [r["order_id"] for r in rows] == [1, 2, 3, 4] and rows[3]["customer"] == "cara"
    assert tbl.current_snapshot().snapshot_id == md["current-snapshot-id"]

    # ---- 6. PyIceberg commits a fifth row; the Spark session does not see it until it refreshes -------------
    import pyarrow as pa
    from datetime import datetime, timezone

    # Spark's `timestamp` is stored as Iceberg `timestamptz`, so PyIceberg wants a timezone on the Arrow column.
    assert str(tbl.schema().find_field("ordered_at").field_type) == "timestamptz"

    extra = pa.table(
        {
            "order_id": pa.array([5], pa.int64()),
            "customer": pa.array(["dan"]),
            "amount": pa.array([10.0]),
            "ordered_at": pa.array([datetime(2026, 1, 3, 8, 0, tzinfo=timezone.utc)], pa.timestamp("us", tz="UTC")),
        }
    )
    tbl.append(extra)
    assert len(metadata_files(root, "db.orders")) == 3                              # PyIceberg wrote metadata 00002
    before = spark.sql("SELECT count(*) FROM lab.db.orders").first()[0]
    spark.sql("REFRESH TABLE lab.db.orders")
    after = spark.sql("SELECT count(*) FROM lab.db.orders").first()[0]
    print("rows Spark saw before REFRESH TABLE:", before, "after:", after)
    assert (before, after) == (4, 5)

    # ---- 7. Spark appends on top of the new state; both engines' rows survive ------------------------------
    spark.sql("INSERT INTO lab.db.orders VALUES (6, 'eve', 7.0, TIMESTAMP'2026-01-03 09:00:00')")
    snaps = spark.sql("SELECT operation, summary['added-records'] AS added, summary['total-records'] AS total FROM lab.db.orders.snapshots ORDER BY committed_at")
    show(snaps)
    assert [(r.operation, r.added, r.total) for r in snaps.collect()] == [("append", "4", "4"), ("append", "1", "5"), ("append", "1", "6")]
    assert cat.load_table("db.orders").scan().to_arrow().num_rows == 6

    # ---- 8. the same, but Spark has NOT refreshed: PyIceberg commits row 7, then Spark inserts row 8 ----------
    tbl = cat.load_table("db.orders")
    tbl.append(extra.set_column(0, "order_id", pa.array([7], pa.int64())))
    seven = cat.load_table("db.orders").current_snapshot().snapshot_id
    assert spark.sql("SELECT count(*) FROM lab.db.orders").first()[0] == 6          # Spark still holds the table as of row 6
    spark.sql("INSERT INTO lab.db.orders VALUES (8, 'fay', 1.0, TIMESTAMP'2026-01-03 10:00:00')")
    last = spark.sql("SELECT snapshot_id, parent_id FROM lab.db.orders.snapshots ORDER BY committed_at DESC").first()
    print("Spark's snapshot has PyIceberg's snapshot as parent:", last.parent_id == seven)
    assert last.parent_id == seven                                                   # the commit was retried on top of PyIceberg's
    ids = sorted(r["order_id"] for r in cat.load_table("db.orders").scan().to_arrow().to_pylist())
    assert ids == [1, 2, 3, 4, 5, 6, 7, 8]                                            # nothing was lost

    print("ok")


if __name__ == "__main__":
    main()
