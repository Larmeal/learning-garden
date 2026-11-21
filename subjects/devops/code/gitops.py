"""A very small GitOps controller, used by exercises 07 and 13.

The desired state is a JSON file in a Git repository (`desired.json`). `reconcile` reads it from the main branch of that
repository, looks at the Docker containers that carry the label `devops-gitops=<group>`, and makes the second match the
first: it creates what is missing, replaces what was built from another spec, and removes what nobody asked for.
It is a model of the loop that Argo CD and Flux run against Kubernetes, not a replacement for them.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

IMAGE = "alpine:3.22"


def _docker(*args: str) -> str:
    done = subprocess.run(["docker", *args], capture_output=True)
    if done.returncode != 0:
        raise RuntimeError(done.stderr.decode(errors="replace"))
    return done.stdout.decode(errors="replace").strip()


def spec_hash(service: dict) -> str:
    wanted = {"image": service.get("image", IMAGE), "version": service["version"], "env": service.get("env", {}), "cmd": service.get("cmd")}
    return hashlib.sha256(json.dumps(wanted, sort_keys=True).encode()).hexdigest()[:8]


def desired_state(repo: Path, rev: str = "main") -> list[dict]:
    """The containers that the repository asks for, one entry per replica."""
    done = subprocess.run(["git", "--git-dir", str(repo), "show", f"{rev}:desired.json"], capture_output=True, check=True)
    services = json.loads(done.stdout)["services"]
    out = []
    for service in services:
        for n in range(1, service["replicas"] + 1):
            out.append({"name": f"{service['name']}-{n}", "service": service["name"], "spec": spec_hash(service), "version": service["version"], "env": service.get("env", {}), "image": service.get("image", IMAGE), "cmd": service.get("cmd"), "port": service["port_base"] + n if service.get("port_base") else None})
    return out


def actual_state(group: str) -> list[dict]:
    text = _docker("ps", "-a", "--filter", f"label=devops-gitops={group}", "--format", "{{.Names}}|{{.Label \"devops-spec\"}}|{{.Label \"devops-version\"}}|{{.State}}")
    out = []
    for line in text.splitlines():
        name, spec, version, state = line.split("|")
        out.append({"name": name.removeprefix(f"{group}-"), "spec": spec, "version": version, "state": state})
    return out


def plan(desired: list[dict], actual: list[dict]) -> list[tuple[str, str]]:
    have = {a["name"]: a for a in actual}
    want = {d["name"]: d for d in desired}
    steps: list[tuple[str, str]] = []
    for name, d in sorted(want.items()):
        a = have.get(name)
        if a is None:
            steps.append(("create", name))
        elif a["spec"] != d["spec"] or a["state"] != "running":
            steps.append(("replace", name))
    for name in sorted(have):
        if name not in want:
            steps.append(("remove", name))
    return steps


def apply(group: str, desired: list[dict], steps: list[tuple[str, str]]) -> None:
    want = {d["name"]: d for d in desired}
    for action, name in steps:
        if action in ("replace", "remove"):
            _docker("rm", "-f", f"{group}-{name}")
        if action in ("create", "replace"):
            d = want[name]
            args = ["run", "-d", "--name", f"{group}-{name}", "--label", f"devops-gitops={group}", "--label", f"devops-spec={d['spec']}", "--label", f"devops-version={d['version']}"]
            for k, v in d["env"].items():
                args += ["-e", f"{k}={v}"]
            if d.get("port"):
                args += ["-p", f"127.0.0.1:{d['port']}:8000"]
            _docker(*args, d["image"], *(d.get("cmd") or ["sleep", "600"]))


def reconcile(group: str, repo: Path, rev: str = "main") -> list[tuple[str, str]]:
    """One turn of the loop: read the desired state, compare, act. Returns the steps it took."""
    desired = desired_state(repo, rev)
    steps = plan(desired, actual_state(group))
    apply(group, desired, steps)
    return steps


def cleanup(group: str) -> None:
    names = _docker("ps", "-a", "-q", "--filter", f"label=devops-gitops={group}")
    if names:
        subprocess.run(["docker", "rm", "-f", *names.split()], capture_output=True)
