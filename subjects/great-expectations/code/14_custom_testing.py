"""Lesson: custom-expectations, testing before you ship. The same condition on different data shapes and engines.

  1. a table of cases: normal, some bad, empty, only nulls, text instead of numbers, on pandas and SQLite
  2. the built-in harness: `examples` + `run_diagnostics()`
  3. a CI guard: compare the JSON on disk with what a fresh process loads

Run: uv run python 14_custom_testing.py
"""

import io
import contextlib
import sqlite3
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

import great_expectations as gx
import pandas as pd
from great_expectations.data_context.types.base import ProgressBarsConfig
from great_expectations.execution_engine import PandasExecutionEngine, SqlAlchemyExecutionEngine
from great_expectations.expectations.expectation import ColumnMapExpectation
from great_expectations.expectations.metrics import ColumnMapMetricProvider, column_condition_partial

import gxlab  # noqa: F401  (prints the version, silences warnings)


class ColumnValuesAreEven(ColumnMapMetricProvider):
    condition_metric_name = "column_values.are_even"

    @column_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column, **kwargs):
        return column % 2 == 0

    @column_condition_partial(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy(cls, column, **kwargs):
        return column % 2 == 0


class ExpectColumnValuesToBeEven(ColumnMapExpectation):
    map_metric = "column_values.are_even"
    args_keys = ("column",)

    examples = [
        {
            "data": {"n": [2, 4, 7]},
            "tests": [
                {"title": "one odd value", "exact_match_out": False, "include_in_gallery": True, "in": {"column": "n"}, "out": {"success": False}},
                {"title": "mostly lets it pass", "exact_match_out": False, "include_in_gallery": True, "in": {"column": "n", "mostly": 0.6}, "out": {"success": True}},
            ],
        }
    ]


context = gx.get_context()
context.variables.progress_bars = ProgressBarsConfig(globally=False)

CASES = {
    "normal": [2, 4, 6],
    "some bad": [2, 4, 6, 7, 11],
    "empty": [],
    "only nulls": [None, None],
    "text": ["a", "bb", "c"],
}

db = Path(tempfile.mkdtemp(prefix="gx_testing_")) / "t.db"
con = sqlite3.connect(db)
sql_source = context.data_sources.add_sqlite("sq", connection_string=f"sqlite:///{db}")


def verdict(r):
    if r.exception_info.get("raised_exception") or (not r.success and not r.result):
        info = r.exception_info
        msg = info.get("exception_message") or next(iter(info.values()))["exception_message"]
        return f"error: {msg.splitlines()[0][:60]}"
    return f"{'pass' if r.success else 'fail'} (unexpected={r.result['unexpected_count']})"


print("--- 1. the same condition, five data shapes, two engines ---")
print(f"  {'case':11} {'pandas':34} sqlite")
for i, (label, values) in enumerate(CASES.items()):
    frame = pd.DataFrame({"n": pd.Series(values, dtype="object" if label in ("text", "only nulls") else "float64" if None in values else "int64")})
    suite = context.suites.add(gx.ExpectationSuite(name=f"s{i}"))
    suite.add_expectation(ExpectColumnValuesToBeEven(column="n"))
    pandas_r = gx.ValidationDefinition(name=f"p{i}", data=gxlab.pandas_batch_definition(context, f"t{i}"), suite=suite).run(
        batch_parameters={"dataframe": frame}).results[0]

    con.execute(f"drop table if exists t{i}")
    con.execute(f"create table t{i} (n)")  # no declared type: SQLite keeps whatever it is given
    con.executemany(f"insert into t{i} values (?)", [(v,) for v in values])
    con.commit()
    bd = sql_source.add_table_asset(f"t{i}", table_name=f"t{i}").add_batch_definition_whole_table("w")
    sql_r = gx.ValidationDefinition(name=f"q{i}", data=bd, suite=suite).run().results[0]
    print(f"  {label:11} {verdict(pandas_r):34} {verdict(sql_r)}")
con.close()

print("\n--- 2. the built-in harness ---")
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    diagnostics = ExpectColumnValuesToBeEven(column="n").run_diagnostics()
for t in diagnostics.tests:
    print(f"  {t.test_title!r} on {t.backend}: passed={t.test_passed}")
print("  backend_test_result_counts:", [(c.backend, c.num_passed, c.num_failed) for c in diagnostics.backend_test_result_counts])

print("\n--- 3. CI guard: expectations on disk vs expectations a fresh process loads ---")
GUARD = textwrap.dedent(
    '''
    import json, sys, warnings; warnings.filterwarnings("ignore")
    import logging; logging.disable(logging.CRITICAL)
    import great_expectations as gx
    context = gx.get_context(mode="file", project_root_dir=sys.argv[1])
    for path in sorted((__import__("pathlib").Path(sys.argv[1]) / "gx" / "expectations").glob("*.json")):
        on_disk = len(json.loads(path.read_text())["expectations"])
        loaded = len(context.suites.get(path.stem).expectations)
        print(f"  suite {path.stem}: {on_disk} on disk, {loaded} loaded ->", "ok" if on_disk == loaded else "MISSING CLASSES")
    '''
)
SAVE = textwrap.dedent(
    '''
    import sys, warnings; warnings.filterwarnings("ignore")
    import great_expectations as gx
    from great_expectations.execution_engine import PandasExecutionEngine
    from great_expectations.expectations.expectation import ColumnMapExpectation
    from great_expectations.expectations.metrics import ColumnMapMetricProvider, column_condition_partial
    class Even(ColumnMapMetricProvider):
        condition_metric_name = "column_values.are_even"
        @column_condition_partial(engine=PandasExecutionEngine)
        def _pandas(cls, column, **kwargs):
            return column % 2 == 0
    class ExpectColumnValuesToBeEven(ColumnMapExpectation):
        map_metric = "column_values.are_even"
        args_keys = ("column",)
    context = gx.get_context(mode="file", project_root_dir=sys.argv[1])
    suite = context.suites.add(gx.ExpectationSuite(name="mixed"))
    suite.add_expectation(ExpectColumnValuesToBeEven(column="n"))
    suite.add_expectation(gx.expectations.ExpectColumnValuesToNotBeNull(column="n"))
    '''
)
project = tempfile.mkdtemp(prefix="gx_guard_")
subprocess.run([sys.executable, "-c", SAVE, project], capture_output=True, text=True)
out = subprocess.run([sys.executable, "-c", GUARD, project], capture_output=True, text=True)
print(out.stdout.strip())
