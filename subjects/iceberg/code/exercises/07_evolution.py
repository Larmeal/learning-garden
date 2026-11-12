"""Lesson 7: evolving a table. Schema, partitioning and sort order change without rewriting data files.

    uv run python exercises/07_evolution.py       (on Windows this re-launches itself in WSL, see run_wsl.sh)

Asserts that each ALTER only writes a new metadata.json (the data files stay the same), that old files are still read
with the schema and the partition spec they were written with, and what PyIceberg can change through update_schema,
update_spec and the sort order.
"""

import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import pyarrow as pa  # noqa: E402

from lab import current_metadata, files, fresh_root, get_spark, metadata_files, pyiceberg_catalog, relaunch_in_wsl_if_windows, show  # noqa: E402

relaunch_in_wsl_if_windows(__file__)


def data_files(root, ident):
    return [p for p in files(root, ident) if p.startswith("data/")]


def main():
    root = fresh_root("07_evolution")
    spark = get_spark(root)
    spark.sql("CREATE NAMESPACE lab.db")

    # ---- 1. schema evolution in Spark ------------------------------------------------------------------------
    spark.sql("CREATE TABLE lab.db.users (id int, name string, score float, address struct<city: string>) USING iceberg")
    spark.sql("INSERT INTO lab.db.users VALUES (1, 'ann', 1.5, named_struct('city', 'bkk')), (2, 'bob', 2.5, named_struct('city', 'cnx'))")
    files_before = data_files(root, "db.users")
    n_meta = len(metadata_files(root, "db.users"))
    steps = [
        "ALTER TABLE lab.db.users ADD COLUMN email string",                          # new column, nothing rewritten
        "ALTER TABLE lab.db.users RENAME COLUMN name TO full_name",
        "ALTER TABLE lab.db.users ALTER COLUMN id TYPE bigint",                       # int -> long is allowed
        "ALTER TABLE lab.db.users ALTER COLUMN score TYPE double",                    # float -> double is allowed
        "ALTER TABLE lab.db.users ADD COLUMN address.zip string",                     # a nested field
        "ALTER TABLE lab.db.users ALTER COLUMN email FIRST",                          # reorder
    ]
    for q in steps:
        spark.sql(q)
    assert data_files(root, "db.users") == files_before                               # no data file was touched
    assert len(metadata_files(root, "db.users")) == n_meta + len(steps)               # one new metadata.json per ALTER
    _, md = current_metadata(root, "db.users")
    cur = [s for s in md["schemas"] if s["schema-id"] == md["current-schema-id"]][0]
    names = [f["name"] for f in cur["fields"]]
    print("columns now:", names, "| schemas kept:", len(md["schemas"]), "| last-column-id:", md["last-column-id"])
    assert names == ["email", "id", "full_name", "score", "address"] and len(md["schemas"]) == 1 + len(steps)
    old = spark.sql("SELECT id, full_name, score, email, address.city, address.zip FROM lab.db.users ORDER BY id").collect()
    print("old rows read with the new schema:", [tuple(r) for r in old])
    assert old[0].email is None and old[0].zip is None and old[0].id == 1 and old[0].score == 1.5 and old[0].city == "bkk"

    # a change that is not a safe promotion is refused
    refused = False
    try:
        spark.sql("ALTER TABLE lab.db.users ALTER COLUMN id TYPE int")
    except Exception as e:  # noqa: BLE001
        refused = True
        print("bigint -> int:", type(e).__name__, str(e).splitlines()[0][:90])
    assert refused

    # an old snapshot is still read with the schema it had
    snap1 = spark.sql("SELECT snapshot_id FROM lab.db.users.snapshots ORDER BY committed_at").first().snapshot_id
    old_view = spark.sql(f"SELECT * FROM lab.db.users VERSION AS OF {snap1}")
    print("as of the first snapshot:", old_view.columns)
    assert old_view.columns == ["id", "name", "score", "address"]

    # ---- 2. PyIceberg schema evolution ---------------------------------------------------------------------
    cat = pyiceberg_catalog(root)
    t = cat.load_table("db.users")
    from pyiceberg.types import StringType

    with t.update_schema() as u:
        u.add_column("country", StringType())
        u.rename_column("full_name", "name")
    t = cat.load_table("db.users")
    print("PyIceberg columns:", [f.name for f in t.schema().fields])
    assert [f.name for f in t.schema().fields] == ["email", "id", "name", "score", "address", "country"]
    spark.sql("REFRESH TABLE lab.db.users")
    assert "country" in spark.table("lab.db.users").columns and "name" in spark.table("lab.db.users").columns
    assert spark.sql("SELECT name FROM lab.db.users WHERE id = 2").first().name == "bob"          # still the same file, id 2 -> name

    # ---- 3. partition evolution -------------------------------------------------------------------------------
    spark.sql("CREATE TABLE lab.db.events (id bigint, ts timestamp) USING iceberg PARTITIONED BY (months(ts))")
    spark.sql("INSERT INTO lab.db.events VALUES (1, TIMESTAMP'2026-01-05 10:00:00'), (2, TIMESTAMP'2026-01-20 10:00:00')")
    jan = data_files(root, "db.events")
    assert len(jan) == 1 and "ts_month=2026-01" in jan[0]                              # one file for the month
    spark.sql("ALTER TABLE lab.db.events REPLACE PARTITION FIELD ts_month WITH days(ts)")
    spark.sql("INSERT INTO lab.db.events VALUES (3, TIMESTAMP'2026-02-03 10:00:00'), (4, TIMESTAMP'2026-02-04 10:00:00')")
    all_files = data_files(root, "db.events")
    print("data files:", all_files)
    assert jan[0] in all_files and len(all_files) == 3                                 # the January file was not rewritten; two day files added
    _, mde = current_metadata(root, "db.events")
    specs = {s["spec-id"]: [(f["name"], f["transform"]) for f in s["fields"]] for s in mde["partition-specs"]}
    print("partition specs:", specs, "| default:", mde["default-spec-id"])
    assert specs == {0: [("ts_month", "month")], 1: [("ts_day", "day")]} and mde["default-spec-id"] == 1
    by_spec = spark.sql("SELECT spec_id, count(*) AS files, sum(record_count) AS records FROM lab.db.events.files GROUP BY spec_id ORDER BY spec_id")
    show(by_spec)
    assert [(r.spec_id, r.files, r.records) for r in by_spec.collect()] == [(0, 1, 2), (1, 2, 2)]
    # one query over both layouts, pruned per spec
    t_ev = cat.load_table("db.events")
    plan = lambda f: len(list(t_ev.scan(row_filter=f).plan_files()))                   # noqa: E731
    p_jan, p_feb = plan("ts >= '2026-01-10T00:00:00+00:00' and ts < '2026-01-11T00:00:00+00:00'"), plan("ts >= '2026-02-03T00:00:00+00:00' and ts < '2026-02-04T00:00:00+00:00'")
    print("files planned: a day in January", p_jan, "| a day in February", p_feb)
    assert (p_jan, p_feb) == (1, 1)    # January: the month file may hold that day; February: only the day file of the 3rd
    assert spark.sql("SELECT count(*) FROM lab.db.events").first()[0] == 4

    # PyIceberg changes the spec too
    from pyiceberg.transforms import BucketTransform

    spark.sql("CREATE TABLE lab.db.pe (id bigint, ts timestamp) USING iceberg")
    tp = cat.load_table("db.pe")
    with tp.update_spec() as us:
        us.add_field("id", BucketTransform(4), "id_b4")
    tp = cat.load_table("db.pe")
    print("PyIceberg spec:", tp.spec())
    assert [f.name for f in tp.spec().fields] == ["id_b4"]

    # ---- 4. sort order -----------------------------------------------------------------------------------------
    spark.sql("CREATE TABLE lab.db.sorted (id bigint, ts timestamp) USING iceberg")
    spark.sql("ALTER TABLE lab.db.sorted WRITE ORDERED BY ts DESC, id")
    _, mds = current_metadata(root, "db.sorted")
    order = [s for s in mds["sort-orders"] if s["order-id"] == mds["default-sort-order-id"]][0]
    print("sort order:", [(f["direction"], f["transform"], f["source-id"]) for f in order["fields"]])
    assert [(f["direction"], f["source-id"]) for f in order["fields"]] == [("desc", 2), ("asc", 1)]
    spark.sql("INSERT INTO lab.db.sorted VALUES (1, TIMESTAMP'2026-01-01 00:00:00'), (2, TIMESTAMP'2026-01-03 00:00:00'), (3, TIMESTAMP'2026-01-02 00:00:00')")
    f = spark.sql("SELECT sort_order_id FROM lab.db.sorted.files").first()
    assert f.sort_order_id == mds["default-sort-order-id"]                               # the file records the order it was written in
    first_rows = spark.sql("SELECT id FROM lab.db.sorted").collect()
    print("rows as written (sorted by ts desc):", [r.id for r in first_rows])
    assert [r.id for r in first_rows] == [2, 3, 1]

    print("ok")


if __name__ == "__main__":
    main()
