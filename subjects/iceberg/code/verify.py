"""Run every Iceberg exercise and report which ones pass.

    uv run python verify.py              # all exercises
    uv run python verify.py 01 03        # only the numbers given

Each exercise asserts the numbers and file layouts that its lesson prints, so a green run means the lessons still match
Spark 4.1.3, Iceberg 1.12.0 and PyIceberg 0.12.0. On Windows each exercise re-launches itself in WSL (see run_wsl.sh for the
one-time setup). The first thing checked is the version of every piece, so a changed pin shows up before any exercise runs.
"""

import glob
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
PINS = {"pyspark": "4.1.3", "pyiceberg": "0.12.0"}
ICEBERG_JAR = "iceberg-spark-runtime-4.1_2.13-1.12.0.jar"


def check_versions():
    """Only possible where the packages are installed (inside WSL); on Windows the exercises check themselves."""
    if os.name == "nt":
        return
    from importlib.metadata import version

    for pkg, want in PINS.items():
        got = version(pkg)
        assert got == want, f"{pkg} is {got}, the lessons were written with {want}"
    assert os.path.exists(os.path.expanduser("~/iceberg-lab/jars/" + ICEBERG_JAR)), "missing " + ICEBERG_JAR


def main():
    check_versions()
    wanted = set(sys.argv[1:])
    scripts = sorted(glob.glob(os.path.join(HERE, "exercises", "[0-9][0-9]*_*.py")))
    results = []
    for path in scripts:
        name = os.path.basename(path)
        if wanted and name[:2] not in wanted:
            continue
        start = time.time()
        proc = subprocess.run([sys.executable, path], capture_output=True, text=True, timeout=1800)
        lines = [line.strip() for line in proc.stdout.replace("\x00", "").splitlines()]
        ok = proc.returncode == 0 and "ok" in lines
        results.append((name, ok))
        print(f"{'PASS' if ok else 'FAIL'}  {name}  {time.time() - start:5.0f}s", flush=True)
        if not ok:
            print((proc.stdout + proc.stderr).replace("\x00", "")[-1500:], flush=True)
    failed = [name for name, ok in results if not ok]
    print(f"\n{len(results) - len(failed)} of {len(results)} exercises passed")
    if failed:
        print("failed:", ", ".join(failed))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
