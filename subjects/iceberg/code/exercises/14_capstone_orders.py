"""Lesson 14 (capstone): an orders table fed by two writers, audited on a branch, corrected, read downstream and kept healthy.

    uv run python exercises/14_capstone_orders.py       (on Windows this re-launches itself in WSL, see run_wsl.sh)

Puts the earlier lessons together and asserts the state after each stage: a Spark batch and a PyIceberg batch land in the table,
the PyIceberg batch is first written to a branch where a bad row is found and removed before main sees it, a late correction is
a MERGE, a downstream reader follows the changes with the changelog view, and maintenance keeps one tagged snapshot.
"""

import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import pyarrow as pa  # noqa: E402

from lab import fresh_root, get_spark, pyiceberg_catalog, relaunch_in_wsl_if_windows, show  # noqa: E402

relaunch_in_wsl_if_windows(__file__)


def total(spark, q="SELECT round(sum(amount), 2) FROM lab.db.orders"):
    return spark.sql(q).first()[0]


def main():
    root = fresh_root("14_capstone_orders")
    spark = get_spark(root)
    spark.sql("CREATE NAMESPACE lab.db")
    spark.sql(
        """CREATE TABLE lab.db.orders (order_id bigint, customer string, amount double, ordered_at timestamp)
           USING iceberg PARTITIONED BY (days(ordered_at))
           TBLPROPERTIES ('format-version' = '2', 'write.merge.mode' = 'merge-on-read', 'write.delete.mode' = 'merge-on-read')"""
    )

    # ---- 1. the first writer is a Spark batch ----------------------------------------------------------------
    spark.sql(
        """INSERT INTO lab.db.orders VALUES
           (1, 'ann', 120.0, TIMESTAMP'2026-01-01 09:00:00'), (2, 'bob', 80.5, TIMESTAMP'2026-01-01 15:30:00'),
           (3, 'ann', 42.0, TIMESTAMP'2026-01-02 10:00:00')"""
    )
    bookmark = spark.sql("SELECT snapshot_id FROM lab.db.orders.snapshots ORDER BY committed_at DESC").first().snapshot_id    # what a downstream job has read up to
    assert spark.table("lab.db.orders").count() == 3 and total(spark) == 242.5

    # ---- 2. the second writer is PyIceberg; its batch goes to a branch first -----------------------------------
    cat = pyiceberg_catalog(root)
    t = cat.load_table("db.orders")
    spark.sql("ALTER TABLE lab.db.orders CREATE BRANCH audit")
    batch = pa.table(
        {
            "order_id": pa.array([4, 5, 6], pa.int64()),
            "customer": ["cara", "dan", "bad"],
            "amount": pa.array([300.0, 15.0, -9.0]),                                 # the last row is wrong
            "ordered_at": pa.array([datetime(2026, 1, 3, h, tzinfo=timezone.utc) for h in (8, 9, 10)], pa.timestamp("us", tz="UTC")),
        }
    )
    t.append(batch, branch="audit")
    assert spark.table("lab.db.orders").count() == 3                                  # main has not moved: readers see nothing of it yet
    bad = spark.sql("SELECT count(*) FROM lab.db.orders VERSION AS OF 'audit' WHERE amount < 0").first()[0]
    print("audit finds", bad, "bad row on the branch")
    assert bad == 1

    # ---- 3. fix it on the branch, then publish ---------------------------------------------------------------------
    spark.sql("DELETE FROM lab.db.orders.branch_audit WHERE amount < 0")
    assert spark.sql("SELECT count(*) FROM lab.db.orders VERSION AS OF 'audit' WHERE amount < 0").first()[0] == 0
    assert spark.table("lab.db.orders").count() == 3                                  # still unpublished
    try:
        spark.sql("CALL lab.system.fast_forward('db.orders', 'main', 'audit')")
        published = "fast_forward"
    except Exception as e:  # noqa: BLE001
        published = "fast_forward failed: " + str(e).splitlines()[0][:100]
    print("publish:", published)
    assert published == "fast_forward"
    assert sorted(r.order_id for r in spark.table("lab.db.orders").collect()) == [1, 2, 3, 4, 5]
    spark.sql("ALTER TABLE lab.db.orders DROP BRANCH audit")
    month_end = spark.sql("SELECT snapshot_id FROM lab.db.orders.snapshots ORDER BY committed_at DESC").first().snapshot_id
    spark.sql(f"ALTER TABLE lab.db.orders CREATE TAG month_end AS OF VERSION {month_end} RETAIN 365 DAYS")

    # ---- 4. a late correction is a MERGE (merge-on-read: a delete file and a new data file) ------------------------
    spark.sql(
        """MERGE INTO lab.db.orders t USING (SELECT 2L AS order_id, 'bob' AS customer, 85.0 AS amount, TIMESTAMP'2026-01-01 15:30:00' AS ordered_at) s
           ON t.order_id = s.order_id WHEN MATCHED THEN UPDATE SET amount = s.amount WHEN NOT MATCHED THEN INSERT *"""
    )
    assert total(spark) == 120.0 + 85.0 + 42.0 + 300.0 + 15.0
    assert spark.sql("SELECT count(*) FROM lab.db.orders.files WHERE content = 1").first()[0] >= 1       # a position delete file exists

    # ---- 5. a downstream reader follows the changes since its bookmark ---------------------------------------------
    # The changelog view cannot read a snapshot range that holds delete files (our MERGE wrote one) ...
    try:
        spark.sql(f"CALL lab.system.create_changelog_view(table => 'db.orders', options => map('start-snapshot-id', '{bookmark}'), changelog_view => 'chg')")
        spark.sql("SELECT * FROM chg").collect()
        changelog = "worked"
    except Exception as e:  # noqa: BLE001
        changelog = str(e).splitlines()[0][:90]
    print("changelog over a merge-on-read delete:", changelog)
    assert "Delete files are currently not supported in changelog scans" in changelog
    # ... so this downstream job compares the table at its bookmark with the table now
    old = {r.order_id: r.amount for r in spark.sql(f"SELECT order_id, amount FROM lab.db.orders VERSION AS OF {bookmark}").collect()}
    new = {r.order_id: r.amount for r in spark.table("lab.db.orders").collect()}
    inserted = sorted(set(new) - set(old))
    updated = sorted(k for k in old if k in new and old[k] != new[k])
    deleted = sorted(set(old) - set(new))
    print("since the bookmark: inserted", inserted, "updated", updated, "deleted", deleted)
    assert (inserted, updated, deleted) == ([4, 5], [2], [])
    assert 6 not in new                                                                # the bad row never reached main

    # ---- 6. maintenance: compact (which also applies the deletes), then expire everything except main and the tag ------
    print("delete files before compaction:", [(r.file_path[-30:], r.record_count) for r in spark.sql("SELECT file_path, record_count FROM lab.db.orders.files WHERE content = 1").collect()])
    rw = spark.sql("CALL lab.system.rewrite_data_files(table => 'db.orders', options => map('rewrite-all', 'true'))").first()
    print("rewrite_data_files:", rw.asDict())
    print("delete files after compaction:", [(r.file_path[-30:], r.record_count) for r in spark.sql("SELECT file_path, record_count FROM lab.db.orders.files WHERE content = 1").collect()])
    live = {r.file_path for r in spark.sql("SELECT file_path FROM lab.db.orders.files WHERE content = 0").collect()}
    pd_rows = spark.sql("SELECT file_path, pos FROM lab.db.orders.position_deletes").collect()
    print("remaining position deletes point at live data files:", [(r.file_path in live, r.pos) for r in pd_rows])
    assert len(pd_rows) == 1 and pd_rows[0].file_path not in live                                         # a dangling delete file: its data file was rewritten, the note stays
    spark.conf.set("spark.sql.session.timeZone", "UTC")
    spark.sql("CALL lab.system.expire_snapshots(table => 'db.orders', older_than => TIMESTAMP'2099-01-01 00:00:00', retain_last => 1)")
    refs = {r.name for r in spark.sql("SELECT name FROM lab.db.orders.refs").collect()}
    assert refs == {"main", "month_end"}
    assert spark.sql(f"SELECT count(*) FROM lab.db.orders VERSION AS OF 'month_end'").first()[0] == 5   # the tagged month end is still readable
    assert spark.table("lab.db.orders").count() == 5 and total(spark) == 120.0 + 85.0 + 42.0 + 300.0 + 15.0

    # ---- 7. and PyIceberg still reads the final table -----------------------------------------------------------------
    final = cat.load_table("db.orders").scan().to_arrow().to_pylist()
    assert sorted(r["order_id"] for r in final) == [1, 2, 3, 4, 5] and abs(sum(r["amount"] for r in final) - 562.0) < 1e-9
    print("final snapshots:", [(r.operation) for r in spark.sql("SELECT operation FROM lab.db.orders.snapshots ORDER BY committed_at").collect()])
    print("ok")


if __name__ == "__main__":
    main()
