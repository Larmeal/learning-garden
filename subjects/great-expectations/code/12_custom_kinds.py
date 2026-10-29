"""Lesson: custom-expectations, the other shapes. One custom expectation of each kind besides column-map.

  A. column aggregate, reusing metrics GX already has (max - min must stay narrow)
  B. column aggregate with a new metric (share of values above a threshold), pandas and SQL
  C. column pair map (discount must be at most half of the price)
  D. multicolumn map (exactly one of several columns is filled)
  E. UnexpectedRowsExpectation, the "no custom code" route: a SQL query that must return zero rows

Run: uv run python 12_custom_kinds.py
"""

import sqlite3
import tempfile
from pathlib import Path
from typing import ClassVar, Literal

import great_expectations as gx
import pandas as pd
from great_expectations.compatibility.sqlalchemy import sqlalchemy as sa
from great_expectations.data_context.types.base import ProgressBarsConfig
from great_expectations.execution_engine import PandasExecutionEngine, SqlAlchemyExecutionEngine
from great_expectations.expectations import UnexpectedRowsExpectation
from great_expectations.expectations.expectation import (
    ColumnAggregateExpectation,
    ColumnPairMapExpectation,
    MulticolumnMapExpectation,
)
from great_expectations.expectations.metrics import ColumnAggregateMetricProvider, column_aggregate_partial, column_aggregate_value
from great_expectations.expectations.metrics.map_metric_provider import (
    ColumnPairMapMetricProvider,
    MulticolumnMapMetricProvider,
    column_pair_condition_partial,
    multicolumn_condition_partial,
)

import gxlab  # noqa: F401  (prints the version, silences warnings)


# --- A. aggregate expectation built from metrics that already exist ---------------------------------------------
class ExpectColumnRangeToBeNarrow(ColumnAggregateExpectation):
    max_width: float

    metric_dependencies: ClassVar[tuple] = ("column.min", "column.max")
    success_keys: ClassVar[tuple] = ("max_width",)
    args_keys: ClassVar[tuple] = ("column", "max_width")

    def _validate(self, metrics, runtime_configuration=None, execution_engine=None):
        lo, hi = metrics["column.min"], metrics["column.max"]
        width = hi - lo
        return {"success": bool(width <= self.max_width), "result": {"observed_value": width}}


# --- B. aggregate expectation with a metric of its own ---------------------------------------------------------
class ColumnShareAbove(ColumnAggregateMetricProvider):
    metric_name = "column.share_above"
    value_keys = ("threshold",)

    @column_aggregate_value(engine=PandasExecutionEngine)
    def _pandas(cls, column, threshold, **kwargs):
        return float((column > threshold).mean())

    @column_aggregate_partial(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy(cls, column, threshold, **kwargs):
        return sa.func.avg(sa.case((column > threshold, 1.0), else_=0.0))


class ExpectColumnShareAboveToBeAtMost(ColumnAggregateExpectation):
    threshold: float
    max_share: float

    metric_dependencies: ClassVar[tuple] = ("column.share_above",)
    success_keys: ClassVar[tuple] = ("threshold", "max_share")
    args_keys: ClassVar[tuple] = ("column", "threshold", "max_share")

    def _validate(self, metrics, runtime_configuration=None, execution_engine=None):
        share = metrics["column.share_above"]
        return {"success": bool(share <= self.max_share), "result": {"observed_value": share}}


# --- C. column pair map ----------------------------------------------------------------------------------------
class ColumnPairAIsAtMostHalfOfB(ColumnPairMapMetricProvider):
    condition_metric_name = "column_pair_values.a_at_most_half_of_b"
    condition_domain_keys = ("batch_id", "table", "column_A", "column_B", "row_condition", "condition_parser", "ignore_row_if")

    @column_pair_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column_A, column_B, **kwargs):
        return column_A <= 0.5 * column_B

    @column_pair_condition_partial(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy(cls, column_A, column_B, **kwargs):
        return column_A <= 0.5 * column_B


class ExpectColumnPairValuesAToBeAtMostHalfOfB(ColumnPairMapExpectation):
    # The metric's domain includes ignore_row_if, so the expectation has to carry a value for it.
    ignore_row_if: Literal["both_values_are_missing", "either_value_is_missing", "neither"] = "both_values_are_missing"

    map_metric: ClassVar[str] = "column_pair_values.a_at_most_half_of_b"
    success_keys: ClassVar[tuple] = ("column_A", "column_B", "ignore_row_if", "mostly")
    args_keys: ClassVar[tuple] = ("column_A", "column_B")


class ExpectColumnPairValuesAToBeAtMostHalfOfBForgotIgnoreRow(ColumnPairMapExpectation):
    """Same metric, but the class does not declare ignore_row_if: the mistake worth seeing once."""

    map_metric: ClassVar[str] = "column_pair_values.a_at_most_half_of_b"
    args_keys: ClassVar[tuple] = ("column_A", "column_B")


# --- D. multicolumn map ----------------------------------------------------------------------------------------
class MulticolumnExactlyOneFilled(MulticolumnMapMetricProvider):
    condition_metric_name = "multicolumn_values.exactly_one_filled"
    condition_domain_keys = ("batch_id", "table", "column_list", "row_condition", "condition_parser", "ignore_row_if")

    @multicolumn_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column_list, **kwargs):
        return column_list.notnull().sum(axis=1) == 1


class ExpectSelectColumnsToHaveExactlyOneFilled(MulticolumnMapExpectation):
    map_metric: ClassVar[str] = "multicolumn_values.exactly_one_filled"
    args_keys: ClassVar[tuple] = ("column_list",)


context = gx.get_context()
context.variables.progress_bars = ProgressBarsConfig(globally=False)


def run(tag, expectation, frame=None, batch_definition=None):
    bd = batch_definition or gxlab.pandas_batch_definition(context, tag)
    suite = context.suites.add(gx.ExpectationSuite(name=tag))
    suite.add_expectation(expectation)
    vd = gx.ValidationDefinition(name=f"vd_{tag}", data=bd, suite=suite)
    params = {"batch_parameters": {"dataframe": frame}} if frame is not None else {}
    return vd.run(**params).results[0]


def show(label, r):
    if r.exception_info.get("raised_exception"):
        print(f"  {label}: success={r.success} raised: {r.exception_info['exception_message'].splitlines()[0][:150]}")
    else:
        res = {k: v for k, v in r.result.items() if k in ("observed_value", "unexpected_count", "partial_unexpected_list", "element_count", "missing_count")}
        print(f"  {label}: success={r.success} {res}")


db = Path(tempfile.mkdtemp(prefix="gx_kinds_")) / "t.db"
con = sqlite3.connect(db)
con.execute("create table orders (id int, price real, discount real, amount real, card text, paypal text)")
rows = [
    (1, 100.0, 20.0, 50.0, "c1", None),
    (2, 80.0, 50.0, 12000.0, None, "p1"),
    (3, 60.0, 10.0, 700.0, "c3", "p3"),
    (4, 40.0, 5.0, 90.0, None, None),
]
con.executemany("insert into orders values (?,?,?,?,?,?)", rows)
con.commit()
con.close()
sql_source = context.data_sources.add_sqlite("sq", connection_string=f"sqlite:///{db}")
sql_bd = sql_source.add_table_asset("orders", table_name="orders").add_batch_definition_whole_table("w")
orders = pd.DataFrame(rows, columns=["id", "price", "discount", "amount", "card", "paypal"])

print("--- A. range width (max - min), metrics that GX already has ---")
show("pandas, width 50 allowed ", run("a1", ExpectColumnRangeToBeNarrow(column="amount", max_width=50), orders))
show("pandas, width 20000      ", run("a2", ExpectColumnRangeToBeNarrow(column="amount", max_width=20000), orders))
show("sqlite (no new metric)   ", run("a3", ExpectColumnRangeToBeNarrow(column="amount", max_width=20000), batch_definition=sql_bd))

print("\n--- B. share of amounts above 500, a metric we define ---")
show("pandas, max_share 0.5 ", run("b1", ExpectColumnShareAboveToBeAtMost(column="amount", threshold=500, max_share=0.5), orders))
show("pandas, max_share 0.25", run("b2", ExpectColumnShareAboveToBeAtMost(column="amount", threshold=500, max_share=0.25), orders))
show("sqlite, max_share 0.25", run("b3", ExpectColumnShareAboveToBeAtMost(column="amount", threshold=500, max_share=0.25), batch_definition=sql_bd))

print("\n--- C. discount must be at most half of the price ---")
show("pandas", run("c1", ExpectColumnPairValuesAToBeAtMostHalfOfB(column_A="discount", column_B="price"), orders))
show("sqlite", run("c2", ExpectColumnPairValuesAToBeAtMostHalfOfB(column_A="discount", column_B="price"), batch_definition=sql_bd))
forgot = run("c3", ExpectColumnPairValuesAToBeAtMostHalfOfBForgotIgnoreRow(column_A="discount", column_B="price"), orders)
print("  forgot ignore_row_if: success =", forgot.success, "| result =", forgot.result, "| entries in exception_info =", len(forgot.exception_info))
print("   ", next(iter(forgot.exception_info.values()))["exception_message"].splitlines()[0])

print("\n--- D. exactly one of card / paypal is filled ---")
for ignore in ("all_values_are_missing", "never"):
    r = run(f"d_{ignore}", ExpectSelectColumnsToHaveExactlyOneFilled(column_list=["card", "paypal"], ignore_row_if=ignore), orders)
    show(f"ignore_row_if={ignore:22}", r)

print("\n--- E. UnexpectedRowsExpectation, no class to write ---")
query = "SELECT * FROM {batch} WHERE discount * 2 > price"
show("sqlite", run("e1", UnexpectedRowsExpectation(unexpected_rows_query=query), batch_definition=sql_bd))
show("pandas", run("e2", UnexpectedRowsExpectation(unexpected_rows_query=query), orders))
