"""Lesson: datasources-batches. SQL partitioners, files that do not match the regex, batch ordering across months,
CSV reader options and the shortcut `batch.validate(...)`.

Run: uv run python 24_batch_details.py
"""

import sqlite3
import tempfile
import warnings
from pathlib import Path

import great_expectations as gx
import great_expectations.expectations as gxe
import pandas as pd

import gxlab  # noqa: F401

warnings.filterwarnings("ignore")
context = gx.get_context()


def attempt(label, fn):
    try:
        print(f"  {label}: {fn()}")
    except Exception as e:  # noqa: BLE001
        print(f"  {label}: {type(e).__name__} | {str(e).replace(chr(10), ' ')[:130]}")


print("--- 1. SQL table split by a date column ---")
db = Path(tempfile.mkdtemp(prefix="gx_sqlb_")) / "t.db"
con = sqlite3.connect(db)
con.execute("create table events (id int, day text, amount int)")
rows = [(1, "2024-01-30", 5), (2, "2024-01-31", 7), (3, "2024-02-01", 9), (4, "2024-02-01", 11), (5, "2024-02-02", 3)]
con.executemany("insert into events values (?,?,?)", rows)
con.commit()
con.close()
src = context.data_sources.add_sqlite("sq", connection_string=f"sqlite:///{db}")
asset = src.add_table_asset("events", table_name="events")
whole = asset.add_batch_definition_whole_table("whole")
print("  whole table rows:", len(whole.get_batch().head(n_rows=100).data) if hasattr(whole.get_batch().head(n_rows=100), "data") else "?")
for name, adder in (("yearly", asset.add_batch_definition_yearly), ("monthly", asset.add_batch_definition_monthly), ("daily", asset.add_batch_definition_daily)):
    bdef = adder(name, column="day")
    ids = bdef.get_batch_identifiers_list()
    print(f"  {name}: {len(ids)} batches, identifiers = {ids}")
daily = asset.add_batch_definition_daily("daily2", column="day")
attempt("daily, no parameters (last one)", lambda: daily.get_batch().batch_spec.get("partitioner_method"))
b = daily.get_batch(batch_parameters={"year": 2024, "month": 2, "day": 1})
print("  daily 2024-02-01 -> rows in batch:", len(b.head(n_rows=100, fetch_all=True).data))

print("\n--- 2. files that do not match the regex ---")
folder = Path(tempfile.mkdtemp(prefix="gx_files_"))
for name in ("data_2024-01-31.csv", "data_2024-02-01.csv", "data_2024-02-10.csv", "data_2023-12-31.csv", "backup_data_2024-03-01.csv", "data_2024-03-01.csv.bak", "notes.txt"):
    pd.DataFrame({"v": [1]}).to_csv(folder / name, index=False)
fs = context.data_sources.add_pandas_filesystem("files", base_directory=folder)
csv = fs.add_csv_asset("daily")
by_day = csv.add_batch_definition_daily("by_day", regex=r"data_(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})\.csv")
ids = by_day.get_batch_identifiers_list()
print("  files in folder:", sorted(p.name for p in folder.iterdir()))
print("  batches seen   :")
for i in ids:
    print("    ", i)
attempt("no parameters (the last batch)", lambda: by_day.get_batch().batch_spec.get("path", "")[-32:])
anchored = csv.add_batch_definition_daily("anchored", regex=r"^data_(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})\.csv$")
print("  anchored regex sees:", [f"{i['year']}-{i['month']}-{i['day']}" for i in anchored.get_batch_identifiers_list()])
attempt("anchored, no parameters", lambda: anchored.get_batch().batch_spec.get("path", "")[-24:])

print("\n--- 3. an empty folder ---")
empty = Path(tempfile.mkdtemp(prefix="gx_empty_"))
efs = context.data_sources.add_pandas_filesystem("empty", base_directory=empty)
attempt("add_csv_asset on an empty folder", lambda: efs.add_csv_asset("none"))
(empty / "x.txt").write_text("a", encoding="utf-8")
nomatch = efs.add_csv_asset("nomatch")
nm = nomatch.add_batch_definition_daily("d", regex=r"^data_(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})\.csv$")
print("  folder has files but none match the regex: identifiers =", nm.get_batch_identifiers_list())
attempt("get_batch() with no matching file", lambda: nm.get_batch())

print("\n--- 4. reader options on a CSV asset ---")
semi = Path(tempfile.mkdtemp(prefix="gx_semi_"))
(semi / "x.csv").write_text("a;b\n1;2\n3;4\n", encoding="utf-8")
sfs = context.data_sources.add_pandas_filesystem("semi", base_directory=semi)
plain = sfs.add_csv_asset("plain").add_batch_definition_path("p", path="x.csv").get_batch()
print("  default reader columns :", list(plain.data.dataframe.columns))
with_sep = sfs.add_csv_asset("withsep", sep=";").add_batch_definition_path("p", path="x.csv").get_batch()
print("  sep=';' reader columns :", list(with_sep.data.dataframe.columns))

print("\n--- 5. batch.validate(expectation): check one rule without a suite ---")
res = with_sep.validate(gxe.ExpectColumnValuesToBeBetween(column="a", min_value=0, max_value=2))
print("  type:", type(res).__name__, "| success:", res.success, "| unexpected_count:", res.result.get("unexpected_count"))
suite = gx.ExpectationSuite(name="adhoc")
suite.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="b"))
res2 = with_sep.validate(suite)
print("  with an ExpectationSuite not added to the context:", type(res2).__name__, "| success:", res2.success)

print("\n--- 6. does batch.validate store its result? ---")
before = len(context.validation_results_store.list_keys())
with_sep.validate(suite)
after = len(context.validation_results_store.list_keys())
print("  results store before/after batch.validate(suite):", before, after)
print("  expectation.id of the suite not in a context:", suite.id)
