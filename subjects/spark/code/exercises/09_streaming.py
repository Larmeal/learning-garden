"""Chapter 9: Structured Streaming.

Hadoop cannot write a checkpoint on this Windows machine (hadoop.dll is missing), so this exercise runs inside WSL.
Started on Windows, it re-launches itself there through run_wsl.sh (see that file for the one-time setup). Run from
the code folder:

    uv run python exercises/09_streaming.py

The input is a folder of small JSON files written one at a time, so every micro-batch is predictable.
Event times are in UTC (the session time zone is set to UTC) to keep the printed windows readable.
"""

import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))


def relaunch_in_wsl():
    code_dir = os.path.normpath(os.path.join(HERE, ".."))
    drive, rest = os.path.splitdrive(code_dir)
    wsl_dir = "/mnt/" + drive[0].lower() + rest.replace("\\", "/")
    cmd = f"cd '{wsl_dir}' && ./run_wsl.sh exercises/09_streaming.py"
    out = subprocess.run(["wsl.exe", "-d", "Ubuntu", "--", "bash", "-lc", cmd], capture_output=True, text=True)
    text = out.stdout.replace("\x00", "")
    print(text[-3000:])
    if out.returncode != 0:
        print(out.stderr.replace("\x00", "")[-2000:])
        raise SystemExit(out.returncode)
    raise SystemExit(0)


if os.name == "nt":
    relaunch_in_wsl()

sys.path.insert(0, HERE)

from pyspark.sql import functions as F  # noqa: E402

from common import explain, get_spark  # noqa: E402

SCHEMA = "ts timestamp, user string, amt int"


class Feed:
    """A folder that a file source watches. drop() writes one JSON file, which becomes one micro-batch."""

    def __init__(self, root):
        self.dir = os.path.join(root, "in")
        os.makedirs(self.dir)
        self.n = 0

    def drop(self, rows):
        self.n += 1
        with open(os.path.join(self.dir, f"f{self.n:02d}.json"), "w") as f:
            for ts, user, amt in rows:
                f.write(json.dumps({"ts": "2026-01-01T" + ts, "user": user, "amt": amt}) + "\n")


def source(spark, feed):
    return spark.readStream.schema(SCHEMA).option("maxFilesPerTrigger", 1).json(feed.dir)


def windows(spark, name):
    # date_format runs in the session time zone (UTC); a collected Python datetime would use the machine's zone.
    rows = spark.sql(
        f"select date_format(window.start, 'HH:mm') s, date_format(window.end, 'HH:mm') e, count from {name} order by window.start"
    ).collect()
    return [(r.s, r.e, r["count"]) for r in rows]


def watermark_and_append(spark, root):
    feed = Feed(root)
    ck = os.path.join(root, "ck_wm")
    agg = source(spark, feed).withWatermark("ts", "10 minutes").groupBy(F.window("ts", "5 minutes")).count()
    q = agg.writeStream.format("memory").queryName("wm").outputMode("append").option("checkpointLocation", ck).start()

    feed.drop([("12:00:01", "a", 1), ("12:03:00", "a", 1)])
    q.processAllAvailable()
    assert windows(spark, "wm") == [], "append mode holds a window back until the watermark passes its end"
    feed.drop([("12:06:00", "a", 1)])
    q.processAllAvailable()
    assert windows(spark, "wm") == []
    feed.drop([("12:20:00", "a", 1)])
    q.processAllAvailable()
    # The watermark is computed at the END of a batch and applied in the NEXT one. Spark runs an extra batch with no
    # new data to apply it, which is why the two closed windows appear now.
    assert windows(spark, "wm") == [("12:00", "12:05", 2), ("12:05", "12:10", 1)], windows(spark, "wm")

    feed.drop([("12:01:00", "a", 1)])  # late: older than the watermark (12:10)
    q.processAllAvailable()
    assert windows(spark, "wm") == [("12:00", "12:05", 2), ("12:05", "12:10", 1)], "late event is dropped"
    progress = q.recentProgress
    table = [(p["batchId"], p["numInputRows"], p["eventTime"].get("watermark")) for p in progress]
    print("batchId, numInputRows, watermark:", table)
    assert [t[0] for t in table] == sorted(t[0] for t in table)
    no_data = [p for p in progress if p["numInputRows"] == 0]
    assert no_data, "batches without new data are run to apply the watermark"
    assert any(t[2] == "2026-01-01T12:10:00.000Z" for t in table)
    dropped = sum(op.get("numRowsDroppedByWatermark", 0) for p in progress for op in p["stateOperators"])
    assert dropped >= 1, dropped
    removed = sum(op.get("numRowsRemoved", 0) for p in progress for op in p["stateOperators"])
    assert removed == 2, removed  # the two closed windows leave the state

    # Checkpoint layout.
    assert os.path.isfile(os.path.join(ck, "metadata"))
    for d in ("offsets", "commits", "sources/0", "state/0/0"):
        assert os.path.isdir(os.path.join(ck, d)), d
    offsets = sorted(f for f in os.listdir(os.path.join(ck, "offsets")) if not f.startswith("."))
    commits = sorted(f for f in os.listdir(os.path.join(ck, "commits")) if not f.startswith("."))
    assert offsets == commits, (offsets, commits)
    lines = open(os.path.join(ck, "offsets", "1")).read().splitlines()
    assert lines[0] == "v1"
    meta = json.loads(lines[1])
    assert {"batchWatermarkMs", "batchTimestampMs", "conf"} <= set(meta)
    src_offset = json.loads(lines[2])
    assert "logOffset" in src_offset, src_offset
    state_files = os.listdir(os.path.join(ck, "state", "0", "0"))
    assert any(f.endswith(".delta") for f in state_files), state_files

    # The plan of a stateful streaming query.
    plan = explain(agg)
    for node in ("StateStoreSave", "StateStoreRestore", "EventTimeWatermark", "StreamingRelation"):
        assert node in plan, node
    assert spark.conf.get("spark.sql.streaming.stateStore.providerClass").endswith("HDFSBackedStateStoreProvider")
    for key in ("batchId", "numInputRows", "inputRowsPerSecond", "processedRowsPerSecond", "durationMs", "sources", "sink", "stateOperators"):
        assert key in progress[-1], key
    q.stop()
    print("offsets/commits:", offsets)


def replay_and_state(spark, root):
    feed = Feed(root)
    ck = os.path.join(root, "ck_replay")
    seen = []

    def per_batch(df, batch_id):
        seen.append((batch_id, sorted((r.user, r["count"]) for r in df.collect())))

    def start():
        agg = source(spark, feed).groupBy("user").count()
        return agg.writeStream.foreachBatch(per_batch).outputMode("complete").option("checkpointLocation", ck).start()

    q = start()
    feed.drop([("12:00:00", "a", 1), ("12:00:01", "b", 1)])
    q.processAllAvailable()
    feed.drop([("12:01:00", "a", 1)])
    q.processAllAvailable()
    assert seen == [(0, [("a", 1), ("b", 1)]), (1, [("a", 2), ("b", 1)])], seen
    q.stop()

    # A crash after the offsets are logged but before the commit leaves offsets/N without commits/N.
    os.remove(os.path.join(ck, "commits", "1"))
    crc = os.path.join(ck, "commits", ".1.crc")
    if os.path.exists(crc):
        os.remove(crc)
    seen.clear()
    q = start()
    feed.drop([("12:02:00", "c", 1)])
    q.processAllAvailable()
    batch_ids = [b for b, _ in seen]
    assert batch_ids[0] == 1, "batch 1 is run again with the same input"
    assert seen[0] == (1, [("a", 2), ("b", 1)]), "its result is the same as the first time"
    assert seen[-1] == (2, [("a", 2), ("b", 1), ("c", 1)]), "the state carried over: a is still 2, not reset"
    q.stop()
    print("replayed batches:", batch_ids)


def triggers(spark, root):
    feed = Feed(root)
    ck = os.path.join(root, "ck_trigger")
    for i in range(3):
        feed.drop([(f"12:0{i}:00", "a", 1)])
    seen = []

    def per_batch(df, batch_id):
        seen.append(batch_id)

    def run():
        q = (
            source(spark, feed).writeStream.foreachBatch(per_batch).trigger(availableNow=True)
            .option("checkpointLocation", ck).start()
        )
        assert q.awaitTermination(120) is True or not q.isActive
        return q

    q = run()
    assert not q.isActive
    assert seen == [0, 1, 2], "maxFilesPerTrigger=1 splits the backlog into one batch per file"
    seen.clear()
    run()
    assert seen == [], "the checkpoint remembers what was processed"


def modes_and_limits(spark, root):
    feed = Feed(root)
    src = source(spark, feed)
    counts = src.groupBy("user").count()
    for mode in ("complete", "update"):
        q = counts.writeStream.format("memory").queryName("m_" + mode).outputMode(mode).start()
        q.stop()
    try:
        counts.writeStream.format("memory").queryName("m_append").outputMode("append").start()
        raise AssertionError("append without a watermark must fail")
    except Exception as e:  # noqa: BLE001
        assert "STREAMING_OUTPUT_MODE.UNSUPPORTED_OPERATION" in str(e)
    try:
        src.count()
        raise AssertionError("an action on a streaming DataFrame must fail")
    except Exception as e:  # noqa: BLE001
        assert "must be executed with writeStream.start()" in str(e)
    assert src.isStreaming and not spark.range(1).isStreaming


def rocksdb_provider(spark, root):
    spark.conf.set(
        "spark.sql.streaming.stateStore.providerClass",
        "org.apache.spark.sql.execution.streaming.state.RocksDBStateStoreProvider",
    )
    feed = Feed(root)
    ck = os.path.join(root, "ck_rocks")
    q = (
        source(spark, feed).groupBy("user").count().writeStream.format("memory").queryName("rk")
        .outputMode("complete").option("checkpointLocation", ck).start()
    )
    feed.drop([("12:00:00", "a", 1), ("12:00:01", "a", 1)])
    q.processAllAvailable()
    assert spark.sql("select * from rk").collect()[0]["count"] == 2
    q.stop()
    files = [f for d, _, fs in os.walk(os.path.join(ck, "state")) for f in fs]
    assert any(f.endswith(".changelog") or f.endswith(".zip") for f in files), files
    spark.conf.unset("spark.sql.streaming.stateStore.providerClass")
    print("rocksdb state files:", sorted(set(os.path.splitext(f)[1] for f in files)))


def main():
    spark = get_spark("ch09")
    spark.sparkContext.setLogLevel("ERROR")
    spark.conf.set("spark.sql.session.timeZone", "UTC")
    spark.conf.set("spark.sql.shuffle.partitions", "4")
    root = tempfile.mkdtemp(prefix="ch09_")
    try:
        for name, fn in [
            ("watermark_and_append", watermark_and_append),
            ("replay_and_state", replay_and_state),
            ("triggers", triggers),
            ("modes_and_limits", modes_and_limits),
            ("rocksdb_provider", rocksdb_provider),
        ]:
            sub = os.path.join(root, name)
            os.makedirs(sub)
            fn(spark, sub)
    finally:
        for q in spark.streams.active:
            q.stop()
        spark.stop()
    print("ok")


if __name__ == "__main__":
    main()
