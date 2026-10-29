"""Lesson: first-validation. The shape of a validation result, running the same definition on a second day, and
the answers to the practice exercises.

Run: uv run python 18_result_anatomy.py
"""

import json

import great_expectations as gx
import great_expectations.expectations as gxe
import pandas as pd

import gxlab

context = gx.get_context()
bd = gxlab.pandas_batch_definition(context, "anatomy")
suite = context.suites.add(gx.ExpectationSuite(name="users_suite"))
suite.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="id"))
suite.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="age"))
suite.add_expectation(gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=120))
suite.add_expectation(gxe.ExpectTableRowCountToEqual(value=4))
vd = gx.ValidationDefinition(name="users_vd", data=bd, suite=suite)

day1 = pd.DataFrame({"id": [1, 2, 3, 4], "age": [10, None, 30, 400], "name": ["a", "b", None, "d"]})
r1 = vd.run(batch_parameters={"dataframe": day1})

print("--- 1. top level of the suite result ---")
d = r1.to_json_dict()
print("keys:", list(d.keys()))
print("success:", d["success"], "| statistics:", d["statistics"])
print("suite_name:", d.get("suite_name"))
print("meta keys:", list((d.get("meta") or {}).keys()))
print("result_url:", getattr(r1, "result_url", None))

print("\n--- 2. one expectation result ---")
one = d["results"][2]
print("keys:", list(one.keys()))
print("expectation_config:", json.dumps(one["expectation_config"], ensure_ascii=False))
print("result:", json.dumps(one["result"], ensure_ascii=False))
print("exception_info:", one["exception_info"])
print("meta:", one.get("meta"))

print("\n--- 3. the same definition on a second day ---")
day2 = pd.DataFrame({"id": [1, 2, 3, 4], "age": [10, 20, 30, 40], "name": ["a", "b", "c", "d"]})
r2 = vd.run(batch_parameters={"dataframe": day2})
print("day1 success:", r1.success, "| day2 success:", r2.success)
same_vd = vd.id is not None
print("same validation definition reused:", same_vd)
rid1 = r1.meta.get("run_id")
rid2 = r2.meta.get("run_id")
print("run ids differ:", str(rid1) != str(rid2), "|", rid1, "|", rid2)
keys = context.validation_results_store.list_keys()
print("results kept in the store:", len(keys))

print("\n--- 4. practice answers ---")
def run_with(frame, expectations, name):
    s = context.suites.add(gx.ExpectationSuite(name=name))
    for e in expectations:
        s.add_expectation(e)
    v = gx.ValidationDefinition(name=f"vd_{name}", data=bd, suite=s)
    return v.run(batch_parameters={"dataframe": frame})

ex1 = run_with(pd.DataFrame({"id": [1, 2, 3, 4], "age": [10, 20, 30, 40], "name": ["a", "b", "c", "d"]}),
               [gxe.ExpectColumnValuesToNotBeNull(column="id"), gxe.ExpectColumnValuesToNotBeNull(column="age"),
                gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=120), gxe.ExpectTableRowCountToEqual(value=4)], "ex1")
print("ex1 all pass:", ex1.success, ex1.statistics["success_percent"])
ex2 = run_with(pd.DataFrame({"id": [1, 2, 2, 4], "age": [10, 20, 30, 40]}),
               [gxe.ExpectColumnValuesToBeUnique(column="id")], "ex2")
r = ex2.results[0].result
print("ex2 unique:", ex2.success, "| unexpected_count:", r["unexpected_count"], "| values:", r["partial_unexpected_list"])
ex3 = run_with(pd.DataFrame({"id": [1, 2, 3, 4], "age": [10, 20, 30, 40], "name": ["a", "b", "c", "d"]}),
               [gxe.ExpectTableColumnsToMatchSet(column_set=["id", "age", "name", "email"], exact_match=True)], "ex3")
r = ex3.results[0].result
print("ex3 missing column:", ex3.success, "| observed:", r["observed_value"], "| details:", {k: v for k, v in r.get("details", {}).items()})
ex4 = run_with(pd.DataFrame({"id": [1, 2, 3, 4], "age": [10, 20, 30, 400]}),
               [gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=120, mostly=0.75)], "ex4")
r = ex4.results[0].result
print("ex4 mostly 0.75:", ex4.success, "| unexpected_percent:", r["unexpected_percent"])
ex4b = run_with(pd.DataFrame({"id": [1, 2, 3, 4], "age": [10, 20, 30, 400]}),
                [gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=120, mostly=0.8)], "ex4b")
print("ex4 mostly 0.8 :", ex4b.success)
