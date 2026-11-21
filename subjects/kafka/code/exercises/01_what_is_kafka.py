"""Lesson 1: what Kafka is. A topic is a log that you append to and read from, and reading does not remove anything.

Asserts what the lesson prints:
  - a single broker starts in KRaft mode and a topic is a folder of files on its disk;
  - five orders sent with the console producer get offsets 0 to 4;
  - a consumer reads them and they are still there: a second group reads the same five, and so does the first group again from the start;
  - each group keeps its own bookmark (committed offset), and the lag is the distance between the bookmark and the end of the log;
  - a record has a key, a value, a timestamp and a position, and nothing else the lesson needs.
Run: uv run python exercises/01_what_is_kafka.py   (needs Docker; starts and removes its own containers)
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

ORDERS = [
    ("c1", '{"order":"o-1001","item":"book","qty":1}'),
    ("c2", '{"order":"o-1002","item":"pen","qty":3}'),
    ("c1", '{"order":"o-1003","item":"lamp","qty":1}'),
    ("c3", '{"order":"o-1004","item":"cup","qty":2}'),
    ("c2", '{"order":"o-1005","item":"book","qty":2}'),
]


def main() -> None:
    show("start one broker (KRaft, no ZooKeeper)")
    c = Cluster(1).start()
    props = c.sh("grep -E '^(process.roles|node.id|controller.quorum)' /opt/kafka/config/server.properties || true")
    check("the broker answers on its internal listener", c.cli("kafka-topics.sh", *c.bs(), "--list") == "")
    ver = c.cli("kafka-broker-api-versions.sh", *c.bs()).splitlines()[0]
    show("kafka-broker-api-versions.sh (first line)", ver)
    check("it is Kafka 4.4.0", "4.4" in c.sh("ls /opt/kafka/libs | grep -E '^kafka_2.13' "), c.sh("ls /opt/kafka/libs | grep -E '^kafka_2.13'"))
    show("process.roles of this image", props or "(set by environment variables in this exercise)")

    show("create the topic orders: one partition, one replica")
    c.topic("orders", 1, 1)
    print(c.describe("orders"))

    show("send five orders with the console producer (key:value)")
    lines = "\\n".join(f"{k}:{v}" for k, v in ORDERS)
    c.sh(
        f"printf '{lines}\\n' | /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server klab-k1:9092 --topic orders "
        "--property parse.key=true --property key.separator=:"
    )
    ends = c.cli("kafka-get-offsets.sh", *c.bs(), "--topic", "orders")
    show("kafka-get-offsets.sh (topic:partition:end offset)", ends)
    check("the end offset is 5 (positions 0 to 4 are used)", ends.strip() == "orders:0:5", ends)

    show("read them with the console consumer, group billing")
    out = c.cli(
        "kafka-console-consumer.sh", *c.bs(), "--topic", "orders", "--group", "billing", "--from-beginning", "--max-messages", "5",
        "--property", "print.offset=true", "--property", "print.key=true",
    )
    rows = [line for line in out.splitlines() if line.startswith("Offset:")]
    print("\n".join("  " + r for r in rows))
    check("five records came back, offsets 0 to 4 in order", [r.split("\t")[0] for r in rows] == [f"Offset:{i}" for i in range(5)], out)
    check("keys and values are what was sent", rows[1].split("\t")[1:] == ["c2", ORDERS[1][1]], rows[1])

    show("the records are still there: another group reads the same five")
    other = c.cli(
        "kafka-console-consumer.sh", *c.bs(), "--topic", "orders", "--group", "shipping", "--from-beginning", "--max-messages", "5",
        "--property", "print.offset=true",
    )
    rows2 = [line for line in other.splitlines() if line.startswith("Offset:")]
    check("group shipping reads all five records again", len(rows2) == 5 and rows2[0].startswith("Offset:0"), other)
    check("the end offset did not move after two groups read", c.cli("kafka-get-offsets.sh", *c.bs(), "--topic", "orders").strip() == "orders:0:5")

    show("each group has its own bookmark")
    groups = c.cli("kafka-consumer-groups.sh", *c.bs(), "--describe", "--all-groups")
    print(groups)
    check("both groups sit at offset 5 with lag 0", groups.count(" 5 ") >= 2 and "orders" in groups, groups)

    show("three more orders arrive: the lag of each group is 3")
    c.sh(
        "printf 'c1:{\"order\":\"o-1006\"}\\nc4:{\"order\":\"o-1007\"}\\nc2:{\"order\":\"o-1008\"}\\n' | /opt/kafka/bin/kafka-console-producer.sh --bootstrap-server klab-k1:9092 "
        "--topic orders --property parse.key=true --property key.separator=:"
    )
    groups2 = c.cli("kafka-consumer-groups.sh", *c.bs(), "--describe", "--group", "billing")
    print(groups2)
    row = [ln.split() for ln in groups2.splitlines() if ln.split()[:2] == ["billing", "orders"]][0]
    check("billing: current offset 5, log end offset 8, lag 3", row[3:6] == ["5", "8", "3"], str(row))

    show("a record in code: key, value, timestamp, partition, offset")
    got = consume(c, "orders", "inspect", 8)
    print(f"  offset {got[0]['offset']}: key={got[0]['key']} value={got[0]['value']}")
    check("eight records, offsets 0 to 7", [g["offset"] for g in got] == list(range(8)), str(got))

    show("what the topic looks like on the broker's disk")
    files = c.sh("ls -1 /var/lib/kafka/data/orders-0")
    print("\n".join("  " + f for f in files.splitlines()))
    check("the partition is a folder with a .log, .index and .timeindex", all(any(x.endswith(s) for x in files.splitlines()) for s in (".log", ".index", ".timeindex")), files)
    topics = c.cli("kafka-topics.sh", *c.bs(), "--list", "--exclude-internal")
    check("__consumer_offsets is the internal topic that holds the bookmarks", "__consumer_offsets" in c.cli("kafka-topics.sh", *c.bs(), "--list") and topics.strip() == "orders")


if __name__ == "__main__":
    main_guard(main)
