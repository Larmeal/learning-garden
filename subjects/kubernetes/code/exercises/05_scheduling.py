"""Lesson 5 (Scheduler): how a Pod gets its node, and what stops it.

Asserts what the lesson prints:
  1. the scheduler writes spec.nodeName once; a Pod that requests more than any node has stays Pending with a FailedScheduling event that says why
  2. requests (not real use) are what the scheduler adds up: Pods fill a node until the sum of requests reaches its allocatable CPU
  3. nodeSelector, taints and tolerations: a taint keeps Pods away unless they tolerate it, a toleration does not attract a Pod
  4. topologySpreadConstraints spread the replicas over the nodes
  5. cordon stops new Pods; drain evicts the Pods of a node and a PodDisruptionBudget can make the drain wait
Run: python exercises/05_scheduling.py [--write]   (--write saves labs/kubernetes/scheduling.json for the scheduler lab)
"""

import json
import sys
import time

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

WRITE = "--write" in sys.argv
WORKERS = ["garden-m02", "garden-m03"]


def pod(name: str, extra_spec: str = "", resources: str = "", labels: str = "app: s") -> str:
    return f"""apiVersion: v1
kind: Pod
metadata: {{name: {name}, labels: {{{labels}}}}}
spec:
  terminationGracePeriodSeconds: 1
{extra_spec}  containers:
  - name: c
    image: {BUSYBOX}
    command: ["sleep", "3600"]
{resources}"""


def node_of(ns: str, name: str) -> str:
    return k("get", "pod", name, "-n", ns, "-o", "jsonpath={.spec.nodeName}", check=False)


def main() -> None:
    result: dict = {}
    nodes = {n["metadata"]["name"]: n for n in kj("get", "nodes")["items"]}
    alloc = {n: int(v["status"]["allocatable"]["cpu"]) * 1000 for n, v in nodes.items()}
    mem = {n: v["status"]["allocatable"]["memory"] for n, v in nodes.items()}
    print(f"  allocatable CPU (millicores): {alloc}")
    print(f"  allocatable memory: {mem}")
    result["allocatable"] = {n: {"cpu": alloc[n], "memory": mem[n]} for n in alloc}
    with namespace("sched") as ns:
        # ---- 1. nodeName and Pending ----------------------------------------------------------------------
        apply(pod("plain"), "-n", ns)
        wait_for(lambda: node_of(ns, "plain"), 60, 1, "node assigned")
        check("a normal Pod lands on a worker (the control plane is tainted)", node_of(ns, "plain") in WORKERS)
        apply(pod("huge", resources="    resources: {requests: {cpu: '64'}}\n"), "-n", ns)
        time.sleep(4)
        ph = k("get", "pod", "huge", "-n", ns, "-o", "jsonpath={.status.phase}")
        ev = k("get", "events", "-n", ns, "--field-selector", "involvedObject.name=huge,reason=FailedScheduling", "-o", "jsonpath={.items[0].message}")
        show("Pod that asks for 64 CPUs", f"phase={ph}\n{ev}")
        check("the Pod stays Pending and has no node", ph == "Pending" and node_of(ns, "huge") == "")
        check("the event names the missing resource and counts the nodes that failed each test", "Insufficient cpu" in ev and "untolerated taint" in ev)
        result["pending"] = {"phase": ph, "message": ev}
        k("delete", "pod", "huge", "-n", ns, "--wait=false")

        # ---- 2. requests fill a node ---------------------------------------------------------------------
        cpu_free = {}
        for n in WORKERS:
            d = k("describe", "node", n)
            line = [x for x in d.splitlines() if x.strip().startswith("cpu ") and "%" in x][0]
            cpu_free[n] = line.split()[1]
        print(f"  CPU already requested on each worker (by system Pods): {cpu_free}")
        def millis(text: str) -> int:
            return int(text[:-1]) if text.endswith("m") else int(float(text) * 1000)

        free = min(alloc[n] - millis(cpu_free[n]) for n in WORKERS)
        need = free * 2 // 5  # two Pods fit on a worker (0.8 of what is free), a third does not (1.2)
        apply(f"""apiVersion: apps/v1
kind: Deployment
metadata: {{name: fill}}
spec:
  replicas: 6
  selector: {{matchLabels: {{app: fill}}}}
  template:
    metadata: {{labels: {{app: fill}}}}
    spec:
      terminationGracePeriodSeconds: 1
      containers:
      - name: c
        image: {BUSYBOX}
        command: ["sleep", "3600"]
        resources: {{requests: {{cpu: {need}m}}}}
""", "-n", ns)
        time.sleep(8)
        ps = pods(ns, "app=fill")
        running = [p for p in ps if p["spec"].get("nodeName")]
        pending = [p for p in ps if not p["spec"].get("nodeName")]
        per_node = {n: sum(1 for p in running if p["spec"]["nodeName"] == n) for n in WORKERS}
        print(f"  6 Pods of {need}m CPU each (a worker has {free}m free): placed {len(running)} {per_node}, Pending {len(pending)}")
        check("each worker holds two Pods and the other two stay Pending", per_node == {"garden-m02": 2, "garden-m03": 2} and len(pending) == 2, str(per_node))
        result["fill"] = {"placed": len(running), "pending": len(pending), "perNode": per_node}
        k("delete", "deployment", "fill", "-n", ns, "--wait=true")

        # ---- 3. nodeSelector, taints, tolerations ---------------------------------------------------------
        k("label", "node", "garden-m03", "klab-disk=ssd", "--overwrite")
        apply(pod("wants-ssd", "  nodeSelector: {klab-disk: ssd}\n"), "-n", ns)
        wait_for(lambda: node_of(ns, "wants-ssd"), 60, 1, "wants-ssd scheduled")
        check("nodeSelector puts the Pod on the labelled node", node_of(ns, "wants-ssd") == "garden-m03")
        k("taint", "node", "garden-m03", "klab-team=data:NoSchedule", "--overwrite")
        k("taint", "node", "garden-m02", "klab-team=data:NoSchedule", "--overwrite")
        apply(pod("blocked"), "-n", ns)
        time.sleep(4)
        check("with both workers tainted a normal Pod is Pending (no node left)", node_of(ns, "blocked") == "")
        apply(pod("tolerant", "  tolerations: [{key: klab-team, operator: Equal, value: data, effect: NoSchedule}]\n"), "-n", ns)
        wait_for(lambda: node_of(ns, "tolerant"), 60, 1, "tolerant scheduled")
        check("a Pod with the toleration is allowed on a tainted worker", node_of(ns, "tolerant") in WORKERS)
        check("the earlier Pod that was already running stays (NoSchedule does not evict)", node_of(ns, "plain") in WORKERS and k("get", "pod", "plain", "-n", ns, "-o", "jsonpath={.status.phase}") == "Running")
        k("taint", "node", "garden-m03", "klab-team=data:NoSchedule-")
        k("taint", "node", "garden-m02", "klab-team=data:NoSchedule-")
        wait_for(lambda: node_of(ns, "blocked"), 60, 1, "blocked scheduled after the taint is gone")
        check("when the taints are removed the waiting Pod is scheduled by itself", node_of(ns, "blocked") in WORKERS)
        k("label", "node", "garden-m03", "klab-disk-")
        for n in ("plain", "wants-ssd", "blocked", "tolerant"):
            k("delete", "pod", n, "-n", ns, "--wait=false")

        # ---- 4. spread -------------------------------------------------------------------------------------
        def spread_yaml(honor: str) -> str:
            return f"""apiVersion: apps/v1
kind: Deployment
metadata: {{name: spread}}
spec:
  replicas: 6
  selector: {{matchLabels: {{app: spread}}}}
  template:
    metadata: {{labels: {{app: spread}}}}
    spec:
      terminationGracePeriodSeconds: 1
      topologySpreadConstraints:
      - maxSkew: 1
        topologyKey: kubernetes.io/hostname
        whenUnsatisfiable: DoNotSchedule
{honor}        labelSelector: {{matchLabels: {{app: spread}}}}
      containers:
      - name: c
        image: {BUSYBOX}
        command: ["sleep", "3600"]
"""
        apply(spread_yaml(""), "-n", ns)
        time.sleep(8)
        first = {n: sum(1 for p in pods(ns, "app=spread") if p["spec"].get("nodeName") == n) for n in WORKERS}
        stuck = sum(1 for p in pods(ns, "app=spread") if not p["spec"].get("nodeName"))
        print(f"  6 replicas with maxSkew 1, first try: {first}, Pending {stuck}")
        check("the control plane node counts as an empty domain, so only one Pod fits on each worker and four stay Pending", sorted(first.values()) == [1, 1] and stuck == 4, f"{first} {stuck}")
        apply(spread_yaml("        nodeTaintsPolicy: Honor\n"), "-n", ns)
        wait_for(lambda: len([p for p in pods(ns, "app=spread") if p["spec"].get("nodeName")]) == 6, 90, 1, "6 spread Pods")
        spread = {n: sum(1 for p in pods(ns, "app=spread") if p["spec"]["nodeName"] == n) for n in WORKERS}
        print(f"  with nodeTaintsPolicy: Honor: {spread}")
        check("with nodeTaintsPolicy: Honor the tainted node is left out and the 6 Pods split 3 and 3", sorted(spread.values()) == [3, 3])
        result["spread"] = spread

        # ---- 5. cordon, drain, PodDisruptionBudget ---------------------------------------------------------
        k("cordon", "garden-m02")
        status = k("get", "node", "garden-m02", "--no-headers")
        check("a cordoned node is SchedulingDisabled", "SchedulingDisabled" in status)
        k("scale", "deployment/spread", "--replicas=8", "-n", ns)
        time.sleep(4)
        on_cordoned = [p for p in pods(ns, "app=spread") if p["spec"].get("nodeName") == "garden-m02"]
        check("a cordoned node gets no new Pod (it keeps its three, the new ones are Pending or on the other worker)", len(on_cordoned) == 3)
        k("uncordon", "garden-m02")
        k("scale", "deployment/spread", "--replicas=6", "-n", ns)
        wait_for(lambda: len(pods(ns, "app=spread")) == 6, 60, 1, "6 Pods again")
        apply("apiVersion: policy/v1\nkind: PodDisruptionBudget\nmetadata: {name: spread-pdb}\nspec:\n  minAvailable: 6\n  selector: {matchLabels: {app: spread}}\n", "-n", ns)
        wait_for(lambda: len(ready_pods(ns, "app=spread")) == 6, 60, 1, "6 ready")
        t0 = time.time()
        d = kubectl("drain", "garden-m02", "--ignore-daemonsets", "--delete-emptydir-data", "--timeout=12s", check=False)
        print(f"  drain with minAvailable=6 of 6: exit {d.returncode} after {time.time() - t0:.0f}s")
        show("drain output (tail)", "\n".join((d.stdout + d.stderr).strip().splitlines()[-3:]))
        check("the PodDisruptionBudget makes the drain wait and then fail", d.returncode != 0 and "disrupt" in (d.stdout + d.stderr).lower())
        k("delete", "pdb", "spread-pdb", "-n", ns)
        d = kubectl("drain", "garden-m02", "--ignore-daemonsets", "--delete-emptydir-data", "--timeout=60s", check=False)
        wait_for(lambda: len(ready_pods(ns, "app=spread")) == 6, 60, 1, "6 ready again")
        left = {n: sum(1 for p in pods(ns, "app=spread") if p["spec"]["nodeName"] == n) for n in WORKERS}
        print(f"  after the drain: {left}")
        check("after the drain no Pod of the Deployment runs on the drained node and all 6 are Ready elsewhere", left["garden-m02"] == 0 and left["garden-m03"] == 6)
        k("uncordon", "garden-m02")
        result["drain"] = left

    if WRITE:
        write_json(LABS / "scheduling.json", result)


main_guard(main)
json  # noqa: B018
