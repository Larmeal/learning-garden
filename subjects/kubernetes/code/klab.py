"""Helpers shared by the Kubernetes exercises.

Every exercise talks to a real cluster through `kubectl`: a three node minikube cluster (profile `garden`, Docker driver, containerd, Kubernetes v1.31.0, one control plane and
two workers) that runs inside Docker Desktop. The cluster is the owner's own `minikube` install; nothing is downloaded by these helpers except what minikube and the images need.

Everything an exercise creates is a namespace `klab-<name>` labelled `klab=1` (or a cluster scoped object with the same label), and `cleanup()` deletes them, so the other
minikube profiles and kubeconfig contexts of the computer are never touched: this module uses its own kubeconfig file (`out/garden.kubeconfig`) through `KUBECONFIG`.
"""

import contextlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from collections.abc import Callable
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
PROFILE = "garden"
VERSION = "v1.31.0"
KUBECONFIG = OUT / "garden.kubeconfig"
LABEL = "klab=1"
NODES = ["garden", "garden-m02", "garden-m03"]
BUSYBOX = "busybox:1.37"
NGINX = "nginx:1.28-alpine"
ALPINE = "alpine:3.22"
POSTGRES = "postgres:17-alpine"
PY = "python:3.13-alpine"
CURL = "curlimages/curl:8.11.1"
IMAGES = [BUSYBOX, NGINX, ALPINE, CURL, POSTGRES]
LABS = HERE.parent.parent.parent / "site" / "src" / "components" / "labs" / "kubernetes"


def _env() -> dict:
    env = dict(os.environ)
    OUT.mkdir(exist_ok=True)
    env["KUBECONFIG"] = str(KUBECONFIG)
    env["MINIKUBE_WANTUPDATENOTIFICATION"] = "false"
    return env


def run_cmd(cmd: list[str], input: str | None = None, check: bool = True, timeout: int = 600) -> subprocess.CompletedProcess:
    done = subprocess.run(cmd, input=input, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout, env=_env())
    if check and done.returncode != 0:
        sys.exit(f"FAILED: {' '.join(cmd)}\n{done.stdout}\n{done.stderr}")
    return done


def kubectl(*args: str, input: str | None = None, check: bool = True, timeout: int = 300) -> subprocess.CompletedProcess:
    return run_cmd(["kubectl", *args], input=input, check=check, timeout=timeout)


def k(*args: str, **kw) -> str:
    """Run `kubectl <args>` and return stdout without the trailing newline."""
    return kubectl(*args, **kw).stdout.rstrip("\n")


def kj(*args: str, **kw) -> dict:
    """`kubectl <args> -o json`, parsed."""
    return json.loads(k(*args, "-o", "json", **kw))


def apply(manifest: str, *extra: str) -> str:
    return k("apply", "-f", "-", *extra, input=manifest)


def node_sh(node: str, script: str, check: bool = True) -> str:
    """Run a shell script inside a node (a Docker container of the minikube cluster) and return stdout and stderr."""
    done = run_cmd(["docker", "exec", node, "sh", "-c", script], check=check)
    return (done.stdout + done.stderr).rstrip("\n")


def wait_for(cond: Callable[[], object], timeout: float = 120, every: float = 1.0, what: str = "condition"):
    """Poll `cond` until it returns something truthy, then return that value; fail with `what` when time runs out."""
    end = time.time() + timeout
    last = None
    while time.time() < end:
        try:
            last = cond()
        except Exception as e:  # noqa: BLE001
            last = e
        if last and not isinstance(last, Exception):
            return last
        time.sleep(every)
    sys.exit(f"TIMEOUT after {timeout}s waiting for {what} (last: {last!r})")


def ns_name(suffix: str) -> str:
    return f"klab-{suffix}"


@contextlib.contextmanager
def namespace(suffix: str, labels: dict[str, str] | None = None):
    """A fresh labelled namespace for one exercise, deleted at the end."""
    name = ns_name(suffix)
    k("delete", "namespace", name, "--ignore-not-found", "--wait=true", "--timeout=180s", check=False)
    extra = "".join(f"\n    {a}: \"{b}\"" for a, b in (labels or {}).items())
    apply(f"apiVersion: v1\nkind: Namespace\nmetadata:\n  name: {name}\n  labels:\n    klab: \"1\"{extra}\n")
    wait_for(lambda: k("get", "serviceaccount", "default", "-n", name, check=False), 60, what="default service account")
    try:
        yield name
    finally:
        k("delete", "namespace", name, "--ignore-not-found", "--wait=false", check=False)


def cleanup() -> None:
    """Delete every namespace and every cluster scoped object that an exercise labelled klab=1."""
    if not KUBECONFIG.exists():
        return
    k("delete", "namespace", "-l", LABEL, "--ignore-not-found", "--wait=true", "--timeout=240s", check=False)
    for kind in ("clusterrolebinding", "clusterrole", "persistentvolume", "validatingadmissionpolicybinding", "validatingadmissionpolicy", "customresourcedefinition", "storageclass"):
        k("delete", kind, "-l", LABEL, "--ignore-not-found", "--wait=true", "--timeout=120s", check=False)


def ensure_cluster() -> None:
    """Start the `garden` minikube profile if it is not running, point our own kubeconfig at it and warm the images on every node."""
    status = run_cmd(["minikube", "status", "-p", PROFILE, "-o", "json"], check=False)
    running = status.returncode == 0 and status.stdout.count('"Host":"Running"') == 3
    if not running or not KUBECONFIG.exists():
        print(f"starting minikube profile {PROFILE} (3 nodes, {VERSION}); the first start downloads the node image and takes several minutes", flush=True)
        run_cmd(
            ["minikube", "start", "-p", PROFILE, "--nodes", "3", "--driver=docker", "--container-runtime=containerd", f"--kubernetes-version={VERSION}", "--cpus=2", "--memory=2200"],
            timeout=1800,
        )
    run_cmd(["minikube", "update-context", "-p", PROFILE], check=False)
    wait_for(lambda: k("get", "nodes", "--no-headers", check=False).count(" Ready") == 3, 180, 3, "three Ready nodes")
    # kubeadm taints the control plane node with NoSchedule; minikube does not (found on the first run), so do it here to get a cluster that behaves like a normal one.
    if "node-role.kubernetes.io/control-plane" not in k("get", "node", NODES[0], "-o", "jsonpath={.spec.taints[*].key}"):
        print("note: minikube left the control plane node without the kubeadm taint; adding node-role.kubernetes.io/control-plane:NoSchedule", flush=True)
        k("taint", "node", NODES[0], "node-role.kubernetes.io/control-plane:NoSchedule", "--overwrite")
    for node in NODES:
        for image in IMAGES:
            ref = f"docker.io/{image}" if "/" in image else f"docker.io/library/{image}"
            have = node_sh(node, f"crictl images -q {ref} 2>/dev/null | head -1", check=False)
            if not have:
                node_sh(node, f"crictl pull {ref}", check=False)


def check(label: str, ok: bool, detail: str = "") -> None:
    """Print one result line and fail loudly, because the lessons quote these results."""
    print(f"  {'ok  ' if ok else 'FAIL'} {label}" + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        sys.exit(f"FAILED: {label} {detail}")


def show(title: str, text: str = "") -> None:
    print(f"\n$ {title}" if title else "")
    if text:
        print("\n".join("  " + line for line in str(text).splitlines()))


def table(rows: list[list], headers: list[str]) -> str:
    cells = [[str(c) for c in r] + [""] * (len(headers) - len(r)) for r in rows]
    widths = [max(len(h), *(len(r[i]) for r in cells)) for i, h in enumerate(headers)]
    line = lambda r: "  ".join(c.ljust(w) for c, w in zip(r, widths)).rstrip()  # noqa: E731
    return "\n".join([line(headers), line(["-" * w for w in widths]), *(line(r) for r in cells)])


def timed(fn):
    t = time.perf_counter()
    value = fn()
    return value, time.perf_counter() - t


def fresh_dir(label: str) -> Path:
    root = Path(tempfile.gettempdir()) / "kubernetes-lessons" / label
    if root.exists():
        shutil.rmtree(root, ignore_errors=True)
    root.mkdir(parents=True)
    return root


def write_json(path: Path, data: object) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  wrote {path.relative_to(LABS.parents[3])}")


def pods(ns: str, selector: str | None = None) -> list[dict]:
    args = ["get", "pods", "-n", ns]
    if selector:
        args += ["-l", selector]
    return kj(*args)["items"]


def pod_phase_counts(ns: str, selector: str | None = None) -> dict[str, int]:
    out: dict[str, int] = {}
    for p in pods(ns, selector):
        out[p["status"]["phase"]] = out.get(p["status"]["phase"], 0) + 1
    return out


def ready_pods(ns: str, selector: str | None = None) -> list[str]:
    names = []
    for p in pods(ns, selector):
        conds = {c["type"]: c["status"] for c in p["status"].get("conditions", [])}
        if conds.get("Ready") == "True" and not p["metadata"].get("deletionTimestamp"):
            names.append(p["metadata"]["name"])
    return names


def main_guard(fn) -> None:
    """Run an exercise, always clean up, and end with the `ok` line that verify.py looks for."""
    try:
        ensure_cluster()
        cleanup()
        fn()
    finally:
        cleanup()
    print("\nok")


__all__ = [n for n in dir() if not n.startswith("_")]
