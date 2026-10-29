"""Lesson: first-validation. Build the chain once and read the result.

Run: uv run python 01_first_validation.py
"""

import great_expectations as gx
import great_expectations.expectations as gxe
import pandas as pd

import gxlab

df = pd.DataFrame({"id": [1, 2, 3, 4], "age": [10, None, 30, 400], "name": ["a", "b", None, "d"]})

context = gx.get_context()  # no gx/ folder here and no cloud variables, so this is an ephemeral context
print("context:", type(context).__name__)

batch_definition = gxlab.pandas_batch_definition(context, "demo")

# The suite must be added to the context before a ValidationDefinition can run it.
suite = context.suites.add(gx.ExpectationSuite(name="users_suite"))
suite.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="id"))
suite.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="age"))
suite.add_expectation(gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=120))
suite.add_expectation(gxe.ExpectTableRowCountToEqual(value=4))

validation_definition = gx.ValidationDefinition(name="users_vd", data=batch_definition, suite=suite)
print("id before run:", validation_definition.id)  # None: not persisted yet

# The DataFrame is a run-time parameter. It is not stored with the batch definition.
result = validation_definition.run(batch_parameters={"dataframe": df})
print("id after run :", validation_definition.id)  # run() added it to the context for us

print("\nsuite success:", result.success)
print("statistics   :", result.statistics)
for r in result.results:
    print(
        f"  {r.expectation_config.type:38s} success={r.success!s:5s}",
        {k: v for k, v in r.result.items() if k in ("element_count", "unexpected_count", "observed_value")},
    )
