"""Lesson: context-stores. Build a file context, then list every file GX wrote and show what is inside.

Run: uv run python 22_file_context_tour.py [output_dir]
With an output_dir the printed files are also written to <output_dir>/tour.json (used to write the lesson).
"""

import json
import sys
import tempfile
from pathlib import Path

import great_expectations as gx
import great_expectations.expectations as gxe
import pandas as pd

import gxlab  # noqa: F401

root = Path(tempfile.mkdtemp(prefix="gx_tour_"))
context = gx.get_context(mode="file", project_root_dir=root)
print("context:", type(context).__name__)

source = context.data_sources.add_pandas("people_src")
asset = source.add_dataframe_asset("people")
bdef = asset.add_batch_definition_whole_dataframe("whole")
suite = context.suites.add(gx.ExpectationSuite(name="people_suite"))
suite.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="id"))
suite.add_expectation(gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=120))
vd = context.validation_definitions.add(gx.ValidationDefinition(name="people_vd", data=bdef, suite=suite))
checkpoint = context.checkpoints.add(gx.Checkpoint(name="people_cp", validation_definitions=[vd], actions=[gx.checkpoint.UpdateDataDocsAction(name="docs")]))
df = pd.DataFrame({"id": [1, 2, 3], "age": [10, 20, 300]})
result = checkpoint.run(batch_parameters={"dataframe": df})
print("checkpoint success:", result.success)

gx_dir = root / "gx"
files = sorted(p for p in gx_dir.rglob("*") if p.is_file())
print("\n--- files under gx/ ---")
tour = []
for p in files:
    rel = p.relative_to(gx_dir).as_posix()
    size = p.stat().st_size
    print(f"{rel:90} {size:>7} bytes")
    text = p.read_text(encoding="utf-8", errors="replace") if p.suffix in {".yml", ".json", ".gitignore", ""} or p.name == ".gitignore" else None
    tour.append({"path": rel, "bytes": size, "text": text[:1800] if text else None})

print("\n--- the small text files ---")
for rel in ("great_expectations.yml", ".gitignore"):
    print(f"\n# {rel}\n" + (gx_dir / rel).read_text(encoding="utf-8")[:1500])
for sub in ("expectations", "validation_definitions", "checkpoints"):
    for p in sorted((gx_dir / sub).glob("*.json")):
        print(f"\n# {sub}/{p.name}\n" + json.dumps(json.loads(p.read_text(encoding='utf-8')), indent=2, ensure_ascii=False)[:1400])

if len(sys.argv) > 1:
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    (out / "tour.json").write_text(json.dumps(tour, ensure_ascii=False, indent=1), encoding="utf-8")
    print("\nwrote", out / "tour.json")
