"""Runs every Application Security exercise and checks that each one finishes with its own `ok` line.

All of them run on this computer only: toy apps in this process, an in-memory SQLite database, a certificate authority made on the
spot, a throwaway Git repository. Nothing is sent over a network. Exercise 04 and 12 measure speeds, so their printed seconds differ
on another computer; their asserts use ratios.

Run: python verify.py          (or: uv run python verify.py)   add --show to print the output of each exercise,
     or exercise numbers to run only those: python verify.py 03 08
"""

import platform
import re
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).parent
WANT = "47.0.0"
SHOW = "--show" in sys.argv

print(f"Python {platform.python_version()}, cryptography {__import__('cryptography').__version__}  (the lessons were written and run with cryptography {WANT})")
if __import__('cryptography').__version__ != WANT:
    print("WARNING: another version of cryptography; a failing check below may be a changed message and not a mistake")

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
    passed = done.returncode == 0 and out.rstrip().endswith("ok") and not re.search(r"^  FAIL", out, flags=re.M)
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
