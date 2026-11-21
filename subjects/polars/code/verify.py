"""Runs every exercise and checks that it finishes with "ok" (each exercise asserts its own claims).

Run: uv run python verify.py          (add --show to print the output of each exercise)

The lessons were written against Polars 2.1.0. The script fails if another version is installed, because a changed version can
change a default, an error message or a plan text. Exercises 09 and 10 time things and measure memory, so do not run a build or a
crawl at the same time.
"""

import subprocess
import sys
from pathlib import Path

import polars as pl

HERE = Path(__file__).parent
SHOW = "--show" in sys.argv
problems: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'} {label}" + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        problems.append(label)


print("Versions")
check("polars 2.1.0", pl.__version__ == "2.1.0", pl.__version__)

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
