"""Lesson 6, sub-page "Copy-on-write and merge-on-read in depth": what each mode writes, what a reader must do, and how compaction cleans up.

    ./run_wsl.sh exercises/16_cow_mor_in_depth.py            (inside WSL; on Windows run it through wsl.exe, see 15_under_the_covers.py)
    ./run_wsl.sh exercises/16_cow_mor_in_depth.py --write    also writes site/src/components/labs/iceberg/rowLevel.json for the lab

Sections: 1 the price of one changed row in a 100,000-row table (5 files of 20,000 rows) (bytes and rows written, both modes), 2 what the reader has to apply as deletes pile up,
3 how compaction removes delete files, 4 one table with a different mode per statement, 5 a small table taken through DELETE, UPDATE, SELECT and compaction in
both modes with every file dumped (the data of the lab).
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from fileview import Names, dump  # noqa: E402
from lab import fresh_root, get_spark, pyiceberg_catalog, relaunch_in_wsl_if_windows  # noqa: E402

relaunch_in_wsl_if_windows(__file__)

OUT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "site", "src", "components", "labs", "iceberg", "rowLevel.json"))
MOR = "'write.delete.mode'='merge-on-read','write.update.mode'='merge-on-read','write.merge.mode'='merge-on-read'"


def summary(spark, ident):
    r = spark.sql(f"SELECT summary FROM lab.{ident}.snapshots ORDER BY committed_at DESC LIMIT 1").first()
    return dict(r.summary)


def last_op(spark, ident):
    return spark.sql(f"SELECT operation FROM lab.{ident}.snapshots ORDER BY committed_at DESC LIMIT 1").first().operation


def fill(spark, ident, files=5, per=20000):
    """`files` INSERTs of `per` rows: with one core, one data file each."""
    for i in range(files):
        spark.sql(f"INSERT INTO lab.{ident} SELECT id, concat('c', cast(id % 50 AS string)), cast(id AS double) FROM range({i * per}, {(i + 1) * per})")


def total_live(state):
    """Rows in the data files that the current snapshot of a dumped state lists as live (ADDED or EXISTING)."""
    cur = next(s for s in state["snapshots"] if s["name"] == state["current"])
    return sum(e["records"] for m in cur["manifests"] if m["content"] == 0 for e in m["entries"] if e["status"] != "DELETED")


def main():
    write = "--write" in sys.argv
    root = fresh_root("16_cow_mor_in_depth")
    spark = get_spark(root)
    spark.sql("CREATE NAMESPACE lab.db")

    # ---- 1. the price of one changed row ------------------------------------------------------------------------------
    cost = {}
    for mode, props in (("cow", ""), ("mor", ", " + MOR)):
        ident = f"db.big_{mode}"
        spark.sql(f"CREATE TABLE lab.{ident} (order_id bigint, customer string, amount double) USING iceberg TBLPROPERTIES ('format-version'='2'{props})")
        fill(spark, ident)
        before = summary(spark, ident)
        assert before["total-data-files"] == "5" and before["total-records"] == "100000"
        spark.sql(f"UPDATE lab.{ident} SET amount = -1 WHERE order_id = 50000")
        up = summary(spark, ident)
        op_up = last_op(spark, ident)
        spark.sql(f"DELETE FROM lab.{ident} WHERE order_id = 100")
        de = summary(spark, ident)
        op_de = last_op(spark, ident)
        cost[mode] = {"update": up, "delete": de, "op_update": op_up, "op_delete": op_de}
        print(mode, "UPDATE", op_up, {k: up.get(k) for k in ("added-data-files", "deleted-data-files", "added-records", "deleted-records", "added-delete-files", "added-position-deletes", "added-files-size")})
        print(mode, "DELETE", op_de, {k: de.get(k) for k in ("added-data-files", "deleted-data-files", "added-records", "deleted-records", "added-delete-files", "added-position-deletes", "added-files-size")})
        assert spark.sql(f"SELECT count(*) FROM lab.{ident}").first()[0] == 99999
        assert spark.sql(f"SELECT amount FROM lab.{ident} WHERE order_id = 50000").first()[0] == -1.0
    c, m = cost["cow"], cost["mor"]
    # copy-on-write rewrites the whole 1000-row file for one row, merge-on-read writes a one-row file plus a delete file
    assert c["update"]["added-records"] == "20000" and c["update"]["deleted-records"] == "20000" and "added-delete-files" not in c["update"]
    assert m["update"]["added-records"] == "1" and m["update"]["added-delete-files"] == "1" and m["update"].get("deleted-data-files") in (None, "0")
    assert c["delete"]["added-records"] == "19999" and c["delete"]["deleted-records"] == "20000"
    assert m["delete"]["added-delete-files"] == "1" and m["delete"].get("added-records") in (None, "0")
    for key in ("update", "delete"):
        print(key, "bytes written: cow", c[key].get("added-files-size"), " mor", m[key].get("added-files-size"))
        assert int(c[key]["added-files-size"]) > int(m[key]["added-files-size"])

    # ---- 2. what a reader must apply as deletes pile up -----------------------------------------------------------------
    ident = "db.big_mor"
    cat = pyiceberg_catalog(root)

    def delete_files_per_task():
        tbl = cat.load_table(ident)
        return sorted(len(t.delete_files) for t in tbl.scan().plan_files())

    print("after 1 UPDATE + 1 DELETE (different files):", delete_files_per_task())
    s0 = summary(spark, ident)
    print("delete files / positions before the pile:", s0["total-delete-files"], s0["total-position-deletes"])
    assert (s0["total-delete-files"], s0["total-position-deletes"]) == ("2", "2")
    pile = []
    for k in range(3):
        spark.sql(f"DELETE FROM lab.{ident} WHERE order_id = {30000 + k}")  # all three deletes hit the same data file
        s = summary(spark, ident)
        pile.append((s["total-delete-files"], s["total-position-deletes"], delete_files_per_task()))
    print("three more DELETEs in one data file ->", pile)
    # a reader must apply every delete file that covers a data file it opens
    final_tasks = delete_files_per_task()
    # Spark writes ONE new delete file per data file that has deletes: it folds the earlier positions of that data file into it
    # (the older delete file is marked DELETED in a new manifest), so a reader applies at most one delete file per data file
    assert max(final_tasks) == 1 and pile[-1][0] == "3" and pile[-1][1] == "5"
    assert spark.sql(f"SELECT count(*) FROM lab.{ident}").first()[0] == 99996
    pos_rows = spark.sql(f"SELECT count(*) FROM lab.{ident}.position_deletes").first()[0]
    print("position_deletes rows:", pos_rows)

    # ---- 3. compaction removes the delete files -----------------------------------------------------------------------
    r = spark.sql(f"CALL lab.system.rewrite_data_files(table => '{ident}', options => map('delete-file-threshold','1','min-input-files','1'))").first()
    print("rewrite_data_files:", r)
    s = summary(spark, ident)
    print("after compaction:", {k: s.get(k) for k in ("total-data-files", "total-delete-files", "total-position-deletes", "total-records")}, "tasks:", delete_files_per_task())
    assert spark.sql(f"SELECT count(*) FROM lab.{ident}").first()[0] == 99996
    # the data files were rewritten without the deleted rows, but the delete files are still in the table: no live data file needs them any more
    assert max(delete_files_per_task()) == 0 and int(s["total-delete-files"]) >= 1 and r.removed_delete_files_count == 0
    r2 = spark.sql(f"CALL lab.system.rewrite_data_files(table => '{ident}', options => map('remove-dangling-deletes','true','min-input-files','100'))").first()
    s2 = summary(spark, ident)
    print("with remove-dangling-deletes:", r2, {k: s2.get(k) for k in ("total-data-files", "total-delete-files", "total-position-deletes", "total-records")})
    assert s2["total-delete-files"] == "0" and spark.sql(f"SELECT count(*) FROM lab.{ident}").first()[0] == 99996

    # ---- 4. a different mode per statement ----------------------------------------------------------------------------
    spark.sql("CREATE TABLE lab.db.mixed (order_id bigint, customer string, amount double) USING iceberg "
              "TBLPROPERTIES ('format-version'='2','write.delete.mode'='merge-on-read','write.update.mode'='copy-on-write','write.merge.mode'='copy-on-write')")
    fill(spark, "db.mixed", files=2, per=100)
    spark.sql("DELETE FROM lab.db.mixed WHERE order_id = 5")
    d_sum, d_op = summary(spark, "db.mixed"), last_op(spark, "db.mixed")
    spark.sql("UPDATE lab.db.mixed SET amount = 0 WHERE order_id = 150")
    u_sum, u_op = summary(spark, "db.mixed"), last_op(spark, "db.mixed")
    print("mixed DELETE:", d_op, {k: d_sum.get(k) for k in ("added-data-files", "added-delete-files")}, " UPDATE:", u_op, {k: u_sum.get(k) for k in ("added-data-files", "deleted-data-files", "added-delete-files")})
    assert d_sum.get("added-delete-files") == "1" and "added-data-files" not in d_sum or d_sum.get("added-data-files") in (None, "0")
    assert u_sum.get("added-delete-files") in (None, "0") and u_sum["added-data-files"] == "1" and u_sum["deleted-data-files"] == "1"

    # ---- 5. a small table, both modes, every file dumped ------------------------------------------------------------------
    rows = "(1, 'ann', 120.0), (2, 'bob', 80.5), (3, 'ann', 42.0), (4, 'cara', 300.0), (5, 'dan', 10.0)"
    out = {}
    for mode, props in (("cow", ""), ("mor", ", " + MOR)):
        ident = f"db.small_{mode}"
        names = Names()
        spark.sql(f"CREATE TABLE lab.{ident} (order_id bigint, customer string, amount double) USING iceberg TBLPROPERTIES ('format-version'='2'{props})")
        steps = []

        def snap(label):
            d = dump(root, ident, names)
            d["label"] = label
            d["versions"] = sorted({n for p, n in names.m.items() if n.startswith("v")}, key=lambda x: int(x[1:]))
            steps.append(d)
            return d

        spark.sql(f"INSERT INTO lab.{ident} VALUES {rows}")
        snap("insert")
        spark.sql(f"DELETE FROM lab.{ident} WHERE order_id = 3")
        snap("delete")
        spark.sql(f"UPDATE lab.{ident} SET amount = 11.0 WHERE order_id = 5")
        snap("update")
        out[mode] = {"steps": steps, "names": names}
        total = spark.sql(f"SELECT count(*), sum(amount) FROM lab.{ident}").first()
        print(mode, "after DELETE 3 and UPDATE 5:", tuple(total))
        assert total[0] == 4 and abs(total[1] - (120.0 + 80.5 + 300.0 + 11.0)) < 1e-9

    cow, mor = out["cow"]["steps"], out["mor"]["steps"]
    for d in cow + mor:
        print(d["label"], "->", [(s["name"], s["operation"], [(m["name"], m["content"], [(e["status"], e["file"], e["records"]) for e in m["entries"]]) for m in s["manifests"]]) for s in d["snapshots"][-1:]])

    # compaction of the MOR table, reading it first with PyIceberg to see what a reader has to apply
    ident = "db.small_mor"
    tbl = cat.load_table(ident)
    tasks = list(tbl.scan().plan_files())
    applied = [(out["mor"]["names"].find(t.file.file_path), [out["mor"]["names"].find(x.file_path) for x in t.delete_files]) for t in tasks]
    print("a reader opens (data file, delete files to apply):", applied)
    r = spark.sql(f"CALL lab.system.rewrite_data_files(table => '{ident}', options => map('delete-file-threshold','1','min-input-files','1'))").first()
    print("rewrite_data_files small_mor:", r)
    names = out["mor"]["names"]
    d = dump(root, ident, names)
    d["label"] = "compact"
    d["versions"] = sorted({n for p, n in names.m.items() if n.startswith("v")}, key=lambda x: int(x[1:]))
    mor.append(d)
    print("compact ->", [(s["name"], s["operation"], s["summary"]) for s in d["snapshots"][-1:]])

    # the delete file d2 still sits in the table although no live data file needs it: remove it
    r = spark.sql(f"CALL lab.system.rewrite_data_files(table => '{ident}', options => map('remove-dangling-deletes','true','min-input-files','100'))").first()
    print("remove-dangling-deletes small_mor:", r)
    assert r.removed_delete_files_count == 1 and r.rewritten_data_files_count == 0
    d = dump(root, ident, names)
    d["label"] = "clean"
    d["versions"] = sorted({n for p, n in names.m.items() if n.startswith("v")}, key=lambda x: int(x[1:]))
    mor.append(d)
    print("clean ->", [(s["name"], s["operation"], s["summary"], [(m["name"], m["content"], [(e["status"], e["file"]) for e in m["entries"]]) for m in s["manifests"]]) for s in d["snapshots"][-2:]])
    assert total_live(mor[-1]) == 4

    if write:
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump({"cow": {"steps": cow}, "mor": {"steps": mor}, "reads": {"applied": applied}, "cost": cost}, f, indent=1)
        print("wrote", OUT)
    print("ok")


if __name__ == "__main__":
    main()
