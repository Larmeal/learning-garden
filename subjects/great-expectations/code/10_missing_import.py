"""Lesson: custom-expectations and pipeline-integration. A suite that uses a custom expectation passes silently when the
class is not imported.

The suite is stored as JSON and refers to the expectation by its type name. A new process that never imported the class
loads the suite with zero expectations, and running it reports success. This script starts a second Python process to
show it.

Run: uv run python 10_missing_import.py
"""

import subprocess
import sys
import tempfile

PHASE_ONE = '''
import warnings; warnings.filterwarnings("ignore")
import sys
import great_expectations as gx
from great_expectations.execution_engine import PandasExecutionEngine
from great_expectations.expectations.expectation import ColumnMapExpectation
from great_expectations.expectations.metrics import ColumnMapMetricProvider, column_condition_partial

class Even(ColumnMapMetricProvider):
    condition_metric_name = "column_values.are_even"
    @column_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column, **kwargs):
        return column % 2 == 0

class ExpectColumnValuesToBeEven(ColumnMapExpectation):
    map_metric = "column_values.are_even"
    args_keys = ("column",)

context = gx.get_context(mode="file", project_root_dir=sys.argv[1])
suite = context.suites.add(gx.ExpectationSuite(name="even"))
suite.add_expectation(ExpectColumnValuesToBeEven(column="n"))
print("process 1: saved a suite with", len(suite.expectations), "expectation of type", suite.expectations[0].expectation_type)
'''

PHASE_TWO = '''
import warnings, logging; warnings.filterwarnings("ignore"); logging.disable(logging.CRITICAL)
import sys
import great_expectations as gx
import pandas as pd

context = gx.get_context(mode="file", project_root_dir=sys.argv[1])
suite = context.suites.get("even")          # the class ExpectColumnValuesToBeEven was never imported here
print("process 2: loaded the suite with", len(suite.expectations), "expectations")

batch_definition = context.data_sources.add_pandas("p").add_dataframe_asset("a").add_batch_definition_whole_dataframe("w")
result = gx.ValidationDefinition(name="v", data=batch_definition, suite=suite).run(
    batch_parameters={"dataframe": pd.DataFrame({"n": [1, 3, 5]})}   # all odd: should fail
)
print("process 2: success =", result.success, "| evaluated_expectations =", result.statistics["evaluated_expectations"])
'''

project = tempfile.mkdtemp(prefix="gx_missing_import_")
for code in (PHASE_ONE, PHASE_TWO):
    out = subprocess.run([sys.executable, "-c", code, project], capture_output=True, text=True)
    print("\n".join(line for line in out.stdout.splitlines() if line.startswith("process")))
print("\nGuard: refuse a run that evaluated nothing -> check result.statistics['evaluated_expectations'] > 0")
