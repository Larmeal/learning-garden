"""Lesson 4: writing and committing. Append, overwrite, delete, a failed write, and two writers that collide.

    uv run python exercises/04_writes_commit.py       (on Windows this re-launches itself in WSL, see run_wsl.sh)

Asserts which snapshot `operation` each way of writing produces, what INSERT OVERWRITE replaces in static and in dynamic mode,
that a failed job leaves no new snapshot, and that a PyIceberg writer holding an old snapshot gets CommitFailedException and
succeeds after refresh().
"""

import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

import pyarrow as pa  # noqa: E402

from lab import fresh_root, get_spark, pyiceberg_catalog, relaunch_in_wsl_if_windows, show  # noqa: E402

relaunch_in_wsl_if_windows(__file__)


def ops(spark, ident="lab.db.orders"):
    return [r.operation for r in spark.sql(f"SELECT operation FROM {ident}.snapshots ORDER BY committed_at").collect()]


def days(spark, ident="lab.db.orders"):
    return sorted(r.d for r in spark.sql(f"SELECT DISTINCT date(ordered_at) AS d FROM {ident}").collect())


def main():
    root = fresh_root("04_writes_commit")
    spark = get_spark(root)
    spark.sql("CREATE NAMESPACE lab.db")
    spark.sql(
        "CREATE TABLE lab.db.orders (order_id bigint, amount double, ordered_at timestamp) USING iceberg PARTITIONED BY (days(ordered_at))"
    )

    def ins(rows):
        spark.sql("INSERT INTO lab.db.orders VALUES " + ",".join(f"({i}, {a}, TIMESTAMP'{t}')" for i, a, t in rows))

    # ---- 1. INSERT INTO is an append ------------------------------------------------------------------------
    ins([(1, 10.0, "2026-01-01 08:00:00"), (2, 20.0, "2026-01-02 08:00:00"), (3, 30.0, "2026-01-03 08:00:00")])
    assert ops(spark) == ["append"]

    # ---- 2. INSERT OVERWRITE: static mode (the default) replaces the whole table, dynamic only the partitions seen ----
    print("partitionOverwriteMode:", spark.conf.get("spark.sql.sources.partitionOverwriteMode"))
    assert spark.conf.get("spark.sql.sources.partitionOverwriteMode") == "STATIC"
    spark.sql("INSERT OVERWRITE lab.db.orders VALUES (4, 40.0, TIMESTAMP'2026-01-02 09:00:00')")
    rows_static = [r.order_id for r in spark.sql("SELECT order_id FROM lab.db.orders").collect()]
    print("after INSERT OVERWRITE (static):", rows_static, "| days:", days(spark))
    assert rows_static == [4]                                                       # rows 1 to 3 are gone, also the other days
    assert ops(spark)[-1] == "overwrite"

    ins([(1, 10.0, "2026-01-01 08:00:00"), (3, 30.0, "2026-01-03 08:00:00")])       # back to days 1, 2, 3
    spark.conf.set("spark.sql.sources.partitionOverwriteMode", "dynamic")
    spark.sql("INSERT OVERWRITE lab.db.orders VALUES (5, 50.0, TIMESTAMP'2026-01-02 10:00:00')")
    rows_dyn = sorted(r.order_id for r in spark.sql("SELECT order_id FROM lab.db.orders").collect())
    print("after INSERT OVERWRITE (dynamic):", rows_dyn)
    assert rows_dyn == [1, 3, 5]                                                    # only day 2 was replaced (row 4 gone, 5 in)
    spark.conf.set("spark.sql.sources.partitionOverwriteMode", "static")

    # ---- 3. DataFrameWriterV2 ------------------------------------------------------------------------------------
    from pyspark.sql import functions as F

    df = spark.createDataFrame([(6, 60.0, datetime(2026, 1, 3, 9, 0, 0))], "order_id bigint, amount double, ordered_at timestamp")
    df.writeTo("lab.db.orders").append()
    assert ops(spark)[-1] == "append" and spark.table("lab.db.orders").count() == 4
    df.writeTo("lab.db.orders").overwritePartitions()                               # replaces the partitions the dataframe touches
    assert sorted(r.order_id for r in spark.table("lab.db.orders").collect()) == [1, 5, 6]     # day 3 now holds only row 6
    old = spark.createDataFrame([(7, 70.0, datetime(2026, 1, 1, 9, 0, 0))], "order_id bigint, amount double, ordered_at timestamp")
    old.writeTo("lab.db.orders").overwrite(F.col("ordered_at") < F.lit(datetime(2026, 1, 2)))   # replaces the rows matching a filter
    assert sorted(r.order_id for r in spark.table("lab.db.orders").collect()) == [5, 6, 7]     # row 1 (day 1) out, row 7 in
    print("operations so far:", ops(spark))
    df.writeTo("lab.db.fresh").using("iceberg").create()                           # CTAS-like: creates the table
    assert spark.table("lab.db.fresh").count() == 1

    # ---- 4. a failed job leaves no trace in the table ------------------------------------------------------
    before_snaps, before_rows = ops(spark), sorted(r.order_id for r in spark.table("lab.db.orders").collect())
    failed = False
    try:
        spark.sql("INSERT INTO lab.db.orders SELECT 99, cast(1 / 0 AS double), TIMESTAMP'2026-01-04 00:00:00'")
    except Exception as e:  # noqa: BLE001
        failed = True
        print("failed write:", type(e).__name__, str(e).splitlines()[0][:80])
    assert failed
    assert ops(spark) == before_snaps and sorted(r.order_id for r in spark.table("lab.db.orders").collect()) == before_rows

    # ---- 5. PyIceberg: append, overwrite with a filter, delete with a filter -----------------------------------
    cat = pyiceberg_catalog(root)
    t = cat.load_table("db.orders")

    def arrow(rows):
        return pa.table(
            {
                "order_id": pa.array([r[0] for r in rows], pa.int64()),
                "amount": pa.array([r[1] for r in rows], pa.float64()),
                "ordered_at": pa.array([datetime(*r[2], tzinfo=timezone.utc) for r in rows], pa.timestamp("us", tz="UTC")),
            }
        )

    t.append(arrow([(9, 90.0, (2026, 1, 5, 8))]))
    t.delete("order_id = 9")
    spark.sql("REFRESH TABLE lab.db.orders")
    py_ops = ops(spark)[-2:]
    print("PyIceberg append then delete ->", py_ops)
    assert py_ops == ["append", "delete"]
    t = cat.load_table("db.orders")
    t.overwrite(arrow([(8, 80.0, (2026, 1, 6, 8))]), overwrite_filter="order_id = 5")
    spark.sql("REFRESH TABLE lab.db.orders")
    assert sorted(r.order_id for r in spark.table("lab.db.orders").collect()) == [6, 7, 8]
    two = ops(spark)[-2:]
    print("PyIceberg overwrite with a filter ->", two)             # one call, two commits: the delete, then the append
    assert two == ["delete", "append"]

    # ---- 6. two PyIceberg writers collide: by default the second one retries on its own ---------------------
    import logging

    from pyiceberg.exceptions import CommitFailedException

    records = []

    class Grab(logging.Handler):
        def emit(self, record):
            records.append(record.getMessage())

    logging.getLogger().addHandler(Grab())
    a = cat.load_table("db.orders")
    b = cat.load_table("db.orders")                                                 # both hold the same current snapshot
    a.append(arrow([(10, 1.0, (2026, 1, 7, 8))]))
    b.append(arrow([(11, 2.0, (2026, 1, 7, 9))]))                                   # b's snapshot is out of date
    retries = [m for m in records if "retrying" in m]
    print("log of the second writer:", retries)
    assert len(retries) == 1 and "concurrent update" in retries[0]
    ids = sorted(r["order_id"] for r in cat.load_table("db.orders").scan().to_arrow().to_pylist())
    assert ids == [6, 7, 8, 10, 11]                                                  # both rows are in

    # with the retries switched off the same collision is an error, and after refresh() the write works
    spark.sql("ALTER TABLE lab.db.orders SET TBLPROPERTIES ('commit.retry.num-retries' = '0')")
    a = cat.load_table("db.orders")
    b = cat.load_table("db.orders")
    a.append(arrow([(12, 1.0, (2026, 1, 8, 8))]))
    collided = None
    try:
        b.append(arrow([(13, 2.0, (2026, 1, 8, 9))]))
    except CommitFailedException as e:
        collided = e
        print("no retries:", type(e).__name__, "-", str(e)[:110])
    assert collided is not None
    b.refresh()
    b.append(arrow([(13, 2.0, (2026, 1, 8, 9))]))
    ids = sorted(r["order_id"] for r in cat.load_table("db.orders").scan().to_arrow().to_pylist())
    assert ids == [6, 7, 8, 10, 11, 12, 13]

    spark.sql("REFRESH TABLE lab.db.orders")
    show(spark.sql("SELECT operation, summary['added-records'] AS added, summary['deleted-records'] AS deleted, summary['total-records'] AS total FROM lab.db.orders.snapshots ORDER BY committed_at"), 30)
    print("ok")


if __name__ == "__main__":
    main()
