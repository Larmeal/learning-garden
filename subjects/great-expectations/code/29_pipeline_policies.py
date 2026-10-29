"""Lesson: pipeline-integration. Three policies for failed data, a daily run that cannot silently pick the wrong
file, and tests for the gate.

Run: uv run python 29_pipeline_policies.py
"""

import tempfile
import warnings
from datetime import date
from pathlib import Path

import great_expectations as gx
import great_expectations.expectations as gxe
import pandas as pd

import gxlab

warnings.filterwarnings("ignore")
context = gx.get_context()


def vd_for(tag, bd, expectations):
    s = context.suites.add(gx.ExpectationSuite(name=f"s_{tag}"))
    for e in expectations:
        s.add_expectation(e)
    return context.validation_definitions.add(gx.ValidationDefinition(name=f"vd_{tag}", data=bd, suite=s))


print("--- 1. three policies on three kinds of data ---")
bd = gxlab.pandas_batch_definition(context, "policy")
vd = vd_for("orders", bd, [
    gxe.ExpectColumnValuesToNotBeNull(column="order_id"),  # critical (default)
    gxe.ExpectColumnValuesToBeBetween(column="amount", min_value=0, max_value=1000, mostly=0.99, severity="warning"),
])
cp = context.checkpoints.add(gx.Checkpoint(name="orders_cp", validation_definitions=[vd]))
DATA = {
    "good": pd.DataFrame({"order_id": [1, 2], "amount": [10.0, 20.0]}),
    "warning only": pd.DataFrame({"order_id": [1, 2], "amount": [10.0, 5000.0]}),
    "critical": pd.DataFrame({"order_id": [1, None], "amount": [10.0, 20.0]}),
}


def severity_of(result):
    sev = [s.get_max_severity_failure() for s in result.run_results.values()]
    return sev[0].value if sev and sev[0] is not None else None


def apply(policy, name, result, state):
    sev = severity_of(result)
    if result.success:
        state["published"].append(name)
    elif policy == "stop":
        state["stopped"].append(name)
    elif policy == "quarantine":
        state["quarantine"].append(name)
    elif policy == "warn then continue":
        if sev == "critical":
            state["stopped"].append(name)
        else:
            state["published"].append(name)
            state["alerts"].append(name)


for policy in ("stop", "quarantine", "warn then continue"):
    state = {"published": [], "quarantine": [], "stopped": [], "alerts": []}
    sevs = {}
    for name, frame in DATA.items():
        result = cp.run(batch_parameters={"dataframe": frame})
        sevs[name] = severity_of(result)
        apply(policy, name, result, state)
    print(f"{policy:20} {state}")
print("max failed severity per data set:", sevs)

print("\n--- 2. a daily run with explicit dates ---")
folder = Path(tempfile.mkdtemp(prefix="gx_daily_"))
for d in (1, 3):  # the file of day 2 never arrives
    pd.DataFrame({"v": [d, d]}).to_csv(folder / f"data_2024-01-0{d}.csv", index=False)
src = context.data_sources.add_pandas_filesystem("daily_src", base_directory=folder)
daily_bd = src.add_csv_asset("daily").add_batch_definition_daily("d", regex=r"^data_(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})\.csv$")
daily_vd = vd_for("daily", daily_bd, [gxe.ExpectTableRowCountToBeBetween(min_value=1)])
daily_cp = context.checkpoints.add(gx.Checkpoint(name="daily_cp", validation_definitions=[daily_vd]))


def validated_file(result):
    meta = list(result.run_results.values())[0].meta
    return Path(meta["batch_spec"]["path"]).name


def run_for(day: date):
    return daily_cp.run(batch_parameters={"year": day.year, "month": day.month, "day": day.day})


for d in (1, 2, 3):
    try:
        r = run_for(date(2024, 1, d))
        print(f"  day {d}: validated {validated_file(r)} success={r.success}")
    except Exception as e:  # noqa: BLE001
        print(f"  day {d}: {type(e).__name__} | {str(e)[:60]}")
r = daily_cp.run(batch_parameters={})
print("  scheduler forgot the date -> validated", validated_file(r), "success =", r.success, "(asked for day 2, which has no file)")
before = len(context.validation_results_store.list_keys())
run_for(date(2024, 1, 3))
run_for(date(2024, 1, 3))
print("  the same day twice adds", len(context.validation_results_store.list_keys()) - before, "stored results (nothing is overwritten)")

print("\n--- 3. tests for the gate (plain asserts) ---")


class QualityGateError(RuntimeError):
    pass


def gate(checkpoint, batch_parameters):
    result = checkpoint.run(batch_parameters=batch_parameters)
    if any(r.statistics["evaluated_expectations"] == 0 for r in result.run_results.values()):
        raise QualityGateError("nothing evaluated")
    if not result.success:
        raise QualityGateError("data failed")
    return result


empty_vd = vd_for("nothing", bd, [])
empty_cp = context.checkpoints.add(gx.Checkpoint(name="nothing_cp", validation_definitions=[empty_vd]))
CASES = [
    ("good data passes", cp, DATA["good"], False),
    ("null id stops", cp, DATA["critical"], True),
    ("suite with no expectations stops", empty_cp, DATA["good"], True),
]
for label, checkpoint, frame, should_stop in CASES:
    try:
        gate(checkpoint, {"dataframe": frame})
        stopped = False
    except QualityGateError:
        stopped = True
    print(f"  {'PASS' if stopped == should_stop else 'FAIL'}  {label}")
