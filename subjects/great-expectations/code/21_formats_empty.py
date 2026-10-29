"""Lesson: reading-results. result_format in detail, which expectations pass on an empty or all-null column, and a
triage function that sorts results into data problems, broken expectations and an empty suite.

Run: uv run python 21_formats_empty.py
"""

import json

import great_expectations as gx
import great_expectations.expectations as gxe
import pandas as pd

import gxlab

context = gx.get_context()
bd = gxlab.pandas_batch_definition(context, "fmt")
_n = [0]


def run(expectations, frame, **fmt):
    _n[0] += 1
    suite = context.suites.add(gx.ExpectationSuite(name=f"s{_n[0]}"))
    for e in expectations:
        suite.add_expectation(e)
    vd = gx.ValidationDefinition(name=f"v{_n[0]}", data=bd, suite=suite)
    kw = {"batch_parameters": {"dataframe": frame}}
    if fmt:
        kw["result_format"] = fmt
    return vd.run(**kw)


df = pd.DataFrame({"id": [1, 2, 3, 4], "age": [10, None, 30, 400]})

print("--- 1. result keys by result_format (between on age; max on age) ---")
for fmt in ("BOOLEAN_ONLY", "BASIC", "SUMMARY", "COMPLETE"):
    r = run([gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=120),
             gxe.ExpectColumnMaxToBeBetween(column="age", min_value=0, max_value=120)], df, result_format=fmt)
    for x in r.results:
        print(f"{fmt:13} {x.expectation_config.type[7:]:28} keys={sorted(x.result.keys())}")

print("\n--- 2. the extra options ---")
r = run([gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=120)], df,
        result_format="COMPLETE", include_unexpected_rows=True, return_unexpected_index_query=True, unexpected_index_column_names=["id"])
res = r.results[0].result
print("keys:", sorted(res.keys()))
print("unexpected_index_list:", res.get("unexpected_index_list"))
print("unexpected_rows:", res.get("unexpected_rows"))
print("unexpected_index_query:", res.get("unexpected_index_query"))

print("\n--- 3. partial_unexpected_count limits the sample ---")
big = pd.DataFrame({"x": list(range(200, 260))})
for cnt in (3, 20):
    r = run([gxe.ExpectColumnValuesToBeBetween(column="x", min_value=0, max_value=100)], big, result_format="SUMMARY", partial_unexpected_count=cnt)
    res = r.results[0].result
    print(f"partial_unexpected_count={cnt}: unexpected_count={res['unexpected_count']} sample_size={len(res['partial_unexpected_list'])}")
r = run([gxe.ExpectColumnValuesToBeBetween(column="x", min_value=0, max_value=100)], big)
print("default sample size:", len(r.results[0].result["partial_unexpected_list"]))

print("\n--- 4. which expectations pass on an empty table / an all-null column ---")
empty = pd.DataFrame({"v": pd.Series([], dtype="float64")})
allnull = pd.DataFrame({"v": [None, None, None]}, dtype="float64")
checks = {  # factories: an expectation object that already belongs to a suite cannot be added to another one
    "values not null": lambda: gxe.ExpectColumnValuesToNotBeNull(column="v"),
    "values between": lambda: gxe.ExpectColumnValuesToBeBetween(column="v", min_value=0, max_value=1),
    "values in set": lambda: gxe.ExpectColumnValuesToBeInSet(column="v", value_set=[1, 2]),
    "values unique": lambda: gxe.ExpectColumnValuesToBeUnique(column="v"),
    "max between": lambda: gxe.ExpectColumnMaxToBeBetween(column="v", min_value=0, max_value=1),
    "mean between": lambda: gxe.ExpectColumnMeanToBeBetween(column="v", min_value=0, max_value=1),
    "row count >= 1": lambda: gxe.ExpectTableRowCountToBeBetween(min_value=1),
    "column count 1": lambda: gxe.ExpectTableColumnCountToEqual(value=1),
}
for label, frame in (("empty table", empty), ("all null", allnull)):
    print(label)
    for name, make in checks.items():
        r = run([make()], frame).results[0]
        raised = any(isinstance(v, dict) and v.get("raised_exception") for v in (r.exception_info or {}).values())
        extra = r.result.get("observed_value")
        print(f"  {name:16} success={str(r.success):5} raised={raised!s:5} observed={extra!r}")


def triage(result) -> str:
    """Sort a suite result: empty / broken / data / ok. Same order of questions as the lesson."""
    if result.statistics["evaluated_expectations"] == 0:
        return "empty suite"
    broken = [x for x in result.results if any(isinstance(v, dict) and v.get("raised_exception") for v in (x.exception_info or {}).values())]
    if broken:
        return f"broken expectation ({len(broken)})"
    if not result.success:
        return "data problem"
    return "ok"


print("\n--- 5. triage ---")
good = pd.DataFrame({"id": [1, 2], "age": [10, 20]})
print("good data         :", triage(run([gxe.ExpectColumnValuesToNotBeNull(column="age")], good)))
print("bad value         :", triage(run([gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=15)], good)))
print("missing column    :", triage(run([gxe.ExpectColumnValuesToNotBeNull(column="nope")], good)))
print("empty suite       :", triage(run([], good)))


print("\n--- 6. one expectation object in two suites ---")
shared = gxe.ExpectColumnValuesToNotBeNull(column="age")
context.suites.add(gx.ExpectationSuite(name="first_owner")).add_expectation(shared)
second = context.suites.add(gx.ExpectationSuite(name="second_owner"))
try:
    second.add_expectation(shared)
except RuntimeError as e:
    print("RuntimeError:", str(e)[:110])
copied = shared.copy()
copied.id = None
second.add_expectation(copied)
print("after copy + id=None: second suite has", len(second.expectations), "expectation(s)")
