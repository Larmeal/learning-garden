"""Lesson plugins: how a plugin that is installed (not passed with -p) is found, using a fake distribution.

An installed package announces a plugin with an entry point in the group "pytest11". The entry point lives in the
dist-info folder next to the package, so a folder on PYTHONPATH that holds a dist-info is enough to show the mechanism
without running pip.
"""

import os
import shutil
import tempfile
from pathlib import Path

from _lab import make_project, run_sub

HERE = Path(__file__).resolve().parent.parent

if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        site = Path(tmp) / "site"
        site.mkdir()
        shutil.copy(HERE / "plugins" / "shop_plugin.py", site / "shop_plugin.py")
        dist = site / "shop_plugin-0.1.dist-info"
        dist.mkdir()
        (dist / "METADATA").write_text("Metadata-Version: 2.1\nName: shop-plugin\nVersion: 0.1\n", encoding="utf-8")
        (dist / "entry_points.txt").write_text("[pytest11]\nshop = shop_plugin\n", encoding="utf-8")

        project = make_project(Path(tmp) / "project", {"test_use.py": "def test_x(cart_factory):\n    assert cart_factory(a=1).total() == 1\n"})
        env = {"PYTHONPATH": os.pathsep.join([str(site), str(HERE / "src")])}

        code, out = run_sub(project, "-q", env=env)
        print("installed plugin, auto-loaded:", code, out.strip().splitlines()[-1])
        assert code == 0

        code, out = run_sub(project, "-q", "--trace-config", "--co", env=env)
        line = next(l for l in out.splitlines() if "PLUGIN registered" in l and "shop_plugin" in l)
        print(line.strip())
        assert "shop" in line

        # PYTEST_DISABLE_PLUGIN_AUTOLOAD stops pytest from reading the pytest11 entry points at all
        code, out = run_sub(project, "-q", env={**env, "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1"})
        print("autoload disabled:", code, [l for l in out.splitlines() if "not found" in l][:1])
        assert code == 1 and "fixture 'cart_factory' not found" in out

        # a single plugin can be left out by its entry point name
        code, out = run_sub(project, "-q", "-p", "no:shop", env=env)
        print("-p no:shop:", code, [l for l in out.splitlines() if "not found" in l][:1])
        assert code == 1 and "fixture 'cart_factory' not found" in out

        # the same plugin can be loaded by hand, which does not need an installed distribution
        code, out = run_sub(project, "-q", "-p", "shop_plugin", env={"PYTHONPATH": os.pathsep.join([str(site), str(HERE / "src")]), "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1"})
        print("-p shop_plugin with autoload disabled:", code)
        assert code == 0
    print("ok")
