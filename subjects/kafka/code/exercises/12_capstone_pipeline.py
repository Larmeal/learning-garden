"""Lesson 12: capstone. An order pipeline that survives a crashed consumer and a killed broker without losing or double counting an order.

Setup: 3 brokers and 1 controller node, topic `orders` with 6 partitions, 3 replicas, min.insync.replicas=2.
  producer: idempotent, acks=all, key = customer, 600 orders in three waves;
  consumers: a group `ledger` of three workers, each writes to a SQLite table with `order_id` as primary key (INSERT OR IGNORE) and only then commits its offsets.
Events: wave 1 -> a worker crashes without committing -> wave 2 -> a broker is killed (SIGKILL) while wave 3 is sent and a replacement worker starts.
Asserts:
  - the producer got an acknowledgement for all 600 orders, in spite of the killed broker;
  - the table holds exactly 600 distinct orders: nothing lost, nothing counted twice;
  - the workers saw more than 600 deliveries (the crash made some orders come twice) and the table absorbed them;
  - for every customer the orders are in the table in the order they were sent (one key, one partition, idempotent producer);
  - at the end the group has lag 0.
`--write` saves labs/kafka/capstone.json (the timeline) for PipelineLab.
Run: uv run python exercises/12_capstone_pipeline.py [--write]
"""

import sqlite3
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403
from confluent_kafka import Consumer, Producer  # noqa: E402

CUSTOMERS = [f"c{i}" for i in range(1, 9)]
TOTAL = 600


class Sink:
    """The place the pipeline writes to: one row per order, order_id is the primary key."""

    def __init__(self) -> None:
        self.db = sqlite3.connect(":memory:", check_same_thread=False)
        self.db.execute("create table orders (order_id text primary key, customer text, seq integer, part integer, off integer, arrived real)")
        self.lock = threading.Lock()
        self.deliveries = 0
        self.timeline: list[dict] = []
        self.t0 = time.time()

    def write(self, order_id: str, customer: str, seq: int, part: int, off: int) -> None:
        with self.lock:
            self.deliveries += 1
            self.db.execute("insert or ignore into orders values (?,?,?,?,?,?)", (order_id, customer, seq, part, off, time.time() - self.t0))
            self.db.commit()

    def count(self) -> int:
        with self.lock:
            return self.db.execute("select count(*) from orders").fetchone()[0]

    def rows(self) -> list[tuple]:
        with self.lock:
            return self.db.execute("select order_id, customer, seq, part, off from orders").fetchall()

    def mark(self, what: str, **kw) -> None:
        self.timeline.append({"t": round(time.time() - self.t0, 1), "what": what, **kw})
        print(f"  [{self.timeline[-1]['t']:6.1f} s] {what} {kw or ''}")


class Worker:
    def __init__(self, c: Cluster, sink: Sink, name: str) -> None:
        self.name, self.sink, self.stop_flag, self.crashed = name, sink, threading.Event(), False
        self.consumer = Consumer({
            "bootstrap.servers": c.bootstrap, "group.id": "ledger", "auto.offset.reset": "earliest", "enable.auto.commit": False,
            "session.timeout.ms": 10000, "heartbeat.interval.ms": 1000, "client.id": name, "partition.assignment.strategy": "cooperative-sticky",
        })
        self.consumer.subscribe(["orders"])
        self.since_commit = 0
        self.current: list[int] = []
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.thread.start()

    def owns(self) -> list[int]:
        return self.current

    def run(self) -> None:
        while not self.stop_flag.is_set():
            m = self.consumer.poll(0.2)
            self.current = sorted(p.partition for p in self.consumer.assignment())  # only this thread talks to the consumer
            if m is None or m.error():
                continue
            customer = m.key().decode()
            order_id, seq_text = m.value().decode().split(",")
            seq = int(seq_text)
            self.sink.write(order_id, customer, seq, m.partition(), m.offset())
            self.since_commit += 1
            if self.since_commit >= 40:  # commit only after the rows are in the table
                try:
                    self.consumer.commit(asynchronous=False)
                except Exception:  # noqa: BLE001
                    pass
                self.since_commit = 0

    def crash(self) -> int:
        """Stop without committing what was read since the last commit, like a process that is killed."""
        self.stop_flag.set()
        self.thread.join(10)
        lost = self.since_commit
        self.crashed = True
        self.consumer.close()  # auto commit is off: close() commits nothing
        return lost

    def finish(self) -> None:
        self.stop_flag.set()
        self.thread.join(10)
        try:
            self.consumer.commit(asynchronous=False)
        except Exception:  # noqa: BLE001
            pass
        self.consumer.close()


def send(p: Producer, first: int, last: int, errors: list) -> None:
    for i in range(first, last):
        customer = CUSTOMERS[i % len(CUSTOMERS)]
        p.produce("orders", key=customer.encode(), value=f"o-{i:04d},{i}".encode(), on_delivery=lambda e, m: errors.append(str(e)) if e else None)
        p.poll(0)
        time.sleep(0.01)


def main() -> None:
    c = Cluster(3, controllers=1, env={"KAFKA_BROKER_SESSION_TIMEOUT_MS": "9000"}).start()
    c.topic("orders", 6, 3, min_insync_replicas="2")
    sink = Sink()
    errors: list[str] = []
    prod = Producer({"bootstrap.servers": c.bootstrap, "enable.idempotence": True, "acks": "all", "partitioner": "murmur2_random", "linger.ms": 5, "message.timeout.ms": 120000})

    sink.mark("start", brokers=3, partitions=6)
    workers = [Worker(c, sink, f"w{i}") for i in (1, 2, 3)]
    wait_for(lambda: sorted(p for w in workers for p in w.owns()) == list(range(6)), 60)
    sink.mark("three workers share the six partitions", owners={w.name: w.owns() for w in workers})

    send(prod, 0, 200, errors)
    prod.flush(60)
    wait_for(lambda: sink.count() >= 150, 60)
    sink.mark("wave 1 sent (200 orders)", in_table=sink.count())

    victim = workers[1]
    lost = victim.crash()
    check("the crashed worker had read orders that it had not committed yet", lost > 0, str(lost))
    sink.mark("worker w2 crashed without committing", rows_since_last_commit=lost)
    send(prod, 200, 400, errors)
    prod.flush(60)
    survivors = [workers[0], workers[2]]
    wait_for(lambda: sorted(p for w in survivors for p in w.owns()) == list(range(6)), 60)
    sink.mark("the two survivors took over the six partitions", owners={w.name: w.owns() for w in survivors})
    wait_for(lambda: sink.count() >= 380, 90)
    sink.mark("wave 2 sent (400 orders so far)", in_table=sink.count())

    row = parse_describe(c.describe("orders"))[0]
    victim_broker = row["leader"]
    c.kill(victim_broker)
    sink.mark(f"broker {victim_broker} killed (leader of partition 0)", partition0_isr=row["isr"])
    replacement = Worker(c, sink, "w4")
    workers.append(replacement)
    t_kill = time.time()
    send(prod, 400, TOTAL, errors)
    prod.flush(120)
    sink.mark("wave 3 sent (600 orders)", seconds_since_kill=round(time.time() - t_kill, 1))
    check("the producer got an acknowledgement for every order, in spite of the killed broker", not errors, str(errors[:3]))

    live = [w for w in workers if not w.crashed]
    via = next(n for n in (1, 2, 3) if n != victim_broker)

    def lag() -> int:
        out = c.cli("kafka-consumer-groups.sh", *c.bs(via), "--describe", "--group", "ledger", node=via, check=False)
        rows = [ln.split() for ln in out.splitlines() if ln.split()[:2] == ["ledger", "orders"]]
        ends = sum(int(r[4]) for r in rows if r[4].isdigit())
        return sum(int(r[5]) for r in rows if r[5].isdigit()) if ends == TOTAL else 10**6

    wait_for(lambda: sink.count() == TOTAL, 120)
    time.sleep(2)
    for w in live:
        w.finish()  # the last commit of each worker, after its rows are in the table
    wait_for(lambda: lag() == 0, 60)
    sink.mark("every order is in the table and the group lag is 0", in_table=sink.count())
    ends = c.cli("kafka-get-offsets.sh", *c.bs(via), "--topic", "orders", node=via).split()
    per_partition = {int(e.split(":")[1]): int(e.split(":")[2]) for e in ends}
    print(f"  records per partition: {per_partition}")
    check("the 8 customers fill only some of the 6 partitions (keys are not spread evenly)", sum(per_partition.values()) == TOTAL and 0 in per_partition.values(), str(per_partition))

    distinct = sink.count()
    print(f"\n  rows in the table: {distinct}, deliveries seen by the workers: {sink.deliveries}, extra deliveries: {sink.deliveries - distinct}")
    check("the table holds exactly 600 orders", distinct == TOTAL, str(distinct))
    check("the crash made at least the uncommitted orders come twice, and the table absorbed them", sink.deliveries - distinct >= lost > 0, f"{sink.deliveries} deliveries, {lost} uncommitted")
    ids = {r[0] for r in sink.rows()}
    check("no order is missing: o-0000 to o-0599 are all there", ids == {f"o-{i:04d}" for i in range(TOTAL)})

    rows = sorted(sink.rows(), key=lambda r: (r[3], r[4]))
    per_customer: dict[str, list[int]] = {}
    for _id, customer, seq, _part, _off in rows:
        per_customer.setdefault(customer, []).append(seq)
    check("for every customer the orders sit in the log in the order they were sent", all(v == sorted(v) for v in per_customer.values()), str({k: v[:5] for k, v in per_customer.items()}))
    after = parse_describe(c.describe("orders", node=via))
    check("every partition has a leader that is not the killed broker", all(r["leader"] not in (None, victim_broker) for r in after), str(after))
    result = {"timeline": sink.timeline, "distinct": distinct, "deliveries": sink.deliveries, "killed_broker": victim_broker}

    if "--write" in sys.argv:
        write_json(LABS / "capstone.json", result)


if __name__ == "__main__":
    main_guard(main)
