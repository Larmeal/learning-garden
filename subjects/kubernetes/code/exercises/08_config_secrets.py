"""Lesson 8 (ConfigMap and Secret): configuration that lives outside the image, and what a Secret really protects.

Asserts what the lesson prints:
  1. a ConfigMap can reach a container as environment variables (read once, when the container starts) or as files (kept up to date by the kubelet)
  2. a file mounted with subPath is never updated, and an immutable ConfigMap cannot be edited
  3. a Secret is a ConfigMap whose values are base64, which is an encoding and not a lock: anyone who can `get` it can read it
  4. in etcd, without an encryption provider, the value is stored as plain text (read straight from etcd inside the control plane node)
  5. a Pod that names a Secret key that does not exist stays in CreateContainerConfigError
Run: python exercises/08_config_secrets.py [--write]   (--write saves labs/kubernetes/config.json for the config lab)
"""

import base64
import sys
import time

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

WRITE = "--write" in sys.argv


def main() -> None:
    result: dict = {}
    with namespace("config") as ns:
        # ---- 1. env against file -----------------------------------------------------------------------------
        apply("apiVersion: v1\nkind: ConfigMap\nmetadata: {name: app-config}\ndata:\n  LEVEL: info\n  app.properties: |\n    level=info\n    retries=3\n", "-n", ns)
        apply(f"""apiVersion: v1
kind: Pod
metadata: {{name: reader}}
spec:
  terminationGracePeriodSeconds: 1
  volumes:
  - {{name: cfg, configMap: {{name: app-config}}}}
  containers:
  - name: c
    image: {BUSYBOX}
    command: ["sleep", "3600"]
    env:
    - name: LEVEL
      valueFrom: {{configMapKeyRef: {{name: app-config, key: LEVEL}}}}
    volumeMounts:
    - {{name: cfg, mountPath: /etc/app}}
    - {{name: cfg, mountPath: /etc/pinned/app.properties, subPath: app.properties}}
""", "-n", ns)
        k("wait", "--for=condition=Ready", "pod/reader", "-n", ns, "--timeout=90s")
        env0 = k("exec", "reader", "-n", ns, "--", "sh", "-c", "echo $LEVEL")
        file0 = k("exec", "reader", "-n", ns, "--", "head", "-1", "/etc/app/app.properties")
        print(f"  start: env LEVEL={env0}, file first line={file0}")
        check("at the start the env var and the file both say info", env0 == "info" and file0 == "level=info")
        k("patch", "configmap", "app-config", "-n", ns, "--type", "merge", "-p", '{"data":{"LEVEL":"debug","app.properties":"level=debug\\nretries=3\\n"}}')
        t0 = time.time()
        wait_for(lambda: k("exec", "reader", "-n", ns, "--", "head", "-1", "/etc/app/app.properties") == "level=debug", 180, 2, "file updated")
        t_file = time.time() - t0
        env1 = k("exec", "reader", "-n", ns, "--", "sh", "-c", "echo $LEVEL")
        pinned = k("exec", "reader", "-n", ns, "--", "head", "-1", "/etc/pinned/app.properties")
        print(f"  {t_file:.0f}s after the change: file says debug, env LEVEL={env1}, subPath file={pinned}")
        check("the mounted file followed the ConfigMap (the kubelet syncs it, within about a minute)", t_file < 150, f"{t_file:.0f}s")
        check("the environment variable did not change (it is read once when the container starts)", env1 == "info")
        check("the file mounted with subPath did not change either", pinned == "level=info")
        k("delete", "pod", "reader", "-n", ns, "--wait=true")
        result["propagation"] = {"fileSeconds": round(t_file), "env": env1, "subPath": pinned}

        # ---- 2. immutable ------------------------------------------------------------------------------------
        apply("apiVersion: v1\nkind: ConfigMap\nmetadata: {name: frozen}\nimmutable: true\ndata: {a: one}\n", "-n", ns)
        edit = kubectl("patch", "configmap", "frozen", "-n", ns, "--type", "merge", "-p", '{"data":{"a":"two"}}', check=False)
        print(f"  patch of an immutable ConfigMap: {edit.stderr.strip()}")
        check("an immutable ConfigMap refuses a change to data", edit.returncode != 0 and "immutable" in edit.stderr)

        # ---- 3. Secret is base64 ----------------------------------------------------------------------------
        k("create", "secret", "generic", "db", "-n", ns, "--from-literal=password=s3cr3t-pw", "--from-literal=user=etl")
        data = kj("get", "secret", "db", "-n", ns)["data"]
        print(f"  secret data as the API shows it: {data}")
        check("the API shows base64, not the text", data["password"] == base64.b64encode(b"s3cr3t-pw").decode() and "s3cr3t" not in data["password"])
        decoded = k("get", "secret", "db", "-n", ns, "-o", "jsonpath={.data.password}")
        check("anyone who may `get` the Secret can decode it with one command", base64.b64decode(decoded).decode() == "s3cr3t-pw")
        yaml_view = k("get", "secret", "db", "-n", ns, "-o", "yaml")
        check("kubectl get -o yaml does not hide it either", decoded in yaml_view)

        # ---- 4. etcd ----------------------------------------------------------------------------------------
        etcd = node_sh("garden", f"ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/var/lib/minikube/certs/etcd/ca.crt --cert=/var/lib/minikube/certs/etcd/server.crt --key=/var/lib/minikube/certs/etcd/server.key get /registry/secrets/{ns}/db --print-value-only 2>&1 | strings | head -20", check=False)
        if "etcdctl: not found" in etcd or "not found" in etcd.split("\n")[0]:
            etcd = k("exec", "-n", "kube-system", "etcd-garden", "--", "sh", "-c", f"ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/var/lib/minikube/certs/etcd/ca.crt --cert=/var/lib/minikube/certs/etcd/server.crt --key=/var/lib/minikube/certs/etcd/server.key get /registry/secrets/{ns}/db --print-value-only", check=False)
        etcd = "".join(ch for ch in etcd if ch.isprintable() or ch == "\n")
        show("etcdctl get /registry/secrets/<ns>/db (what is stored on disk)", etcd[:400])
        check("the password is stored in etcd as plain text (no encryption provider is configured)", "s3cr3t-pw" in etcd, etcd[:200])
        result["etcdPlain"] = "s3cr3t-pw" in etcd

        # ---- 5. a missing key --------------------------------------------------------------------------------
        apply(f"""apiVersion: v1
kind: Pod
metadata: {{name: broken}}
spec:
  terminationGracePeriodSeconds: 1
  containers:
  - name: c
    image: {BUSYBOX}
    command: ["sleep", "3600"]
    env:
    - name: PASSWORD
      valueFrom: {{secretKeyRef: {{name: db, key: pasword}}}}
""", "-n", ns)
        wait_for(lambda: k("get", "pod", "broken", "-n", ns, "-o", "jsonpath={.status.containerStatuses[0].state.waiting.reason}", check=False) == "CreateContainerConfigError", 60, 1, "CreateContainerConfigError")
        msg = k("get", "pod", "broken", "-n", ns, "-o", "jsonpath={.status.containerStatuses[0].state.waiting.message}")
        print(f"  Pod with a misspelled key: {msg}")
        check("the Pod is stuck in CreateContainerConfigError and the message names the missing key", "pasword" in msg)
        result["missingKey"] = msg
        k("create", "secret", "generic", "db", "-n", ns, "--from-literal=pasword=fixed", "--dry-run=client", "-o", "yaml")

    if WRITE:
        write_json(LABS / "config.json", result)


main_guard(main)
