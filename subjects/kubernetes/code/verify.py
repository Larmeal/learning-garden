"""Runs every Kubernetes exercise and checks that each one finishes with its own `ok` line.

The exercises talk to a real cluster through `kubectl`: a three node minikube cluster (profile `garden`, Docker driver with Docker Desktop, containerd, Kubernetes v1.31.0,
one control plane node and two workers). If the profile is not running, the first exercise starts it (several minutes the first time: minikube downloads the node image and Kubernetes).
Two addons are needed, and are not enabled by the exercises because enabling them takes minutes and a taint workaround (see docs/overview.md):

    minikube addons enable ingress        -p garden     (ingress-nginx v1.11.2, used by 07b)
    minikube addons enable metrics-server -p garden     (metrics-server v0.7.2, used by 14)

and `helm` v3 on PATH (written with v3.13.3). Each exercise labels what it makes `klab=1` and removes it, and uses its own kubeconfig (code/out/garden.kubeconfig), so the other
kubeconfig contexts of the computer are not touched.

Run: python verify.py          (or: uv run python verify.py)   add --show to print the output of each exercise,
     or exercise numbers to run only those: python verify.py 01 07b
Takes about 25 minutes: the exercises wait for rollouts, for a node to go NotReady (about 45 s), for a CronJob to fire, for the kubelet to sync a ConfigMap (about 90 s),
for the HPA to read metrics (about 80 s) and to scale down (about 2 minutes).
Do not run a build or a crawl at the same time: the timing checks (rollout, NotReady, throttling) are sensitive to CPU.
"""

import re
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).parent
SHOW = "--show" in sys.argv
sys.path.insert(0, str(HERE))
import klab  # noqa: E402

if sys.version_info < (3, 12):
    sys.exit("Python 3.12 or newer is needed")

try:
    klab.ensure_cluster()
    server = klab.k("version", "-o", "json")
except SystemExit as e:
    sys.exit(f"cannot reach the garden cluster: {e}")
import json  # noqa: E402

v = json.loads(server)
print(f"kubectl client {v['clientVersion']['gitVersion']} | server {v['serverVersion']['gitVersion']} | nodes {klab.k('get', 'nodes', '--no-headers').count(' Ready')} Ready")
if v["serverVersion"]["gitVersion"] != klab.VERSION:
    print(f"WARNING: expected server {klab.VERSION} (what the lessons were written with); a failing check below may be a changed message and not a mistake")
for what, cmd in (("ingress-nginx", ["get", "pods", "-n", "ingress-nginx", "-l", "app.kubernetes.io/component=controller", "--no-headers"]), ("metrics-server", ["get", "pods", "-n", "kube-system", "-l", "k8s-app=metrics-server", "--no-headers"])):
    if "Running" not in klab.k(*cmd, check=False):
        print(f"WARNING: {what} is not running; the exercise that needs it will fail (see the top of this file)")
helm = subprocess.run(["helm", "version", "--short"], capture_output=True, text=True)
print("helm:", helm.stdout.strip() or "NOT FOUND (exercise 14 will fail)")

problems: list[str] = []
exercises = sorted((HERE / "exercises").glob("[0-9][0-9]*_*.py"))
only = [x for x in sys.argv[1:] if not x.startswith("--")]
if only:
    exercises = [p for p in exercises if any(p.stem.startswith(x + "_") for x in only)]
print(f"\n{len(exercises)} exercises")
total = 0
for path in exercises:
    started = time.time()
    done = subprocess.run([sys.executable, str(path)], cwd=HERE, capture_output=True, text=True, encoding="utf-8", errors="replace")
    out = done.stdout + done.stderr
    checks = len(re.findall(r"^  ok   ", out, flags=re.M))
    total += checks
    passed = done.returncode == 0 and out.rstrip().endswith("ok") and not re.search(r"^(  FAIL |FAILED:|TIMEOUT)", out, flags=re.M)  # helm prints "UPGRADE FAILED" on purpose, so look for our own markers only
    print(f"  {'PASS' if passed else 'FAIL'}  {path.stem:28} {checks:3} checks  {time.time() - started:6.1f}s", flush=True)
    if not passed:
        problems.append(path.stem)
        print("\n".join("       " + line for line in out.strip().splitlines()[-12:]))
    elif SHOW:
        print(out)

print(f"\n{total} checks in {len(exercises)} exercises")
if problems:
    sys.exit("FAILED: " + ", ".join(problems))
print("all exercises pass")
