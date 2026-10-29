"""Lessons: actions-data-docs and context-stores. A file context on disk, a failing action, and Data Docs.

Run: uv run python 06_actions_docs.py
"""

import tempfile
from pathlib import Path

import great_expectations as gx
import great_expectations.expectations as gxe
import pandas as pd
from great_expectations.checkpoint.actions import UpdateDataDocsAction, ValidationAction

import gxlab

df = pd.DataFrame({"x": [1, 2, 3]})
project = Path(tempfile.mkdtemp(prefix="gx_file_"))

context = gx.get_context(mode="file", project_root_dir=project)
print("context:", type(context).__name__)
batch_definition = gxlab.pandas_batch_definition(context, "f")
suite = context.suites.add(gx.ExpectationSuite(name="suite"))
suite.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="x"))
vd = context.validation_definitions.add(gx.ValidationDefinition(name="vd", data=batch_definition, suite=suite))


class Boom(ValidationAction):
    type: str = "boom"
    name: str = "boom"

    def run(self, checkpoint_result, action_context=None):
        raise RuntimeError("action failed on purpose")


print("\nActions run after all validations, in order. UpdateDataDocsAction is moved to the front.")
checkpoint = context.checkpoints.add(
    gx.Checkpoint(name="cp", validation_definitions=[vd], actions=[Boom(), UpdateDataDocsAction(name="docs")])
)
try:
    checkpoint.run(batch_parameters={"dataframe": df})
except RuntimeError as e:
    print("checkpoint raised from the action:", e)
print("validation results already stored:", len(context.validation_results_store.list_keys()))

print("\nfiles GX wrote under", project / "gx")
for path in sorted((project / "gx").rglob("*")):
    if path.is_file() and "static" not in path.parts:
        print("  ", path.relative_to(project / "gx"))
