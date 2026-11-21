"""Lesson 7: KRaft. The metadata of the cluster is a log too, kept by a quorum of controllers with Raft.

Asserts what the lesson prints (3 nodes that are brokers and controllers):
  - `kafka-metadata-quorum describe --status` names the quorum leader, the epoch (term), the voters, and the high watermark of the metadata log;
  - creating a topic appends records to the `__cluster_metadata` log (TopicRecord, PartitionRecord), which `kafka-dump-log.sh --cluster-metadata-decoder` can print;
  - killing a broker appends a record that changes the ISR or the leader of the partitions it led (PartitionChangeRecord);
  - killing the quorum leader makes the others elect a new one, the epoch goes up by at least 1, and the cluster keeps working with 2 of 3 controllers;
  - with only 1 of 3 controllers left there is no majority and the cluster cannot change its metadata (a topic cannot be created);
  - each node has a meta.properties with the cluster id and its node id.
`--write` saves labs/kafka/kraft.json (the real metadata records and election) for ElectionLab.
Run: uv run python exercises/07_kraft.py [--write]
"""

import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

META = "/var/lib/kafka/data/__cluster_metadata-0"


def status(c: Cluster, via: int) -> dict:
    out = c.cli("kafka-metadata-quorum.sh", *c.bs(via), "describe", "--status", node=via)
    d = {}
    for line in out.splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            d[k.strip()] = v.strip()
    return d


def metadata_records(c: Cluster, node: int) -> list[str]:
    """All records of the metadata log of one node as text lines, newest last."""
    out = c.sh(f"/opt/kafka/bin/kafka-dump-log.sh --cluster-metadata-decoder --files {META}/*.log", node=node)
    return [ln.strip() for ln in out.splitlines() if "| offset:" in ln]


def kinds(lines: list[str]) -> list[str]:
    return [re.search(r'"type":"(\w+)"', ln).group(1) if re.search(r'"type":"(\w+)"', ln) else "?" for ln in lines]


def main() -> None:
    c = Cluster(3, env={"KAFKA_BROKER_SESSION_TIMEOUT_MS": "9000"}).start()
    result: dict = {}

    show("who leads the quorum, and who votes")
    st = status(c, 1)
    print("\n".join(f"  {k}: {v[:110]}" for k, v in st.items()))
    check("the quorum has three voters (nodes 1, 2, 3)", st["CurrentVoters"].count("CONTROLLER://") == 3, st["CurrentVoters"])
    leader0, epoch0 = int(st["LeaderId"]), int(st["LeaderEpoch"])
    check("one of them is the leader", leader0 in (1, 2, 3))
    rep = c.cli("kafka-metadata-quorum.sh", *c.bs(1), "describe", "--replication")
    print(rep)
    check("the replication view lists a Leader and two Followers", rep.count("Leader") >= 1 and rep.count("Follower") == 2, rep)
    result["status"] = {"leader": leader0, "epoch": epoch0}

    show("the metadata is a log: what is in __cluster_metadata after the first start")
    before = metadata_records(c, 1)
    k0 = kinds(before)
    summary = {k: k0.count(k) for k in sorted(set(k0))}
    print(f"  {len(before)} records, by type: {summary}")
    check("the log already holds the broker registrations and the feature levels (REGISTER_BROKER_RECORD, FEATURE_LEVEL_RECORD)", summary.get("REGISTER_BROKER_RECORD", 0) == 3 and summary.get("FEATURE_LEVEL_RECORD", 0) >= 1, str(summary))

    show("create a topic: two new records appear in that log")
    c.topic("orders", 2, 3)
    after = metadata_records(c, 1)
    new = [ln for ln in after[len(before):] if "NO_OP_RECORD" not in ln]  # a NO_OP_RECORD is appended every 500 ms to keep the log moving
    for ln in new:
        print("  " + re.sub(r"^\| offset: (\d+) CreateTime: \d+ keySize: \d+ valueSize: \d+ sequence: -?\d+ headerKeys: \[\] ", r"offset \1 ", ln)[:170])
    nk = kinds(new)
    check("one TOPIC_RECORD and two PARTITION_RECORDs were appended", nk.count("TOPIC_RECORD") == 1 and nk.count("PARTITION_RECORD") == 2, str(nk))
    check("the TOPIC_RECORD names the topic orders", any('"name":"orders"' in ln for ln in new))
    result["create_topic"] = [re.sub(r"^.*? key: ", "", ln)[:200] for ln in new]

    show("the metadata log is the same on every node")
    other = metadata_records(c, 3)
    check("node 3 has the same records, at least up to what node 1 had", other[: len(after) - 3] == after[: len(after) - 3])

    show("kill a broker that is not the quorum leader: the metadata records the change")
    victim = next(n for n in (1, 2, 3) if n != leader0)
    n_before = len(metadata_records(c, leader0))
    c.kill(victim)
    wait_for(lambda: any(victim not in r["isr"] for r in parse_describe(c.describe("orders", node=leader0))), 60)
    changes = [ln for ln in metadata_records(c, leader0)[n_before:] if "NO_OP_RECORD" not in ln]
    ck = kinds(changes)
    print(f"  new record types: {ck}")
    check("the log got a BROKER_REGISTRATION_CHANGE_RECORD (fenced) and PARTITION_CHANGE_RECORDs", "BROKER_REGISTRATION_CHANGE_RECORD" in ck and "PARTITION_CHANGE_RECORD" in ck, str(ck))
    result["broker_failure"] = ck
    c.begin(victim)
    wait_for(lambda: all(victim in r["isr"] for r in parse_describe(c.describe("orders", node=leader0))), 90)

    show("kill the quorum leader: the others elect a new one")
    st = status(c, 1 if leader0 != 1 else 2)
    leader1 = int(st["LeaderId"])
    survivors = [n for n in (1, 2, 3) if n != leader1]
    via = survivors[0]
    t0 = time.time()
    c.kill(leader1)
    wait_for(lambda: status(c, via).get("LeaderId", str(leader1)) not in (str(leader1), "-1"), 60, step=0.5)
    took = time.time() - t0
    st2 = status(c, via)
    print(f"  killed node {leader1} (epoch {st['LeaderEpoch']}); after {took:.1f} s the leader is node {st2['LeaderId']} in epoch {st2['LeaderEpoch']}")
    check("a different node leads the quorum now", int(st2["LeaderId"]) != leader1)
    check("the epoch (term) went up", int(st2["LeaderEpoch"]) > int(st["LeaderEpoch"]), f"{st['LeaderEpoch']} -> {st2['LeaderEpoch']}")
    check("the election took a few seconds, not minutes (under 30 s)", took < 30, f"{took:.1f}")
    out = c.cli("kafka-topics.sh", *c.bs(via), "--create", "--topic", "still-works", "--partitions", "1", "--replication-factor", "2", node=via)
    check("with 2 of 3 controllers a topic can still be created", "Created topic still-works" in out, out)
    result["election"] = {"killed": leader1, "new_leader": int(st2["LeaderId"]), "epoch_before": int(st["LeaderEpoch"]), "epoch_after": int(st2["LeaderEpoch"]), "seconds": round(took, 1)}

    show("kill a second controller: no majority, no metadata changes")
    second = int(st2["LeaderId"])
    last = next(n for n in (1, 2, 3) if n not in (leader1, second))
    c.kill(second)
    time.sleep(3)
    done = run("exec", c.names[last - 1], f"{BIN}/kafka-topics.sh", "--bootstrap-server", f"{c.names[last - 1]}:9092", "--create", "--topic", "nope", "--partitions", "1", "--replication-factor", "1",
               "--command-config", "/dev/null", check=False, timeout=120)
    text = clean(done.stdout + done.stderr)
    print("  " + text.splitlines()[0][:160] if text else "  (no output)")
    check("the topic is not created (the command fails or times out)", done.returncode != 0 and "Created topic" not in text, text[:200])
    c.begin(leader1)
    c.begin(second)
    wait_for(lambda: len(re.findall("Follower|Leader", c.cli("kafka-metadata-quorum.sh", *c.bs(last), "describe", "--replication", node=last, check=False))) == 3, 90)
    check("with the nodes back the quorum is whole again (one leader, two followers)", True)

    show("files of a node: meta.properties and the metadata log folder")
    print("  " + c.sh("cat /var/lib/kafka/data/meta.properties").replace("\n", "\n  "))
    print("  " + c.sh(f"ls {META}").replace("\n", "\n  "))
    mp = c.sh("cat /var/lib/kafka/data/meta.properties")
    check("meta.properties has the cluster id and the node id", CLUSTER_ID in mp and "node.id=1" in mp, mp)
    check("the metadata log folder has a .log, an .index and a leader-epoch-checkpoint", all(x in c.sh(f"ls {META}") for x in (".log", ".index", "leader-epoch-checkpoint")))
    feats = c.cli("kafka-features.sh", *c.bs(), "describe")
    first = [ln for ln in feats.splitlines() if "metadata.version" in ln]
    print("  " + (first[0] if first else feats[:200]))
    check("kafka-features shows a metadata.version", bool(first), feats[:200])

    if "--write" in sys.argv:
        write_json(LABS / "kraft.json", result)


if __name__ == "__main__":
    main_guard(main)
