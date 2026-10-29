"""Lessons: reading-results, context-stores, validation-checkpoints. Behaviours that surprise people.

Run: uv run python 03_traps.py
"""

import great_expectations as gx
import great_expectations.expectations as gxe
import pandas as pd

import gxlab

df = pd.DataFrame({"id": [1, 2, 3, 4]})


def make(context, tag, expectations):
    batch_definition = gxlab.pandas_batch_definition(context, tag)
    suite = context.suites.add(gx.ExpectationSuite(name=f"suite_{tag}"))
    for e in expectations:
        suite.add_expectation(e)
    return gx.ValidationDefinition(name=f"vd_{tag}", data=batch_definition, suite=suite)


context = gx.get_context()

print("1. An empty table or an all-null column passes a column-map expectation")
vd = make(context, "empty", [gxe.ExpectColumnValuesToBeBetween(column="id", min_value=0, max_value=10)])
empty = pd.DataFrame({"id": pd.Series([], dtype="float64")})
all_null = pd.DataFrame({"id": [None, None, None]})
print("   empty    ->", vd.run(batch_parameters={"dataframe": empty}).success)
print("   all null ->", vd.run(batch_parameters={"dataframe": all_null}).success)
print("   (add ExpectTableRowCountToBeBetween if an empty table must fail)")

print("\n2. A broken expectation becomes a failed result, not an exception")
vd = make(
    context,
    "broken",
    [
        gxe.ExpectColumnValuesToNotBeNull(column="no_such_column"),
        gxe.ExpectColumnValuesToNotBeNull(column="id"),
    ],
)
result = vd.run(batch_parameters={"dataframe": df})
print("   suite success:", result.success, result.statistics)
for r in result.results:
    info = r.exception_info
    raised = bool(info) and (info.get("raised_exception") if "raised_exception" in info else True)
    print(f"   {r.expectation_config.kwargs['column']:15s} success={r.success!s:5s} has_exception={raised}")

print("\n3. Checkpoint.run does not raise when the data is bad: read .success")
checkpoint = context.checkpoints.add(gx.Checkpoint(name="cp", validation_definitions=[vd]))
checkpoint_result = checkpoint.run(batch_parameters={"dataframe": df})
print("   returned normally, success =", checkpoint_result.success)

print("\n4. A ValidationDefinition needs its suite in the context")
batch_definition = gxlab.pandas_batch_definition(context, "unsaved")
loose_suite = gx.ExpectationSuite(name="never_added")  # not passed to context.suites.add
loose_suite.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="id"))
try:
    gx.ValidationDefinition(name="vd_unsaved", data=batch_definition, suite=loose_suite).run(
        batch_parameters={"dataframe": df}
    )
except Exception as e:
    print("   raised:", type(e).__name__)

print("\n5. A second get_context() replaces the global project")
first_context = gx.get_context()
first_vd = make(first_context, "first", [gxe.ExpectColumnValuesToNotBeNull(column="id")])
print("   run before:", first_vd.run(batch_parameters={"dataframe": df}).success)
second_context = gx.get_context()
print("   same object:", first_context is second_context)
try:
    print("   run after :", first_vd.run(batch_parameters={"dataframe": df}).success)
except Exception as e:
    print("   run after raised:", type(e).__name__)
print("   (1.9.3 raises here; 1.24.1 runs, because objects now remember the context that owns them)")

print("\n6. Adding the same expectation twice is silently ignored")
suite = gx.get_context().suites.add(gx.ExpectationSuite(name="dupes"))
suite.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="id"))
suite.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="id"))
print("   expectations in suite:", len(suite.expectations))
