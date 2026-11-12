"""Lesson 12: streaming into Iceberg, streaming out of it, and reading only what changed between two snapshots.

    uv run python exercises/12_streaming_incremental.py       (on Windows this re-launches itself in WSL, see run_wsl.sh)

Asserts that a Structured Streaming query writes one snapshot per micro-batch and does not repeat work when it is started
again, that an Iceberg table can be the source of a stream, that start-snapshot-id / end-snapshot-id returns only the rows appended
between two snapshots, and what PyIceberg offers for the same.
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from lab import fresh_root, get_spark, pyiceberg_catalog, relaunch_in_wsl_if_windows  # noqa: E402

relaunch_in_wsl_if_windows(__file__)


def write_json(folder, name, rows):
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, name), "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")


def main():
    root = fresh_root("12_streaming_incremental")
    spark = get_spark(root)
    spark.sql("CREATE NAMESPACE lab.db")
    spark.sql("CREATE TABLE lab.db.sink (id bigint, v string) USING iceberg")
    inbox = os.path.join(root, "inbox")
    ckpt = os.path.join(root, "ckpt")

    def run_stream():
        q = (
            spark.readStream.schema("id bigint, v string").json(inbox)
            .writeStream.format("iceberg").outputMode("append")
            .trigger(availableNow=True).option("checkpointLocation", ckpt).toTable("lab.db.sink")
        )
        q.awaitTermination()
        return q

    # ---- 1. a stream writes to a table; every micro-batch is one snapshot -------------------------------------
    write_json(inbox, "a.json", [{"id": 1, "v": "a"}, {"id": 2, "v": "b"}])
    run_stream()
    assert spark.sql("SELECT count(*) FROM lab.db.sink").first()[0] == 2
    snaps = spark.sql("SELECT snapshot_id, operation, summary FROM lab.db.sink.snapshots ORDER BY committed_at").collect()
    print("snapshots after the first run:", [(s.operation, sorted(k for k in s.summary if "streaming" in k or "epoch" in k)) for s in snaps])
    assert len(snaps) == 1 and snaps[0].operation == "append"
    stream_keys = [k for k in snaps[0].summary if "stream" in k.lower() or "epoch" in k.lower()]
    print("streaming keys in the summary:", stream_keys)
    assert stream_keys                                                                  # the commit records which stream and batch wrote it

    # ---- 2. start it again: only the new file is processed -------------------------------------------------
    run_stream()                                                                        # nothing new: no commit
    assert spark.sql("SELECT count(*) FROM lab.db.sink.snapshots").first()[0] == 1
    write_json(inbox, "b.json", [{"id": 3, "v": "c"}])
    run_stream()
    assert spark.sql("SELECT count(*) FROM lab.db.sink").first()[0] == 3                # exactly once: 3 rows, not 2 + 2 + 1
    assert spark.sql("SELECT count(*) FROM lab.db.sink.snapshots").first()[0] == 2

    # ---- 3. an Iceberg table as the source of a stream --------------------------------------------------------
    spark.sql("CREATE TABLE lab.db.copy (id bigint, v string) USING iceberg")
    ckpt2 = os.path.join(root, "ckpt2")

    def copy_stream():
        q = (
            spark.readStream.format("iceberg").load("lab.db.sink")
            .writeStream.format("iceberg").outputMode("append").trigger(availableNow=True)
            .option("checkpointLocation", ckpt2).toTable("lab.db.copy")
        )
        q.awaitTermination()

    copy_stream()
    assert spark.sql("SELECT count(*) FROM lab.db.copy").first()[0] == 3
    spark.sql("INSERT INTO lab.db.sink VALUES (4, 'd')")
    copy_stream()
    assert sorted(r.id for r in spark.sql("SELECT id FROM lab.db.copy").collect()) == [1, 2, 3, 4]    # only the new snapshot was read

    # ---- 4. incremental batch read: rows appended between two snapshots ---------------------------------------
    s = [r.snapshot_id for r in spark.sql("SELECT snapshot_id FROM lab.db.sink.snapshots ORDER BY committed_at").collect()]
    assert len(s) == 3
    delta = spark.read.format("iceberg").option("start-snapshot-id", s[0]).option("end-snapshot-id", s[2]).load("lab.db.sink")
    got = sorted(r.id for r in delta.collect())
    print("rows appended after snapshot 1, up to snapshot 3:", got)
    assert got == [3, 4]                                                                # start is exclusive, end is inclusive
    only_end = spark.read.format("iceberg").option("start-snapshot-id", s[1]).load("lab.db.sink")
    assert sorted(r.id for r in only_end.collect()) == [4]                              # without an end: up to the current snapshot

    # an overwrite snapshot in the range: what does the incremental read return?
    spark.sql("INSERT OVERWRITE lab.db.sink SELECT * FROM lab.db.sink WHERE id > 1")
    s2 = [r.snapshot_id for r in spark.sql("SELECT snapshot_id, operation FROM lab.db.sink.snapshots ORDER BY committed_at").collect()]
    ops = [r.operation for r in spark.sql("SELECT operation FROM lab.db.sink.snapshots ORDER BY committed_at").collect()]
    print("operations:", ops)
    assert ops == ["append", "append", "append", "overwrite"]
    try:
        res = sorted(r.id for r in spark.read.format("iceberg").option("start-snapshot-id", s2[2]).option("end-snapshot-id", s2[3]).load("lab.db.sink").collect())
    except Exception as e:  # noqa: BLE001
        res = "error: " + str(e).splitlines()[0][:110]
    print("incremental read over an overwrite:", res)
    # an incremental read only follows append snapshots; the files an overwrite added are not reported
    assert res == [] or isinstance(res, str)

    # ---- 5. PyIceberg ---------------------------------------------------------------------------------------
    cat = pyiceberg_catalog(root)
    t = cat.load_table("db.sink")
    names = [n for n in dir(t) if "incremental" in n]
    print("PyIceberg incremental methods:", names)
    if "incremental_append_scan" in names:
        sc = t.incremental_append_scan(from_snapshot_id_exclusive=s[0], to_snapshot_id_inclusive=s[2])
        print("PyIceberg incremental append scan:", sorted(r["id"] for r in sc.to_arrow().to_pylist()))
    print("ok")


if __name__ == "__main__":
    main()
