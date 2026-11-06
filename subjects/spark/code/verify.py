"""Run every Spark exercise and report which ones pass.

    uv run python verify.py              # all exercises
    uv run python verify.py 06 09        # only the numbers given

Each exercise asserts the numbers and plan shapes that its lesson prints, so a green run means the lessons still match
the installed Spark. Exercises 01 to 05 and 09 to 12 re-launch themselves in WSL when started on Windows (see
run_wsl.sh for the one-time setup); 06, 07, 08 and 13 run in the local environment. A full run takes about 20 minutes.
"""

import glob
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
# Run by 07_performance_tuning.py with an argument, not on its own.
HELPERS = {"07b_jvm_limits.py"}


def main():
    wanted = set(sys.argv[1:])
    scripts = sorted(glob.glob(os.path.join(HERE, "exercises", "[0-9][0-9]*_*.py")))
    results = []
    for path in scripts:
        name = os.path.basename(path)
        if name in HELPERS:
            continue
        if wanted and name[:2] not in wanted:
            continue
        start = time.time()
        proc = subprocess.run([sys.executable, path], capture_output=True, text=True, timeout=1800)
        # Spark on Windows prints "SUCCESS: The process ... terminated" lines after the exercise ends,
        # so look for the "ok" line itself instead of the end of the output.
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
