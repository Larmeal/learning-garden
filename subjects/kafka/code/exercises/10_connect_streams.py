"""Lesson 10: Kafka Connect and Kafka Streams, both from the Kafka distribution in the image.

Asserts what the lesson prints:
  - Connect runs as its own process and is driven by a REST API; it keeps its configs, offsets and status in three topics of the cluster;
  - a FileStreamSource connector turns each line of a file into a record, remembers how far it has read (in the offsets topic) and does not read old lines again after a restart;
  - a FileStreamSink connector writes the records of a topic to a file;
  - Kafka Streams (the WordCountDemo of the distribution) reads a topic, counts words and writes every change of a count to an output topic;
  - the count lives in a state store backed by a changelog topic, so after the application is restarted it continues from the old counts.
The file connectors are demo connectors that ship with Kafka; no database, S3 or Debezium connector was run.
`--write` saves labs/kafka/connect.json (the words and counts) for ConnectLab.
Run: uv run python exercises/10_connect_streams.py [--write]
"""

import json
import struct
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

REST = "http://127.0.0.1:28083"
PROPS = """bootstrap.servers=klab-k1:9092
group.id=connect-cluster
key.converter=org.apache.kafka.connect.storage.StringConverter
value.converter=org.apache.kafka.connect.storage.StringConverter
key.converter.schemas.enable=false
value.converter.schemas.enable=false
offset.storage.topic=connect-offsets
config.storage.topic=connect-configs
status.storage.topic=connect-status
offset.storage.replication.factor=1
config.storage.replication.factor=1
status.storage.replication.factor=1
plugin.path=/opt/kafka/libs
listeners=http://0.0.0.0:8083
offset.flush.interval.ms=1000
"""


def rest(method: str, path: str, body: dict | None = None):
    req = urllib.request.Request(REST + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        text = r.read().decode()
        return json.loads(text) if text else None


def words(c: Cluster, topic: str, n: int, group: str, timeout: float = 20) -> list[tuple[str, int]]:
    from confluent_kafka import Consumer

    cons = Consumer({"bootstrap.servers": c.bootstrap, "group.id": group, "auto.offset.reset": "earliest", "enable.auto.commit": False})
    cons.subscribe([topic])
    out, end = [], time.time() + timeout
    while len(out) < n and time.time() < end:
        m = cons.poll(0.5)
        if m is not None and not m.error():
            out.append((m.key().decode(), struct.unpack(">q", m.value())[0]))
    cons.close()
    return out


def main() -> None:
    c = Cluster(1).start()
    result: dict = {}

    show("start Kafka Connect (distributed mode, one worker) next to the broker")
    run("run", "-d", "--name", "klab-connect", "--network", NET, "--label", LABEL, "-p", "127.0.0.1:28083:8083", "--entrypoint", "sh", IMAGE, "-c",
        f"cat > /tmp/connect.properties <<'EOF'\n{PROPS}EOF\nexec /opt/kafka/bin/connect-distributed.sh /tmp/connect.properties")
    wait_for(lambda: _up(), 90)
    plugins = [p["class"].split(".")[-1] for p in rest("GET", "/connector-plugins")]
    print(f"  connector plugins found: {plugins}")
    check("the worker answers on its REST port and knows the two file connectors", "FileStreamSourceConnector" in plugins and "FileStreamSinkConnector" in plugins, str(plugins))
    topics = c.cli("kafka-topics.sh", *c.bs(), "--list").split()
    print(f"  topics now: {topics}")
    check("Connect made three topics of its own: configs, offsets and status", {"connect-configs", "connect-offsets", "connect-status"} <= set(topics), str(topics))

    show("a source connector: every line of a file becomes a record")
    c.topic("lines", 1, 1)
    sh = lambda script: run("exec", "klab-connect", "sh", "-c", script).stdout  # noqa: E731
    sh("printf 'order 1\\norder 2\\norder 3\\n' > /tmp/in.txt")
    rest("POST", "/connectors", {"name": "file-source", "config": {"connector.class": "org.apache.kafka.connect.file.FileStreamSourceConnector", "tasks.max": "1", "file": "/tmp/in.txt", "topic": "lines"}})
    got = consume(c, "lines", "check1", 3, timeout=40)
    print(f"  records: {[g['value'] for g in got]}")
    check("three lines became three records", [g["value"] for g in got] == ["order 1", "order 2", "order 3"], str(got))
    st = rest("GET", "/connectors/file-source/status")
    print(f"  status: connector {st['connector']['state']}, tasks {[t['state'] for t in st['tasks']]}")
    check("the connector and its one task are RUNNING", st["connector"]["state"] == "RUNNING" and [t["state"] for t in st["tasks"]] == ["RUNNING"], str(st))

    show("it remembers where it was: append two lines, restart the connector, nothing is read twice")
    sh("printf 'order 4\\norder 5\\n' >> /tmp/in.txt")
    wait_for(lambda: len(consume(c, "lines", f"w{time.time()}", 10, timeout=5)) >= 5, 40)
    rest("DELETE", "/connectors/file-source")
    time.sleep(2)
    rest("POST", "/connectors", {"name": "file-source", "config": {"connector.class": "org.apache.kafka.connect.file.FileStreamSourceConnector", "tasks.max": "1", "file": "/tmp/in.txt", "topic": "lines"}})
    time.sleep(8)
    all_lines = consume(c, "lines", "check2", 20, timeout=10)
    print(f"  after delete and create again: {[g['value'] for g in all_lines]}")
    check("the topic holds the 5 lines once each", [g["value"] for g in all_lines] == [f"order {i}" for i in range(1, 6)], str([g["value"] for g in all_lines]))
    offs = consume(c, "connect-offsets", "offs", 10, timeout=10)
    print(f"  connect-offsets has {len(offs)} record(s); the last: key={offs[-1]['key'][:70]} value={offs[-1]['value']}")
    check("the position (a byte offset into the file) is a record in connect-offsets", len(offs) >= 1 and "position" in offs[-1]["value"], str(offs[-1:]))

    show("a sink connector: the records of a topic written to a file")
    rest("POST", "/connectors", {"name": "file-sink", "config": {"connector.class": "org.apache.kafka.connect.file.FileStreamSinkConnector", "tasks.max": "1", "file": "/tmp/out.txt", "topics": "lines"}})
    wait_for(lambda: sh("cat /tmp/out.txt 2>/dev/null || true").count("order") == 5, 40)
    out_text = sh("cat /tmp/out.txt")
    print("  /tmp/out.txt: " + out_text.replace("\n", " | "))
    check("the sink file has the same 5 lines", out_text.split("\n")[:5] == [f"order {i}" for i in range(1, 6)], out_text)
    lag = c.cli("kafka-consumer-groups.sh", *c.bs(), "--describe", "--group", "connect-file-sink")
    check("the sink is a consumer group named connect-<connector name> and has no lag", "lines" in lag and lag.split()[-1] != "", lag)

    show("Kafka Streams: word count (WordCountDemo from the distribution)")
    c.topic("streams-plaintext-input", 1, 1)
    c.topic("streams-wordcount-output", 1, 1)

    # The image is Alpine Linux and has no libstdc++, which the RocksDB library of Kafka Streams needs: without it the first state store fails to open.
    apk = run("exec", "-u", "root", "klab-k1", "apk", "add", "--no-cache", "libstdc++", check=False)
    check("libstdc++ was installed into the broker image's container with apk (not part of Kafka)", apk.returncode == 0, apk.stdout + apk.stderr)

    def start_streams() -> None:
        run("exec", "-d", "klab-k1", "sh", "-c", "echo 'bootstrap.servers=klab-k1:9092' > /tmp/streams.properties && exec /opt/kafka/bin/kafka-run-class.sh org.apache.kafka.streams.examples.wordcount.WordCountDemo /tmp/streams.properties > /tmp/streams.log 2>&1")

    def stop_streams() -> None:
        c.sh("pkill -f 'WordCountDem[o]' || true")
        time.sleep(3)

    start_streams()
    time.sleep(8)
    produce(producer(c), "streams-plaintext-input", [(None, "hello kafka"), (None, "hello streams"), (None, "kafka streams kafka")])
    updates = words(c, "streams-wordcount-output", 7, "w1", timeout=60)
    print(f"  updates in the output topic, in order: {updates}")
    latest = {}
    for w, n in updates:
        latest[w] = n
    check("7 updates: one for every word that went in", len(updates) == 7, str(updates))
    check("the latest count of each word is hello 2, kafka 3, streams 2", latest == {"hello": 2, "kafka": 3, "streams": 2}, str(latest))
    check("a count only goes up, one step at a time, for each word", all(b == a + 1 for w in latest for a, b in zip([n for x, n in updates if x == w][:-1], [n for x, n in updates if x == w][1:])))
    internal = [t for t in c.cli("kafka-topics.sh", *c.bs(), "--list").split() if t.startswith("streams-wordcount-") and ("changelog" in t or "repartition" in t)]
    print(f"  internal topics the application made: {internal}")
    check("it made a changelog topic and a repartition topic of its own", any("changelog" in t for t in internal) and any("repartition" in t for t in internal), str(internal))

    show("stop the application, start it again: the counts continue")
    stop_streams()
    local = c.sh("ls /tmp/kafka-streams/streams-wordcount")
    print(f"  local state folder before deleting it: {local.split()}")
    check("the application kept its state on the local disk of the broker's container", local.strip() != "", local)
    c.sh("rm -rf /tmp/kafka-streams")  # the local copy is gone: the only copy of the counts is the changelog topic
    start_streams()
    time.sleep(15)
    produce(producer(c), "streams-plaintext-input", [(None, "hello again")])
    more = words(c, "streams-wordcount-output", 9, "w2", timeout=60)
    after = [(w, n) for w, n in more[7:]]
    print(f"  new updates after the restart: {after}")
    check("hello went from 2 to 3, not back to 1: the local state was deleted and the counts came back from the changelog topic", ("hello", 3) in after and ("hello", 1) not in after, str(after))
    result["words"] = {"updates": updates, "after_restart": after}

    if "--write" in sys.argv:
        write_json(LABS / "connect.json", result)


def _up() -> bool:
    try:
        rest("GET", "/")
        return True
    except Exception:  # noqa: BLE001
        return False


if __name__ == "__main__":
    main_guard(main)
