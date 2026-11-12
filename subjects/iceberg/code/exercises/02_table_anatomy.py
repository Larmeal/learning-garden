"""Lesson 2: the anatomy of a table. Follow the pointers from the catalog row down to a Parquet file by hand.

    uv run python exercises/02_table_anatomy.py       (on Windows this re-launches itself in WSL, see run_wsl.sh)

The walk uses only json, fastavro and pyarrow, so what it finds is what is really written on disk, not what an Iceberg
library reports. Then it checks that Spark's metadata tables say the same.
"""

import hashlib
import json
import os
import struct
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import fastavro  # noqa: E402
import pyarrow.parquet as pq  # noqa: E402

from lab import (  # noqa: E402
    current_metadata,
    files,
    fresh_root,
    get_spark,
    metadata_files,
    relaunch_in_wsl_if_windows,
    show,
)

relaunch_in_wsl_if_windows(__file__)


def local(uri):
    """file:/tmp/x -> /tmp/x"""
    return uri.replace("file://", "").replace("file:", "")


def read_avro(uri):
    with open(local(uri), "rb") as f:
        r = fastavro.reader(f)
        meta = dict(r.metadata)
        return list(r), meta


def sha(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def kv(m):
    """An Avro map written by Iceberg as an array of {key, value} records -> dict."""
    return {k["key"]: k["value"] for k in m}


def main():
    root = fresh_root("02_table_anatomy")
    spark = get_spark(root)
    spark.sql("CREATE NAMESPACE lab.db")
    spark.sql("CREATE TABLE lab.db.orders (order_id bigint, customer string, amount double) USING iceberg")

    # Three separate INSERTs: three commits, three snapshots.
    spark.sql("INSERT INTO lab.db.orders VALUES (1, 'ann', 120.0), (2, 'bob', 80.5)")
    spark.sql("INSERT INTO lab.db.orders VALUES (3, 'ann', 42.0), (4, 'cara', 300.0)")
    digest_before = {m: sha(m) for m in metadata_files(root, "db.orders")}
    spark.sql("INSERT INTO lab.db.orders VALUES (5, 'dan', 10.0), (6, 'eve', 999.0)")

    # ---- 1. metadata.json: the only file a reader has to be told about --------------------------------------
    path, md = current_metadata(root, "db.orders")
    all_meta = metadata_files(root, "db.orders")
    print("metadata files:", [os.path.basename(n)[:5] + "..." for n in all_meta])
    assert len(all_meta) == 4 and len(md["snapshots"]) == 3                    # CREATE + 3 INSERT commits
    print("metadata-log:", [e["metadata-file"] for e in md["metadata-log"]][:1])
    assert [local(e["metadata-file"]) for e in md["metadata-log"]] == all_meta[:-1]
    # an older metadata.json is never rewritten by a newer commit
    assert all(sha(m) == d for m, d in digest_before.items())
    cur = {s["snapshot-id"]: s for s in md["snapshots"]}[md["current-snapshot-id"]]
    print("current snapshot:", {k: cur[k] for k in ("snapshot-id", "parent-snapshot-id", "sequence-number")}, "->", os.path.basename(cur["manifest-list"]))
    assert cur["parent-snapshot-id"] == md["snapshots"][-2]["snapshot-id"] and cur["sequence-number"] == 3
    assert md["refs"]["main"] == {"snapshot-id": cur["snapshot-id"], "type": "branch"}

    # ---- 2. manifest list of each snapshot -----------------------------------------------------------------------
    lists = {}
    for s in md["snapshots"]:
        rows, _ = read_avro(s["manifest-list"])
        lists[s["snapshot-id"]] = rows
        print(f"snapshot {s['sequence-number']}: manifest list has {len(rows)} manifest(s)")
    counts = [len(lists[s["snapshot-id"]]) for s in md["snapshots"]]
    assert counts == [1, 2, 3]                                              # an append adds one manifest and keeps the old ones
    last = lists[cur["snapshot-id"]]
    first_row = last[0]
    print("one manifest list row:", {k: first_row[k] for k in ("manifest_length", "content", "sequence_number", "min_sequence_number", "added_files_count", "existing_files_count", "deleted_files_count", "added_rows_count")})
    assert set(first_row) >= {"manifest_path", "manifest_length", "partition_spec_id", "content", "sequence_number", "added_snapshot_id", "added_files_count", "added_rows_count", "partitions"}
    print("partitions summary of an unpartitioned table:", first_row["partitions"])
    assert first_row["partitions"] in ([], None)
    # manifests are shared between snapshots: every manifest of snapshot 1 is also in snapshot 2, and so on
    paths = [[r["manifest_path"] for r in lists[s["snapshot-id"]]] for s in md["snapshots"]]
    assert set(paths[0]) <= set(paths[1]) <= set(paths[2])
    assert len({p for ps in paths for p in ps}) == 3                         # only three manifest files exist in total
    assert sorted(r["sequence_number"] for r in last) == [1, 2, 3]

    # ---- 3. a manifest: one row per data file, with column statistics ------------------------------------------
    newest = [r for r in last if r["added_snapshot_id"] == cur["snapshot-id"]][0]
    entries, meta = read_avro(newest["manifest_path"])
    assert len(entries) == 1
    e = entries[0]
    df = e["data_file"]
    print("manifest entry:", {"status": e["status"], "snapshot_id": e["snapshot_id"], "sequence_number": e["sequence_number"]})
    print("data_file keys:", sorted(df))
    assert e["status"] == 1 and e["snapshot_id"] == cur["snapshot-id"]       # 1 = ADDED
    # the entry stores no sequence number of its own: it inherits the one of its manifest in the manifest list
    assert e["sequence_number"] is None and newest["sequence_number"] == 3
    assert df["content"] == 0 and df["file_format"] == "PARQUET" and df["record_count"] == 2
    assert os.path.getsize(local(df["file_path"])) == df["file_size_in_bytes"]
    schema_json = json.loads(meta["schema"])
    ids = {f["name"]: f["id"] for f in schema_json["fields"]}
    assert ids == {"order_id": 1, "customer": 2, "amount": 3}
    lo, hi = kv(df["lower_bounds"]), kv(df["upper_bounds"])
    order_lo, order_hi = struct.unpack("<q", lo[ids["order_id"]])[0], struct.unpack("<q", hi[ids["order_id"]])[0]
    amount_lo, amount_hi = struct.unpack("<d", lo[ids["amount"]])[0], struct.unpack("<d", hi[ids["amount"]])[0]
    cust_lo, cust_hi = lo[ids["customer"]].decode(), hi[ids["customer"]].decode()
    print("bounds from the manifest:", {"order_id": (order_lo, order_hi), "customer": (cust_lo, cust_hi), "amount": (amount_lo, amount_hi)})
    assert (order_lo, order_hi, cust_lo, cust_hi, amount_lo, amount_hi) == (5, 6, "dan", "eve", 10.0, 999.0)
    assert kv(df["value_counts"]) == {1: 2, 2: 2, 3: 2}
    assert kv(df["null_value_counts"]) == {1: 0, 2: 0, 3: 0}

    # ---- 4. the statistics in the manifest equal what is inside the Parquet file ---------------------------
    t = pq.read_table(local(df["file_path"]))
    amounts = t["amount"].to_pylist()
    assert t.column("order_id").to_pylist() == [5, 6] and (min(amounts), max(amounts)) == (amount_lo, amount_hi)
    field_ids = {f.name: int(f.metadata[b"PARQUET:field_id"]) for f in t.schema}
    assert field_ids == ids                                                   # the Parquet file stores the same field ids

    # ---- 5. Spark's metadata tables show the same walk --------------------------------------------------------
    m = spark.sql("SELECT length, partition_spec_id, content, added_data_files_count AS added, existing_data_files_count AS existing FROM lab.db.orders.manifests")
    show(m)
    assert m.count() == 3
    f = spark.sql("SELECT file_path, record_count FROM lab.db.orders.files")
    on_disk = {local(x["data_file"]["file_path"]) for p in {p for ps in paths for p in ps} for x in read_avro(p)[0]}
    assert {local(r.file_path) for r in f.collect()} == on_disk and len(on_disk) == 3
    assert all(r.record_count == 2 for r in f.collect())
    snap = spark.sql("SELECT snapshot_id, parent_id, operation FROM lab.db.orders.snapshots ORDER BY committed_at")
    show(snap)
    assert [r.snapshot_id for r in snap.collect()] == [s["snapshot-id"] for s in md["snapshots"]]
    listing = files(root, "db.orders")
    kinds = {
        "data": len([p for p in listing if p.startswith("data/")]),
        "metadata.json": len([p for p in listing if p.endswith(".metadata.json")]),
        "manifest": len([p for p in listing if p.endswith("-m0.avro")]),
        "manifest list": len([p for p in listing if os.path.basename(p).startswith("snap-")]),
    }
    print("files by kind:", kinds)
    assert kinds == {"data": 3, "metadata.json": 4, "manifest": 3, "manifest list": 3}
    assert "metadata/version-hint.text" not in listing                         # a JDBC catalog keeps the pointer in a database, not in a file

    print("ok")


if __name__ == "__main__":
    main()
