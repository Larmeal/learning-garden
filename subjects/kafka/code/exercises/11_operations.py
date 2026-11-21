"""Lesson 11: running Kafka. Advertised listeners, where the bookmarks live, lag, resetting offsets, dynamic configs and quotas.

Asserts what the lesson prints:
  - a client connects to the bootstrap address, gets the list of brokers from the broker itself, and then talks to the addresses in that list: when the advertised address is wrong the first call works and every later one fails;
  - consumer offsets are records in the internal topic __consumer_offsets, and the partition of a group is hash(group id) % 50;
  - lag is the log end offset minus the group's committed offset, and it grows when producers are faster than consumers;
  - an inactive group can be rewound with --reset-offsets, and then it reads the same records again;
  - a topic config set with kafka-configs takes effect at once and shows as DYNAMIC_TOPIC_CONFIG;
  - a producer quota slows a client down on the broker side.
Security (TLS, SASL, ACLs) and kafka-reassign-partitions were NOT run.
`--write` saves labs/kafka/listeners.json for ListenerLab.
Run: uv run python exercises/11_operations.py [--write]
"""

import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403
from confluent_kafka import Consumer, Producer  # noqa: E402
from confluent_kafka.admin import AdminClient  # noqa: E402


def java_hash(s: str) -> int:
    h = 0
    for ch in s:
        h = (31 * h + ord(ch)) & 0xFFFFFFFF
    return h - (1 << 32) if h & 0x80000000 else h


def main() -> None:
    result: dict = {}

    show("a wrong advertised listener: the first call works, the next ones do not")
    bad = Cluster(1, env={"KAFKA_ADVERTISED_LISTENERS": "INTERNAL://klab-k1:9092,EXTERNAL://broker.invalid:29092"}).start()
    errors: list[str] = []
    # the same broker answers differently on each listener: on INTERNAL it names itself klab-k1:9092, on EXTERNAL it names the address that was configured (and is wrong)
    inner = bad.cli("kafka-broker-api-versions.sh", "--bootstrap-server", "klab-k1:9092").splitlines()[0]
    outer = bad.cli("kafka-broker-api-versions.sh", "--bootstrap-server", "127.0.0.1:9094", "--command-config", "/dev/null", check=False)
    print(f"  through the INTERNAL listener the broker names itself: {inner.split(' ->')[0]}")
    check("on the internal listener the broker names itself klab-k1:9092", inner.startswith("klab-k1:9092 (id: 1"), inner)
    print("  through the EXTERNAL listener: " + (outer.strip().splitlines() or ["(nothing)"])[0][:160])
    check("through the external listener the Java tool cannot use the address it was given", "broker.invalid" in outer or "Timed out" in outer or "timed out" in outer or "resolve" in outer.lower(), outer[:300])
    errors: list[str] = []
    admin = AdminClient({"bootstrap.servers": "127.0.0.1:29092", "error_cb": lambda e: errors.append(str(e))})
    try:
        admin.list_topics(timeout=12)
        check("the metadata call from this computer should not work", False)
    except Exception as e:  # noqa: BLE001
        print(f"  librdkafka from this computer: {str(e)[:100]}")
    bad.topic("t", 1, 1)
    p = Producer({"bootstrap.servers": "127.0.0.1:29092", "message.timeout.ms": 8000, "error_cb": lambda e: errors.append(str(e))})
    got = []
    p.produce("t", value=b"x", on_delivery=lambda err, m: got.append(str(err) if err else "ok"))
    p.flush(15)
    print(f"  produce result: {got}")
    resolve = [e for e in errors if "resolve" in e.lower() or "broker.invalid" in e]
    print(f"  client log: {resolve[0][:150] if resolve else errors[:1]}")
    check("the record was not delivered", got and got[0] != "ok", str(got))
    check("the client log says it could not resolve broker.invalid", bool(resolve), str(errors[:3]))
    result["bad"] = {"advertised": "broker.invalid:29092", "produce": got[0][:60] if got else ""}
    cleanup()

    c = Cluster(1).start()
    show("where the bookmarks live: __consumer_offsets")
    c.topic("orders", 3, 1)
    produce(producer(c), "orders", [(None, f"o{i}") for i in range(30)])
    consume(c, "orders", "billing", 30)
    parts = c.cli("kafka-topics.sh", *c.bs(), "--describe", "--topic", "__consumer_offsets")
    print("  " + parts.splitlines()[0][:150])
    check("__consumer_offsets has 50 partitions", "PartitionCount: 50" in parts, parts.splitlines()[0])
    wanted = abs(java_hash("billing")) % 50
    sizes = {}
    for pt in range(50):
        sizes[pt] = int(c.sh(f"stat -c %s /var/lib/kafka/data/__consumer_offsets-{pt}/00000000000000000000.log 2>/dev/null || echo 0"))
    busy = [pt for pt, sz in sizes.items() if sz > 0]
    print(f"  partitions of __consumer_offsets that hold records: {busy}; hash('billing') % 50 = {wanted}")
    check("the group's bookmark is in partition abs(hashCode(group id)) % 50", busy == [wanted], f"{busy} vs {wanted}")
    out = c.cli("kafka-dump-log.sh", "--offsets-decoder", "--files", f"/var/lib/kafka/data/__consumer_offsets-{wanted}/00000000000000000000.log")
    lines = [ln for ln in out.splitlines() if '"type":"1"' in ln and '"topic":"orders"' in ln]
    print("  " + lines[0].split("key: ")[1][:200])
    check("the records of that partition are (group, topic, partition) -> offset: three of them for the three partitions of orders", len(lines) == 3 and all('"group":"billing"' in ln and '"offset"' in ln for ln in lines), out[:400])
    print("  the group's other records: " + ", ".join(sorted({re.search(r'"type":"(\d)"', ln).group(1) for ln in out.splitlines() if 'key: {"type"' in ln})) + " (type 1 = offset commit, type 2 = group metadata)")

    show("lag: a producer that is faster than the consumer")
    produce(producer(c), "orders", [(None, f"late{i}") for i in range(60)])
    desc = c.cli("kafka-consumer-groups.sh", *c.bs(), "--describe", "--group", "billing")
    rows = [ln.split() for ln in desc.splitlines() if ln.split()[:2] == ["billing", "orders"]]
    lag = sum(int(r[5]) for r in rows)
    print(desc)
    check("the lag of the group is 60 (the end offsets minus its bookmarks)", lag == 60, str(rows))
    result["lag"] = lag

    show("rewind a group: --reset-offsets --to-earliest")
    dry = c.cli("kafka-consumer-groups.sh", *c.bs(), "--group", "billing", "--topic", "orders", "--reset-offsets", "--to-earliest", "--dry-run")
    print(dry)
    check("the dry run lists new offsets of 0 and changes nothing", "orders" in dry and sum(int(ln.split()[5]) for ln in c.cli("kafka-consumer-groups.sh", *c.bs(), "--describe", "--group", "billing").splitlines() if ln.split()[:2] == ["billing", "orders"]) == 60)
    c.cli("kafka-consumer-groups.sh", *c.bs(), "--group", "billing", "--topic", "orders", "--reset-offsets", "--to-earliest", "--execute")
    again = consume(c, "orders", "billing", 200, timeout=15)
    check("after the reset the group reads all 90 records again", len(again) == 90, str(len(again)))
    cons = Consumer({"bootstrap.servers": c.bootstrap, "group.id": "billing", "auto.offset.reset": "earliest"})
    cons.subscribe(["orders"])
    cons.poll(5)
    refused = c.cli("kafka-consumer-groups.sh", *c.bs(), "--group", "billing", "--topic", "orders", "--reset-offsets", "--to-earliest", "--execute", check=False)
    cons.close()
    print("  while a member is active: " + refused.strip().splitlines()[0][:150])
    check("a group with an active member cannot be rewound", "active" in refused.lower() or "Assignments can only be reset if the group" in refused or "not" in refused.lower(), refused[:200])

    show("change a config while the broker runs")
    c.cli("kafka-configs.sh", *c.bs(), "--alter", "--entity-type", "topics", "--entity-name", "orders", "--add-config", "retention.ms=123456")
    cfg = c.cli("kafka-configs.sh", *c.bs(), "--describe", "--all", "--entity-type", "topics", "--entity-name", "orders")
    line = next(ln for ln in cfg.splitlines() if ln.strip().startswith("retention.ms="))
    print("  " + line.strip()[:200])
    check("retention.ms is 123456 and says it came from DYNAMIC_TOPIC_CONFIG", "retention.ms=123456" in line and "DYNAMIC_TOPIC_CONFIG:retention.ms=123456" in line, line)

    show("a quota: the broker slows a client down")
    c.topic("quota", 1, 1)
    payload = "x" * 1000
    def send(client_id: str) -> float:
        prod = Producer({"bootstrap.servers": c.bootstrap, "client.id": client_id, "linger.ms": 0})
        t = time.time()
        for _ in range(40):  # 40 requests of 100 KB = 4 MB; a quota allows a burst of about ten seconds of its rate before it slows the client
            for _ in range(100):
                prod.produce("quota", value=payload.encode())
            prod.flush(60)
        return time.time() - t

    t_free = send("free")
    c.cli("kafka-configs.sh", *c.bs(), "--alter", "--entity-type", "clients", "--entity-name", "limited", "--add-config", "producer_byte_rate=200000")
    t_slow = send("limited")
    print(f"  4 MB without a quota: {t_free:.1f} s; with producer_byte_rate=200000 (200 KB/s): {t_slow:.1f} s")
    check("4 MB at 200 KB/s takes many seconds more than without a quota (the first 2 MB or so go through as a burst)", t_slow > t_free + 5 and t_slow > 6, f"{t_free:.1f} vs {t_slow:.1f}")
    result["quota"] = {"free": round(t_free, 1), "limited": round(t_slow, 1)}

    if "--write" in sys.argv:
        write_json(LABS / "listeners.json", result)
    re  # noqa: B018


if __name__ == "__main__":
    main_guard(main)
