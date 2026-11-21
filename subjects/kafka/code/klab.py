"""Helpers shared by the Kafka exercises.

Every exercise starts a real Kafka 4.4.0 cluster (image `apache/kafka:4.4.0`, KRaft mode, nodes that are brokers and controllers) in Docker, talks to it from this
process with `confluent-kafka` (librdkafka) and with the command line tools that ship in the image, and asserts what its lesson prints.
Everything an exercise creates carries the label `klab=1` and a name that starts with `klab-`, so `cleanup()` removes it without touching anything else.
Nothing is published to the network except ports 29092 and up on 127.0.0.1.
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

HERE = Path(__file__).resolve().parent
LABS = HERE.parent.parent.parent / "site" / "src" / "components" / "labs" / "kafka"
IMAGE = "apache/kafka:4.4.0"
LABEL = "klab=1"
NET = "klab-net"
CLUSTER_ID = "MkU3OEVBNTcwNTJENDM2Qk"  # any 22 character base64 string works
BIN = "/opt/kafka/bin"
BASE_PORT = 29092


def run(*args: str, input: str | None = None, check: bool = True, timeout: int = 600) -> subprocess.CompletedProcess:
    """Run `docker <args>` (utf-8, no shell) and return the finished process."""
    done = subprocess.run(["docker", *args], input=input, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)
    if check and done.returncode != 0:
        sys.exit(f"FAILED: docker {' '.join(args)}\n{done.stdout}\n{done.stderr}")
    return done


def docker(*args: str, **kw) -> str:
    return run(*args, **kw).stdout.rstrip("\n")


def cleanup() -> None:
    """Remove every container, volume and network that an exercise made (label klab=1)."""
    ids = docker("ps", "-aq", "--filter", f"label={LABEL}", check=False).split()
    if ids:
        run("rm", "-f", "-v", *ids, check=False)
    for kind in ("network", "volume"):
        found = docker(kind, "ls", "-q", "--filter", f"label={LABEL}", check=False).split()
        if found:
            run(kind, "rm", "-f", *found, check=False)


def clean(text: str) -> str:
    drop = ("WARNING: ", "SLF4J", "Picked up")
    return "\n".join(line for line in text.splitlines() if not line.startswith(drop)).rstrip("\n")


@dataclass
class Cluster:
    """A small Kafka cluster in KRaft mode.

    With `controllers=0` (the default) every node is a broker and a controller (`process.roles=broker,controller`, "combined mode").
    With `controllers=n` there are `n` nodes that only run the metadata quorum (`klab-c1`, ...) and `size` nodes that are only brokers (`klab-k1`, ...).
    """

    size: int
    controllers: int = 0
    env: dict[str, str] = field(default_factory=dict)
    names: list[str] = field(default_factory=list)
    controller_names: list[str] = field(default_factory=list)

    @property
    def bootstrap(self) -> str:
        """The address a client on this computer uses (each broker advertises 127.0.0.1 and its own port)."""
        return ",".join(f"127.0.0.1:{BASE_PORT + i}" for i in range(self.size))

    def _launch(self, name: str, env: dict[str, str], port: int | None) -> None:
        args = ["run", "-d", "--name", name, "--hostname", name, "--network", NET, "--label", LABEL]
        if port is not None:
            args += ["-p", f"127.0.0.1:{port}:9094"]
        for k, v in env.items():
            args += ["-e", f"{k}={v}"]
        run(*args, IMAGE)

    def start(self) -> "Cluster":
        run("network", "create", "--label", LABEL, NET, check=False)
        if self.controllers:
            voters = ",".join(f"{100 + i}@klab-c{i + 1}:9093" for i in range(self.controllers))
        else:
            voters = ",".join(f"{i + 1}@klab-k{i + 1}:9093" for i in range(self.size))
        brokers = min(3, self.size)
        common = {
            "KAFKA_CONTROLLER_LISTENER_NAMES": "CONTROLLER",
            "KAFKA_CONTROLLER_QUORUM_VOTERS": voters,
            "KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS": "0",
            "KAFKA_LOG_DIRS": "/var/lib/kafka/data",
            "CLUSTER_ID": CLUSTER_ID,
        }
        for i in range(self.controllers):
            name = f"klab-c{i + 1}"
            self.controller_names.append(name)
            self._launch(name, {
                "KAFKA_NODE_ID": str(100 + i), "KAFKA_PROCESS_ROLES": "controller", "KAFKA_LISTENERS": "CONTROLLER://:9093",
                "KAFKA_LISTENER_SECURITY_PROTOCOL_MAP": "CONTROLLER:PLAINTEXT", **common, **self.env,
            }, None)
        for i in range(self.size):
            nid = i + 1
            name = f"klab-k{nid}"
            self.names.append(name)
            listeners = "INTERNAL://:9092,EXTERNAL://:9094" if self.controllers else "INTERNAL://:9092,CONTROLLER://:9093,EXTERNAL://:9094"
            self._launch(name, {
                "KAFKA_NODE_ID": str(nid),
                "KAFKA_PROCESS_ROLES": "broker" if self.controllers else "broker,controller",
                "KAFKA_LISTENERS": listeners,
                "KAFKA_ADVERTISED_LISTENERS": f"INTERNAL://{name}:9092,EXTERNAL://127.0.0.1:{BASE_PORT + i}",
                "KAFKA_LISTENER_SECURITY_PROTOCOL_MAP": "INTERNAL:PLAINTEXT,CONTROLLER:PLAINTEXT,EXTERNAL:PLAINTEXT",
                "KAFKA_INTER_BROKER_LISTENER_NAME": "INTERNAL",
                "KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR": str(brokers),
                "KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR": str(brokers),
                "KAFKA_TRANSACTION_STATE_LOG_MIN_ISR": str(min(2, brokers)),
                **common, **self.env,
            }, BASE_PORT + i)
        self.wait_ready()
        return self

    def wait_ready(self, timeout: int = 90) -> None:
        deadline = time.time() + timeout
        while time.time() < deadline:
            done = run("exec", self.names[0], f"{BIN}/kafka-topics.sh", "--bootstrap-server", f"{self.names[0]}:9092", "--list", check=False)
            if done.returncode == 0:
                return
            time.sleep(1)
        sys.exit("FAILED: the cluster did not become ready\n" + docker("logs", "--tail", "30", self.names[0], check=False))

    def bs(self, node: int = 1) -> list[str]:
        return ["--bootstrap-server", f"{self.names[node - 1]}:9092"]

    def cli(self, tool: str, *args: str, node: int = 1, check: bool = True) -> str:
        """Run a command line tool of the image inside broker `node` and return stdout and stderr together."""
        done = run("exec", self.names[node - 1], f"{BIN}/{tool}", *args, check=check)
        return clean(done.stdout + done.stderr)

    def sh(self, script: str, node: int = 1, check: bool = True) -> str:
        done = run("exec", self.names[node - 1], "sh", "-c", script, check=check)
        return clean(done.stdout + done.stderr)

    def stop(self, node: int, timeout: int = 30) -> None:
        run("stop", "-t", str(timeout), self.names[node - 1])

    def kill(self, node: int) -> None:
        run("kill", self.names[node - 1])

    def begin(self, node: int) -> None:
        run("start", self.names[node - 1])

    def pause(self, node: int) -> None:
        """Freeze every process of the broker (docker pause): it stays connected but answers nothing and fetches nothing."""
        run("pause", self.names[node - 1])

    def unpause(self, node: int) -> None:
        run("unpause", self.names[node - 1])

    def topic(self, name: str, partitions: int = 1, rf: int = 1, **configs: str) -> None:
        args = ["--create", "--topic", name, "--partitions", str(partitions), "--replication-factor", str(rf)]
        for k, v in configs.items():
            args += ["--config", f"{k.replace('_', '.')}={v}"]
        self.cli("kafka-topics.sh", *self.bs(), *args)

    def describe(self, name: str, node: int = 1) -> str:
        return self.cli("kafka-topics.sh", *self.bs(node), "--describe", "--topic", name, node=node)


def producer(cluster: "Cluster", **conf):
    """A confluent-kafka Producer that talks to the cluster from this computer."""
    from confluent_kafka import Producer

    return Producer({"bootstrap.servers": cluster.bootstrap, **conf})


def produce(p, topic: str, items: list[tuple[str | None, str]], **kw) -> list[dict]:
    """Send (key, value) pairs, flush, and return where each one landed: partition, offset, key, value (in send order)."""
    landed: list[dict] = []

    def done(err, msg):
        if err is not None:
            landed.append({"error": str(err)})
        else:
            landed.append({"partition": msg.partition(), "offset": msg.offset(), "key": msg.key().decode() if msg.key() else None, "value": msg.value().decode()})

    for key, value in items:
        p.produce(topic, value=value.encode(), key=key.encode() if key is not None else None, on_delivery=done, **kw)
        p.poll(0)
    p.flush(60)
    return landed


def consume(cluster: "Cluster", topic: str, group: str, n: int, timeout: float = 20, **conf) -> list[dict]:
    """Read up to `n` messages of `topic` with a new consumer of `group` (from the beginning if the group has no offset), then close it."""
    from confluent_kafka import Consumer

    cons = Consumer({"bootstrap.servers": cluster.bootstrap, "group.id": group, "auto.offset.reset": "earliest", "enable.auto.commit": False, **conf})
    cons.subscribe([topic])
    got: list[dict] = []
    deadline = time.time() + timeout
    while len(got) < n and time.time() < deadline:
        m = cons.poll(0.5)
        if m is None or m.error():
            continue
        got.append({"partition": m.partition(), "offset": m.offset(), "key": m.key().decode() if m.key() else None, "value": m.value().decode() if m.value() is not None else None})
    cons.commit(asynchronous=False) if got else None
    cons.close()
    return got


def wait_for(cond, timeout: float = 30, step: float = 0.1) -> float:
    """Poll `cond()` until it is true and return how many seconds it took; exit with a failure after `timeout`."""
    start = time.time()
    while time.time() - start < timeout:
        if cond():
            return time.time() - start
        time.sleep(step)
    sys.exit(f"FAILED: condition not met within {timeout}s")


class Member:
    """One consumer of a group running in its own thread. `current` is the sorted list of partitions it owns right now, `seen` the (partition, offset) pairs it got."""

    def __init__(self, cluster: "Cluster", group: str, topics: list[str], name: str, **conf):
        import threading

        from confluent_kafka import Consumer

        self.name = name
        self.current: list[int] = []
        self.seen: list[tuple[int, int]] = []
        self.values: list[str] = []
        self.events: list[tuple[float, list[int]]] = []
        self._stop = threading.Event()
        self.consumer = Consumer({
            "bootstrap.servers": cluster.bootstrap, "group.id": group, "auto.offset.reset": "earliest", "enable.auto.commit": False,
            "client.id": name, **conf,
        })
        self.consumer.subscribe(topics)
        self.thread = threading.Thread(target=self._loop, daemon=True)
        self.thread.start()

    def _loop(self) -> None:
        while not self._stop.is_set():
            m = self.consumer.poll(0.2)
            now = sorted(p.partition for p in self.consumer.assignment())
            if now != self.current:
                self.current = now
                self.events.append((time.time(), now))
            if m is not None and not m.error():
                self.seen.append((m.partition(), m.offset()))
                self.values.append(m.value().decode() if m.value() is not None else "")

    def leave(self) -> None:
        """Close the consumer politely (it leaves the group at once)."""
        self._stop.set()
        self.thread.join(10)
        self.consumer.close()
        self.current = []


def murmur2(data: bytes) -> int:
    """The 32 bit murmur2 hash of the Java client (`Utils.murmur2` in clients/.../common/utils/Utils.java), as a signed 32 bit integer."""
    m, r = 0x5BD1E995, 24
    mask = 0xFFFFFFFF
    h = (0x9747B28C ^ len(data)) & mask
    n4 = len(data) >> 2
    for i in range(n4):
        k = int.from_bytes(data[i * 4 : i * 4 + 4], "little")
        k = (k * m) & mask
        k ^= k >> r
        k = (k * m) & mask
        h = (h * m) & mask
        h ^= k
    index = n4 << 2
    rest = len(data) - index
    if rest >= 3:
        h ^= data[index + 2] << 16
    if rest >= 2:
        h ^= data[index + 1] << 8
    if rest >= 1:
        h ^= data[index]
        h = (h * m) & mask
    h ^= h >> 13
    h = (h * m) & mask
    h ^= h >> 15
    return h - (1 << 32) if h & 0x80000000 else h


def java_partition(key: str, partitions: int) -> int:
    """The partition that the Java producer picks for a key: toPositive(murmur2(key)) % partitions."""
    return (murmur2(key.encode()) & 0x7FFFFFFF) % partitions


def parse_describe(text: str) -> list[dict]:
    """Turn the partition lines of `kafka-topics.sh --describe` into dicts: partition, leader, replicas, isr (lists of broker ids; leader is None when it says -1 or none)."""
    rows = []
    for line in text.splitlines():
        if "Partition:" in line and "Leader:" in line:
            f = {}
            parts = line.split("	")
            for part in parts:
                if ":" in part:
                    k, _, v = part.strip().partition(":")
                    f[k] = v.strip()
            leader = f.get("Leader", "none")
            rows.append({
                "partition": int(f["Partition"]),
                "leader": int(leader) if leader.lstrip("-").isdigit() and int(leader) >= 0 else None,
                "replicas": [int(x) for x in f["Replicas"].split(",") if x],
                "isr": [int(x) for x in f.get("Isr", "").split(",") if x],
            })
    return rows


def check(label: str, ok: bool, detail: str = "") -> None:
    """Print one result line and fail loudly, because the lessons quote these results."""
    print(f"  {'ok  ' if ok else 'FAIL'} {label}" + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        sys.exit(f"FAILED: {label} {detail}")


def show(title: str, text: str = "") -> None:
    print(f"\n$ {title}" if title else "")
    if text:
        print("\n".join("  " + line for line in str(text).splitlines()))


def table(rows: list[list], headers: list[str]) -> str:
    cells = [[str(c) for c in r] + [""] * (len(headers) - len(r)) for r in rows]
    widths = [max(len(h), *(len(r[i]) for r in cells)) for i, h in enumerate(headers)]
    line = lambda r: "  ".join(c.ljust(w) for c, w in zip(r, widths)).rstrip()  # noqa: E731
    return "\n".join([line(headers), line(["-" * w for w in widths]), *(line(r) for r in cells)])


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  wrote {path.relative_to(LABS.parents[3])}")


def main_guard(fn) -> None:
    """Run an exercise, always clean up, and end with the `ok` line that verify.py looks for."""
    try:
        cleanup()
        fn()
    finally:
        cleanup()
    print("\nok")
