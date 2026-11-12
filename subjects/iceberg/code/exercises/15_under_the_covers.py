"""Lesson 2, sub-page "under the covers": one table, six operations, and the real content of every file after each one.

    uv run python exercises/15_under_the_covers.py            (on Windows this re-launches itself in WSL, see run_wsl.sh)
    uv run python exercises/15_under_the_covers.py --write    also writes site/src/components/labs/iceberg/underCovers.json

The lab on that page (UnderCoversLab) draws the files and shows what is inside the one you click. Everything it shows is read here from
the files on disk (json for metadata.json, fastavro for the manifest list and the manifests), after each of these operations:

    1 CREATE TABLE   2 INSERT   3 INSERT   4 MERGE INTO   5 compaction (rewrite_data_files)   (SELECT and time travel only read)

The names a1, a2, ... are made up for the picture (data files), m1, m2, ... (manifests), s1, s2, ... (snapshots, manifest lists),
v1, v2, ... (metadata.json). The map from real file name to short name is printed.
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))


from fileview import Names, dump, local  # noqa: E402
from lab import fresh_root, get_spark, metadata_files, pyiceberg_catalog, relaunch_in_wsl_if_windows  # noqa: E402

relaunch_in_wsl_if_windows(__file__)

OUT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "site", "src", "components", "labs", "iceberg", "underCovers.json"))


def main():
    write = "--write" in sys.argv
    root = fresh_root("15_under_the_covers")
    spark = get_spark(root)
    names = Names()
    steps = []

    def snap(label):
        # name the metadata.json files in commit order so v1, v2, ... are the same in every picture
        for p in metadata_files(root, "db.orders"):
            names.get(p, "v")
        d = dump(root, 'db.orders', names)
        d["label"] = label
        d["versions"] = [names.get(p, "v") for p in metadata_files(root, "db.orders")]
        steps.append(d)
        return d

    spark.sql("CREATE NAMESPACE lab.db")
    spark.sql("CREATE TABLE lab.db.orders (order_id bigint, customer string, amount double) USING iceberg "
              "TBLPROPERTIES ('write.metadata.delete-after-commit.enabled'='false')")
    d1 = snap("create")
    print("after CREATE:", d1["versions"], "snapshots:", len(d1["snapshots"]))
    assert d1["versions"] == ["v1"] and d1["snapshots"] == [] and d1["current"] is None

    spark.sql("INSERT INTO lab.db.orders VALUES (1, 'ann', 120.0), (2, 'bob', 80.5)")
    d2 = snap("insert1")
    spark.sql("INSERT INTO lab.db.orders VALUES (3, 'ann', 42.0), (4, 'cara', 300.0)")
    d3 = snap("insert2")
    print("after INSERT 2:", json.dumps({k: d3[k] for k in ("versions", "current")}))
    assert d2["versions"] == ["v1", "v2"] and d3["versions"] == ["v1", "v2", "v3"]
    assert [len(s["manifests"]) for s in d3["snapshots"]] == [1, 2]

    # MERGE: order 2 changes amount, order 5 is new. Copy-on-write is the default, so the file with order 2 is rewritten.
    spark.sql("CREATE OR REPLACE TEMP VIEW src AS SELECT * FROM VALUES (2, 'bob', 95.0), (5, 'dan', 10.0) AS t(order_id, customer, amount)")
    spark.sql("MERGE INTO lab.db.orders t USING src s ON t.order_id = s.order_id "
              "WHEN MATCHED THEN UPDATE SET t.amount = s.amount WHEN NOT MATCHED THEN INSERT *")
    d4 = snap("merge")
    s4 = d4["snapshots"][-1]
    print("MERGE snapshot:", s4["operation"], s4["summary"])
    for m in s4["manifests"]:
        print("  manifest", m["name"], {k: m[k] for k in ("added", "existing", "deleted")}, [(e["status"], e["file"], e["records"]) for e in m["entries"]])

    # SELECT: planning reads only the metadata. A filter outside the bounds of a file is skipped (looked at in the lesson).
    total = spark.sql("SELECT count(*), sum(amount) FROM lab.db.orders").first()
    print("SELECT after merge:", tuple(total))
    assert total[0] == 5 and abs(total[1] - (120.0 + 95.0 + 42.0 + 300.0 + 10.0)) < 1e-9

    # planning with a filter, from PyIceberg on the same catalog: which files does the manifest statistics let a reader skip?
    tbl = pyiceberg_catalog(root).load_table("db.orders")
    planned = [names.m[t.file.file_path.replace("file://", "").replace("file:", "")] for t in tbl.scan(row_filter="amount > 200").plan_files()]
    everything = [names.m[t.file.file_path.replace("file://", "").replace("file:", "")] for t in tbl.scan().plan_files()]
    print("files planned for amount > 200:", planned, "of", everything)
    assert planned == ["a2"] and sorted(everything) == ["a2", "a3"]            # a3 has amounts 10..120 only, a1 is gone from the snapshot
    steps[-1]["select"] = {"filter": "amount > 200", "planned": planned, "all": sorted(everything)}

    # time travel to the first insert
    first_id = int(d2["snapshots"][0]["id"])
    old = spark.sql(f"SELECT count(*) FROM lab.db.orders VERSION AS OF {first_id}").first()[0]
    print("time travel to snapshot 1:", old)
    assert old == 2
    steps[-1]["travel"] = {"snapshot": "s1", "rows": old}

    spark.sql("CALL lab.system.rewrite_data_files(table => 'db.orders', options => map('min-input-files','2'))").show(truncate=False)
    d5 = snap("compact")
    s5 = d5["snapshots"][-1]
    print("COMPACTION snapshot:", s5["operation"], s5["summary"])
    for m in s5["manifests"]:
        print("  manifest", m["name"], {k: m[k] for k in ("added", "existing", "deleted")}, [(e["status"], e["file"], e["records"]) for e in m["entries"]])
    assert s5["operation"] == "replace"
    assert s4["operation"] == "overwrite" and d4["versions"] == ["v1", "v2", "v3", "v4"]
    # MERGE rewrote the one file that held order 2 (a1) as a3 with 3 rows, and left a2 alone
    assert s4["summary"]["added-data-files"] == "1" and s4["summary"]["deleted-data-files"] == "1" and s4["summary"]["total-records"] == "5"
    assert {(e["status"], e["file"]) for m in s4["manifests"] for e in m["entries"]} == {("ADDED", "a3"), ("ADDED", "a2"), ("DELETED", "a1")}
    assert sorted(len(m["entries"]) for m in s4["manifests"]) == [1, 1, 1]
    assert [r for m in s4["manifests"] for e in m["entries"] if e["file"] == "a3" for r in e["rows"]] == [[1, "ann", 120.0], [2, "bob", 95.0], [5, "dan", 10.0]]
    # compaction: two files in, one out, the old data files stay on disk for the older snapshots
    assert {(e["status"], e["file"]) for m in s5["manifests"] for e in m["entries"]} == {("ADDED", "a4"), ("DELETED", "a3"), ("DELETED", "a2")}
    assert s5["summary"]["total-data-files"] == "1" and s5["summary"]["total-records"] == "5" and d5["versions"][-1] == "v5"
    for old_file in ("a1", "a2", "a3"):
        assert any(os.path.exists(p) for p, n in names.m.items() if n == old_file and os.path.exists(local(p)))

    print("short names:", {os.path.basename(p)[:28]: n for p, n in names.m.items()})
    if write:
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump({"steps": steps}, f, indent=1)
        print("wrote", OUT)
    print("ok")


if __name__ == "__main__":
    main()
