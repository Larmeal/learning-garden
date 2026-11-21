"""Lesson 3: the producer. Batches, compression, acks and the idempotent producer, read from the broker's own log.

Asserts what the lesson prints:
  - the producer does not send one record at a time: records are packed into batches, and `kafka-dump-log.sh` shows one line per batch with `count:`;
  - a record sent every 2 ms makes about one batch per record with linger.ms=0 and far fewer batches with linger.ms=50;
  - compression is done per batch, and the size of the log on disk drops (gzip, lz4, zstd) for the same 3000 orders;
  - with acks=0 the client gets no offset back; with acks=all it does;
  - the broker log shows producerId and sequence numbers only when the producer is idempotent (librdkafka default: off, the Java client since 3.0: on);
  - a record larger than message.max.bytes is refused by the client before it is sent.
`--write` saves labs/kafka/batching.json (measured batch counts, sizes) for BatchLab.
Run: uv run python exercises/03_producers.py [--write]
"""

import json
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

LOG = "/var/lib/kafka/data/{t}-0/00000000000000000000.log"


def order(i: int) -> str:
    rnd = random.Random(i)
    return json.dumps({"order": f"o-{100000 + i}", "customer": f"c{rnd.randint(1, 200)}", "item": rnd.choice(["book", "pen", "lamp", "cup", "bag", "mug"]), "qty": rnd.randint(1, 5), "price": round(rnd.uniform(3, 90), 2)})


def batches_of(c: Cluster, topic: str) -> list[dict]:
    """Parse the `baseOffset: ... count: ...` lines that kafka-dump-log.sh prints, one per batch."""
    out = c.sh(f"/opt/kafka/bin/kafka-dump-log.sh --files {LOG.format(t=topic)}")
    rows = []
    for line in out.splitlines():
        if line.startswith("baseOffset"):
            parts = line.replace(": ", ":").split()
            rows.append({p.split(":")[0]: p.split(":", 1)[1] for p in parts if ":" in p})
    return rows


def size_of(c: Cluster, topic: str) -> int:
    return int(c.sh(f"stat -c %s {LOG.format(t=topic)}"))


def trickle(p, topic: str, n: int, gap: float) -> None:
    """One record every `gap` seconds, as a service that sends an order whenever one arrives."""
    for i in range(n):
        p.produce(topic, value=order(i).encode())
        p.poll(0)
        time.sleep(gap)
    p.flush(30)


def main() -> None:
    c = Cluster(1).start()
    result: dict = {}

    show("batches: 600 orders, one every 2 ms")
    rows = []
    for name, lingering in (("trickle-l0", 0), ("trickle-l50", 50)):
        c.topic(name, 1, 1)
        trickle(producer(c, **{"linger.ms": lingering}), name, 600, 0.002)
        b = batches_of(c, name)
        rows.append([f"linger.ms={lingering}", len(b), max(int(x["count"]) for x in b), size_of(c, name)])
        result[name] = {"linger": lingering, "batches": len(b), "biggest": max(int(x["count"]) for x in b)}
    print(table(rows, ["setting", "batches in the log", "biggest batch", "bytes"]))
    l0, l50 = rows[0][1], rows[1][1]
    check("with linger.ms=0 almost every record is its own batch (more than 300 batches for 600 records)", l0 > 300, str(rows))
    check("with linger.ms=50 there are far fewer batches (less than a tenth)", l50 * 10 < l0, str(rows))
    check("both topics hold all 600 records", c.cli("kafka-get-offsets.sh", *c.bs(), "--topic", "trickle-l0").strip().endswith(":600") and c.cli("kafka-get-offsets.sh", *c.bs(), "--topic", "trickle-l50").strip().endswith(":600"))

    show("a look at one batch line of the broker's log")
    first = c.sh(f"/opt/kafka/bin/kafka-dump-log.sh --files {LOG.format(t='trickle-l50')} | grep -m1 baseOffset")
    print("  " + first)
    check("a batch line has count, size, compresscodec, CreateTime and crc", all(w in first for w in ("count:", "size:", "compresscodec:", "CreateTime:", "crc:")))

    show("compression: the same 3000 orders, one codec per topic")
    sizes = []
    for codec in ("none", "gzip", "lz4", "zstd", "snappy"):
        t = f"comp-{codec}"
        c.topic(t, 1, 1)
        p = producer(c, **{"compression.type": codec, "linger.ms": 100})
        produce(p, t, [(None, order(i)) for i in range(3000)])
        b = batches_of(c, t)
        biggest = max(b, key=lambda x: int(x["count"]))
        sizes.append([codec, len(b), size_of(c, t), biggest["compresscodec"]])
    base = sizes[0][2]
    for row in sizes:
        row.append(f"{row[2] / base:.0%}")
    print(table(sizes, ["codec", "batches", "log bytes", "codec of the biggest batch", "of none"]))
    result["compression"] = [{"codec": r[0], "bytes": r[2]} for r in sizes]
    check("the batch line names the codec that was used", [r[3] for r in sizes] == ["none", "gzip", "lz4", "zstd", "snappy"])
    check("every compressed log is smaller than the plain one", all(r[2] < base for r in sizes[1:]), str(sizes))
    check("gzip and zstd are below half of the plain size on these orders", sizes[1][2] < base / 2 and sizes[3][2] < base / 2, str(sizes))

    show("acks: what the client gets back")
    c.topic("acks", 1, 1)
    got0 = produce(producer(c, acks=0), "acks", [(None, "a")])[0]
    got1 = produce(producer(c, acks=1), "acks", [(None, "b")])[0]
    gotall = produce(producer(c, acks="all"), "acks", [(None, "c")])[0]
    print(f"  acks=0   -> offset {got0['offset']}")
    print(f"  acks=1   -> offset {got1['offset']}")
    print(f"  acks=all -> offset {gotall['offset']}")
    check("acks=0 returns no offset (the client did not wait for the broker)", got0["offset"] is None, str(got0))
    check("acks=1 and acks=all return the position of the record", got1["offset"] is not None and gotall["offset"] == got1["offset"] + 1, f"{got1} {gotall}")

    show("idempotence: producerId and sequence in the broker's log")
    c.topic("idem-off", 1, 1)
    c.topic("idem-on", 1, 1)
    produce(producer(c), "idem-off", [(None, "x") for _ in range(10)])
    produce(producer(c, **{"enable.idempotence": True}), "idem-on", [(None, "x") for _ in range(10)])
    off = batches_of(c, "idem-off")[0]
    on = batches_of(c, "idem-on")[0]
    print(f"  librdkafka default: producerId={off['producerId']} baseSequence={off['baseSequence']}")
    print(f"  enable.idempotence: producerId={on['producerId']} producerEpoch={on['producerEpoch']} baseSequence={on['baseSequence']} lastSequence={on['lastSequence']}")
    check("without idempotence the batch carries producerId -1 and no sequence", off["producerId"] == "-1" and off["baseSequence"] == "-1", str(off))
    check("with idempotence the batch carries a producerId and sequence 0 to 9", int(on["producerId"]) >= 0 and on["baseSequence"] == "0" and on["lastSequence"] == "9", str(on))

    show("a record bigger than message.max.bytes")
    c.topic("big", 1, 1)
    refused = produce(producer(c), "big", [(None, "y" * 100)])  # control: small is fine
    check("a small record is fine", refused[0].get("offset") == 0)
    try:
        produce(producer(c), "big", [(None, "y" * 2_000_000)])
        check("a 2 MB record is refused", False)
    except Exception as e:  # noqa: BLE001
        print(f"  {e}")
        check("a 2 MB record is refused with MSG_SIZE_TOO_LARGE before it leaves the client", "MSG_SIZE_TOO_LARGE" in str(e), str(e))

    if "--write" in sys.argv:
        write_json(LABS / "batching.json", result)


if __name__ == "__main__":
    main_guard(main)
