"""Lesson: validation-checkpoints. A checkpoint with several validation definitions, the shape of CheckpointResult,
shared parameters, and how a checkpoint differs from running a validation definition directly.

Run: uv run python 25_checkpoint_shapes.py
"""

import json
import sqlite3
import tempfile
import warnings
from pathlib import Path

import great_expectations as gx
import great_expectations.expectations as gxe
import pandas as pd

import gxlab  # noqa: F401

warnings.filterwarnings("ignore")
context = gx.get_context()
frame = pd.DataFrame({"id": [1, 2, 3], "age": [10, None, 400]})

bd_a = gxlab.pandas_batch_definition(context, "a")
bd_b = gxlab.pandas_batch_definition(context, "b")


def make_vd(name, bd, expectations):
    s = context.suites.add(gx.ExpectationSuite(name=f"suite_{name}"))
    for e in expectations:
        s.add_expectation(e)
    return context.validation_definitions.add(gx.ValidationDefinition(name=f"vd_{name}", data=bd, suite=s))


vd_ids = make_vd("ids", bd_a, [gxe.ExpectColumnValuesToBeUnique(column="id")])
vd_age = make_vd("age", bd_b, [gxe.ExpectColumnValuesToNotBeNull(column="age"), gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=120)])
cp = context.checkpoints.add(gx.Checkpoint(name="cp", validation_definitions=[vd_ids, vd_age]))

print("--- 1. one checkpoint, two validation definitions (first passes, second fails) ---")
before = len(context.validation_results_store.list_keys())
result = cp.run(batch_parameters={"dataframe": frame})
print("type:", type(result).__name__, "| success:", result.success)
print("run_results entries:", len(result.run_results))
for key, r in result.run_results.items():
    print(f"  suite={key.expectation_suite_identifier.name:10} run_time={str(key.run_id.run_time)[11:23]} batch={key.batch_identifier} -> success={r.success} evaluated={r.statistics['evaluated_expectations']}")
run_ids = {str(k.run_id.run_time) for k in result.run_results}
print("distinct run ids across validations:", len(run_ids))
print("results stored by this run:", len(context.validation_results_store.list_keys()) - before)

print("\n--- 2. describe() ---")
d = json.loads(result.describe())
print("top-level keys:", list(d.keys()))
print("describe:", json.dumps(d, ensure_ascii=False)[:520])

print("\n--- 3. the second validation still runs when the first fails ---")
vd_bad = make_vd("bad", gxlab.pandas_batch_definition(context, "c"), [gxe.ExpectColumnValuesToBeUnique(column="dup")])
vd_ok = make_vd("ok", gxlab.pandas_batch_definition(context, "d"), [gxe.ExpectTableRowCountToEqual(value=3)])
cp2 = context.checkpoints.add(gx.Checkpoint(name="cp2", validation_definitions=[vd_bad, vd_ok]))
r2 = cp2.run(batch_parameters={"dataframe": pd.DataFrame({"dup": [1, 1, 2]})})
print("success:", r2.success, "| per validation:", {k.expectation_suite_identifier.name: v.success for k, v in r2.run_results.items()})

print("\n--- 4. shared parameters must fit every validation definition ---")
db = Path(tempfile.mkdtemp(prefix="gx_cp_")) / "t.db"
con = sqlite3.connect(db)
con.execute("create table t (n int)")
con.execute("insert into t values (1)")
con.commit()
con.close()
sql_bd = (
    context.data_sources.add_sqlite("sq", connection_string=f"sqlite:///{db}")
    .add_table_asset("t", table_name="t")
    .add_batch_definition_whole_table("w")
)
vd_sql = make_vd("sql", sql_bd, [gxe.ExpectTableRowCountToEqual(value=1)])
mixed = context.checkpoints.add(gx.Checkpoint(name="mixed", validation_definitions=[vd_ids, vd_sql]))
try:
    out = mixed.run(batch_parameters={"dataframe": frame})
    print("ran:", out.success, {k.expectation_suite_identifier.name: v.success for k, v in out.run_results.items()})
except Exception as e:  # noqa: BLE001
    print("raised:", type(e).__name__, "|", str(e).replace(chr(10), " ")[:140])

print("\n--- 5. result_format belongs to the Checkpoint object, run() does not take it ---")
import inspect  # noqa: E402

print("  Checkpoint.run parameters:", list(inspect.signature(gx.Checkpoint.run).parameters)[1:])
for fmt in ("BOOLEAN_ONLY", "COMPLETE"):
    cpf = context.checkpoints.add(gx.Checkpoint(name=f"cp_{fmt}", validation_definitions=[vd_age], result_format=fmt))
    out = cpf.run(batch_parameters={"dataframe": frame})
    first = list(out.run_results.values())[0].results[0].result
    print(f"  Checkpoint(result_format={fmt!r}) -> keys in the first result: {len(first)}")

print("\n--- 5b. run_id lets you name a run ---")
from great_expectations.core.run_identifier import RunIdentifier  # noqa: E402

named = cp.run(batch_parameters={"dataframe": frame}, run_id=RunIdentifier(run_name="nightly-2024-02-01"))
print("  run_name in the results:", {k.run_id.run_name for k in named.run_results})

print("\n--- 6. a validation definition run directly versus through a checkpoint ---")
s0 = len(context.validation_results_store.list_keys())
vd_age.run(batch_parameters={"dataframe": frame})
s1 = len(context.validation_results_store.list_keys())
cp.run(batch_parameters={"dataframe": frame})
s2 = len(context.validation_results_store.list_keys())
print(f"  results stored: vd.run adds {s1 - s0}, checkpoint with 2 validations adds {s2 - s1}")
print("  checkpoint_id in meta (vd.run):", vd_age.run(batch_parameters={"dataframe": frame}).meta.get("checkpoint_id"))
print("  checkpoint_id in meta (checkpoint):", list(cp.run(batch_parameters={"dataframe": frame}).run_results.values())[0].meta.get("checkpoint_id") is not None)

print("\n--- 7. describe() levels and a helper that lists failed expectations ---")
d = json.loads(result.describe())
vr = d["validation_results"][1]
print("validation_results[1] keys:", list(vr.keys()))
print("expectations[0] keys:", list(vr["expectations"][0].keys()))
print("describe()['validation_results'][1]['expectations'][1]:", json.dumps(vr["expectations"][1], ensure_ascii=False)[:420])


def failed_expectations(res):
    """(suite name, expectation type, column, unexpected_count) for every expectation that did not pass."""
    out = []
    for key, vres in res.run_results.items():
        for r in vres.results:
            if not r.success:
                out.append((key.expectation_suite_identifier.name, r.expectation_config.type, r.expectation_config.kwargs.get("column"), r.result.get("unexpected_count")))
    return out


print("failed_expectations:")
for row in failed_expectations(result):
    print("  ", row)
