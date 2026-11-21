"""Lesson 5: the log on disk. Segments, the sparse index, retention and compaction, looked at in the broker's own folder.

Asserts what the lesson prints:
  - a partition is a folder; it holds segments, each named by the offset of its first record (`00000000000000000040.log`), with an `.index` and a `.timeindex` next to it;
  - the offset index is sparse (an entry every index.interval.bytes), and a read finds the segment by its file name, then an index entry, then scans forward;
  - retention deletes whole segments, never the active one, and the log start offset moves up;
  - a consumer of a new group starts at the log start offset, not at 0, after retention removed old segments;
  - compaction keeps the latest record of every key (offsets keep their gaps) and a tombstone (a null value) deletes a key after delete.retention.ms.
`--write` saves labs/kafka/segments.json (the real segments, index entries and the compaction before and after) for SegmentLab and CompactionLab.
Run: uv run python exercises/05_log_storage.py [--write]
"""

import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

DATA = "/var/lib/kafka/data"


def files(c: Cluster, topic: str) -> list[str]:
    return c.sh(f"ls -1 {DATA}/{topic}-0").splitlines()


def segments(c: Cluster, topic: str) -> list[int]:
    return sorted(int(f.split(".")[0]) for f in files(c, topic) if f.endswith(".log"))


def dump(c: Cluster, topic: str, base: int, extra: str = "") -> str:
    return c.sh(f"/opt/kafka/bin/kafka-dump-log.sh {extra} --files {DATA}/{topic}-0/{base:020d}.log")


def records_of(c: Cluster, topic: str) -> list[dict]:
    """Every record that is in the partition's .log files right now, read with kafka-dump-log.sh (offset, key, value or None for a tombstone)."""
    out = []
    for base in segments(c, topic):
        text = dump(c, topic, base, "--print-data-log")
        for m in re.finditer(r"\| offset: (\d+) CreateTime: \d+ keySize: (-?\d+) valueSize: (-?\d+) .*?headerKeys: \[\](?: key: (\S+))?(?: payload: (.*))?$", text, flags=re.M):
            out.append({"offset": int(m.group(1)), "key": m.group(4), "value": m.group(5)})
    return out


def start_offset(c: Cluster, topic: str) -> int:
    return int(c.cli("kafka-get-offsets.sh", *c.bs(), "--topic", topic, "--time", "earliest").strip().split(":")[-1])


def end_offset(c: Cluster, topic: str) -> int:
    return int(c.cli("kafka-get-offsets.sh", *c.bs(), "--topic", topic, "--time", "latest").strip().split(":")[-1])


def main() -> None:
    c = Cluster(1, env={
        "KAFKA_LOG_RETENTION_CHECK_INTERVAL_MS": "1000", "KAFKA_LOG_INITIAL_TASK_DELAY_MS": "1000",
        "KAFKA_LOG_CLEANER_BACKOFF_MS": "1000", "KAFKA_LOG_CLEANER_MIN_CLEANABLE_RATIO": "0.01",
    }).start()
    result: dict = {}

    show("a topic with tiny segments (segment.bytes=2048) and a dense index (index.interval.bytes=512)")
    c.topic("events", 1, 1, internal_segment_bytes="2048", index_interval_bytes="512", file_delete_delay_ms="1000")
    p = producer(c, **{"linger.ms": 0})
    n = 60
    items = [(None, f'{{"event":{i:03d},"payload":"{"x" * 60}"}}') for i in range(n)]
    for item in items:  # one record, one batch: the batches have the same size, so the segments always roll at the same offsets
        produce(p, "events", [item])
    segs = segments(c, "events")
    print(f"  files in events-0:\n    " + "\n    ".join(files(c, "events")))
    check("the 60 records are spread over several segments", len(segs) >= 4, str(segs))
    check("each segment file is named by the offset of its first record (the first is 0)", segs[0] == 0 and all(b > a for a, b in zip(segs, segs[1:])))
    check("each .log has an .index and a .timeindex", all(f"{b:020d}.index" in files(c, "events") and f"{b:020d}.timeindex" in files(c, "events") for b in segs))
    sizes = {b: int(c.sh(f"stat -c %s {DATA}/events-0/{b:020d}.log")) for b in segs}
    print(f"  segment sizes: {sizes}")
    check("a closed segment is just under 2048 bytes: a batch that would not fit starts the next segment", all(1400 < s <= 2048 for b, s in list(sizes.items())[:-1]), str(sizes))
    result["segments"] = [{"base": b, "bytes": sizes[b]} for b in segs]

    show("inside one segment: batches, offsets, positions")
    mid = segs[2]
    text = dump(c, "events", mid)
    batch_lines = [ln for ln in text.splitlines() if ln.startswith("baseOffset")]
    print("\n".join("  " + ln[:150] for ln in batch_lines[:3]))
    first_off = int(re.search(r"baseOffset: (\d+)", batch_lines[0]).group(1))
    check("the first batch of a segment starts at the offset in the file name", first_off == mid, f"{first_off} != {mid}")
    pos = [int(re.search(r"position: (\d+)", ln).group(1)) for ln in batch_lines]
    check("a batch's position is where it starts inside the file, growing from 0", pos[0] == 0 and pos == sorted(pos))

    show("the sparse index of that segment")
    idx = c.sh(f"/opt/kafka/bin/kafka-dump-log.sh --files {DATA}/events-0/{mid:020d}.index")
    entries = [(int(m.group(1)), int(m.group(2))) for m in re.finditer(r"offset: (\d+) position: (\d+)", idx)]
    print("\n".join(f"  offset {o} -> byte {b}" for o, b in entries[:5]))
    total = len(batch_lines)
    check("the index has entries, and not more than the segment has batches", 0 < len(entries) <= total, f"{len(entries)} vs {total}")
    check("index offsets are absolute offsets, each at or after the segment's base", all(o >= mid for o, _ in entries))
    result["index"] = {"base": mid, "entries": entries[:8], "batches": [{"offset": int(re.search(r"baseOffset: (\d+)", ln).group(1)), "position": int(re.search(r"position: (\d+)", ln).group(1)), "count": int(re.search(r"count: (\d+)", ln).group(1))} for ln in batch_lines]}

    show("to read offset 30: pick the segment by file name, then the index, then scan")
    want = 30
    seg = max(b for b in segs if b <= want)
    seg_dump = dump(c, "events", seg, "--print-data-log")
    check("the record at offset 30 is in the segment that the file name rule picks", f"| offset: {want} " in seg_dump, f"segment {seg}")
    print(f"  offset {want} is in segment {seg:020d}.log")

    show("retention is decided per segment, by the newest record in it")
    time.sleep(16)
    fresh = [(None, f'{{"event":{i:03d},"payload":"{"x" * 60}"}}') for i in range(n, n + 5)]
    for item in fresh:
        produce(p, "events", [item])
    before = segments(c, "events")
    c.cli("kafka-configs.sh", *c.bs(), "--alter", "--entity-type", "topics", "--entity-name", "events", "--add-config", "retention.ms=15000")
    wait_for(lambda: start_offset(c, "events") > 0, 60)
    after, start_now, end_now = segments(c, "events"), start_offset(c, "events"), end_offset(c, "events")
    print(f"  segments before {before}")
    print(f"  segments after  {after}")
    print(f"  log start offset {start_now}, log end offset {end_now}")
    check("the four closed segments are gone and the active one is kept", after == before[4:], f"{before} -> {after}")
    check("the log start offset moved up to the first remaining segment", start_now == after[0] == before[4], f"{start_now} vs {after}")
    check("the end offset did not change: offsets are never reused", end_now == n + 5)
    got = consume(c, "events", "after-retention", n + 5, timeout=10)
    old_left = [g for g in got if g["offset"] < n]
    check("a new group starts at the log start offset", got[0]["offset"] == after[0], str(got[:1]))
    check("records older than retention.ms are still readable, because their segment also holds a fresh record", len(old_left) == n - after[0] and len(got) == n + 5 - after[0], f"{len(got)} records, {len(old_left)} old")
    result["retention"] = {"before": before, "after": after, "start": start_now, "end": end_now}

    show("when every record is old, the whole log goes and a new empty segment starts")
    wait_for(lambda: start_offset(c, "events") == end_offset(c, "events"), 60)
    time.sleep(1)
    last = segments(c, "events")
    print(f"  segments now {last}, log start offset {start_offset(c, 'events')}, log end offset {end_offset(c, 'events')}")
    check("the log start offset reached the end offset (65)", start_offset(c, "events") == end_offset(c, "events") == n + 5)
    check("one new, empty segment is named after the next offset", last == [n + 5] and int(c.sh(f"stat -c %s {DATA}/events-0/{n + 5:020d}.log")) == 0, str(last))
    check("a new group reads nothing", len(consume(c, "events", "after-all-expired", 5, timeout=4)) == 0)

    show("compaction: keep the latest record of each key")
    c.topic("profile", 1, 1, cleanup_policy="compact", internal_segment_bytes="2048", min_cleanable_dirty_ratio="0.01", delete_retention_ms="1000", segment_ms="1000", min_compaction_lag_ms="3600000")
    p = producer(c, **{"linger.ms": 0})
    keys = ["k1", "k2", "k3", "k4"]
    rounds = 12
    history = []
    for r in range(rounds):
        batch = [(k, f'{{"v":{r},"pad":"{"y" * 40}"}}') for k in keys]
        produce(p, "profile", batch)
        history += [(k, r) for k in keys]
    before_c = records_of(c, "profile")
    print(f"  before: {len(before_c)} records, offsets 0..{before_c[-1]['offset']}")
    check("48 records are in the log before the cleaner runs", len(before_c) == 48)
    # a tombstone for k3, then more records so that the segment holding it is closed. Until now min.compaction.lag.ms (1 hour) kept the cleaner away.
    p.produce("profile", key=b"k3", value=None)
    p.flush(10)
    for i in range(0, 40, 5):  # small batches: a batch bigger than the (tiny) segment is refused
        produce(p, "profile", [(f"z{i + j}", "pad" * 30) for j in range(5)])
    time.sleep(2)
    wait_for(lambda: len(segments(c, "profile")) >= 2, 30)
    full = records_of(c, "profile")
    check("with min.compaction.lag.ms=1 hour nothing was compacted: 89 records (48 + tombstone + 40)", len(full) == 89, str(len(full)))
    c.cli("kafka-configs.sh", *c.bs(), "--alter", "--entity-type", "topics", "--entity-name", "profile", "--add-config", "min.compaction.lag.ms=0")
    wait_for(lambda: len([r for r in records_of(c, "profile") if r["key"] in keys]) <= 4, 120, step=2)
    after_c = records_of(c, "profile")
    keyed = [g for g in after_c if g["key"] in keys]
    print(f"  after: {len(after_c)} records; the ones for k1..k4:")
    for g in keyed:
        print(f"    offset {g['offset']:3d} key {g['key']} value {(g['value'] or 'None (tombstone)')[:12]}")
    last_round = rounds - 1
    live = [g for g in keyed if g["key"] in ("k1", "k2", "k4")]
    check("only the last record of k1, k2 and k4 remains (round 11)", len(live) == 3 and all(f'"v":{last_round}' in g["value"] for g in live), str(keyed))
    check("the offsets of the kept records are still the old ones (44, 45, 47: there are gaps)", [g["offset"] for g in live] == [44, 45, 47], str(live))
    k3 = [g for g in keyed if g["key"] == "k3"]
    check("of k3 only the tombstone is left: none of its 12 values survived", len(k3) == 1 and k3[0]["value"] is None, str(k3))
    check("the log is shorter: 89 records went in, fewer are left", len(after_c) < 89, str(len(after_c)))

    show("the tombstone itself goes after delete.retention.ms, on a later pass of the cleaner")
    for i in range(3):  # new records so that the cleaner has something dirty to work on
        for j in range(0, 20, 5):
            produce(p, "profile", [(f"y{i}-{j + k}", "pad" * 30) for k in range(5)])
        time.sleep(2)
    took = wait_for(lambda: not any(r["key"] == "k3" for r in records_of(c, "profile")), 120, step=2)
    print(f"  k3 and its tombstone are gone (waited {took:.0f} s)")
    result["compaction"] = {"before_records": len(before_c), "after": [{"offset": g["offset"], "key": g["key"], "v": (g["value"] or "")[:8]} for g in keyed]}

    if "--write" in sys.argv:
        write_json(LABS / "segments.json", result)


if __name__ == "__main__":
    main_guard(main)
