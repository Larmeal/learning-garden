"""Lesson 4: writing a Dockerfile. What each instruction makes, and the forms that change how a container starts.

Asserts which instructions add a layer with bytes and which only add metadata, how CMD and ENTRYPOINT combine (exec form and shell form), whether a shell-form CMD
changes what PID 1 is, that ENV reaches the running container and ARG does not (and that an ARG used in a RUN line can still be read in the image history), the difference between
COPY and ADD for an archive, that COPY writes files as root even after USER, and what a failing RUN looks like. `--write` saves the history of the first image as
site/src/components/labs/docker/dockerfile.json for the lab.
"""

import sys
import tarfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dlab import ALPINE, LABEL, LABS, PYTHON, check, docker, fresh_dir, inspect, main_guard, run, show, table, write_json  # noqa: E402

WRITE = "--write" in sys.argv


def build(tag: str, ctx: Path, *extra: str, dockerfile: str | None = None, check_ok: bool = True) -> object:
    if dockerfile is not None:
        (ctx / "Dockerfile").write_text(dockerfile, encoding="utf-8")
    return run("build", "--progress=plain", "--label", LABEL, "-t", tag, *extra, str(ctx), check=check_ok)


def main() -> None:
    # ---- 1. one small app: what each instruction adds ----
    ctx = fresh_dir("app")
    (ctx / "app.py").write_text('import os\nprint("greeting:", os.environ.get("GREETING"), "| cwd:", os.getcwd(), "| uid:", os.getuid())\n', encoding="utf-8")
    dockerfile = f"""FROM {PYTHON}
LABEL org.example.course=docker
ENV GREETING=hello
WORKDIR /app
COPY app.py .
RUN python -c "open('/app/built.txt', 'w').write('x' * 1000)"
EXPOSE 8080
CMD ["python", "app.py"]
"""
    build("dlab-app", ctx, dockerfile=dockerfile)
    out = docker("run", "--rm", "--label", LABEL, "dlab-app")
    show("docker run dlab-app", out)
    check("CMD ran the script, ENV and WORKDIR were in effect", out == "greeting: hello | cwd: /app | uid: 0", out)
    rows = [r.split("|", 1) for r in docker("history", "--no-trunc", "--format", "{{.Size}}|{{.CreatedBy}}", "dlab-app").splitlines()][::-1]
    mine = [(size, by.replace("/bin/sh -c ", "").replace("#(nop) ", "").strip()[:60]) for size, by in rows][-7:]
    show("docker history, oldest first (the last seven steps are ours)", table([[s, c] for s, c in mine], ["size", "created by"]))
    meta = [m for m in mine if m[1].startswith(("LABEL", "ENV", "WORKDIR", "EXPOSE", "CMD"))]
    check("LABEL, ENV, WORKDIR, EXPOSE and CMD each add a step", len(meta) == 5, str(meta))
    check("and those steps hold no bytes (they only change the image's metadata)", all(s in ("0B",) for s, _ in meta), str(meta))
    sized = [m for m in mine if m[1].startswith(("COPY", "RUN"))]
    check("COPY and RUN steps hold the bytes they wrote", len(sized) == 2 and all(s != "0B" for s, _ in sized), str(sized))
    img = inspect("dlab-app")
    base_layers = len(inspect(PYTHON)["RootFS"]["Layers"])
    check("the image has the 4 layers of the base plus 3 more: COPY, RUN and also WORKDIR (it creates the folder, although history shows 0B)", len(img["RootFS"]["Layers"]) == base_layers + 3, f"{len(img['RootFS']['Layers'])} vs {base_layers}")
    c0 = fresh_dir("meta")
    only_env = build("dlab-onlyenv", c0, dockerfile=f'FROM {PYTHON}\nENV A=1\nLABEL b=2\nCMD ["true"]\n')
    only_wd = build("dlab-onlywd", c0, dockerfile=f"FROM {PYTHON}\nWORKDIR /newdir\n")
    n_env, n_wd = len(inspect("dlab-onlyenv")["RootFS"]["Layers"]), len(inspect("dlab-onlywd")["RootFS"]["Layers"])
    check("ENV, LABEL and CMD add no layer to the file system at all", n_env == base_layers, f"{n_env} vs {base_layers}")
    check("WORKDIR to a new folder adds one", n_wd == base_layers + 1, f"{n_wd} vs {base_layers}")
    del only_env, only_wd
    check("the metadata went into the image config", img["Config"]["Env"].count("GREETING=hello") == 1 and img["Config"]["WorkingDir"] == "/app" and img["Config"]["Cmd"] == ["python", "app.py"] and img["Config"]["Labels"]["org.example.course"] == "docker")
    check("EXPOSE is only a note in the config, nothing was published", "8080/tcp" in img["Config"]["ExposedPorts"] and docker("run", "-d", "--name", "dlab-ex", "--label", LABEL, "dlab-app", "sleep", "30") and all(v is None for v in inspect("dlab-ex")["NetworkSettings"]["Ports"].values()))
    over = docker("run", "--rm", "--label", LABEL, "dlab-app", "python", "-c", "print(6 * 7)")
    check("arguments after the image name replace CMD", over == "42", over)

    # ---- 2. CMD and ENTRYPOINT ----
    c2 = fresh_dir("cmd")
    cases = {
        "exec ENTRYPOINT + CMD": f'FROM {ALPINE}\nENTRYPOINT ["echo", "hello"]\nCMD ["world"]\n',
        "shell ENTRYPOINT + CMD": f'FROM {ALPINE}\nENTRYPOINT echo hello\nCMD ["world"]\n',
        "CMD only": f'FROM {ALPINE}\nCMD ["echo", "default"]\n',
    }
    results = {}
    for label, text in cases.items():
        tag = "dlab-cmd-" + label.split()[0].lower() + str(len(results))
        build(tag, c2, dockerfile=text)
        second = run("run", "--rm", "--label", LABEL, tag, "docker", check=False)
        results[label] = (docker("run", "--rm", "--label", LABEL, tag), second.stdout.strip() or f"error, exit code {second.returncode}", tag, second.returncode)
    entry_override = docker("run", "--rm", "--label", LABEL, "--entrypoint", "echo", results["exec ENTRYPOINT + CMD"][2], "replaced")
    show("what each Dockerfile prints, with no argument and with the argument 'docker'", table([[k, v[0], v[1]] for k, v in results.items()], ["Dockerfile", "docker run image", "docker run image docker"]))
    check("exec ENTRYPOINT with CMD: CMD is the default argument", results["exec ENTRYPOINT + CMD"][0] == "hello world")
    check("an argument on the command line replaces CMD but keeps ENTRYPOINT", results["exec ENTRYPOINT + CMD"][1] == "hello docker")
    check("shell-form ENTRYPOINT ignores CMD and every argument (the book says so)", results["shell ENTRYPOINT + CMD"][0] == "hello" and results["shell ENTRYPOINT + CMD"][1] == "hello")
    check("with CMD alone, an argument replaces the whole command, so Docker tries to run a program called docker and fails (127)", results["CMD only"][0] == "default" and results["CMD only"][3] == 127, str(results["CMD only"]))
    check("--entrypoint replaces the ENTRYPOINT of the image", entry_override == "replaced")

    # ---- 3. shell form and exec form: who is PID 1 ----
    pid1 = {}
    for label, line in (("exec form", 'CMD ["sleep", "300"]'), ("shell form", "CMD sleep 300"), ("shell form with &&", "CMD sleep 300 && echo done")):
        tag = "dlab-pid" + str(len(pid1))
        build(tag, c2, dockerfile=f"FROM {ALPINE}\n{line}\n")
        name = f"dlab-pid{len(pid1)}"
        docker("run", "-d", "--name", name, "--label", LABEL, tag)
        pid1[label] = docker("exec", name, "sh", "-c", "tr '\\0' ' ' < /proc/1/cmdline").strip()
    show("what PID 1 is for each way of writing CMD", table([[k, v] for k, v in pid1.items()], ["form", "PID 1"]))
    check("exec form: the program itself is PID 1", pid1["exec form"] == "sleep 300")
    check("shell form of one command: busybox sh replaces itself with the command, so PID 1 is still the program", pid1["shell form"] == "sleep 300", pid1["shell form"])
    check("shell form with two commands: the shell stays as PID 1 and the program is its child", pid1["shell form with &&"].startswith("/bin/sh -c"), pid1["shell form with &&"])

    # ---- 4. ENV and ARG ----
    c3 = fresh_dir("env")
    text = f'FROM {ALPINE}\nARG VERSION=1.0\nARG TOKEN=not-a-real-secret\nENV APP_ENV=prod\nRUN echo "building $VERSION with $TOKEN" > /built.txt\nCMD ["sh", "-c", "env | sort | grep -E \'APP_ENV|VERSION|TOKEN\'; cat /built.txt"]\n'
    build("dlab-env", c3, "--build-arg", "VERSION=2.0", dockerfile=text)
    env_out = docker("run", "--rm", "--label", LABEL, "dlab-env")
    show("docker run dlab-env (built with --build-arg VERSION=2.0)", env_out)
    check("ENV is in the running container", "APP_ENV=prod" in env_out)
    check("ARG is not: VERSION and TOKEN are not in the environment of the container", "VERSION=" not in env_out.split("building")[0] and "TOKEN=" not in env_out.split("building")[0])
    check("but the value given at build time went into the file the RUN line wrote", "building 2.0 with not-a-real-secret" in env_out)
    hist = docker("history", "--no-trunc", "--format", "{{.CreatedBy}}", "dlab-env")
    check("and an ARG used by a RUN line can be read by anyone in docker history", "not-a-real-secret" in hist and "VERSION=2.0" in hist)
    check("docker run -e overrides an ENV", docker("run", "--rm", "--label", LABEL, "-e", "APP_ENV=dev", "dlab-env", "sh", "-c", "echo $APP_ENV") == "dev")

    # ---- 5. COPY and ADD for an archive ----
    c4 = fresh_dir("add")
    inner = c4 / "pack"
    inner.mkdir()
    (inner / "hello.txt").write_text("from inside the archive\n", encoding="utf-8")
    with tarfile.open(c4 / "data.tar", "w") as tar:
        tar.add(inner / "hello.txt", arcname="hello.txt")
    build("dlab-copy", c4, dockerfile=f"FROM {ALPINE}\nCOPY data.tar /in/\n")
    build("dlab-add", c4, dockerfile=f"FROM {ALPINE}\nADD data.tar /in/\n")
    ls_copy = docker("run", "--rm", "--label", LABEL, "dlab-copy", "ls", "/in").split()
    ls_add = docker("run", "--rm", "--label", LABEL, "dlab-add", "ls", "/in").split()
    show("ls /in", f"COPY data.tar: {ls_copy}\nADD  data.tar: {ls_add}")
    check("COPY puts the archive in as a file", ls_copy == ["data.tar"])
    check("ADD unpacks a local archive", ls_add == ["hello.txt"])

    # ---- 6. USER and who owns the copied files ----
    c5 = fresh_dir("user")
    (c5 / "f.txt").write_text("x", encoding="utf-8")
    build("dlab-user", c5, dockerfile=f"FROM {ALPINE}\nRUN adduser -D -u 1000 app\nUSER app\nWORKDIR /home/app/work\nCOPY f.txt .\nCMD [\"sh\", \"-c\", \"id -u; ls -ln f.txt; pwd\"]\n")
    lines = docker("run", "--rm", "--label", LABEL, "dlab-user").splitlines()
    show("docker run dlab-user", "\n".join(lines))
    check("USER sets who the container runs as", lines[0] == "1000")
    check("WORKDIR created the folder and the container starts there", lines[2] == "/home/app/work")
    check("COPY made the file owned by root (0), even after USER app", lines[1].split()[2] == "0", lines[1])

    # ---- 7. a failing RUN ----
    c6 = fresh_dir("fail")
    bad = build("dlab-bad", c6, dockerfile=f"FROM {ALPINE}\nRUN echo step one\nRUN nosuchcommand\nRUN echo never reached\n", check_ok=False)
    log = bad.stderr
    show("tail of the build log", "\n".join(log.strip().splitlines()[-6:]))
    check("a failing RUN stops the build with a non-zero exit code", bad.returncode != 0)
    check("the log names the command and its exit code (127, not found)", "nosuchcommand" in log and "exit code: 127" in log)
    check("the line after it never ran", "never reached" not in log.replace("RUN echo never reached", ""))

    if WRITE:
        write_json(LABS / "dockerfile.json", {"steps": [{"size": s, "by": c} for s, c in mine], "baseLayers": base_layers, "imageLayers": len(img["RootFS"]["Layers"]), "pid1": pid1, "cmdResults": {k: [v[0], v[1]] for k, v in results.items()}})


if __name__ == "__main__":
    main_guard(main)
