"""Shared helpers for the Git exercises.

Every exercise builds a throwaway repository under the system temp folder with a fixed identity, fixed dates
and no user or system configuration, so the object ids that the lessons print are the same on every machine.
Only the standard library is used: the exercises call the real `git` program and assert what it prints.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

LAB = Path(tempfile.gettempdir()) / "git-lab"

# One clock for the whole exercise: every commit and tag gets the next minute, so ids repeat.
_tick = [0]


def _env(extra: dict[str, str] | None = None) -> dict[str, str]:
    env = dict(os.environ)
    for key in [k for k in env if k.startswith("GIT_")]:
        del env[key]
    minute = _tick[0]
    stamp = f"2026-01-01T10:{minute // 60:02d}:{minute % 60:02d} +0000"
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
        }
    )
    if extra:
        env.update(extra)
    return env


def tick() -> None:
    """Move the clock one step forward (call it between two commits that must get different times)."""
    _tick[0] += 1


def reset_clock() -> None:
    _tick[0] = 0


def git(repo: Path, *args: str, check: bool = True, env: dict[str, str] | None = None, stdin: str | None = None) -> str:
    """Run `git <args>` inside repo and return stdout without the trailing newline."""
    cmd = ["git", "-c", "core.autocrlf=false", "-c", "core.safecrlf=false", "-c", "init.defaultBranch=main", *args]
    # Bytes in and out: text mode would turn \n into \r\n on Windows and change the ids.
    done = subprocess.run(
        cmd,
        cwd=repo,
        env=_env(env),
        input=None if stdin is None else stdin.encode("utf-8"),
        capture_output=True,
        check=False,
    )
    out = done.stdout.decode("utf-8", errors="replace")
    err = done.stderr.decode("utf-8", errors="replace")
    if check and done.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed ({done.returncode}):\n{out}\n{err}")
    return out.rstrip("\n") if check else (out + err).rstrip("\n")


def git_rc(repo: Path, *args: str) -> tuple[int, str]:
    """Run git and return (exit code, stdout plus stderr), for commands that are expected to fail."""
    cmd = ["git", "-c", "core.autocrlf=false", "-c", "init.defaultBranch=main", *args]
    done = subprocess.run(cmd, cwd=repo, env=_env(), capture_output=True, check=False)
    text = (done.stdout + done.stderr).decode("utf-8", errors="replace")
    return done.returncode, text.rstrip("\n")


def fresh(name: str, bare: bool = False) -> Path:
    """An empty folder for one exercise. Removes what an earlier run left."""
    path = LAB / name
    if path.exists():
        shutil.rmtree(path, onerror=_force_remove)
    path.mkdir(parents=True)
    return path


def _force_remove(func, path, _exc):  # Git marks object files read-only, which Windows refuses to delete
    os.chmod(path, 0o700)
    func(path)


def init(name: str, bare: bool = False) -> Path:
    repo = fresh(name)
    git(repo, "init", "--quiet", *(["--bare"] if bare else []))
    return repo


def write(repo: Path, relative: str, text: str) -> Path:
    """Write a text file with LF line endings and no conversion."""
    path = repo / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(text.encode("utf-8"))
    return path


def commit(repo: Path, message: str, *flags: str) -> str:
    """Commit what is staged on a new minute of the clock and return the short id."""
    tick()
    git(repo, "commit", "--quiet", "-m", message, *flags)
    return git(repo, "rev-parse", "--short", "HEAD")


def save(repo: Path, relative: str, text: str, message: str) -> str:
    """Write one file, stage it and commit it."""
    write(repo, relative, text)
    git(repo, "add", relative)
    return commit(repo, message)


def check(label: str, ok: bool, detail: str = "") -> None:
    """Print one result line and fail loudly, because the lessons quote these results."""
    print(f"  {'ok  ' if ok else 'FAIL'} {label}" + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        sys.exit(f"FAILED: {label} {detail}")


def show(title: str, text: str) -> None:
    print(f"\n$ {title}" if title else "")
    if text:
        print(text)
