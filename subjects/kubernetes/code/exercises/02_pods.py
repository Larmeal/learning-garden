"""Lesson 2 (Pod): what the containers of one Pod share, what they do not, and what the kubelet does when a container misbehaves.

Asserts what the lesson prints:
  1. two containers of one Pod have one IP, one hostname and reach each other on localhost, but each has its own file system and (by default) its own process list
  2. an emptyDir volume is the shared folder; `shareProcessNamespace` makes the process lists shared
  3. an init container finishes before the main container starts
  4. a failing liveness probe restarts the container; a failing readiness probe only takes the Pod out of service (no restart)
  5. memory above the limit: the container is killed with exit code 137 and reason OOMKilled; QoS class follows from requests and limits
  6. restartPolicy decides Completed or CrashLoopBackOff, and a bare Pod that is deleted does not come back
Run: python exercises/02_pods.py [--write]   (--write saves labs/kubernetes/pods.json for the Pod lab)
"""

import sys
import time

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

WRITE = "--write" in sys.argv


def phase(ns: str, name: str) -> str:
    return k("get", "pod", name, "-n", ns, "-o", "jsonpath={.status.phase}", check=False)


def main() -> None:
    result: dict = {}
    with namespace("pods") as ns:
        # ---- 1. two containers, one Pod ----------------------------------------------------------------------
        apply(f"""apiVersion: v1
kind: Pod
metadata: {{name: pair}}
spec:
  terminationGracePeriodSeconds: 1
  containers:
  - name: web
    image: {BUSYBOX}
    command: ["sh", "-c", "mkdir -p /www; echo hello-from-web > /www/index.html; echo only-in-web > /tmp/web-only; exec httpd -f -p 8080 -h /www"]
  - name: sidecar
    image: {BUSYBOX}
    command: ["sh", "-c", "sleep 3600"]
""", "-n", ns)
        k("wait", "--for=condition=Ready", "pod/pair", "-n", ns, "--timeout=90s")
        ip_web = k("exec", "pair", "-n", ns, "-c", "web", "--", "hostname", "-i")
        ip_side = k("exec", "pair", "-n", ns, "-c", "sidecar", "--", "hostname", "-i")
        host_web = k("exec", "pair", "-n", ns, "-c", "web", "--", "hostname")
        host_side = k("exec", "pair", "-n", ns, "-c", "sidecar", "--", "hostname")
        pod_ip = k("get", "pod", "pair", "-n", ns, "-o", "jsonpath={.status.podIP}")
        show("hostname -i, hostname in each container", f"web     {ip_web}  {host_web}\nsidecar {ip_side}  {host_side}\nPod     {pod_ip}")
        check("both containers have the IP of the Pod", ip_web == ip_side == pod_ip)
        check("both containers have the name of the Pod as hostname", host_web == host_side == "pair")
        got = k("exec", "pair", "-n", ns, "-c", "sidecar", "--", "wget", "-qO-", "http://localhost:8080/")
        show("sidecar: wget -qO- http://localhost:8080/", got)
        check("the sidecar reaches the web container on localhost", got == "hello-from-web")
        mine = k("exec", "pair", "-n", ns, "-c", "sidecar", "--", "sh", "-c", "ls /tmp/web-only 2>&1; true")
        check("the sidecar does not see the file in /tmp of the web container (own file system)", "No such file" in mine, mine)
        procs = k("exec", "pair", "-n", ns, "-c", "sidecar", "--", "ps", "-o", "pid,args")
        show("sidecar: ps (default)", procs)
        check("by default a container sees only its own processes", "httpd" not in procs)
        result["shared"] = {"ip": True, "hostname": True, "localhost": True, "filesystem": False, "processes": False}

        # ---- 2. shared folder and shared process list --------------------------------------------------------
        apply(f"""apiVersion: v1
kind: Pod
metadata: {{name: shared}}
spec:
  terminationGracePeriodSeconds: 1
  shareProcessNamespace: true
  volumes:
  - {{name: drop, emptyDir: {{}}}}
  containers:
  - name: writer
    image: {BUSYBOX}
    command: ["sh", "-c", "echo from-writer > /drop/note; exec sleep 3600"]
    volumeMounts: [{{name: drop, mountPath: /drop}}]
  - name: reader
    image: {BUSYBOX}
    command: ["sh", "-c", "sleep 3600"]
    volumeMounts: [{{name: drop, mountPath: /seen}}]
""", "-n", ns)
        k("wait", "--for=condition=Ready", "pod/shared", "-n", ns, "--timeout=90s")
        note = k("exec", "shared", "-n", ns, "-c", "reader", "--", "cat", "/seen/note")
        procs2 = k("exec", "shared", "-n", ns, "-c", "reader", "--", "ps", "-o", "pid,args")
        show("reader: cat /seen/note, ps", note + "\n" + procs2)
        check("the emptyDir volume is a folder that both containers see (at different paths)", note == "from-writer")
        check("with shareProcessNamespace the reader sees the writer's process", "echo from-writer" in procs2 or "sleep 3600" in procs2 and procs2.count("sleep 3600") >= 2)

        # ---- 3. init container ----------------------------------------------------------------------------------
        apply(f"""apiVersion: v1
kind: Pod
metadata: {{name: init-first}}
spec:
  terminationGracePeriodSeconds: 1
  volumes:
  - {{name: w, emptyDir: {{}}}}
  initContainers:
  - name: prepare
    image: {BUSYBOX}
    command: ["sh", "-c", "sleep 3; echo ready-made > /w/data"]
    volumeMounts: [{{name: w, mountPath: /w}}]
  containers:
  - name: app
    image: {BUSYBOX}
    command: ["sh", "-c", "cat /w/data; sleep 3600"]
    volumeMounts: [{{name: w, mountPath: /w}}]
""", "-n", ns)
        k("wait", "--for=condition=Ready", "pod/init-first", "-n", ns, "--timeout=90s")
        st = kj("get", "pod", "init-first", "-n", ns)["status"]
        init_done = st["initContainerStatuses"][0]["state"]["terminated"]["finishedAt"]
        app_start = st["containerStatuses"][0]["state"]["running"]["startedAt"]
        out = k("logs", "init-first", "-n", ns, "-c", "app")
        print(f"  init finished {init_done}, app started {app_start}, app printed {out!r}")
        check("the init container finished before the app container started", init_done <= app_start)
        check("the app container found the data that the init container wrote", out == "ready-made")

        # ---- 4. liveness and readiness ----------------------------------------------------------------------
        apply(f"""apiVersion: v1
kind: Pod
metadata: {{name: probes, labels: {{app: probes}}}}
spec:
  terminationGracePeriodSeconds: 1
  containers:
  - name: app
    image: {BUSYBOX}
    command: ["sh", "-c", "touch /tmp/alive /tmp/ready; sleep 3600"]
    livenessProbe:
      exec: {{command: ["cat", "/tmp/alive"]}}
      periodSeconds: 1
      failureThreshold: 2
    readinessProbe:
      exec: {{command: ["cat", "/tmp/ready"]}}
      periodSeconds: 1
      failureThreshold: 1
""", "-n", ns)
        k("wait", "--for=condition=Ready", "pod/probes", "-n", ns, "--timeout=90s")
        k("exec", "probes", "-n", ns, "--", "rm", "/tmp/ready")
        wait_for(lambda: k("get", "pod", "probes", "-n", ns, "-o", "jsonpath={.status.conditions[?(@.type=='Ready')].status}") == "False", 30, 0.5, "Ready False")
        pod = kj("get", "pod", "probes", "-n", ns)
        print(f"  readiness fails: Ready=False, restartCount={pod['status']['containerStatuses'][0]['restartCount']}, phase={pod['status']['phase']}")
        check("a failing readiness probe makes the Pod not Ready but does not restart it", pod["status"]["containerStatuses"][0]["restartCount"] == 0 and pod["status"]["phase"] == "Running")
        k("exec", "probes", "-n", ns, "--", "touch", "/tmp/ready")
        wait_for(lambda: k("get", "pod", "probes", "-n", ns, "-o", "jsonpath={.status.conditions[?(@.type=='Ready')].status}") == "True", 30, 0.5, "Ready True again")
        k("exec", "probes", "-n", ns, "--", "rm", "/tmp/alive")
        wait_for(lambda: kj("get", "pod", "probes", "-n", ns)["status"]["containerStatuses"][0]["restartCount"] >= 1, 60, 1, "restart after liveness failure")
        ev = k("get", "events", "-n", ns, "--field-selector", "involvedObject.name=probes", "-o", "custom-columns=REASON:.reason,MSG:.message", "--no-headers")
        show("events of the Pod", ev)
        check("a failing liveness probe got the container killed and started again", "Killing" in ev and "failed liveness probe" in ev)

        # ---- 5. memory limit and QoS ------------------------------------------------------------------------
        apply(f"""apiVersion: v1
kind: Pod
metadata: {{name: hog}}
spec:
  restartPolicy: Never
  terminationGracePeriodSeconds: 1
  containers:
  - name: hog
    image: {BUSYBOX}
    command: ["sh", "-c", "x=$(head -c 120000000 /dev/zero | tr '\\\\0' a); echo survived"]
    resources:
      requests: {{memory: 32Mi, cpu: 100m}}
      limits: {{memory: 32Mi, cpu: 100m}}
""", "-n", ns)
        wait_for(lambda: phase(ns, "hog") in ("Failed", "Succeeded"), 90, 1, "hog finished")
        term = kj("get", "pod", "hog", "-n", ns)["status"]["containerStatuses"][0]["state"]["terminated"]
        print(f"  hog: reason={term['reason']} exitCode={term['exitCode']}")
        check("a container above its memory limit is OOMKilled with exit code 137", term["reason"] == "OOMKilled" and term["exitCode"] == 137)
        qos = {n: k("get", "pod", n, "-n", ns, "-o", "jsonpath={.status.qosClass}") for n in ("pair", "hog")}
        apply(f"""apiVersion: v1
kind: Pod
metadata: {{name: burst}}
spec:
  terminationGracePeriodSeconds: 1
  containers:
  - name: c
    image: {BUSYBOX}
    command: ["sleep", "3600"]
    resources:
      requests: {{memory: 16Mi, cpu: 10m}}
""", "-n", ns)
        qos["burst"] = k("get", "pod", "burst", "-n", ns, "-o", "jsonpath={.status.qosClass}")
        show("QoS classes", "\n".join(f"{a:6} {b}" for a, b in qos.items()))
        check("no requests or limits: BestEffort; requests equal to limits: Guaranteed; only requests: Burstable", qos == {"pair": "BestEffort", "hog": "Guaranteed", "burst": "Burstable"}, str(qos))
        result["oom"] = {"reason": term["reason"], "exitCode": term["exitCode"]}
        result["qos"] = qos

        # ---- 6. restartPolicy, CrashLoopBackOff, and a bare Pod that is deleted ---------------------------------
        for policy in ("Never", "OnFailure"):
            apply(f"""apiVersion: v1
kind: Pod
metadata: {{name: exits-{policy.lower()}}}
spec:
  restartPolicy: {policy}
  terminationGracePeriodSeconds: 1
  containers:
  - name: c
    image: {BUSYBOX}
    command: ["sh", "-c", "exit 1"]
""", "-n", ns)
        wait_for(lambda: phase(ns, "exits-never") == "Failed", 60, 1, "exits-never Failed")
        wait_for(lambda: kj("get", "pod", "exits-onfailure", "-n", ns)["status"]["containerStatuses"][0].get("restartCount", 0) >= 2, 90, 1, "two restarts")
        reason = kj("get", "pod", "exits-onfailure", "-n", ns)["status"]["containerStatuses"][0]
        print(f"  Never: phase=Failed; OnFailure: restartCount={reason['restartCount']} state={list(reason['state'])[0]} {reason['state'].get('waiting', {}).get('reason', '')}")
        check("restartPolicy Never leaves the Pod Failed, OnFailure restarts it", phase(ns, "exits-never") == "Failed" and reason["restartCount"] >= 2)
        apply(f"""apiVersion: v1
kind: Pod
metadata: {{name: done}}
spec:
  restartPolicy: Never
  terminationGracePeriodSeconds: 1
  containers:
  - name: c
    image: {BUSYBOX}
    command: ["sh", "-c", "echo finished"]
""", "-n", ns)
        wait_for(lambda: phase(ns, "done") == "Succeeded", 60, 1, "done Succeeded")
        check("a container that exits with 0 and restartPolicy Never leaves the Pod Succeeded (Completed)", phase(ns, "done") == "Succeeded")
        k("delete", "pod", "pair", "-n", ns, "--wait=true")
        time.sleep(3)
        check("a bare Pod that is deleted is gone for good", "pair" not in k("get", "pods", "-n", ns, "--no-headers").split())

    if WRITE:
        write_json(LABS / "pods.json", result)


main_guard(main)
