"""Chapter 11: deployment, the Spark UI and Spark Connect.

Runs inside WSL: it starts a real standalone cluster (one master, one worker with 2 cores) on 127.0.0.1, runs an
application on it, reads the Spark UI through its REST API and the event log it wrote, then runs a Spark Connect
client against a local server. Started on Windows it re-launches itself in WSL (see run_wsl.sh for the setup). From
the code folder:

    uv run python exercises/11_deployment_ui.py
"""

import glob
import json
import os
import signal
import subprocess
import sys
import tempfile
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))


def relaunch_in_wsl():
    code_dir = os.path.normpath(os.path.join(HERE, ".."))
    drive, rest = os.path.splitdrive(code_dir)
    wsl_dir = "/mnt/" + drive[0].lower() + rest.replace("\\", "/")
    cmd = f"cd '{wsl_dir}' && ./run_wsl.sh exercises/11_deployment_ui.py"
    out = subprocess.run(["wsl.exe", "-d", "Ubuntu", "--", "bash", "-lc", cmd], capture_output=True, text=True)
    print(out.stdout.replace("\x00", "")[-3000:])
    if out.returncode != 0:
        print(out.stderr.replace("\x00", "")[-2000:])
        raise SystemExit(out.returncode)
    raise SystemExit(0)


if os.name == "nt":
    relaunch_in_wsl()

import pyspark  # noqa: E402
from pyspark.sql import SparkSession  # noqa: E402
from pyspark.sql import functions as F  # noqa: E402

SPARK_HOME = os.path.dirname(pyspark.__file__)
MASTER = "spark://127.0.0.1:7077"


def http_json(url):
    return json.load(urllib.request.urlopen(url, timeout=10))


class Cluster:
    """A standalone master and one worker (2 cores), started with the same spark-class the sbin scripts use."""

    def __init__(self, logdir):
        env = dict(os.environ, SPARK_HOME=SPARK_HOME, SPARK_LOCAL_IP="127.0.0.1")
        self.procs = []
        spark_class = os.path.join(SPARK_HOME, "bin", "spark-class")
        for args, log in [
            (["org.apache.spark.deploy.master.Master", "--host", "127.0.0.1", "--port", "7077", "--webui-port", "8080"], "master.log"),
            (None, "worker.log"),
        ]:
            if args is None:
                self.wait_master()
                args = ["org.apache.spark.deploy.worker.Worker", "--webui-port", "8081", "--cores", "2", "--memory", "2g", MASTER]
            f = open(os.path.join(logdir, log), "w")
            self.procs.append(subprocess.Popen([spark_class, *args], stdout=f, stderr=subprocess.STDOUT, env=env, start_new_session=True))
        self.wait_worker()

    def wait_master(self):
        for _ in range(60):
            try:
                if http_json("http://127.0.0.1:8080/json/")["status"] == "ALIVE":
                    return
            except Exception:  # noqa: BLE001
                pass
            time.sleep(1)
        raise RuntimeError("master did not start")

    def wait_worker(self):
        for _ in range(60):
            d = http_json("http://127.0.0.1:8080/json/")
            if d["workers"] and d["workers"][0]["state"] == "ALIVE":
                return
            time.sleep(1)
        raise RuntimeError("worker did not register")

    def master(self):
        return http_json("http://127.0.0.1:8080/json/")

    def stop(self):
        for p in self.procs:
            try:
                os.killpg(os.getpgid(p.pid), signal.SIGTERM)
            except ProcessLookupError:
                pass
        for p in self.procs:
            p.wait(timeout=30)


def session(app, evlog=None, dynamic=True):
    b = (
        SparkSession.builder.master(MASTER).appName(app)
        .config("spark.driver.host", "127.0.0.1")
        .config("spark.executor.memory", "512m")
        .config("spark.executor.cores", "1")
        .config("spark.sql.adaptive.enabled", "false")
        .config("spark.sql.shuffle.partitions", "6")
    )
    if dynamic:
        b = (
            b.config("spark.dynamicAllocation.enabled", "true")
            .config("spark.dynamicAllocation.shuffleTracking.enabled", "true")
            .config("spark.dynamicAllocation.minExecutors", "0")
            .config("spark.dynamicAllocation.maxExecutors", "2")
            .config("spark.dynamicAllocation.executorIdleTimeout", "4s")
        )
    if evlog:
        b = (
            b.config("spark.eventLog.enabled", "true")
            .config("spark.eventLog.dir", "file://" + evlog)
            .config("spark.eventLog.compress", "false")  # the default compresses, which would need a zstd reader here
        )
    spark = b.getOrCreate()
    spark.sparkContext.setLogLevel("ERROR")
    return spark


def rest(spark):
    sc = spark.sparkContext
    port = sc.uiWebUrl.rsplit(":", 1)[1]
    base = f"http://127.0.0.1:{port}/api/v1/applications/{sc.applicationId}"
    return lambda path: http_json(base + path)


def executors(get):
    return sorted((e["id"], e["totalCores"]) for e in get("/executors"))  # active ones only (/allexecutors keeps dead ones)


def wait_for(cond, seconds=40):
    for _ in range(seconds):
        if cond():
            return True
        time.sleep(1)
    return False


def shuffle_app(cluster, evlog):
    spark = session("shuffle-app", evlog)
    get = rest(spark)
    assert spark.sparkContext.master == MASTER
    assert executors(get) == [("driver", 0)], executors(get)  # dynamic allocation: none until there is work

    spark.range(0, 2_000_000, 1, 8).groupBy((F.col("id") % 7).alias("k")).count().collect()
    assert wait_for(lambda: len(executors(get)) == 3)
    assert executors(get) == [("0", 1), ("1", 1), ("driver", 0)], executors(get)

    # What the UI pages are made of.
    jobs = get("/jobs")
    assert len(jobs) == 1 and jobs[0]["numTasks"] == 14 and jobs[0]["status"] == "SUCCEEDED", jobs
    stages = {s["stageId"]: s for s in get("/stages")}
    assert sorted(s["numTasks"] for s in stages.values()) == [6, 8], "8 map tasks, then 6 shuffle partitions"
    write = sum(s["shuffleWriteBytes"] for s in stages.values())
    read = sum(s["shuffleReadBytes"] for s in stages.values())
    assert write == read > 0, (write, read)
    last = max(stages)
    summary = get(f"/stages/{last}/0/taskSummary?quantiles=0.0,0.5,1.0")
    assert {"executorRunTime", "duration", "diskBytesSpilled", "memoryBytesSpilled", "shuffleReadMetrics"} <= set(summary)
    assert len(summary["executorRunTime"]) == 3
    sql = get("/sql")
    assert sql and sql[0]["status"] == "COMPLETED"
    env = dict(map(tuple, get("/environment")["sparkProperties"]))
    assert env["spark.master"] == MASTER and env["spark.executor.memory"] == "512m"

    # With shuffle tracking, executors that hold shuffle files are kept even when idle.
    time.sleep(8)
    assert len(executors(get)) == 3, "idle executors are kept while they hold shuffle data"
    app_id = spark.sparkContext.applicationId
    spark.stop()

    apps = cluster.master()["completedapps"]
    assert any(a["name"] == "shuffle-app" and a["state"] == "FINISHED" for a in apps), apps
    print("stage tasks:", sorted(s["numTasks"] for s in stages.values()), "shuffle bytes:", write)
    return app_id


def idle_release(cluster):
    spark = session("no-shuffle-app")
    get = rest(spark)
    spark.range(0, 1000, 1, 2).collect()  # a job with no shuffle
    assert wait_for(lambda: len(executors(get)) >= 2, 20)
    assert wait_for(lambda: executors(get) == [("driver", 0)], 30), "idle executors are released"
    spark.stop()


def event_log(evlog):
    dirs = glob.glob(os.path.join(evlog, "eventlog_v2_*"))
    assert len(dirs) == 1, os.listdir(evlog)
    files = sorted(os.listdir(dirs[0]))
    events_file = [f for f in files if f.startswith("events_")][0]
    assert any(f.startswith("appstatus_") for f in files)
    counts = {}
    with open(os.path.join(dirs[0], events_file)) as f:
        for line in f:
            name = json.loads(line)["Event"].rsplit(".", 1)[-1]
            counts[name] = counts.get(name, 0) + 1
    for need in ("SparkListenerApplicationStart", "SparkListenerJobStart", "SparkListenerStageCompleted", "SparkListenerExecutorAdded", "SparkListenerSQLExecutionStart"):
        assert counts.get(need, 0) >= 1, (need, counts)
    assert counts["SparkListenerTaskEnd"] == 14 and counts["SparkListenerApplicationEnd"] == 1, counts
    print("event log events:", {k: counts[k] for k in sorted(counts) if k.startswith("SparkListener")})


def submit_modes():
    noop = os.path.join(tempfile.mkdtemp(prefix="ch11_"), "noop.py")
    open(noop, "w").write("x = 1\n")
    out = subprocess.run(
        [os.path.join(SPARK_HOME, "bin", "spark-submit"), "--master", MASTER, "--deploy-mode", "cluster", noop],
        capture_output=True, text=True, env=dict(os.environ, SPARK_HOME=SPARK_HOME, SPARK_LOCAL_IP="127.0.0.1"), timeout=120,
    )
    assert "Cluster deploy mode is currently not supported for python applications on standalone clusters" in out.stderr + out.stdout


CONNECT_SNIPPET = r"""
import json, os, io, contextlib
os.environ.pop("SPARK_HOME", None)
from pyspark.sql import SparkSession
spark = SparkSession.builder.remote("local[2]").getOrCreate()
df = spark.range(10).filter("id % 2 = 0")
out = {"session": type(spark).__module__, "df": type(df).__module__, "plan": type(df._plan).__name__,
       "rows": [r.id for r in df.collect()]}
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    df.explain()
out["explain"] = buf.getvalue()
for name in ("sparkContext", "rdd"):
    try:
        getattr(spark if name == "sparkContext" else df, name)
        out[name] = "available"
    except Exception as e:
        out[name] = type(e).__name__
out["version"] = spark.version
spark.stop()
print("JSON" + json.dumps(out))
"""


def connect():
    res = subprocess.run([sys.executable, "-c", CONNECT_SNIPPET], capture_output=True, text=True, timeout=300)
    line = [ln for ln in res.stdout.splitlines() if ln.startswith("JSON")]
    assert line, res.stdout[-800:] + res.stderr[-800:]
    out = json.loads(line[0][4:])
    assert out["session"] == "pyspark.sql.connect.session" and out["df"] == "pyspark.sql.connect.dataframe"
    assert out["plan"] == "Filter", "the client only builds a logical plan, the server runs it"
    assert out["rows"] == [0, 2, 4, 6, 8] and out["version"] == "4.2.0"
    assert "Range (0, 10, step=1, splits=2)" in out["explain"]
    assert out["sparkContext"] == "PySparkAttributeError" and out["rdd"] == "PySparkNotImplementedError"
    print("connect:", {k: out[k] for k in ("session", "plan", "sparkContext", "rdd")})


def main():
    logdir = tempfile.mkdtemp(prefix="ch11_logs_")
    evlog = tempfile.mkdtemp(prefix="ch11_ev_")
    cluster = Cluster(logdir)
    try:
        d = cluster.master()
        assert d["status"] == "ALIVE" and len(d["workers"]) == 1 and d["workers"][0]["cores"] == 2
        shuffle_app(cluster, evlog)
        event_log(evlog)
        idle_release(cluster)
        submit_modes()
    finally:
        cluster.stop()
    connect()
    print("ok")


if __name__ == "__main__":
    main()
