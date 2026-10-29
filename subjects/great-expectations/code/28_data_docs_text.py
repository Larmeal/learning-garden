"""Lesson: actions-data-docs. What the Data Docs pages actually say, read back from the generated HTML, and how
result_format changes the validation page.

Run: uv run python 28_data_docs_text.py
"""

import re
import tempfile
import warnings
from html.parser import HTMLParser
from pathlib import Path

import great_expectations as gx
import great_expectations.expectations as gxe
import pandas as pd
from great_expectations.checkpoint.actions import UpdateDataDocsAction

import gxlab  # noqa: F401

warnings.filterwarnings("ignore")


class Text(HTMLParser):
    """Collect visible text, skipping script and style."""

    def __init__(self):
        super().__init__()
        self.skip = 0
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip and data.strip():
            self.parts.append(" ".join(data.split()))


def text_of(path: Path) -> list[str]:
    p = Text()
    p.feed(path.read_text(encoding="utf-8"))
    return p.parts


root = Path(tempfile.mkdtemp(prefix="gx_docs_"))
context = gx.get_context(mode="file", project_root_dir=root)
bd = context.data_sources.add_pandas("people_src").add_dataframe_asset("people").add_batch_definition_whole_dataframe("whole")
suite = context.suites.add(gx.ExpectationSuite(name="people_suite"))
suite.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="name"))
suite.add_expectation(gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=120))
vd = context.validation_definitions.add(gx.ValidationDefinition(name="vd", data=bd, suite=suite))
df = pd.DataFrame({"age": [10, 20, 300], "name": ["a", None, "c"]})

site = root / "gx" / "uncommitted" / "data_docs" / "local_site"
sizes = {}
for fmt in ("BOOLEAN_ONLY", "COMPLETE"):
    cp = context.checkpoints.add(gx.Checkpoint(name=f"cp_{fmt}", validation_definitions=[vd], actions=[UpdateDataDocsAction(name="docs")], result_format=fmt))
    cp.run(batch_parameters={"dataframe": df})
    pages = sorted((site / "validations").rglob("*.html"), key=lambda p: p.stat().st_mtime)
    sizes[fmt] = (pages[-1], len(text_of(pages[-1])))
    print(f"{fmt:12} newest validation page: {pages[-1].stat().st_size} bytes, {sizes[fmt][1]} text fragments")

print("\n--- index.html ---")
for t in text_of(site / "index.html")[:24]:
    print("  ", t[:100])

print("\n--- expectation suite page ---")
for t in text_of(site / "expectations" / "people_suite.html")[:30]:
    print("  ", t[:110])

print("\n--- the COMPLETE validation page (first 60 fragments) ---")
for t in text_of(sizes["COMPLETE"][0])[48:84]:
    print("  ", t[:110])
print("\n--- the BOOLEAN_ONLY validation page (first 40 fragments) ---")
bo = sorted((site / "validations").rglob("*.html"), key=lambda p: p.stat().st_mtime)[0]
for t in text_of(bo)[48:70]:
    print("  ", t[:110])
