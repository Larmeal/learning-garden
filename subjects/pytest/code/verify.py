"""Runs every exercise and demo with Pytest and checks the outcome the lessons state.

Exercises must pass (some tests are skipped or xfailed on purpose). Demos fail on purpose, so each has an expected
count of failures. The command-line checks (-k, -m, -x, --lf, -n, --cov, ...) back the "project" lesson.

Run: uv run python verify.py          (add --show to print the output of the command-line checks)
"""

import re
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).parent
SHOW = "--show" in sys.argv
KINDS = ("passed", "failed", "skipped", "xfailed", "xpassed", "error", "errors", "warnings")


def pytest(*args: str, cache: str | None = None) -> tuple[int, str, dict[str, int]]:
    cmd = [sys.executable, "-m", "pytest", "--color=no", "-p", "no:cacheprovider" if cache is None else "cacheprovider", *args]
    if cache is not None:
        cmd += ["-o", f"cache_dir={cache}"]
    done = subprocess.run(cmd, cwd=HERE, capture_output=True, text=True, encoding="utf-8")
    out = done.stdout + done.stderr
    counts: dict[str, int] = {}
    last = [l for l in out.splitlines() if re.search(r"\d+ (passed|failed|skipped|xfailed|xpassed|error|errors|deselected)", l)]
    if last:
        for n, kind in re.findall(r"(\d+) (\w+)", last[-1]):
            counts[{"errors": "error", "warnings": "warning"}.get(kind, kind)] = int(n)
    return done.returncode, out, counts


problems: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'} {label}" + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        problems.append(label)


def expect(label: str, args: list[str], want: dict[str, int], code: int, cache: str | None = None) -> str:
    rc, out, got = pytest(*args, cache=cache)
    want = {k: v for k, v in want.items() if v}
    check(f"{label}: {want}", got == want and rc == code, f"got {got}, exit {rc}")
    if SHOW:
        print(out)
    return out


print("Exercises (all must pass)")
EXERCISES = {
    "01_first_test": {"passed": 6},
    "02_assertions/test_assertions.py": {"passed": 13},
    "02_assertions/test_assertions_in_depth.py": {"passed": 19},
    "03_fixtures/test_fixtures.py": {"passed": 12},
    "03_fixtures/nested": {"passed": 2},
    "03_fixtures/test_fixtures_in_depth.py": {"passed": 15},
    "04_parametrize/test_parametrize.py": {"passed": 21, "xfailed": 1},
    "04_parametrize/test_parametrize_in_depth.py": {"passed": 21},
    "05_markers/test_markers.py": {"passed": 6, "skipped": 2, "xfailed": 2},
    "05_markers/test_marks_in_depth.py": {"passed": 11, "skipped": 1, "xfailed": 3},
    "06_isolation/test_isolation.py": {"passed": 13},
    "06_isolation/test_mocking_in_depth.py": {"passed": 16},
    "08_design/test_design.py": {"passed": 12},
    "08_design/test_smells.py": {"passed": 12},
    "09_plugins": {"passed": 9},
}
for name, want in EXERCISES.items():
    expect(name, [f"exercises/{name}"], want, 0)

print("\nDemos (fail on purpose)")
DEMOS = {
    "01_failures": ({"failed": 3, "error": 1}, 1),
    "03_teardown": ({"failed": 1, "passed": 1}, 1),
    "02_assertions": ({"failed": 5}, 1),
    "04_one_row_fails": ({"failed": 1, "passed": 2}, 1),
    "05_markers": ({"failed": 1, "passed": 1, "warning": 1}, 1),
    "08_order_dependent": ({"passed": 2}, 0),
}
for name, (want, code) in DEMOS.items():
    expect(name, [f"demos/{name}"], want, code)
expect("08_order_dependent, only test_total", ["demos/08_order_dependent/test_shared_state.py::test_total"], {"failed": 1}, 1)


print("\nFiles that are not collected")
rc, out, _ = pytest("--collect-only", "-q", "exercises/01_first_test")
check("cart_extra.py is not collected", "cart_extra" not in out and "check_total_is_ten" not in out)
check("6 tests collected", "6 tests collected" in out, out.splitlines()[-1] if out else "")

rc, out, _ = pytest("-o", "pythonpath=", "exercises/01_first_test")
check("without pythonpath = ['src'] the import of shop fails", rc != 0 and "No module named 'shop'" in out, out[-200:])
expect("a plain run of the whole project (testpaths)", [], {"passed": 188, "skipped": 3, "xfailed": 6}, 0)

print("\nCommand-line checks")
expect("-m 'not slow'", ["-m", "not slow", "exercises/05_markers/test_markers.py"], {"passed": 4, "skipped": 2, "xfailed": 2, "deselected": 2}, 0)
expect("-m slow", ["-m", "slow", "exercises/05_markers/test_markers.py"], {"passed": 2, "deselected": 8}, 0)
expect("-m 'slow and integration'", ["-m", "slow and integration", "exercises/05_markers/test_markers.py"], {"passed": 1, "deselected": 9}, 0)
expect("-k coupon", ["-k", "coupon", "exercises/04_parametrize/test_parametrize.py"], {"passed": 3, "deselected": 19}, 0)
expect("node id", ["exercises/03_fixtures/test_fixtures.py::test_save_and_load_with_tmp_path"], {"passed": 1}, 0)
expect("-x stops at the first failure", ["-x", "demos/01_failures"], {"failed": 1}, 1)
expect("-n 2 (xdist)", ["-n", "2", "exercises/04_parametrize/test_parametrize.py"], {"passed": 21, "xfailed": 1}, 0)

out = ""
rc, out, _ = pytest("--strict-markers", "demos/05_markers")
check("--strict-markers rejects 'slwo'", rc != 0 and "'slwo' not found in `markers`" in out, out[-200:])

with tempfile.TemporaryDirectory() as cache:
    pytest("demos/01_failures", cache=cache)
    expect("--lf reruns the failures and the error", ["--lf", "demos/01_failures"], {"failed": 3, "error": 1}, 1, cache=cache)
    expect("--ff runs failures first", ["--ff", "-q", "demos/01_failures"], {"failed": 3, "error": 1}, 1, cache=cache)

rc, out, _ = pytest("--setup-show", "exercises/03_fixtures/test_fixtures.py::test_first_user_of_the_fixtures")
want = ["SETUP    M connection", "SETUP    F transaction (fixtures used: connection)", "TEARDOWN F transaction"]
check("--setup-show lists scope letters", all(w in out for w in want), out[-400:])
if SHOW:
    print(out)

rc, out, _ = pytest("--cov=shop", "--cov-report=term-missing", "exercises")
rows = {l.split()[0]: l for l in out.splitlines() if l.startswith("src")}
check("coverage: only line 21 of pricing.py is never run, cart.py is complete",
      rows[r"src\shop\cart.py"].split()[-1] == "100%" and rows[r"src\shop\pricing.py"].rstrip().endswith("21"), str(rows))
if SHOW:
    print(out)

print("\nInternals scripts (each asserts what its lesson states)")
for script in sorted((HERE / "internals").glob("[0-9][0-9]_*.py")):
    done = subprocess.run([sys.executable, str(script)], cwd=HERE / "internals", capture_output=True, text=True, encoding="utf-8")
    check(script.name, done.returncode == 0 and done.stdout.strip().splitlines()[-1].startswith("ok"), (done.stderr or done.stdout)[-300:])

print()
if problems:
    print(f"{len(problems)} check(s) failed")
    sys.exit(1)
print("all checks passed")
