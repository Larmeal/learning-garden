"""Lesson 6 (Job, CronJob, DaemonSet, StatefulSet): workloads that are not "N identical copies that run forever".

Asserts what the lesson prints:
  1. a Job runs Pods to completion: completions and parallelism, a retry after a failure (backoffLimit) and a Job that gives up
  2. a CronJob makes a Job from a template (we trigger one by hand and also wait for the schedule to fire once)
  3. a DaemonSet puts one Pod on every node that matches (control plane included when it tolerates the taint)
  4. a StatefulSet gives Pods stable names (db-0, db-1, db-2), starts them in order, gives each its own volume and brings a deleted Pod back with the same name and the same data
Run: python exercises/06_jobs_stateful.py [--write]   (--write saves labs/kubernetes/workloads.json for the workload lab)
"""

import sys
import time

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

WRITE = "--write" in sys.argv


def main() -> None:
    result: dict = {}
    with namespace("workloads") as ns:
        # ---- 1. Jobs ----------------------------------------------------------------------------------------
        apply(f"""apiVersion: batch/v1
kind: Job
metadata: {{name: parallel}}
spec:
  completions: 6
  parallelism: 2
  template:
    spec:
      restartPolicy: Never
      terminationGracePeriodSeconds: 1
      containers:
      - name: c
        image: {BUSYBOX}
        command: ["sh", "-c", "sleep 3; echo done-$(hostname)"]
""", "-n", ns)
        peak = 0
        t0 = time.time()
        while time.time() - t0 < 90:
            j = kj("get", "job", "parallel", "-n", ns)["status"]
            peak = max(peak, j.get("active", 0))
            if j.get("succeeded", 0) == 6:
                break
            time.sleep(0.5)
        took = time.time() - t0
        j = kj("get", "job", "parallel", "-n", ns)
        print(f"  Job with completions 6, parallelism 2: succeeded={j['status']['succeeded']}, most Pods at once={peak}, took {took:.0f}s")
        check("six Pods succeeded, never more than two at the same time", j["status"]["succeeded"] == 6 and peak == 2)
        check("the Job is marked Complete", any(c["type"] == "Complete" and c["status"] == "True" for c in j["status"]["conditions"]))
        names = k("get", "pods", "-n", ns, "-l", "job-name=parallel", "--no-headers", "-o", "custom-columns=S:.status.phase").split()
        check("the finished Pods are kept (status Succeeded) so that their logs can be read", names.count("Succeeded") == 6)
        result["job"] = {"completions": 6, "parallelism": 2, "peak": peak}

        apply(f"""apiVersion: batch/v1
kind: Job
metadata: {{name: flaky}}
spec:
  backoffLimit: 2
  template:
    spec:
      restartPolicy: Never
      terminationGracePeriodSeconds: 1
      containers:
      - name: c
        image: {BUSYBOX}
        command: ["sh", "-c", "echo trying; exit 1"]
""", "-n", ns)
        wait_for(lambda: any(c["type"] == "Failed" for c in kj("get", "job", "flaky", "-n", ns)["status"].get("conditions", [])), 150, 2, "Job flaky Failed")
        j = kj("get", "job", "flaky", "-n", ns)
        cond = [c for c in j["status"]["conditions"] if c["type"] == "Failed"][0]
        print(f"  Job with backoffLimit 2 and a Pod that always fails: failed={j['status']['failed']} Pods, reason={cond['reason']}")
        check("after backoffLimit retries the Job gives up (3 Pods failed in all)", j["status"]["failed"] == 3 and cond["reason"] == "BackoffLimitExceeded")
        result["flaky"] = {"failed": j["status"]["failed"], "reason": cond["reason"]}

        # ---- 2. CronJob -------------------------------------------------------------------------------------
        apply(f"""apiVersion: batch/v1
kind: CronJob
metadata: {{name: tick}}
spec:
  schedule: "* * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 2
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: Never
          terminationGracePeriodSeconds: 1
          containers:
          - name: c
            image: {BUSYBOX}
            command: ["sh", "-c", "date +%T; echo tick"]
""", "-n", ns)
        k("create", "job", "by-hand", "--from=cronjob/tick", "-n", ns)
        wait_for(lambda: kj("get", "job", "by-hand", "-n", ns)["status"].get("succeeded") == 1, 60, 1, "by-hand Job")
        owner = kj("get", "job", "by-hand", "-n", ns)["metadata"]["ownerReferences"][0]["kind"]
        check("kubectl create job --from=cronjob copies the template of the CronJob (owned by it)", owner == "CronJob")
        t0 = time.time()
        wait_for(lambda: len([x for x in kj("get", "jobs", "-n", ns)["items"] if x["metadata"]["name"].startswith("tick-")]) >= 1, 130, 2, "the schedule fires")
        fired = time.time() - t0
        first = [x for x in kj("get", "jobs", "-n", ns)["items"] if x["metadata"]["name"].startswith("tick-")][0]
        print(f"  the schedule '* * * * *' created Job {first['metadata']['name']} {fired:.0f}s after the CronJob (at most 60 s)")
        check("the CronJob created a Job by itself at the next whole minute", fired <= 75, f"{fired:.0f}s")
        k("delete", "cronjob", "tick", "-n", ns)

        # ---- 3. DaemonSet -----------------------------------------------------------------------------------
        ds = lambda tol: f"""apiVersion: apps/v1
kind: DaemonSet
metadata: {{name: agent}}
spec:
  selector: {{matchLabels: {{app: agent}}}}
  template:
    metadata: {{labels: {{app: agent}}}}
    spec:
      terminationGracePeriodSeconds: 1
{tol}      containers:
      - name: c
        image: {BUSYBOX}
        command: ["sleep", "3600"]
"""  # noqa: E731
        apply(ds(""), "-n", ns)
        wait_for(lambda: len(ready_pods(ns, "app=agent")) == 2, 60, 1, "2 agents")
        on = sorted(p["spec"]["nodeName"] for p in pods(ns, "app=agent"))
        print(f"  DaemonSet without a toleration: {on}")
        check("one Pod on each worker and none on the tainted control plane", on == ["garden-m02", "garden-m03"])
        apply(ds("      tolerations: [{operator: Exists}]\n"), "-n", ns)
        wait_for(lambda: len(ready_pods(ns, "app=agent")) == 3, 60, 1, "3 agents")
        on = sorted(p["spec"]["nodeName"] for p in pods(ns, "app=agent"))
        check("with a toleration for every taint, the control plane gets one too (that is how kube-proxy and kindnet run there)", on == ["garden", "garden-m02", "garden-m03"])
        result["daemonset"] = on
        k("delete", "daemonset", "agent", "-n", ns, "--wait=true")

        # ---- 4. StatefulSet ---------------------------------------------------------------------------------
        apply(f"""apiVersion: v1
kind: Service
metadata: {{name: db}}
spec:
  clusterIP: None
  selector: {{app: db}}
  ports: [{{port: 5432}}]
---
apiVersion: apps/v1
kind: StatefulSet
metadata: {{name: db}}
spec:
  serviceName: db
  replicas: 3
  selector: {{matchLabels: {{app: db}}}}
  template:
    metadata: {{labels: {{app: db}}}}
    spec:
      terminationGracePeriodSeconds: 1
      # minikube's default StorageClass makes hostPath volumes, which live on the node where the Pod runs (see exercise 09), so this exercise pins the Pods to one worker.
      nodeSelector: {{kubernetes.io/hostname: garden-m02}}
      containers:
      - name: c
        image: {BUSYBOX}
        command: ["sh", "-c", "[ -f /data/id ] || hostname > /data/id; echo started-at-$(date +%s) >> /data/starts; sleep 3600"]
        volumeMounts: [{{name: data, mountPath: /data}}]
        readinessProbe:
          exec: {{command: ["cat", "/data/id"]}}
          initialDelaySeconds: 2
          periodSeconds: 1
  volumeClaimTemplates:
  - metadata: {{name: data}}
    spec:
      accessModes: [ReadWriteOnce]
      resources: {{requests: {{storage: 16Mi}}}}
""", "-n", ns)
        wait_for(lambda: len(ready_pods(ns, "app=db")) == 3, 150, 2, "3 db Pods")
        pod_list = sorted(pods(ns, "app=db"), key=lambda p: p["metadata"]["name"])
        names = [p["metadata"]["name"] for p in pod_list]
        starts = [p["status"]["startTime"] for p in pod_list]
        print(f"  Pods: {names}, started in order: {starts == sorted(starts)}")
        check("the Pods are db-0, db-1 and db-2", names == ["db-0", "db-1", "db-2"])
        check("they were created one after the other, in order", starts == sorted(starts) and len(set(starts)) >= 2)
        pvcs = sorted(k("get", "pvc", "-n", ns, "-o", "jsonpath={.items[*].metadata.name}").split())
        print(f"  claims: {pvcs}")
        check("each Pod has its own PersistentVolumeClaim, named after the template and the Pod", pvcs == ["data-db-0", "data-db-1", "data-db-2"])
        k("exec", "db-1", "-n", ns, "--", "sh", "-c", "echo precious > /data/mine")
        # the hostPath folder of minikube's default StorageClass is named after the namespace and the claim, and a delete on the control plane does not clean the worker, so an old run can leave lines behind: count, do not assume
        lines_before = int(k("exec", "db-1", "-n", ns, "--", "sh", "-c", "wc -l < /data/starts"))
        uid_before = k("get", "pod", "db-1", "-n", ns, "-o", "jsonpath={.metadata.uid}")
        k("delete", "pod", "db-1", "-n", ns, "--wait=false")
        wait_for(lambda: k("get", "pod", "db-1", "-n", ns, "-o", "jsonpath={.metadata.uid}", check=False) not in ("", uid_before) and "db-1" in ready_pods(ns, "app=db"), 120, 2, "db-1 back")
        mine = k("exec", "db-1", "-n", ns, "--", "cat", "/data/mine")
        starts_n = k("exec", "db-1", "-n", ns, "--", "sh", "-c", "wc -l < /data/starts")
        print(f"  db-1 deleted and recreated: /data/mine={mine!r}, /data/starts went from {lines_before} to {starts_n} lines")
        check("the new db-1 is a different Pod (new uid) with the same name", k("get", "pod", "db-1", "-n", ns, "-o", "jsonpath={.metadata.uid}") != uid_before)
        check("it found the data of the old db-1", mine == "precious" and int(starts_n) == lines_before + 1)
        ident = k("exec", "db-0", "-n", ns, "--", "cat", "/data/id")
        check("db-0 still has its own id file (db-0), not another Pod's", ident == "db-0")
        result["stateful"] = {"pods": names, "claims": pvcs}

    if WRITE:
        write_json(LABS / "workloads.json", result)


main_guard(main)
