"""Runs every Networking exercise and checks that each one finishes with its own `ok` line.

The exercises build small networks out of Linux network namespaces, so they need a Linux kernel with root. From Windows they run inside WSL (`wsl.exe -u root`, no password), and
`netlab.linux()` does that for them. The lessons were written with Ubuntu 22.04 in WSL2 (kernel 6.18), Python 3.10 there, iproute2 5.15, iptables 1.8.7 (nf_tables), tcpdump 4.99 and OpenSSL 3.0.2. Exercise 12
also needs two libraries for the Python 3.10 of that Linux, which are not committed (`code/vendor/` is ignored by git): make them once, from this folder, with
    uv pip install --target vendor --python-platform x86_64-manylinux_2_28 --python-version 3.10 h2 aioquic
(the lessons were checked with h2 4.4.1 and aioquic 1.3.0).

Run: python verify.py          (or: uv run python verify.py)   add --show to print the output of each exercise,
     or exercise numbers to run only those: python verify.py 01 06
Takes several minutes: every exercise builds a network, runs real programs on it and captures with tcpdump.
"""

import re
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).parent
SHOW = "--show" in sys.argv

if sys.version_info < (3, 12):
    sys.exit("Python 3.12 or newer is needed (it runs on Windows or Linux; the lab scripts run in the Python of the Linux)")

# what the lessons were written against, and what this computer has
probe = "python3 --version; uname -r; ip -V; iptables -V; tcpdump --version 2>&1 | head -1; python3 -c 'import ssl;print(ssl.OPENSSL_VERSION)'"
cmd = ["wsl.exe", "-u", "root", "-e", "bash", "-lc", probe] if sys.platform == "win32" else ["sudo", "bash", "-lc", probe]
try:
    got = subprocess.run(cmd, capture_output=True, timeout=60).stdout.decode("utf-8", "replace").replace("\x00", "").strip().splitlines()
except Exception as e:  # noqa: BLE001
    sys.exit(f"cannot run the Linux side: {e}")
print("Linux side:\n  " + "\n  ".join(got))
want = {"Python 3.10": "python3", "iproute2-5.15": "ip utility", "iptables v1.8.7": "iptables", "OpenSSL 3.0.2": "OpenSSL"}
for needle in want:
    if not any(needle in line for line in got):
        print(f"WARNING: expected '{needle}' (what the lessons were written with); a failing check below may be a changed message and not a mistake")

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
