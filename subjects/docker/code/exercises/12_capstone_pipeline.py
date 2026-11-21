"""Lesson 12 (capstone): a small data pipeline in Compose, locked down, and what to look at when it breaks.

A CSV is read by an `etl` container (built from its own Dockerfile, running as a user that is not root, with a read-only root file system, no capabilities, memory and process limits) and
loaded into a Postgres container whose password arrives as a Compose secret file. They share a network that has no way out. Asserts the rows loaded and rejected, every safeguard from
`docker inspect` and from inside (the effective capabilities, the read-only file system, the secret not being in the environment, the network not reaching the internet), and then breaks the
pipeline three ways (a wrong host name, a wrong password, too little memory) and checks that the commands `compose ps`, `compose logs`, `docker inspect` and `docker events` each point at the
cause. `--write` saves the evidence as site/src/components/labs/docker/capstone.json for the lab.
"""

import json
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dlab import ALPINE, LABEL, LABS, check, docker, fresh_dir, inspect, main_guard, run, show, table, write_json  # noqa: E402

WRITE = "--write" in sys.argv
PROJECT = "dlab-capstone"

ETL_PY = '''import os
import sys

import psycopg

host = os.environ.get("DB_HOST", "db")
password = open("/run/secrets/db_password", encoding="utf-8").read().strip() if os.environ.get("DB_PASSWORD_FROM") != "wrong" else "not-the-password"
if os.environ.get("HOG_MB"):
    hog = bytearray(b"x") * (int(os.environ["HOG_MB"]) * 1024 * 1024)
good, bad = [], []
for line in open("/data/orders.csv", encoding="utf-8").read().splitlines()[1:]:
    order_id, item, qty = line.split(",")
    (good if int(qty) > 0 and item else bad).append((int(order_id), item, int(qty)))
with psycopg.connect(host=host, user="postgres", password=password, dbname="postgres", connect_timeout=5) as conn:
    conn.execute("create table if not exists orders (id int primary key, item text not null, qty int not null check (qty > 0))")
    for row in good:
        conn.execute("insert into orders values (%s, %s, %s) on conflict do nothing", row)
    total = conn.execute("select count(*) from orders").fetchone()[0]
print(f"loaded {len(good)} rejected {len(bad)} rows in table: {total}", flush=True)
sys.exit(0)
'''

DOCKERFILE = """FROM python:3.13-slim
RUN pip install --no-cache-dir "psycopg[binary]" && useradd --system --uid 10001 etl
WORKDIR /app
COPY --chown=etl:etl etl.py .
USER etl
CMD ["python", "etl.py"]
"""

COMPOSE = f"""name: {PROJECT}
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets: [db_password]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U postgres"]
      interval: 2s
      retries: 40
    networks: [backend]
    labels: {{dlab: "1"}}
  etl:
    build:
      context: ./etl
      labels: {{dlab: "1"}}
    image: dlab-capstone-etl
    depends_on:
      db: {{condition: service_healthy}}
    secrets: [db_password]
    environment:
      DB_HOST: ${{DB_HOST:-db}}
      DB_PASSWORD_FROM: ${{DB_PASSWORD_FROM:-file}}
      HOG_MB: ${{HOG_MB:-}}
    volumes: ["./data:/data:ro"]
    read_only: true
    tmpfs: [/tmp]
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    mem_limit: ${{ETL_MEM:-128m}}
    memswap_limit: ${{ETL_MEM:-128m}}
    pids_limit: 64
    networks: [backend]
    labels: {{dlab: "1"}}
networks:
  backend:
    internal: true
    labels: {{dlab: "1"}}
secrets:
  db_password:
    file: ./db_password.txt
volumes:
  pgdata:
    labels: {{dlab: "1"}}
"""


def compose(ctx: Path, *args: str, env: dict | None = None, check_ok: bool = True):
    import os

    done = subprocess.run(["docker", "compose", "-f", str(ctx / "compose.yaml"), *args], capture_output=True, text=True, encoding="utf-8", errors="replace", cwd=ctx, env={**os.environ, **(env or {})}, timeout=900)
    if check_ok and done.returncode != 0:
        sys.exit(f"FAILED: docker compose {' '.join(args)}\n{done.stdout}\n{done.stderr}")
    return done


def wait_exit(name: str, seconds: int = 120) -> dict:
    for _ in range(seconds):
        s = json.loads(docker("inspect", "-f", "{{json .State}}", name))
        if s["Status"] == "exited":
            return s
        time.sleep(1)
    sys.exit(f"{name} did not exit")


def main() -> None:
    ctx = fresh_dir("capstone")
    (ctx / "etl").mkdir()
    (ctx / "data").mkdir()
    (ctx / "etl" / "etl.py").write_text(ETL_PY, encoding="utf-8")
    (ctx / "etl" / "Dockerfile").write_text(DOCKERFILE, encoding="utf-8")
    (ctx / "data" / "orders.csv").write_text("id,item,qty\n1,book,2\n2,pen,10\n3,ink,-1\n4,desk,1\n5,lamp,3\n", encoding="utf-8")
    secret = "capstone-password-0451"
    (ctx / "db_password.txt").write_text(secret, encoding="utf-8")
    (ctx / "compose.yaml").write_text(COMPOSE, encoding="utf-8")
    compose(ctx, "down", "-v", check_ok=False)
    etl = f"{PROJECT}-etl-1"
    dbc = f"{PROJECT}-db-1"

    # ---- 1. the pipeline runs ----
    compose(ctx, "up", "-d", "--build")
    s = wait_exit(etl)
    log = docker("logs", etl)
    show("docker compose logs etl", log)
    check("the etl container ran and exited with 0", s["ExitCode"] == 0, str(s["ExitCode"]))
    check("it loaded 4 valid rows and rejected the one with a negative quantity", "loaded 4 rejected 1" in log and "in table: 4" in log, log)
    rows = docker("exec", dbc, "psql", "-U", "postgres", "-tAc", "select id || ':' || item from orders order by id")
    check("the table in Postgres holds exactly the valid rows (no order 3)", rows.split() == ["1:book", "2:pen", "4:desk", "5:lamp"], rows)
    version = docker("run", "--rm", "--label", LABEL, "--entrypoint", "python", "dlab-capstone-etl", "-c", "import psycopg; print(psycopg.__version__)")

    # ---- 2. the safeguards, read from outside ----
    info = inspect(etl)
    host_cfg = info["HostConfig"]
    safeguards = {
        "user": info["Config"]["User"],
        "readonlyRootfs": host_cfg["ReadonlyRootfs"],
        "capDrop": host_cfg["CapDrop"],
        "securityOpt": host_cfg["SecurityOpt"],
        "memoryMb": host_cfg["Memory"] // (1024 * 1024),
        "pidsLimit": host_cfg["PidsLimit"],
        "tmpfs": sorted(host_cfg["Tmpfs"]),
        "dataMount": next(m for m in info["Mounts"] if m["Destination"] == "/data")["RW"],
    }
    show("what docker inspect says about the etl container", "\n".join(f"{k}: {v}" for k, v in safeguards.items()))
    check("it runs as the user etl (uid 10001), not root", safeguards["user"] in ("etl", "10001"), safeguards["user"])
    check("its root file system is read-only", safeguards["readonlyRootfs"] is True)
    check("all capabilities are dropped, and no new privileges can be gained", safeguards["capDrop"] == ["ALL"] and "no-new-privileges:true" in safeguards["securityOpt"], str(safeguards))
    check("memory is limited to 128 MB and processes to 64", safeguards["memoryMb"] == 128 and safeguards["pidsLimit"] == 64)
    check("the data folder is mounted read-only", safeguards["dataMount"] is False)

    # ---- 3. the safeguards, tried from inside ----
    def inside(script: str, only_out: bool = False) -> str:
        done = compose(ctx, "run", "--rm", "--no-deps", "--entrypoint", "sh", "etl", "-c", script, check_ok=False)
        return done.stdout.strip() if only_out else (done.stdout + done.stderr).strip()

    probe = inside("id -u; touch /x 2>&1; touch /tmp/ok && echo tmp-writable; touch /data/new 2>&1; grep CapEff /proc/self/status")
    show("from inside the etl container", probe)
    cap_line = next(line for line in probe.splitlines() if line.startswith("CapEff"))
    default_caps = docker("run", "--rm", "--label", LABEL, ALPINE, "sh", "-c", "grep CapEff /proc/self/status")
    check("inside, the user id is 10001", probe.splitlines()[0] == "10001", probe)
    check("writing to / fails because the file system is read-only", "Read-only file system" in probe)
    check("but /tmp works, because it is a tmpfs", "tmp-writable" in probe)
    check("and the read-only data mount refuses a write too", probe.count("Read-only file system") >= 2, probe)
    check("the effective capabilities are 0, against a default container that has some", cap_line.split()[-1] == "0000000000000000" and default_caps.split()[-1] != "0000000000000000", f"{cap_line} / {default_caps}")
    env_dump = docker("inspect", "-f", "{{json .Config.Env}}", etl) + docker("inspect", "-f", "{{json .Config.Env}}", dbc)
    check("the password is not in the environment of either container", secret not in env_dump)
    pw_in_file = inside("cat /run/secrets/db_password", only_out=True)
    check("it is a file under /run/secrets that the program reads", pw_in_file == secret)
    check("and it is not in the image history", secret not in docker("history", "--no-trunc", "--format", "{{.CreatedBy}}", "dlab-capstone-etl"))
    internet = inside("wget -q -T 3 -O /dev/null http://example.com 2>&1; echo exit=$?")
    check("the network is internal: the etl container cannot reach the internet", "exit=0" not in internet, internet)
    nets = json.loads(docker("network", "inspect", f"{PROJECT}_backend", "--format", "{{json .Internal}}"))
    check("docker network inspect says Internal is true", nets is True)

    # ---- 4. three ways to break it, and the command that finds each ----
    breaks = {}
    for label, env, expect in (
        ("wrong host name", {"DB_HOST": "dbx"}, "failed to resolve host"),
        ("wrong password", {"DB_PASSWORD_FROM": "wrong"}, "password authentication failed"),
        ("too little memory", {"HOG_MB": "200"}, ""),
    ):
        t0 = time.time()
        compose(ctx, "rm", "-f", "-s", "etl", check_ok=False)
        compose(ctx, "up", "-d", "--no-deps", "etl", env=env)
        s = wait_exit(etl)
        text = docker("logs", etl, check=False) + run("logs", etl, check=False).stderr
        ps = compose(ctx, "ps", "-a", "--format", "{{.Service}} {{.State}} {{.ExitCode}}").stdout.strip().splitlines()
        ps_etl = next(line for line in ps if line.startswith("etl"))
        events = docker("events", "--since", str(int(t0) - 1), "--until", str(int(time.time()) + 1), "--filter", f"container={etl}", "--format", "{{.Action}}").split()
        breaks[label] = {"exitCode": s["ExitCode"], "oom": s["OOMKilled"], "ps": ps_etl, "log": text.strip().splitlines()[-1][:200] if text.strip() else "(empty)", "events": sorted(set(events))}
        compose(ctx, "rm", "-f", "-s", "etl", check_ok=False)
    show("three breakages", table([[k, v["ps"], v["exitCode"], v["oom"], v["log"]] for k, v in breaks.items()], ["what we broke", "docker compose ps -a", "exit code", "OOMKilled", "last line of the log"]))
    check("a wrong host name: exit code 1, and the log says the host name could not be resolved", breaks["wrong host name"]["exitCode"] == 1 and "failed to resolve host" in breaks["wrong host name"]["log"], str(breaks["wrong host name"]))
    check("a wrong password: exit code 1, and the log says the password failed", breaks["wrong password"]["exitCode"] == 1 and "password authentication failed" in breaks["wrong password"]["log"], str(breaks["wrong password"]))
    check("too little memory: exit code 137 and OOMKilled true, and the log is empty or cut off (the program never got to print)", breaks["too little memory"]["exitCode"] == 137 and breaks["too little memory"]["oom"] is True, str(breaks["too little memory"]))
    check("docker events records the oom for the memory case", "oom" in breaks["too little memory"]["events"], str(breaks["too little memory"]["events"]))
    check("the same exit code 1 in the first two cases means the log is what tells them apart", breaks["wrong host name"]["exitCode"] == breaks["wrong password"]["exitCode"] and breaks["wrong host name"]["log"] != breaks["wrong password"]["log"])

    # ---- 5. fixed again ----
    compose(ctx, "up", "-d", "--no-deps", "etl")
    s = wait_exit(etl)
    check("with the settings put back the pipeline runs again, and the volume kept the data (the table already has 4 rows)", s["ExitCode"] == 0 and "in table: 4" in docker("logs", etl))

    if WRITE:
        write_json(LABS / "capstone.json", {"loaded": 4, "rejected": 1, "safeguards": safeguards, "capEff": cap_line.split()[-1], "defaultCapEff": default_caps.split()[-1], "breaks": breaks, "psycopg": version, "internal": nets, "secretInEnv": False})
    compose(ctx, "down", "-v", check_ok=False)


if __name__ == "__main__":
    main_guard(main)
