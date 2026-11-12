"""Lesson 13: format versions 1, 2 and 3, views, and statistics in Puffin files.

    uv run python exercises/13_spec_versions_views_stats.py       (on Windows this re-launches itself in WSL, see run_wsl.sh)

Asserts what a table of each format version records, that merge-on-read needs version 2 or later, that the version can be raised
but not lowered, what the row lineage columns of version 3 hold, how a view is stored in the catalog, and that
compute_table_stats writes a Puffin file that metadata.json refers to.
"""

import glob
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from lab import current_metadata, files, fresh_root, get_spark, pyiceberg_catalog, relaunch_in_wsl_if_windows, show, table_dir  # noqa: E402

relaunch_in_wsl_if_windows(__file__)


def main():
    root = fresh_root("13_spec_versions_views_stats")
    spark = get_spark(root)
    spark.sql("CREATE NAMESPACE lab.db")

    # ---- 1. the version a table is created with -----------------------------------------------------------------
    for v in (1, 2, 3):
        spark.sql(f"CREATE TABLE lab.db.v{v} (id bigint, name string) USING iceberg TBLPROPERTIES ('format-version' = '{v}')")
        spark.sql(f"INSERT INTO lab.db.v{v} VALUES (1, 'a'), (2, 'b'), (3, 'c')")
        assert current_metadata(root, f"db.v{v}")[1]["format-version"] == v
    spark.sql("CREATE TABLE lab.db.dflt (id bigint) USING iceberg")
    default_v = current_metadata(root, "db.dflt")[1]["format-version"]
    print("a table created without a version:", default_v)
    assert default_v == 2

    # what the metadata.json of each version carries
    keys = {v: set(current_metadata(root, f"db.v{v}")[1]) for v in (1, 2, 3)}
    print("v3 keys that v2 does not have:", sorted(keys[3] - keys[2]))
    print("v1 keys that v2 does not have:", sorted(keys[1] - keys[2]), "| v2 keys that v1 does not have:", sorted(keys[2] - keys[1]))
    assert "last-sequence-number" in keys[2] and "last-sequence-number" not in keys[1]          # sequence numbers start in v2
    snap_v3 = current_metadata(root, "db.v3")[1]["snapshots"][0]
    print("v3 snapshot keys:", sorted(snap_v3))
    assert "first-row-id" in snap_v3 and "added-rows" in snap_v3                                  # row lineage fields
    assert "next-row-id" in keys[3] and "next-row-id" not in keys[2]

    # ---- 2. merge-on-read needs delete files, which version 1 does not have --------------------------------------
    spark.sql("ALTER TABLE lab.db.v1 SET TBLPROPERTIES ('write.delete.mode' = 'merge-on-read')")
    try:
        spark.sql("DELETE FROM lab.db.v1 WHERE id = 1")
        err = None
    except Exception as e:  # noqa: BLE001
        err = str(e).splitlines()[0]
    print("v1 delete with merge-on-read:", err)
    assert err == "Deletes are supported in V2 and above"
    assert spark.sql("SELECT count(*) FROM lab.db.v1").first()[0] == 3

    # ---- 3. raise the version, never lower it ---------------------------------------------------------------------
    spark.sql("ALTER TABLE lab.db.v1 SET TBLPROPERTIES ('format-version' = '2')")
    assert current_metadata(root, "db.v1")[1]["format-version"] == 2
    spark.sql("ALTER TABLE lab.db.v1 SET TBLPROPERTIES ('format-version' = '3')")
    assert current_metadata(root, "db.v1")[1]["format-version"] == 3
    try:
        spark.sql("ALTER TABLE lab.db.v1 SET TBLPROPERTIES ('format-version' = '2')")
        lowered = None
    except Exception as e:  # noqa: BLE001
        lowered = (getattr(e, "java_exception", None) and e.java_exception.getCause() and str(e.java_exception.getCause().getMessage())) or str(e).splitlines()[0]
    print("lowering the version:", lowered[:120])
    assert lowered is not None

    # ---- 4. row lineage in version 3 ---------------------------------------------------------------------------
    rows = spark.sql("SELECT id, _row_id, _last_updated_sequence_number FROM lab.db.v3 ORDER BY id").collect()
    print("row lineage of v3:", [(r.id, r._row_id, r._last_updated_sequence_number) for r in rows])
    assert [r._row_id for r in rows] == [0, 1, 2] and {r._last_updated_sequence_number for r in rows} == {1}
    spark.sql("UPDATE lab.db.v3 SET name = 'B' WHERE id = 2")
    rows = {r.id: (r._row_id, r._last_updated_sequence_number) for r in spark.sql("SELECT id, _row_id, _last_updated_sequence_number FROM lab.db.v3").collect()}
    print("after UPDATE of id 2:", rows)
    assert rows[2][0] == 1 and rows[2][1] == 2 and rows[1] == (0, 1)                             # same row id, newer sequence number

    # ---- 5. views are stored in the catalog next to tables ----------------------------------------------------
    spark.sql("CREATE VIEW lab.db.big_ids AS SELECT id, name FROM lab.db.v3 WHERE id >= 2")
    assert sorted(r.id for r in spark.sql("SELECT id FROM lab.db.big_ids").collect()) == [2, 3]
    import sqlite3

    kinds = dict(sqlite3.connect(os.path.join(root, "catalog.db")).execute("SELECT table_name, iceberg_type FROM iceberg_tables").fetchall())
    print("catalog rows:", {k: kinds[k] for k in ("v3", "big_ids")})
    assert kinds["big_ids"] == "VIEW" and kinds["v3"] == "TABLE"
    vdir = os.path.join(table_dir(root, "db.big_ids"), "metadata")
    import gzip

    vfile = sorted(glob.glob(vdir + "/*.metadata.json"))[-1]
    raw = open(vfile, "rb").read()
    is_gzip = raw[:2] == bytes([0x1F, 0x8B])
    print("view metadata file is gzip-compressed:", is_gzip)
    vmeta = json.loads(gzip.decompress(raw) if is_gzip else raw)
    print("view metadata keys:", sorted(vmeta))
    assert vmeta["format-version"] == 1 and vmeta["versions"][0]["representations"][0]["type"] == "sql"
    cat = pyiceberg_catalog(root)
    try:
        print("PyIceberg sees views:", cat.list_views("db"))
    except Exception as e:  # noqa: BLE001
        print("PyIceberg list_views:", type(e).__name__, str(e)[:80])

    # ---- 6. statistics written as Puffin files --------------------------------------------------------------------
    res = spark.sql("CALL lab.system.compute_table_stats(table => 'db.v3')").first()
    print("compute_table_stats:", res.asDict())
    md = current_metadata(root, "db.v3")[1]
    print("statistics in metadata.json:", [(os.path.basename(s["statistics-path"]), [b["type"] for b in s["blob-metadata"]]) for s in md["statistics"]])
    assert len(md["statistics"]) == 1 and md["statistics"][0]["snapshot-id"] == md["current-snapshot-id"]
    assert os.path.basename(md["statistics"][0]["statistics-path"]).endswith(".stats")
    assert any(p.endswith(".stats") for p in files(root, "db.v3")) and md["statistics"][0]["blob-metadata"][0]["type"] == "apache-datasketches-theta-v1"
    magic = open(md["statistics"][0]["statistics-path"].replace("file:", ""), "rb").read(4)
    assert magic == b"PFA1"                                                                       # the Puffin magic bytes

    print("ok")


if __name__ == "__main__":
    main()
