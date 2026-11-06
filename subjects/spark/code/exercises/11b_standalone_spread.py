"""Chapter 11, standalone cluster manager: how the Master hands out cores (spark.deploy.spreadOutApps).

Runs inside WSL: it starts a real standalone cluster on 127.0.0.1 (one Master, three Workers with 4 cores each), runs an
application that asks for 6 cores, and reads how many cores each Worker gave away from the Master's JSON page. It does
that for spreadOutApps = true (the default) and false, with and without spark.executor.cores. The numbers feed the
standalone page of chapter 1. Started on Windows it re-launches itself in WSL (see run_wsl.sh). From the code folder:

    uv run python exercises/11b_standalone_spread.py
"""

import json
import os
import shutil
import signal
import subprocess
import tempfile
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))


def relaunch_in_wsl():
    code_dir = os.path.normpath(os.path.join(HERE, ".."))
    drive, rest = os.path.splitdrive(code_dir)
    wsl_dir = "/mnt/" + drive[0].lower() + rest.replace("\\", "/")
    cmd = f"cd '{wsl_dir}' && ./run_wsl.sh exercises/11b_standalone_spread.py"
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

SPARK_HOME = os.path.dirname(pyspark.__file__)
MASTER = "spark://127.0.0.1:7077"
WORKERS = 3
CORES_PER_WORKER = 4
CORES_MAX = 6


def master_json():
    return json.load(urllib.request.urlopen("http://127.0.0.1:8080/json/", timeout=10))


class Cluster:
    """One Master and three Workers started with spark-class, the same entry the sbin scripts use."""

    def __init__(self, workdir, spread):
        base = dict(os.environ, SPARK_HOME=SPARK_HOME, SPARK_LOCAL_IP="127.0.0.1")
        master_env = dict(base, SPARK_MASTER_OPTS=f"-Dspark.deploy.spreadOutApps={'true' if spread else 'false'}")
        spark_class = os.path.join(SPARK_HOME, "bin", "spark-class")
        self.procs = []
        self._start(spark_class, ["org.apache.spark.deploy.master.Master", "--host", "127.0.0.1", "--port", "7077", "--webui-port", "8080"],
                    master_env, os.path.join(workdir, "master.log"))
        self.wait(lambda: master_json()["status"] == "ALIVE")
        for i in range(WORKERS):
            args = ["org.apache.spark.deploy.worker.Worker", "--webui-port", str(8081 + i), "--cores", str(CORES_PER_WORKER),
                    "--memory", "2g", "--work-dir", os.path.join(workdir, f"w{i}"), MASTER]
            self._start(spark_class, args, base, os.path.join(workdir, f"worker{i}.log"))
        self.wait(lambda: sum(w["state"] == "ALIVE" for w in master_json()["workers"]) == WORKERS)

    def _start(self, spark_class, args, env, log):
        self.procs.append(subprocess.Popen([spark_class, *args], stdout=open(log, "w"), stderr=subprocess.STDOUT, env=env, start_new_session=True))

    @staticmethod
    def wait(cond, seconds=60):
        for _ in range(seconds):
            try:
                if cond():
                    return
            except Exception:  # noqa: BLE001
                pass
            time.sleep(1)
        raise RuntimeError("cluster did not reach the expected state")

    def stop(self):
        for p in self.procs:
            try:
                os.killpg(os.getpgid(p.pid), signal.SIGTERM)
            except ProcessLookupError:
                pass
        for p in self.procs:
            p.wait(timeout=30)


def run_case(executor_cores):
    """Start an application that asks for CORES_MAX cores, run one job, return (cores used per worker, executors)."""
    b = (
        SparkSession.builder.master(MASTER).appName("spread")
        .config("spark.driver.host", "127.0.0.1")
        .config("spark.executor.memory", "512m")
        .config("spark.cores.max", str(CORES_MAX))
        .config("spark.ui.enabled", "false")
    )
    if executor_cores:
        b = b.config("spark.executor.cores", str(executor_cores))
    spark = b.getOrCreate()
    spark.sparkContext.setLogLevel("ERROR")
    spark.range(1000).count()  # make sure the executors really started
    Cluster.wait(lambda: sum(w["coresused"] for w in master_json()["workers"]) == CORES_MAX)
    state = master_json()
    used = sorted((w["coresused"] for w in state["workers"]), reverse=True)
    n_exec = spark.sparkContext._jsc.sc().getExecutorMemoryStatus().size() - 1  # minus the driver
    spark.stop()
    Cluster.wait(lambda: sum(w["coresused"] for w in master_json()["workers"]) == 0)
    return used, n_exec


def main():
    results = {}
    for spread in (True, False):
        workdir = tempfile.mkdtemp(prefix="spread-")
        cluster = Cluster(workdir, spread)
        try:
            for ec in (None, 1, 2):
                used, n_exec = run_case(ec)
                results[(spread, ec)] = (used, n_exec)
                print(f"spreadOutApps={spread!s:5}  spark.executor.cores={ec!s:4}  cores used per worker={used}  executors={n_exec}")
        finally:
            cluster.stop()
            shutil.rmtree(workdir, ignore_errors=True)

    # What the lesson states.
    assert results[(True, None)] == ([2, 2, 2], 3), results[(True, None)]
    assert results[(False, None)] == ([4, 2, 0], 2), results[(False, None)]
    assert results[(True, 1)] == ([2, 2, 2], 6), results[(True, 1)]
    assert results[(False, 1)] == ([4, 2, 0], 6), results[(False, 1)]
    assert results[(True, 2)] == ([2, 2, 2], 3), results[(True, 2)]
    assert results[(False, 2)] == ([4, 2, 0], 3), results[(False, 2)]
    print("ok")


if __name__ == "__main__":
    main()
