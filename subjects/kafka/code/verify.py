"""Runs every Kafka exercise and checks that each one finishes with its own `ok` line.

The exercises start real Kafka brokers in Docker (image apache/kafka:4.4.0, KRaft mode) and talk to them with confluent-kafka 2.16.2 and the command line
tools of the image, so Docker must be running. Pull the image once with `docker pull apache/kafka:4.4.0`. Everything an exercise creates is labelled `klab=1`
and removed at the end. Only ports 29092 and up on 127.0.0.1 are used (and 28083 for Kafka Connect in exercise 10).

Run: python verify.py          (or: uv run python verify.py)   add --show to print the output of each exercise,
     --write to let the exercises that feed a lab save their JSON, or exercise numbers to run only those: python verify.py 01 03
Takes about 15 minutes: some exercises wait for retention, for the cleaner, for a session timeout and for a controller election on purpose.
Do not build the site or run a crawl at the same time, the timing checks (quota, election, retries) would be disturbed.
"""

import re
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).parent
SHOW = "--show" in sys.argv
WRITE = "--write" in sys.argv

if sys.version_info < (3, 12):
    sys.exit("Python 3.12 or newer is needed")

try:
    got = subprocess.run(["docker", "version", "--format", "client {{.Client.Version}} / server {{.Server.Version}}"], capture_output=True, text=True, timeout=60)
except Exception as e:  # noqa: BLE001
    sys.exit(f"cannot run docker: {e}")
if got.returncode != 0:
    sys.exit(f"Docker is not running: {got.stderr.strip()}")
print("Docker:", got.stdout.strip())
images = subprocess.run(["docker", "image", "ls", "apache/kafka:4.4.0", "--format", "{{.Tag}}"], capture_output=True, text=True).stdout.split()
if "4.4.0" not in images:
    sys.exit("image apache/kafka:4.4.0 is missing: docker pull apache/kafka:4.4.0")
import confluent_kafka  # noqa: E402

_v = confluent_kafka.version()
_v = _v[0] if isinstance(_v, tuple) else _v
_lib = confluent_kafka.libversion()
_lib = _lib[0] if isinstance(_lib, tuple) else _lib
print(f"confluent-kafka {_v}, librdkafka {_lib}")
if _v != "2.16.2":
    print("WARNING: the lessons were written with confluent-kafka 2.16.2; a failing check below may be a changed message and not a mistake")

problems: list[str] = []
exercises = sorted((HERE / "exercises").glob("[0-9][0-9]_*.py"))
only = [x for x in sys.argv[1:] if not x.startswith("--")]
if only:
    exercises = [p for p in exercises if any(p.stem.startswith(x) for x in only)]
print(f"\n{len(exercises)} exercises")
total = 0
for path in exercises:
    started = time.time()
    cmd = [sys.executable, "-u", str(path)] + (["--write"] if WRITE else [])
    done = subprocess.run(cmd, cwd=HERE, capture_output=True, text=True, encoding="utf-8", errors="replace")
    out = done.stdout + done.stderr
    checks = len(re.findall(r"^  ok   ", out, flags=re.M))
    total += checks
    passed = done.returncode == 0 and done.stdout.rstrip().endswith("ok") and "FAIL " not in done.stdout  # stderr holds librdkafka log lines
    print(f"  {'PASS' if passed else 'FAIL'}  {path.stem:32} {checks:3} checks  {time.time() - started:6.1f}s", flush=True)
    if not passed:
        problems.append(path.stem)
        print("\n".join("       " + line for line in out.strip().splitlines()[-12:]))
    elif SHOW:
        print(out)

print(f"\n{total} checks in {len(exercises)} exercises")
if problems:
    sys.exit("FAILED: " + ", ".join(problems))
print("all exercises pass")
