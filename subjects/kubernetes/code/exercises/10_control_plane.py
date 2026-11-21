"""Lesson 10 (control plane): the API server, etcd and the controller loop, shown by stopping the parts one at a time.

Asserts what the lesson prints:
  1. the control plane parts are static Pods: their manifests are files in /etc/kubernetes/manifests on the control plane node and the kubelet runs them
  2. only the API server talks to etcd; every object is a key under /registry (read with etcdctl)
  3. a watch is a long HTTP response: the API server sends an event for every change
  4. resourceVersion is an optimistic lock: an update that carries an old resourceVersion is refused with 409 Conflict
  5. the scheduler is just another client: with it stopped a new Pod stays Pending with no node and no event; started again, the Pod is scheduled
  6. the controller manager is the loop: with it stopped, a deleted Pod of a Deployment is not replaced; started again, the Deployment catches up
  7. minikube turns leader election off; the heartbeat of every node is a Lease object that its kubelet renews
  8. garbage collection follows ownerReferences: deleting a Deployment with --cascade=orphan leaves the ReplicaSet and the Pods running
Run: python exercises/10_control_plane.py [--write]   (--write saves labs/kubernetes/controlplane.json for the control plane lab)
"""

import json
import subprocess
import sys
import time

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
import klab as _klab  # noqa: E402
from klab import *  # noqa: E402,F403

WRITE = "--write" in sys.argv
MANIFESTS = "/etc/kubernetes/manifests"
PARKED = "/tmp/klab-parked"
ETCDCTL = "ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/var/lib/minikube/certs/etcd/ca.crt --cert=/var/lib/minikube/certs/etcd/server.crt --key=/var/lib/minikube/certs/etcd/server.key"


def etcd(args: str) -> str:
    return k("exec", "-n", "kube-system", "etcd-garden", "--", "sh", "-c", f"{ETCDCTL} {args}")


def park(name: str) -> None:
    node_sh("garden", f"mkdir -p {PARKED} && mv {MANIFESTS}/{name}.yaml {PARKED}/")


def unpark(name: str) -> None:
    node_sh("garden", f"[ -f {PARKED}/{name}.yaml ] && mv {PARKED}/{name}.yaml {MANIFESTS}/ || true")


def component_running(name: str) -> bool:
    return k("get", "pod", f"{name}-garden", "-n", "kube-system", "--no-headers", check=False).count("Running") == 1


def main() -> None:
    result: dict = {}
    for n in ("kube-scheduler", "kube-controller-manager"):
        unpark(n)  # a crashed earlier run may have left a manifest parked
    try:
        # ---- 1. static pods -----------------------------------------------------------------------------------
        files = sorted(node_sh("garden", f"ls {MANIFESTS}").split())
        print(f"  {MANIFESTS}: {files}")
        check("the four control plane parts are files in the manifests folder", files == ["etcd.yaml", "kube-apiserver.yaml", "kube-controller-manager.yaml", "kube-scheduler.yaml"])
        mirror = kj("get", "pod", "kube-scheduler-garden", "-n", "kube-system")
        check("the kubelet runs them and shows each as a 'mirror Pod' owned by the Node", mirror["metadata"]["ownerReferences"][0]["kind"] == "Node")
        flags = k("get", "pod", "kube-apiserver-garden", "-n", "kube-system", "-o", "jsonpath={.spec.containers[0].command}")
        check("the API server is started with the address of etcd", "--etcd-servers=https://127.0.0.1:2379" in flags)
        result["manifests"] = files

        with namespace("cp") as ns:
            apply(f"apiVersion: v1\nkind: Pod\nmetadata: {{name: probe}}\nspec:\n  terminationGracePeriodSeconds: 1\n  containers:\n  - name: c\n    image: {BUSYBOX}\n    command: [sleep, '3600']\n", "-n", ns)
            k("wait", "--for=condition=Ready", "pod/probe", "-n", ns, "--timeout=60s")

            # ---- 2. etcd ---------------------------------------------------------------------------------------
            key = f"/registry/pods/{ns}/probe"
            keys = etcd(f"get {key} --keys-only").split()
            kinds = sorted({p.split("/")[2] for p in etcd("get /registry/ --prefix --keys-only").split() if p.startswith("/registry/")})
            print(f"  etcd key of the Pod: {keys}\n  first-level kinds under /registry: {len(kinds)}, e.g. {kinds[:8]}")
            check("the Pod is one key in etcd, /registry/pods/<namespace>/<name>", keys == [key])
            check("etcd holds every kind of object under /registry", {"pods", "services", "deployments", "secrets", "namespaces", "leases"} <= set(kinds))
            result["etcdKinds"] = len(kinds)

            # ---- 3. watch ---------------------------------------------------------------------------------------
            rv = k("get", "pods", "-n", ns, "-o", "jsonpath={.metadata.resourceVersion}")
            proc = subprocess.Popen(["kubectl", "get", "--raw", f"/api/v1/namespaces/{ns}/pods?watch=true&resourceVersion={rv}&timeoutSeconds=12"], stdout=subprocess.PIPE, text=True, env=_klab._env())
            time.sleep(1.5)
            k("label", "pod", "probe", "-n", ns, "touched=yes")
            k("delete", "pod", "probe", "-n", ns, "--wait=false")
            out, _ = proc.communicate(timeout=30)
            events = [json.loads(line) for line in out.splitlines() if line.strip()]
            types = [e["type"] for e in events]
            print(f"  watch events received: {types}")
            check("one open request received an event for every change (a label, then the delete)", "MODIFIED" in types and types.count("MODIFIED") >= 2 and "DELETED" in types, str(types))
            result["watchEvents"] = types

            # ---- 4. optimistic lock ------------------------------------------------------------------------------
            apply("apiVersion: v1\nkind: ConfigMap\nmetadata: {name: cm}\ndata: {n: '1'}\n", "-n", ns)
            old = k("get", "configmap", "cm", "-n", ns, "-o", "jsonpath={.metadata.resourceVersion}")
            k("patch", "configmap", "cm", "-n", ns, "--type", "merge", "-p", '{"data":{"n":"2"}}')
            stale = {"apiVersion": "v1", "kind": "ConfigMap", "metadata": {"name": "cm", "resourceVersion": old}, "data": {"n": "3"}}
            r = kubectl("replace", "-f", "-", "-n", ns, input=json.dumps(stale), check=False)
            print(f"  replace with the old resourceVersion {old}: {r.stderr.strip()}")
            check("an update that carries a stale resourceVersion is refused with Conflict", r.returncode != 0 and "Conflict" in r.stderr)
            check("and the stored value is still 2", k("get", "configmap", "cm", "-n", ns, "-o", "jsonpath={.data.n}") == "2")

            # ---- 5. the scheduler is a client ---------------------------------------------------------------------
            park("kube-scheduler")
            wait_for(lambda: not component_running("kube-scheduler"), 90, 1, "scheduler stopped")
            apply(f"apiVersion: v1\nkind: Pod\nmetadata: {{name: orphan}}\nspec:\n  terminationGracePeriodSeconds: 1\n  containers:\n  - name: c\n    image: {BUSYBOX}\n    command: [sleep, '3600']\n", "-n", ns)
            time.sleep(8)
            o = kj("get", "pod", "orphan", "-n", ns)
            evs = k("get", "events", "-n", ns, "--field-selector", "involvedObject.name=orphan", "--no-headers", check=False)
            print(f"  scheduler stopped: Pod phase={o['status']['phase']}, nodeName={o['spec'].get('nodeName')!r}, events={evs!r}")
            check("with no scheduler the Pod exists, is Pending, has no node and not even a FailedScheduling event", o["status"]["phase"] == "Pending" and "nodeName" not in o["spec"] and evs == "")
            unpark("kube-scheduler")
            wait_for(lambda: k("get", "pod", "orphan", "-n", ns, "-o", "jsonpath={.spec.nodeName}", check=False), 120, 2, "scheduled after restart")
            check("when the scheduler is back it finds the waiting Pod and gives it a node", k("get", "pod", "orphan", "-n", ns, "-o", "jsonpath={.spec.nodeName}") in ("garden-m02", "garden-m03"))
            wait_for(lambda: component_running("kube-scheduler"), 60, 1, "scheduler running")
            k("delete", "pod", "orphan", "-n", ns, "--wait=false")

            # ---- 6. the controller manager is the loop ---------------------------------------------------------------
            apply(f"apiVersion: apps/v1\nkind: Deployment\nmetadata: {{name: web}}\nspec:\n  replicas: 3\n  selector: {{matchLabels: {{app: web}}}}\n  template:\n    metadata: {{labels: {{app: web}}}}\n    spec:\n      terminationGracePeriodSeconds: 1\n      containers:\n      - name: c\n        image: {BUSYBOX}\n        command: [sleep, '3600']\n", "-n", ns)
            wait_for(lambda: len(ready_pods(ns, "app=web")) == 3, 90, 1, "3 Pods")
            park("kube-controller-manager")
            wait_for(lambda: not component_running("kube-controller-manager"), 90, 1, "controller manager stopped")
            victim = ready_pods(ns, "app=web")[0]
            k("delete", "pod", victim, "-n", ns, "--wait=true")
            time.sleep(10)
            left = len(pods(ns, "app=web"))
            k("scale", "deployment/web", "--replicas=5", "-n", ns)
            time.sleep(6)
            dep = kj("get", "deployment", "web", "-n", ns)
            print(f"  controller manager stopped: after deleting a Pod {left} remain; after scale to 5, spec.replicas={dep['spec']['replicas']}, status.replicas={dep['status'].get('replicas')}, Pods={len(pods(ns, 'app=web'))}")
            check("with no controller manager a deleted Pod is not replaced (2 remain of 3)", left == 2)
            check("the API accepted the new desired state (5), but nothing acts on it (still 2 Pods)", dep["spec"]["replicas"] == 5 and len(pods(ns, "app=web")) == 2)
            unpark("kube-controller-manager")
            wait_for(lambda: len(ready_pods(ns, "app=web")) == 5, 150, 2, "5 Pods after restart")
            check("when the controller manager is back the Deployment catches up to 5 Ready Pods", True)
            result["stopped"] = {"schedulerPending": True, "afterDelete": left}

            # ---- 7. leases: leader election is off here, node heartbeats are not ---------------------------------------
            sched_cmd = k("get", "pod", "kube-scheduler-garden", "-n", "kube-system", "-o", "jsonpath={.spec.containers[0].command}")
            check("minikube starts the scheduler and the controller manager with --leader-elect=false (one control plane node, so no Lease of their own)", "--leader-elect=false" in sched_cmd)
            t1 = kj("get", "lease", "garden-m02", "-n", "kube-node-lease")["spec"]["renewTime"]
            time.sleep(12)
            t2 = kj("get", "lease", "garden-m02", "-n", "kube-node-lease")["spec"]["renewTime"]
            leases = k("get", "lease", "-n", "kube-node-lease", "--no-headers", "-o", "custom-columns=N:.metadata.name").split()
            print(f"  kube-node-lease holds one Lease per node: {leases}; garden-m02 renewTime {t1} then {t2}")
            check("every node has a Lease in kube-node-lease that its kubelet renews about every 10 s (this is the heartbeat the controller watches)", sorted(leases) == ["garden", "garden-m02", "garden-m03"] and t2 > t1)
            result["leaderElect"] = False

            # ---- 8. garbage collection ---------------------------------------------------------------------------------
            k("delete", "deployment", "web", "-n", ns, "--cascade=orphan")
            time.sleep(3)
            rs = k("get", "rs", "-n", ns, "--no-headers", "-o", "custom-columns=N:.metadata.name,OWNERS:.metadata.ownerReferences")
            alive = len(ready_pods(ns, "app=web"))
            print(f"  Deployment deleted with --cascade=orphan: ReplicaSets left: {len(rs.splitlines())}, Pods still Ready: {alive}")
            check("the ReplicaSet and its Pods stay when the owner is deleted with --cascade=orphan", len(rs.splitlines()) == 1 and alive == 5 and "<none>" in rs)
            k("delete", "rs", "--all", "-n", ns)
            time.sleep(5)
            check("by default (cascade background) deleting the ReplicaSet removes the Pods it owns", len(pods(ns, "app=web")) == 0)
    finally:
        for n in ("kube-scheduler", "kube-controller-manager"):
            unpark(n)
        wait_for(lambda: component_running("kube-scheduler") and component_running("kube-controller-manager"), 120, 2, "control plane back")

    if WRITE:
        write_json(LABS / "controlplane.json", result)


main_guard(main)
