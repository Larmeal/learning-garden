"""Lesson 13 (RBAC and Pod security): who may call the API, what a container may do, and who may talk to whom.

Asserts what the lesson prints:
  1. every Pod gets a ServiceAccount token; the default ServiceAccount may do nothing (403 from inside the Pod)
  2. a Role plus a RoleBinding grants verbs on resources in one namespace and nothing else; `kubectl auth can-i` answers before you try
  3. resourceNames narrows a rule to one object; automountServiceAccountToken: false removes the token from the Pod
  4. securityContext: runAsNonRoot refuses an image that runs as root, a read-only root file system refuses writes, dropping capabilities empties the capability set
  5. Pod Security Admission: a namespace labelled `restricted` refuses a privileged Pod and a Pod that is missing the settings, and admits one that has them
  6. NetworkPolicy: a policy that selects Pods and lists no rule blocks all ingress; an allow rule by label opens one path; the CNI (kindnet) enforces it
Run: python exercises/13_rbac_security.py [--write]   (--write saves labs/kubernetes/security.json for the security lab)
"""

import sys
import time

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

WRITE = "--write" in sys.argv
TOKEN_DIR = "/var/run/secrets/kubernetes.io/serviceaccount"


def sleeper(name: str, extra: str = "", sec: str = "", labels: str = "app: x", image: str = BUSYBOX) -> str:
    return f"""apiVersion: v1
kind: Pod
metadata: {{name: {name}, labels: {{{labels}}}}}
spec:
  terminationGracePeriodSeconds: 1
{extra}  containers:
  - name: c
    image: {image}
    command: ["sleep", "3600"]
{sec}"""


def api_get(ns: str, pod: str, path: str) -> str:
    """Call the API server from inside a Pod with that Pod's own token; return 'CODE body-start'."""
    script = (
        f"T=$(cat {TOKEN_DIR}/token); "
        f"curl -s -o /tmp/b -w '%{{http_code}}' --max-time 5 -H \"Authorization: Bearer $T\" --cacert {TOKEN_DIR}/ca.crt https://kubernetes.default.svc{path}; echo; tr -d '\n ' < /tmp/b | head -c 400"
    )
    return k("exec", pod, "-n", ns, "--", "sh", "-c", script, check=False)


def can_i(sa_ns: str, verb: str, what: str, in_ns: str, sa: str = "default") -> str:
    return k("auth", "can-i", verb, what, "-n", in_ns, f"--as=system:serviceaccount:{sa_ns}:{sa}", check=False).strip()


def main() -> None:
    result: dict = {}
    with namespace("rbac") as ns, namespace("rbac-other") as other:
        apply(sleeper("p", image=CURL), "-n", ns)
        apply(f"""apiVersion: v1
kind: Pod
metadata: {{name: victim, labels: {{app: victim}}}}
spec:
  terminationGracePeriodSeconds: 1
  containers:
  - name: c
    image: {BUSYBOX}
    command: ["sh", "-c", "mkdir -p /w; echo victim > /w/index.html; exec httpd -f -p 8080 -h /w"]
""", "-n", other)
        k("wait", "--for=condition=Ready", "pod/p", "-n", ns, "--timeout=60s")
        k("wait", "--for=condition=Ready", "pod/victim", "-n", other, "--timeout=60s")

        # ---- 1. the token and the default ServiceAccount ----------------------------------------------------------
        files = k("exec", "p", "-n", ns, "--", "ls", TOKEN_DIR).split()
        print(f"  {TOKEN_DIR}: {files}")
        check("every Pod has a token, the cluster CA and its namespace mounted as files", sorted(files) == ["ca.crt", "namespace", "token"])
        out = api_get(ns, "p", f"/api/v1/namespaces/{ns}/pods")
        show("from inside the Pod: GET /api/v1/namespaces/<ns>/pods", out[:260])
        check("the API server knows who is calling and says 403 Forbidden", out.startswith("403") and f"system:serviceaccount:{ns}:default" in out)
        result["defaultDenied"] = True

        # ---- 2. Role and RoleBinding -----------------------------------------------------------------------------
        print(f"  can-i before: list pods = {can_i(ns, 'list', 'pods', ns)}")
        apply(f"""apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: {{name: pod-reader}}
rules:
- apiGroups: [""]
  resources: [pods]
  verbs: [get, list]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: {{name: read-pods}}
subjects: [{{kind: ServiceAccount, name: default, namespace: {ns}}}]
roleRef: {{kind: Role, name: pod-reader, apiGroup: rbac.authorization.k8s.io}}
""", "-n", ns)
        rows = [
            ["list pods", ns, can_i(ns, "list", "pods", ns)],
            ["delete pods", ns, can_i(ns, "delete", "pods", ns)],
            ["list secrets", ns, can_i(ns, "list", "secrets", ns)],
            ["list pods", other, can_i(ns, "list", "pods", other)],
        ]
        show("kubectl auth can-i --as system:serviceaccount:<ns>:default", table(rows, ["verb and resource", "in namespace", "answer"]))
        check("the Role allows list pods in its own namespace", rows[0][2] == "yes")
        check("and nothing else: not delete, not secrets, not another namespace", [r[2] for r in rows[1:]] == ["no", "no", "no"])
        out = api_get(ns, "p", f"/api/v1/namespaces/{ns}/pods")
        check("the same call from inside the Pod now returns 200 and the Pod list", out.startswith("200") and "PodList" in out)
        out2 = api_get(ns, "p", f"/api/v1/namespaces/{other}/pods")
        check("the other namespace is still 403", out2.startswith("403"))
        result["can_i"] = [{"what": r[0], "ns": r[1], "answer": r[2]} for r in rows]

        # ---- 3. resourceNames and no token ---------------------------------------------------------------------------
        apply("apiVersion: v1\nkind: Secret\nmetadata: {name: s1}\nstringData: {v: one}\n---\napiVersion: v1\nkind: Secret\nmetadata: {name: s2}\nstringData: {v: two}\n", "-n", ns)
        apply(f"""apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: {{name: one-secret}}
rules:
- apiGroups: [""]
  resources: [secrets]
  resourceNames: [s1]
  verbs: [get]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: {{name: one-secret}}
subjects: [{{kind: ServiceAccount, name: default, namespace: {ns}}}]
roleRef: {{kind: Role, name: one-secret, apiGroup: rbac.authorization.k8s.io}}
""", "-n", ns)
        a1 = k("auth", "can-i", "get", "secret/s1", "-n", ns, f"--as=system:serviceaccount:{ns}:default", check=False).strip()
        a2 = k("auth", "can-i", "get", "secret/s2", "-n", ns, f"--as=system:serviceaccount:{ns}:default", check=False).strip()
        a3 = can_i(ns, "list", "secrets", ns)
        print(f"  get secret/s1: {a1}; get secret/s2: {a2}; list secrets: {a3}")
        check("resourceNames limits the rule to one object (s1 yes, s2 no, list no)", (a1, a2, a3) == ("yes", "no", "no"))
        apply(sleeper("notoken", "  automountServiceAccountToken: false\n"), "-n", ns)
        k("wait", "--for=condition=Ready", "pod/notoken", "-n", ns, "--timeout=60s")
        miss = k("exec", "notoken", "-n", ns, "--", "sh", "-c", f"ls {TOKEN_DIR} 2>&1; true")
        check("with automountServiceAccountToken: false the Pod has no token file at all", "No such file" in miss)

        # ---- 4. securityContext ----------------------------------------------------------------------------------------
        apply(sleeper("must-not-be-root", sec="    securityContext: {runAsNonRoot: true}\n"), "-n", ns)
        wait_for(lambda: k("get", "pod", "must-not-be-root", "-n", ns, "-o", "jsonpath={.status.containerStatuses[0].state.waiting.reason}", check=False) == "CreateContainerConfigError", 60, 1, "refused")
        msg = k("get", "pod", "must-not-be-root", "-n", ns, "-o", "jsonpath={.status.containerStatuses[0].state.waiting.message}")
        print(f"  runAsNonRoot on an image that runs as root: {msg}")
        check("runAsNonRoot refuses to start a container whose image runs as root", "runAsNonRoot" in msg and "root" in msg)
        apply(sleeper("hardened", sec="""    securityContext:
      runAsNonRoot: true
      runAsUser: 10001
      readOnlyRootFilesystem: true
      allowPrivilegeEscalation: false
      capabilities: {drop: [ALL]}
      seccompProfile: {type: RuntimeDefault}
"""), "-n", ns)
        apply(sleeper("plain"), "-n", ns)
        k("wait", "--for=condition=Ready", "pod/hardened", "pod/plain", "-n", ns, "--timeout=60s")
        uid = k("exec", "hardened", "-n", ns, "--", "id", "-u")
        write = k("exec", "hardened", "-n", ns, "--", "sh", "-c", "touch /x 2>&1; true")
        caps_h = k("exec", "hardened", "-n", ns, "--", "sh", "-c", "grep CapEff /proc/self/status").split()[-1]
        caps_p = k("exec", "plain", "-n", ns, "--", "sh", "-c", "grep CapEff /proc/self/status").split()[-1]
        uid_p = k("exec", "plain", "-n", ns, "--", "id", "-u")
        show("hardened against plain", f"id -u           {uid:>8}   {uid_p}\ntouch /x        {write.strip()[:40]}\nCapEff          {caps_h}   {caps_p}")
        check("the hardened container runs as uid 10001 and the plain one as root (0)", uid == "10001" and uid_p == "0")
        check("a read-only root file system refuses a write", "Read-only file system" in write)
        check("dropping ALL capabilities leaves an empty capability set, the plain container keeps the default set", int(caps_h, 16) == 0 and int(caps_p, 16) > 0)
        result["caps"] = {"hardened": caps_h, "plain": caps_p}

        # ---- 5. Pod Security Admission -----------------------------------------------------------------------------------
        k("label", "namespace", ns, "pod-security.kubernetes.io/enforce=restricted", "--overwrite")
        priv = kubectl("apply", "-f", "-", "-n", ns, input=sleeper("priv", sec="    securityContext: {privileged: true}\n"), check=False)
        plain = kubectl("apply", "-f", "-", "-n", ns, input=sleeper("plain2"), check=False)
        ok = kubectl("apply", "-f", "-", "-n", ns, input=sleeper("ok", sec="""    securityContext:
      runAsNonRoot: true
      runAsUser: 10001
      allowPrivilegeEscalation: false
      capabilities: {drop: [ALL]}
      seccompProfile: {type: RuntimeDefault}
"""), check=False)
        print(f"  restricted + privileged Pod: {priv.stderr.strip()[:230]}")
        print(f"  restricted + plain Pod: {plain.stderr.strip()[:230]}")
        check("a privileged Pod is refused by the restricted level", priv.returncode != 0 and "violates PodSecurity" in priv.stderr and "privileged" in priv.stderr)
        check("so is a plain Pod: the message lists every setting that is missing", plain.returncode != 0 and "allowPrivilegeEscalation" in plain.stderr and "runAsNonRoot" in plain.stderr)
        check("a Pod with the five settings is admitted", ok.returncode == 0, ok.stderr)
        check("Pods that were already running are left alone (the check is at admission)", k("get", "pod", "plain", "-n", ns, "-o", "jsonpath={.status.phase}") == "Running")
        result["psa"] = {"privileged": "refused", "plain": "refused", "hardened": "admitted"}

        # ---- 6. NetworkPolicy ------------------------------------------------------------------------------------------------
        k("label", "namespace", ns, "pod-security.kubernetes.io/enforce-", "--overwrite")
        for n, lab in (("srv", "app: srv"), ("friend", "app: friend"), ("stranger", "app: stranger")):
            apply(f"""apiVersion: v1
kind: Pod
metadata: {{name: {n}, labels: {{{lab}}}}}
spec:
  terminationGracePeriodSeconds: 1
  containers:
  - name: c
    image: {BUSYBOX}
    command: ["sh", "-c", "mkdir -p /w; echo {n} > /w/index.html; exec httpd -f -p 8080 -h /w"]
""", "-n", ns)
        for n in ("srv", "friend", "stranger"):
            k("wait", "--for=condition=Ready", f"pod/{n}", "-n", ns, "--timeout=60s")
        srv_ip = k("get", "pod", "srv", "-n", ns, "-o", "jsonpath={.status.podIP}")
        victim_ip = k("get", "pod", "victim", "-n", other, "-o", "jsonpath={.status.podIP}")

        def reach(frm: str, frm_ns: str, ip: str) -> str:
            r = kubectl("exec", frm, "-n", frm_ns, "--", "wget", "-qO-", "-T", "3", f"http://{ip}:8080/", check=False)
            return "reached" if r.returncode == 0 else "blocked"

        before = {n: reach(n, ns, srv_ip) for n in ("friend", "stranger")}
        print(f"  no policy: {before}")
        check("without any NetworkPolicy every Pod can reach every Pod", set(before.values()) == {"reached"})
        apply("apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata: {name: deny-all}\nspec:\n  podSelector: {matchLabels: {app: srv}}\n  policyTypes: [Ingress]\n", "-n", ns)
        time.sleep(4)
        deny = {n: reach(n, ns, srv_ip) for n in ("friend", "stranger")}
        print(f"  policy that selects srv and lists no rule: {deny}")
        check("a policy that selects the Pod and lists no ingress rule blocks everyone", set(deny.values()) == {"blocked"})
        apply("apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata: {name: allow-friend}\nspec:\n  podSelector: {matchLabels: {app: srv}}\n  policyTypes: [Ingress]\n  ingress:\n  - from: [{podSelector: {matchLabels: {app: friend}}}]\n    ports: [{port: 8080}]\n", "-n", ns)
        time.sleep(4)
        allow = {n: reach(n, ns, srv_ip) for n in ("friend", "stranger")}
        cross = reach("victim", other, srv_ip)
        print(f"  plus an allow rule for app=friend: {allow}; a Pod of another namespace: {cross}")
        check("an allow rule opens the path for the Pods it names and only them", allow == {"friend": "reached", "stranger": "blocked"})
        check("a podSelector without a namespaceSelector means the same namespace, so a Pod of another namespace is blocked", cross == "blocked")
        check("Pods that no policy selects stay open (the stranger can still reach the victim)", reach("stranger", ns, victim_ip) == "reached")
        result["netpol"] = {"none": before, "denyAll": deny, "allowFriend": allow, "otherNamespace": cross}

    if WRITE:
        write_json(LABS / "security.json", result)


main_guard(main)
