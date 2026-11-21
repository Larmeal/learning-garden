"""Lesson 4 (Deployment): ReplicaSets, rolling updates, rollback and what a stuck rollout looks like.

Asserts what the lesson prints:
  1. a Deployment owns a ReplicaSet and the ReplicaSet owns the Pods (ownerReferences); deleting a Pod makes the ReplicaSet create another
  2. a change of the Pod template makes a second ReplicaSet and the Deployment moves Pods between them in steps limited by maxSurge and maxUnavailable
  3. during the update there were never more than replicas+maxSurge Pods and never fewer than replicas-maxUnavailable Ready Pods
  4. `strategy: Recreate` leaves a moment with no Ready Pod
  5. a bad image never becomes Ready, the old Pods keep serving, the Deployment reports ProgressDeadlineExceeded, and `rollout undo` brings the old ReplicaSet back
Run: python exercises/04_deployments.py [--write]   (--write saves labs/kubernetes/rollout.json for the rollout lab)
"""

import sys
import time

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

WRITE = "--write" in sys.argv

DEP = """apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
spec:
  replicas: 4
  progressDeadlineSeconds: {deadline}
  strategy:
{strategy}
  selector:
    matchLabels: {{app: app}}
  template:
    metadata:
      labels: {{app: app}}
    spec:
      terminationGracePeriodSeconds: 1
      containers:
      - name: app
        image: {image}
        env: [{{name: VERSION, value: "{version}"}}]
        command: ["sh", "-c", "mkdir -p /www; echo \\"v$VERSION from $(hostname)\\" > /www/index.html; exec httpd -f -p 8080 -h /www"]
        readinessProbe:
          httpGet: {{path: /, port: 8080}}
          initialDelaySeconds: 3
          periodSeconds: 1
"""
ROLLING = "    type: RollingUpdate\n    rollingUpdate: {maxSurge: 1, maxUnavailable: 1}"
RECREATE = "    type: Recreate"


def manifest(version: str, strategy: str = ROLLING, image: str = BUSYBOX, deadline: int = 600) -> str:
    return DEP.format(version=version, strategy=strategy, image=image, deadline=deadline)


def rs_state(ns: str) -> list[dict]:
    """One entry per ReplicaSet: revision, how many Pods it wants and has, how many are Ready."""
    out = []
    for rs in kj("get", "rs", "-n", ns)["items"]:
        out.append({
            "name": rs["metadata"]["name"],
            "revision": int(rs["metadata"]["annotations"].get("deployment.kubernetes.io/revision", "0")),
            "desired": rs["spec"]["replicas"],
            "total": rs["status"].get("replicas", 0),
            "ready": rs["status"].get("readyReplicas", 0),
            "image": rs["spec"]["template"]["spec"]["containers"][0]["image"],
        })
    return sorted(out, key=lambda r: r["revision"])


def watch_rollout(ns: str, until, limit: float = 90) -> list[dict]:
    """Sample the ReplicaSets about every half second until `until(sample)` is true; return the samples with a time."""
    samples: list[dict] = []
    t0 = time.time()
    while time.time() - t0 < limit:
        rs = rs_state(ns)
        s = {"t": round(time.time() - t0, 1), "rs": [{k: v for k, v in r.items() if k in ("revision", "total", "ready")} for r in rs if r["total"] or r["desired"]]}
        if not samples or samples[-1]["rs"] != s["rs"]:
            samples.append(s)
        if until(rs):
            break
        time.sleep(0.3)
    return samples


def main() -> None:
    result: dict = {}
    with namespace("deploy") as ns:
        # ---- 1. ownership ---------------------------------------------------------------------------------
        apply(manifest("1"), "-n", ns)
        wait_for(lambda: len(ready_pods(ns, "app=app")) == 4, 120, 1, "4 ready Pods")
        dep = kj("get", "deployment", "app", "-n", ns)
        rs = kj("get", "rs", "-n", ns)["items"]
        pod = pods(ns, "app=app")[0]
        print(f"  Pod {pod['metadata']['name']}  ownedBy ReplicaSet {pod['metadata']['ownerReferences'][0]['name']}")
        print(f"  ReplicaSet {rs[0]['metadata']['name']}  ownedBy Deployment {rs[0]['metadata']['ownerReferences'][0]['name']}")
        check("the Pod is owned by a ReplicaSet and the ReplicaSet by the Deployment", pod["metadata"]["ownerReferences"][0]["kind"] == "ReplicaSet" and rs[0]["metadata"]["ownerReferences"][0]["kind"] == "Deployment")
        check("the Pod name is the ReplicaSet name plus a suffix, the ReplicaSet name is the Deployment name plus the template hash", pod["metadata"]["name"].startswith(rs[0]["metadata"]["name"]) and rs[0]["metadata"]["name"].startswith("app-"))
        check("status counts 4 ready replicas", dep["status"]["readyReplicas"] == 4)

        # ---- 2 and 3. a rolling update with surge 1 and unavailable 1 -----------------------------------------
        apply(manifest("2"), "-n", ns)
        samples = watch_rollout(ns, lambda rs: len(rs) == 2 and rs[1]["ready"] == 4 and rs[0]["total"] == 0, 90)
        for s in samples[:14]:
            print(f"  t={s['t']:>4}  " + "   ".join(f"rev{r['revision']}: {r['total']} pods, {r['ready']} ready" for r in s["rs"]))
        final = rs_state(ns)
        check("two ReplicaSets now exist, the old one has 0 Pods and the new one 4", len(final) == 2 and final[0]["total"] == 0 and final[1]["ready"] == 4)
        peak = max(sum(r["total"] for r in s["rs"]) for s in samples)
        low = min(sum(r["ready"] for r in s["rs"]) for s in samples)
        print(f"  most Pods at once: {peak} (replicas 4 + maxSurge 1); fewest Ready Pods: {low} (replicas 4 - maxUnavailable 1)")
        check("never more than replicas+maxSurge Pods", peak <= 5, str(peak))
        check("never fewer than replicas-maxUnavailable Ready Pods", low >= 3, str(low))
        check("the update really used the whole allowance (surge reached)", peak == 5)
        hist = k("rollout", "history", "deployment/app", "-n", ns)
        show("kubectl rollout history", hist)
        check("history lists revisions 1 and 2", "\n1 " in "\n" + hist and "\n2 " in "\n" + hist)
        result["rolling"] = {"samples": samples, "peak": peak, "low": low}

        # ---- 5a. rollback ------------------------------------------------------------------------------------
        k("rollout", "undo", "deployment/app", "-n", ns)
        wait_for(lambda: (lambda r: r[-1]["revision"] == 3 and r[-1]["ready"] == 4 and sum(x["total"] for x in r[:-1]) == 0)(rs_state(ns)), 90, 1, "rollback finished")
        out = k("get", "pods", "-n", ns, "-l", "app=app", "-o", "jsonpath={.items[*].metadata.name}").split()
        text = k("exec", out[0], "-n", ns, "--", "wget", "-qO-", "http://localhost:8080/")
        print(f"  after rollout undo a Pod answers: {text}")
        check("undo goes back to the template of revision 1 (the same ReplicaSet is reused, as revision 3)", text.startswith("v1 ") and len(rs_state(ns)) == 2)

        # ---- 4. Recreate -------------------------------------------------------------------------------------
        apply(manifest("3", RECREATE), "-n", ns)
        samples_r = watch_rollout(ns, lambda rs: rs[-1]["ready"] == 4 and sum(r["total"] for r in rs[:-1]) == 0 and rs[-1]["revision"] >= 4, 90)
        low_r = min(sum(r["ready"] for r in s["rs"]) for s in samples_r)
        print(f"  Recreate: fewest Ready Pods during the update: {low_r}")
        check("Recreate stops every old Pod before it starts a new one", low_r == 0)
        result["recreate"] = {"samples": samples_r, "low": low_r}

        # ---- 5b. a bad image --------------------------------------------------------------------------------
        apply(manifest("4", ROLLING, "busybox:no-such-tag", deadline=20), "-n", ns)
        wait_for(lambda: any(c["type"] == "Progressing" and c["reason"] == "ProgressDeadlineExceeded" for c in kj("get", "deployment", "app", "-n", ns)["status"].get("conditions", [])), 90, 2, "ProgressDeadlineExceeded")
        status = kubectl("rollout", "status", "deployment/app", "-n", ns, "--timeout=5s", check=False)
        pod_rows = k("get", "pods", "-n", ns, "-l", "app=app", "--no-headers", "-o", "custom-columns=NAME:.metadata.name,READY:.status.containerStatuses[0].ready,STATE:.status.containerStatuses[0].state.waiting.reason")
        show("kubectl get pods (bad image)", pod_rows)
        ready_now = len(ready_pods(ns, "app=app"))
        print(f"  Ready Pods while the rollout is stuck: {ready_now}; rollout status exit code {status.returncode}")
        check("the new Pods wait in ErrImagePull or ImagePullBackOff", "ImagePullBackOff" in pod_rows or "ErrImagePull" in pod_rows)
        check("the old Pods keep serving: 3 Ready (replicas 4 minus maxUnavailable 1)", ready_now == 3, str(ready_now))
        check("kubectl rollout status does not report success and the Deployment says ProgressDeadlineExceeded", status.returncode != 0)
        k("rollout", "undo", "deployment/app", "-n", ns)
        wait_for(lambda: len(ready_pods(ns, "app=app")) == 4 and not any(r["total"] and "no-such-tag" in r["image"] for r in rs_state(ns)), 120, 2, "recovered")
        check("after undo 4 Pods are Ready again", len(ready_pods(ns, "app=app")) == 4)
        result["stuck"] = {"readyWhileStuck": ready_now}

    if WRITE:
        write_json(LABS / "rollout.json", result)


main_guard(main)
