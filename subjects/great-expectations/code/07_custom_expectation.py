"""Lesson: custom-expectations. A column-map expectation written from one boolean condition per engine.

The condition says, for every row, whether the value is fine. GX derives the counts, the unexpected values and the
index lists from it. The same class then runs on pandas and on SQL.

Run: uv run python 07_custom_expectation.py
"""

import sqlite3
import tempfile
from pathlib import Path

import great_expectations as gx
import pandas as pd
import sqlalchemy as sa
from great_expectations.execution_engine import PandasExecutionEngine, SqlAlchemyExecutionEngine
from great_expectations.expectations.expectation import ColumnMapExpectation
from great_expectations.expectations.metrics import ColumnMapMetricProvider, column_condition_partial

import gxlab  # noqa: F401  (prints the version, silences warnings)


class ColumnValuesAreEven(ColumnMapMetricProvider):
    """The metric: one boolean per row. `condition_metric_name` is the name expectations refer to."""

    condition_metric_name = "column_values.are_even"

    @column_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column, **kwargs):
        return column % 2 == 0

    @column_condition_partial(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy(cls, column, **kwargs):
        return column % 2 == 0


class ExpectColumnValuesToBeEven(ColumnMapExpectation):
    """The expectation: it only names the metric. Registered automatically when the class is defined."""

    map_metric = "column_values.are_even"
    args_keys = ("column",)


numbers = pd.DataFrame({"n": [2, 4, 6, 7, 10, 11]})

context = gx.get_context()

print("--- pandas ---")
pandas_bd = context.data_sources.add_pandas("p").add_dataframe_asset("a").add_batch_definition_whole_dataframe("w")
suite = context.suites.add(gx.ExpectationSuite(name="even"))
suite.add_expectation(ExpectColumnValuesToBeEven(column="n"))
vd = gx.ValidationDefinition(name="vd_pandas", data=pandas_bd, suite=suite)
result = vd.run(batch_parameters={"dataframe": numbers}).results[0]
print("success:", result.success)
print("unexpected_count:", result.result["unexpected_count"], "| values:", result.result["partial_unexpected_list"])

print("\n--- mostly=0.6 allows 2 odd numbers out of 6 ---")
loose = context.suites.add(gx.ExpectationSuite(name="even_mostly"))
loose.add_expectation(ExpectColumnValuesToBeEven(column="n", mostly=0.6))
print("success:", gx.ValidationDefinition(name="vd_mostly", data=pandas_bd, suite=loose).run(
    batch_parameters={"dataframe": numbers}).success)

print("\n--- the same class on SQLite ---")
db = Path(tempfile.mkdtemp(prefix="gx_custom_")) / "t.db"
connection = sqlite3.connect(db)
connection.execute("create table numbers (n int)")
connection.executemany("insert into numbers values (?)", [(v,) for v in numbers["n"]])
connection.commit()
connection.close()
sql_bd = (
    context.data_sources.add_sqlite("s", connection_string=f"sqlite:///{db}")
    .add_table_asset("numbers", table_name="numbers")
    .add_batch_definition_whole_table("w")
)
sql_result = gx.ValidationDefinition(name="vd_sql", data=sql_bd, suite=suite).run().results[0]
print("success:", sql_result.success, "| unexpected_count:", sql_result.result["unexpected_count"])
