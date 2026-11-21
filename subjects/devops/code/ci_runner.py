"""A very small CI server, used by exercises 02 and 13.

It is what the lessons call "the runner": git calls it from the `post-receive` hook of a bare repository, it checks the pushed
commit out into a clean workspace, reads `pipeline.toml` from that commit (pipeline as code), runs the stages in order and
stops at the first one that fails. It writes `<ci_dir>/results/<sha>.json` and copies what the build stage leaves in `dist/`
to `<ci_dir>/artifacts/`. Standard library only.

Usage: python ci_runner.py <bare repository> <commit sha> <ci folder>
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
import tomllib
from pathlib import Path


def run_pipeline(bare: Path, sha: str, ci_dir: Path, extra_env: dict[str, str] | None = None, quiet: bool = False) -> dict:
    ci_dir.mkdir(parents=True, exist_ok=True)
    work = ci_dir / "workspace" / sha[:7]
    if work.exists():
        shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True)
    env = dict(os.environ)
    for key in [k for k in env if k.startswith("GIT_")]:
        del env[key]
    archive = subprocess.run(["git", "--git-dir", str(bare), "archive", "--format=tar", sha], capture_output=True, env=env)
    if archive.returncode != 0:
        raise RuntimeError(archive.stderr.decode())
    subprocess.run(["tar", "-x", "-C", str(work)], input=archive.stdout, check=True, env=env)

    def say(text: str) -> None:
        if not quiet:
            print(text, flush=True)

    result: dict = {"sha": sha, "stages": [], "status": "passed"}
    spec_file = work / "pipeline.toml"
    if not spec_file.exists():
        result["status"] = "no pipeline"
        say(f"[ci] {sha[:7]} has no pipeline.toml")
    else:
        spec = tomllib.loads(spec_file.read_text(encoding="utf-8"))
        say(f"[ci] {sha[:7]}: {len(spec['stage'])} stages from pipeline.toml")
        failed = False
        for stage in spec["stage"]:
            name = stage["name"]
            if failed:
                result["stages"].append({"name": name, "status": "skipped", "seconds": 0.0})
                say(f"[ci]   {name:14} skipped")
                continue
            command = stage["run"]
            if command.startswith("python "):
                command = f'"{Path(sys.executable).as_posix()}" ' + command[len("python "):]
            started = time.time()
            stage_env = dict(env)
            stage_env.update({"CI_SHA": sha, "CI_SHORT_SHA": sha[:7], "PYTHONIOENCODING": "utf-8"})
            if extra_env:
                stage_env.update(extra_env)
            done = subprocess.run(command, shell=True, cwd=work, env=stage_env, capture_output=True)
            seconds = round(time.time() - started, 2)
            text = (done.stdout + done.stderr).decode("utf-8", errors="replace").strip()
            status = "passed" if done.returncode == 0 else "failed"
            result["stages"].append({"name": name, "status": status, "seconds": seconds, "log": text[-400:]})
            say(f"[ci]   {name:14} {status}")
            if status == "failed":
                failed = True
                result["status"] = "failed"
                last = text.splitlines()[-1] if text else ""
                say(f"[ci]   -> {last}")
        dist = work / "dist"
        if result["status"] == "passed" and dist.exists():
            (ci_dir / "artifacts").mkdir(exist_ok=True)
            for item in dist.iterdir():
                shutil.copy2(item, ci_dir / "artifacts" / item.name)
                result.setdefault("artifacts", []).append(item.name)
    (ci_dir / "results").mkdir(exist_ok=True)
    (ci_dir / "results" / f"{sha}.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    say(f"[ci] {sha[:7]} {result['status']}")
    return result


if __name__ == "__main__":
    bare_path, commit, ci = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
    run_pipeline(bare_path, commit, ci)
