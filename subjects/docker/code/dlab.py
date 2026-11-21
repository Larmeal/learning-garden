"""Helpers shared by the Docker exercises.

Every exercise talks to the real `docker` command line (Docker Engine 29.2.1 on Docker Desktop, WSL2 backend) and asserts what its lesson prints.
Everything an exercise creates carries the label `dlab=1` and a name that starts with `dlab-`, so `cleanup()` can remove it without touching anything else.
"""

import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
LABEL = "dlab=1"
ALPINE = "alpine:3.22"
PYTHON = "python:3.13-slim"
BUSYBOX = "busybox:1.37"
POSTGRES = "postgres:17-alpine"
REGISTRY = "registry:3"
LABS = HERE.parent.parent.parent / "site" / "src" / "components" / "labs" / "docker"


def run(*args: str, input: str | None = None, check: bool = True, timeout: int = 600, cwd: Path | None = None) -> subprocess.CompletedProcess:
    """Run `docker <args>` (utf-8, no shell) and return the finished process."""
    done = subprocess.run(
        ["docker", *args], input=input, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout, cwd=cwd
    )
    if check and done.returncode != 0:
        sys.exit(f"FAILED: docker {' '.join(args)}\n{done.stdout}\n{done.stderr}")
    return done


def docker(*args: str, **kw) -> str:
    """Run `docker <args>` and return stdout without the trailing newline."""
    return run(*args, **kw).stdout.rstrip("\n")


def sh(image: str, script: str, *opts: str, check: bool = True) -> str:
    """`docker run --rm [opts] image sh -c script`, labelled, stdout and stderr together."""
    done = run("run", "--rm", "--label", LABEL, *opts, image, "sh", "-c", script, check=check)
    return (done.stdout + done.stderr).rstrip("\n")


def name(suffix: str) -> str:
    return f"dlab-{suffix}"


def cleanup() -> None:
    """Remove every container, volume, network and image that an exercise made (label dlab=1)."""
    ids = docker("ps", "-aq", "--filter", f"label={LABEL}", check=False).split()
    if ids:
        run("rm", "-f", "-v", *ids, check=False)
    for kind, listing in (("network", ["network", "ls", "-q", "--filter", f"label={LABEL}"]), ("volume", ["volume", "ls", "-q", "--filter", f"label={LABEL}"])):
        found = docker(*listing, check=False).split()
        if found:
            run(kind, "rm", "-f", *found, check=False)
    imgs = docker("images", "-q", "--filter", f"label={LABEL}", check=False).split()
    if imgs:
        run("rmi", "-f", *imgs, check=False)


def fresh_dir(label: str) -> Path:
    """An empty folder under the system temp folder, for a build context or a bind mount."""
    root = Path(tempfile.gettempdir()) / "docker-lessons" / label
    if root.exists():
        shutil.rmtree(root, ignore_errors=True)
    root.mkdir(parents=True)
    return root


def check(label: str, ok: bool, detail: str = "") -> None:
    """Print one result line and fail loudly, because the lessons quote these results."""
    print(f"  {'ok  ' if ok else 'FAIL'} {label}" + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        sys.exit(f"FAILED: {label} {detail}")


def show(title: str, text: str = "") -> None:
    print(f"\n$ {title}" if title else "")
    if text:
        print("\n".join("  " + line for line in str(text).splitlines()))


def table(rows: list[list], headers: list[str]) -> str:
    cells = [[str(c) for c in r] + [""] * (len(headers) - len(r)) for r in rows]
    widths = [max(len(h), *(len(r[i]) for r in cells)) for i, h in enumerate(headers)]
    line = lambda r: "  ".join(c.ljust(w) for c, w in zip(r, widths)).rstrip()  # noqa: E731
    return "\n".join([line(headers), line(["-" * w for w in widths]), *(line(r) for r in cells)])


def inspect(target: str) -> dict:
    return json.loads(docker("inspect", target))[0]


def timed(fn):
    t = time.perf_counter()
    value = fn()
    return value, time.perf_counter() - t


def mb(n: int | float) -> float:
    return round(n / 1_000_000, 1)


def write_json(path: Path, data: object) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  wrote {path.relative_to(LABS.parents[3])}")


def main_guard(fn) -> None:
    """Run an exercise, always clean up, and end with the `ok` line that verify.py looks for."""
    try:
        cleanup()
        fn()
    finally:
        cleanup()
    print("\nok")


__all__ = [n for n in dir() if not n.startswith("_")]
re  # noqa: B018  (kept for exercises that import it from here)
