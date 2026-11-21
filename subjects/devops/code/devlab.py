"""Shared helpers for the DevOps exercises.

Every exercise builds throwaway repositories and folders under the system temp folder, with a fixed author and clock,
and calls the real programs (git, docker, terraform). Only the standard library is used, so `uv sync` has nothing to install.
"""

from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

LAB = Path(tempfile.gettempdir()) / "devops-lab"
HERE = Path(__file__).resolve().parent
PY = sys.executable

_tick = [0]


def _env(extra: dict[str, str] | None = None) -> dict[str, str]:
    env = dict(os.environ)
    for key in [k for k in env if k.startswith("GIT_")]:
        del env[key]
    minute = _tick[0]
    stamp = f"2026-01-05T09:{minute // 60:02d}:{minute % 60:02d} +0000"
    env.update(
        {
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_AUTHOR_NAME": "Ada",
            "GIT_AUTHOR_EMAIL": "ada@example.com",
            "GIT_COMMITTER_NAME": "Ada",
            "GIT_COMMITTER_EMAIL": "ada@example.com",
            "GIT_AUTHOR_DATE": stamp,
            "GIT_COMMITTER_DATE": stamp,
            "GIT_EDITOR": ":",
            "GIT_PAGER": "cat",
            "LC_ALL": "C",
            "PYTHONIOENCODING": "utf-8",
        }
    )
    if extra:
        env.update(extra)
    return env


def tick() -> None:
    _tick[0] += 1


def reset_clock() -> None:
    _tick[0] = 0


def git(repo: Path, *args: str, check: bool = True, env: dict[str, str] | None = None) -> str:
    """Run `git <args>` in repo (bytes in and out, so a Windows pipe does not change line endings) and return stdout."""
    cmd = ["git", "-c", "core.autocrlf=false", "-c", "core.safecrlf=false", "-c", "init.defaultBranch=main", *args]
    done = subprocess.run(cmd, cwd=repo, env=_env(env), capture_output=True, check=False)
    out = done.stdout.decode("utf-8", errors="replace")
    err = done.stderr.decode("utf-8", errors="replace")
    if check and done.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed ({done.returncode}):\n{out}\n{err}")
    return out.rstrip("\n") if check else (out + err).rstrip("\n")


def git_rc(repo: Path, *args: str, env: dict[str, str] | None = None) -> tuple[int, str]:
    cmd = ["git", "-c", "core.autocrlf=false", "-c", "init.defaultBranch=main", *args]
    done = subprocess.run(cmd, cwd=repo, env=_env(env), capture_output=True, check=False)
    return done.returncode, (done.stdout + done.stderr).decode("utf-8", errors="replace").replace("\r\n", "\n").rstrip("\n")


def fresh(name: str) -> Path:
    path = LAB / name
    if path.exists():
        shutil.rmtree(path, onerror=_force_remove)
    path.mkdir(parents=True)
    return path


def _force_remove(func, path, _exc):
    os.chmod(path, 0o700)
    func(path)


def init(name: str, bare: bool = False) -> Path:
    repo = fresh(name)
    git(repo, "init", "--quiet", *(["--bare"] if bare else []))
    return repo


def write(root: Path, relative: str, text: str) -> Path:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(text.encode("utf-8"))
    return path


def commit_all(repo: Path, message: str) -> str:
    """Stage everything, commit it on the next minute of the clock and return the short id."""
    tick()
    git(repo, "add", "-A")
    git(repo, "commit", "--quiet", "-m", message)
    return git(repo, "rev-parse", "--short", "HEAD")


def run(cmd: list[str], cwd: Path | None = None, env: dict[str, str] | None = None, check: bool = False) -> tuple[int, str]:
    """Run any program and return (exit code, stdout plus stderr as text)."""
    full = dict(os.environ)
    full["PYTHONIOENCODING"] = "utf-8"
    if env:
        full.update(env)
    done = subprocess.run(cmd, cwd=cwd, env=full, capture_output=True, check=False)
    text = (done.stdout + done.stderr).decode("utf-8", errors="replace").replace("\r\n", "\n")
    if check and done.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd)} failed ({done.returncode}):\n{text}")
    return done.returncode, text.rstrip("\n")


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def docker(*args: str, check: bool = True) -> str:
    _, text = run(["docker", *args], check=check)
    return text


def docker_ok() -> bool:
    code, _ = run(["docker", "info"])
    return code == 0


def wait_until(predicate, timeout: float = 20.0, step: float = 0.2) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        try:
            if predicate():
                return True
        except Exception:
            pass
        time.sleep(step)
    return False


def check(label: str, ok: bool, detail: str = "") -> None:
    """Print one result line and stop loudly: the lessons quote these results."""
    print(f"  {'ok  ' if ok else 'FAIL'} {label}" + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        sys.exit(f"FAILED: {label} {detail}")


def show(title: str, text: str = "") -> None:
    print(f"\n$ {title}" if title else "")
    if text:
        print(text)


def save_json(name: str, data) -> Path:
    """Write the data of a lab next to the lab (site/src/components/labs/devops/<name>.json)."""
    target = HERE.parent.parent.parent / "site" / "src" / "components" / "labs" / "devops" / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  wrote {target.relative_to(HERE.parent.parent.parent)}")
    return target
