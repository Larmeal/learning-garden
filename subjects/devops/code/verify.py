"""Runs every DevOps exercise and checks that each one finishes with its own `ok` line.

The exercises call the real git, docker and terraform programs, so the first thing checked is the versions the lessons
were written against. A different version can print different messages, and then a failing exercise tells you which claim moved.

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


def version(cmd: list[str]) -> str:
    try:
        done = subprocess.run(cmd, capture_output=True, text=True)
        return (done.stdout + done.stderr).strip().splitlines()[0]
    except Exception as err:  # noqa: BLE001
        return f"missing ({err})"


print(version(["git", "--version"]), "(lessons written with Git 2.56)")
print(version(["docker", "--version"]), "(lessons written with Docker 29)")
print(version(["terraform", "version"]), "(lessons written with Terraform 1.16)")
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
    passed = done.returncode == 0 and out.rstrip().endswith("ok") and not re.search(r"^(  FAIL |FAILED:)", out, flags=re.M)
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
