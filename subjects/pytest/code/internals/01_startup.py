"""Lesson how-pytest-runs: the plugins that are loaded before your code, what -p no: can and cannot remove, and where
the configuration comes from."""

from _pytest.config import builtin_plugins, default_plugins, essential_plugins

from _lab import project, run_sub

FILES = {
    "pyproject.toml": """
        [tool.pytest.ini_options]
        addopts = "-q"
        testpaths = ["tests"]
        markers = ["slow: takes a while"]
    """,
    "tests/test_x.py": """
        def test_x(pytestconfig):
            print("rootdir:", pytestconfig.rootpath.name != "")
            print("inifile:", pytestconfig.inipath.name)
            print("addopts:", pytestconfig.getini("addopts"))
            print("testpaths:", pytestconfig.getini("testpaths"))
    """,
}

REPORT = {
    "tests/test_plugins.py": """
        def test_plugins(pytestconfig):
            pm = pytestconfig.pluginmanager
            names = sorted(n for n, plugin in pm.list_name_plugin() if plugin is not None and not n.isdigit())
            print("COUNT", len(names))
            print("NAMES", ",".join(names))
    """,
}


if __name__ == "__main__":
    print("default_plugins:", len(default_plugins), "| essential:", essential_plugins)
    assert len(default_plugins) == 30
    assert set(essential_plugins) == {"mark", "main", "runner", "fixtures", "helpconfig"}
    assert "pytester" in builtin_plugins and "pytester" not in default_plugins

    with project({**FILES, **REPORT}) as root:
        code, out = run_sub(root, "-s")
        print(out)
        assert code == 0
        assert "inifile: pyproject.toml" in out and "addopts: ['-q']" in out or "addopts: -q" in out
        names_line = next(l for l in out.splitlines() if l.startswith("NAMES"))
        names = set(names_line.split(" ", 1)[1].split(","))
        print("registered names:", len(names))
        # every default plugin is registered under its own name
        for plugin in default_plugins:
            assert plugin in names, plugin

        # a plugin that is not essential can be switched off, and then it is gone from the list
        code, out = run_sub(root, "-s", "-p", "no:cacheprovider", "-p", "no:doctest")
        names2 = set(next(l for l in out.splitlines() if l.startswith("NAMES")).split(" ", 1)[1].split(","))
        assert "cacheprovider" not in names2 and "doctest" not in names2 and "terminal" in names2
        print("without cacheprovider and doctest:", len(names2), "names")

        # an essential one cannot: pytest stops with a usage error (exit code 4)
        code, out = run_sub(root, "-p", "no:main")
        print("-p no:main ->", code, out.strip().splitlines()[-1] if out.strip() else "")
        assert code == 4

        # --trace-config lists every plugin and where it came from
        code, out = run_sub(root, "--trace-config", "-q", "--co")
        registered = [l for l in out.splitlines() if "PLUGIN registered" in l]
        print("--trace-config lines:", len(registered))
        assert any("<module '_pytest.fixtures'" in l for l in registered)

        # an unknown ini key is a warning, and an unknown command line option is a usage error
        code, out = run_sub(root, "--no-such-option")
        assert code == 4 and "unrecognized arguments: --no-such-option" in out

        # --version is answered before the plugin system starts
        code, out = run_sub(root, "--version")
        assert code == 0 and out.startswith("pytest 9.2.0")
    print("ok")
