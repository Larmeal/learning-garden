"""Lesson 9: Docker Compose. One file that describes several containers, their network, their volume and the order they start in.

Asserts what `docker compose up` creates (names, a default network, a volume), that a service name is a DNS name, that `depends_on` with a plain list only orders the start
while `condition: service_healthy` waits for the health check (and the loader fails without it), that `down` keeps the named volume and `down -v` removes it, that variables come from
an `.env` file and the shell, that `--scale` gives one service name several containers, that a service with a profile stays down until asked for, and that `docker compose run` does
a one-off job. `--write` saves the names and the order of events as site/src/components/labs/docker/compose.json for the lab.
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dlab import ALPINE, LABEL, LABS, check, docker, fresh_dir, main_guard, run, show, table, write_json  # noqa: E402

WRITE = "--write" in sys.argv
PROJECT = "dlab-pipe"

LOAD_SQL = """create table if not exists orders (id int primary key, item text);
insert into orders values (1, 'book'), (2, 'pen') on conflict do nothing;
select count(*) as rows_in_orders from orders;
"""

COMPOSE = f"""name: {PROJECT}
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_PASSWORD: lesson
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U postgres"]
      interval: 2s
      timeout: 3s
      retries: 40
    labels:
      dlab: "1"
  loader:
    image: postgres:17-alpine
    depends_on:
      db:
        condition: service_healthy
    environment:
      PGPASSWORD: lesson
    volumes:
      - ./load.sql:/load.sql:ro
    command: ["psql", "-h", "db", "-U", "postgres", "-f", "/load.sql"]
    labels:
      dlab: "1"
volumes:
  pgdata:
    labels:
      dlab: "1"
networks:
  default:
    labels:
      dlab: "1"
"""


def compose(ctx: Path, *args: str, check_ok: bool = True, env: dict | None = None):
    import os
    import subprocess

    done = subprocess.run(["docker", "compose", "-f", str(ctx / "compose.yaml"), *args], capture_output=True, text=True, encoding="utf-8", errors="replace", cwd=ctx, env={**os.environ, **(env or {})}, timeout=600)
    if check_ok and done.returncode != 0:
        sys.exit(f"FAILED: docker compose {' '.join(args)}\n{done.stdout}\n{done.stderr}")
    return done


def state_of(name: str) -> dict:
    return json.loads(docker("inspect", "-f", "{{json .State}}", name))


def wait_exit(name: str, seconds: int = 90) -> dict:
    for _ in range(seconds):
        s = state_of(name)
        if s["Status"] == "exited":
            return s
        time.sleep(1)
    sys.exit(f"{name} did not exit")


def main() -> None:
    ctx = fresh_dir("compose")
    (ctx / "compose.yaml").write_text(COMPOSE, encoding="utf-8")
    (ctx / "load.sql").write_text(LOAD_SQL, encoding="utf-8")
    compose(ctx, "down", "-v", check_ok=False)

    # ---- 1. what `up` creates ----
    compose(ctx, "up", "-d")
    wait_exit(f"{PROJECT}-loader-1")
    names = docker("ps", "-a", "--filter", f"label=com.docker.compose.project={PROJECT}", "--format", "{{.Names}}").split()
    nets = docker("network", "ls", "--filter", f"label=com.docker.compose.project={PROJECT}", "--format", "{{.Name}}").split()
    vols = docker("volume", "ls", "--filter", f"label=com.docker.compose.project={PROJECT}", "--format", "{{.Name}}").split()
    show("what docker compose up made", f"containers: {sorted(names)}\nnetworks:   {nets}\nvolumes:    {vols}")
    check("containers are named <project>-<service>-<number>", sorted(names) == [f"{PROJECT}-db-1", f"{PROJECT}-loader-1"], str(names))
    check("Compose made one network for the project, named <project>_default", nets == [f"{PROJECT}_default"], str(nets))
    check("and one volume named <project>_<volume>", vols == [f"{PROJECT}_pgdata"], str(vols))
    log = docker("logs", f"{PROJECT}-loader-1")
    check("the loader reached the database by the service name db, and loaded 2 rows", "rows_in_orders" in log and " 2" in log.replace("\n", " "), log)
    check("the loader finished with exit code 0 and the database kept running", state_of(f"{PROJECT}-loader-1")["ExitCode"] == 0 and state_of(f"{PROJECT}-db-1")["Status"] == "running")
    health = docker("inspect", "-f", "{{.State.Health.Status}}", f"{PROJECT}-db-1")
    check("the health check of db reports healthy", health == "healthy", health)

    # ---- 2. down keeps the volume, down -v removes it ----
    compose(ctx, "down")
    check("after docker compose down the containers and the network are gone", not docker("ps", "-a", "--filter", f"label=com.docker.compose.project={PROJECT}", "-q") and not docker("network", "ls", "--filter", f"label=com.docker.compose.project={PROJECT}", "-q"))
    check("but the named volume is still there", f"{PROJECT}_pgdata" in docker("volume", "ls", "--format", "{{.Name}}").split())
    compose(ctx, "up", "-d")
    wait_exit(f"{PROJECT}-loader-1")
    count = docker("exec", f"{PROJECT}-db-1", "psql", "-U", "postgres", "-tAc", "select count(*) from orders")
    check("a new up finds the table from before in the kept volume (still 2 rows: the loader inserts with on conflict do nothing)", count == "2", count)
    compose(ctx, "down", "-v")
    check("down -v removes the volume too", f"{PROJECT}_pgdata" not in docker("volume", "ls", "--format", "{{.Name}}").split())

    # ---- 3. depends_on: a plain list orders the start, a health condition waits ----
    bad = fresh_dir("compose-nowait")
    (bad / "load.sql").write_text(LOAD_SQL, encoding="utf-8")
    (bad / "compose.yaml").write_text(COMPOSE.replace("name: " + PROJECT, "name: dlab-nowait").replace("    depends_on:\n      db:\n        condition: service_healthy\n", "    depends_on:\n      - db\n"), encoding="utf-8")
    compose(bad, "up", "-d")
    s = wait_exit("dlab-nowait-loader-1")
    err = docker("logs", "dlab-nowait-loader-1", check=False)
    log_err = run("logs", "dlab-nowait-loader-1", check=False)
    show("plain depends_on: [db]: the loader's log", (log_err.stdout + log_err.stderr).strip()[:300])
    check("with a plain depends_on the loader starts as soon as db has started, before it can answer, and fails", s["ExitCode"] != 0, str(s["ExitCode"]))
    del err
    compose(bad, "down", "-v", check_ok=False)

    # ---- 4. variables: .env file, shell, defaults ----
    venv = fresh_dir("compose-env")
    (venv / "compose.yaml").write_text(f"name: dlab-env\nservices:\n  show:\n    image: {ALPINE}\n    command: [\"sh\", \"-c\", \"echo greeting=$$GREETING\"]\n    environment:\n      GREETING: ${{GREETING:-fallback}}\n    labels:\n      dlab: \"1\"\n", encoding="utf-8")
    cfg_default = compose(venv, "config").stdout
    (venv / ".env").write_text("GREETING=from-dotenv\n", encoding="utf-8")
    cfg_env = compose(venv, "config").stdout
    cfg_shell = compose(venv, "config", env={"GREETING": "from-shell"}).stdout
    check("with nothing set, ${GREETING:-fallback} becomes fallback", "GREETING: fallback" in cfg_default)
    check("a .env file next to the compose file supplies the value", "GREETING: from-dotenv" in cfg_env)
    check("a variable in the shell beats the .env file", "GREETING: from-shell" in cfg_shell)
    out = compose(venv, "run", "--rm", "show", env={"GREETING": "from-shell"}).stdout.strip()
    check("docker compose run does a one-off job with that value", out == "greeting=from-shell", out)

    # ---- 5. scale, and profiles ----
    sc = fresh_dir("compose-scale")
    (sc / "compose.yaml").write_text(f"name: dlab-scale\nservices:\n  worker:\n    image: {ALPINE}\n    command: [\"sleep\", \"300\"]\n    labels:\n      dlab: \"1\"\n  probe:\n    image: {ALPINE}\n    command: [\"sleep\", \"300\"]\n    labels:\n      dlab: \"1\"\n  debug:\n    image: {ALPINE}\n    command: [\"sleep\", \"300\"]\n    profiles: [\"debug\"]\n    labels:\n      dlab: \"1\"\nnetworks:\n  default:\n    labels:\n      dlab: \"1\"\n", encoding="utf-8")
    compose(sc, "up", "-d", "--scale", "worker=3")
    ps = docker("ps", "--filter", "label=com.docker.compose.project=dlab-scale", "--format", "{{.Names}}").split()
    lookup = docker("exec", "dlab-scale-probe-1", "nslookup", "worker")
    addrs = {line.split()[-1] for line in lookup.splitlines() if line.startswith("Address") and "127.0.0.11" not in line}
    show("docker compose up --scale worker=3", f"running: {sorted(ps)}\nnslookup worker gives {len(addrs)} addresses")
    check("--scale makes three containers of one service", sorted(ps) == ["dlab-scale-probe-1", "dlab-scale-worker-1", "dlab-scale-worker-2", "dlab-scale-worker-3"], str(ps))
    check("and the service name resolves to all three addresses", len(addrs) == 3, str(addrs))
    check("a service with a profile did not start", "dlab-scale-debug-1" not in ps)
    compose(sc, "--profile", "debug", "up", "-d")
    check("--profile debug starts it", "dlab-scale-debug-1" in docker("ps", "--format", "{{.Names}}").split())
    compose(sc, "down", "-v", "--remove-orphans")

    if WRITE:
        write_json(LABS / "compose.json", {"names": sorted(names), "network": nets[0], "volume": vols[0], "scaleNames": sorted(ps), "addresses": len(addrs)})


if __name__ == "__main__":
    main_guard(main)
