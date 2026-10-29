"""Lesson: expectations-suites. One run of built-in expectations from every family, and how each family treats nulls.

Run: uv run python 19_catalog_nulls.py
"""

import great_expectations as gx
import great_expectations.expectations as gxe
import pandas as pd
from great_expectations.expectations.expectation import (
    BatchExpectation, ColumnAggregateExpectation, ColumnMapExpectation, ColumnPairMapExpectation,
    MulticolumnMapExpectation, UnexpectedRowsExpectation,
)

import gxlab

FAMILIES = [
    ("column map", ColumnMapExpectation), ("column pair map", ColumnPairMapExpectation),
    ("multicolumn map", MulticolumnMapExpectation), ("column aggregate", ColumnAggregateExpectation),
    ("unexpected rows", UnexpectedRowsExpectation), ("batch (table)", BatchExpectation),
]


def family(exp) -> str:
    for label, base in FAMILIES:
        if isinstance(exp, base):
            return label
    return "other"


df = pd.DataFrame({
    "id": [1, 2, 3, 4, 5],
    "age": [10, None, 30, 40, 400],
    "plan": ["free", "pro", None, "pro", "gold"],
    "start": [1, 2, 3, 4, 5],
    "end": [2, 3, 3, 9, 4],
    "a": [1, 1, 2, 2, 3],
    "b": [1, 2, 1, 2, 3],
})
expectations = [
    gxe.ExpectColumnValuesToNotBeNull(column="age"),
    gxe.ExpectColumnValuesToBeNull(column="age"),
    gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=120),
    gxe.ExpectColumnValuesToBeInSet(column="plan", value_set=["free", "pro"]),
    gxe.ExpectColumnValuesToBeUnique(column="id"),
    gxe.ExpectColumnValuesToMatchRegex(column="plan", regex="^[a-z]+$"),
    gxe.ExpectColumnMaxToBeBetween(column="age", min_value=0, max_value=120),
    gxe.ExpectColumnMeanToBeBetween(column="age", min_value=0, max_value=120),
    gxe.ExpectColumnDistinctValuesToBeInSet(column="plan", value_set=["free", "pro", "gold"]),
    gxe.ExpectColumnPairValuesAToBeGreaterThanB(column_A="end", column_B="start"),
    gxe.ExpectCompoundColumnsToBeUnique(column_list=["a", "b"]),
    gxe.ExpectTableRowCountToEqual(value=5),
    gxe.ExpectTableColumnCountToEqual(value=7),
]

context = gx.get_context()
bd = gxlab.pandas_batch_definition(context, "catalog")
suite = context.suites.add(gx.ExpectationSuite(name="catalog"))
for e in expectations:
    suite.add_expectation(e)
res = gx.ValidationDefinition(name="vd", data=bd, suite=suite).run(batch_parameters={"dataframe": df})

# Results are NOT in suite order: GX groups expectations by their `column` argument before evaluating them
# (Validator.process_expectations_for_validation). Every type is unique in this suite, so match on the type.
print("suite order :", [e.expectation_type.removeprefix("expect_") for e in expectations])
print("result order:", [r.expectation_config.type.removeprefix("expect_") for r in res.results])
by_type = {r.expectation_config.type: r for r in res.results}
pairs = [(e, by_type[e.expectation_type]) for e in expectations]

print("--- 1. family and result keys, one row per expectation ---")
for e, r in pairs:
    print(f"{e.expectation_type:52} {family(e):17} success={str(r.success):5} keys={sorted(r.result.keys())}")

print("\n--- 2. how each expectation treats the null in age = [10, None, 30, 40, 400], plan has one None ---")
for e, r in pairs[:9]:
    show = {k: r.result.get(k) for k in ("element_count", "missing_count", "unexpected_count", "observed_value") if k in r.result}
    print(f"{e.expectation_type:48} col={e.column:5} success={str(r.success):5} {show}")

print("\n--- 3. ExpectColumnDistinctValuesToBeInSet reports no observed_value, with or without a null ---")
for label, values in [("with null", ["free", "pro", None, "pro", "gold"]), ("no null", ["free", "pro", "pro", "gold"])]:
    s = context.suites.add(gx.ExpectationSuite(name=f"distinct_{label.replace(' ', '_')}"))
    s.add_expectation(gxe.ExpectColumnDistinctValuesToBeInSet(column="plan", value_set=["free", "pro", "gold"]))
    s.add_expectation(gxe.ExpectColumnDistinctValuesToBeInSet(column="plan", value_set=["free", "pro"]))
    out = gx.ValidationDefinition(name=f"vd_{label.replace(' ', '_')}", data=bd, suite=s).run(batch_parameters={"dataframe": pd.DataFrame({"plan": values})})
    for r in out.results:
        print(f"  {label:9} success={str(r.success):5} {r.result}")
