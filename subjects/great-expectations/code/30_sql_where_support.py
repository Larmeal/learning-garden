"""Lesson: spark-sql-backends. The SQL that a daily batch really becomes, and which backends each built-in
expectation says it supports (SUPPORTED_DATA_SOURCES), read from the classes.

Run: uv run python 30_sql_where_support.py [output.json]
With an output path the support table is also written as JSON (used by the lookup lab in the lesson).
"""

import json
import sqlite3
import sys
import tempfile
import warnings
from collections import Counter
from pathlib import Path

import great_expectations as gx
import great_expectations.expectations as gxe
from great_expectations.core.result_format import ResultFormat
from great_expectations.execution_engine import SqlAlchemyExecutionEngine
from great_expectations.expectations.expectation import Expectation

import gxlab  # noqa: F401

warnings.filterwarnings("ignore")

print("--- 1. the SQL of a daily batch on SQLite ---")
db = Path(tempfile.mkdtemp(prefix="gx_where_")) / "t.db"
con = sqlite3.connect(db)
con.execute("create table sales (d text, amount real)")
con.executemany("insert into sales values (?,?)", [("2024-01-01", 5.0), ("2024-01-02", 7.0), ("2024-01-02", None), ("2024-01-03", 9.0)])
con.commit()
con.close()
statements: list[str] = []
original = SqlAlchemyExecutionEngine.execute_query


def spy(self, query):
    statements.append(" ".join(str(query.compile(dialect=self.engine.dialect, compile_kwargs={"literal_binds": True})).split()))
    return original(self, query)


SqlAlchemyExecutionEngine.execute_query = spy
context = gx.get_context()
asset = context.data_sources.add_sqlite("sq", connection_string=f"sqlite:///{db}").add_table_asset("sales", table_name="sales")
daily = asset.add_batch_definition_daily("daily", column="d")
suite = context.suites.add(gx.ExpectationSuite(name="s"))
suite.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="amount"))
vd = gx.ValidationDefinition(name="vd", data=daily, suite=suite)
statements.clear()
r = vd.run(batch_parameters={"year": 2024, "month": 1, "day": 2}, result_format=ResultFormat.BOOLEAN_ONLY)
print("success:", r.success, "| statements:", len(statements))
for q in statements:
    print("  ", q)

print("\n--- 2. SUPPORTED_DATA_SOURCES of the built-in expectations ---")
rows = {}
for name in dir(gxe):
    obj = getattr(gxe, name)
    if isinstance(obj, type) and issubclass(obj, Expectation) and obj is not Expectation:
        # SUPPORTED_DATA_SOURCES is a module-level list in each expectation's file (it feeds the docstring)
        sup = getattr(sys.modules[obj.__module__], "SUPPORTED_DATA_SOURCES", None)
        if sup:
            rows[name] = sorted(str(s) for s in sup)
print("expectation classes whose module has a SUPPORTED_DATA_SOURCES list:", len(rows))
counter = Counter(s for v in rows.values() for s in v)
for k, v in counter.most_common():
    print(f"  {k:14} {v}")
no_spark = sorted(n for n, v in rows.items() if "Spark" not in v)
print("without Spark:", len(no_spark), no_spark[:6])
print("sample:", {k: rows[k] for k in ("ExpectColumnValuesToNotBeNull", "ExpectColumnValuesToMatchRegex")})
if len(sys.argv) > 1:
    sources = sorted(counter)
    payload = {"version": gx.__version__, "sources": sources, "names": sorted(rows), "bits": [sum(1 << i for i, s in enumerate(sources) if s in rows[n]) for n in sorted(rows)]}
    Path(sys.argv[1]).write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print("wrote", sys.argv[1])
