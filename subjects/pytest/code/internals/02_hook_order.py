"""Lesson how-pytest-runs: the order in which pytest calls hooks for a run of two tests.

A plugin object records the hooks it implements. pluggy passes a hook only the arguments named in the signature of the
implementation, so each method names exactly what it wants to see.
"""

from _lab import project, run

TESTS = {
    "test_a.py": """
        def test_one():
            assert True

        def test_two():
            assert True
    """,
}


class Recorder:
    def __init__(self):
        self.calls: list[str] = []

    def add(self, text):
        self.calls.append(text)

    def pytest_sessionstart(self, session):
        self.add("pytest_sessionstart")

    def pytest_collectstart(self, collector):
        self.add(f"pytest_collectstart {type(collector).__name__}")

    def pytest_make_collect_report(self, collector):
        self.add(f"pytest_make_collect_report {type(collector).__name__}")

    def pytest_collectreport(self, report):
        self.add(f"pytest_collectreport {report.nodeid or 'session'}")

    def pytest_itemcollected(self, item):
        self.add(f"pytest_itemcollected {item.name}")

    def pytest_collection_modifyitems(self, items):
        self.add(f"pytest_collection_modifyitems {len(items)} items")

    def pytest_collection_finish(self, session):
        self.add("pytest_collection_finish")

    def pytest_runtestloop(self, session):
        self.add("pytest_runtestloop")

    def pytest_runtest_logstart(self, nodeid):
        self.add(f"pytest_runtest_logstart {nodeid.split('::')[-1]}")

    def pytest_runtest_setup(self, item):
        self.add(f"pytest_runtest_setup {item.name}")

    def pytest_runtest_call(self, item):
        self.add(f"pytest_runtest_call {item.name}")

    def pytest_runtest_teardown(self, item, nextitem):
        self.add(f"pytest_runtest_teardown {item.name} nextitem={nextitem.name if nextitem else None}")

    def pytest_runtest_makereport(self, item, call):
        self.add(f"pytest_runtest_makereport {item.name} when={call.when}")

    def pytest_runtest_logreport(self, report):
        self.add(f"pytest_runtest_logreport {report.nodeid.split('::')[-1]} {report.when} {report.outcome}")

    def pytest_runtest_logfinish(self, nodeid):
        self.add(f"pytest_runtest_logfinish {nodeid.split('::')[-1]}")

    def pytest_sessionfinish(self, session, exitstatus):
        self.add(f"pytest_sessionfinish exitstatus={int(exitstatus)}")

    def pytest_terminal_summary(self, terminalreporter):
        self.add("pytest_terminal_summary")


def names(calls):
    return [c.split()[0] for c in calls]


if __name__ == "__main__":
    rec = Recorder()
    with project(TESTS) as root:
        code, out = run(root, "-q", plugins=[rec])
    for i, line in enumerate(rec.calls, 1):
        print(f"{i:2d}  {line}")

    n = names(rec.calls)
    assert code == 0
    # three stages: collect, run, finish
    assert n.index("pytest_sessionstart") < n.index("pytest_collectstart") < n.index("pytest_collection_modifyitems")
    assert n.index("pytest_collection_modifyitems") < n.index("pytest_collection_finish") < n.index("pytest_runtestloop")
    assert n.index("pytest_runtestloop") < n.index("pytest_runtest_logstart") < n.index("pytest_sessionfinish")
    # the whole collection tree is collected before the first test runs
    assert n.count("pytest_itemcollected") == 2 and n.index("pytest_collection_finish") < n.index("pytest_runtest_setup")
    # one logstart / logfinish pair and three reports per test
    assert n.count("pytest_runtest_logstart") == n.count("pytest_runtest_logfinish") == 2
    assert n.count("pytest_runtest_makereport") == n.count("pytest_runtest_logreport") == 6
    # for each test: setup, call, teardown, each followed by its report
    start = rec.calls.index("pytest_runtest_logstart test_one")
    stop = rec.calls.index("pytest_runtest_logfinish test_one")
    assert [c.split()[0] for c in rec.calls[start : stop + 1]] == [
        "pytest_runtest_logstart", "pytest_runtest_setup", "pytest_runtest_makereport", "pytest_runtest_logreport",
        "pytest_runtest_call", "pytest_runtest_makereport", "pytest_runtest_logreport",
        "pytest_runtest_teardown", "pytest_runtest_makereport", "pytest_runtest_logreport", "pytest_runtest_logfinish",
    ]
    # the last item gets nextitem=None, the others get the next item
    assert "pytest_runtest_teardown test_one nextitem=test_two" in rec.calls
    assert "pytest_runtest_teardown test_two nextitem=None" in rec.calls
    # collection is nested: the session collects a directory, which collects the module, which yields the items
    assert [c for c in rec.calls if c.startswith("pytest_collectstart")] == [
        "pytest_collectstart Session", "pytest_collectstart Dir", "pytest_collectstart Module",
    ]
    # the terminal summary is printed from a wrapper around sessionfinish, so it comes after it
    assert n.index("pytest_sessionfinish") < n.index("pytest_terminal_summary")
    print("ok")
