"""Measure real GX runs for every subset of a few expectations and every result format, and write them as JSON.

The metric-rounds lab on the website reads this file, so what it shows is what GX did, not a model of it.
Each record: which expectations, which result format, the metrics resolved in each round on pandas, and how many
SQL statements the same suite caused on SQLite.

Run: uv run python make_lab_data.py <output.json>
"""

import itertools
import json
import sqlite3
import sys
import tempfile
from pathlib import Path

import great_expectations as gx
import great_expectations.expectations as gxe
import pandas as pd
from great_expectations.core.result_format import ResultFormat
from great_expectations.execution_engine import ExecutionEngine, SqlAlchemyExecutionEngine

import gxlab  # noqa: F401

EXPECTATIONS = [
    ("not_null_id", "ExpectColumnValuesToNotBeNull(column='id')", lambda: gxe.ExpectColumnValuesToNotBeNull(column="id")),
    ("not_null_age", "ExpectColumnValuesToNotBeNull(column='age')", lambda: gxe.ExpectColumnValuesToNotBeNull(column="age")),
    ("between_age", "ExpectColumnValuesToBeBetween(column='age', 0..120)", lambda: gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=120)),
    ("unique_id", "ExpectColumnValuesToBeUnique(column='id')", lambda: gxe.ExpectColumnValuesToBeUnique(column="id")),
    ("max_age", "ExpectColumnMaxToBeBetween(column='age', 0..120)", lambda: gxe.ExpectColumnMaxToBeBetween(column="age", min_value=0, max_value=120)),
    ("mean_age", "ExpectColumnMeanToBeBetween(column='age', 0..120)", lambda: gxe.ExpectColumnMeanToBeBetween(column="age", min_value=0, max_value=120)),
    ("row_count", "ExpectTableRowCountToEqual(value=4)", lambda: gxe.ExpectTableRowCountToEqual(value=4)),
]
FORMATS = [ResultFormat.BOOLEAN_ONLY, ResultFormat.BASIC, ResultFormat.SUMMARY, ResultFormat.COMPLETE]

df = pd.DataFrame({"id": [1, 2, 3, 4], "age": [10, None, 30, 400]})
db = Path(tempfile.mkdtemp(prefix="gx_matrix_")) / "t.db"
connection = sqlite3.connect(db)
connection.execute("create table users (id int, age real)")
connection.executemany("insert into users values (?,?)", [(1, 10.0), (2, None), (3, 30.0), (4, 400.0)])
connection.commit()
connection.close()

rounds: list[list[str]] = []
statements: list[str] = []
_resolve = ExecutionEngine.resolve_metrics
_query = SqlAlchemyExecutionEngine.execute_query


def spy_resolve(self, metrics_to_resolve, metrics=None, runtime_configuration=None):
    names = sorted(m.metric_name for m in metrics_to_resolve)
    if names:
        rounds.append(names)
    return _resolve(self, metrics_to_resolve, metrics, runtime_configuration)


def spy_query(self, query):
    statements.append(" ".join(str(query.compile(compile_kwargs={"literal_binds": True})).split()))
    return _query(self, query)


ExecutionEngine.resolve_metrics = spy_resolve
SqlAlchemyExecutionEngine.execute_query = spy_query

context = gx.get_context()
pandas_bd = context.data_sources.add_pandas("p").add_dataframe_asset("a").add_batch_definition_whole_dataframe("w")
sql_bd = (
    context.data_sources.add_sqlite("s", connection_string=f"sqlite:///{db}")
    .add_table_asset("users", table_name="users")
    .add_batch_definition_whole_table("w")
)

records = []
for size in range(1, len(EXPECTATIONS) + 1):
    for combo in itertools.combinations(range(len(EXPECTATIONS)), size):
        key = "-".join(str(i) for i in combo)
        suite = context.suites.add(gx.ExpectationSuite(name=f"suite_{key}"))
        for i in combo:
            suite.add_expectation(EXPECTATIONS[i][2]())
        vd_pandas = gx.ValidationDefinition(name=f"vp_{key}", data=pandas_bd, suite=suite)
        vd_sql = gx.ValidationDefinition(name=f"vs_{key}", data=sql_bd, suite=suite)
        for result_format in FORMATS:
            rounds.clear()
            vd_pandas.run(batch_parameters={"dataframe": df}, result_format=result_format)
            pandas_rounds = [list(r) for r in rounds]
            statements.clear()
            rounds.clear()
            vd_sql.run(result_format=result_format)
            records.append(
                {
                    "key": f"{key}|{result_format.value}",
                    "pandasRounds": pandas_rounds,
                    "sqlStatements": len(statements),
                    "sqlFirst": [s[:160] for s in statements[:6]],
                }
            )
    print("done subsets of size", size, "records", len(records), flush=True)

# Compact form: metric names are stored once and rounds refer to them by index.
names: list[str] = sorted({n for r in records for rd in r["pandasRounds"] for n in rd})
index = {n: i for i, n in enumerate(names)}
out = {
    "version": gx.__version__,
    "expectations": [{"id": e[0], "label": e[1]} for e in EXPECTATIONS],
    "formats": [f.value for f in FORMATS],
    "metricNames": names,
    "records": {
        r["key"]: {
            "rounds": [[index[n] for n in rd] for rd in r["pandasRounds"]],
            "sql": r["sqlStatements"],
            "sqlFirst": [x[:140] for x in r["sqlFirst"][:4]],
        }
        for r in records
    },
}
Path(sys.argv[1]).parent.mkdir(parents=True, exist_ok=True)
Path(sys.argv[1]).write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
print("wrote", sys.argv[1], len(records), "records")
