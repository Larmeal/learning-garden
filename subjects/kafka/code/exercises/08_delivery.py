"""Lesson 8: delivery guarantees. Duplicates from retries, the idempotent producer, loss from committing too early, transactions and exactly once.

Asserts what the lesson prints (3 brokers and one dedicated controller):
  - a producer without idempotence that retries after a timeout writes the same record twice; the idempotent producer writes it once;
  - committing the offset before processing and crashing loses records; committing after processing and crashing repeats records (lesson 4 showed the repeat);
  - a transaction that is committed shows its records to a read_committed consumer, an aborted one does not, and an open one holds the reader back (last stable offset);
  - commit and abort markers use offsets of their own in the log (isControl: true);
  - consume, transform, produce inside a transaction with the consumer offsets gives every input exactly one output even when the first attempt is abandoned, which a plain producer does not.
`--write` saves labs/kafka/delivery.json (the log with its markers) for TxnLab.
Run: uv run python exercises/08_delivery.py [--write]
"""

import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403
from confluent_kafka import Consumer, Producer, TopicPartition  # noqa: E402

DATA = "/var/lib/kafka/data"


def values(c: Cluster, topic: str, isolation: str, group: str, want: int = 100, timeout: float = 8) -> list[str]:
    got = consume(c, topic, group, want, timeout=timeout, **{"isolation.level": isolation})
    return [g["value"] for g in got]


def leader_of(c: Cluster, topic: str) -> int:
    return parse_describe(c.describe(topic))[0]["leader"]


def duplicates(c: Cluster, topic: str, idempotent: bool) -> list[str]:
    """Send one record while a follower is frozen, so that the leader writes it but cannot answer in time. Return what the log holds."""
    c.topic(topic, 1, 3, min_insync_replicas="2")
    row = parse_describe(c.describe(topic))[0]
    follower = next(b for b in row["replicas"] if b != row["leader"])
    p = Producer({
        "bootstrap.servers": c.bootstrap, "acks": "all", "enable.idempotence": idempotent,
        "request.timeout.ms": 3000, "message.timeout.ms": 40000, "retry.backoff.ms": 200,
    })
    c.pause(follower)
    sent = {}
    p.produce(topic, value=b"order-o-1", on_delivery=lambda err, m: sent.update(err=err, offset=None if err else m.offset()))
    time.sleep(8)  # several attempts happen while the follower is frozen
    c.unpause(follower)
    p.flush(40)
    wait_for(lambda: len(parse_describe(c.describe(topic))[0]["isr"]) == 3, 60)
    time.sleep(1)
    return values(c, topic, "read_uncommitted", f"dup-check-{topic}", 10, timeout=6)


def main() -> None:
    c = Cluster(3, controllers=1, env={"KAFKA_BROKER_SESSION_TIMEOUT_MS": "9000"}).start()
    result: dict = {}

    show("a retry after a timeout: without idempotence the record is written twice")
    plain = duplicates(c, "dup-plain", False)
    print(f"  enable.idempotence=false -> the log holds {plain}")
    check("the same order is in the log more than once (the leader wrote it before it could answer)", len(plain) >= 2 and set(plain) == {"order-o-1"}, str(plain))

    show("the same, with the idempotent producer")
    idem = duplicates(c, "dup-idem", True)
    print(f"  enable.idempotence=true  -> the log holds {idem}")
    check("the log holds the order exactly once", idem == ["order-o-1"], str(idem))
    result["duplicates"] = {"plain": len(plain), "idempotent": len(idem)}

    show("commit before processing, then crash: records are lost")
    c.topic("jobs", 1, 3)
    produce(producer(c), "jobs", [(None, f"job-{i}") for i in range(10)])
    first = Consumer({"bootstrap.servers": c.bootstrap, "group.id": "early-commit", "auto.offset.reset": "earliest", "enable.auto.commit": False})
    first.subscribe(["jobs"])
    batch = []
    while len(batch) < 6:
        m = first.poll(1)
        if m is not None and not m.error():
            batch.append(m)
    first.commit(message=batch[-1], asynchronous=False)  # the bookmark says 6 are done ...
    first.close()  # ... but the process crashes before it handled any of them
    redo = consume(c, "jobs", "early-commit", 10, timeout=10)
    print(f"  the next consumer reads {[g['value'] for g in redo]}")
    check("job-0 to job-5 were never processed and will not be read again", [g["value"] for g in redo] == [f"job-{i}" for i in range(6, 10)], str(redo))

    show("a transaction: commit, abort, and one still open")
    c.topic("txn", 1, 3)
    tp = Producer({"bootstrap.servers": c.bootstrap, "transactional.id": "writer-1", "transaction.timeout.ms": 60000, "linger.ms": 0})
    tp.init_transactions()
    tp.begin_transaction()
    for v in ("a1", "a2"):
        tp.produce("txn", value=v.encode())
    tp.commit_transaction()
    tp.begin_transaction()
    for v in ("b1", "b2"):
        tp.produce("txn", value=v.encode())
    tp.flush(10)  # make sure b1 and b2 reached the log before the abort (abort drops what is still queued in the client)
    tp.abort_transaction()
    tp.begin_transaction()
    tp.produce("txn", value=b"c1")
    tp.flush(10)  # c1 is in the log but the transaction is not finished
    committed = values(c, "txn", "read_committed", "rc", 10, timeout=6)
    uncommitted = values(c, "txn", "read_uncommitted", "ru", 10, timeout=6)
    print(f"  read_committed   sees {committed}")
    print(f"  read_uncommitted sees {uncommitted}")
    check("read_committed sees only a1 and a2 (b1 and b2 were aborted, c1 is not finished)", committed == ["a1", "a2"], str(committed))
    check("read_uncommitted sees everything that was written, including the aborted b1 and b2", uncommitted == ["a1", "a2", "b1", "b2", "c1"], str(uncommitted))
    tp.commit_transaction()
    committed2 = values(c, "txn", "read_committed", "rc2", 10, timeout=6)
    check("after the commit of c1 a read_committed consumer sees a1, a2, c1", committed2 == ["a1", "a2", "c1"], str(committed2))

    show("the log has markers: control records that take an offset each")
    text = c.sh(f"/opt/kafka/bin/kafka-dump-log.sh --print-data-log --files {DATA}/txn-0/00000000000000000000.log", node=leader_of(c, "txn"))
    lines = [ln for ln in text.splitlines() if ln.startswith("baseOffset") or "| offset" in ln]
    rows = []
    for ln in lines:
        if ln.startswith("baseOffset"):
            ctrl = "isControl: true" in ln
            txn = "isTransactional: true" in ln
            base = int(re.search(r"baseOffset: (\d+)", ln).group(1))
        elif ln.startswith("| offset"):
            off = int(re.search(r"offset: (\d+)", ln).group(1))
            what = re.search(r"endTxnMarker: (\w+)", ln)
            payload = re.search(r"payload: (.*)$", ln)
            rows.append({"offset": off, "control": ctrl, "txn": txn, "what": what.group(1) if what else (payload.group(1) if payload else "")})
    print(table([[r["offset"], r["what"], "control" if r["control"] else "data"] for r in rows], ["offset", "content", "kind"]))
    check("8 offsets are used for 5 data records: two COMMIT markers and one ABORT marker, in the order they happened", [r["what"] for r in rows] == ["a1", "a2", "COMMIT", "b1", "b2", "ABORT", "c1", "COMMIT"], str([r["what"] for r in rows]))
    check("a data record is never a control record", all(r["control"] == (r["what"] in ("COMMIT", "ABORT")) for r in rows))
    result["log"] = rows

    show("consume, transform, produce: exactly once with a transaction")
    c.topic("in", 1, 3)
    c.topic("out", 1, 3)
    produce(producer(c), "in", [(None, f"n{i}") for i in range(10)])

    def worker(group: str, tid: str, crash_after_batch: int | None):
        cons = Consumer({"bootstrap.servers": c.bootstrap, "group.id": group, "auto.offset.reset": "earliest", "enable.auto.commit": False, "isolation.level": "read_committed"})
        cons.subscribe(["in"])
        prod = Producer({"bootstrap.servers": c.bootstrap, "transactional.id": tid, "linger.ms": 0, "transaction.timeout.ms": 10000})
        prod.init_transactions()
        batches = 0
        done = 0
        deadline = time.time() + 90
        idle = 0
        while idle < 2:  # stop when two polls in a row bring nothing: the input is finished
            if time.time() > deadline:
                sys.exit("FAILED: the worker did not finish")
            msgs = cons.consume(5, 3)
            msgs = [m for m in msgs if not m.error()]
            if not msgs:
                idle += 1 if done or batches else 0
                continue
            prod.begin_transaction()
            for m in msgs:
                prod.produce("out", value=(m.value().decode().upper()).encode())
            prod.send_offsets_to_transaction([TopicPartition(m.topic(), m.partition(), m.offset() + 1) for m in msgs[-1:]], cons.consumer_group_metadata())
            batches += 1
            if crash_after_batch is not None and batches == crash_after_batch:
                prod.flush(10)
                return cons, prod  # abandoned: the transaction stays open, nothing is committed
            prod.commit_transaction()
            done += len(msgs)
        cons.close()
        return None, None

    dead_cons, dead_prod = worker("eos", "eos-worker", crash_after_batch=2)
    after_crash = values(c, "out", "read_uncommitted", "peek-u", 20, timeout=6)
    print(f"  after the first attempt (batch 1 committed, batch 2 abandoned): read_uncommitted sees {len(after_crash)} outputs")
    check("the abandoned batch is in the log (10 outputs: 5 committed and 5 not finished)", len(after_crash) == 10, str(len(after_crash)))
    dead_cons.close()  # the crashed process is gone: its consumer leaves the group (its producer object stays, to show the fencing)
    worker("eos", "eos-worker", crash_after_batch=None)  # same transactional.id: init_transactions aborts the open one and fences the old producer
    final_c = values(c, "out", "read_committed", "peek-c", 30, timeout=8)
    final_u = values(c, "out", "read_uncommitted", "peek-u2", 30, timeout=8)
    print(f"  read_committed sees {len(final_c)} outputs: {final_c}")
    print(f"  read_uncommitted sees {len(final_u)} outputs (the aborted batch is still in the log)")
    check("with read_committed every input has exactly one output", final_c == [f"N{i}" for i in range(10)], str(final_c))
    check("the aborted attempt left 5 extra records that only read_uncommitted sees", len(final_u) == 15, str(len(final_u)))
    try:
        dead_prod.commit_transaction()
        check("the old producer cannot commit any more", False)
    except Exception as e:  # noqa: BLE001
        print(f"  the abandoned producer tried to commit: {str(e)[:100]}")
        check("the abandoned producer was fenced: its commit fails", True)

    if "--write" in sys.argv:
        write_json(LABS / "delivery.json", result)


if __name__ == "__main__":
    json  # noqa: B018
    main_guard(main)
