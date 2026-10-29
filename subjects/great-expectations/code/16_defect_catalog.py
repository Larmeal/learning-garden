"""Lesson: foundations. One suite, several kinds of broken data: which defects does GX catch, and which pass silently?

Also checks that a validation does not change the DataFrame it reads.

Run: uv run python 16_defect_catalog.py
"""

import great_expectations as gx
import great_expectations.expectations as gxe
import pandas as pd

import gxlab

CLEAN = pd.DataFrame(
    {
        "id": [1, 2, 3, 4, 5],
        "age": [31, 24, 45, 52, 38],
        "email": ["a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com"],
        "country": ["TH", "TH", "JP", "SG", "TH"],
    }
)

CASES = {
    "clean": CLEAN,
    "null in age": CLEAN.assign(age=[31, None, 45, 52, 38]),
    "duplicate id": CLEAN.assign(id=[1, 2, 2, 4, 5]),
    "age out of range": CLEAN.assign(age=[31, 24, 450, 52, 38]),
    "bad email": CLEAN.assign(email=["a@x.com", "b-at-x.com", "c@x.com", "d@x.com", "e@x.com"]),
    "column renamed": CLEAN.rename(columns={"age": "age_years"}),
    "empty file": CLEAN.iloc[0:0],
    "wrong but valid": CLEAN.assign(age=[13, 24, 45, 52, 38]),  # 13 instead of 31: still inside 0..120
    "unknown country": CLEAN.assign(country=["TH", "TH", "JP", "SG", "XX"]),
}

context = gx.get_context()
bd = gxlab.pandas_batch_definition(context, "defects")
suite = context.suites.add(gx.ExpectationSuite(name="people"))
checks = [
    ("id not null", gxe.ExpectColumnValuesToNotBeNull(column="id")),
    ("id unique", gxe.ExpectColumnValuesToBeUnique(column="id")),
    ("age not null", gxe.ExpectColumnValuesToNotBeNull(column="age")),
    ("age between 0 and 120", gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=120)),
    ("email matches regex", gxe.ExpectColumnValuesToMatchRegex(column="email", regex=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")),
    ("country in set", gxe.ExpectColumnValuesToBeInSet(column="country", value_set=["TH", "JP", "SG"])),
    ("columns match set", gxe.ExpectTableColumnsToMatchSet(column_set=["id", "age", "email", "country"], exact_match=True)),
    ("row count 1..1000", gxe.ExpectTableRowCountToBeBetween(min_value=1, max_value=1000)),
]
for _, e in checks:
    suite.add_expectation(e)
vd = gx.ValidationDefinition(name="vd", data=bd, suite=suite)

for name, frame in CASES.items():
    before = frame.copy(deep=True)
    res = vd.run(batch_parameters={"dataframe": frame})
    untouched = frame.equals(before) and list(frame.columns) == list(before.columns)
    # Match results to checks by their configuration, not by position: a result list is not guaranteed to follow suite order.
    by_config = {(r.expectation_config.type, r.expectation_config.kwargs.get("column")): r for r in res.results}
    failed, broken = [], []
    for label, e in checks:
        r = by_config[(e.expectation_type, getattr(e, "column", None))]
        if not r.success:
            failed.append(label)
            if any(isinstance(v, dict) and v.get("raised_exception") for v in (r.exception_info or {}).values()):
                broken.append(label)
    order_same = [r.expectation_config.type for r in res.results] == [e.expectation_type for _, e in checks]
    print(f"{name:18} success={str(res.success):5} untouched={untouched} same_order={order_same} failed={failed} raised={broken}")
