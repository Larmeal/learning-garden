"""Lesson assertion-rewriting: what pytest does to an assert, which modules it touches, and what it leaves alone."""

import ast
from pathlib import Path

from _pytest.assertion.rewrite import PYTEST_TAG, rewrite_asserts

from _lab import project, run_sub

SOURCE = "def test_total(cart):\n    assert cart.total() == 31\n"


def show_rewrite() -> str:
    tree = ast.parse(SOURCE)
    rewrite_asserts(tree, SOURCE.encode(), "test_total.py", None)
    return ast.unparse(tree)


FILES = {
    "helpers.py": """
        def check_total(got, want):
            assert got == want
    """,
    "test_modes.py": """
        from helpers import check_total

        def test_in_test_file():
            x = {"a": 1}
            assert x == {"a": 2}

        def test_in_helper():
            check_total(1, 2)
    """,
    "conftest_marker.py": "",
}

REGISTERED = {
    "helpers.py": FILES["helpers.py"],
    "conftest.py": """
        import pytest
        pytest.register_assert_rewrite("helpers")
    """,
    "test_modes.py": FILES["test_modes.py"],
}

DONT = {
    "test_dont.py": '''
        """PYTEST_DONT_REWRITE"""

        def test_x():
            x = {"a": 1}
            assert x == {"a": 2}
    ''',
}


def failure_lines(out: str) -> dict[str, list[str]]:
    """The 'E' lines of each failed test."""
    res: dict[str, list[str]] = {}
    current = None
    for line in out.splitlines():
        if line.startswith("____"):
            current = line.strip("_ ")
            res[current] = []
        elif line.startswith("E ") and current:
            res[current].append(line[1:].strip())
    return res


if __name__ == "__main__":
    print("--- the rewritten module ---")
    rewritten = show_rewrite()
    print(rewritten)
    assert "@py_builtins" in rewritten and "@pytest_ar._call_reprcompare" in rewritten
    assert "@py_assert" in rewritten
    assert "raise AssertionError(@pytest_ar._format_explanation" in rewritten

    with project(FILES) as root:
        _, rewritten_out = run_sub(root, "-q")
        _, plain_out = run_sub(root, "-q", "--assert=plain")
        pyc = sorted(p.name for p in (root / "__pycache__").glob("*.pyc"))
    print("--- default (rewrite) ---")
    print(failure_lines(rewritten_out))
    print("--- --assert=plain ---")
    print(failure_lines(plain_out))
    r = failure_lines(rewritten_out)
    p = failure_lines(plain_out)
    # a test file is rewritten: the dict diff is explained
    assert any("Differing items" in l for l in r["test_in_test_file"])
    # a helper module is not: only the bare AssertionError reaches the report
    assert r["test_in_helper"] == ["AssertionError"], r["test_in_helper"]
    # with --assert=plain nothing is rewritten, not even the test file
    assert p["test_in_test_file"] == ["AssertionError"], p["test_in_test_file"]
    print("--- .pyc files written ---", pyc)
    assert f"test_modes.{PYTEST_TAG}.pyc" in pyc and not any(n.startswith("helpers.cpython") and "pytest" in n for n in pyc)

    with project(REGISTERED) as root:
        _, out = run_sub(root, "-q")
    r2 = failure_lines(out)
    print("--- helper registered with register_assert_rewrite ---")
    print(r2)
    assert any("assert 1 == 2" in l for l in r2["test_in_helper"])

    with project(DONT) as root:
        _, out = run_sub(root, "-q")
    r3 = failure_lines(out)
    print("--- PYTEST_DONT_REWRITE in the module docstring ---")
    print(r3)
    assert r3["test_x"] == ["AssertionError"]
    print("ok", PYTEST_TAG)
