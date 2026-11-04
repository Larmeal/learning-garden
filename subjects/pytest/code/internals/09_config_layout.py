"""Lesson project, deep dive: which config file wins, where rootdir comes from, import modes, and where options come from."""

from _lab import project, run_sub

PROBE = """
    def test_probe(pytestconfig):
        print("INI", pytestconfig.inipath.name if pytestconfig.inipath else None)
        print("ROOT", pytestconfig.rootpath.name)
        print("MINVER", pytestconfig.getini("minversion"))
"""


def probe(files, *args, env=None, cwd_sub=None, quiet=True):
    with project(files) as root:
        cwd = root / cwd_sub if cwd_sub else root
        cwd.mkdir(exist_ok=True)
        code, out = run_sub(cwd, "-s", *(["-q"] if quiet else []), *args, env=env)
        names = {l.split(" ", 1)[0]: l.split(" ", 1)[1] for l in out.splitlines() if l.split(" ", 1)[0] in ("INI", "ROOT", "MINVER")}
        return code, names, out


if __name__ == "__main__":
    # 1. precedence: pytest.ini, then pyproject.toml with [tool.pytest], then tox.ini, then setup.cfg
    base = {"test_p.py": PROBE}
    everything = {
        **base,
        "pytest.ini": "[pytest]\nminversion = 1.0\n",
        "pyproject.toml": "[tool.pytest]\nminversion = '2.0'\n",
        "tox.ini": "[pytest]\nminversion = 3.0\n",
        "setup.cfg": "[tool:pytest]\nminversion = 4.0\n",
    }
    order = ["pytest.ini", "pyproject.toml", "tox.ini", "setup.cfg"]
    seen = []
    files = dict(everything)
    for name in order:
        code, names, out = probe(files)
        seen.append((names["INI"], names["MINVER"]))
        files = {k: v for k, v in files.items() if k != name}
    print("winner at each step:", seen)
    assert seen == [("pytest.ini", "1.0"), ("pyproject.toml", "2.0"), ("tox.ini", "3.0"), ("setup.cfg", "4.0")]

    # 2. a pyproject.toml without [tool.pytest] is skipped, an empty pytest.ini still wins
    code, names, _ = probe({**base, "pyproject.toml": "[project]\nname='x'\n", "tox.ini": "[pytest]\nminversion = 3.0\n"})
    assert names["INI"] == "tox.ini"
    code, names, _ = probe({**base, "pytest.ini": "", "tox.ini": "[pytest]\nminversion = 3.0\n"})
    print("empty pytest.ini wins:", names["INI"])
    assert names["INI"] == "pytest.ini"

    # 3. the config file is searched upwards from the directory you run in, and its folder becomes the rootdir
    code, names, _ = probe({"sub/test_p.py": PROBE, "pytest.ini": "[pytest]\n"}, cwd_sub="sub")
    print("run from a sub folder:", names["INI"], "root is the folder with the ini file:", names["ROOT"] != "sub")
    assert names["INI"] == "pytest.ini" and names["ROOT"] != "sub"

    # 4. without any ini file the rootdir is the common ancestor of the arguments
    code, names, _ = probe(base)
    assert names["INI"] == "None" or names["INI"] == "None"

    # 5. command line wins over the file: -o overrides an ini value, PYTEST_ADDOPTS is added before the command line
    code, names, _ = probe({**base, "pytest.ini": "[pytest]\nminversion = 1.0\n"}, "-o", "minversion=9.0")
    assert names["MINVER"] == "9.0"
    code, names, out = probe({**base, "pytest.ini": "[pytest]\naddopts = -v\n"}, quiet=False)
    print("addopts -v from the ini file:", "PASSED" in out)
    assert "PASSED" in out
    code, names, out = probe({**base, "pytest.ini": "[pytest]\n"}, env={"PYTEST_ADDOPTS": "-v"}, quiet=False)
    assert "PASSED" in out

    # 6. an unknown key in the file is a warning, and --strict-config turns it into an error
    code, _, out = probe({**base, "pytest.ini": "[pytest]\nno_such_key = 1\n"})
    assert "PytestConfigWarning: Unknown config option: no_such_key" in out and code == 0
    code, _, out = probe({**base, "pytest.ini": "[pytest]\nno_such_key = 1\n"}, "--strict-config")
    assert code != 0

    # 7. import modes: two test files with the same basename in folders without __init__.py
    clash = {
        "a/test_same.py": "def test_a(): pass\n",
        "b/test_same.py": "def test_b(): pass\n",
    }
    with project(clash) as root:
        code, out = run_sub(root, "-q")
        print("prepend (default):", code, "import file mismatch" in out)
        assert code != 0 and "import file mismatch" in out
        code, out = run_sub(root, "-q", "--import-mode=importlib")
        print("importlib        :", code, out.strip().splitlines()[-1])
        assert code == 0 and "2 passed" in out
    clash_pkg = {**clash, "a/__init__.py": "", "b/__init__.py": ""}
    with project(clash_pkg) as root:
        code, out = run_sub(root, "-q")
        print("with __init__.py :", code, out.strip().splitlines()[-1])
        assert code == 0 and "2 passed" in out

    # 8. conftest.py layering: a conftest applies to its folder and below, and the one nearer the test overrides
    layered = {
        "conftest.py": "import pytest\n\n@pytest.fixture\ndef where():\n    return 'root'\n",
        "sub/conftest.py": "import pytest\n\n@pytest.fixture\ndef where():\n    return 'sub'\n",
        "test_top.py": "def test_top(where):\n    assert where == 'root'\n",
        "sub/test_deep.py": "def test_deep(where):\n    assert where == 'sub'\n",
        "other/test_other.py": "def test_other(where):\n    assert where == 'root'\n",
    }
    with project(layered) as root:
        code, out = run_sub(root, "-q")
        assert code == 0 and "3 passed" in out
    print("ok")
