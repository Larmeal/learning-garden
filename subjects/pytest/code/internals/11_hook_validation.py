"""Lesson how-pytest-runs: pluggy checks a hook implementation against the hook specification."""

from _lab import project, run_sub

FILES = {
    "conftest.py": """
        def pytest_runtest_logfinish(nodeid, report):
            pass
    """,
    "test_a.py": "def test_a(): pass\n",
}
UNKNOWN = {
    "conftest.py": """
        def pytest_no_such_hook(config):
            pass
    """,
    "test_a.py": "def test_a(): pass\n",
}
SUBSET = {
    "conftest.py": """
        def pytest_runtest_logfinish(nodeid):
            print("LOGFINISH", nodeid)
    """,
    "test_a.py": "def test_a(): pass\n",
}

if __name__ == "__main__":
    with project(FILES) as root:
        code, out = run_sub(root, "-q")
    print(code, [l for l in out.splitlines() if "argument" in l or "Error" in l][:3])
    assert code == 1 and "Argument(s) {'report'} are declared in the hookimpl but can not be found in the hookspec" in out

    with project(UNKNOWN) as root:
        code, out = run_sub(root, "-q")
    print(code, [l for l in out.splitlines() if "hook" in l][:3])
    assert code == 3 and "unknown hook 'pytest_no_such_hook' in plugin" in out and "INTERNALERROR" in out

    with project(SUBSET) as root:
        code, out = run_sub(root, "-q", "-s")
    assert code == 0 and "LOGFINISH test_a.py::test_a" in out
    print("ok")
