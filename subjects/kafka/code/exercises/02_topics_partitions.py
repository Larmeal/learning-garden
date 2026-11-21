"""Lesson 2: topics, partitions, offsets and keys.

Asserts what the lesson prints:
  - a topic with 3 partitions is three independent logs: every partition counts its offsets from 0;
  - the same key always lands in the same partition, and the partition is toPositive(murmur2(key)) % partitions (the Java client's rule);
  - librdkafka (confluent-kafka) uses another default hash (consistent_random, CRC32), so the same key can land elsewhere, unless the client is told `partitioner=murmur2_random`;
  - inside one partition the order of sending is the order of reading; across partitions there is no order;
  - adding partitions changes where a key goes, and the old records stay where they were;
  - a record without a key is spread over the partitions.
`--write` saves labs/kafka/partitions.json for PartitionLab (keys, the real murmur2 hash, the partition for 3 and 6 partitions).
Run: uv run python exercises/02_topics_partitions.py [--write]
"""

import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

KEYS = ["c1", "c2", "c3", "c4", "c5", "c6"]


def main() -> None:
    c = Cluster(1).start()
    c.topic("orders", 3, 1)
    print(c.describe("orders"))

    show("send 18 orders (3 per customer) with the key = customer, using the Java client's hash")
    p = producer(c, partitioner="murmur2_random")
    items = [(KEYS[i % 6], f'{{"order":"o-{1000 + i}","customer":"{KEYS[i % 6]}"}}') for i in range(18)]
    landed = produce(p, "orders", items)
    check("all 18 were acknowledged", len(landed) == 18 and all("error" not in x for x in landed), str(landed))

    by_key: dict[str, set[int]] = defaultdict(set)
    for x in landed:
        by_key[x["key"]].add(x["partition"])
    rows = [[k, murmur2(k.encode()), java_partition(k, 3), sorted(by_key[k])] for k in KEYS]
    show("key, murmur2 hash, partition by the formula, partitions the broker reported", table(rows, ["key", "murmur2", "formula", "actual"]))
    check("every key landed in exactly one partition", all(len(v) == 1 for v in by_key.values()))
    check("the partition equals toPositive(murmur2(key)) % 3 for every key", all(by_key[k] == {java_partition(k, 3)} for k in KEYS), str(rows))

    show("offsets: every partition starts at 0")
    per_part: dict[int, list[int]] = defaultdict(list)
    for x in landed:
        per_part[x["partition"]].append(x["offset"])
    for part in sorted(per_part):
        print(f"  partition {part}: offsets {per_part[part]}")
    check("offsets inside a partition are 0, 1, 2, ... in send order", all(v == list(range(len(v))) for v in per_part.values()), str(dict(per_part)))
    check("the three partitions together hold 18 records", sum(len(v) for v in per_part.values()) == 18)

    show("the default hash of confluent-kafka is not the Java one")
    p2 = producer(c)  # librdkafka default: consistent_random (CRC32)
    landed2 = produce(p2, "orders", [(k, "{}") for k in KEYS])
    default_part = {x["key"]: x["partition"] for x in landed2}
    rows2 = [[k, java_partition(k, 3), default_part[k]] for k in KEYS]
    print(table(rows2, ["key", "java (murmur2)", "librdkafka default"]))
    differ = [k for k in KEYS if default_part[k] != java_partition(k, 3)]
    check("with the default partitioner at least one key lands in another partition than the Java client would pick", len(differ) >= 1, str(rows2))
    for_java = produce(producer(c, partitioner="murmur2_random"), "orders", [(k, "{}") for k in KEYS])
    check("with partitioner=murmur2_random they all agree with the Java rule again", all(x["partition"] == java_partition(x["key"], 3) for x in for_java))

    show("read all three partitions: the order is kept inside a partition and not across partitions")
    got = consume(c, "orders", "reader", 18 + 12)
    seq_by_part: dict[int, list[int]] = defaultdict(list)
    for g in got:
        seq_by_part[g["partition"]].append(g["offset"])
    check("the offsets of each partition arrive in order", all(v == sorted(v) for v in seq_by_part.values()))
    order_of_arrival = [g["partition"] for g in got[:12]]
    print(f"  partitions in the order the first 12 records arrived: {order_of_arrival} (a consumer may take one partition at a time, so this is not an order of sending)")

    show("a record without a key is not tied to a partition")
    nokey = produce(producer(c, partitioner="murmur2_random"), "orders", [(None, f'{{"n":{i}}}') for i in range(60)])
    spread = sorted({x["partition"] for x in nokey})
    print(f"  60 records without a key landed in partitions {spread}")
    check("keyless records reach more than one partition", len(spread) > 1)

    show("more partitions: the same key goes somewhere else (the old records stay)")
    c.cli("kafka-topics.sh", *c.bs(), "--alter", "--topic", "orders", "--partitions", "6")
    moved = [(k, java_partition(k, 3), java_partition(k, 6)) for k in KEYS]
    print(table([list(m) for m in moved], ["key", "3 partitions", "6 partitions"]))
    after = produce(producer(c, partitioner="murmur2_random"), "orders", [(k, "{}") for k in KEYS])
    check("after the change each key lands where the formula says for 6 partitions", all(x["partition"] == java_partition(x["key"], 6) for x in after))
    changed = [k for k, a, b in moved if a != b]
    check("at least one key moved to a new partition", len(changed) >= 1, str(moved))
    lower = c.cli("kafka-topics.sh", *c.bs(), "--alter", "--topic", "orders", "--partitions", "2", check=False)
    show("alter to 2 partitions", lower)
    check("Kafka refuses to remove partitions", "less than" in lower.lower() or "cannot" in lower.lower() or "InvalidPartitionsException" in lower, lower)

    if "--write" in sys.argv:
        write_json(LABS / "partitions.json", {
            "keys": [{"key": k, "hash": murmur2(k.encode()), "p3": java_partition(k, 3), "p6": java_partition(k, 6)} for k in KEYS + [f"c{i}" for i in range(7, 13)]],
        })


if __name__ == "__main__":
    main_guard(main)
