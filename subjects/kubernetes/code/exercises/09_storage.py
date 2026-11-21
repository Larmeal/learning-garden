"""Lesson 9 (PersistentVolume, PersistentVolumeClaim, StorageClass): disks that outlive a Pod, and where they really are.

Asserts what the lesson prints:
  1. a PVC is a request; with a default StorageClass the cluster makes a PV and binds it (minikube: provisioner k8s.io/minikube-hostpath, reclaimPolicy Delete)
  2. data in a PVC survives a Pod that is deleted; data in an emptyDir does not
  3. minikube's default volumes are hostPath folders on the node where the Pod runs, so a Pod that lands on another node sees an empty folder (the PV has no nodeAffinity to warn the scheduler)
  4. a `local` PV with nodeAffinity and a WaitForFirstConsumer StorageClass makes the scheduler put the Pod where the disk is
  5. deleting a PVC deletes the PV when the policy is Delete, and leaves it Released when the policy is Retain; a PVC that names no StorageClass that exists stays Pending
Run: python exercises/09_storage.py [--write]   (--write saves labs/kubernetes/storage.json for the storage lab)
"""

import sys
import time

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

WRITE = "--write" in sys.argv


def pod(name: str, claim: str | None, node: str | None, script: str, empty: bool = False) -> str:
    vol = "{name: v, emptyDir: {}}" if empty else f"{{name: v, persistentVolumeClaim: {{claimName: {claim}}}}}"
    sel = f"  nodeSelector: {{kubernetes.io/hostname: {node}}}\n" if node else ""
    return f"""apiVersion: v1
kind: Pod
metadata: {{name: {name}}}
spec:
  terminationGracePeriodSeconds: 1
{sel}  volumes: [{vol}]
  containers:
  - name: c
    image: {BUSYBOX}
    command: ["sh", "-c", "{script}; sleep 3600"]
    volumeMounts: [{{name: v, mountPath: /data}}]
"""


def main() -> None:
    result: dict = {}
    with namespace("storage") as ns:
        # ---- 1. claim and dynamic provisioning -------------------------------------------------------------
        sc = kj("get", "storageclass", "standard")
        print(f"  default StorageClass: {sc['metadata']['name']}, provisioner {sc['provisioner']}, reclaimPolicy {sc['reclaimPolicy']}, binding {sc['volumeBindingMode']}")
        check("the default StorageClass of this cluster is minikube-hostpath with reclaimPolicy Delete", sc["provisioner"] == "k8s.io/minikube-hostpath" and sc["reclaimPolicy"] == "Delete")
        apply("apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata: {name: data}\nspec:\n  accessModes: [ReadWriteOnce]\n  resources: {requests: {storage: 32Mi}}\n", "-n", ns)
        wait_for(lambda: k("get", "pvc", "data", "-n", ns, "-o", "jsonpath={.status.phase}") == "Bound", 60, 1, "PVC Bound")
        pvc = kj("get", "pvc", "data", "-n", ns)
        pv_name = pvc["spec"]["volumeName"]
        pv = kj("get", "pv", pv_name)
        show("kubectl get pvc,pv", f"pvc/data  Bound  -> pv/{pv_name}  {pv['spec']['capacity']['storage']}  {pv['spec']['persistentVolumeReclaimPolicy']}  {pv['spec']['storageClassName']}")
        check("without a Pod yet, the claim is already Bound to a PV that was created for it (binding mode Immediate)", pvc["status"]["phase"] == "Bound" and pv["spec"]["claimRef"]["name"] == "data")
        host_path = pv["spec"].get("hostPath", {}).get("path", "")
        print(f"  PV source: hostPath {host_path}; nodeAffinity: {pv['spec'].get('nodeAffinity')}")
        check("the PV is a hostPath folder and has no nodeAffinity", host_path.startswith("/tmp/hostpath-provisioner/") and "nodeAffinity" not in pv["spec"])
        result["pv"] = {"provisioner": sc["provisioner"], "path": host_path, "reclaim": pv["spec"]["persistentVolumeReclaimPolicy"], "nodeAffinity": False}

        # ---- 2. survive a Pod ----------------------------------------------------------------------------------
        apply(pod("writer", "data", "garden-m02", "echo kept > /data/note"), "-n", ns)
        k("wait", "--for=condition=Ready", "pod/writer", "-n", ns, "--timeout=90s")
        k("delete", "pod", "writer", "-n", ns, "--wait=true")
        apply(pod("again", "data", "garden-m02", "true"), "-n", ns)
        k("wait", "--for=condition=Ready", "pod/again", "-n", ns, "--timeout=90s")
        kept = k("exec", "again", "-n", ns, "--", "cat", "/data/note")
        check("a new Pod on the same node reads the file that the deleted Pod wrote into the claim", kept == "kept")
        apply(pod("e1", None, "garden-m02", "echo gone > /data/note", empty=True), "-n", ns)
        k("wait", "--for=condition=Ready", "pod/e1", "-n", ns, "--timeout=90s")
        k("delete", "pod", "e1", "-n", ns, "--wait=true")
        apply(pod("e2", None, "garden-m02", "true", empty=True), "-n", ns)
        k("wait", "--for=condition=Ready", "pod/e2", "-n", ns, "--timeout=90s")
        gone = k("exec", "e2", "-n", ns, "--", "sh", "-c", "ls /data | wc -l")
        check("an emptyDir starts empty again after the Pod is deleted", gone == "0")
        k("delete", "pod", "e2", "-n", ns, "--wait=false")

        # ---- 3. the folder belongs to a node --------------------------------------------------------------------
        k("delete", "pod", "again", "-n", ns, "--wait=true")
        apply(pod("elsewhere", "data", "garden-m03", "true"), "-n", ns)
        k("wait", "--for=condition=Ready", "pod/elsewhere", "-n", ns, "--timeout=90s")
        seen = k("exec", "elsewhere", "-n", ns, "--", "sh", "-c", "ls /data | wc -l")
        print(f"  the same claim mounted from garden-m03 shows {seen} files")
        check("on another node the same claim shows an empty folder: hostPath data stays on the node that wrote it", seen == "0")
        on_m02 = node_sh("garden-m02", f"ls {host_path}")
        on_m03 = node_sh("garden-m03", f"ls -la {host_path} | wc -l")
        check("the file is in the folder of garden-m02", on_m02 == "note")
        result["nodeLocal"] = {"garden-m02": on_m02, "otherNodeFiles": int(seen)}
        k("delete", "pod", "elsewhere", "-n", ns, "--wait=true")
        del on_m03

        # ---- 5a. delete the claim ----------------------------------------------------------------------------------
        k("delete", "pvc", "data", "-n", ns, "--wait=true")
        wait_for(lambda: k("get", "pv", pv_name, "--ignore-not-found", check=False) == "", 60, 1, "PV removed")
        leftover = node_sh("garden-m02", f"ls {host_path} 2>&1")
        print(f"  PVC deleted: the PV object is gone; the folder on garden-m02 still holds: {leftover!r}")
        check("with reclaimPolicy Delete the PV object is deleted together with the claim", True)
        check("but the files on the worker node are still there (the provisioner runs on the control plane and cleans its own node)", leftover == "note")
        result["leftover"] = leftover == "note"
        node_sh("garden-m02", f"rm -rf {host_path}")

        # ---- 4. a local PV that knows its node ---------------------------------------------------------------------
        node_sh("garden-m03", "mkdir -p /tmp/klab-local && echo on-m03 > /tmp/klab-local/where")
        apply(f"""apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata: {{name: klab-local, labels: {{klab: "1"}}}}
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
---
apiVersion: v1
kind: PersistentVolume
metadata: {{name: klab-local-pv, labels: {{klab: "1"}}}}
spec:
  capacity: {{storage: 16Mi}}
  accessModes: [ReadWriteOnce]
  persistentVolumeReclaimPolicy: Retain
  storageClassName: klab-local
  local: {{path: /tmp/klab-local}}
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions: [{{key: kubernetes.io/hostname, operator: In, values: [garden-m03]}}]
""")
        apply("apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata: {name: local-claim}\nspec:\n  storageClassName: klab-local\n  accessModes: [ReadWriteOnce]\n  resources: {requests: {storage: 16Mi}}\n", "-n", ns)
        time.sleep(3)
        phase = k("get", "pvc", "local-claim", "-n", ns, "-o", "jsonpath={.status.phase}")
        check("with WaitForFirstConsumer the claim stays Pending until a Pod uses it", phase == "Pending")
        apply(pod("follower", "local-claim", None, "true"), "-n", ns)
        k("wait", "--for=condition=Ready", "pod/follower", "-n", ns, "--timeout=90s")
        where = k("get", "pod", "follower", "-n", ns, "-o", "jsonpath={.spec.nodeName}")
        got = k("exec", "follower", "-n", ns, "--", "cat", "/data/where")
        print(f"  Pod without any nodeSelector: scheduled on {where}, reads {got!r}")
        check("the scheduler put the Pod on the node that holds the disk", where == "garden-m03" and got == "on-m03")
        result["local"] = {"node": where}
        k("delete", "pod", "follower", "-n", ns, "--wait=true")
        k("delete", "pvc", "local-claim", "-n", ns, "--wait=true")
        wait_for(lambda: k("get", "pv", "klab-local-pv", "-o", "jsonpath={.status.phase}") == "Released", 30, 1, "PV Released")
        check("with reclaimPolicy Retain the PV stays, in phase Released, and holds its files", node_sh("garden-m03", "cat /tmp/klab-local/where") == "on-m03")
        node_sh("garden-m03", "rm -rf /tmp/klab-local")

        # ---- 5b. a claim that cannot be bound ---------------------------------------------------------------------
        apply("apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata: {name: orphan}\nspec:\n  storageClassName: does-not-exist\n  accessModes: [ReadWriteOnce]\n  resources: {requests: {storage: 1Gi}}\n", "-n", ns)
        time.sleep(3)
        ev = k("get", "events", "-n", ns, "--field-selector", "involvedObject.name=orphan", "-o", "jsonpath={.items[0].message}", check=False)
        print(f"  PVC with a StorageClass that does not exist: {k('get', 'pvc', 'orphan', '-n', ns, '-o', 'jsonpath={.status.phase}')}: {ev}")
        check("the claim stays Pending and the event says the StorageClass was not found", k("get", "pvc", "orphan", "-n", ns, "-o", "jsonpath={.status.phase}") == "Pending" and "not found" in ev)

    if WRITE:
        write_json(LABS / "storage.json", result)


main_guard(main)
