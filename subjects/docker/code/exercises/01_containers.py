"""Lesson 1: what a container is. A process that sees a small world, on a kernel it shares with every other container.

Asserts that containers of different images report the same kernel but different operating system files, that the program a container starts is PID 1 inside and
an ordinary process with another number from outside, that the container lives exactly as long as that program, that two containers of one image do not share
changes, and that the hostname is the container id. `--write` saves what was seen as site/src/components/labs/docker/containers.json for the lab.
"""

import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dlab import ALPINE, BUSYBOX, LABEL, LABS, PYTHON, check, docker, inspect, main_guard, run, sh, show, table, write_json  # noqa: E402

WRITE = "--write" in sys.argv


def os_name(image: str) -> str:
    text = sh(image, "cat /etc/os-release 2>/dev/null || echo PRETTY_NAME=none")
    return re.search(r'^PRETTY_NAME="?([^"\n]+)', text, flags=re.M).group(1)


# python:3.13-slim has no `ps` at all, so the processes of a container are read from /proc, which every image has
LISTING = r'for d in /proc/[0-9]*; do printf "%s " "${d#/proc/}"; tr "\0" " " < $d/cmdline; echo; done'


def ps_lines(out: str) -> list[tuple[int, str]]:
    rows = []
    for line in out.splitlines()[1:]:
        parts = line.split(None, 1)
        if len(parts) == 2 and parts[0].isdigit():
            rows.append((int(parts[0]), parts[1].strip()))
    return rows


def main() -> None:
    # ---- 1. one kernel, many userlands ----
    host_kernel = docker("info", "--format", "{{.KernelVersion}}")
    rows = []
    for image in (ALPINE, BUSYBOX, PYTHON):
        rows.append([image, sh(image, "uname -r"), os_name(image)])
    show("the same two commands in three images (busybox has no /etc/os-release at all)", table(rows, ["image", "uname -r", "PRETTY_NAME of /etc/os-release"]))
    check("every container reports the kernel of the Docker engine", all(r[1] == host_kernel for r in rows), host_kernel)
    check("but each image brings its own operating system files", len({r[2] for r in rows}) == 3, str([r[2] for r in rows]))
    check("the Docker engine here runs on Linux, not on the Windows kernel", "microsoft-standard-WSL2" in host_kernel, host_kernel)

    # ---- 2. the program is PID 1 inside, an ordinary process outside ----
    started = {}
    for label, image, argv in (
        ("a", ALPINE, ["sleep", "300"]),
        ("b", BUSYBOX, ["sleep", "301"]),
        ("c", PYTHON, ["python", "-c", "import time; time.sleep(302)"]),
    ):
        docker("run", "-d", "--name", f"dlab-{label}", "--label", LABEL, image, *argv)
        started[label] = (image, " ".join(argv))
    inside = {}
    for label in started:
        out = docker("exec", f"dlab-{label}", "sh", "-c", LISTING)
        inside[label] = [(p, c) for p, c in ps_lines("header\n" + out) if not c.startswith(("sh -c", "tr "))]
    outside = ps_lines(sh(ALPINE, "ps -o pid,args", "--pid=host"))
    alpine_ps = ps_lines(docker("exec", "dlab-a", "ps", "-o", "pid,args"))
    show("docker exec dlab-a ps -o pid,args", "\n".join(f"{p:>5}  {c}" for p, c in alpine_ps))
    check("ps inside an Alpine container lists the program as PID 1 and ps itself (2 processes)", alpine_ps[0] == (1, "sleep 300") and len(alpine_ps) == 2, str(alpine_ps))
    check("inside the container the program we started is PID 1", inside["a"][0][0] == 1 and inside["a"][0][1] == "sleep 300", str(inside["a"]))
    check("nothing else runs in it: the program is the whole container", len(inside["a"]) == 1, str(inside["a"]))
    host_pids = {}
    for label, (_, cmd) in started.items():
        found = [p for p, c in outside if c == cmd]
        check(f"outside, the program of container {label} is a normal process with a different number", len(found) == 1 and found[0] != 1, f"{cmd}: {found}")
        host_pids[label] = found[0]
    show("the same processes seen from the engine's own PID namespace", "\n".join(f"{host_pids[k]:>6}  {started[k][1]}" for k in started))
    check("the engine sees many more processes than any container does", len(outside) > 10 > max(len(v) for v in inside.values()), f"{len(outside)} outside")
    top = docker("top", "dlab-a")
    check("docker top shows the same process from outside", "sleep 300" in top and str(host_pids["a"]) in top, top.splitlines()[-1])

    # ---- 3. hostname, and a world of its own ----
    cid = docker("inspect", "-f", "{{.Id}}", "dlab-a")
    host_a = docker("exec", "dlab-a", "hostname")
    check("the hostname is the first 12 characters of the container id", host_a == cid[:12], f"{host_a} / {cid[:12]}")
    # Docker 29 no longer has NetworkSettings.IPAddress (the books use it); the address is under the network's name
    removed = run("inspect", "-f", "{{.NetworkSettings.IPAddress}}", "dlab-a", check=False)
    check("Docker 29 removed the old top-level NetworkSettings.IPAddress field that the books use", removed.returncode != 0 and "no entry for key" in removed.stderr)
    ip_a = docker("inspect", "-f", "{{.NetworkSettings.Networks.bridge.IPAddress}}", "dlab-a")
    ip_b = docker("inspect", "-f", "{{.NetworkSettings.Networks.bridge.IPAddress}}", "dlab-b")
    check("each container has its own IP address", ip_a != ip_b and ip_a.startswith("172."), f"{ip_a} {ip_b}")
    root_a = docker("exec", "dlab-a", "ls", "/").split()
    check("the root directory it sees is the image's, small", "bin" in root_a and "etc" in root_a and "mnt" in root_a and "Users" not in root_a and "c" not in root_a, str(root_a))

    # ---- 4. a container lives as long as its program ----
    docker("run", "-d", "--name", "dlab-short", "--label", LABEL, ALPINE, "sleep", "3")
    s0 = inspect("dlab-short")["State"]["Status"]
    time.sleep(5)
    s1 = inspect("dlab-short")["State"]
    check("while the program runs, the container is running", s0 == "running", s0)
    check("when the program exits, the container is exited with the program's exit code", s1["Status"] == "exited" and s1["ExitCode"] == 0, str(s1["Status"]))
    docker("start", "dlab-short")
    check("starting it again runs the same program again", inspect("dlab-short")["State"]["Status"] == "running")

    # ---- 5. an image is a template, two containers do not share changes ----
    docker("run", "--name", "dlab-w1", "--label", LABEL, ALPINE, "sh", "-c", "echo hello > /note.txt && cat /note.txt")
    second = run("run", "--rm", "--label", LABEL, ALPINE, "cat", "/note.txt", check=False)
    check("a second container from the same image does not see the file", second.returncode != 0 and "No such file" in second.stderr, second.stderr.strip())
    check("the first container still has it (its own writable layer)", docker("start", "-a", "dlab-w1") == "hello")
    first_ids = docker("images", "--no-trunc", "-q", ALPINE)
    check("the image is the same one for both and was not changed", first_ids.startswith("sha256:") and first_ids == docker("images", "--no-trunc", "-q", ALPINE))
    names = docker("ps", "-a", "--filter", f"label={LABEL}", "--format", "{{.Names}}").split()
    check("every docker run made a new container; the exited ones are still listed until removed", {"dlab-short", "dlab-w1"} <= set(names), str(names))

    if WRITE:
        picture = []
        for label, (image, cmd) in started.items():
            picture.append(
                {
                    "name": label,
                    "image": image,
                    "cmd": cmd,
                    "os": os_name(image),
                    "hostname": docker("exec", f"dlab-{label}", "hostname"),
                    "ip": docker("inspect", "-f", "{{.NetworkSettings.Networks.bridge.IPAddress}}", f"dlab-{label}"),
                    "inside": [{"pid": p, "cmd": c} for p, c in inside[label] if not c.startswith("ps")],
                    "hostPid": host_pids[label],
                }
            )
        others = [{"pid": p, "cmd": c} for p, c in outside if p not in host_pids.values() and not c.startswith("ps")][:6]
        write_json(LABS / "containers.json", {"kernel": host_kernel, "containers": picture, "others": others, "totalOutside": len(outside)})


if __name__ == "__main__":
    main_guard(main)
