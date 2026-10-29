"""Lesson: metrics-engines. Watch which metrics the engine computes, in which round.

Run: uv run python 02_metric_rounds.py
"""

import great_expectations as gx
import great_expectations.expectations as gxe
import pandas as pd
from great_expectations.core.result_format import ResultFormat

import gxlab

calls = gxlab.spy_on_metric_rounds()
df = pd.DataFrame({"id": [1, 2, 3, 4], "age": [10, None, 30, 400], "name": ["a", "b", None, "d"]})

context = gx.get_context()
batch_definition = gxlab.pandas_batch_definition(context, "m")
suite = context.suites.add(gx.ExpectationSuite(name="s"))
suite.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="id"))
suite.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="age"))
suite.add_expectation(gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=120))
suite.add_expectation(gxe.ExpectColumnMaxToBeBetween(column="age", min_value=0, max_value=120))
suite.add_expectation(gxe.ExpectTableRowCountToEqual(value=4))
vd = gx.ValidationDefinition(name="vd", data=batch_definition, suite=suite)

print("engine calls before any run:", len(calls))  # 0: building objects computes nothing

print("\n--- rounds for one run (default result format is SUMMARY) ---")
vd.run(batch_parameters={"dataframe": df})
for i, names in enumerate(calls):
    print(f"round {i}: {len(names)} metrics {names}")

print("\n--- result_format changes how many metrics are computed ---")
for result_format in (ResultFormat.BOOLEAN_ONLY, ResultFormat.BASIC, ResultFormat.SUMMARY, ResultFormat.COMPLETE):
    calls.clear()
    vd.run(batch_parameters={"dataframe": df}, result_format=result_format)
    print(f"{result_format.value:13s} rounds={len(calls)} metrics={sum(len(c) for c in calls)}")

print("\n--- the same metric is computed once, however many expectations ask for it ---")
calls.clear()
s2 = context.suites.add(gx.ExpectationSuite(name="three_not_null"))
for column in ("id", "age", "name"):
    s2.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column=column))
gx.ValidationDefinition(name="vd2", data=batch_definition, suite=s2).run(
    batch_parameters={"dataframe": df}, result_format=ResultFormat.BOOLEAN_ONLY
)
for i, names in enumerate(calls):
    print(f"round {i}: {names}")

print("\n--- a second run recomputes everything ---")
calls.clear()
vd.run(batch_parameters={"dataframe": df})
first = sum(len(c) for c in calls)
calls.clear()
vd.run(batch_parameters={"dataframe": df})
print(f"metrics resolved: first={first} second={sum(len(c) for c in calls)}")
