"""Lesson: metrics-engines and spark-sql-backends. How many queries does a suite cost on a SQL backend?

Uses SQLite so nothing needs installing. The same mechanism (aggregate metrics in one domain are bundled into
one statement) is what the Spark engine does with a single `df.agg(...).collect()`, read from the source.

Run: uv run python 05_sql_bundling.py
"""

import sqlite3
import tempfile
from pathlib import Path

import great_expectations as gx
import great_expectations.expectations as gxe
from great_expectations.core.result_format import ResultFormat
from great_expectations.execution_engine import SqlAlchemyExecutionEngine

import gxlab  # noqa: F401  (silences warnings)

db = Path(tempfile.mkdtemp(prefix="gx_sql_")) / "t.db"
connection = sqlite3.connect(db)
connection.execute("create table users (id int, age real, name text)")
connection.executemany(
    "insert into users values (?,?,?)", [(1, 10.0, "a"), (2, None, "b"), (3, 30.0, None), (4, 400.0, "d")]
)
connection.commit()
connection.close()

statements: list[str] = []
original = SqlAlchemyExecutionEngine.execute_query


def spy(self, query):
    statements.append(" ".join(str(query.compile(compile_kwargs={"literal_binds": True})).split()))
    return original(self, query)


SqlAlchemyExecutionEngine.execute_query = spy

context = gx.get_context()
source = context.data_sources.add_sqlite("sqlite", connection_string=f"sqlite:///{db}")
batch_definition = source.add_table_asset("users", table_name="users").add_batch_definition_whole_table("whole")
suite = context.suites.add(gx.ExpectationSuite(name="s"))
suite.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="id"))
suite.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="age"))
suite.add_expectation(gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=120))
suite.add_expectation(gxe.ExpectColumnMaxToBeBetween(column="age", min_value=0, max_value=120))
suite.add_expectation(gxe.ExpectColumnMeanToBeBetween(column="age", min_value=0, max_value=120))
suite.add_expectation(gxe.ExpectTableRowCountToEqual(value=4))
vd = gx.ValidationDefinition(name="vd", data=batch_definition, suite=suite)

for result_format in (ResultFormat.BOOLEAN_ONLY, ResultFormat.SUMMARY):
    statements.clear()
    vd.run(result_format=result_format)
    print(f"{result_format.value}: 6 expectations -> {len(statements)} SQL statements")
    if result_format == ResultFormat.BOOLEAN_ONLY:
        for statement in statements:
            print("   ", statement[:150])
