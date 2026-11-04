"""Helpers shared by the internals demos: build a throwaway project, run pytest in this process, capture the output."""

import contextlib
import io
import tempfile
from pathlib import Path
from textwrap import dedent

import pytest


def make_project(root: Path, files: dict[str, str]) -> Path:
    for name, text in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(dedent(text).lstrip("\n"), encoding="utf-8")
    return root


def run(root: Path, *args: str, plugins=()) -> tuple[int, str]:
    """Run pytest inside this process on `root` and return (exit code, text printed)."""
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
        code = pytest.main(["--rootdir", str(root), "-p", "no:cacheprovider", "--color=no", *args, str(root)], plugins=list(plugins))
    return int(code), buf.getvalue()


@contextlib.contextmanager
def project(files: dict[str, str]):
    with tempfile.TemporaryDirectory() as tmp:
        yield make_project(Path(tmp), files)


def run_sub(root: Path, *args: str, env: dict | None = None) -> tuple[int, str]:
    """Run pytest in a fresh interpreter with `root` as the working directory (no state shared with this process)."""
    import os
    import subprocess
    import sys

    full_env = {k: v for k, v in os.environ.items() if k != "PYTEST_ADDOPTS"}
    full_env.update(env or {})
    done = subprocess.run(
        [sys.executable, "-m", "pytest", "--color=no", *args],
        cwd=root, capture_output=True, text=True, encoding="utf-8", env=full_env,
    )
    return done.returncode, done.stdout + done.stderr
