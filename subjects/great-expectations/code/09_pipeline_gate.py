"""Lesson: pipeline-integration. A quality gate around Checkpoint.run, and how to tell bad data from a broken expectation.

Checkpoint.run does not raise when the data is bad, so the pipeline has to read the result and decide.

Run: uv run python 09_pipeline_gate.py
"""

import great_expectations as gx
import great_expectations.expectations as gxe
import pandas as pd

import gxlab


def raised_exception(info) -> bool:
    """True when the expectation could not be evaluated. A failed check has raised_exception=False."""
    if not info:
        return False
    if "raised_exception" in info:
        return bool(info["raised_exception"])
    return True  # failures of metrics come as a dict keyed by metric id


def classify(checkpoint_result):
    """Split the failed expectations into data problems and broken expectations."""
    bad_data, broken = [], []
    for suite_result in checkpoint_result.run_results.values():
        for r in suite_result.results:
            if r.success:
                continue
            (broken if raised_exception(r.exception_info) else bad_data).append(r.expectation_config.type)
    return bad_data, broken


class QualityGateError(RuntimeError):
    pass


def gate(checkpoint, batch_parameters):
    """Run the checkpoint and raise only when the data should not move on."""
    result = checkpoint.run(batch_parameters=batch_parameters)
    # An empty suite (for example a custom expectation that failed to load) "passes" with nothing evaluated.
    if any(r.statistics["evaluated_expectations"] == 0 for r in result.run_results.values()):
        raise QualityGateError("no expectations were evaluated")
    if result.success:
        return result
    bad_data, broken = classify(result)
    if broken:
        raise QualityGateError(f"expectations could not be evaluated: {broken}")
    raise QualityGateError(f"data failed: {bad_data}")


context = gx.get_context()
batch_definition = gxlab.pandas_batch_definition(context, "gate")

suite = context.suites.add(gx.ExpectationSuite(name="orders"))
suite.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="order_id"))
suite.add_expectation(gxe.ExpectColumnValuesToBeBetween(column="amount", min_value=0, max_value=10_000))
suite.add_expectation(gxe.ExpectTableRowCountToBeBetween(min_value=1))  # without this, an empty table passes
vd = context.validation_definitions.add(gx.ValidationDefinition(name="orders_vd", data=batch_definition, suite=suite))
checkpoint = context.checkpoints.add(gx.Checkpoint(name="orders_cp", validation_definitions=[vd]))

good = pd.DataFrame({"order_id": [1, 2, 3], "amount": [10.0, 25.5, 99.0]})
bad = pd.DataFrame({"order_id": [1, None, 3], "amount": [10.0, 25.5, 99999.0]})
empty = pd.DataFrame({"order_id": pd.Series([], dtype="float64"), "amount": pd.Series([], dtype="float64")})
renamed = good.rename(columns={"amount": "total"})

empty_suite = context.suites.add(gx.ExpectationSuite(name="nothing"))
empty_vd = context.validation_definitions.add(gx.ValidationDefinition(name="nothing_vd", data=batch_definition, suite=empty_suite))
empty_checkpoint = context.checkpoints.add(gx.Checkpoint(name="nothing_cp", validation_definitions=[empty_vd]))
try:
    gate(empty_checkpoint, {"dataframe": good})
except QualityGateError as e:
    print(f"{'empty suite':15s} -> STOP: {e}")

for name, frame in [("good", good), ("bad data", bad), ("empty table", empty), ("renamed column", renamed)]:
    try:
        gate(checkpoint, {"dataframe": frame})
        print(f"{name:15s} -> publish")
    except QualityGateError as e:
        print(f"{name:15s} -> STOP: {e}")
