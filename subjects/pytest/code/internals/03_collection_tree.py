"""Lesson collection: the node tree pytest builds, node ids, and how a name becomes (or does not become) a test."""

from _lab import project, run

FILES = {
    "shop/__init__.py": "",
    "shop/test_cart.py": """
        import pytest

        class TestRemove:
            def test_drop(self): ...
            def test_missing(self): ...

        @pytest.mark.parametrize("n", [1, 2])
        def test_qty(n): ...

        def helper_not_a_test(): ...
        class Helper:
            def test_ignored_because_class_name(self): ...
    """,
    "test_top.py": """
        def test_top(): ...
    """,
    "notes.py": """
        def test_in_wrong_file_name(): ...
    """,
}


class Tree:
    def __init__(self):
        self.chains = []
        self.markers = {}

    def pytest_collection_modifyitems(self, items):
        for item in items:
            self.chains.append([(type(n).__name__, n.nodeid) for n in item.listchain()])


if __name__ == "__main__":
    tree = Tree()
    with project(FILES) as root:
        code, out = run(root, "--collect-only", "-q", plugins=[tree])
        _, verbose = run(root, "--collect-only")
    print(out)
    print(verbose)
    for chain in tree.chains:
        print(" > ".join(f"{t}({nid or '.'})" for t, nid in chain))

    ids = [c[-1][1] for c in tree.chains]
    assert ids == [
        "shop/test_cart.py::TestRemove::test_drop",
        "shop/test_cart.py::TestRemove::test_missing",
        "shop/test_cart.py::test_qty[1]",
        "shop/test_cart.py::test_qty[2]",
        "test_top.py::test_top",
    ]
    types = [t for t, _ in tree.chains[0]]
    assert types == ["Session", "Dir", "Package", "Module", "Class", "Function"], types
    assert [t for t, _ in tree.chains[4]] == ["Session", "Dir", "Module", "Function"]
    assert "notes.py" not in out and "Helper" not in out and "helper_not_a_test" not in out
    assert "5 tests collected" in out
    print("ok")
