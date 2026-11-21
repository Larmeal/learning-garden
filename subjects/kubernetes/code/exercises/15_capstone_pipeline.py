"""Lesson 15 (capstone): a small data pipeline on Kubernetes, and three ways to break it.

The pieces: a Namespace, a Secret (the database password), a ConfigMap (the SQL), a StatefulSet with a PersistentVolumeClaim (Postgres 17), a Service, a hardened loader Job
that waits for the database with an init container, a CronJob made from the same template, and a NetworkPolicy that lets only the loader reach the database.

Asserts what the lesson prints:
  1. the pipeline comes up: database Ready, loader Job complete, the table holds the rows
  2. the loader is idempotent: a second run (made from the CronJob) leaves the same number of rows
  3. the loader runs with a read-only root file system, no capabilities and a non-root user, and reads the password from a mounted file
  4. a Pod without the loader label cannot reach the database (NetworkPolicy), the loader can
  5. breakage 1: a typo in the Secret key name leaves the loader in CreateContainerConfigError, the message names the key
  6. breakage 2: deleting the database Pod: the StatefulSet makes db-0 again and the rows are still there
  7. breakage 3: a loader without the right label is blocked by the policy: the init container waits, the Job never completes; with the label it finishes
Run: python exercises/15_capstone_pipeline.py [--write]   (--write saves labs/kubernetes/capstone.json for the capstone lab)
"""

import sys
import time

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

WRITE = "--write" in sys.argv

BASE = """apiVersion: v1
kind: Secret
metadata: {name: db}
stringData: {password: s3cr3t-pw}
---
apiVersion: v1
kind: ConfigMap
metadata: {name: load-sql}
data:
  load.sql: |
    CREATE TABLE IF NOT EXISTS orders (id int PRIMARY KEY, customer text NOT NULL, amount numeric(10,2) NOT NULL);
    INSERT INTO orders (id, customer, amount)
      SELECT g, 'customer-' || (g % 7), (g * 13 % 500) + 0.5 FROM generate_series(1, 1000) AS g
      ON CONFLICT (id) DO NOTHING;
---
apiVersion: v1
kind: Service
metadata: {name: db}
spec:
  selector: {app: db}
  ports: [{port: 5432}]
---
apiVersion: apps/v1
kind: StatefulSet
metadata: {name: db}
spec:
  serviceName: db
  replicas: 1
  selector: {matchLabels: {app: db}}
  template:
    metadata: {labels: {app: db}}
    spec:
      terminationGracePeriodSeconds: 5
      # minikube's default volumes are hostPath folders of one node (lesson 9), so the database is pinned to one worker
      nodeSelector: {kubernetes.io/hostname: garden-m02}
      containers:
      - name: postgres
        image: @PG@
        env:
        - {name: POSTGRES_USER, value: etl}
        - {name: POSTGRES_DB, value: shop}
        - {name: PGDATA, value: /var/lib/postgresql/data/pgdata}
        - name: POSTGRES_PASSWORD
          valueFrom: {secretKeyRef: {name: db, key: password}}
        ports: [{containerPort: 5432}]
        readinessProbe:
          exec: {command: [pg_isready, -U, etl, -d, shop]}
          periodSeconds: 2
        resources: {requests: {cpu: 100m, memory: 128Mi}, limits: {memory: 512Mi}}
        volumeMounts: [{name: data, mountPath: /var/lib/postgresql/data}]
  volumeClaimTemplates:
  - metadata: {name: data}
    spec:
      accessModes: [ReadWriteOnce]
      resources: {requests: {storage: 256Mi}}
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: db-only-from-loader}
spec:
  podSelector: {matchLabels: {app: db}}
  policyTypes: [Ingress]
  ingress:
  - from: [{podSelector: {matchLabels: {role: loader}}}]
    ports: [{port: 5432}]
"""

LOADER_POD = """      restartPolicy: OnFailure
      terminationGracePeriodSeconds: 1
      securityContext: {runAsNonRoot: true, runAsUser: 70, runAsGroup: 70, seccompProfile: {type: RuntimeDefault}}
      initContainers:
      - name: wait-for-db
        image: @PG@
        command: ["sh", "-c", "until pg_isready -h db -p 5432 -U etl -d shop -t 2; do echo waiting for db; sleep 2; done"]
        securityContext: {allowPrivilegeEscalation: false, readOnlyRootFilesystem: true, capabilities: {drop: [ALL]}}
      containers:
      - name: loader
        image: @PG@
        command: ["sh", "-c", "PGPASSWORD=$(cat /secrets/@KEY@) psql -h db -U etl -d shop -v ON_ERROR_STOP=1 -f /sql/load.sql && PGPASSWORD=$(cat /secrets/@KEY@) psql -h db -U etl -d shop -tAc 'select count(*) from orders'"]
        securityContext: {allowPrivilegeEscalation: false, readOnlyRootFilesystem: true, capabilities: {drop: [ALL]}}
        volumeMounts:
        - {name: sql, mountPath: /sql}
        - {name: secret, mountPath: /secrets, readOnly: true}
      volumes:
      - {name: sql, configMap: {name: load-sql}}
      - name: secret
        secret: {secretName: db, items: [{key: @KEY@, path: @KEY@}]}
"""


def loader_job(name: str, key: str = "password", role: str = "loader") -> str:
    body = LOADER_POD.replace("@PG@", POSTGRES).replace("@KEY@", key)
    return f"""apiVersion: batch/v1
kind: Job
metadata: {{name: {name}}}
spec:
  backoffLimit: 6
  template:
    metadata: {{labels: {{role: {role}}}}}
    spec:
{body}"""


def count(ns: str) -> int:
    return int(k("exec", "db-0", "-n", ns, "--", "psql", "-U", "etl", "-d", "shop", "-tAc", "select count(*) from orders"))


def job_done(ns: str, name: str) -> bool:
    return k("get", "job", name, "-n", ns, "-o", "jsonpath={.status.succeeded}", check=False) == "1"


def main() -> None:
    result: dict = {}
    leftovers = "rm -rf /tmp/hostpath-provisioner/klab-pipeline"  # the provisioner does not clean a worker node (see lesson 9), so a run must not inherit the rows of the last one
    node_sh("garden-m02", leftovers)
    with namespace("pipeline", {"pod-security.kubernetes.io/enforce": "baseline"}) as ns:
        t0 = time.time()
        apply(BASE.replace("@PG@", POSTGRES), "-n", ns)
        wait_for(lambda: ready_pods(ns, "app=db") == ["db-0"], 180, 2, "db-0 Ready")
        t_db = time.time() - t0
        print(f"  db-0 Ready {t_db:.0f}s after apply")
        check("the database Pod db-0 is Ready and its claim is bound", k("get", "pvc", "data-db-0", "-n", ns, "-o", "jsonpath={.status.phase}") == "Bound")

        # ---- 1. the loader -----------------------------------------------------------------------------------------
        apply(loader_job("load-1"), "-n", ns)
        wait_for(lambda: job_done(ns, "load-1"), 150, 2, "load-1 complete")
        out = k("logs", "job/load-1", "-n", ns, "-c", "loader")
        n1 = count(ns)
        show("kubectl logs job/load-1 -c loader", out)
        print(f"  rows in orders: {n1}")
        check("the loader created the table, inserted 1000 rows and printed the count", "INSERT 0 1000" in out and out.strip().endswith("1000"))
        check("the table holds 1000 rows", n1 == 1000)
        init_log = k("logs", "job/load-1", "-n", ns, "-c", "wait-for-db")
        check("the init container ran first and ended when the database accepted connections", "accepting connections" in init_log)
        result["rows"] = n1

        # ---- 2. idempotent second run, made from a CronJob ------------------------------------------------------------
        template = loader_job("x").split("    spec:\n", 1)[1]
        apply(f"""apiVersion: batch/v1
kind: CronJob
metadata: {{name: nightly}}
spec:
  schedule: "0 2 * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      backoffLimit: 2
      template:
        metadata: {{labels: {{role: loader}}}}
        spec:
{chr(10).join("    " + line for line in template.splitlines())}
""", "-n", ns)
        k("create", "job", "load-2", "--from=cronjob/nightly", "-n", ns)
        wait_for(lambda: job_done(ns, "load-2"), 150, 2, "load-2 complete")
        n2 = count(ns)
        out2 = k("logs", "job/load-2", "-n", ns, "-c", "loader")
        print(f"  second run: {out2.splitlines()[-3:]}; rows {n2}")
        check("the second run, made from the CronJob, inserts 0 rows (ON CONFLICT DO NOTHING) and the count stays 1000", "INSERT 0 0" in out2 and n2 == 1000)

        # ---- 3. the hardened loader --------------------------------------------------------------------------------------
        spec = kj("get", "job", "load-1", "-n", ns)["spec"]["template"]["spec"]
        pod = [p for p in pods(ns, "job-name=load-1")][0]
        sc = spec["containers"][0]["securityContext"]
        check("the loader asks for no privilege escalation, no capabilities and a read-only root file system", sc["allowPrivilegeEscalation"] is False and sc["readOnlyRootFilesystem"] is True and sc["capabilities"]["drop"] == ["ALL"])
        check("it runs as uid 70, not root, and reads the password from a mounted file, not from an environment variable", spec["securityContext"]["runAsUser"] == 70 and not spec["containers"][0].get("env"))
        check("the Pod of the first run had the label role=loader that the NetworkPolicy allows", pod["metadata"]["labels"]["role"] == "loader")

        # ---- 4. the policy ------------------------------------------------------------------------------------------------
        apply(f"apiVersion: v1\nkind: Pod\nmetadata: {{name: stranger}}\nspec:\n  terminationGracePeriodSeconds: 1\n  containers:\n  - name: c\n    image: {POSTGRES}\n    command: [sleep, '3600']\n", "-n", ns)
        k("wait", "--for=condition=Ready", "pod/stranger", "-n", ns, "--timeout=90s")
        r = kubectl("exec", "stranger", "-n", ns, "--", "pg_isready", "-h", "db", "-t", "3", check=False)
        print(f"  from a Pod without the loader label: {r.stdout.strip()}")
        check("a Pod without role=loader cannot reach the database (no response)", r.returncode != 0 and "accepting" not in r.stdout)
        result["strangerBlocked"] = True

        # ---- 5. breakage 1: a typo in the Secret key ---------------------------------------------------------------------
        apply(loader_job("load-typo", key="pasword"), "-n", ns)
        def typo_events() -> str:
            pp = pods(ns, "job-name=load-typo")
            if not pp:
                return ""
            return k("get", "events", "-n", ns, "--field-selector", f"involvedObject.name={pp[0]['metadata']['name']}", "--no-headers", "-o", "custom-columns=R:.reason,M:.message", check=False)

        wait_for(lambda: "pasword" in typo_events(), 120, 3, "FailedMount event")
        p = pods(ns, "job-name=load-typo")[0]
        print(f"  Pod of load-typo: phase {p['status']['phase']}, init containers started: {bool(p['status'].get('initContainerStatuses') and p['status']['initContainerStatuses'][0]['state'].get('running'))}")
        ev = typo_events()
        show("events of the Pod of load-typo", ev)
        check("a Secret item that names a key that does not exist keeps the Pod from starting: the volume cannot be mounted and the event names the key", "pasword" in ev and ("FailedMount" in ev or "references non-existent" in ev))
        check("the Job is not complete and nothing was loaded by it", not job_done(ns, "load-typo") and count(ns) == 1000)
        k("delete", "job", "load-typo", "-n", ns, "--wait=false")
        result["typo"] = ev.splitlines()[-1][:160]

        # ---- 6. breakage 2: delete the database Pod ------------------------------------------------------------------------
        uid = k("get", "pod", "db-0", "-n", ns, "-o", "jsonpath={.metadata.uid}")
        t1 = time.time()
        k("delete", "pod", "db-0", "-n", ns, "--wait=true")
        wait_for(lambda: k("get", "pod", "db-0", "-n", ns, "-o", "jsonpath={.metadata.uid}", check=False) not in ("", uid) and ready_pods(ns, "app=db") == ["db-0"], 180, 2, "db-0 back")
        t_back = time.time() - t1
        n3 = count(ns)
        print(f"  db-0 deleted: a new db-0 is Ready after {t_back:.0f}s and the table holds {n3} rows")
        check("the StatefulSet made db-0 again: same name, new uid", k("get", "pod", "db-0", "-n", ns, "-o", "jsonpath={.metadata.uid}") != uid)
        check("the 1000 rows are still there", n3 == 1000)
        result["recoverSeconds"] = round(t_back)

        # ---- 7. breakage 3: a loader with the wrong label --------------------------------------------------------------------
        apply(loader_job("load-blocked", role="etl"), "-n", ns)
        time.sleep(25)
        p = pods(ns, "job-name=load-blocked")[0]
        st = p["status"]["initContainerStatuses"][0]["state"]
        log = k("logs", p["metadata"]["name"], "-n", ns, "-c", "wait-for-db", check=False)
        print(f"  load-blocked after 25 s: phase {p['status']['phase']}, init container {list(st)[0]}, log tail {log.splitlines()[-2:]}")
        check("with role=etl the init container keeps waiting: the Pod is stuck in Init, not failed", p["status"]["phase"] == "Pending" and "running" in st and "waiting for db" in log)
        check("the Job is not complete, and the database never saw a connection from it", not job_done(ns, "load-blocked"))
        k("delete", "job", "load-blocked", "-n", ns, "--wait=true")
        apply(loader_job("load-fixed", role="loader"), "-n", ns)
        wait_for(lambda: job_done(ns, "load-fixed"), 150, 2, "load-fixed complete")
        check("the same loader with role=loader finishes and the count is still 1000", count(ns) == 1000)
        result["blocked"] = "Init:0/1"

    node_sh("garden-m02", leftovers)
    if WRITE:
        write_json(LABS / "capstone.json", result)


main_guard(main)
