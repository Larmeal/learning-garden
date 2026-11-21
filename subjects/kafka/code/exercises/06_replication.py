"""Lesson 6: replication. A leader and followers, the in-sync replicas (ISR), the high watermark, and what a broker failure does.

Asserts what the lesson prints (3 brokers):
  - every partition has one leader and two followers, and the three copies of a partition are the same bytes;
  - the high watermark is written in `replication-offset-checkpoint`;
  - a broker that is stopped leaves the ISR and, once back, catches up and returns;
  - a broker that is killed (no goodbye) is noticed by the controller after about broker.session.timeout.ms, a follower becomes the leader, and every record that was acknowledged with acks=all is still there;
  - with min.insync.replicas=2 and only one broker alive, acks=all fails with NOT_ENOUGH_REPLICAS while consumers can still read;
  - with min.insync.replicas=1, a write acknowledged by a lone leader is lost when that leader dies and an out-of-sync replica is allowed to take over (unclean.leader.election.enable=true).
`--write` saves labs/kafka/replication.json (what each step looked like) for IsrLab.
Run: uv run python exercises/06_replication.py [--write]
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

DATA = "/var/lib/kafka/data"


def part(c: Cluster, topic: str, via: int = 1) -> list[dict]:
    return parse_describe(c.describe(topic, node=via))


def alive_node(c: Cluster, avoid: list[int]) -> int:
    return next(i for i in range(1, c.size + 1) if i not in avoid)


def main() -> None:
    c = Cluster(3, controllers=1, env={"KAFKA_BROKER_SESSION_TIMEOUT_MS": "9000"}).start()
    result: dict = {"steps": []}

    show("a topic with three replicas of each of three partitions")
    c.topic("orders", 3, 3)
    rows = part(c, "orders")
    print(c.describe("orders"))
    check("each partition has a leader and 3 replicas, all in sync", all(r["leader"] in r["replicas"] and sorted(r["isr"]) == sorted(r["replicas"]) and len(r["replicas"]) == 3 for r in rows), str(rows))
    check("the leaders are spread over more than one broker", len({r["leader"] for r in rows}) > 1, str(rows))
    result["steps"].append({"what": "created", "partitions": rows})

    show("write 30 orders with acks=all; the three copies of a partition are the same")
    p = producer(c, partitioner="murmur2_random", acks="all")
    landed = produce(p, "orders", [(f"c{i % 6 + 1}", f'{{"n":{i}}}') for i in range(30)])
    check("30 acknowledged", len(landed) == 30 and all("error" not in x for x in landed))
    time.sleep(1)
    sizes = []
    for r in rows:
        per = [int(c.sh(f"stat -c %s {DATA}/orders-{r['partition']}/00000000000000000000.log", node=b)) for b in (1, 2, 3)]
        sizes.append(per)
        print(f"  orders-{r['partition']}: log size on broker 1,2,3 = {per}, leader {r['leader']}")
    check("every replica of a partition has a log file of the same size", all(len(set(s)) == 1 and s[0] > 0 for s in sizes), str(sizes))
    cp = c.sh(f"cat {DATA}/replication-offset-checkpoint", node=1)
    print("  replication-offset-checkpoint of broker 1:\n    " + cp.replace("\n", "\n    "))
    check("the checkpoint lists the high watermark of each partition (a line 'orders <partition> <offset>')", any(line.startswith("orders ") for line in cp.splitlines()), cp)

    show("stop a follower (clean shutdown): it leaves the ISR; start it: it catches up and comes back")
    follower = next(b for b in rows[0]["replicas"] if b != rows[0]["leader"])
    c.stop(follower)
    wait_for(lambda: all(follower not in r["isr"] for r in part(c, "orders", alive_node(c, [follower]))), 40)
    now = part(c, "orders", alive_node(c, [follower]))
    print(f"  broker {follower} stopped, ISR of partition 0: {now[0]['isr']}")
    check("the stopped broker is no longer in any ISR", all(follower not in r["isr"] for r in now), str(now))
    urp = c.cli("kafka-topics.sh", *c.bs(alive_node(c, [follower])), "--describe", "--under-replicated-partitions", node=alive_node(c, [follower]))
    check("kafka-topics --under-replicated-partitions lists the partitions that lost a copy", "orders" in urp, urp)
    produce(p, "orders", [(f"c{i % 6 + 1}", f'{{"n":{100 + i}}}') for i in range(30)])
    c.begin(follower)
    took = wait_for(lambda: all(follower in r["isr"] for r in part(c, "orders", follower)), 90)
    print(f"  broker {follower} is back in every ISR after {took:.1f} s")
    check("after the restart the broker caught up and is in every ISR again", all(follower in r["isr"] for r in part(c, "orders", follower)))
    result["steps"].append({"what": "follower stopped and back", "follower": follower, "seconds": round(took, 1)})

    show("kill the leader of partition 0 (SIGKILL, no goodbye)")
    rows = part(c, "orders")
    victim = rows[0]["leader"]
    before = 60
    c.kill(victim)
    t0 = time.time()
    via = alive_node(c, [victim])

    def new_leader() -> bool:
        r0 = part(c, "orders", via)[0]
        return r0["leader"] not in (None, victim)

    wait_for(new_leader, 60, step=0.5)
    took = time.time() - t0
    after = part(c, "orders", via)
    print(f"  leader of partition 0 was {victim}; after {took:.1f} s it is {after[0]['leader']}; ISR {after[0]['isr']}")
    check("a follower became the leader within the session timeout plus a little (3 to 30 s)", 3 <= took <= 30, f"{took:.1f}")
    check("the dead broker is out of the ISR", victim not in after[0]["isr"] and len(after[0]["isr"]) == 2, str(after))
    got = consume(c, "orders", "after-kill", before, timeout=40)
    check("all 60 acknowledged records are still readable", len(got) == before, f"{len(got)}")
    result["steps"].append({"what": "leader killed", "victim": victim, "new_leader": after[0]["leader"], "seconds": round(took, 1), "records": len(got)})
    c.begin(victim)
    wait_for(lambda: all(victim in r["isr"] for r in part(c, "orders", via)), 90)
    check("the old leader came back as a follower and is in the ISR", all(victim in r["isr"] for r in part(c, "orders", via)))

    show("min.insync.replicas=2 and one broker left: writes stop, reads go on")
    c.topic("strict", 1, 3, min_insync_replicas="2")
    produce(producer(c, acks="all"), "strict", [(None, f"v{i}") for i in range(5)])
    leader = part(c, "strict")[0]["leader"]
    others = [b for b in (1, 2, 3) if b != leader]
    c.stop(others[0])
    c.stop(others[1])
    wait_for(lambda: part(c, "strict", leader)[0]["isr"] == [leader], 60)
    print(f"  only broker {leader} is alive, ISR = {part(c, 'strict', leader)[0]['isr']}, min.insync.replicas=2")
    err = produce(producer(c, acks="all", **{"message.timeout.ms": 8000}), "strict", [(None, "v-new")])
    print(f"  write result: {err}")
    check("the write does not succeed: the client retries NOT_ENOUGH_REPLICAS and gives up with MSG_TIMED_OUT", "error" in err[0] and "TIMED_OUT" in err[0]["error"].upper(), str(err))
    readable = consume(c, "strict", "reader", 5, timeout=30)
    check("the 5 records already in the log can still be read", len(readable) == 5)
    result["steps"].append({"what": "min isr", "error": err[0]["error"][:80]})
    c.begin(others[0])
    c.begin(others[1])
    wait_for(lambda: sorted(part(c, "strict", leader)[0]["isr"]) == [1, 2, 3], 90)

    show("min.insync.replicas=1 and an unclean election: an acknowledged write is lost")
    c.topic("lossy", 1, 3, min_insync_replicas="1")
    produce(producer(c, acks="all"), "lossy", [(None, f"safe-{i}") for i in range(3)])
    row = part(c, "lossy")[0]
    a = row["leader"]
    b, c_ = [x for x in row["replicas"] if x != a]
    print(f"  leader {a}, followers {b} and {c_}")
    c.stop(c_)
    c.stop(b)
    wait_for(lambda: part(c, "lossy", a)[0]["isr"] == [a], 60)
    acked = produce(producer(c, acks="all"), "lossy", [(None, f"only-on-{a}-{i}") for i in range(5)])
    check("the lone leader acknowledged 5 more records (acks=all, ISR of one)", all("offset" in x and x["offset"] is not None for x in acked), str(acked))
    print(f"  the 5 records got offsets {[x['offset'] for x in acked]}")
    c.kill(a)
    c.begin(b)
    time.sleep(12)
    row2 = part(c, "lossy", b)[0]
    print(f"  broker {a} is dead, broker {b} is back but was not in the ISR: leader {row2['leader']}, ISR {row2['isr']}")
    check("the partition has no leader (the only broker that has all the data is dead)", row2["leader"] is None, str(row2))
    out = c.cli("kafka-leader-election.sh", *c.bs(b), "--election-type", "unclean", "--topic", "lossy", "--partition", "0", node=b)
    print(f"  kafka-leader-election.sh --election-type unclean: {out.strip().splitlines()[-1] if out.strip() else ''}")
    wait_for(lambda: part(c, "lossy", b)[0]["leader"] == b, 60)
    print(f"  unclean election: broker {b} is the leader now")
    produce(producer(c, acks="all"), "lossy", [(None, f"new-{i}") for i in range(2)])
    c.begin(a)
    c.begin(c_)
    wait_for(lambda: sorted(part(c, "lossy", b)[0]["isr"]) == sorted([1, 2, 3]), 90)
    final = consume(c, "lossy", "final", 10, timeout=15)
    values = [g["value"] for g in final]
    print(f"  what is in the log now: {values}")
    check("the three safe records and the two new ones are there", values == ["safe-0", "safe-1", "safe-2", "new-0", "new-1"], str(values))
    check("the 5 acknowledged records are gone for good", not any(v.startswith("only-on") for v in values))
    result["steps"].append({"what": "unclean election", "lost": 5, "values": values})

    if "--write" in sys.argv:
        write_json(LABS / "replication.json", result)


if __name__ == "__main__":
    main_guard(main)
