"""Lesson collection: what changes which tests are found, and what happens when a file cannot be imported."""

from _lab import project, run_sub

FILES = {
    "check_cart.py": "def check_total(): ...\n\nclass Spec:\n    def check_a(self): ...\n",
    "test_x.py": """
        class Test_Cart:
            def test_a(self): ...
        class CartTests:
            def test_in_class_with_wrong_name(self): ...
        class TestWithInit:
            def __init__(self): ...
            def test_never_collected(self): ...
        def test_f(): ...
        def spec_f(): ...
        test_value = 5
    """,
    "build/test_in_build.py": "def test_b(): ...\n",
    "node_modules/test_n.py": "def test_n(): ...\n",
    "sub/test_s.py": "def test_s(): ...\n",
    "broken/test_broken.py": "import no_such_module_at_all\n\ndef test_b(): ...\n",
    "ok/test_ok.py": "def test_ok(): ...\n",
}


def ids(out):
    return sorted(l for l in out.splitlines() if "::" in l)


if __name__ == "__main__":
    with project(FILES) as root:
        # default: broken file is an error, and the other files are still collected only with --continue-on-collection-errors
        code, out = run_sub(root, "--co", "-q", "ok", "sub", "test_x.py", "build", "node_modules")
        base = ids(out)
        print("default:", base)
        assert base == ["build/test_in_build.py::test_b", "node_modules/test_n.py::test_n", "ok/test_ok.py::test_ok",
                        "sub/test_s.py::test_s", "test_x.py::Test_Cart::test_a", "test_x.py::test_f"]
        names = [b.split("::", 1)[1] for b in ids(run_sub(root, "--co", "-q", "test_x.py")[1])]
        print("test_x.py:", names)
        # "Test_Cart" matches the class prefix Test; CartTests does not; a class with __init__ is not collected
        assert names == ["Test_Cart::test_a", "test_f"], names
        _, warn = run_sub(root, "-q", "test_x.py")
        assert "cannot collect test class 'TestWithInit' because it has a __init__ constructor" in warn

        # python_files / python_functions / python_classes change the naming rules
        _, out = run_sub(root, "--co", "-q", "-o", "python_files=check_*.py", "-o", "python_functions=check_*", "-o", "python_classes=Spec", "check_cart.py")
        print("custom patterns:", ids(out))
        assert ids(out) == ["check_cart.py::Spec::check_a", "check_cart.py::check_total"]

        # norecursedirs: some folder names are skipped by default when walking a folder
        _, out = run_sub(root, "--co", "-q")
        walked = {l.split("::")[0] for l in ids(out)}
        print("walk of the whole project:", sorted(walked))
        assert "build/test_in_build.py" not in walked and "node_modules/test_n.py" not in walked
        # but a path named on the command line is collected, even inside such a folder
        assert "build/test_in_build.py::test_b" in base
        _, out = run_sub(root, "--co", "-q", "-o", "norecursedirs=sub")
        assert not any(l.startswith("sub/") for l in ids(out))

        # --ignore and --deselect
        _, out = run_sub(root, "--co", "-q", "--ignore=sub", "--ignore=broken")
        assert not any(l.startswith(("sub/", "broken/")) for l in ids(out))
        _, out = run_sub(root, "--co", "-q", "--ignore=broken", "--deselect", "sub/test_s.py::test_s")
        assert "sub/test_s.py::test_s" not in ids(out) and "3/4 tests collected (1 deselected)" in out

        # a file that cannot be imported is a collection error, and by default it stops the whole run
        code, out = run_sub(root, "-q")
        print("with the broken file:", code, out.strip().splitlines()[-1])
        assert code == 2 and "Interrupted: 1 error during collection" in out and "ModuleNotFoundError" in out
        code, out = run_sub(root, "-q", "--continue-on-collection-errors")
        print("--continue-on-collection-errors:", code, out.strip().splitlines()[-1])
        assert code == 1 and "1 error" in out and "passed" in out

        # an explicit node id selects below the file: a class, a method, one parameter
        _, out = run_sub(root, "--co", "-q", "test_x.py::Test_Cart::test_a")
        assert ids(out) == ["test_x.py::Test_Cart::test_a"]
        code, out = run_sub(root, "-q", "test_x.py::no_such_test")
        print("node id that matches nothing:", code, [l for l in out.splitlines() if "not found" in l])
        assert code == 4 and "not found: " in out
    print("ok")
