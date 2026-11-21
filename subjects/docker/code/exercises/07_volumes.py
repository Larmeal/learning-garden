"""Lesson 7: where data can live so that it outlives a container. The writable layer, a named volume, a bind mount and tmpfs.

Asserts, for each place, whether a file written inside a container is still there after `docker restart` and after the container is removed and another one is started, that a bind mount
shares real files with the computer in both directions (and can be read-only), that a new volume is filled from the image but a bind mount hides it, that a volume can be shared by
two running containers, that an anonymous volume of a `VOLUME` line stays behind when the container is removed, and that a Postgres table survives the removal of its container when
the data directory is a volume. `--write` saves the survival matrix as site/src/components/labs/docker/volumes.json for the lab.
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dlab import ALPINE, LABEL, LABS, POSTGRES, check, docker, fresh_dir, inspect, main_guard, run, show, table, write_json  # noqa: E402

WRITE = "--write" in sys.argv


def listing(name: str, path: str) -> str:
    return run("exec", name, "sh", "-c", f"ls {path} 2>/dev/null | tr '\\n' ' '", check=False).stdout.strip()


def survives(kind: str) -> dict:
    """Write /place/note.txt in a container, then see whether it is there after a restart, and after removing the container and starting a new one on the same storage."""
    host = fresh_dir("bind-" + kind)
    vol = f"dlab-vol-{kind}"
    mounts = {
        "layer": [],
        "volume": ["--mount", f"type=volume,source={vol},target=/place"],
        "bind": ["--mount", f"type=bind,source={host},target=/place"],
        "tmpfs": ["--mount", "type=tmpfs,target=/place"],
    }[kind]
    if kind == "volume":
        run("volume", "create", "--label", LABEL, vol)
    docker("run", "-d", "--name", "dlab-s1", "--label", LABEL, *mounts, ALPINE, "sleep", "300")
    docker("exec", "dlab-s1", "sh", "-c", "mkdir -p /place && echo hello > /place/note.txt")
    before = listing("dlab-s1", "/place")
    docker("restart", "-t", "1", "dlab-s1")
    after_restart = listing("dlab-s1", "/place")
    docker("rm", "-f", "dlab-s1")
    docker("run", "-d", "--name", "dlab-s2", "--label", LABEL, *mounts, ALPINE, "sleep", "300")
    after_rm = listing("dlab-s2", "/place")
    docker("rm", "-f", "dlab-s2")
    return {"written": "note.txt" in before, "restart": "note.txt" in after_restart, "removed": "note.txt" in after_rm}


def main() -> None:
    # ---- 1. which storage survives what ----
    matrix = {k: survives(k) for k in ("layer", "volume", "bind", "tmpfs")}
    show("is note.txt still there after...", table([[k, v["written"], v["restart"], v["removed"]] for k, v in matrix.items()], ["storage", "written", "docker restart", "container removed, new one started"]))
    check("the writable layer survives a restart but not the removal of its container", matrix["layer"] == {"written": True, "restart": True, "removed": False})
    check("a named volume survives both", matrix["volume"] == {"written": True, "restart": True, "removed": True})
    check("a bind mount survives both (the file lives on the computer)", matrix["bind"] == {"written": True, "restart": True, "removed": True})
    check("tmpfs (memory) is gone after a restart already", matrix["tmpfs"]["written"] and not matrix["tmpfs"]["restart"] and not matrix["tmpfs"]["removed"], str(matrix["tmpfs"]))

    # ---- 2. a bind mount shares real files with the computer ----
    host = fresh_dir("share")
    (host / "from_host.txt").write_text("written on the computer\n", encoding="utf-8")
    docker("run", "-d", "--name", "dlab-b", "--label", LABEL, "--mount", f"type=bind,source={host},target=/work", ALPINE, "sleep", "300")
    check("the container sees a file made on the computer", docker("exec", "dlab-b", "cat", "/work/from_host.txt") == "written on the computer")
    docker("exec", "dlab-b", "sh", "-c", "echo written in the container > /work/from_container.txt")
    check("the computer sees a file made in the container", (host / "from_container.txt").read_text(encoding="utf-8").strip() == "written in the container")
    (host / "from_host.txt").write_text("edited on the computer\n", encoding="utf-8")
    check("and an edit made on the computer shows up inside at once, with no restart", docker("exec", "dlab-b", "cat", "/work/from_host.txt") == "edited on the computer")
    docker("rm", "-f", "dlab-b")
    docker("run", "-d", "--name", "dlab-ro", "--label", LABEL, "--mount", f"type=bind,source={host},target=/work,readonly", ALPINE, "sleep", "300")
    ro = run("exec", "dlab-ro", "sh", "-c", "echo x > /work/new.txt", check=False)
    check("a read-only bind mount refuses writes", ro.returncode != 0 and "Read-only file system" in ro.stderr, ro.stderr.strip())
    docker("rm", "-f", "dlab-ro")

    # ---- 3. a volume is filled from the image, a bind mount hides it ----
    ictx = fresh_dir("seeded")
    (ictx / "Dockerfile").write_text(f"FROM {ALPINE}\nRUN mkdir /data && echo seed > /data/seed.txt\n", encoding="utf-8")
    run("build", "-q", "--label", LABEL, "-t", "dlab-seeded", str(ictx))
    run("volume", "create", "--label", LABEL, "dlab-vol-seed")
    with_volume = docker("run", "--rm", "--label", LABEL, "--mount", "type=volume,source=dlab-vol-seed,target=/data", "dlab-seeded", "ls", "/data")
    empty_host = fresh_dir("empty")
    with_bind = docker("run", "--rm", "--label", LABEL, "--mount", f"type=bind,source={empty_host},target=/data", "dlab-seeded", "sh", "-c", "ls /data | wc -l")
    plain = docker("run", "--rm", "--label", LABEL, "dlab-seeded", "ls", "/data")
    show("/data of an image that has seed.txt in it", f"no mount:     {plain}\nnew volume:   {with_volume}\nbind of empty folder: {with_bind} file(s)")
    check("without a mount the image's file is there", plain == "seed.txt")
    check("a new, empty named volume is filled with what the image has at that path", with_volume == "seed.txt")
    check("a bind mount of an empty folder hides it: the container sees an empty folder", with_bind == "0")

    # ---- 4. one volume, two running containers ----
    run("volume", "create", "--label", LABEL, "dlab-vol-shared")
    docker("run", "-d", "--name", "dlab-w", "--label", LABEL, "--mount", "type=volume,source=dlab-vol-shared,target=/shared", ALPINE, "sleep", "300")
    docker("run", "-d", "--name", "dlab-r", "--label", LABEL, "--mount", "type=volume,source=dlab-vol-shared,target=/shared", ALPINE, "sleep", "300")
    docker("exec", "dlab-w", "sh", "-c", "echo live > /shared/live.txt")
    check("two running containers share one volume: what one writes the other reads", docker("exec", "dlab-r", "cat", "/shared/live.txt") == "live")
    inuse = run("volume", "rm", "dlab-vol-shared", check=False)
    check("docker volume rm refuses a volume that a container uses", inuse.returncode != 0 and "in use" in inuse.stderr, inuse.stderr.strip())
    docker("rm", "-f", "dlab-w", "dlab-r")
    run("volume", "rm", "dlab-vol-shared")
    check("once no container uses it, it can be removed", "dlab-vol-shared" not in docker("volume", "ls", "--format", "{{.Name}}").split())

    # ---- 5. anonymous volumes of a VOLUME line ----
    vctx = fresh_dir("volline")
    (vctx / "Dockerfile").write_text(f"FROM {ALPINE}\nVOLUME /data\nCMD [\"sh\", \"-c\", \"echo hi > /data/x\"]\n", encoding="utf-8")
    run("build", "-q", "--label", LABEL, "-t", "dlab-volline", str(vctx))
    before = set(docker("volume", "ls", "-q").split())
    docker("run", "--name", "dlab-v1", "--label", LABEL, "dlab-volline")
    docker("run", "--name", "dlab-v2", "--label", LABEL, "dlab-volline")
    made = set(docker("volume", "ls", "-q").split()) - before
    docker("rm", "dlab-v1")
    left = set(docker("volume", "ls", "-q").split()) - before
    docker("rm", "-v", "dlab-v2")
    left2 = set(docker("volume", "ls", "-q").split()) - before
    show("anonymous volumes made by a VOLUME line", f"after two runs: {len(made)}\nafter docker rm (no -v): {len(left)}\nafter docker rm -v: {len(left2)}")
    check("every container of an image with a VOLUME line gets its own anonymous volume", len(made) == 2)
    check("docker rm without -v leaves the anonymous volume behind", len(left) == 2)
    check("docker rm -v removes it together with the container", len(left2) == 1)
    run("volume", "rm", "-f", *left2)

    # ---- 6. a database on a volume survives its container ----
    run("volume", "create", "--label", LABEL, "dlab-vol-pg")
    pg_args = ["--label", LABEL, "-e", "POSTGRES_PASSWORD=lesson", "--mount", "type=volume,source=dlab-vol-pg,target=/var/lib/postgresql/data", POSTGRES]

    def wait_ready(name: str) -> None:
        for _ in range(60):
            if run("exec", name, "pg_isready", "-U", "postgres", check=False).returncode == 0 and run("exec", name, "psql", "-U", "postgres", "-tAc", "select 1", check=False).stdout.strip() == "1":
                return
            time.sleep(1)
        sys.exit("postgres did not become ready")

    docker("run", "-d", "--name", "dlab-pg1", *pg_args)
    wait_ready("dlab-pg1")
    docker("exec", "dlab-pg1", "psql", "-U", "postgres", "-c", "create table orders (id int, item text); insert into orders values (1, 'book'), (2, 'pen');")
    count1 = docker("exec", "dlab-pg1", "psql", "-U", "postgres", "-tAc", "select count(*) from orders")
    docker("rm", "-f", "dlab-pg1")
    docker("run", "-d", "--name", "dlab-pg2", *pg_args)
    wait_ready("dlab-pg2")
    count2 = docker("exec", "dlab-pg2", "psql", "-U", "postgres", "-tAc", "select count(*) from orders")
    docker("rm", "-f", "dlab-pg2")
    check("the table has 2 rows in the first container", count1 == "2", count1)
    check("after removing that container, a new Postgres on the same volume still has them", count2 == "2", count2)
    info = inspect("dlab-vol-pg") if False else None
    del info

    if WRITE:
        write_json(LABS / "volumes.json", {"matrix": matrix, "seeded": {"plain": plain, "volume": with_volume, "bind": int(with_bind)}, "anonymous": {"made": len(made), "afterRm": len(left), "afterRmV": len(left2)}})


if __name__ == "__main__":
    main_guard(main)
