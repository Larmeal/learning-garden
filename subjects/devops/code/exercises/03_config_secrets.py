"""Lesson 3: environments, configuration and secrets.

One program, three environments. Asserts that the same bytes of the program behave differently only because of the
environment variables around them, that a missing variable stops the program before it serves anything, that the three
environment files define the same keys (parity), and what Docker shows of a secret: a value passed with `-e` is visible to
`docker inspect`, a value written with `ENV` in a Dockerfile is visible to `docker history`, a value mounted as a file is in
neither (the container reads it from /run/secrets).
"""

import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from devlab import PY, check, docker, docker_ok, fresh, run, save_json, show, write  # noqa: E402

NL = chr(10)


def L(*rows: str) -> str:
    return NL.join(rows) + NL


APP = L(
    "import os, sys",
    "REQUIRED = ['APP_ENV', 'DATABASE_URL']",
    "missing = [k for k in REQUIRED if k not in os.environ]",
    "if missing:",
    "    print('missing configuration: ' + ', '.join(missing))",
    "    sys.exit(2)",
    "level = os.environ.get('LOG_LEVEL', 'info')",
    "print(f\"env={os.environ['APP_ENV']} db={os.environ['DATABASE_URL']} log={level}\")",
)

work = fresh("03_config")
write(work, "app.py", APP)
ENVS = {
    "dev": {"APP_ENV": "dev", "DATABASE_URL": "sqlite:///dev.db", "LOG_LEVEL": "debug"},
    "staging": {"APP_ENV": "staging", "DATABASE_URL": "postgres://staging-db/shop", "LOG_LEVEL": "info"},
    "prod": {"APP_ENV": "prod", "DATABASE_URL": "postgres://prod-db/shop", "LOG_LEVEL": "warning"},
}

# ---- 1. one artifact, three environments ----
digest = hashlib.sha256((work / "app.py").read_bytes()).hexdigest()[:12]
print(f"  sha256 of app.py: {digest} (the same file runs in all three)")
outputs = {}
for name, env in ENVS.items():
    code, out = run([PY, "app.py"], cwd=work, env={**env})
    outputs[name] = out
    show(f"{' '.join(f'{k}={v}' for k, v in env.items())} python app.py", out)
    check(f"{name} starts", code == 0)
check("the three outputs differ only in the environment values", len(set(outputs.values())) == 3)
check("the file that ran is the same one (one artifact, three configurations)", hashlib.sha256((work / "app.py").read_bytes()).hexdigest()[:12] == digest)

# ---- 2. fail fast: a missing variable stops the program before it does anything ----
code, out = run([PY, "app.py"], cwd=work, env={"APP_ENV": "prod"})
show("APP_ENV=prod python app.py   (no DATABASE_URL)", out)
check("exit code 2 and a message that names the missing variable", code == 2 and "DATABASE_URL" in out)


# ---- 3. parity: the environments define the same keys ----
def parity(envs: dict[str, dict[str, str]]) -> dict[str, list[str]]:
    all_keys = set().union(*[set(e) for e in envs.values()])
    return {name: sorted(all_keys - set(e)) for name, e in envs.items() if all_keys - set(e)}


check("dev, staging and prod define the same keys", parity(ENVS) == {})
drift = {**ENVS, "staging": {k: v for k, v in ENVS["staging"].items() if k != "LOG_LEVEL"}}
check("a staging that lost LOG_LEVEL is found by the parity check", parity(drift) == {"staging": ["LOG_LEVEL"]}, str(parity(drift)))

# ---- 4. where does a secret leak? (Docker) ----
if not docker_ok():
    print("  Docker is not running: part 4 skipped")
    print("ok")
    sys.exit(0)

SECRET = "s3cr3t-token-1234"
secret_file = write(work, "db_password.txt", SECRET)
image = "devops03-baked:1"
container_names = ["devops03-baked", "devops03-env", "devops03-file"]
matrix = {}  # where the secret lives -> who can read it: image history, docker inspect of the container, the program inside
try:
    write(work, "Dockerfile", L("FROM alpine:3.22", f"ENV DB_PASSWORD={SECRET}", 'CMD ["sh", "-c", "echo started"]'))
    docker("build", "-q", "-t", image, str(work))
    history = docker("history", "--no-trunc", image)
    check("a secret written with ENV is readable in docker history of the image", SECRET in history)
    docker("run", "-d", "--name", container_names[0], image, "sleep", "30")
    inspect0 = docker("inspect", container_names[0])
    inside0 = docker("exec", container_names[0], "printenv", "DB_PASSWORD")
    check("a container made from that image shows it in docker inspect", SECRET in inspect0)
    check("and the program inside sees it as an environment variable", inside0.strip() == SECRET)
    matrix["dockerfile_env"] = {"history": True, "inspect": True, "inside": True}

    docker("run", "-d", "--name", container_names[1], "-e", f"DB_PASSWORD={SECRET}", "alpine:3.22", "sleep", "30")
    inspect = docker("inspect", container_names[1])
    check("a secret passed with -e is readable in docker inspect of the container", SECRET in inspect)
    check("it is not in the history of the image the container started from", SECRET not in docker("history", "--no-trunc", "alpine:3.22"))
    check("and the program inside sees it", docker("exec", container_names[1], "printenv", "DB_PASSWORD").strip() == SECRET)
    matrix["run_env"] = {"history": False, "inspect": True, "inside": True}

    docker("run", "-d", "--name", container_names[2], "-v", f"{secret_file.as_posix()}:/run/secrets/db_password:ro", "alpine:3.22", "sleep", "30")
    inspect2 = docker("inspect", container_names[2])
    check("a secret mounted as a file is not in docker inspect", SECRET not in inspect2)
    inside = docker("exec", container_names[2], "cat", "/run/secrets/db_password")
    check("but the program inside can still read it from the file", inside.strip() == SECRET)
    mounts = json.loads(inspect2)[0]["Mounts"]
    check("inspect shows only the path of the mount", mounts[0]["Destination"] == "/run/secrets/db_password" and mounts[0]["Mode"] == "ro")
    matrix["file"] = {"history": False, "inspect": False, "inside": True}
    if "--write" in sys.argv:
        save_json("secrets.json", matrix)
finally:
    for name in container_names:
        run(["docker", "rm", "-f", name])
    run(["docker", "rmi", "-f", image])
print("ok")
