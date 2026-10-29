"""Lesson: foundations. The GX 0.18 way, for comparison with 1.x. Most tutorials on the web still look like this.

It needs the old release and an older NumPy and pandas, so it runs outside this project's environment:

    uv run --no-project --python 3.11 --with great-expectations==0.18.21 --with "numpy<2" --with "pandas<2.2" 08_legacy_018.py
"""

import warnings

import great_expectations as gx
import pandas as pd

warnings.filterwarnings("ignore")
print("great_expectations", gx.__version__)

df = pd.DataFrame({"id": [1, 2, 3, 4], "age": [10, None, 30, 400]})
context = gx.get_context()

# 0.18: the DataFrame goes straight into a Validator, and each expect_* is a METHOD that runs immediately.
validator = context.sources.pandas_default.read_dataframe(df)
first = validator.expect_column_values_to_not_be_null("age")
print("expectation result:", type(first).__name__, "success =", first.success)
second = validator.expect_column_values_to_be_between("age", min_value=0, max_value=120)
print("expectation result:", type(second).__name__, "success =", second.success)

# By default a failing expectation is not kept in the suite.
print("expectations kept in the suite:", len(validator.get_expectation_suite().expectations))

# 0.18 checkpoints look up the suite by NAME, so it has to be saved first.
datasource = context.sources.add_pandas("legacy")
asset = datasource.add_dataframe_asset("legacy_asset", dataframe=df)
checkpoint = context.add_or_update_checkpoint(
    name="legacy_checkpoint",
    validations=[{"batch_request": asset.build_batch_request(), "expectation_suite_name": "default"}],
)
try:
    checkpoint.run()
except Exception as e:
    print("checkpoint raised:", type(e).__name__, "|", str(e)[:80])
