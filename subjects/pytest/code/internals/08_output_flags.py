"""Lesson first-test, deep dive: the flags that change what a run prints. Each claim is checked against a real run."""

import re

from _lab import project, run_sub

FILES = {
    "test_flags.py": """
        import time

        def deep(n):
            local_total = n * 10
            return 1 // (n - 3)

        def test_ok():
            time.sleep(0.02)

        def test_zero_division():
            for n in range(5):
                deep(n)

        def test_assert():
            total = 30
            assert total == 31

        def test_third():
            assert True
    """,
}


def lines(out):
    return out.splitlines()


if __name__ == "__main__":
    with project(FILES) as root:
        _, default = run_sub(root)
        _, verbose = run_sub(root, "-v")
        _, quiet = run_sub(root, "-q")
        _, quieter = run_sub(root, "-qq")
        _, short = run_sub(root, "--tb=short")
        _, line = run_sub(root, "--tb=line")
        _, no = run_sub(root, "--tb=no")
        _, native = run_sub(root, "--tb=native")
        _, long = run_sub(root, "--tb=long")
        _, locs = run_sub(root, "-l", "--tb=short")
        _, dur = run_sub(root, "--durations=2", "-q")
        _, maxfail = run_sub(root, "--maxfail=1", "-q")
        _, x = run_sub(root, "-x", "-q")
        _, ra = run_sub(root, "-q", "-rfEs")
        code_q, _ = run_sub(root, "-q", "test_flags.py::test_ok")

    print("-v           :", [l for l in lines(verbose) if "PASSED" in l or "FAILED" in l][:2])
    print("-q           :", lines(quiet)[0], "...", lines(quiet)[-1])
    print("-qq          :", lines(quieter)[-1])

    # -v prints one line per test with the node id
    assert any(l.startswith("test_flags.py::test_ok PASSED") for l in lines(verbose))
    # -q drops the header, -qq also drops the closing "N failed, N passed" line
    assert "test session starts" in default and "test session starts" not in quiet
    assert lines(quiet)[-1].startswith("2 failed, 2 passed")
    assert not any("passed in" in l for l in lines(quieter)) and lines(quieter)[-1].startswith("FAILED")

    # --tb styles: the report shrinks from long to no
    sizes = {name: len(lines(text)) for name, text in [("long", long), ("short", short), ("line", line), ("no", no)]}
    print("lines by --tb:", sizes)
    assert sizes["long"] > sizes["short"] > sizes["line"] > sizes["no"]
    assert any(l.startswith("E ") for l in lines(long))
    assert "Traceback (most recent call last)" in native
    # --tb=line: the E line and one location line per failure
    assert any(l.endswith("test_flags.py:5: ZeroDivisionError: division by zero") for l in lines(line))
    # --tb=no: no FAILURES section at all
    assert "FAILURES" not in no and "FAILED test_flags.py::test_assert" in no

    # -l shows the local variables of each frame (here: n in the test, local_total and n in deep)
    assert "local_total = 30" in locs and "total      = 30" in locs

    # --durations lists the slowest calls; durations under 0.005s are hidden and counted
    assert "slowest 2 durations" in dur and "call     test_flags.py::test_ok" in dur and "durations < 0.005s hidden" in dur
    # --maxfail=N and -x stop the run after the Nth failure
    assert "stopping after 1 failures" in maxfail and lines(maxfail)[-1].startswith("1 failed, 1 passed")
    assert lines(x)[-1].startswith("1 failed, 1 passed")
    # -r chooses which outcomes get a line in the short summary: f failed, E error, s skipped, ...
    assert "FAILED test_flags.py::test_assert" in ra and "FAILED test_flags.py::test_zero_division" in ra
    print("ok")
