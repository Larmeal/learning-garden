"""Runs every Git exercise and checks that each one finishes with its own `ok` line.

The exercises call the real git program, so the first thing checked is the version the lessons were written against
(Git 2.56). A different minor version can print different messages, and then a failing exercise tells you which claim moved.

Run: python verify.py          (or: uv run python verify.py)   add --show to print the output of each exercise,
     or exercise numbers to run only those: python verify.py 01 06
"""

import re
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).parent
SHOW = "--show" in sys.argv
WANT = (2, 56)

version = subprocess.run(["git", "--version"], capture_output=True, text=True).stdout.strip()
numbers = re.search(r"(\d+)\.(\d+)\.(\d+)", version)
print(f"{version}  (the lessons were written and run with Git {WANT[0]}.{WANT[1]})")
if not numbers or tuple(int(n) for n in numbers.groups()[:2]) != WANT:
    print("WARNING: another version of git; a failing check below may be a changed message and not a mistake")
if sys.version_info < (3, 12):
    sys.exit("Python 3.12 or newer is needed")

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
        print("\n".join("       " + l for l in out.strip().splitlines()[-12:]))
    elif SHOW:
        print(out)

print(f"\n{total} checks in {len(exercises)} exercises")
if problems:
    sys.exit("FAILED: " + ", ".join(problems))
print("all exercises pass")
