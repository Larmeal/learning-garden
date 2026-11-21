"""Lesson 1 (why Kubernetes): what a cluster is made of, and what "desired state" does when something dies.

Asserts what the lesson prints:
  1. the cluster has one control plane node and two workers, and which system Pods run where
  2. a Deployment with 3 replicas puts the Pods on the nodes, and a deleted Pod is replaced by a Pod with a new name
  3. scaling is only a change of one number in the spec
  4. a container that dies inside a Pod is restarted by the kubelet (the Pod stays), a Pod that is deleted is replaced by a controller (a new Pod)
  5. a node that stops is noticed, its Pods are replaced on the other nodes (with `tolerationSeconds` shortened to 10 so that the exercise does not wait 5 minutes)
Run: python exercises/01_cluster.py [--write]   (--write saves labs/kubernetes/cluster.json for the cluster lab)
"""

import sys
import time

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

WRITE = "--write" in sys.argv

WEB = """apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  labels: {{app: web}}
spec:
  replicas: {replicas}
  selector:
    matchLabels: {{app: web}}
  template:
    metadata:
      labels: {{app: web}}
    spec:
      terminationGracePeriodSeconds: 1
      tolerations:
      - {{key: node.kubernetes.io/unreachable, operator: Exists, effect: NoExecute, tolerationSeconds: 10}}
      - {{key: node.kubernetes.io/not-ready, operator: Exists, effect: NoExecute, tolerationSeconds: 10}}
      containers:
      - name: web
        image: busybox:1.37
        command: ["sh", "-c", "mkdir -p /www; echo \\"hello from $(hostname)\\" > /www/index.html; exec httpd -f -p 8080 -h /www"]
        ports: [{{containerPort: 8080}}]
        readinessProbe:
          httpGet: {{path: /, port: 8080}}
          periodSeconds: 1
"""


def where(ns: str) -> dict[str, str]:
    return {p["metadata"]["name"]: p["spec"].get("nodeName", "") for p in pods(ns, "app=web") if not p["metadata"].get("deletionTimestamp")}


def main() -> None:
    result: dict = {}
    # ---- 1. the cluster --------------------------------------------------------------------------------------
    nodes = kj("get", "nodes")["items"]
    rows = []
    for n in nodes:
        roles = [x.split("/")[1] for x in n["metadata"]["labels"] if x.startswith("node-role.kubernetes.io/")]
        rows.append([n["metadata"]["name"], ",".join(roles) or "<none>", n["status"]["nodeInfo"]["kubeletVersion"], n["status"]["nodeInfo"]["containerRuntimeVersion"]])
    show("kubectl get nodes", table(rows, ["NAME", "ROLES", "VERSION", "RUNTIME"]))
    check("three nodes, one control plane", len(nodes) == 3 and sum(1 for r in rows if r[1] == "control-plane") == 1)
    check("all nodes run Kubernetes v1.31.0 on containerd", all(r[2] == "v1.31.0" and r[3].startswith("containerd://") for r in rows))

    system = kj("get", "pods", "-n", "kube-system")["items"]
    by_node: dict[str, list[str]] = {}
    for p in system:
        lab = p["metadata"].get("labels", {})
        base = lab.get("component") or lab.get("app") or lab.get("k8s-app") or lab.get("integration-test") or p["metadata"]["name"]
        if base == "kube-dns":
            base = "coredns"
        by_node.setdefault(p["spec"]["nodeName"], []).append(base)
    for node in sorted(by_node):
        print(f"  {node:11} {sorted(by_node[node])}")
    cp = set(by_node["garden"])
    check("the control plane node runs etcd, kube-apiserver, kube-controller-manager and kube-scheduler", {"etcd", "kube-apiserver", "kube-controller-manager", "kube-scheduler"} <= cp)
    check("every node runs kube-proxy and the CNI agent (kindnet)", all("kube-proxy" in v and "kindnet" in v for v in by_node.values()))
    check("the workers run no control plane Pod", not ({"etcd", "kube-apiserver", "kube-scheduler"} & (set(by_node["garden-m02"]) | set(by_node["garden-m03"]))))
    result["systemPods"] = {n: sorted(v) for n, v in by_node.items()}

    with namespace("cluster") as ns:
        # ---- 2. desired state: 3 replicas, delete one ---------------------------------------------------------
        t0 = time.time()
        apply(WEB.format(replicas=3), "-n", ns)
        wait_for(lambda: len(ready_pods(ns, "app=web")) == 3, 120, 1, "3 ready web pods")
        t_create = time.time() - t0
        placed = where(ns)
        show("kubectl get pods -o wide", "\n".join(f"{p}  {n}" for p, n in sorted(placed.items())))
        print(f"  3 Pods Ready {t_create:.1f}s after apply")
        check("3 Pods, all with a node", len(placed) == 3 and all(placed.values()))
        check("the control plane node gets no web Pod (it has a NoSchedule taint)", "garden" not in placed.values())
        check("both workers are used", len(set(placed.values())) == 2)

        victim = sorted(placed)[0]
        t0 = time.time()
        k("delete", "pod", victim, "-n", ns, "--wait=false")
        wait_for(lambda: victim not in where(ns) and len(ready_pods(ns, "app=web")) == 3, 60, 0.5, "replacement Pod")
        t_replace = time.time() - t0
        after = where(ns)
        print(f"  deleted {victim}; 3 Ready again after {t_replace:.1f}s with {sorted(set(after) - set(placed))}")
        check("a Pod with a new name replaced the deleted one", victim not in after and len(set(after) - set(placed)) == 1)
        check("the replacement was ready in under 20 s", t_replace < 20, f"{t_replace:.1f}s")
        events = k("get", "events", "-n", ns, "--sort-by=.lastTimestamp", "-o", "custom-columns=REASON:.reason,FROM:.reportingComponent,MSG:.message", "--no-headers")
        show("events of the namespace (who did what)", events)
        check("the ReplicaSet controller and the scheduler and the kubelet each left an event", all(x in events for x in ("replicaset-controller", "default-scheduler", "kubelet")))
        result["replace"] = {"seconds": round(t_replace, 1), "create": round(t_create, 1)}

        # ---- 3. scale = change one number ---------------------------------------------------------------------
        k("scale", "deployment/web", "--replicas=5", "-n", ns)
        wait_for(lambda: len(ready_pods(ns, "app=web")) == 5, 90, 1, "5 ready pods")
        k("scale", "deployment/web", "--replicas=2", "-n", ns)
        wait_for(lambda: len(where(ns)) == 2 and len(ready_pods(ns, "app=web")) == 2, 90, 1, "2 pods")
        dep = kj("get", "deployment", "web", "-n", ns)
        print(f"  spec.replicas={dep['spec']['replicas']} status.readyReplicas={dep['status']['readyReplicas']}")
        check("spec says 2, status says 2", dep["spec"]["replicas"] == 2 and dep["status"]["readyReplicas"] == 2)
        k("scale", "deployment/web", "--replicas=3", "-n", ns)
        wait_for(lambda: len(ready_pods(ns, "app=web")) == 3, 90, 1, "3 ready pods")

        # ---- 4. a container dies vs a Pod is deleted ----------------------------------------------------------
        target = sorted(where(ns))[0]
        node = where(ns)[target]
        cid = node_sh(node, f"crictl ps --name web -q --label io.kubernetes.pod.name={target} | head -1")
        node_sh(node, f"crictl stop {cid}")
        pod = wait_for(lambda: (lambda p: p if p["status"]["containerStatuses"][0]["restartCount"] >= 1 else None)(kj("get", "pod", target, "-n", ns)), 60, 1, "container restart")
        print(f"  killed the container of {target} on {node}: restartCount={pod['status']['containerStatuses'][0]['restartCount']}, same Pod, same node")
        check("the kubelet restarted the container, the Pod is the same one", pod["metadata"]["name"] == target and pod["spec"]["nodeName"] == node)
        wait_for(lambda: len(ready_pods(ns, "app=web")) == 3, 60, 1, "3 ready pods again")

        # ---- 5. a node stops ----------------------------------------------------------------------------------
        before = where(ns)
        loaded = [n for n in ("garden-m02", "garden-m03") if n in before.values()]
        stop = max(loaded, key=lambda n: list(before.values()).count(n))
        lost = sorted(p for p, n in before.items() if n == stop)
        t0 = time.time()
        run_cmd(["docker", "stop", stop])
        try:
            wait_for(lambda: "NotReady" in k("get", "node", stop, "--no-headers"), 120, 2, "node NotReady")
            t_notready = time.time() - t0
            wait_for(lambda: all(p not in where(ns) for p in lost) and len(ready_pods(ns, "app=web")) == 3, 180, 2, "replacement Pods on the other worker")
            t_moved = time.time() - t0
        finally:
            # `docker start` alone leaves the node without the /etc/hosts line for control-plane.minikube.internal (found on the first run), so minikube must configure it again.
            run_cmd(["docker", "start", stop])
            run_cmd(["minikube", "start", "-p", PROFILE], timeout=600)
        after = where(ns)
        print(f"  stopped {stop} (had {lost}); NotReady after {t_notready:.0f}s; 3 Ready Pods again after {t_moved:.0f}s on {sorted(set(after.values()))}")
        check("the stopped node became NotReady (the default grace period is 40 s)", 30 <= t_notready <= 90, f"{t_notready:.0f}s")
        check("its Pods were replaced on the other worker", stop not in after.values() and len(after) == 3)
        wait_for(lambda: "NotReady" not in k("get", "node", stop, "--no-headers"), 180, 3, "node Ready again")
        result["nodeLoss"] = {"notReadySeconds": round(t_notready), "movedSeconds": round(t_moved), "podsLost": len(lost)}

    if WRITE:
        write_json(LABS / "cluster.json", result)


main_guard(main)
