"""Lesson: datasources-batches. Partition files by date and choose which batch to validate, plus suite parameters.

Run: uv run python 04_batches.py
"""

import tempfile
from pathlib import Path

import great_expectations as gx
import great_expectations.expectations as gxe
import pandas as pd

import gxlab

folder = Path(tempfile.mkdtemp(prefix="gx_csv_"))
for day in (1, 2, 3):
    pd.DataFrame({"v": [day, day * 2]}).to_csv(folder / f"data_2024-01-0{day}.csv", index=False)

context = gx.get_context()
source = context.data_sources.add_pandas_filesystem("files", base_directory=folder)
asset = source.add_csv_asset("daily")
by_day = asset.add_batch_definition_daily(
    "by_day", regex=r"data_(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})\.csv"
)

print("batches GX can see:")
for identifier in by_day.get_batch_identifiers_list():
    print("  ", identifier)

print("\nno parameters -> the LAST batch (sorted ascending), not an error")
print("  values:", list(by_day.get_batch().data.dataframe["v"]))

print("\nexplicit parameters")
print("  day 02:", list(by_day.get_batch(batch_parameters={"year": 2024, "month": 1, "day": 2}).data.dataframe["v"]))

print("\na batch that does not exist")
try:
    by_day.get_batch(batch_parameters={"year": 2024, "month": 1, "day": 9})
except Exception as e:
    print("  raised:", type(e).__name__)

print("\nsuite parameters: the expected value arrives at run time")
suite = context.suites.add(gx.ExpectationSuite(name="rows"))
suite.add_expectation(gxe.ExpectTableRowCountToEqual(value={"$PARAMETER": "expected_rows"}))
frame_definition = gxlab.pandas_batch_definition(context, "params")
vd = gx.ValidationDefinition(name="vd_rows", data=frame_definition, suite=suite)
frame = pd.DataFrame({"x": [1, 2, 3]})
for expected in (3, 5):
    result = vd.run(batch_parameters={"dataframe": frame}, expectation_parameters={"expected_rows": expected})
    print(f"  expected_rows={expected}: success={result.success}")
