"""Lesson 8: time travel, branches, tags, rollback, write-audit-publish and the changelog.

    uv run python exercises/08_time_travel.py       (on Windows this re-launches itself in WSL, see run_wsl.sh)

Asserts how Spark and PyIceberg read an older snapshot, how a tag and a branch behave (a branch takes writes without moving
`main`), that a rollback moves the pointer but forgets no snapshot, how a staged write is published with cherrypick_snapshot,
and what the changelog view reports.
"""

import os
import sys
import time
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import pyarrow as pa  # noqa: E402

from lab import fresh_root, get_spark, pyiceberg_catalog, relaunch_in_wsl_if_windows, show  # noqa: E402

relaunch_in_wsl_if_windows(__file__)


def ids(spark, q):
    return sorted(r.id for r in spark.sql(q).collect())


def main():
    root = fresh_root("08_time_travel")
    spark = get_spark(root)
    spark.sql("CREATE NAMESPACE lab.db")
    spark.sql("CREATE TABLE lab.db.t (id bigint, note string) USING iceberg")
    stamps = []
    for batch in ((1, 2), (3,), (4, 5)):
        spark.sql("INSERT INTO lab.db.t VALUES " + ",".join(f"({i}, 'n{i}')" for i in batch))
        stamps.append(datetime.now(timezone.utc))
        time.sleep(1.2)
    snaps = [r.snapshot_id for r in spark.sql("SELECT snapshot_id FROM lab.db.t.snapshots ORDER BY committed_at").collect()]
    s1, s2, s3 = snaps
    assert ids(spark, "SELECT id FROM lab.db.t") == [1, 2, 3, 4, 5]

    # ---- 1. time travel by snapshot id and by timestamp --------------------------------------------------------
    assert ids(spark, f"SELECT id FROM lab.db.t VERSION AS OF {s1}") == [1, 2]
    assert ids(spark, f"SELECT id FROM lab.db.t FOR SYSTEM_VERSION AS OF {s2}") == [1, 2, 3]
    spark.conf.set("spark.sql.session.timeZone", "UTC")                # a timestamp literal is read in the session time zone
    between = (stamps[1] + timedelta(milliseconds=600)).strftime("%Y-%m-%d %H:%M:%S.%f")      # after commit 2, before commit 3
    got = ids(spark, f"SELECT id FROM lab.db.t TIMESTAMP AS OF TIMESTAMP'{between}'")
    print("TIMESTAMP AS OF between commit 2 and 3:", got)
    assert got == [1, 2, 3]
    assert spark.read.option("versionAsOf", s2).format("iceberg").load("lab.db.t").count() == 3          # DataFrame reader
    try:
        spark.read.option("snapshot-id", s2).format("iceberg").load("lab.db.t")
        old_option = "still works"
    except Exception as e:  # noqa: BLE001
        old_option = str(e).splitlines()[0]
    print("option snapshot-id:", old_option)
    assert "no longer supported" in old_option
    assert [r.id for r in spark.sql(f"SELECT id FROM lab.db.t VERSION AS OF {s1}").collect()] and spark.sql("SELECT count(*) FROM lab.db.t").first()[0] == 5

    # the same from PyIceberg
    cat = pyiceberg_catalog(root)
    t = cat.load_table("db.t")
    assert t.scan(snapshot_id=s1).to_arrow().num_rows == 2
    asof = t.snapshot_as_of_timestamp(int((stamps[1] + timedelta(milliseconds=600)).timestamp() * 1000))
    print("PyIceberg snapshot as of that time:", asof.snapshot_id == s2)
    assert asof.snapshot_id == s2 and t.scan(snapshot_id=asof.snapshot_id).to_arrow().num_rows == 3

    # ---- 2. tag: a name for a snapshot ----------------------------------------------------------------------------
    spark.sql(f"ALTER TABLE lab.db.t CREATE TAG before_cleanup AS OF VERSION {s2} RETAIN 30 DAYS")
    assert ids(spark, "SELECT id FROM lab.db.t VERSION AS OF 'before_cleanup'") == [1, 2, 3]
    refs = {r.name: (r.type, r.snapshot_id) for r in spark.sql("SELECT name, type, snapshot_id FROM lab.db.t.refs").collect()}
    print("refs:", refs)
    assert refs == {"main": ("BRANCH", s3), "before_cleanup": ("TAG", s2)}

    # ---- 3. branch: writes that do not move main ---------------------------------------------------------------
    spark.sql("ALTER TABLE lab.db.t CREATE BRANCH audit")
    spark.sql("INSERT INTO lab.db.t.branch_audit VALUES (100, 'try')")
    assert ids(spark, "SELECT id FROM lab.db.t") == [1, 2, 3, 4, 5]                      # main is untouched
    assert ids(spark, "SELECT id FROM lab.db.t VERSION AS OF 'audit'") == [1, 2, 3, 4, 5, 100]
    print("main:", ids(spark, "SELECT id FROM lab.db.t"), "| audit:", ids(spark, "SELECT id FROM lab.db.t VERSION AS OF 'audit'"))
    # PyIceberg reads and writes a branch too
    t = cat.load_table("db.t")
    t.append(pa.table({"id": pa.array([101], pa.int64()), "note": ["py"]}), branch="audit")
    assert t.scan(snapshot_id=t.refs()["audit"].snapshot_id).to_arrow().num_rows == 7
    assert cat.load_table("db.t").scan().to_arrow().num_rows == 5
    # publish the branch: main fast-forwards to it
    spark.sql("CALL lab.system.fast_forward('db.t', 'main', 'audit')")
    assert ids(spark, "SELECT id FROM lab.db.t") == [1, 2, 3, 4, 5, 100, 101]
    spark.sql("ALTER TABLE lab.db.t DROP BRANCH audit")

    # ---- 4. rollback moves the pointer; it forgets nothing ----------------------------------------------------
    n_before = spark.sql("SELECT count(*) FROM lab.db.t.snapshots").first()[0]
    spark.sql(f"CALL lab.system.rollback_to_snapshot('db.t', {s2})")
    assert ids(spark, "SELECT id FROM lab.db.t") == [1, 2, 3]
    assert spark.sql("SELECT count(*) FROM lab.db.t.snapshots").first()[0] == n_before            # all snapshots still listed
    hist = spark.sql("SELECT snapshot_id, is_current_ancestor FROM lab.db.t.history ORDER BY made_current_at").collect()
    print("history (is_current_ancestor):", [(h.snapshot_id == s3, h.is_current_ancestor) for h in hist])
    assert [h.is_current_ancestor for h in hist if h.snapshot_id == s3] == [False]               # the rolled-back snapshot is still there, but off the main line
    spark.sql(f"CALL lab.system.set_current_snapshot('db.t', {s3})")                              # go forward again
    assert ids(spark, "SELECT id FROM lab.db.t") == [1, 2, 3, 4, 5]

    # ---- 5. write-audit-publish with a staged snapshot -----------------------------------------------------------
    spark.sql("ALTER TABLE lab.db.t SET TBLPROPERTIES ('write.wap.enabled' = 'true')")
    spark.conf.set("spark.wap.id", "batch-42")
    spark.sql("INSERT INTO lab.db.t VALUES (200, 'staged')")
    spark.conf.unset("spark.wap.id")
    assert ids(spark, "SELECT id FROM lab.db.t") == [1, 2, 3, 4, 5]                               # not published yet
    staged = spark.sql("SELECT snapshot_id FROM lab.db.t.snapshots WHERE summary['wap.id'] = 'batch-42'").first().snapshot_id
    print("staged snapshot visible to readers? no. Publishing it with cherrypick_snapshot")
    spark.sql(f"CALL lab.system.cherrypick_snapshot('db.t', {staged})")
    assert ids(spark, "SELECT id FROM lab.db.t") == [1, 2, 3, 4, 5, 200]

    # ---- 6. the changelog view -----------------------------------------------------------------------------------
    start = spark.sql("SELECT snapshot_id FROM lab.db.t.snapshots ORDER BY committed_at DESC").first().snapshot_id
    spark.sql("INSERT INTO lab.db.t VALUES (300, 'new')")
    spark.sql("DELETE FROM lab.db.t WHERE id = 1")
    spark.sql(f"CALL lab.system.create_changelog_view(table => 'db.t', options => map('start-snapshot-id', '{start}'), changelog_view => 'changes')")
    ch = spark.sql("SELECT id, _change_type, _change_ordinal FROM changes ORDER BY _change_ordinal, id")
    show(ch)
    assert [(r.id, r._change_type) for r in ch.collect()] == [(300, "INSERT"), (1, "DELETE")] or sorted((r.id, r._change_type) for r in ch.collect()) == [(1, "DELETE"), (300, "INSERT")]

    # ---- 7. a tag keeps a snapshot alive for expire_snapshots (the tag is a reference) -------------------------
    refs_now = {r.name for r in spark.sql("SELECT name FROM lab.db.t.refs").collect()}
    assert refs_now == {"main", "before_cleanup"}

    # PyIceberg: tags and rollback through manage_snapshots
    t = cat.load_table("db.t")
    t.manage_snapshots().create_tag(s1, "first").commit()
    t = cat.load_table("db.t")
    assert t.refs()["first"].snapshot_id == s1 and t.scan(snapshot_id=t.refs()["first"].snapshot_id).to_arrow().num_rows == 2
    print("ok")


if __name__ == "__main__":
    main()
