"""Runs every Docker exercise and checks that each one finishes with its own `ok` line.

The exercises talk to the real `docker` command line, so Docker must be running (Docker Desktop on Windows, the daemon on Linux). The lessons were written with
Docker Engine 29.2.1 (client 29.2.1) on Docker Desktop, and re-ran everything on 29.9.3 after Docker Desktop updated itself with the WSL2 backend, storage driver overlay2, cgroup v2, runc, and these images:
alpine:3.22, busybox:1.37, python:3.13-slim, postgres:17-alpine and registry:3 (pull them once with `docker pull`, the first run pulls what is missing).
Everything an exercise creates is labelled `dlab=1` and removed again at the end, and nothing is published on a port of the computer that is not needed.

Run: python verify.py          (or: uv run python verify.py)   add --show to print the output of each exercise,
     or exercise numbers to run only those: python verify.py 01 03
Takes a few minutes: the exercises build images, start containers and wait for them (the stop and restart exercises sleep on purpose).
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

try:
    got = subprocess.run(
        ["docker", "version", "--format", "client {{.Client.Version}} / server {{.Server.Version}} ({{.Server.Os}})"],
        capture_output=True, text=True, timeout=60,
    )
    info = subprocess.run(
        ["docker", "info", "--format", "{{.Driver}} / cgroup {{.CgroupVersion}} / {{.DefaultRuntime}} / kernel {{.KernelVersion}}"],
        capture_output=True, text=True, timeout=60,
    )
except Exception as e:  # noqa: BLE001
    sys.exit(f"cannot run docker: {e}")
if got.returncode != 0:
    sys.exit(f"Docker is not running: {got.stderr.strip()}")
print("Docker:", got.stdout.strip(), "|", info.stdout.strip())
for needle, what in (("29.", "Docker Engine 29.x (written with 29.2.1, all 288 checks re-run and passed on 29.9.3)"), ("overlay2", "storage driver overlay2")):
    if needle not in got.stdout + info.stdout:
        print(f"WARNING: expected {what} (what the lessons were written with); a failing check below may be a changed message and not a mistake")

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

print(f"\n{total} checks in {len(exercises)} exercises")
if problems:
    sys.exit("FAILED: " + ", ".join(problems))
print("all exercises pass")
