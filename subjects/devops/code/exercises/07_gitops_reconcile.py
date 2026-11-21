"""Lesson 7: orchestration as a loop, and GitOps as "the repository is the truth".

`gitops.py` is a small controller: it reads `desired.json` from the main branch of a Git repository, looks at the Docker
containers of its group and makes them match. This is the loop that Kubernetes controllers and Argo CD run, drawn small
enough to see (Kubernetes itself and Argo CD were not run). Asserts: the first pass creates what the repository asks for,
the second does nothing, a container removed by hand comes back, a container started by hand is removed, a commit that
bumps the version replaces exactly the containers built from the old spec, and `git revert` is the rollback.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from devlab import HERE, check, commit_all, docker, docker_ok, git, init, reset_clock, run, show, write  # noqa: E402

sys.path.insert(0, str(HERE))
from gitops import actual_state, cleanup, reconcile  # noqa: E402

NL = chr(10)
GROUP = "devops07"
if not docker_ok():
    sys.exit("Docker is not running")


def desired_file(web_version: str, web_replicas: int) -> str:
    return json.dumps(
        {"services": [{"name": "web", "version": web_version, "replicas": web_replicas}, {"name": "worker", "version": "1", "replicas": 1}]}, indent=2
    ) + NL


def summary() -> dict[str, str]:
    return {a["name"]: f"v{a['version']}" for a in actual_state(GROUP)}


def fmt(steps) -> str:
    return NL.join(f"  {a:8} {n}" for a, n in steps) or "  (nothing to do)"


reset_clock()
cleanup(GROUP)
remote = init("07_config_repo", bare=True)
git(remote, "symbolic-ref", "HEAD", "refs/heads/main")
clone = init("07_config_clone")
git(clone, "remote", "add", "origin", str(remote))
try:
    # ---- 1. first pass: the cluster is empty ----
    write(clone, "desired.json", desired_file("1", 2))
    c1 = commit_all(clone, "web v1 x2, worker v1 x1")
    git(clone, "push", "-q", "origin", "main")
    steps = reconcile(GROUP, remote)
    show("reconcile #1", fmt(steps))
    check("three containers are created, as the file says", [a for a, _ in steps] == ["create"] * 3 and sorted(n for _, n in steps) == ["web-1", "web-2", "worker-1"])
    state_v1 = summary()
    check("the cluster now matches the repository", state_v1 == {"web-1": "v1", "web-2": "v1", "worker-1": "v1"}, str(state_v1))

    # ---- 2. converged: nothing to do ----
    steps = reconcile(GROUP, remote)
    show("reconcile #2", fmt(steps))
    check("a second pass finds nothing to do", steps == [])

    # ---- 3. self-healing: someone deletes a container ----
    docker("rm", "-f", f"{GROUP}-web-2")
    check("web-2 is gone", "web-2" not in summary())
    steps = reconcile(GROUP, remote)
    show("reconcile #3 (web-2 was removed by hand)", fmt(steps))
    check("the loop creates web-2 again", steps == [("create", "web-2")])

    docker("stop", f"{GROUP}-web-1")
    steps = reconcile(GROUP, remote)
    show("reconcile #3b (web-1 was stopped by hand)", fmt(steps))
    check("a container that is not running is replaced too", steps == [("replace", "web-1")])

    # ---- 4. drift the other way: someone starts something that nobody asked for ----
    docker("run", "-d", "--name", f"{GROUP}-debug-1", "--label", f"devops-gitops={GROUP}", "--label", "devops-spec=hand", "--label", "devops-version=0", "alpine:3.22", "sleep", "600")
    steps = reconcile(GROUP, remote)
    show("reconcile #4 (debug-1 was started by hand)", fmt(steps))
    check("the loop removes what is not in the repository", steps == [("remove", "debug-1")])
    check("the cluster is back to v1", summary() == state_v1)

    # ---- 5. a change goes through Git: web v2 with three replicas ----
    write(clone, "desired.json", desired_file("2", 3))
    c2 = commit_all(clone, "release web v2, three replicas")
    git(clone, "push", "-q", "origin", "main")
    steps = reconcile(GROUP, remote)
    show("reconcile #5 (after the commit that bumps web to v2)", fmt(steps))
    check("web-1 and web-2 are replaced and web-3 is created, the worker is left alone", steps == [("replace", "web-1"), ("replace", "web-2"), ("create", "web-3")], str(steps))
    check("the cluster runs v2", summary() == {"web-1": "v2", "web-2": "v2", "web-3": "v2", "worker-1": "v1"}, str(summary()))
    check("one more pass: converged again", reconcile(GROUP, remote) == [])

    # ---- 6. rollback is a revert ----
    git(clone, "revert", "--no-edit", "HEAD")
    git(clone, "push", "-q", "origin", "main")
    steps = reconcile(GROUP, remote)
    show("reconcile #6 (after git revert)", fmt(steps))
    check("the revert removes the third replica and replaces the other two", steps == [("replace", "web-1"), ("replace", "web-2"), ("remove", "web-3")], str(steps))
    check("the cluster is exactly what it was before the release", summary() == state_v1, str(summary()))
    log = git(clone, "log", "--format=%s")
    show("git log (the audit trail)", log)
    check("the history says what changed and when: three commits, the last is the revert", log.splitlines()[0].startswith('Revert "release web v2') and len(log.splitlines()) == 3)
    check("the commit that is running now can be named (git rev-parse of the repository main)", len(git(remote, "rev-parse", "main")) == 40)
finally:
    cleanup(GROUP)
print("ok")
