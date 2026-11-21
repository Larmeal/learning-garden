"""Lesson 10: what the Linux kernel does for a container. Namespaces decide what a process can see, cgroups decide how much it can use.

Asserts which namespaces a container has of its own and which it shares with the engine's Linux (and that Docker does not use a user namespace by default), that two containers can
share one namespace on purpose (`--pid=container:`, `--network=container:`), that `unshare` makes a hostname or a process tree of our own without Docker, what `--memory`,
`--cpus` and `--pids-limit` write into the cgroup files, what happens at the limit (an out-of-memory kill with exit code 137, CPU throttling, a refused fork), and how far a program
that allocates memory gets under each limit. `--write` saves what was seen as site/src/components/labs/docker/kernel.json for the labs.
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dlab import ALPINE, LABEL, LABS, PYTHON, check, docker, inspect, main_guard, run, show, table, write_json  # noqa: E402

WRITE = "--write" in sys.argv
NS_SCRIPT = "for n in cgroup ipc mnt net pid user uts; do echo $n $(readlink /proc/self/ns/$n); done"
KINDS = ["cgroup", "ipc", "mnt", "net", "pid", "user", "uts"]


def namespaces(*opts: str, keep: list[str]) -> dict[str, str]:
    """Namespace ids seen by a container that stays alive until the end of the comparison (a freed namespace gives its number to the next one, so two
    containers that ran one after the other would show the same id)."""
    name = f"dlab-ns-{len(keep)}"
    docker("run", "-d", "--name", name, "--label", LABEL, *opts, ALPINE, "sleep", "300")
    keep.append(name)
    out = docker("exec", name, "sh", "-c", NS_SCRIPT)
    return dict(line.split(" ", 1) for line in out.splitlines())


def cg(*opts: str, files: str) -> dict[str, str]:
    out = docker("run", "--rm", "--label", LABEL, *opts, ALPINE, "sh", "-c", f"for f in {files}; do echo $f $(cat /sys/fs/cgroup/$f); done")
    return dict(line.split(" ", 1) for line in out.splitlines())


def main() -> None:
    # ---- 1. which namespaces does a container have of its own? ----
    alive: list[str] = []
    a, b = namespaces(keep=alive), namespaces(keep=alive)
    host_pid = namespaces("--pid=host", keep=alive)
    host_all = namespaces("--pid=host", "--net=host", "--uts=host", "--ipc=host", keep=alive)
    docker("rm", "-f", *alive)
    rows = [[k, "differs" if a[k] != b[k] else "same", "same" if a[k] == host_all[k] else "differs"] for k in KINDS]
    show("two ordinary containers, and a container that shares the engine's namespaces", table(rows, ["namespace", "container A against container B", "container A against the engine's Linux"]))
    for k in ("pid", "net", "mnt", "uts", "ipc"):
        check(f"two containers have their own {k} namespace each", a[k] != b[k] and a[k] != host_all[k])
    check("Docker does not use a user namespace by default: every container is in the same one as the engine's Linux", a["user"] == b["user"] == host_all["user"], str((a["user"], host_all["user"])))
    check("a container started with --pid=host is in the same pid namespace as another one that asked for it", host_pid["pid"] == host_all["pid"] and host_pid["pid"] != a["pid"])
    check("and it keeps its own network namespace unless --net=host is given too", host_pid["net"] != host_all["net"])
    check("--net=host, --uts=host and --ipc=host also give the engine's net, uts and ipc namespaces", host_all["net"] != a["net"] and host_all["uts"] != a["uts"] and host_all["ipc"] != a["ipc"])
    hostname_host = docker("run", "--rm", "--label", LABEL, "--uts=host", ALPINE, "hostname")
    hostname_own = docker("run", "--rm", "--label", LABEL, ALPINE, "hostname")
    check("in its own uts namespace the hostname is the container id, in the engine's it is the name of the engine's Linux", len(hostname_own) == 12 and hostname_host != hostname_own, f"{hostname_own} / {hostname_host}")

    # ---- 2. two containers sharing one namespace on purpose ----
    docker("run", "-d", "--name", "dlab-ns-a", "--label", LABEL, ALPINE, "sleep", "300")
    seen = docker("run", "--rm", "--label", LABEL, "--pid=container:dlab-ns-a", ALPINE, "ps", "-o", "pid,args")
    check("--pid=container:A lets container B see the processes of A", "sleep 300" in seen, seen)
    ip_a = docker("inspect", "-f", "{{.NetworkSettings.Networks.bridge.IPAddress}}", "dlab-ns-a")
    ip_b = docker("run", "--rm", "--label", LABEL, "--network=container:dlab-ns-a", ALPINE, "sh", "-c", "ip -4 -o addr show eth0 | awk '{print $4}'")
    check("--network=container:A puts B in the network namespace of A: the same address", ip_b.split("/")[0] == ip_a, f"{ip_b} vs {ip_a}")
    docker("rm", "-f", "dlab-ns-a")

    # ---- 3. namespaces without Docker: unshare ----
    inner = docker("run", "--rm", "--label", LABEL, "--privileged", ALPINE, "sh", "-c", "H=$(hostname); unshare -u sh -c 'hostname made-by-unshare; echo inside=$(hostname)'; echo outside=$(hostname) was=$H")
    lines = dict(p.split("=", 1) for p in inner.replace(" was=", "\nwas=").splitlines())
    show("unshare -u: a hostname of our own, made by hand", inner)
    check("a new uts namespace made with unshare can change the hostname without changing it outside", lines["inside"] == "made-by-unshare" and lines["outside"] != "made-by-unshare")
    tree = docker("run", "--rm", "--label", LABEL, "--privileged", ALPINE, "sh", "-c", "unshare -p -f --mount-proc ps -o pid,args")
    check("a new pid namespace made with unshare starts counting from 1", tree.splitlines()[1].split()[0] == "1", tree)

    # ---- 4. what --memory, --cpus and --pids-limit write ----
    plain = cg(files="memory.max cpu.max pids.max")
    limited = cg("--memory", "64m", "--cpus", "0.5", "--pids-limit", "20", files="memory.max cpu.max pids.max")
    show("the cgroup files seen from inside", table([[k, plain[k], limited[k]] for k in plain], ["file", "no limits", "--memory 64m --cpus 0.5 --pids-limit 20"]))
    check("without options every limit is max (no limit)", plain["memory.max"] == "max" and plain["pids.max"] == "max" and plain["cpu.max"].startswith("max"))
    check("--memory 64m writes 67108864 bytes into memory.max", limited["memory.max"] == "67108864")
    check("--cpus 0.5 writes a quota of 50000 microseconds per 100000 into cpu.max", limited["cpu.max"] == "50000 100000")
    check("--pids-limit 20 writes 20 into pids.max", limited["pids.max"] == "20")
    cid = docker("run", "-d", "--label", LABEL, "--memory", "64m", ALPINE, "sleep", "30")
    check("docker inspect shows the same limit from outside (bytes)", inspect(cid)["HostConfig"]["Memory"] == 67108864)
    docker("rm", "-f", cid)

    # ---- 5. what happens at the memory limit ----
    alloc = "import sys, time\nchunks = []\nfor i in range(1, 13):\n    chunks.append(bytearray(b'x') * (10 * 1024 * 1024))\n    print(i * 10, flush=True)\n    time.sleep(0.05)\nprint('done', flush=True)\n"
    memory = {}
    for label, opts in (("no limit", []), ("256m", ["--memory", "256m", "--memory-swap", "256m"]), ("64m", ["--memory", "64m", "--memory-swap", "64m"]), ("32m", ["--memory", "32m", "--memory-swap", "32m"])):
        name = "dlab-mem-" + label.replace(" ", "")
        done = run("run", "--name", name, "--label", LABEL, *opts, PYTHON, "python", "-c", alloc, check=False)
        reached = [int(x) for x in done.stdout.split() if x.isdigit()]
        st = inspect(name)["State"]
        memory[label] = {"reachedMb": max(reached, default=0), "finished": "done" in done.stdout, "oomKilled": st["OOMKilled"], "exitCode": st["ExitCode"]}
        docker("rm", "-f", name)
    show("a program that allocates 10 MB at a time, up to 120 MB", table([[k, v["reachedMb"], v["finished"], v["oomKilled"], v["exitCode"]] for k, v in memory.items()], ["limit", "last MB printed", "finished", "OOMKilled", "exit code"]))
    check("without a limit, or with a limit above what it needs, the program finishes", memory["no limit"]["finished"] and memory["256m"]["finished"])
    check("under 64m the kernel kills it before it reaches 120 MB: OOMKilled and exit code 137", memory["64m"]["oomKilled"] and memory["64m"]["exitCode"] == 137 and not memory["64m"]["finished"], str(memory["64m"]))
    check("under 32m it is killed even earlier", memory["32m"]["oomKilled"] and memory["32m"]["reachedMb"] < memory["64m"]["reachedMb"], str(memory))

    # ---- 6. what happens at the CPU limit ----
    spin = "import time\nstart = time.perf_counter()\nwhile time.perf_counter() - start < 2.5:\n    pass\nwall = time.perf_counter() - start\nstat = dict(line.split() for line in open('/sys/fs/cgroup/cpu.stat'))\nprint(round(time.process_time() / wall, 2), stat['nr_throttled'])\n"
    cpu = {}
    for label, opts in (("no limit", []), ("--cpus 1", ["--cpus", "1"]), ("--cpus 0.5", ["--cpus", "0.5"]), ("--cpus 0.25", ["--cpus", "0.25"])):
        out = docker("run", "--rm", "--label", LABEL, *opts, PYTHON, "python", "-c", spin)
        share, thr = out.split()
        cpu[label] = {"share": float(share), "throttled": int(thr)}
    show("a program that spins for 2.5 s: the share of one CPU it got, and how often the kernel paused it", table([[k, v["share"], v["throttled"]] for k, v in cpu.items()], ["limit", "CPU time / wall time", "periods throttled"]))
    check("without a limit one busy thread gets about a whole CPU and is never throttled", cpu["no limit"]["share"] > 0.85 and cpu["no limit"]["throttled"] == 0, str(cpu["no limit"]))
    check("--cpus 0.5 holds it to about half a CPU, and the kernel throttles it", 0.35 <= cpu["--cpus 0.5"]["share"] <= 0.65 and cpu["--cpus 0.5"]["throttled"] > 0, str(cpu["--cpus 0.5"]))
    check("--cpus 0.25 holds it to about a quarter", 0.15 <= cpu["--cpus 0.25"]["share"] <= 0.35 and cpu["--cpus 0.25"]["throttled"] > 0, str(cpu["--cpus 0.25"]))

    # ---- 7. what happens at the process limit ----
    bomb = "for i in $(seq 1 30); do sleep 20 & done 2>&1; echo started; sleep 1; echo jobs=$(ls /proc | grep -c '^[0-9]')"
    tried = run("run", "--rm", "--label", LABEL, "--pids-limit", "10", ALPINE, "sh", "-c", bomb, check=False)
    text = tried.stdout + tried.stderr
    show("30 background processes under --pids-limit 10", text.strip().splitlines()[-4:] and "\n".join(text.strip().splitlines()[-4:]))
    check("a fork that would pass the limit is refused (the shell cannot fork)", "fork" in text.lower() or "resource temporarily unavailable" in text.lower(), text[-200:])
    time.sleep(0)

    if WRITE:
        write_json(
            LABS / "kernel.json",
            {
                "ns": {"container": a, "host": host_all, "kinds": KINDS},
                "pid": {"isolatedProcesses": int(docker("run", "--rm", "--label", LABEL, ALPINE, "sh", "-c", "ps | wc -l")) - 1, "hostProcesses": int(docker("run", "--rm", "--label", LABEL, "--pid=host", ALPINE, "sh", "-c", "ps | wc -l")) - 1},
                "net": {"container": sorted(docker("run", "--rm", "--label", LABEL, ALPINE, "ls", "/sys/class/net").split()), "hostCount": len(docker("run", "--rm", "--label", LABEL, "--net=host", ALPINE, "ls", "/sys/class/net").split())},
                "uts": {"container": hostname_own, "host": hostname_host},
                "memory": memory,
                "cpu": cpu,
                "files": {"plain": plain, "limited": limited},
            },
        )


if __name__ == "__main__":
    main_guard(main)
