"""Runs every DuckDB exercise and checks that each one finishes with its own `ok` line.

The lessons were written with DuckDB 1.5.6 (the Python package, `duckdb==1.5.6` in pyproject.toml), pandas, Polars and PyArrow from `uv.lock`, on Windows 11 with 16 threads and a memory limit of 25 GiB (80% of the RAM).
Exercise 11 needs the internet once: it runs INSTALL for httpfs, sqlite_scanner and fts, and later runs use the copy in `~/.duckdb/extensions`.
Exercises 08 and 10 compare times and cpu use of several thread counts and memory limits, so do not run a build or a crawl at the same time.

Run: uv run python verify.py            (add --show to print the output of each exercise, or exercise numbers to run only those: uv run python verify.py 02 07)
Takes about two minutes.
"""

import re
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).parent
SHOW = "--show" in sys.argv

if sys.version_info < (3, 12):
    sys.exit("Python 3.12 or newer is needed")

import duckdb  # noqa: E402

print("DuckDB", duckdb.__version__, "| Python", sys.version.split()[0])
if duckdb.__version__ != "1.5.6":
    print("WARNING: the lessons were written with DuckDB 1.5.6; a failing check below may be a changed message or plan and not a mistake")

problems: list[str] = []
exercises = sorted((HERE / "exercises").glob("[0-9][0-9]_*.py"))
only = [x for x in sys.argv[1:] if not x.startswith("--")]
if only:
    exercises = [p for p in exercises if any(p.stem.startswith(x) for x in only)]
print(f"\n{len(exercises)} exercises")
total = 0
for path in exercises:
    started = time.time()
    done = subprocess.run([sys.executable, str(path)], cwd=HERE, capture_output=True, text=True, encoding="utf-8")
    out = done.stdout + done.stderr
    checks = len(re.findall(r"^  ok   ", out, flags=re.M))
    total += checks
    passed = done.returncode == 0 and out.rstrip().endswith("ok") and "FAIL" not in out
    print(f"  {'PASS' if passed else 'FAIL'}  {path.stem:32} {checks:3} checks  {time.time() - started:5.1f}s")
    if not passed:
        problems.append(path.stem)
        print("\n".join("       " + line for line in out.strip().splitlines()[-12:]))
    elif SHOW:
        print(out)

print(f"\n{total} checks")
if problems:
    sys.exit("FAILED: " + ", ".join(problems))
print("all exercises passed")
