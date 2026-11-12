"""Lesson 10: keeping a table healthy. Compaction, manifest rewrite, expiring snapshots, orphan files.

    uv run python exercises/10_maintenance.py       (on Windows this re-launches itself in WSL, see run_wsl.sh)

Builds a table by 20 small INSERTs and asserts what each Spark procedure changes: rewrite_data_files (small files into one,
a `replace` snapshot), rewrite_manifests, expire_snapshots (which files go, which snapshots can no longer be read, a tag keeps
one alive) and remove_orphan_files (a stray file is found and removed, files of live snapshots stay).
"""

import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from lab import files, fresh_root, get_spark, pyiceberg_catalog, relaunch_in_wsl_if_windows, show, table_dir  # noqa: E402

relaunch_in_wsl_if_windows(__file__)


def counts(spark, root):
    listing = files(root, "db.t")
    return {
        "data files on disk": len([p for p in listing if p.startswith("data/")]),
        "data files in the current snapshot": spark.sql("SELECT count(*) FROM lab.db.t.files").first()[0],
        "manifests in the current snapshot": spark.sql("SELECT count(*) FROM lab.db.t.manifests").first()[0],
        "snapshots": spark.sql("SELECT count(*) FROM lab.db.t.snapshots").first()[0],
        "metadata.json": len([p for p in listing if p.endswith(".metadata.json")]),
        "all files on disk": len(listing),
    }


def main():
    root = fresh_root("10_maintenance")
    spark = get_spark(root)
    spark.sql("CREATE NAMESPACE lab.db")
    spark.sql("CREATE TABLE lab.db.t (id bigint, grp int) USING iceberg")
    for i in range(1, 21):
        spark.sql(f"INSERT INTO lab.db.t VALUES ({i}, {i % 4})")
    c0 = counts(spark, root)
    print("after 20 small inserts:", c0)
    assert c0["data files in the current snapshot"] == 20 and c0["manifests in the current snapshot"] == 20 and c0["snapshots"] == 20
    expected_rows = sorted(r.id for r in spark.table("lab.db.t").collect())
    snap_first = spark.sql("SELECT snapshot_id FROM lab.db.t.snapshots ORDER BY committed_at").first().snapshot_id

    # ---- 1. manifests: 20 small manifests into one ------------------------------------------------------------
    r2 = spark.sql("CALL lab.system.rewrite_manifests('db.t')").first()
    print("rewrite_manifests:", r2.asDict())
    assert r2.rewritten_manifests_count == 20 and r2.added_manifests_count == 1
    assert spark.sql("SELECT count(*) FROM lab.db.t.manifests").first()[0] == 1
    assert spark.sql("SELECT count(*) FROM lab.db.t.files").first()[0] == 20                     # still 20 data files, listed in one manifest
    assert sorted(r.id for r in spark.table("lab.db.t").collect()) == expected_rows

    # ---- 2. compaction: many small files into few big ones ------------------------------------------------------
    res = spark.sql("CALL lab.system.rewrite_data_files(table => 'db.t')").first()
    print("rewrite_data_files:", res.asDict())
    assert res.rewritten_data_files_count == 20 and res.added_data_files_count == 1
    c1 = counts(spark, root)
    print("after compaction:", c1)
    assert c1["data files in the current snapshot"] == 1 and c1["snapshots"] == 22
    assert c1["data files on disk"] == 21                                            # the 20 old files are still there: older snapshots use them
    assert sorted(r.id for r in spark.table("lab.db.t").collect()) == expected_rows   # same rows
    last = spark.sql("SELECT operation FROM lab.db.t.snapshots ORDER BY committed_at DESC").first().operation
    assert last == "replace"                                                         # same data, different files

    # a sorted rewrite, and a z-order rewrite (only one file here, but the strategy is accepted)
    spark.sql("CALL lab.system.rewrite_data_files(table => 'db.t', strategy => 'sort', sort_order => 'id DESC', options => map('rewrite-all', 'true'))")
    assert [r.id for r in spark.sql("SELECT id FROM lab.db.t").collect()][:3] == [20, 19, 18]

    # ---- 3. expire snapshots: a tag protects one, the rest go -------------------------------------------------
    spark.sql(f"ALTER TABLE lab.db.t CREATE TAG first AS OF VERSION {snap_first} RETAIN 30 DAYS")
    before = counts(spark, root)
    future = (datetime.now(timezone.utc) + timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")
    spark.conf.set("spark.sql.session.timeZone", "UTC")
    ex = spark.sql(f"CALL lab.system.expire_snapshots(table => 'db.t', older_than => TIMESTAMP'{future}', retain_last => 1)").first()
    print("expire_snapshots:", ex.asDict())
    after = counts(spark, root)
    print("before:", before)
    print("after :", after)
    snaps = {r.snapshot_id for r in spark.sql("SELECT snapshot_id FROM lab.db.t.snapshots").collect()}
    assert after["snapshots"] == 2 and snap_first in snaps                          # the current snapshot and the tagged one
    assert after["data files on disk"] < before["data files on disk"]
    assert after["metadata.json"] >= before["metadata.json"]                        # old metadata.json files are not removed by expire_snapshots
    assert ex.deleted_data_files_count >= 19                                         # the small files that only old snapshots used
    assert spark.sql(f"SELECT count(*) FROM lab.db.t VERSION AS OF {snap_first}").first()[0] == 1   # tagged snapshot still readable (it holds 1 row)
    gone = spark.sql("SELECT snapshot_id FROM lab.db.t.snapshots").count()
    some_old = None
    try:
        # snapshot 5 of the original 20 is gone
        some_old = 1
        spark.sql("SELECT count(*) FROM lab.db.t VERSION AS OF 123456789").first()
    except Exception as e:  # noqa: BLE001
        some_old = str(e).splitlines()[0][:80]
    print("time travel to a snapshot that does not exist:", some_old)
    assert isinstance(some_old, str) and gone == 2
    assert sorted(r.id for r in spark.table("lab.db.t").collect()) == expected_rows

    # ---- 4. orphan files: a file that no snapshot refers to -----------------------------------------------------
    stray = os.path.join(table_dir(root, "db.t"), "data", "stray-file.parquet")
    open(stray, "wb").write(b"not part of any snapshot")
    live_before = counts(spark, root)["all files on disk"]
    # the procedure refuses a threshold younger than 24 hours: a file being written right now must not look like an orphan
    try:
        spark.sql(f"CALL lab.system.remove_orphan_files(table => 'db.t', older_than => TIMESTAMP'{future}')")
        refused = None
    except Exception as e:  # noqa: BLE001
        refused = str(e).splitlines()[0][:70]
    print("short interval:", refused)
    assert refused and "less than 24 hours" in refused
    # a brand new stray file is not touched by the default (3 days), an old one is
    spark.sql("CALL lab.system.remove_orphan_files(table => 'db.t')")
    assert os.path.exists(stray)
    four_days_ago = (datetime.now() - timedelta(days=4)).timestamp()
    os.utime(stray, (four_days_ago, four_days_ago))
    dry = spark.sql("CALL lab.system.remove_orphan_files(table => 'db.t', dry_run => true)").collect()
    print("dry run found:", [os.path.basename(r.orphan_file_location) for r in dry])
    assert [os.path.basename(r.orphan_file_location) for r in dry] == ["stray-file.parquet"] and os.path.exists(stray)
    spark.sql("CALL lab.system.remove_orphan_files(table => 'db.t')")
    assert not os.path.exists(stray) and counts(spark, root)["all files on disk"] == live_before - 1
    assert sorted(r.id for r in spark.table("lab.db.t").collect()) == expected_rows

    # ---- 5. PyIceberg can expire snapshots, but has no compaction ----------------------------------------------
    cat = pyiceberg_catalog(root)
    t = cat.load_table("db.t")
    print("PyIceberg maintenance API:", [n for n in dir(t.maintenance) if not n.startswith("_")])
    assert "expire_snapshots" in dir(t.maintenance)
    assert not any(n in dir(t.maintenance) for n in ("rewrite_data_files", "compact", "remove_orphan_files"))

    print("ok")


if __name__ == "__main__":
    main()
