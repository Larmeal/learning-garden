"""Lesson: internals. The real order in which GX functions run for one Checkpoint.run, recorded with sys.setprofile.

Run: uv run python 31_call_trace.py [output.json]
With an output path the trace is also written as JSON (used by the trace lab in the lesson).
"""

import json
import sys
import warnings
from pathlib import Path

import great_expectations as gx
import great_expectations.expectations as gxe
import pandas as pd

import gxlab

warnings.filterwarnings("ignore")
context = gx.get_context()
bd = gxlab.pandas_batch_definition(context, "trace")
suite = context.suites.add(gx.ExpectationSuite(name="s"))
suite.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="id"))
suite.add_expectation(gxe.ExpectColumnMaxToBeBetween(column="age", min_value=0, max_value=120))
vd = context.validation_definitions.add(gx.ValidationDefinition(name="vd", data=bd, suite=suite))
cp = context.checkpoints.add(gx.Checkpoint(name="cp", validation_definitions=[vd]))
df = pd.DataFrame({"id": [1, 2], "age": [10, 400]})

# Keep only the functions that tell the story. Everything else (pydantic, logging, helpers) is noise here.
WANTED = {
    ("checkpoint/checkpoint.py", "run"),
    ("checkpoint/checkpoint.py", "_run_validation_definitions"),
    ("checkpoint/checkpoint.py", "_run_actions"),
    ("core/validation_definition.py", "run"),
    ("core/validation_definition.py", "_add_to_store"),
    ("data_context/store/validation_results_store.py", "store_validation_results"),
    ("validator/v1_validator.py", "validate_expectation_suite"),
    ("validator/validator.py", "graph_validate"),
    ("validator/validator.py", "process_expectations_for_validation"),
    ("validator/validator.py", "build_metric_validation_graph"),
    ("validator/validation_graph.py", "resolve"),
    ("validator/validation_graph.py", "_resolve"),
    ("execution_engine/execution_engine.py", "resolve_metrics"),
    ("execution_engine/pandas_execution_engine.py", "resolve_metric_bundle"),
    ("expectations/expectation.py", "get_validation_dependencies"),
    ("expectations/expectation.py", "metrics_validate"),
    ("expectations/expectation.py", "_validate"),
}
events = []
depth = [0]
cur = {}


def profiler(frame, event, arg):
    path = frame.f_code.co_filename.replace("\\", "/")
    if "/great_expectations/" not in path:
        return
    rel = path.split("/great_expectations/")[-1]
    key = (rel, frame.f_code.co_name)
    if rel.startswith("expectations/") and frame.f_code.co_name == "_validate":
        key = ("expectations/expectation.py", "_validate")  # the real _validate lives in each expectation's own file
        WANTED.add(key)
    if event == "call" and key in WANTED:
        events.append({"file": rel, "fn": frame.f_code.co_name, "depth": depth[0], "n": len(events)})
        depth[0] += 1
    elif event == "return" and key in WANTED:
        depth[0] -= 1


sys.setprofile(profiler)
result = cp.run(batch_parameters={"dataframe": df})
sys.setprofile(None)

print("success:", result.success, "| recorded calls:", len(events))
# Collapse repeats: show each (file, fn, depth) the first time, with a count
seen, order = {}, []
for e in events:
    k = (e["file"], e["fn"], e["depth"])
    if k not in seen:
        seen[k] = 0
        order.append(k)
    seen[k] += 1
for k in order:
    print(f"{'  ' * k[2]}{k[0]}:{k[1]}  x{seen[k]}")
if len(sys.argv) > 1:
    out = [{"file": k[0], "fn": k[1], "depth": k[2], "count": seen[k]} for k in order]
    Path(sys.argv[1]).write_text(json.dumps({"version": gx.__version__, "trace": out}, ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote", sys.argv[1])
