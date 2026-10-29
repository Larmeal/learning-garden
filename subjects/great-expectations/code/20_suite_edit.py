"""Lesson: expectations-suites. Editing a suite that already lives in a context, and what the set behaviour really is.

Run: uv run python 20_suite_edit.py
"""

import great_expectations as gx
import great_expectations.expectations as gxe
import pandas as pd

import gxlab


def attempt(label, fn):
    try:
        r = fn()
        print(f"  {label}: ok | {r}")
    except Exception as e:  # noqa: BLE001
        print(f"  {label}: {type(e).__name__} | {str(e).replace(chr(10), ' ')[:150]}")


context = gx.get_context()
bd = gxlab.pandas_batch_definition(context, "edit")
df = pd.DataFrame({"age": [10, 20, 30, 400]})
suite = context.suites.add(gx.ExpectationSuite(name="s"))

print("--- 1. set behaviour ---")
a = suite.add_expectation(gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=120))
b = suite.add_expectation(gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=120))
print("equal expectation twice: len =", len(suite.expectations), "| same id returned:", a.id == b.id)
c = suite.add_expectation(gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=200))
print("different kwargs       : len =", len(suite.expectations))
d = suite.add_expectation(gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=120, mostly=0.9))
print("only mostly differs    : len =", len(suite.expectations))
e = suite.add_expectation(gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=120, severity="warning"))
print("only severity differs  : len =", len(suite.expectations))

print("\n--- 2. change one in place ---")
target = suite.expectations[0]
target.max_value = 500
attempt("assign then save()", lambda: (target.save(), "saved")[1])
fresh = context.suites.get("s")
print("  max_value in the stored suite:", [x.max_value for x in fresh.expectations][:1], "| count:", len(fresh.expectations))

print("\n--- 3. delete ---")
attempt("delete_expectation", lambda: (suite.delete_expectation(suite.expectations[-1]), len(suite.expectations))[1])
print("  stored count after delete:", len(context.suites.get("s").expectations))

print("\n--- 4. a suite that is not in a context ---")
loose = gx.ExpectationSuite(name="loose")
loose.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="age"))
print("  loose suite len:", len(loose.expectations), "| in context:", "loose" in [x.name for x in context.suites.all()])

print("\n--- 5. run reads the stored suite, not the python variable ---")
vd = gx.ValidationDefinition(name="v", data=bd, suite=suite)
r = vd.run(batch_parameters={"dataframe": df})
print("  evaluated:", r.statistics["evaluated_expectations"], "| suite len:", len(suite.expectations))
