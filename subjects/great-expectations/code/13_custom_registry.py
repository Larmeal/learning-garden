"""Lesson: custom-expectations, registry and loading. How a class becomes an expectation type, and how it goes missing.

Part 1 (this process): the name of the class decides the type, the registry is one dict, and a clash replaces a built-in.
Part 2 (subprocesses): a file-context suite stored by one process and loaded by another, with and without the import,
and the checks that catch the difference.

Run: uv run python 13_custom_registry.py
"""

import json
import logging
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

import great_expectations as gx
from great_expectations.core.suite_parameters import SuiteParameterDict  # noqa: F401  (import order for older pydantic)
from great_expectations.exceptions import InvalidExpectationConfigurationError
from great_expectations.expectations import registry
from great_expectations.expectations.expectation import ColumnMapExpectation
from great_expectations.expectations.expectation_configuration import ExpectationConfiguration
from great_expectations.expectations.metrics import ColumnMapMetricProvider
from great_expectations.execution_engine import PandasExecutionEngine
from great_expectations.expectations.metrics import column_condition_partial

import gxlab  # noqa: F401  (prints the version, silences warnings)

print("--- 1. the class name decides the type ---")


class AnyMetric(ColumnMapMetricProvider):
    condition_metric_name = "column_values.registry_demo"

    @column_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column, **kwargs):
        return column.notnull()


for name in ("ExpectColumnValuesToBeEven", "ExpectZipCodeToBeValid", "ExpectUSZipCodeToBeValid", "ExpectColumnValuesToBeUTF8", "ExpectIDsToBeUnique"):
    klass = type(name, (ColumnMapExpectation,), {"map_metric": "column_values.registry_demo", "__module__": __name__})
    print(f"  {name:30} -> {klass.expectation_type}")

declared = type("ExpectSomethingElse", (ColumnMapExpectation,), {"map_metric": "column_values.registry_demo", "expectation_type": "my_chosen_name", "__module__": __name__})
print("  expectation_type attribute set to 'my_chosen_name' -> actual type:", declared.expectation_type)
print("  'my_chosen_name' in registry:", "my_chosen_name" in registry._registered_expectations)

print("\n--- 2. a class with the name of a built-in replaces it ---")
before = registry.get_expectation_impl("expect_column_values_to_not_be_null")
records: list[str] = []


class Capture(logging.Handler):
    def emit(self, record):
        records.append(f"{record.levelname}: {record.getMessage()}")


handler = Capture(level=logging.WARNING)
logging.getLogger("great_expectations.expectations.registry").addHandler(handler)


class ExpectColumnValuesToNotBeNull(ColumnMapExpectation):  # same name as the built-in
    map_metric = "column_values.registry_demo"


after = registry.get_expectation_impl("expect_column_values_to_not_be_null")
print("  registry entry is now ours:", after is ExpectColumnValuesToNotBeNull, "| was the built-in:", before is not after)
print("  log:", records)
registry._registered_expectations["expect_column_values_to_not_be_null"] = before  # put the built-in back

print("\n--- 3. an unknown type in this process fails loudly ---")
try:
    gx.ExpectationSuite(name="s").add_expectation_configurations(
        [ExpectationConfiguration(type="expect_something_nobody_wrote", kwargs={"column": "x"})]
    )
except InvalidExpectationConfigurationError as e:
    print("  InvalidExpectationConfigurationError:", str(e)[:120])
except Exception as e:  # noqa: BLE001
    print(" ", type(e).__name__, str(e)[:160])

print("\n--- 4. a suite stored by one process and loaded by another ---")
MODULE = textwrap.dedent(
    '''
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
    '''
)
SAVE = textwrap.dedent(
    '''
    import warnings; warnings.filterwarnings("ignore")
    import sys
    import great_expectations as gx
    from my_expectations import ExpectColumnValuesToBeEven
    context = gx.get_context(mode="file", project_root_dir=sys.argv[1])
    suite = context.suites.add(gx.ExpectationSuite(name="even"))
    suite.add_expectation(ExpectColumnValuesToBeEven(column="n"))
    print("saved with", len(suite.expectations), "expectation")
    '''
)
LOAD = textwrap.dedent(
    '''
    import warnings, logging, json, sys, glob; warnings.filterwarnings("ignore")
    class OneLine(logging.Filter):
        def filter(self, record):
            record.exc_info = record.exc_text = None  # the traceback is long; the message says enough
            return True
    logging.basicConfig(level=logging.WARNING, format="  log %(levelname)s %(name)s: %(message)s")
    logging.getLogger().handlers[0].addFilter(OneLine())
    if sys.argv[2] == "import":
        import my_expectations  # noqa: F401  (registers the class)
    import great_expectations as gx
    import pandas as pd
    context = gx.get_context(mode="file", project_root_dir=sys.argv[1])
    suite = context.suites.get("even")
    stored = json.load(open(glob.glob(sys.argv[1] + "/gx/expectations/even.json")[0]))
    print("  expectations in the JSON file:", len(stored["expectations"]), "| in the loaded suite:", len(suite.expectations))
    tag = sys.argv[2]  # the file context keeps data sources between processes, so each run needs fresh names
    bd = context.data_sources.add_pandas("p_" + tag).add_dataframe_asset("a").add_batch_definition_whole_dataframe("w")
    result = gx.ValidationDefinition(name="v_" + tag, data=bd, suite=suite).run(batch_parameters={"dataframe": pd.DataFrame({"n": [1, 3, 5]})})
    print("  success =", result.success, "| evaluated_expectations =", result.statistics["evaluated_expectations"])
    '''
)

work = Path(tempfile.mkdtemp(prefix="gx_registry_"))
(work / "my_expectations.py").write_text(MODULE, encoding="utf-8")
project = work / "project"
project.mkdir()
env_path = str(work)


def run(code, *args):
    out = subprocess.run([sys.executable, "-c", code, *args], capture_output=True, text=True, env={**__import__("os").environ, "PYTHONPATH": env_path})
    text = (out.stdout + out.stderr).strip()
    print("\n".join(line for line in text.splitlines() if not line.startswith(("Calculating", "great_expectations 1"))))


run(SAVE, str(project))
print("loading WITHOUT importing my_expectations:")
run(LOAD, str(project), "skip")
print("loading AFTER importing my_expectations:")
run(LOAD, str(project), "import")

print("\nstored JSON:")
print(textwrap.indent(json.dumps(json.loads((project / "gx" / "expectations" / "even.json").read_text())["expectations"], indent=2), "  "))
