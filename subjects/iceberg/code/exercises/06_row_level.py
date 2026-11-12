"""Lesson 6: changing and deleting rows. Copy-on-write, merge-on-read, delete files and deletion vectors.

    uv run python exercises/06_row_level.py       (on Windows this re-launches itself in WSL, see run_wsl.sh)

Asserts what a DELETE, UPDATE and MERGE write in each mode: which files the snapshot adds and removes, what the `files`
table shows for the delete files, that PyIceberg reads the result, and what PyIceberg's own delete and upsert do.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from lab import fresh_root, get_spark, pyiceberg_catalog, relaunch_in_wsl_if_windows, show  # noqa: E402

relaunch_in_wsl_if_windows(__file__)

KEYS = ["added-data-files", "deleted-data-files", "added-delete-files", "added-position-deletes", "added-dvs", "total-data-files", "total-delete-files", "total-records"]


def last(spark, ident):
    r = spark.sql(f"SELECT operation, summary FROM {ident}.snapshots ORDER BY committed_at DESC").first()
    return r.operation, {k: int(r.summary[k]) for k in KEYS if k in r.summary}


def contents(spark, ident):
    """(content, count) of the live files: 0 data, 1 position deletes, 2 equality deletes."""
    rows = spark.sql(f"SELECT content, file_format, count(*) AS n FROM {ident}.all_files GROUP BY content, file_format ORDER BY content").collect()
    return [(r.content, r.file_format, r.n) for r in rows]


def main():
    root = fresh_root("06_row_level")
    spark = get_spark(root)
    spark.sql("CREATE NAMESPACE lab.db")
    fill = "INSERT INTO {t} SELECT id, CASE WHEN id % 2 = 0 THEN 'even' ELSE 'odd' END, id * 10 FROM range(1, 11)"

    # ---- 1. copy-on-write (the default): the whole file is rewritten -------------------------------------------
    spark.sql("CREATE TABLE lab.db.cow (id bigint, grp string, v bigint) USING iceberg")
    props = spark.sql("SHOW TBLPROPERTIES lab.db.cow").collect()
    modes = {r.key: r.value for r in props if r.key.startswith("write.") and r.key.endswith(".mode")}
    print("write modes stored on a new table:", modes)
    assert modes == {}                                                   # nothing stored: the default (copy-on-write) comes from the code
    spark.sql(fill.format(t="lab.db.cow"))
    spark.sql("DELETE FROM lab.db.cow WHERE id = 3")
    op, s = last(spark, "lab.db.cow")
    print("COW delete one row:", op, s)
    assert op == "overwrite" and s["added-data-files"] == 1 and s["deleted-data-files"] == 1 and s["total-data-files"] == 1
    assert s["total-records"] == 9 and s.get("total-delete-files", 0) == 0
    assert spark.sql("SELECT count(*) FROM lab.db.cow").first()[0] == 9

    # ---- 2. merge-on-read, format version 2: a position delete file next to the untouched data file --------------
    spark.sql(
        "CREATE TABLE lab.db.mor2 (id bigint, grp string, v bigint) USING iceberg TBLPROPERTIES ('format-version'='2', "
        "'write.delete.mode'='merge-on-read', 'write.update.mode'='merge-on-read', 'write.merge.mode'='merge-on-read')"
    )
    spark.sql(fill.format(t="lab.db.mor2"))
    spark.sql("DELETE FROM lab.db.mor2 WHERE id = 3")
    op, s = last(spark, "lab.db.mor2")
    print("MOR v2 delete one row:", op, s)
    assert op == "delete" and s["added-delete-files"] == 1 and s["added-position-deletes"] == 1
    assert s["total-data-files"] == 1 and s["total-delete-files"] == 1 and s["total-records"] == 10      # the data file still says 10
    kinds = contents(spark, "lab.db.mor2")
    print("files of the table (content, format, count):", kinds)
    assert kinds == [(0, "PARQUET", 1), (1, "PARQUET", 1)]
    assert spark.sql("SELECT count(*) FROM lab.db.mor2").first()[0] == 9                                  # readers apply the delete
    pos = spark.sql("SELECT * FROM lab.db.mor2.position_deletes").collect()
    print("position_deletes table:", [(r.pos, os.path.basename(r.file_path)[:12]) for r in pos])
    assert len(pos) == 1 and pos[0].pos == 2                                                              # row at position 2 (id 3) of the file

    # UPDATE in merge-on-read = delete the old row + write the new row in a new data file
    spark.sql("UPDATE lab.db.mor2 SET v = 999 WHERE id = 5")
    op, s = last(spark, "lab.db.mor2")
    print("MOR v2 update one row:", op, s)
    assert s["added-data-files"] == 1 and s["added-delete-files"] == 1
    assert spark.sql("SELECT v FROM lab.db.mor2 WHERE id = 5").first()[0] == 999

    # MERGE INTO: update matched rows, insert the others, in one commit
    spark.sql(
        """MERGE INTO lab.db.mor2 t USING (SELECT 5L AS id, 'even' AS grp, 5000L AS v UNION ALL SELECT 77L, 'odd', 770L) s
           ON t.id = s.id WHEN MATCHED THEN UPDATE SET v = s.v WHEN NOT MATCHED THEN INSERT *"""
    )
    got = {r.id: r.v for r in spark.sql("SELECT id, v FROM lab.db.mor2 WHERE id IN (5, 77)").collect()}
    assert got == {5: 5000, 77: 770}
    op, s = last(spark, "lab.db.mor2")
    print("MOR v2 merge:", op, s)

    # PyIceberg reads a table with position deletes and applies them
    cat = pyiceberg_catalog(root)
    t2 = cat.load_table("db.mor2")
    ids = sorted(r["id"] for r in t2.scan().to_arrow().to_pylist())
    assert 3 not in ids and 5 in ids and 77 in ids and len(ids) == spark.table("lab.db.mor2").count()

    # ---- 3. format version 3: the delete is a deletion vector in a Puffin file -----------------------------------
    spark.sql(
        "CREATE TABLE lab.db.mor3 (id bigint, grp string, v bigint) USING iceberg TBLPROPERTIES ('format-version'='3', "
        "'write.delete.mode'='merge-on-read', 'write.update.mode'='merge-on-read', 'write.merge.mode'='merge-on-read')"
    )
    spark.sql(fill.format(t="lab.db.mor3"))
    spark.sql("DELETE FROM lab.db.mor3 WHERE id IN (3, 4)")
    op, s = last(spark, "lab.db.mor3")
    print("MOR v3 delete two rows:", op, s)
    kinds3 = contents(spark, "lab.db.mor3")
    print("files of the v3 table:", kinds3)
    assert kinds3 == [(0, "PARQUET", 1), (1, "PUFFIN", 1)]
    assert s.get("added-dvs") == 1 and spark.sql("SELECT count(*) FROM lab.db.mor3").first()[0] == 8
    t3 = cat.load_table("db.mor3")
    try:
        n3 = t3.scan().to_arrow().num_rows
        print("PyIceberg reads the v3 table with a deletion vector:", n3, "rows")
    except Exception as e:  # noqa: BLE001
        n3 = None
        print("PyIceberg 0.12.0 cannot read the v3 table with a deletion vector:", type(e).__name__, str(e)[:100])
    assert n3 in (8, None)

    # ---- 4. a delete that covers whole files is metadata-only ------------------------------------------------
    spark.sql("CREATE TABLE lab.db.byday (id bigint, d date) USING iceberg PARTITIONED BY (d)")
    spark.sql("INSERT INTO lab.db.byday VALUES (1, DATE'2026-01-01'), (2, DATE'2026-01-01'), (3, DATE'2026-01-02')")
    spark.sql("DELETE FROM lab.db.byday WHERE d = DATE'2026-01-01'")
    op, s = last(spark, "lab.db.byday")
    print("delete a whole partition:", op, s)
    assert op == "delete" and s["deleted-data-files"] == 1 and "added-data-files" not in s and spark.table("lab.db.byday").count() == 1

    # ---- 5. PyIceberg: delete rewrites the file, upsert is not merge-on-read --------------------------------
    import pyarrow as pa

    tc = cat.load_table("db.cow")
    tc.delete("id = 4")
    spark.sql("REFRESH TABLE lab.db.cow")
    op, s = last(spark, "lab.db.cow")
    print("PyIceberg delete one row:", op, s)
    assert op == "overwrite" and s["added-data-files"] == 1 and s["deleted-data-files"] == 1 and s["total-records"] == 8
    up = tc.upsert(pa.table({"id": pa.array([1, 100], pa.int64()), "grp": ["odd", "new"], "v": pa.array([-1, 1000], pa.int64())}), join_cols=["id"])
    print("PyIceberg upsert:", up)
    assert (up.rows_updated, up.rows_inserted) == (1, 1)
    spark.sql("REFRESH TABLE lab.db.cow")
    rows = spark.sql("SELECT id, v FROM lab.db.cow WHERE id IN (1, 100)").collect()
    assert sorted((r.id, r.v) for r in rows) == [(1, -1), (100, 1000)]                    # one row each: no duplicates
    ops3 = [r.operation for r in spark.sql("SELECT operation FROM lab.db.cow.snapshots ORDER BY committed_at DESC LIMIT 3").collect()]
    print("PyIceberg upsert wrote 3 commits (newest first):", ops3)
    assert ops3 == ["append", "append", "overwrite"]                                       # rewrite of the matched row, append of it, append of the new row
    assert spark.sql("SELECT count(*) FROM lab.db.cow").first()[0] == 9                  # 8 rows + 1 inserted

    show(spark.sql("SELECT 'mor2' AS tbl, content, count(*) AS files FROM lab.db.mor2.all_files GROUP BY content UNION ALL SELECT 'mor3', content, count(*) FROM lab.db.mor3.all_files GROUP BY content ORDER BY 1, 2"))
    print("ok")


if __name__ == "__main__":
    main()
