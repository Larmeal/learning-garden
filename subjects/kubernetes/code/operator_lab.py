"""A very small operator for the lessons: it makes the idea "a controller is a loop" something that can be read in one screen.

The custom resource is `Greeter` (group lab.example.com). For every Greeter the loop makes sure that one Deployment named `greeter-<name>` exists with `spec.replicas`
Pods that serve `spec.message`, and writes `status.readyReplicas` and `status.phase` back to the Greeter. The Deployment carries an ownerReference to its Greeter, so the
cluster's garbage collector deletes it when the Greeter is deleted: the operator never has to.

It talks to the API only through `kubectl` (the same way the exercises do) and polls once a second, which is slower than a real operator that uses a watch (see
`Programming Kubernetes`, and the informer in client-go) but has the same shape: observe, compare with what is wanted, act, repeat.
"""

import json
import threading
import time

from klab import apply, k, kj, BUSYBOX

GROUP = "lab.example.com"


def deployment_for(g: dict) -> str:
    name = g["metadata"]["name"]
    msg = g["spec"]["message"].replace('"', "")
    return json.dumps({
        "apiVersion": "apps/v1", "kind": "Deployment",
        "metadata": {
            "name": f"greeter-{name}", "labels": {"klab": "1", "greeter": name},
            "ownerReferences": [{"apiVersion": f"{GROUP}/v1", "kind": "Greeter", "name": name, "uid": g["metadata"]["uid"], "controller": True, "blockOwnerDeletion": True}],
        },
        "spec": {
            "replicas": g["spec"]["replicas"],
            "selector": {"matchLabels": {"greeter": name}},
            "template": {
                "metadata": {"labels": {"greeter": name}},
                "spec": {"terminationGracePeriodSeconds": 1, "containers": [{
                    "name": "c", "image": BUSYBOX,
                    "command": ["sh", "-c", f'mkdir -p /www; echo "{msg}" > /www/index.html; exec httpd -f -p 8080 -h /www'],
                    "readinessProbe": {"httpGet": {"path": "/", "port": 8080}, "periodSeconds": 1},
                }]},
            },
        },
    })


class Operator(threading.Thread):
    """Reconcile every Greeter of one namespace until `stop()` is called. `log` keeps what it did, for the exercise to print."""

    def __init__(self, ns: str):
        super().__init__(daemon=True)
        self.ns = ns
        self.log: list[str] = []
        self._stop_event = threading.Event()
        self.passes = 0

    def stop(self) -> None:
        self._stop_event.set()
        self.join(timeout=15)

    def note(self, text: str) -> None:
        self.log.append(f"{time.strftime('%H:%M:%S')} {text}")

    def reconcile(self) -> None:
        for g in kj("get", f"greeters.{GROUP}", "-n", self.ns)["items"]:
            name = g["metadata"]["name"]
            want = deployment_for(g)
            have = k("get", "deployment", f"greeter-{name}", "-n", self.ns, "--ignore-not-found", "-o", "json", check=False)
            if not have:
                self.note(f"Greeter/{name}: no Deployment, creating it with {g['spec']['replicas']} replicas")
                apply(want, "-n", self.ns)
                have = k("get", "deployment", f"greeter-{name}", "-n", self.ns, "-o", "json")
            else:
                cur = json.loads(have)
                if cur["spec"]["replicas"] != g["spec"]["replicas"] or cur["spec"]["template"]["spec"]["containers"][0]["command"] != json.loads(want)["spec"]["template"]["spec"]["containers"][0]["command"]:
                    self.note(f"Greeter/{name}: Deployment differs from the spec, updating it")
                    apply(want, "-n", self.ns)
                    have = k("get", "deployment", f"greeter-{name}", "-n", self.ns, "-o", "json")
            ready = json.loads(have)["status"].get("readyReplicas", 0)
            phase = "Ready" if ready == g["spec"]["replicas"] else "Progressing"
            if g.get("status", {}).get("readyReplicas") != ready or g.get("status", {}).get("phase") != phase:
                k("patch", f"greeters.{GROUP}", name, "-n", self.ns, "--subresource=status", "--type", "merge", "-p", json.dumps({"status": {"readyReplicas": ready, "phase": phase}}))

    def run(self) -> None:
        while not self._stop_event.is_set():
            try:
                self.reconcile()
            except SystemExit as e:  # a failing kubectl call ends the exercise helpers with SystemExit; the loop must survive a blip
                self.note(f"pass failed: {str(e)[:120]}")
            self.passes += 1
            self._stop_event.wait(1.0)
