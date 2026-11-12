"""Read a table as its files describe it (not as an engine reports it), for the exercises that feed a lab.

`dump(root, ident, names)` reads the newest metadata.json, every manifest list, every manifest and every data or delete file of a table and
returns plain dicts: the shape that `UnderCoversLab` draws. It uses only json, fastavro and pyarrow. `Names` gives short stable names in the order
files are first seen: v (metadata.json), s (manifest list), m (manifest), a (data file), d (position delete file).
"""

import struct

import fastavro
import pyarrow.parquet as pq

from lab import current_metadata, metadata_files


def local(uri):
    return uri.replace("file://", "").replace("file:", "")


def read_avro(uri):
    with open(local(uri), "rb") as f:
        return list(fastavro.reader(f))


def kv(m):
    return {k["key"]: k["value"] for k in m}


class Names:
    """Short names for files, given in the order we first see them."""

    def __init__(self):
        self.m = {}

    def get(self, path, prefix):
        path = local(path)
        if path not in self.m:
            self.m[path] = f"{prefix}{sum(1 for v in self.m.values() if v.startswith(prefix)) + 1}"
        return self.m[path]

    def find(self, path):
        return self.m[local(path)]


STATUS = {0: "EXISTING", 1: "ADDED", 2: "DELETED"}


def _bounds(d):
    lo, hi = kv(d["lower_bounds"] or []), kv(d["upper_bounds"] or [])
    if not lo or 1 not in lo:
        return {}
    return {
        "order_id": [struct.unpack("<q", lo[1])[0], struct.unpack("<q", hi[1])[0]],
        "customer": [lo[2].decode(), hi[2].decode()],
        "amount": [struct.unpack("<d", lo[3])[0], struct.unpack("<d", hi[3])[0]],
    }


def dump(root, ident, names):
    for p in metadata_files(root, ident):  # v1 is the metadata.json of CREATE TABLE, so name them all in commit order
        names.get(p, "v")
    path, md = current_metadata(root, ident)
    v = names.get(path, "v")
    sname = {}
    for s in md["snapshots"]:
        sname[s["snapshot-id"]] = names.get(s["manifest-list"], "s")
    snaps = []
    for s in md["snapshots"]:
        mans = []
        for r in read_avro(s["manifest-list"]):
            mn = names.get(r["manifest_path"], "m")
            entries = []
            for e in read_avro(r["manifest_path"]):
                d = e["data_file"]
                kind = d["content"]  # 0 data, 1 position delete
                f = names.get(d["file_path"], "a" if kind == 0 else "d")
                t = pq.read_table(local(d["file_path"])).to_pylist()
                if kind == 0:
                    rows = [[x["order_id"], x["customer"], x["amount"]] for x in t]
                else:
                    rows = [[names.find(x["file_path"]), x["pos"]] for x in t]
                entries.append({"status": STATUS[e["status"]], "file": f, "content": kind, "records": d["record_count"], "bytes": d["file_size_in_bytes"],
                                "rows": rows, **_bounds(d)})
            mans.append({
                "name": mn, "content": r["content"], "length": r["manifest_length"], "seq": r["sequence_number"], "min_seq": r["min_sequence_number"],
                "added_snapshot": sname[r["added_snapshot_id"]],
                "added": r["added_files_count"], "existing": r["existing_files_count"], "deleted": r["deleted_files_count"],
                "added_rows": r["added_rows_count"], "existing_rows": r["existing_rows_count"], "deleted_rows": r["deleted_rows_count"],
                "entries": entries,
            })
        keep = ("added-data-files", "deleted-data-files", "added-records", "deleted-records", "total-records", "total-data-files",
                "added-delete-files", "total-delete-files", "added-position-deletes", "total-position-deletes", "added-files-size")
        snaps.append({
            "name": sname[s["snapshot-id"]], "id": str(s["snapshot-id"]),
            "parent": str(s["parent-snapshot-id"]) if s.get("parent-snapshot-id") else None, "seq": s["sequence-number"],
            "operation": s["summary"]["operation"], "summary": {k: s["summary"][k] for k in s["summary"] if k in keep},
            "manifests": mans,
        })
    cur = next((x["name"] for x in snaps if x["id"] == str(md.get("current-snapshot-id"))), None)
    return {"metadata": v, "format-version": md["format-version"], "current": cur, "last-sequence-number": md["last-sequence-number"], "snapshots": snaps}
