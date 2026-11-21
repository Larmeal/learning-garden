"""Lesson 3 (labels, namespaces and the API): what every object looks like and how a selector finds objects.

Asserts what the lesson prints:
  1. every object is the same four parts (apiVersion, kind, metadata, spec) plus a status that the cluster writes; metadata gets uid and resourceVersion from the server
  2. a label selector is a query over labels: equality, set based, and a Pod that loses its label leaves the selection
  3. names are unique inside a namespace only; the same name can live in two namespaces
  4. `kubectl apply` is declarative (running it twice changes nothing), `create` is not (the second call fails), `--dry-run=server` and `diff` show a change before it is made
  5. the API is plain HTTP: `kubectl get --raw` returns the same JSON, and the API knows how many kinds of object
Run: python exercises/03_labels_api.py [--write]
"""

import json
import sys

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

WRITE = "--write" in sys.argv


def pod_yaml(name: str, labels: str) -> str:
    return f"""apiVersion: v1
kind: Pod
metadata:
  name: {name}
  labels: {{{labels}}}
spec:
  terminationGracePeriodSeconds: 1
  containers:
  - name: c
    image: {BUSYBOX}
    command: ["sleep", "3600"]
"""


def main() -> None:
    result: dict = {}
    with namespace("labels") as ns, namespace("labels-other") as other:
        # ---- 1. the shape of an object ---------------------------------------------------------------------
        manifest = pod_yaml("a1", "app: shop, tier: web, env: prod")
        apply(manifest, "-n", ns)
        k("wait", "--for=condition=Ready", "pod/a1", "-n", ns, "--timeout=90s")
        obj = kj("get", "pod", "a1", "-n", ns)
        top = sorted(obj)
        print(f"  top level keys: {top}")
        check("an object has apiVersion, kind, metadata, spec and status", {"apiVersion", "kind", "metadata", "spec", "status"} <= set(top))
        meta = obj["metadata"]
        added = sorted(set(meta) - {"name", "labels"})
        print(f"  metadata keys we did not write: {added}")
        check("the server added uid, resourceVersion, creationTimestamp and namespace to metadata", {"uid", "resourceVersion", "creationTimestamp", "namespace"} <= set(added))
        check("status.phase is Running and was written by the kubelet, not by us", obj["status"]["phase"] == "Running" and "status" not in manifest)
        result["metadataKeys"] = added

        # ---- 2. selectors ----------------------------------------------------------------------------------
        for name, labels in (("a2", "app: shop, tier: web, env: dev"), ("a3", "app: shop, tier: db, env: prod"), ("a4", "app: blog, tier: web, env: prod")):
            apply(pod_yaml(name, labels), "-n", ns)

        def sel(*args: str) -> list[str]:
            return sorted(k("get", "pods", "-n", ns, *args, "-o", "jsonpath={.items[*].metadata.name}").split())

        table_rows = [
            ["app=shop", sel("-l", "app=shop")],
            ["app=shop,tier=web", sel("-l", "app=shop,tier=web")],
            ["env!=dev", sel("-l", "env!=dev")],
            ["tier in (web,db),app=blog", sel("-l", "tier in (web,db),app=blog")],
            ["!env  (no env label)", sel("-l", "!env")],
            ["env  (has env label)", sel("-l", "env")],
        ]
        show("kubectl get pods -l <selector>", table(table_rows, ["selector", "pods"]))
        check("app=shop selects a1 a2 a3", table_rows[0][1] == ["a1", "a2", "a3"])
        check("two requirements are an AND", table_rows[1][1] == ["a1", "a2"])
        check("env!=dev selects every Pod without env=dev (a1 a3 a4)", table_rows[2][1] == ["a1", "a3", "a4"])
        check("a set expression works", table_rows[3][1] == ["a4"])
        check("no Pod lacks the env label here", table_rows[4][1] == [] and len(table_rows[5][1]) == 4)
        k("label", "pod", "a2", "-n", ns, "app-")
        check("removing a label takes the Pod out of the selection (a1 a3)", sel("-l", "app=shop") == ["a1", "a3"])
        k("label", "pod", "a2", "-n", ns, "app=shop")
        result["selectors"] = {r[0]: r[1] for r in table_rows}

        # ---- 3. namespaces ----------------------------------------------------------------------------------
        apply(pod_yaml("a1", "app: shop"), "-n", other)
        both = k("get", "pods", "-A", "-l", "klab=1", "--no-headers", check=False)
        names = {n: sorted(k("get", "pods", "-n", n, "-o", "jsonpath={.items[*].metadata.name}").split()) for n in (ns, other)}
        print(f"  {ns}: {names[ns]}   {other}: {names[other]}")
        check("two namespaces can hold an object with the same name", "a1" in names[ns] and names[other] == ["a1"])
        ips = {n: k("get", "pod", "a1", "-n", n, "-o", "jsonpath={.status.podIP}") for n in (ns, other)}
        wait_for(lambda: k("get", "pod", "a1", "-n", other, "-o", "jsonpath={.status.podIP}"), 60, 1, "IP of the second a1")
        check("they are two different Pods", k("get", "pod", "a1", "-n", ns, "-o", "jsonpath={.metadata.uid}") != k("get", "pod", "a1", "-n", other, "-o", "jsonpath={.metadata.uid}"))
        ns_list = k("get", "namespaces", "--no-headers", "-o", "custom-columns=NAME:.metadata.name").split()
        check("a fresh cluster has default, kube-system, kube-public and kube-node-lease", {"default", "kube-system", "kube-public", "kube-node-lease"} <= set(ns_list))
        result["namespaces"] = sorted(n for n in ns_list if not n.startswith("klab"))
        del both, ips

        # ---- 4. declarative against imperative --------------------------------------------------------------
        cm = "apiVersion: v1\nkind: ConfigMap\nmetadata: {name: note}\ndata: {greeting: hello}\n"
        first = apply(cm, "-n", ns)
        second = apply(cm, "-n", ns)
        third = apply(cm.replace("hello", "sawasdee"), "-n", ns)
        show("kubectl apply, three times", f"{first}\n{second}\n{third}")
        check("apply says created, then unchanged, then configured", "created" in first and "unchanged" in second and "configured" in third)
        again = kubectl("create", "-f", "-", "-n", ns, input=cm, check=False)
        print(f"  kubectl create again: {again.stderr.strip()}")
        check("create on an object that exists fails (AlreadyExists)", again.returncode != 0 and "AlreadyExists" in again.stderr)
        rv1 = k("get", "configmap", "note", "-n", ns, "-o", "jsonpath={.metadata.resourceVersion}")
        apply(cm.replace("hello", "sawasdee"), "-n", ns)
        rv2 = k("get", "configmap", "note", "-n", ns, "-o", "jsonpath={.metadata.resourceVersion}")
        check("an apply that changes nothing does not change resourceVersion", rv1 == rv2)
        diff = kubectl("diff", "-f", "-", "-n", ns, input=cm, check=False)
        show("kubectl diff (we ask for 'hello' again)", "\n".join(line for line in diff.stdout.splitlines() if line.startswith(("+", "-")) and not line.startswith(("+++", "---"))))
        check("kubectl diff exits with 1 when something would change", diff.returncode == 1 and "hello" in diff.stdout)
        dry = k("apply", "-f", "-", "-n", ns, "--dry-run=server", input=cm.replace("hello", "dry"))
        check("--dry-run=server asks the API server but stores nothing", "dry run" in dry and k("get", "configmap", "note", "-n", ns, "-o", "jsonpath={.data.greeting}") == "sawasdee")

        # ---- 5. the API is HTTP -----------------------------------------------------------------------------
        raw = json.loads(k("get", "--raw", f"/api/v1/namespaces/{ns}/pods/a1"))
        check("kubectl get --raw returns the same object as kubectl get -o json", raw["metadata"]["uid"] == obj["metadata"]["uid"])
        groups = json.loads(k("get", "--raw", "/apis"))["groups"]
        core = json.loads(k("get", "--raw", "/api/v1"))["resources"]
        resources = [r for r in k("api-resources", "--no-headers", "-o", "name").split() if r]
        print(f"  api groups: {len(groups)}; kinds in the core group: {len([r for r in core if '/' not in r['name']])}; kinds in all: {len(resources)}")
        check("the API serves several dozen kinds of object", 40 < len(resources) < 120, str(len(resources)))
        version = json.loads(k("get", "--raw", "/version"))
        check("GET /version returns v1.31.0", version["gitVersion"] == "v1.31.0")
        result["apiKinds"] = len(resources)
        result["apiGroups"] = len(groups)

    if WRITE:
        write_json(LABS / "labels.json", result)


main_guard(main)
