"""Lesson 14 (Helm, autoscaling and finding out why a Pod is broken).

Asserts what the lesson prints:
  1. a Helm chart is a folder of templates plus default values; `helm template` only renders text, `--set` and `-f` override the defaults in a fixed order
  2. `helm install` makes a release: the objects, labelled managed-by Helm, plus a Secret per revision that holds the release itself
  3. `helm upgrade` makes revision 2, `helm rollback` makes revision 3 with the old content, a failed upgrade leaves the release 'failed' while the old Pods keep serving
  4. `helm uninstall` removes the objects and the release Secrets
  5. the HorizontalPodAutoscaler reads CPU from metrics-server and changes replicas: up fast, down after a stabilization window
  6. the common broken states of a Pod, what `kubectl get` shows for each and which command shows the cause
Run: python exercises/14_helm_hpa_debug.py [--write]   (--write saves labs/kubernetes/ops.json for the helm and debug labs)
Needs `helm` v3 on PATH (written with v3.13.3) and the minikube metrics-server addon.
"""

import json
import sys
import time

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

WRITE = "--write" in sys.argv

CHART_YAML = "apiVersion: v2\nname: webapp\ndescription: a tiny chart for the lesson\nversion: 0.1.0\nappVersion: \"1.0\"\n"
VALUES = "replicas: 2\nmessage: v1\nimage: busybox:1.37\nservice:\n  port: 80\n"
DEPLOYMENT = """apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-webapp
spec:
  replicas: {{ .Values.replicas }}
  selector:
    matchLabels: {app: {{ .Release.Name }}-webapp}
  template:
    metadata:
      labels: {app: {{ .Release.Name }}-webapp}
    spec:
      terminationGracePeriodSeconds: 1
      containers:
      - name: web
        image: {{ .Values.image }}
        command: ["sh", "-c", "mkdir -p /www; echo {{ .Values.message }} > /www/index.html; exec httpd -f -p 8080 -h /www"]
        readinessProbe: {httpGet: {path: /, port: 8080}, periodSeconds: 1}
"""
SERVICE = """apiVersion: v1
kind: Service
metadata:
  name: {{ .Release.Name }}-webapp
spec:
  selector: {app: {{ .Release.Name }}-webapp}
  ports: [{port: {{ .Values.service.port }}, targetPort: 8080}]
"""


def helm(*args: str, check: bool = True, timeout: int = 180) -> str:
    done = run_cmd(["helm", *args], check=check, timeout=timeout)
    return (done.stdout + done.stderr).rstrip("\n")


def release_rows(ns: str) -> list[dict]:
    return json.loads(helm("list", "-n", ns, "-a", "-o", "json"))


def main() -> None:
    result: dict = {}
    chart = fresh_dir("chart") / "webapp"
    (chart / "templates").mkdir(parents=True)
    (chart / "Chart.yaml").write_text(CHART_YAML, encoding="utf-8")
    (chart / "values.yaml").write_text(VALUES, encoding="utf-8")
    (chart / "templates" / "deployment.yaml").write_text(DEPLOYMENT, encoding="utf-8")
    (chart / "templates" / "service.yaml").write_text(SERVICE, encoding="utf-8")
    ver = helm("version", "--short")
    print(f"  {ver}")
    check("Helm 3 is installed", ver.startswith("v3."))

    with namespace("helm") as ns:
        # ---- 1. template and values -------------------------------------------------------------------------------
        check("helm lint finds no problem in the chart", "0 chart(s) failed" in helm("lint", str(chart)))
        rendered = helm("template", "demo", str(chart))
        rendered5 = helm("template", "demo", str(chart), "--set", "replicas=5,message=hi")
        vals = chart.parent / "prod.yaml"
        vals.write_text("replicas: 7\nmessage: from-file\n", encoding="utf-8")
        both = helm("template", "demo", str(chart), "-f", str(vals), "--set", "replicas=9")
        rep = lambda text: [int(x.split(":")[1]) for x in text.splitlines() if x.strip().startswith("replicas:")][0]  # noqa: E731
        print(f"  replicas: chart default {rep(rendered)}, --set {rep(rendered5)}, -f file {rep(helm('template', 'demo', str(chart), '-f', str(vals)))}, -f file and --set {rep(both)}")
        check("helm template only prints YAML: nothing was created in the cluster", k("get", "all", "-n", ns, "--no-headers", check=False) == "")
        check("{{ .Release.Name }} became the release name in the rendered text", "name: demo-webapp" in rendered)
        check("the default is 2, --set replaces it", rep(rendered) == 2 and rep(rendered5) == 5)
        check("order of precedence: defaults < -f file < --set", rep(both) == 9 and rep(helm("template", "demo", str(chart), "-f", str(vals))) == 7)
        result["values"] = {"default": 2, "set": 5, "file": 7, "fileAndSet": 9}

        # ---- 2. install ------------------------------------------------------------------------------------------------
        helm("install", "demo", str(chart), "-n", ns, "--wait", "--timeout", "90s")
        rel = release_rows(ns)[0]
        print(f"  helm list: {rel['name']} revision {rel['revision']} status {rel['status']} chart {rel['chart']}")
        check("the release is deployed at revision 1", rel["status"] == "deployed" and rel["revision"] == "1")
        dep = kj("get", "deployment", "demo-webapp", "-n", ns)
        check("the objects carry the label app.kubernetes.io/managed-by=Helm and the release annotations", dep["metadata"]["labels"].get("app.kubernetes.io/managed-by") == "Helm" and dep["metadata"]["annotations"].get("meta.helm.sh/release-name") == "demo")
        secrets = k("get", "secrets", "-n", ns, "--no-headers", "-o", "custom-columns=N:.metadata.name,T:.type").splitlines()
        print(f"  secrets: {secrets}")
        check("Helm keeps the release in a Secret of type helm.sh/release.v1, one per revision", any("sh.helm.release.v1.demo.v1" in s and "helm.sh/release.v1" in s for s in secrets))
        wait_for(lambda: len(ready_pods(ns, "app=demo-webapp")) == 2, 60, 1, "2 Pods")
        pod = ready_pods(ns, "app=demo-webapp")[0]
        say = lambda: k("exec", pod, "-n", ns, "--", "wget", "-qO-", "http://localhost:8080/")  # noqa: E731

        # ---- 3. upgrade, rollback, a failed upgrade ----------------------------------------------------------------------
        helm("upgrade", "demo", str(chart), "-n", ns, "--set", "replicas=3,message=v2", "--wait", "--timeout", "90s")
        wait_for(lambda: len(ready_pods(ns, "app=demo-webapp")) == 3, 60, 1, "3 Pods")
        pod = ready_pods(ns, "app=demo-webapp")[0]
        hist = json.loads(helm("history", "demo", "-n", ns, "-o", "json"))
        print(f"  after upgrade: revisions {[h['revision'] for h in hist]}, a Pod says {say()!r}")
        check("upgrade made revision 2 and the Pods say v2", [h["revision"] for h in hist] == [1, 2] and say() == "v2" and hist[0]["status"] == "superseded")
        helm("rollback", "demo", "1", "-n", ns, "--wait", "--timeout", "90s")
        wait_for(lambda: len(ready_pods(ns, "app=demo-webapp")) == 2, 60, 1, "2 Pods")
        pod = ready_pods(ns, "app=demo-webapp")[0]
        hist = json.loads(helm("history", "demo", "-n", ns, "-o", "json"))
        print(f"  after rollback to 1: revisions {[(h['revision'], h['status']) for h in hist]}, a Pod says {say()!r}")
        check("rollback to 1 makes revision 3 (history only grows) with the content of revision 1", [h["revision"] for h in hist] == [1, 2, 3] and say() == "v1" and hist[-1]["status"] == "deployed")
        failed = run_cmd(["helm", "upgrade", "demo", str(chart), "-n", ns, "--set", "image=busybox:no-such-tag", "--wait", "--timeout", "25s"], check=False, timeout=120)
        status = release_rows(ns)[0]
        serving = len(ready_pods(ns, "app=demo-webapp"))
        print(f"  upgrade with a bad image: exit {failed.returncode}: {(failed.stderr or failed.stdout).strip()[:90]}; release status {status['status']}; Ready Pods {serving}")
        check("--wait notices that the new Pods never get ready: the command fails and the release is marked failed", failed.returncode != 0 and status["status"] == "failed")
        check("the old Pods are still serving (a rolling update never removed them all)", serving >= 1)
        helm("rollback", "demo", "3", "-n", ns, "--wait", "--timeout", "90s")
        check("rollback to the last good revision repairs it", release_rows(ns)[0]["status"] == "deployed")
        result["history"] = [{"revision": h["revision"], "status": h["status"]} for h in json.loads(helm("history", "demo", "-n", ns, "-o", "json"))]

        # ---- 4. uninstall ---------------------------------------------------------------------------------------------------
        helm("uninstall", "demo", "-n", ns)
        wait_for(lambda: k("get", "deployments,services,secrets", "-n", ns, "--no-headers", check=False).count("demo") == 0, 60, 1, "removed")
        check("uninstall removes the Deployment, the Service and every release Secret", release_rows(ns) == [])

        # ---- 5. autoscaling -------------------------------------------------------------------------------------------------
        wait_for(lambda: k("top", "nodes", "--no-headers", check=False).count("%") >= 3, 150, 3, "metrics-server answering")
        apply(f"""apiVersion: apps/v1
kind: Deployment
metadata: {{name: burn}}
spec:
  replicas: 1
  selector: {{matchLabels: {{app: burn}}}}
  template:
    metadata: {{labels: {{app: burn}}}}
    spec:
      terminationGracePeriodSeconds: 1
      containers:
      - name: c
        image: {BUSYBOX}
        command: ["sh", "-c", "while :; do :; done"]
        resources: {{requests: {{cpu: 100m}}, limits: {{cpu: 200m}}}}
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: {{name: burn}}
spec:
  scaleTargetRef: {{apiVersion: apps/v1, kind: Deployment, name: burn}}
  minReplicas: 1
  maxReplicas: 4
  metrics:
  - type: Resource
    resource: {{name: cpu, target: {{type: Utilization, averageUtilization: 50}}}}
  behavior:
    scaleDown: {{stabilizationWindowSeconds: 20}}
""", "-n", ns)
        t0 = time.time()
        wait_for(lambda: any("resource" in m for m in kj("get", "hpa", "burn", "-n", ns)["status"].get("currentMetrics") or []), 150, 3, "first metric")
        h = kj("get", "hpa", "burn", "-n", ns)
        util = h["status"]["currentMetrics"][0]["resource"]["current"]["averageUtilization"]
        print(f"  first reading after {time.time() - t0:.0f}s: {util}% of the CPU request, target 50%")
        check("a busy container held to 200m by its limit uses about 200% of its 100m request", 150 <= util <= 260, str(util))
        wait_for(lambda: kj("get", "deployment", "burn", "-n", ns)["spec"]["replicas"] == 4, 120, 3, "scaled to 4")
        t_up = time.time() - t0
        print(f"  replicas 1 -> 4 after {t_up:.0f}s (desired = ceil(1 x {util}/50), capped by maxReplicas 4)")
        check("the HPA raised replicas to the maximum of 4", kj("get", "deployment", "burn", "-n", ns)["spec"]["replicas"] == 4)
        k("patch", "deployment", "burn", "-n", ns, "--type", "json", "-p", '[{"op":"replace","path":"/spec/template/spec/containers/0/command","value":["sleep","3600"]}]')
        t1 = time.time()
        wait_for(lambda: kj("get", "deployment", "burn", "-n", ns)["spec"]["replicas"] == 1, 240, 4, "scaled back to 1")
        t_down = time.time() - t1
        print(f"  load removed: replicas back to 1 after {t_down:.0f}s")
        check("with the load gone the HPA lowers replicas to minReplicas, only after the stabilization window", t_down > 20)
        result["hpa"] = {"utilization": util, "upSeconds": round(t_up), "downSeconds": round(t_down)}
        k("delete", "hpa", "burn", "-n", ns)

        # ---- 6. a catalogue of broken Pods -------------------------------------------------------------------------------------
        def mk(name: str, cmd: str = "sleep 3600", image: str = BUSYBOX, res: str = "") -> str:
            return f"apiVersion: v1\nkind: Pod\nmetadata: {{name: {name}}}\nspec:\n  terminationGracePeriodSeconds: 1\n  containers:\n  - name: c\n    image: {image}\n    command: [\"sh\", \"-c\", \"{cmd}\"]\n{res}"

        apply(mk("bad-image", image="busybox:no-such-tag") + "---\n" + mk("crash", "echo boom; exit 1") + "---\n" + mk("too-big", res="    resources: {requests: {cpu: '64'}}\n") + "---\n" + mk("healthy"), "-n", ns)
        apply(f"apiVersion: v1\nkind: Service\nmetadata: {{name: typo}}\nspec:\n  selector: {{app: helthy}}\n  ports: [{{port: 80, targetPort: 8080}}]\n", "-n", ns)
        wait_for(lambda: k("get", "pod", "crash", "-n", ns, "-o", "jsonpath={.status.containerStatuses[0].state.waiting.reason}", check=False) == "CrashLoopBackOff" and int(k("get", "pod", "crash", "-n", ns, "-o", "jsonpath={.status.containerStatuses[0].restartCount}") or 0) >= 2, 150, 3, "CrashLoopBackOff")
        wait_for(lambda: k("get", "pod", "bad-image", "-n", ns, "-o", "jsonpath={.status.containerStatuses[0].state.waiting.reason}", check=False) in ("ImagePullBackOff", "ErrImagePull"), 60, 2, "image pull failure")
        rows = k("get", "pods", "-n", ns, "--no-headers", "-o", "custom-columns=NAME:.metadata.name,READY:.status.containerStatuses[0].ready,STATUS:.status.containerStatuses[0].state.waiting.reason,PHASE:.status.phase").splitlines()
        show("kubectl get pods", "\n".join(rows))
        status = {r.split()[0]: r.split()[2] for r in rows}
        check("a bad image tag shows ImagePullBackOff", status["bad-image"] in ("ImagePullBackOff", "ErrImagePull"))
        check("a container that keeps exiting shows CrashLoopBackOff", status["crash"] == "CrashLoopBackOff")
        check("a Pod that fits nowhere has no container status at all and the phase Pending", status["too-big"] == "<none>" and "Pending" in [r for r in rows if r.startswith("too-big")][0])
        prev = k("logs", "crash", "-n", ns, "--previous")
        restarts = int(k("get", "pod", "crash", "-n", ns, "-o", "jsonpath={.status.containerStatuses[0].restartCount}"))
        desc = k("describe", "pod", "bad-image", "-n", ns)
        ev_pending = k("get", "events", "-n", ns, "--field-selector", "involvedObject.name=too-big", "-o", "jsonpath={.items[0].message}")
        print(f"  kubectl logs --previous crash: {prev!r}; restartCount {restarts}\n  describe bad-image: {[l.strip() for l in desc.splitlines() if 'Failed to pull' in l][:1]}\n  event of too-big: {ev_pending[:70]}")
        check("kubectl logs --previous shows the output of the run that died", prev == "boom")
        check("kubectl describe has the reason for the image failure in its events", "Failed to pull image" in desc and "no-such-tag" in desc)
        check("the events of a Pending Pod say which resource is short", "Insufficient cpu" in ev_pending)
        eps = kj("get", "endpoints", "typo", "-n", ns)
        check("a Service whose selector matches nothing has no addresses (the usual cause is a typo in a label)", not eps.get("subsets"))
        result["debug"] = {"badImage": status["bad-image"], "crash": status["crash"], "tooBig": "Pending", "logsPrevious": prev, "noEndpoints": True}

    if WRITE:
        write_json(LABS / "ops.json", result)


main_guard(main)
