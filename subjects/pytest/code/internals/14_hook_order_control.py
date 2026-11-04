"""Lesson plugins: who runs first. Registration order, tryfirst/trylast, wrappers, and what a firstresult hook does."""

import pytest

from _lab import project, run

TESTS = {"test_a.py": "def test_a(): pass\n"}
CALLS: list[str] = []


def mk(name, **opts):
    class P:
        pass

    def impl(self, session):
        CALLS.append(name)

    P.__name__ = name
    P.pytest_sessionstart = pytest.hookimpl(**opts)(impl) if opts else impl
    return P()


class Wrapper:
    @pytest.hookimpl(wrapper=True)
    def pytest_sessionstart(self, session):
        CALLS.append("wrapper before")
        yield
        CALLS.append("wrapper after")


class First:
    """pytest_collection is firstresult: the first implementation that returns something other than None wins."""

    @pytest.hookimpl(tryfirst=True)
    def pytest_ignore_collect(self, collection_path):
        CALLS.append(f"ignore_collect asked about {collection_path.name}")
        return True if collection_path.name == "test_a.py" else None


def go(*plugins):
    CALLS.clear()
    with project(TESTS) as root:
        code, out = run(root, "-q", plugins=list(plugins))
    return code, out, list(CALLS)


if __name__ == "__main__":
    code, out, calls = go(mk("one"), mk("two"))
    print("registration order  :", calls)
    # plugins registered later are called first (pluggy calls implementations in LIFO order)
    assert calls == ["two", "one"]

    code, out, calls = go(mk("one", tryfirst=True), mk("two"))
    print("one is tryfirst     :", calls)
    assert calls == ["one", "two"]

    code, out, calls = go(mk("one", trylast=True), mk("two"))
    print("one is trylast      :", calls)
    assert calls == ["two", "one"]

    code, out, calls = go(mk("one"), Wrapper(), mk("two"))
    print("with a wrapper      :", calls)
    assert calls == ["wrapper before", "two", "one", "wrapper after"]

    code, out, calls = go(First())
    print("firstresult hook    :", calls, "| exit code", code, "|", out.strip().splitlines()[-1])
    assert code == 5 and calls == ["ignore_collect asked about test_a.py"]
    assert "no tests ran" in out
    print("ok")
