"""Lesson 12 (CRD and operator): teaching the API server a new kind of object, and a controller that acts on it.

Asserts what the lesson prints:
  1. a CustomResourceDefinition adds a new kind to the API (kubectl api-resources, kubectl explain) and objects of it are stored in etcd like any other
  2. the schema in the CRD is enforced by the API server: a bad value is refused before anything is stored
  3. the CRD alone does nothing: a Greeter object just sits there until a controller acts on it
  4. a small operator (operator_lab.py, a reconcile loop) turns each Greeter into a Deployment, reports status, repairs a deleted Deployment and follows a change of the spec
  5. the Deployment is owned by the Greeter, so deleting the Greeter removes it without the operator doing anything
Run: python exercises/12_crd_operator.py [--write]   (--write saves labs/kubernetes/operator.json for the operator lab)
"""

import sys
import time

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403
from operator_lab import GROUP, Operator  # noqa: E402

WRITE = "--write" in sys.argv

CRD = f"""apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: greeters.{GROUP}
  labels: {{klab: "1"}}
spec:
  group: {GROUP}
  scope: Namespaced
  names: {{plural: greeters, singular: greeter, kind: Greeter, shortNames: [gr]}}
  versions:
  - name: v1
    served: true
    storage: true
    subresources: {{status: {{}}}}
    additionalPrinterColumns:
    - {{name: Replicas, type: integer, jsonPath: .spec.replicas}}
    - {{name: Ready, type: integer, jsonPath: .status.readyReplicas}}
    - {{name: Phase, type: string, jsonPath: .status.phase}}
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            required: [message, replicas]
            properties:
              message: {{type: string, minLength: 1}}
              replicas: {{type: integer, minimum: 1, maximum: 5}}
          status:
            type: object
            properties:
              readyReplicas: {{type: integer}}
              phase: {{type: string}}
"""


def greeter(name: str, message: str, replicas: object) -> str:
    return f"apiVersion: {GROUP}/v1\nkind: Greeter\nmetadata: {{name: {name}}}\nspec:\n  message: \"{message}\"\n  replicas: {replicas}\n"


def main() -> None:
    result: dict = {}
    # ---- 1. the new kind ---------------------------------------------------------------------------------------
    before = len(k("api-resources", "--no-headers", "-o", "name").split())
    apply(CRD)
    wait_for(lambda: k("get", "crd", f"greeters.{GROUP}", "-o", "jsonpath={.status.conditions[?(@.type=='Established')].status}", check=False) == "True", 60, 1, "CRD established")
    after = k("api-resources", "--no-headers", "--api-group", GROUP)
    show("kubectl api-resources --api-group=lab.example.com", after)
    check("the API now serves one more kind: Greeter, short name gr, namespaced", "greeters" in after and "gr" in after and "true" in after)
    check("kubectl api-resources lists one more kind than before", len(k("api-resources", "--no-headers", "-o", "name").split()) == before + 1)
    explain = wait_for(lambda: kubectl("explain", "greeter.spec", f"--api-version={GROUP}/v1", check=False).stdout, 60, 2, "OpenAPI schema of the CRD")
    show("kubectl explain greeter.spec (from the schema we wrote)", "\n".join(explain.splitlines()[:9]))
    check("kubectl explain reads the field names and types from the CRD schema", "replicas" in explain and "message" in explain)
    result["apiResourcesBefore"] = before

    with namespace("operator") as ns:
        # ---- 2. validation ----------------------------------------------------------------------------------------
        bad = kubectl("apply", "-f", "-", "-n", ns, input=greeter("bad", "hi", 9), check=False)
        bad2 = kubectl("apply", "-f", "-", "-n", ns, input=greeter("bad2", "hi", '"many"'), check=False)
        print(f"  replicas: 9 -> {bad.stderr.strip().splitlines()[-1][:120]}\n  replicas: 'many' -> {bad2.stderr.strip().splitlines()[-1][:120]}")
        check("replicas above the maximum is refused with the rule that was broken", bad.returncode != 0 and "less than or equal to 5" in bad.stderr)
        check("a string where an integer is expected is refused too", bad2.returncode != 0 and "Invalid value" in bad2.stderr)
        check("nothing was stored", k("get", "greeters", "-n", ns, "--no-headers", check=False) == "")

        # ---- 3. an object that nobody acts on -----------------------------------------------------------------------
        apply(greeter("hello", "sawasdee", 2), "-n", ns)
        time.sleep(4)
        listing = k("get", "gr", "-n", ns)
        show("kubectl get gr (no controller is running)", listing)
        check("the Greeter is stored and listed, with the printer columns we defined", "REPLICAS" in listing and "hello" in listing)
        check("but nothing happened: no Deployment, no Pod, empty status", k("get", "deployments,pods", "-n", ns, "--no-headers", check=False) == "" and kj("get", "gr", "hello", "-n", ns).get("status") is None)
        key = k("exec", "-n", "kube-system", "etcd-garden", "--", "sh", "-c", f"ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/var/lib/minikube/certs/etcd/ca.crt --cert=/var/lib/minikube/certs/etcd/server.crt --key=/var/lib/minikube/certs/etcd/server.key get /registry/{GROUP}/greeters/{ns}/hello --keys-only")
        check("the object is a key in etcd like any other (/registry/<group>/<plural>/<namespace>/<name>)", key.strip() == f"/registry/{GROUP}/greeters/{ns}/hello")
        result["etcdKey"] = key.strip()

        # ---- 4. the operator ---------------------------------------------------------------------------------------
        op = Operator(ns)
        op.start()
        try:
            t0 = time.time()
            wait_for(lambda: kj("get", "gr", "hello", "-n", ns).get("status", {}).get("phase") == "Ready", 90, 1, "Greeter Ready")
            t_ready = time.time() - t0
            show("kubectl get gr, deployments, pods (operator running)", k("get", "gr,deployments,pods", "-n", ns))
            check("the operator made Deployment greeter-hello with 2 Pods and reported status Ready", len(ready_pods(ns, "greeter=hello")) == 2)
            print(f"  Greeter Ready {t_ready:.0f}s after the operator started")

            dep_uid = k("get", "deployment", "greeter-hello", "-n", ns, "-o", "jsonpath={.metadata.uid}")
            k("delete", "deployment", "greeter-hello", "-n", ns, "--wait=true")
            wait_for(lambda: k("get", "deployment", "greeter-hello", "-n", ns, "-o", "jsonpath={.metadata.uid}", check=False) not in ("", dep_uid), 30, 1, "Deployment recreated")
            wait_for(lambda: kj("get", "gr", "hello", "-n", ns).get("status", {}).get("phase") == "Ready", 90, 1, "Ready again")
            check("a Deployment that someone deleted is made again (a new uid)", True)

            k("patch", "gr", "hello", "-n", ns, "--type", "merge", "-p", '{"spec":{"replicas":4,"message":"hello again"}}')
            wait_for(lambda: len(ready_pods(ns, "greeter=hello")) == 4 and kj("get", "gr", "hello", "-n", ns).get("status", {}).get("readyReplicas") == 4, 90, 1, "4 ready")
            body = k("exec", "-n", ns, ready_pods(ns, "greeter=hello")[0], "--", "wget", "-qO-", "http://localhost:8080/")
            print(f"  after changing the spec: 4 Pods Ready and a Pod answers {body!r}")
            check("a change of the Greeter spec reaches the Deployment (4 replicas, new message)", body == "hello again")
            print("  what the operator did:\n" + "\n".join("    " + line for line in op.log))
            check("its log shows one create, one repair and one update", sum("creating" in x for x in op.log) == 2 and sum("updating" in x for x in op.log) == 1, str(op.log))
            result["operator"] = {"passes": op.passes, "log": [x.split(" ", 1)[1] for x in op.log]}
            result["readySeconds"] = round(t_ready)

            # ---- 5. ownership ------------------------------------------------------------------------------------
            owner = kj("get", "deployment", "greeter-hello", "-n", ns)["metadata"]["ownerReferences"][0]
            check("the Deployment has an ownerReference to the Greeter", owner["kind"] == "Greeter" and owner["name"] == "hello")
        finally:
            op.stop()
        k("delete", "gr", "hello", "-n", ns, "--wait=true")
        wait_for(lambda: k("get", "deployments,pods", "-n", ns, "--no-headers", check=False) == "", 90, 2, "garbage collected")
        check("with the operator stopped, deleting the Greeter still removes the Deployment and its Pods (garbage collection by owner)", True)

    if WRITE:
        write_json(LABS / "operator.json", result)


main_guard(main)
