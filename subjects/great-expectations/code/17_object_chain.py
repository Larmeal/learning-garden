"""Lesson: core-concepts. What exists after each line of the build chain, how objects refer to each other, and the
errors a newcomer meets first.

Run: uv run python 17_object_chain.py
"""

import json

import great_expectations as gx
import great_expectations.expectations as gxe
import pandas as pd

import gxlab

df = pd.DataFrame({"id": [1, 2, 3], "age": [10, 20, 30]})
calls = gxlab.spy_on_metric_rounds()


def show(step: str, **kv):
    print(f"[{step}]", " | ".join(f"{k}={v}" for k, v in kv.items()), f"| engine_rounds={len(calls)}")


print("--- 1. the build chain, line by line ---")
context = gx.get_context()
show("context", type=type(context).__name__)
source = context.data_sources.add_pandas("people_src")
show("add_pandas", id=source.id, in_context=[s for s in context.data_sources.all()].__len__())
asset = source.add_dataframe_asset("people")
show("add_dataframe_asset", asset_id=getattr(asset, "id", None), assets_in_source=len(source.assets))
bdef = asset.add_batch_definition_whole_dataframe("whole")
show("add_batch_definition", id=bdef.id, name=bdef.name)
suite = gx.ExpectationSuite(name="people_suite")
show("ExpectationSuite(...)", id=suite.id, in_context=[s.name for s in context.suites.all()])
suite = context.suites.add(suite)
show("suites.add", id=suite.id, in_context=[s.name for s in context.suites.all()])
suite.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="id"))
show("suite.add_expectation", n=len(suite.expectations), expectation_id=suite.expectations[0].id)
vd = gx.ValidationDefinition(name="people_vd", data=bdef, suite=suite)
show("ValidationDefinition(...)", id=vd.id, in_context=[v.name for v in context.validation_definitions.all()])
res = vd.run(batch_parameters={"dataframe": df})
show("vd.run", id=vd.id is not None, in_context=[v.name for v in context.validation_definitions.all()], success=res.success)

print("\n--- 2. how objects point at each other (serialized form) ---")
print("validation definition:", json.dumps(json.loads(vd.json()), ensure_ascii=False)[:420])
print("batch definition     :", json.dumps(json.loads(bdef.json()), ensure_ascii=False)[:200])

print("\n--- 3. what is stored and what is not ---")
print("suite stored (has expectations):", context.suites.get("people_suite").expectations[0].expectation_type)
print("dataframe values appear in the batch definition json:", "[1, 2, 3]" in bdef.json() or "\"age\"" in bdef.json())

print("\n--- 4. errors a newcomer meets ---")


def attempt(label, fn):
    try:
        r = fn()
        print(f"  {label}: no error | {str(r)[:100]}")
    except Exception as e:  # noqa: BLE001
        print(f"  {label}: {type(e).__name__} | {str(e).replace(chr(10), ' ')[:170]}")


c2 = gx.get_context()
bd2 = gxlab.pandas_batch_definition(c2, "second")
s_not_added = gx.ExpectationSuite(name="never_added")
s_not_added.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="id"))
attempt("suite not added to the context", lambda: gx.ValidationDefinition(name="v1", data=bd2, suite=s_not_added).run(batch_parameters={"dataframe": df}))
s_ok = c2.suites.add(gx.ExpectationSuite(name="s_ok"))
s_ok.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="id"))
vd_ok = gx.ValidationDefinition(name="v2", data=bd2, suite=s_ok)
attempt("run without batch_parameters", lambda: vd_ok.run())
attempt("wrong batch_parameters key", lambda: vd_ok.run(batch_parameters={"df": df}))
attempt("same suite name twice", lambda: c2.suites.add(gx.ExpectationSuite(name="s_ok")))
attempt("same source name twice", lambda: (c2.data_sources.add_pandas("dup"), c2.data_sources.add_pandas("dup")))
attempt("column typo in an expectation", lambda: gxe.ExpectColumnValuesToNotBeNull(colum="id"))
attempt("unknown suite name in get", lambda: c2.suites.get("nope"))

print("\n--- 5. a file context remembers names between runs ---")
import tempfile  # noqa: E402

root = tempfile.mkdtemp(prefix="gx_names_")
first = gx.get_context(mode="file", project_root_dir=root)
first.suites.add(gx.ExpectationSuite(name="kept"))
print("first run  : suites =", [s.name for s in first.suites.all()])
second = gx.get_context(mode="file", project_root_dir=root)  # what a second run of the same script does
print("second run : suites already there =", [s.name for s in second.suites.all()])
attempt("add the same name again", lambda: second.suites.add(gx.ExpectationSuite(name="kept")))
reused = second.suites.get("kept")
print("get existing   :", reused.name, "id kept =", reused.id is not None)
updated = second.suites.add_or_update(gx.ExpectationSuite(name="kept"))
print("add_or_update  :", updated.name, "| same id as before:", updated.id == reused.id, "| suites now:", [s.name for s in second.suites.all()])
