"""Lesson 3: the life of a container, from create to remove.

Asserts the states a container goes through (created, running, paused, exited, restarting) and the commands that move it between them, the exit codes
of a program that fails, how long `docker stop` really takes for a PID 1 that ignores SIGTERM, one that handles it and one that sits behind `--init`,
what restart policies do, and how `docker logs`, `docker exec` and `docker rm` behave. `--write` saves the measured times and transitions as
site/src/components/labs/docker/lifecycle.json for the labs.
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dlab import ALPINE, LABEL, LABS, PYTHON, check, docker, inspect, main_guard, run, show, table, timed, write_json  # noqa: E402

WRITE = "--write" in sys.argv
HANDLER = "import signal, sys, time; signal.signal(signal.SIGTERM, lambda *a: sys.exit(0)); time.sleep(300)"


def st(name: str) -> dict:
    return inspect(name)["State"]


def code_of(*args: str) -> int:
    return run("run", "--rm", "--label", LABEL, ALPINE, *args, check=False).returncode


def main() -> None:
    # ---- 1. the states, and the command that moves between them ----
    path = []

    def step(label: str, cmd: list[str], want: str) -> None:
        run(*cmd)
        s = st("dlab-life")
        path.append({"cmd": " ".join(["docker", *cmd[:1], *([] if len(cmd) < 2 else [])]).strip(), "state": s["Status"], "exitCode": s["ExitCode"]})
        check(f"{label}: state is {want}", s["Status"] == want, s["Status"])

    run("create", "--name", "dlab-life", "--label", LABEL, PYTHON, "python", "-c", HANDLER)
    path.append({"cmd": "docker create", "state": st("dlab-life")["Status"], "exitCode": 0})
    check("docker create makes the container but does not start the program: created", st("dlab-life")["Status"] == "created")
    check("a created container has no process yet (Pid 0)", st("dlab-life")["Pid"] == 0)
    step("docker start", ["start", "dlab-life"], "running")
    check("a running container has a process on the engine side (Pid > 0)", st("dlab-life")["Pid"] > 0)
    step("docker pause", ["pause", "dlab-life"], "paused")
    check("pause freezes the process but does not end it (Paused flag)", st("dlab-life")["Paused"] is True and st("dlab-life")["Pid"] > 0)
    step("docker unpause", ["unpause", "dlab-life"], "running")
    step("docker stop", ["stop", "dlab-life"], "exited")
    check("a program that handles SIGTERM and exits with 0 leaves exit code 0", st("dlab-life")["ExitCode"] == 0)
    step("docker start (again)", ["start", "dlab-life"], "running")
    step("docker kill", ["kill", "dlab-life"], "exited")
    check("docker kill sends SIGKILL, so the exit code is 128 + 9 = 137", st("dlab-life")["ExitCode"] == 137, str(st("dlab-life")["ExitCode"]))
    check("an exited container is still listed", "dlab-life" in docker("ps", "-a", "--format", "{{.Names}}").split())
    run("rm", "dlab-life")
    check("docker rm makes it disappear", "dlab-life" not in docker("ps", "-a", "--format", "{{.Names}}").split())
    show("states seen", table([[p["cmd"], p["state"], p["exitCode"]] for p in path], ["command", "state afterwards", "exit code"]))

    # ---- 2. exit codes ----
    codes = [
        ("sh -c 'exit 3'", code_of("sh", "-c", "exit 3")),
        ("false", code_of("false")),
        ("sh -c nosuchcmd", code_of("sh", "-c", "nosuchcmd")),
        ("true", code_of("true")),
    ]
    missing = run("run", "--rm", "--label", LABEL, ALPINE, "nosuchcmd", check=False)
    notexec = run("run", "--rm", "--label", LABEL, ALPINE, "/etc/passwd", check=False)
    codes += [("nosuchcmd (no such program in the image)", missing.returncode), ("/etc/passwd (a file that is not executable)", notexec.returncode)]
    show("exit codes of docker run", table([[a, b] for a, b in codes], ["program", "exit code"]) + f"\n\nstderr of the missing program: {missing.stderr.strip().splitlines()[-1] if missing.stderr.strip() else ''}")
    check("the exit code of the program is the exit code of docker run", dict(codes)["sh -c 'exit 3'"] == 3 and dict(codes)["false"] == 1 and dict(codes)["true"] == 0)
    check("a shell reports 127 for a command it cannot find", dict(codes)["sh -c nosuchcmd"] == 127)
    check("docker itself reports 127 when the program is not in the image", missing.returncode == 127 and "executable file not found" in missing.stderr, missing.stderr.strip()[-120:])
    check("and 126 when the file is there but cannot be run", notexec.returncode == 126, f"{notexec.returncode} {notexec.stderr.strip()[-100:]}")

    # ---- 3. docker stop: SIGTERM, wait for the grace period, then SIGKILL ----
    stops = []
    for label, args, expect, stop_args in (
        ("sleep 300 as PID 1", [ALPINE, "sleep", "300"], "ignores SIGTERM", ["-t", "5"]),
        ("python with a SIGTERM handler", [PYTHON, "python", "-c", HANDLER], "handles SIGTERM", ["-t", "5"]),
        ("sleep 300 behind --init", ["--init", ALPINE, "sleep", "300"], "init forwards SIGTERM", ["-t", "5"]),
        ("sleep 300 as PID 1, no -t given", [ALPINE, "sleep", "300"], "ignores SIGTERM", []),
    ):
        docker("run", "-d", "--name", "dlab-stop", "--label", LABEL, *args)
        time.sleep(1)
        _, secs = timed(lambda: run("stop", *stop_args, "dlab-stop"))
        s = st("dlab-stop")
        stops.append({"label": label, "seconds": round(secs, 1), "exitCode": s["ExitCode"], "why": expect, "grace": stop_args[1] if stop_args else None})
        run("rm", "dlab-stop")
    show("docker stop", table([[s["label"], s["grace"] or "default", s["seconds"], s["exitCode"]] for s in stops], ["PID 1 is", "-t", "seconds", "exit code"]))
    check("a plain sleep as PID 1 ignores SIGTERM, so stop waits the whole grace period (5 s) and then kills it (137)", 4.8 <= stops[0]["seconds"] < 7 and stops[0]["exitCode"] == 137, str(stops[0]))
    check("a program with its own handler stops at once with the code it chose (0)", stops[1]["seconds"] < 3 and stops[1]["exitCode"] == 0, str(stops[1]))
    check("behind --init the same sleep ends at once, killed by SIGTERM (143 = 128 + 15)", stops[2]["seconds"] < 3 and stops[2]["exitCode"] == 143, str(stops[2]))
    check("without -t the wait on this engine was about 3 s (measured; the grace period is a setting, not a law)", 2.5 <= stops[3]["seconds"] <= 5 and stops[3]["exitCode"] == 137, str(stops[3]))

    # ---- 4. logs ----
    docker("run", "--name", "dlab-log", "--label", LABEL, ALPINE, "sh", "-c", "echo to-stdout; echo to-stderr >&2; echo second")
    done = run("logs", "dlab-log")
    check("docker logs prints stdout on stdout and stderr on stderr", done.stdout.split() == ["to-stdout", "second"] and done.stderr.strip() == "to-stderr", f"{done.stdout!r} {done.stderr!r}")
    check("the container has already exited, and its logs are still there", st("dlab-log")["Status"] == "exited" and done.returncode == 0)
    stamped = docker("logs", "-t", "dlab-log").splitlines()[0]
    check("-t puts a timestamp in front of every line", stamped[:4].isdigit() and stamped[10] == "T", stamped)

    # ---- 5. exec only works on a running container ----
    docker("run", "-d", "--name", "dlab-ex", "--label", LABEL, ALPINE, "sleep", "300")
    ex = run("exec", "dlab-ex", "sh", "-c", "exit 5", check=False)
    check("docker exec runs one more process and returns its exit code", ex.returncode == 5)
    check("the container keeps running after the exec'd process ended", st("dlab-ex")["Status"] == "running")
    run("stop", "-t", "1", "dlab-ex")
    ex2 = run("exec", "dlab-ex", "true", check=False)
    check("exec on a container that has exited is refused", ex2.returncode != 0 and "is not running" in ex2.stderr, ex2.stderr.strip())

    # ---- 6. restart policies ----
    docker("run", "-d", "--name", "dlab-rs1", "--label", LABEL, "--restart", "on-failure:2", ALPINE, "sh", "-c", "exit 1")
    docker("run", "-d", "--name", "dlab-rs2", "--label", LABEL, "--restart", "on-failure:2", ALPINE, "sh", "-c", "exit 0")
    docker("run", "-d", "--name", "dlab-rs3", "--label", LABEL, "--restart", "always", ALPINE, "sh", "-c", "exit 1")
    deadline = time.time() + 20
    seen_restarting = False
    exec_msg = ""
    while time.time() < deadline:
        s3 = st("dlab-rs3")
        if s3["Restarting"] and not seen_restarting:
            seen_restarting = True
            e = run("exec", "dlab-rs3", "echo", "hi", check=False)
            exec_msg = e.stderr.strip()
        if seen_restarting and st("dlab-rs1")["Status"] == "exited" and inspect("dlab-rs1")["RestartCount"] >= 2:
            break
        time.sleep(0.3)
    rc = {n: inspect(n)["RestartCount"] for n in ("dlab-rs1", "dlab-rs2", "dlab-rs3")}
    show("restart counts", table([["on-failure:2, exits 1", rc["dlab-rs1"], st("dlab-rs1")["Status"]], ["on-failure:2, exits 0", rc["dlab-rs2"], st("dlab-rs2")["Status"]], ["always, exits 1", rc["dlab-rs3"], "keeps going"]], ["policy and program", "restarts", "state"]))
    check("on-failure:2 restarts a failing program exactly twice and then gives up", rc["dlab-rs1"] == 2 and st("dlab-rs1")["Status"] == "exited", str(rc))
    check("on-failure does not restart a program that exited with 0", rc["dlab-rs2"] == 0 and st("dlab-rs2")["Status"] == "exited")
    check("always keeps restarting (backoff between tries, the state is 'restarting' in between)", rc["dlab-rs3"] >= 2 and seen_restarting, str(rc))
    check("while it waits to restart, docker exec is refused (as the book says)", "restarting" in exec_msg, exec_msg)
    check("the policy is stored on the container", inspect("dlab-rs1")["HostConfig"]["RestartPolicy"] == {"Name": "on-failure", "MaximumRetryCount": 2})

    # ---- 7. stdin, and removing ----
    echoed = run("run", "-i", "--rm", "--label", LABEL, ALPINE, "cat", input="hello\n")
    check("-i connects our stdin to the program (without -i it would see nothing)", echoed.stdout.strip() == "hello")
    docker("run", "-d", "--name", "dlab-live", "--label", LABEL, ALPINE, "sleep", "300")
    rm = run("rm", "dlab-live", check=False)
    check("docker rm refuses a running container", rm.returncode != 0 and "running" in rm.stderr, rm.stderr.strip())
    pruned = docker("container", "prune", "-f", "--filter", f"label={LABEL}")
    check("container prune removes the stopped ones and leaves the running one", "dlab-live" not in pruned and st("dlab-live")["Status"] == "running")
    check("and the exited containers of this exercise are gone from the list", "dlab-ex" not in docker("ps", "-a", "--format", "{{.Names}}").split())

    if WRITE:
        write_json(LABS / "lifecycle.json", {"path": path, "codes": [{"program": a, "code": b} for a, b in codes], "stops": stops, "restart": rc})


if __name__ == "__main__":
    main_guard(main)
