"""Lesson 9: what is inside a message, and how to change it without breaking readers. Avro with fastavro, and the wire format with a schema id.

Asserts what the lesson prints:
  - Kafka stores bytes: key and value are byte arrays, and a JSON order takes about 3 times the bytes of the same order in Avro;
  - Avro data is read with two schemas, the writer's and the reader's, and the rules of the Avro specification decide which changes are safe;
  - for eight kinds of change, whether a new reader can read old data (backward) and an old reader can read new data (forward) is tried for real, and written to JSON for SchemaLab;
  - the usual wire format of a registry is one zero byte, a 4 byte schema id and the Avro body; a consumer looks the id up and decodes;
  - one topic can hold records of two schema versions at once, and each one is decoded with the schema of its own id.
A schema registry itself was NOT run: the "registry" in this exercise is a dictionary in this process.
`--write` saves labs/kafka/schemas.json for SchemaLab.
Run: uv run python exercises/09_schemas.py [--write]
"""

import io
import json
import struct
import sys
from pathlib import Path

import fastavro

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

V1 = {"type": "record", "name": "Order", "fields": [
    {"name": "order_id", "type": "string"}, {"name": "item", "type": "string"}, {"name": "qty", "type": "int"},
]}


def schema(fields: list[dict], name: str = "Order") -> dict:
    return {"type": "record", "name": name, "fields": fields}


F = {f["name"]: f for f in V1["fields"]}
CHANGES = [
    ("add a field with a default", schema(V1["fields"] + [{"name": "currency", "type": "string", "default": "THB"}])),
    ("add a field without a default", schema(V1["fields"] + [{"name": "currency", "type": "string"}])),
    ("remove a field that had no default", schema([F["order_id"], F["item"]])),
    ("remove a field that had a default", None),  # built below from a V1 that has a default
    ("rename a field", schema([F["order_id"], F["item"], {"name": "quantity", "type": "int"}])),
    ("rename a field and keep the old name as an alias", schema([F["order_id"], F["item"], {"name": "quantity", "type": "int", "aliases": ["qty"]}])),
    ("widen int to long", schema([F["order_id"], F["item"], {"name": "qty", "type": "long"}])),
    ("narrow int to string", schema([F["order_id"], F["item"], {"name": "qty", "type": "string"}])),
]
SAMPLE = {"order_id": "o-1", "item": "book", "qty": 2}


def sample_for(sch: dict) -> dict:
    out = {}
    for f in sch["fields"]:
        t = f["type"]
        out[f["name"]] = {"string": "x", "int": 2, "long": 2}.get(t if isinstance(t, str) else "string", "x")
        if f["name"] in ("order_id",):
            out[f["name"]] = "o-1"
        if f["name"] == "item":
            out[f["name"]] = "book"
    return out


def encode(sch: dict, rec: dict) -> bytes:
    buf = io.BytesIO()
    fastavro.schemaless_writer(buf, fastavro.parse_schema(sch), rec)
    return buf.getvalue()


def decode(data: bytes, writer: dict, reader: dict):
    try:
        return fastavro.schemaless_reader(io.BytesIO(data), fastavro.parse_schema(writer), fastavro.parse_schema(reader))
    except Exception as e:  # noqa: BLE001
        return e


def main() -> None:
    show("bytes: the same 1000 orders as JSON text and as Avro")
    orders = [{"order_id": f"o-{100000 + i}", "item": ["book", "pen", "lamp", "cup"][i % 4], "qty": i % 5 + 1} for i in range(1000)]
    as_json = sum(len(json.dumps(o, separators=(",", ":")).encode()) for o in orders)
    as_avro = sum(len(encode(V1, o)) for o in orders)
    print(f"  JSON {as_json} bytes, Avro {as_avro} bytes, ratio {as_json / as_avro:.1f}")
    check("Avro is less than half the size of JSON for these orders (no field names, no quotes)", as_avro * 2 < as_json, f"{as_json} vs {as_avro}")

    show("what a reader needs: the writer's schema")
    body = encode(V1, SAMPLE)
    print(f"  Avro body of {SAMPLE}: {body.hex()} ({len(body)} bytes)")
    check("the body holds the values only: 'o-1' 'book' and the number 2, no field names", b"order_id" not in body and b"book" in body)

    show("eight changes: can a new reader read old data (backward), can an old reader read new data (forward)?")
    v1_default = schema([F["order_id"], F["item"], {"name": "qty", "type": "int", "default": 1}])
    rows = []
    for label, new in CHANGES:
        old = V1
        if new is None:  # the old schema had a default on qty, the new one drops the field
            old = v1_default
            new = schema([F["order_id"], F["item"]])
        old_rec = sample_for(old)
        new_rec = sample_for(new)
        backward = decode(encode(old, old_rec), old, new)
        forward = decode(encode(new, new_rec), new, old)
        ok_b, ok_f = not isinstance(backward, Exception), not isinstance(forward, Exception)
        rows.append({"change": label, "backward": ok_b, "forward": ok_f, "old": old, "new": new})
    print(table([[r["change"], "yes" if r["backward"] else "NO", "yes" if r["forward"] else "NO"] for r in rows], ["change", "new reads old", "old reads new"]))
    got = {r["change"]: (r["backward"], r["forward"]) for r in rows}
    check("add a field with a default: both directions work", got["add a field with a default"] == (True, True))
    check("add a field without a default: new readers cannot read old data", got["add a field without a default"] == (False, True))
    check("remove a field that had no default: old readers cannot read new data", got["remove a field that had no default"] == (True, False))
    check("remove a field that had a default: both directions work", got["remove a field that had a default"] == (True, True))
    check("a rename without an alias breaks both directions", got["rename a field"] == (False, False))
    check("a rename with an alias lets a new reader read old data only", got["rename a field and keep the old name as an alias"] == (True, False))
    check("int to long: a new reader reads old data, an old reader cannot read a long", got["widen int to long"] == (True, False))
    check("int to string is refused both ways", got["narrow int to string"] == (False, False))

    show("the wire format of a registry: 0, schema id (4 bytes), Avro body")
    registry: dict[int, dict] = {}
    by_text: dict[str, int] = {}

    def register(sch: dict) -> int:
        key = json.dumps(sch, sort_keys=True)
        if key not in by_text:
            by_text[key] = len(registry) + 1
            registry[by_text[key]] = sch
        return by_text[key]

    def wire(sch: dict, rec: dict) -> bytes:
        return b"\x00" + struct.pack(">I", register(sch)) + encode(sch, rec)

    def unwire(data: bytes) -> dict:
        magic, sid = data[0], struct.unpack(">I", data[1:5])[0]
        assert magic == 0
        return fastavro.schemaless_reader(io.BytesIO(data[5:]), fastavro.parse_schema(registry[sid]))

    v2 = CHANGES[0][1]
    m1 = wire(V1, SAMPLE)
    m2 = wire(v2, {**SAMPLE, "currency": "THB"})
    print(f"  version 1 message: {m1.hex()}")
    print(f"  version 2 message: {m2.hex()}")
    check("the first byte is 0 and the next four bytes are the schema id (1 and 2)", m1[0] == 0 and m1[1:5] == b"\x00\x00\x00\x01" and m2[1:5] == b"\x00\x00\x00\x02")
    check("each message is decoded with the schema of its own id", unwire(m1) == SAMPLE and unwire(m2)["currency"] == "THB")

    show("both versions in one topic")
    c = Cluster(1).start()
    c.topic("orders-avro", 1, 1)
    p = producer(c)
    done = []
    for rec in (m1, m2, m1):
        p.produce("orders-avro", value=rec, on_delivery=lambda e, m: done.append(m.offset()))
    p.flush(10)
    got_msgs = consume(c, "orders-avro", "decoder", 3)
    print(f"  read {len(got_msgs)} messages; sizes in bytes: {[len(g['value']) if g['value'] else 0 for g in got_msgs]}")
    check("three messages arrived in order", [g["offset"] for g in got_msgs] == [0, 1, 2])
    p2 = c.cli("kafka-console-consumer.sh", *c.bs(), "--topic", "orders-avro", "--from-beginning", "--max-messages", "3", "--timeout-ms", "10000", "--property", "print.value=false", "--property", "print.offset=true")
    check("the broker did not look inside: it stored the bytes it was given", "Offset:2" in p2 or "Offset:" in p2)

    if "--write" in sys.argv:
        write_json(LABS / "schemas.json", {"v1": V1, "changes": [{"change": r["change"], "backward": r["backward"], "forward": r["forward"], "old": r["old"]["fields"], "new": r["new"]["fields"]} for r in rows], "json_bytes": as_json, "avro_bytes": as_avro})


if __name__ == "__main__":
    main_guard(main)
