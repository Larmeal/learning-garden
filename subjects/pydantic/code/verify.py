"""Runs every exercise and checks that it finishes with "ok" (each exercise asserts its own claims).

Run: uv run python verify.py          (add --show to print the output of each exercise)

The lessons were written against Pydantic 2.13.0 and pydantic-core 2.46.0. The script fails if the installed versions
differ, because a changed version can change the text of an error message or a default.
"""

import subprocess
import sys
from pathlib import Path

import pydantic
import pydantic_core

HERE = Path(__file__).parent
SHOW = "--show" in sys.argv
problems: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'} {label}" + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        problems.append(label)


print("Versions")
check("pydantic 2.13.0", pydantic.VERSION == "2.13.0", pydantic.VERSION)
check("pydantic-core 2.46.0", pydantic_core.__version__ == "2.46.0", pydantic_core.__version__)

print("\nExercises (each asserts what its lesson states)")
for path in sorted((HERE / "exercises").glob("[0-9][0-9]_*.py")):
    done = subprocess.run(
        [sys.executable, "-W", "ignore", str(path)], cwd=HERE, capture_output=True, text=True, encoding="utf-8"
    )
    last = done.stdout.strip().splitlines()[-1:] or [""]
    check(path.name, done.returncode == 0 and last[0] == "ok", (done.stderr or done.stdout)[-300:])
    if SHOW:
        print(done.stdout)

print()
if problems:
    print(f"{len(problems)} problem(s): {problems}")
    sys.exit(1)
print("All checks passed.")
