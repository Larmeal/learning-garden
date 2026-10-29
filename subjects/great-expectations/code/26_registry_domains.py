"""Lesson: metrics-engines. The metric registry as data, what a domain does to SQL bundling (row_condition),
and what happens when a metric function keeps failing.

Run: uv run python 26_registry_domains.py [output.json]
With an output path the registry table is also written as JSON (used by the lookup lab in the lesson).
"""

import json
import sqlite3
import sys
import tempfile
import warnings
from pathlib import Path

import great_expectations as gx
import great_expectations.expectations as gxe
from great_expectations.core.result_format import ResultFormat
from great_expectations.execution_engine import PandasExecutionEngine, SparkDFExecutionEngine, SqlAlchemyExecutionEngine
from great_expectations.expectations import registry

import gxlab  # noqa: F401

warnings.filterwarnings("ignore")

print("--- 1. the registry as a table ---")
ENGINES = {"pandas": "PandasExecutionEngine", "sql": "SqlAlchemyExecutionEngine", "spark": "SparkDFExecutionEngine"}
table = {}
for name, entry in registry._registered_metrics.items():
    providers = set(entry["providers"])
    table[name] = {k: (v in providers) for k, v in ENGINES.items()}
print("metric names registered:", len(table))
for k in ENGINES:
    print(f"  with a {k:6} implementation:", sum(1 for v in table.values() if v[k]))
print("  with all three:", sum(1 for v in table.values() if all(v.values())))
no_sql = sorted(n for n, v in table.items() if v["pandas"] and not v["sql"])
print("  pandas but no sql, first five:", no_sql[:5], "| count:", len(no_sql))
for name in ("column.max", "column_values.nonnull.condition", "table.row_count", "column.value_counts"):
    print(f"  {name:34}", table.get(name))
if len(sys.argv) > 1:
    names = sorted(table)
    bits = [int(table[n]["pandas"]) + 2 * int(table[n]["sql"]) + 4 * int(table[n]["spark"]) for n in names]
    Path(sys.argv[1]).write_text(json.dumps({"version": gx.__version__, "names": names, "bits": bits}, separators=(",", ":")), encoding="utf-8")
    print("wrote", sys.argv[1])

print("\n--- 2. row_condition splits the domain, so the SQL is not bundled across it ---")
db = Path(tempfile.mkdtemp(prefix="gx_dom_")) / "t.db"
con = sqlite3.connect(db)
con.execute("create table users (id int, age real, plan text)")
con.executemany("insert into users values (?,?,?)", [(1, 10.0, "free"), (2, 25.0, "pro"), (3, 30.0, "pro"), (4, 400.0, "free")])
con.commit()
con.close()
statements: list[str] = []
original = SqlAlchemyExecutionEngine.execute_query


def spy(self, query):
    statements.append(" ".join(str(query.compile(compile_kwargs={"literal_binds": True})).split()))
    return original(self, query)


SqlAlchemyExecutionEngine.execute_query = spy
context = gx.get_context()
bd = (
    context.data_sources.add_sqlite("sq", connection_string=f"sqlite:///{db}")
    .add_table_asset("users", table_name="users")
    .add_batch_definition_whole_table("whole")
)


def count(label, expectations):
    s = context.suites.add(gx.ExpectationSuite(name=label))
    for e in expectations:
        s.add_expectation(e)
    statements.clear()
    r = gx.ValidationDefinition(name=f"vd_{label}", data=bd, suite=s).run(result_format=ResultFormat.BOOLEAN_ONLY)
    print(f"  {label:34} statements={len(statements)} success={r.success}")
    return list(statements)


count("two on age, same domain", [gxe.ExpectColumnMaxToBeBetween(column="age", min_value=0, max_value=500), gxe.ExpectColumnMeanToBeBetween(column="age", min_value=0, max_value=500)])
st = count("max on age + max on age, pro only", [gxe.ExpectColumnMaxToBeBetween(column="age", min_value=0, max_value=500),
                                                  gxe.ExpectColumnMaxToBeBetween(column="age", min_value=0, max_value=500, row_condition='col("plan") == "pro"', condition_parser="great_expectations")])
for q in st:
    print("    ", q[:170])

print("\n--- 3. a row_condition parser that SQL does not support ---")
s = context.suites.add(gx.ExpectationSuite(name="bad_parser"))
s.add_expectation(gxe.ExpectColumnMaxToBeBetween(column="age", min_value=0, max_value=500, row_condition='plan == "pro"', condition_parser="pandas"))
r = gx.ValidationDefinition(name="vd_bad_parser", data=bd, suite=s).run(result_format=ResultFormat.BOOLEAN_ONLY).results[0]
msgs = [v.get("exception_message") for v in (r.exception_info or {}).values() if isinstance(v, dict) and v.get("raised_exception")]
print("  success:", r.success, "| exception:", (msgs[0] or "")[:150].replace(chr(10), " ") if msgs else None)

print("\n--- 4. how many times a failing metric function is tried ---")
from typing import ClassVar  # noqa: E402

import pandas as pd  # noqa: E402
from great_expectations.expectations.expectation import ColumnAggregateExpectation  # noqa: E402
from great_expectations.expectations.metrics import ColumnAggregateMetricProvider, column_aggregate_value  # noqa: E402

CALLS = [0]


class ColumnAlwaysFails(ColumnAggregateMetricProvider):
    metric_name = "column.always_fails"

    @column_aggregate_value(engine=PandasExecutionEngine)
    def _pandas(cls, column, **kwargs):
        CALLS[0] += 1
        raise RuntimeError("this metric never works")


class ExpectColumnAlwaysFails(ColumnAggregateExpectation):
    metric_dependencies: ClassVar[tuple] = ("column.always_fails",)
    args_keys = ("column",)

    def _validate(self, metrics, runtime_configuration=None, execution_engine=None):
        return {"success": True, "result": {"observed_value": metrics["column.always_fails"]}}


pbd = gxlab.pandas_batch_definition(context, "retry")
suite = context.suites.add(gx.ExpectationSuite(name="retry"))
suite.add_expectation(ExpectColumnAlwaysFails(column="x"))
suite.add_expectation(gxe.ExpectColumnMaxToBeBetween(column="x", min_value=0, max_value=10))
res = gx.ValidationDefinition(name="vd_retry", data=pbd, suite=suite).run(batch_parameters={"dataframe": pd.DataFrame({"x": [1, 2, 3]})})
print("  calls to the failing metric function:", CALLS[0])
for r in res.results:
    print(f"  {r.expectation_config.type[7:]:28} success={r.success} raised={any(isinstance(v, dict) and v.get('raised_exception') for v in (r.exception_info or {}).values())}")
