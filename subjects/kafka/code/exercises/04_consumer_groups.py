"""Lesson 4: consumers and consumer groups. Partitions are shared out between the members of a group, the bookmark is a committed offset.

Asserts what the lesson prints:
  - one member of a group owns all 3 partitions; every member that joins takes part of them; a 4th member of a 3 partition topic owns nothing;
  - when a member leaves, its partitions go to the members that are left, and no partition is ever owned by two members of the same group;
  - two groups are independent: each reads every record;
  - the committed offset is the bookmark: a new consumer of the group starts where the last commit was, so a crash between processing and committing means records are read twice;
  - a member that is killed (no goodbye) is only noticed after session.timeout.ms;
  - a new group with auto.offset.reset=latest sees nothing that was sent before it, with earliest it sees everything;
  - the new consumer group protocol (group.protocol=consumer, KIP-848) also shares the partitions, and the broker does the assignment.
`--write` saves labs/kafka/groups.json (the assignments seen for 1, 2, 3 and 4 members) for ConsumerGroupLab.
Run: uv run python exercises/04_consumer_groups.py [--write]
"""

import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403


def owners(members: list) -> dict[str, list[int]]:
    return {m.name: m.current for m in members}


def settled(members: list, parts: int) -> bool:
    got = sorted(p for m in members for p in m.current)
    return got == list(range(parts))


def main() -> None:
    c = Cluster(1).start()
    c.topic("orders", 3, 1)
    p = producer(c, partitioner="murmur2_random")
    produce(p, "orders", [(f"c{i % 6 + 1}", f'{{"n":{i}}}') for i in range(30)])
    result: dict = {"steps": []}

    show("one group, members join one by one (classic protocol, range assignor)")
    members: list[Member] = []
    for n in range(1, 5):
        members.append(Member(c, "billing", ["orders"], f"m{n}", **{"partition.assignment.strategy": "range"}))
        wait_for(lambda: settled(members, 3) and sum(1 for m in members if m.current) == min(n, 3), 60)
        time.sleep(1)
        now = owners(members)
        result["steps"].append({"members": n, "owners": now})
        print(f"  {n} member(s): {now}")
        flat = [p_ for v in now.values() for p_ in v]
        check(f"with {n} member(s) every partition has exactly one owner", sorted(flat) == [0, 1, 2], str(now))
    check("the 4th member owns nothing (3 partitions, 4 members)", members[3].current == [] or sorted(len(m.current) for m in members) == [0, 1, 1, 1], str(owners(members)))
    check("with 3 or more members nobody owns two partitions", all(len(m.current) <= 1 for m in members), str(owners(members)))

    show("a member leaves (close): its partition moves to someone else")
    leaver = next(m for m in members if m.current)
    lost = leaver.current
    leaver.leave()
    members.remove(leaver)
    wait_for(lambda: settled(members, 3), 40)
    now = owners(members)
    print(f"  {leaver.name} (had {lost}) left: {now}")
    result["steps"].append({"left": leaver.name, "owners": now})
    check("the three partitions are owned again by the members that are left", settled(members, 3), str(now))
    for m in members:
        m.leave()

    show("two groups read the same topic and do not disturb each other")
    a = consume(c, "orders", "group-a", 30)
    b = consume(c, "orders", "group-b", 30)
    check("each group got all 30 records", len(a) == 30 and len(b) == 30)

    show("the commit is the bookmark: process 8 records, commit after 6, crash")
    c.topic("tasks", 1, 1)
    produce(p, "tasks", [(None, f"task-{i}") for i in range(10)])
    from confluent_kafka import Consumer, TopicPartition

    def open_consumer() -> Consumer:
        cons = Consumer({"bootstrap.servers": c.bootstrap, "group.id": "worker", "auto.offset.reset": "earliest", "enable.auto.commit": False})
        cons.subscribe(["tasks"])
        return cons

    first = open_consumer()
    done_first: list[str] = []
    deadline = time.time() + 30
    while len(done_first) < 8 and time.time() < deadline:
        m = first.poll(0.5)
        if m is None or m.error():
            continue
        done_first.append(m.value().decode())
        if len(done_first) == 6:
            first.commit(message=m, asynchronous=False)  # commits offset 6 (next to read)
    first.close()  # a crash would not even close; with auto commit off, close() commits nothing
    committed = c.cli("kafka-consumer-groups.sh", *c.bs(), "--describe", "--group", "worker")
    print(committed)
    row = [ln.split() for ln in committed.splitlines() if ln.split()[:2] == ["worker", "tasks"]][0]
    check("the group bookmark is offset 6, although 8 records were processed", row[3] == "6" and row[4] == "10" and row[5] == "4", str(row))
    second = open_consumer()
    done_second: list[str] = []
    deadline = time.time() + 30
    while len(done_second) < 4 and time.time() < deadline:
        m = second.poll(0.5)
        if m is not None and not m.error():
            done_second.append(m.value().decode())
    second.close()
    print(f"  first run processed  {done_first}")
    print(f"  second run processed {done_second}")
    twice = sorted(set(done_first) & set(done_second))
    check("the new consumer starts at the bookmark, so task-6 and task-7 are processed twice", twice == ["task-6", "task-7"], str(twice))

    show("a member that is killed is noticed after session.timeout.ms")
    c.topic("heartbeat", 2, 1)
    worker = HERE / "member_worker.py"
    proc = subprocess.Popen([sys.executable, str(worker), c.bootstrap, "heartbeat", "crashy"], stdout=subprocess.PIPE, text=True)
    survivor = Member(c, "crashy", ["heartbeat"], "survivor", **{"session.timeout.ms": 6000, "heartbeat.interval.ms": 1000, "partition.assignment.strategy": "range"})
    wait_for(lambda: len(survivor.current) == 1, 40)
    print(f"  survivor owns {survivor.current} while the worker process runs")
    check("while the worker lives the survivor owns one partition of two", len(survivor.current) == 1)
    killed_at = time.time()
    proc.kill()
    proc.wait()
    wait_for(lambda: survivor.current == [0, 1], 60)
    took = time.time() - killed_at
    print(f"  the survivor got both partitions {took:.1f} s after the kill (session.timeout.ms=6000)")
    check("the dead member is noticed after about the session timeout (5 to 20 s)", 5 <= took <= 20, f"{took:.1f}")
    result["session_timeout_s"] = round(took, 1)
    survivor.leave()

    show("a new group: earliest against latest")
    early = consume(c, "orders", "fresh-earliest", 30, **{"auto.offset.reset": "earliest"})
    late = consume(c, "orders", "fresh-latest", 30, timeout=4, **{"auto.offset.reset": "latest"})
    check("a new group with earliest reads the 30 old records", len(early) == 30)
    check("a new group with latest reads none of them", len(late) == 0)

    show("the new consumer group protocol (group.protocol=consumer): the broker assigns")
    c.topic("kip848", 4, 1)
    new_members = [Member(c, "modern", ["kip848"], f"n{i}", **{"group.protocol": "consumer"}) for i in range(1, 3)]
    wait_for(lambda: settled(new_members, 4) and all(m.current for m in new_members), 40)
    time.sleep(1)
    print(f"  {owners(new_members)}")
    check("two members of a group on the new protocol share 4 partitions", settled(new_members, 4) and all(len(m.current) == 2 for m in new_members), str(owners(new_members)))
    state = c.cli("kafka-consumer-groups.sh", *c.bs(), "--describe", "--group", "modern", "--state")
    print(state)
    for m in new_members:
        m.leave()
    check("kafka-consumer-groups shows the group as Stable", "Stable" in state, state)

    show("lag of a group while nobody reads")
    produce(p, "orders", [(None, "late")] * 5)
    lag = c.cli("kafka-consumer-groups.sh", *c.bs(), "--describe", "--group", "group-a")
    print(lag)
    check("group-a has lag 5 in total (5 new records, bookmark at the old end)", sum(int(ln.split()[5]) for ln in lag.splitlines() if ln.split()[:2] == ["group-a", "orders"]) == 5, lag)

    if "--write" in sys.argv:
        write_json(LABS / "groups.json", result)


if __name__ == "__main__":
    main_guard(main)
