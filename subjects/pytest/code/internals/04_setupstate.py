"""Lesson fixture-engine: SetupState decides when a fixture is torn down, and fixture names are sorted by scope."""

from _lab import project, run

FILES = {
    "conftest.py": """
        import pytest

        LOG = []

        @pytest.fixture(scope="session")
        def db():
            LOG.append("setup db")
            yield "db"
            LOG.append("teardown db")

        @pytest.fixture(scope="module")
        def conn(db):
            LOG.append("setup conn")
            yield "conn"
            LOG.append("teardown conn")

        @pytest.fixture
        def tx(conn):
            LOG.append("setup tx")
            yield "tx"
            LOG.append("teardown tx")

        @pytest.fixture(autouse=True)
        def mark(request):
            LOG.append(f"start {request.node.name}")
            yield
            LOG.append(f"end {request.node.name}")
    """,
    "test_a.py": """
        def test_a1(tx): ...
        def test_a2(tx): ...
    """,
    "test_b.py": """
        def test_b1(tx): ...
    """,
}


class Spy:
    def __init__(self):
        self.stacks = {}
        self.closures = {}
        self.log = None

    def pytest_runtest_call(self, item):
        self.stacks[item.name] = [type(n).__name__ + ":" + (n.name or "") for n in item.session._setupstate.stack]
        self.closures[item.name] = list(item.fixturenames)

    def pytest_sessionfinish(self, session):
        import sys

        self.log = list(sys.modules["conftest"].LOG)


if __name__ == "__main__":
    spy = Spy()
    with project(FILES) as root:
        code, out = run(root, "-q", plugins=[spy])
    print(out)
    for name in spy.stacks:
        print(name, "stack:", spy.stacks[name])
    print("closure of test_a1:", spy.closures["test_a1"])
    print()
    for line in spy.log:
        print(" ", line)

    assert code == 0
    # the stack holds the session, the directory, the module and the item while a test runs
    assert [s.split(":")[0] for s in spy.stacks["test_a1"]] == ["Session", "Dir", "Module", "Function"]
    # fixture names are sorted from the widest scope to the narrowest; the autouse fixture comes before tx
    assert spy.closures["test_a1"] == ["db", "conn", "mark", "request", "tx"], spy.closures["test_a1"]
    log = spy.log
    # session fixture: set up once, torn down last
    assert log.count("setup db") == 1 and log[-1] == "teardown db"
    # module fixture: one per module (two modules)
    assert log.count("setup conn") == 2 and log.count("teardown conn") == 2
    # teardown runs in the reverse order of setup: tx goes before the autouse "end", which was set up first
    k = log.index("start test_a1")
    assert log[k : k + 4] == ["start test_a1", "setup tx", "teardown tx", "end test_a1"]
    # the module fixture is torn down during the teardown of the LAST item of the module (nextitem is in another module)
    i = log.index("end test_a2")
    assert log[i : i + 3] == ["end test_a2", "teardown conn", "setup conn"], log[i : i + 3]
    assert log.index("teardown conn") < log.index("start test_b1")
    # between a1 and a2 the module fixture stays alive
    j = log.index("end test_a1")
    assert "teardown conn" not in log[j : log.index("start test_a2")]
    print("\nok")
