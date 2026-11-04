"""Lesson run-protocol: what each phase reports, and how a failure in one phase changes the others."""

from _lab import project, run

FILES = {
    "conftest.py": """
        import pytest

        @pytest.fixture
        def bad_setup():
            raise RuntimeError("setup blew up")

        @pytest.fixture
        def bad_teardown():
            yield
            raise RuntimeError("teardown blew up")
    """,
    "test_phases.py": """
        import pytest

        def test_pass(): ...

        def test_fail():
            assert 1 == 2

        def test_setup_error(bad_setup): ...

        def test_teardown_error(bad_teardown): ...

        def test_skip():
            pytest.skip("not today")

        @pytest.mark.skip(reason="marked")
        def test_marked_skip(): ...

        @pytest.mark.xfail(reason="known")
        def test_xfail():
            assert False

        @pytest.mark.xfail(reason="fixed already")
        def test_xpass(): ...

        @pytest.mark.xfail(strict=True, reason="strict")
        def test_xpass_strict(): ...
    """,
}


class Reports:
    def __init__(self):
        self.rows = []

    def pytest_runtest_logreport(self, report):
        self.rows.append(
            (report.nodeid.split("::")[-1], report.when, report.outcome, getattr(report, "wasxfail", None), report.skipped, report.failed)
        )

    def table(self):
        out = {}
        for name, when, outcome, wasxfail, *_ in self.rows:
            out.setdefault(name, []).append(f"{when}:{outcome}" + (f"(xfail:{wasxfail})" if wasxfail is not None else ""))
        return out


if __name__ == "__main__":
    rep = Reports()
    with project(FILES) as root:
        code, out = run(root, "-q", "-rA", plugins=[rep])
    table = rep.table()
    for name, phases in table.items():
        print(f"{name:20s} {' '.join(phases)}")
    print()
    print(out.splitlines()[-1])

    assert code == 1
    assert table["test_pass"] == ["setup:passed", "call:passed", "teardown:passed"]
    assert table["test_fail"] == ["setup:passed", "call:failed", "teardown:passed"]
    # a failing setup means the call phase never happens
    assert table["test_setup_error"] == ["setup:failed", "teardown:passed"]
    # a failing teardown is its own report, after a passing call
    assert table["test_teardown_error"] == ["setup:passed", "call:passed", "teardown:failed"]
    # skip raised inside the test is reported in the call phase; the mark is evaluated in the setup phase
    assert table["test_skip"][:2] == ["setup:passed", "call:skipped"]
    assert table["test_marked_skip"][0] == "setup:skipped"
    # xfail turns the outcome around in the report, and remembers why
    assert table["test_xfail"][1].startswith("call:skipped") and "xfail:known" in table["test_xfail"][1]
    assert table["test_xpass"][1] == "call:passed(xfail:fixed already)"
    assert table["test_xpass_strict"][1] == "call:failed"
    # setup and teardown failures count as errors, a failed call counts as a failure
    assert "2 failed, 2 passed, 2 skipped, 1 xfailed, 1 xpassed, 2 errors" in out.splitlines()[-1]
    print("ok")
