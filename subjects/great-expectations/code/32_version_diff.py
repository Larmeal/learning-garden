"""Lesson: internals. How much of GX changed between the 1.9.3 checkout (the one the knowledge graph was built from)
and the installed 1.24.1, file by file.

Run: uv run python 32_version_diff.py [output.json]
Needs the checkout at E:/Development/Project/open-source/great-expectations (edit OLD if yours is elsewhere).
"""

import difflib
import json
import sys
from pathlib import Path

import great_expectations as gx

OLD = Path("E:/Development/Project/open-source/great-expectations/great_expectations")
NEW = Path(gx.__file__).parent


def lines(p: Path) -> list[str]:
    return p.read_text(encoding="utf-8", errors="replace").replace("\r\n", "\n").splitlines()


def py_files(root: Path) -> dict[str, Path]:
    return {p.relative_to(root).as_posix(): p for p in root.rglob("*.py") if "__pycache__" not in p.parts}


old, new = py_files(OLD), py_files(NEW)
both = sorted(set(old) & set(new))
only_old = sorted(set(old) - set(new))
only_new = sorted(set(new) - set(old))
print(f"python files: 1.9.3={len(old)} 1.24.1={len(new)} | in both={len(both)} | only 1.9.3={len(only_old)} | only 1.24.1={len(only_new)}")

changed = []
for rel in both:
    a, b = lines(old[rel]), lines(new[rel])
    if a == b:
        continue
    n = sum(1 for l in difflib.unified_diff(a, b, lineterm="", n=0) if (l.startswith("+") or l.startswith("-")) and not l.startswith(("+++", "---")))
    changed.append((rel, n))
print(f"files identical: {len(both) - len(changed)} | files changed: {len(changed)}")

KEY = [
    "validator/validation_graph.py", "validator/metrics_calculator.py", "validator/validator.py", "validator/v1_validator.py",
    "execution_engine/execution_engine.py", "execution_engine/pandas_execution_engine.py", "execution_engine/sqlalchemy_execution_engine.py",
    "execution_engine/sparkdf_execution_engine.py", "core/validation_definition.py", "core/batch_definition.py", "core/expectation_suite.py",
    "checkpoint/checkpoint.py", "checkpoint/actions.py", "expectations/expectation.py", "expectations/registry.py",
    "expectations/metrics/metric_provider.py", "data_context/data_context/context_factory.py", "data_context/data_context/cloud_data_context.py",
]
cmap = dict(changed)
print("\nkey files (changed lines):")
rows = []
for k in KEY:
    n = cmap.get(k, 0) if k in both else None
    rows.append({"file": k, "changed": n})
    print(f"  {k:62} {n if n is not None else 'missing in one version'}")
print("\nbiggest changes:")
for rel, n in sorted(changed, key=lambda t: -t[1])[:8]:
    print(f"  {rel:70} {n}")
print("\nsome files only in 1.24.1:", only_new[:8])
print("some files only in 1.9.3:", only_old[:8])
if len(sys.argv) > 1:
    Path(sys.argv[1]).write_text(json.dumps({"old": "1.9.3", "new": gx.__version__, "key": rows, "totals": {"old": len(old), "new": len(new), "both": len(both), "changed": len(changed), "only_old": len(only_old), "only_new": len(only_new)}, "top": [{"file": r, "changed": n} for r, n in sorted(changed, key=lambda t: -t[1])[:8]]}, ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote", sys.argv[1])
