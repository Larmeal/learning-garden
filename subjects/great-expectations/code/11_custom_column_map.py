"""Lesson: custom-expectations, deep dive on the column-map shape. What happens between the class definition and the result.

Prints, for one tiny expectation ("value is even"):
  1. what the registries hold after the classes are defined
  2. what the condition function really receives (nulls are removed before it runs)
  3. which metrics each result_format asks for
  4. the COMPLETE result, and the SQL that finds the bad rows
  5. edge cases: empty table, only nulls, nulls mixed in, and `filter_column_isnull = False`
  6. a condition that takes a parameter, and what happens when its key is missing from `success_keys`

Run: uv run python 11_custom_column_map.py
"""

import sqlite3
import tempfile
from pathlib import Path
from typing import ClassVar

import great_expectations as gx
import pandas as pd
from great_expectations.execution_engine import PandasExecutionEngine, SqlAlchemyExecutionEngine
from great_expectations.data_context.types.base import ProgressBarsConfig
from great_expectations.expectations import registry
from great_expectations.expectations.expectation import ColumnMapExpectation
from great_expectations.expectations.metrics import ColumnMapMetricProvider, column_condition_partial

import gxlab  # noqa: F401  (prints the version, silences warnings)

SEEN: list[list] = []  # what the pandas condition received, one list per call


class ColumnValuesAreEven(ColumnMapMetricProvider):
    condition_metric_name = "column_values.are_even"

    @column_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column, **kwargs):
        SEEN.append(column.tolist())
        return column % 2 == 0

    @column_condition_partial(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy(cls, column, **kwargs):
        return column % 2 == 0


class ExpectColumnValuesToBeEven(ColumnMapExpectation):
    map_metric = "column_values.are_even"
    args_keys = ("column",)


class ColumnValuesAreEvenNullsToo(ColumnMapMetricProvider):
    """Same condition, but nulls are handed to the function instead of being skipped."""

    condition_metric_name = "column_values.are_even_nulls_too"
    filter_column_isnull = False

    @column_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column, **kwargs):
        return column.notnull() & (column % 2 == 0)


class ExpectColumnValuesToBeEvenNotNull(ColumnMapExpectation):
    map_metric = "column_values.are_even_nulls_too"
    args_keys = ("column",)


context = gx.get_context()
context.variables.progress_bars = ProgressBarsConfig(globally=False)  # keep the printed output readable


def run(name, expectation, frame, **fmt):
    bd = gxlab.pandas_batch_definition(context, name)
    suite = context.suites.add(gx.ExpectationSuite(name=name))
    suite.add_expectation(expectation)
    vd = gx.ValidationDefinition(name=f"vd_{name}", data=bd, suite=suite)
    params = {"batch_parameters": {"dataframe": frame}}
    if fmt:
        params["result_format"] = fmt
    return vd.run(**params).results[0]


print("--- 1. registries after the class definitions ---")
print("expectation_type:", ExpectColumnValuesToBeEven.expectation_type)
print("is the class in the registry:", registry.get_expectation_impl("expect_column_values_to_be_even") is ExpectColumnValuesToBeEven)
metric_names = sorted(n for n in registry._registered_metrics if n.startswith("column_values.are_even."))
print("metrics registered for column_values.are_even:")
for n in metric_names:
    print("  ", n, "->", sorted(registry._registered_metrics[n]["providers"]))
print("abstract (no map_metric):", ColumnMapExpectation.is_abstract(), "| ours:", ExpectColumnValuesToBeEven.is_abstract())

print("\n--- 2. what the pandas condition receives ---")
frame = pd.DataFrame({"n": [2, 4, None, 7, None, 11]})
SEEN.clear()
r = run("seen", ExpectColumnValuesToBeEven(column="n"), frame)
print("rows in the table: 6, nulls: 2")
print("calls to the condition:", len(SEEN), "| values it got:", SEEN[0] if SEEN else None)
print("result:", {k: r.result[k] for k in ("element_count", "missing_count", "unexpected_count", "partial_unexpected_list")})

print("\n--- 3. metrics asked for, by result_format ---")
expectation = ExpectColumnValuesToBeEven(column="n")
for fmt in ("BOOLEAN_ONLY", "BASIC", "SUMMARY", "COMPLETE"):
    deps = expectation.get_validation_dependencies(runtime_configuration={"result_format": fmt})
    names = sorted(m.metric_name.removeprefix("column_values.") for m in deps.get_metric_configurations())
    print(f"{fmt:13}", len(names), names)

print("\n--- 3b. the rounds the validation graph needs, BASIC and COMPLETE (pandas, [2, 4, None, 7]) ---")
rounds = gxlab.spy_on_metric_rounds()
for fmt in ("BASIC", "COMPLETE"):
    rounds.clear()
    r = run(f"rounds_{fmt.lower()}", ExpectColumnValuesToBeEven(column="n"), pd.DataFrame({"n": [2, 4, None, 7]}), result_format=fmt)
    print(f"{fmt}: success={r.success}")
    for i, names in enumerate(rounds):
        print(f"  round {i}:", [n.removeprefix("column_values.") for n in names])
    print("  result:", {k: r.result.get(k) for k in ("element_count", "missing_count", "unexpected_count", "partial_unexpected_list")})

print("\n--- 4. COMPLETE result ---")
r = run("complete", ExpectColumnValuesToBeEven(column="n"), pd.DataFrame({"n": [2, 4, 6, 7, 10, 11]}), result_format="COMPLETE")
for key in ("element_count", "unexpected_count", "unexpected_percent", "unexpected_percent_nonmissing", "partial_unexpected_list",
            "partial_unexpected_index_list", "partial_unexpected_counts", "unexpected_list", "unexpected_index_list", "unexpected_index_query"):
    print(f"  {key}: {r.result.get(key)}")

db = Path(tempfile.mkdtemp(prefix="gx_cm_")) / "t.db"
con = sqlite3.connect(db)
con.execute("create table numbers (n int)")
con.executemany("insert into numbers values (?)", [(v,) for v in [2, 4, None, 7, 10, 11]])
con.commit()
con.close()
sql_bd = (
    context.data_sources.add_sqlite("sq", connection_string=f"sqlite:///{db}")
    .add_table_asset("numbers", table_name="numbers")
    .add_batch_definition_whole_table("w")
)
suite = context.suites.add(gx.ExpectationSuite(name="sqlsuite"))
suite.add_expectation(ExpectColumnValuesToBeEven(column="n"))
sql_r = gx.ValidationDefinition(name="vd_sql", data=sql_bd, suite=suite).run(result_format={"result_format": "COMPLETE"}).results[0]
print("\nSQLite, the same expectation:")
print("  unexpected_list:", sql_r.result["unexpected_list"], "| missing_count:", sql_r.result["missing_count"])
print("  unexpected_index_query:", sql_r.result.get("unexpected_index_query"))

print("\n--- 5. edge cases (success, element_count, missing_count, unexpected_count) ---")
cases = {
    "empty table": pd.DataFrame({"n": pd.Series([], dtype="int64")}),
    "only nulls": pd.DataFrame({"n": [None, None, None]}),
    "all even": pd.DataFrame({"n": [2, 4, 6]}),
    "nulls mixed": pd.DataFrame({"n": [2, None, 7, None]}),
}
for label, df in cases.items():
    r = run(f"edge_{label.replace(' ', '_')}", ExpectColumnValuesToBeEven(column="n"), df)
    print(f"  {label:12} success={r.success} element={r.result.get('element_count')} missing={r.result.get('missing_count')} "
          f"unexpected={r.result.get('unexpected_count')}")

print("\n--- filter_column_isnull = False: the function sees the nulls, and the counts stop adding up ---")
mixed = cases["nulls mixed"]
for label, exp in {"default (nulls skipped)": ExpectColumnValuesToBeEven(column="n"),
                   "filter_column_isnull = False": ExpectColumnValuesToBeEvenNotNull(column="n")}.items():
    r = run(f"nn_{len(label)}", exp, mixed)
    if r.exception_info.get("raised_exception"):
        first = r.exception_info["exception_message"].splitlines()[0]
        print(f"  {label:30} success={r.success} raised: {first}")
        print("  " + " " * 30 + "(the result it tried to build had unexpected_count=3 on 2 non-null rows, unexpected_percent 150.0)")
    else:
        print(f"  {label:30} success={r.success} unexpected={r.result['unexpected_count']} values={r.result['partial_unexpected_list']}")

print("\n--- 6. a condition with a parameter ---")


class ColumnValuesDivisibleBy(ColumnMapMetricProvider):
    condition_metric_name = "column_values.divisible_by"
    condition_value_keys = ("divisor",)

    @column_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column, divisor, **kwargs):
        return column % divisor == 0


class ExpectColumnValuesToBeDivisibleBy(ColumnMapExpectation):
    divisor: int
    map_metric: ClassVar[str] = "column_values.divisible_by"
    success_keys: ClassVar[tuple] = ("mostly", "divisor")  # a parameter the metric reads must be listed here
    args_keys: ClassVar[tuple] = ("column", "divisor")


class ExpectDivisibleByForgotSuccessKey(ColumnMapExpectation):
    divisor: int
    map_metric: ClassVar[str] = "column_values.divisible_by"
    args_keys: ClassVar[tuple] = ("column", "divisor")


multiples = pd.DataFrame({"n": [5, 10, 15, 22, 30]})
for i, (label, exp) in enumerate({
    "divisor=5": ExpectColumnValuesToBeDivisibleBy(column="n", divisor=5),
    "divisor=3": ExpectColumnValuesToBeDivisibleBy(column="n", divisor=3),
    "divisor=5, divisor missing from success_keys": ExpectDivisibleByForgotSuccessKey(column="n", divisor=5),
}.items()):
    r = run(f"div_{i}", exp, multiples)
    if r.result:
        print(f"  {label}: success={r.success} unexpected={r.result['unexpected_count']} values={r.result['partial_unexpected_list']}")
    else:
        message = next(iter(r.exception_info.values()))["exception_message"].splitlines()[0]
        print(f"  {label}: success={r.success} result={r.result} error: {message}")
