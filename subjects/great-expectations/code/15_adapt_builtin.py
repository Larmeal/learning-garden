"""Lesson: custom-expectations, before writing a class. What the built-in expectations can already be bent into.

Ran against a small orders table:
  - `mostly`            tolerate a share of bad rows
  - `row_condition`     only check the rows that match a condition
  - `severity`          mark how bad a failure is
  - the registry        list what exists before writing anything
  - a regex             covers many "custom" format rules

Run: uv run python 15_adapt_builtin.py
"""

import great_expectations as gx
import great_expectations.expectations as gxe
import pandas as pd
from great_expectations.data_context.types.base import ProgressBarsConfig
from great_expectations.expectations import registry
from great_expectations.expectations.row_conditions import Column

import gxlab  # noqa: F401  (prints the version, silences warnings)

orders = pd.DataFrame(
    {
        "country": ["th", "th", "th", "jp", "jp", "sg"],
        "zip": ["10110", "10110", "1011", "100-0001", "100-0001", "018956"],
        "amount": [120.0, 80.0, 5000.0, 60.0, 70.0, 90.0],
    }
)

context = gx.get_context()
context.variables.progress_bars = ProgressBarsConfig(globally=False)
bd = gxlab.pandas_batch_definition(context, "orders")


def run(tag, *expectations):
    suite = context.suites.add(gx.ExpectationSuite(name=tag))
    for e in expectations:
        suite.add_expectation(e)
    return gx.ValidationDefinition(name=f"vd_{tag}", data=bd, suite=suite).run(batch_parameters={"dataframe": orders})


def line(label, r):
    print(f"  {label:44} success={r.success} unexpected={r.result.get('unexpected_count')} of {r.result.get('element_count')} "
          f"values={r.result.get('partial_unexpected_list')}")


print("--- mostly: amount between 0 and 1000 ---")
for mostly in (1, 0.8):
    line(f"mostly={mostly}", run(f"m{mostly}", gxe.ExpectColumnValuesToBeBetween(column="amount", min_value=0, max_value=1000, mostly=mostly)).results[0])

print("\n--- row_condition: Thai zip codes must have 5 digits, other countries are not checked ---")
regex = gxe.ExpectColumnValuesToMatchRegex
line("no row_condition", run("r0", regex(column="zip", regex=r"^\d{5}$")).results[0])
line("row_condition: country == 'th'", run("r1", regex(column="zip", regex=r"^\d{5}$", row_condition=Column("country") == "th")).results[0])

print("\n--- severity ---")
res = run("sev", gxe.ExpectColumnValuesToBeBetween(column="amount", min_value=0, max_value=1000, severity="warning"),
          gxe.ExpectColumnValuesToMatchRegex(column="zip", regex=r"^\d{5}$", row_condition=Column("country") == "th", severity="critical"))
print("  suite success:", res.success, "| worst failed severity:", res.get_max_severity_failure())

print("\n--- the registry: what exists before you write anything ---")
names = registry.list_registered_expectation_implementations()
print("  registered expectation types after `import great_expectations.expectations`:", len(names))
for word in ("pair", "multicolumn", "regex", "unique"):
    print(f"  names containing {word!r}:", [n.removeprefix("expect_") for n in names if word in n])
