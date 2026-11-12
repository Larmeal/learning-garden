"""Lesson 3: field ids, types, partition transforms and hidden partitioning.

    uv run python exercises/03_schema_partitioning.py       (on Windows this re-launches itself in WSL, see run_wsl.sh)

Asserts: every column (also nested ones) has a unique field id that is stored in metadata.json and in the Parquet file,
a rename keeps the id (old files stay readable) while drop and re-add makes a new id (old values do not come back),
a filter on the source column prunes files through a partition transform, and Spark and PyIceberg compute the same
bucket number.
"""

import datetime as dt
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import pyarrow.parquet as pq  # noqa: E402

from lab import (  # noqa: E402
    current_metadata,
    files,
    fresh_root,
    get_spark,
    pyiceberg_catalog,
    relaunch_in_wsl_if_windows,
    show,
    table_dir,
)

relaunch_in_wsl_if_windows(__file__)


def all_ids(fields, out=None):
    """Every field id of a schema JSON, nested fields included."""
    out = [] if out is None else out
    for f in fields:
        out.append(f["id"])
        t = f["type"]
        while isinstance(t, dict):
            if t["type"] == "struct":
                all_ids(t["fields"], out)
                break
            if t["type"] == "list":
                out.append(t["element-id"])
                t = t["element"]
            elif t["type"] == "map":
                out.extend([t["key-id"], t["value-id"]])
                t = t["value"]
            else:
                break
    return out


def main():
    root = fresh_root("03_schema_partitioning")
    spark = get_spark(root)
    spark.sql("CREATE NAMESPACE lab.db")

    # ---- 1. field ids, also for nested columns ------------------------------------------------------------------
    spark.sql(
        """CREATE TABLE lab.db.events (
               event_id bigint, user_id bigint, country string, price decimal(10,2), ts timestamp,
               tags array<string>, address struct<city: string, zip: string>, attrs map<string, int>)
           USING iceberg PARTITIONED BY (days(ts))"""
    )
    rows = []
    for d in range(1, 6):  # five days, two events a day
        for k in range(2):
            n = d * 10 + k
            rows.append(f"({n}, {100 + n}, '{'TH' if k == 0 else 'US'}', {n}.50, TIMESTAMP'2026-01-0{d} {9 + k}:00:00', array('a'), named_struct('city','x','zip','1'), map('k', {n}))")
    spark.sql("INSERT INTO lab.db.events VALUES " + ",".join(rows))

    _, md = current_metadata(root, "db.events")
    schema = md["schemas"][0]
    ids = all_ids(schema["fields"])
    print("field ids (top level):", {f["name"]: f["id"] for f in schema["fields"]})
    print("all ids:", sorted(ids))
    assert len(ids) == len(set(ids)) and sorted(ids) == list(range(1, 14)) and md["last-column-id"] == 13   # 8 columns + 5 nested
    assert [f["id"] for f in schema["fields"]] == [1, 2, 3, 4, 5, 6, 7, 8]
    assert schema["fields"][5]["type"]["element-id"] == 9 and schema["fields"][6]["type"]["fields"][0]["id"] == 10   # array element, struct city
    assert schema["fields"][7]["type"]["key-id"] == 12 and schema["fields"][7]["type"]["value-id"] == 13

    # the Parquet file carries the ids too
    first = [p for p in files(root, "db.events") if p.startswith("data/")][0]
    pf = pq.ParquetFile(os.path.join(table_dir(root, "db.events"), first))
    stored = {f.name: int(f.metadata[b"PARQUET:field_id"]) for f in pf.schema_arrow}
    assert stored["event_id"] == 1 and stored["attrs"] == 8

    # ---- 2. Spark types become Iceberg types ----------------------------------------------------------------
    cat = pyiceberg_catalog(root)
    t = cat.load_table("db.events")
    types = {f.name: str(f.field_type) for f in t.schema().fields}
    print("iceberg types:", types)
    assert types["event_id"] == "long" and types["price"] == "decimal(10, 2)" and types["ts"] == "timestamptz"
    assert types["tags"] == "list<string>" and types["address"].startswith("struct<") and types["attrs"] == "map<string, int>"
    spark.sql("CREATE TABLE lab.db.ntz (a timestamp_ntz, b int, c date) USING iceberg")
    ntz = {f.name: str(f.field_type) for f in cat.load_table("db.ntz").schema().fields}
    assert ntz == {"a": "timestamp", "b": "int", "c": "date"}

    # ---- 3. hidden partitioning: filter on ts, never on a partition column --------------------------------
    print("partition spec:", t.spec())
    spec = md["partition-specs"][0]["fields"]
    assert [(f["name"], f["transform"], f["source-id"]) for f in spec] == [("ts_day", "day", 5)]
    assert "ts_day" not in [f["name"] for f in schema["fields"]]                 # the partition column is not a column of the table
    data = [p for p in files(root, "db.events") if p.startswith("data/")]
    assert sorted({p.split("/")[1] for p in data}) == [f"ts_day=2026-01-0{d}" for d in range(1, 6)]
    all_tasks = list(t.scan().plan_files())
    one_day = list(t.scan(row_filter="ts >= '2026-01-02T00:00:00+00:00' and ts < '2026-01-03T00:00:00+00:00'").plan_files())
    other = list(t.scan(row_filter="country = 'TH'").plan_files())
    print("files planned: no filter", len(all_tasks), "| one day", len(one_day), "| country = 'TH'", len(other))
    assert (len(all_tasks), len(one_day), len(other)) == (5, 1, 5)          # country is not a partition column, ts is
    # the value in the manifest is days since 1970-01-01
    day2 = one_day[0].file.partition
    assert day2[0] == (dt.date(2026, 1, 2) - dt.date(1970, 1, 1)).days
    # Spark prunes the same way: the scan node of the plan shows how many files it reads
    plan = spark.sql("SELECT * FROM lab.db.events WHERE ts >= TIMESTAMP'2026-01-02 00:00:00' AND ts < TIMESTAMP'2026-01-03 00:00:00'")
    n_rows = plan.count()
    assert n_rows == 2
    assert "ts_day" not in plan.columns
    parts = spark.sql("SELECT partition, record_count, file_count FROM lab.db.events.partitions ORDER BY partition")
    show(parts)
    assert parts.count() == 5 and all(r.record_count == 2 and r.file_count == 1 for r in parts.collect())

    # ---- 4. the transforms, and Spark and PyIceberg agree on bucket numbers --------------------------------
    spark.sql(
        """CREATE TABLE lab.db.users (user_id bigint, country string, signed_up timestamp)
           USING iceberg PARTITIONED BY (bucket(4, user_id), truncate(1, country), months(signed_up))"""
    )
    spark.sql(
        """INSERT INTO lab.db.users VALUES (101, 'TH', TIMESTAMP'2026-01-15 00:00:00'), (106, 'US', TIMESTAMP'2026-02-15 00:00:00'),
           (107, 'TH', TIMESTAMP'2026-02-20 00:00:00'), (103, 'UK', TIMESTAMP'2026-02-21 00:00:00')"""
    )
    spec = [(f["name"], f["transform"]) for f in current_metadata(root, "db.users")[1]["partition-specs"][0]["fields"]]
    print("users spec:", spec)
    assert spec == [("user_id_bucket", "bucket[4]"), ("country_trunc", "truncate[1]"), ("signed_up_month", "month")]
    from pyiceberg.transforms import BucketTransform
    from pyiceberg.types import LongType

    to_bucket = BucketTransform(4).transform(LongType())
    spark_buckets = {r.user_id: r.b for r in spark.sql("SELECT user_id, lab.system.bucket(4, user_id) AS b FROM lab.db.users").collect()}
    print("bucket(4, user_id):", spark_buckets)
    assert spark_buckets == {uid: to_bucket(uid) for uid in (101, 103, 106, 107)}       # same Murmur3 hash in both engines
    pv = spark.sql("SELECT partition.user_id_bucket AS b, partition.country_trunc AS c, partition.signed_up_month AS m, record_count FROM lab.db.users.files ORDER BY m, c")
    show(pv)
    assert pv.count() == 4                                                           # "US" and "UK" both truncate to "U" in the same month: 2 files, 2 buckets
    assert sorted((r.b, r.c, r.m) for r in pv.collect()) == [(0, "T", 672), (1, "T", 673), (2, "U", 673), (3, "U", 673)]

    # ---- 5. a rename keeps the field id; drop and re-add does not -------------------------------------------
    spark.sql("ALTER TABLE lab.db.events RENAME COLUMN price TO unit_price")
    after = spark.sql("SELECT event_id, unit_price FROM lab.db.events WHERE event_id = 10").first()
    assert float(after.unit_price) == 10.5                                           # the old file is read through id 4, not name "price"
    _, md2 = current_metadata(root, "db.events")
    cur_schema = [s for s in md2["schemas"] if s["schema-id"] == md2["current-schema-id"]][0]
    assert [f["id"] for f in cur_schema["fields"] if f["name"] == "unit_price"] == [4] and len(md2["schemas"]) == 2
    spark.sql("ALTER TABLE lab.db.events DROP COLUMN unit_price")
    spark.sql("ALTER TABLE lab.db.events ADD COLUMN unit_price decimal(10,2)")
    again = spark.sql("SELECT event_id, unit_price FROM lab.db.events WHERE event_id = 10").first()
    print("after drop + add of the same name:", again.asDict())
    assert again.unit_price is None                                                  # new id 14: the old values of id 4 do not come back
    _, md3 = current_metadata(root, "db.events")
    sch3 = [s for s in md3["schemas"] if s["schema-id"] == md3["current-schema-id"]][0]
    assert [f["id"] for f in sch3["fields"] if f["name"] == "unit_price"] == [14] and md3["last-column-id"] == 14

    print("ok")


if __name__ == "__main__":
    main()
