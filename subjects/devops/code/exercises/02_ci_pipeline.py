"""Lesson 2: continuous integration, a pipeline that a push starts.

A bare repository stands for the shared server. Its `post-receive` hook calls a small runner (`ci_runner.py`) that reads
`pipeline.toml` from the pushed commit, runs lint, test and build, stops at the first failure and keeps the artifact of a
green commit. Asserts: a green push builds one artifact named after the commit, a red test skips the build and leaves no
artifact, a push that changes the pipeline file is judged by the new pipeline, a security stage added that way blocks a
commit with a key in it, and the same commit built twice gives byte for byte the same artifact.
"""

import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from devlab import HERE, PY, check, commit_all, fresh, git, git_rc, init, reset_clock, show, write  # noqa: E402

NL = chr(10)


def L(*rows: str) -> str:
    return NL.join(rows) + NL


APP = L("def greet(name):", "    return 'hello ' + name")
TEST = L(
    "import unittest",
    "from app import greet",
    "",
    "",
    "class AppTest(unittest.TestCase):",
    "    def test_greet(self):",
    "        self.assertEqual(greet('ada'), 'hello ada')",
)
BUILD = L(
    "import os, zipfile",
    "from pathlib import Path",
    "sha = os.environ['CI_SHORT_SHA']",
    "Path('dist').mkdir(exist_ok=True)",
    "info = zipfile.ZipInfo('app.py', date_time=(2026, 1, 5, 0, 0, 0))",
    "with zipfile.ZipFile(f'dist/app-{sha}.zip', 'w', zipfile.ZIP_DEFLATED) as z:",
    "    z.writestr(info, open('app.py', 'rb').read())",
)
PIPELINE = L(
    "[[stage]]", 'name = "lint"', 'run = "python -m py_compile app.py"', "",
    "[[stage]]", 'name = "test"', 'run = "python -m unittest discover -q"', "",
    "[[stage]]", 'name = "build"', 'run = "python build.py"',
)
SCAN = L(
    "[[stage]]", 'name = "secret-scan"',
    "run = \"python -c \\\"import sys; t=open('app.py').read(); sys.exit('key found' if 'AKIA' in t else 0)\\\"\"", "",
)

reset_clock()
remote = init("02_remote", bare=True)
ci = fresh("02_ci_server")
runner = (HERE / "ci_runner.py").as_posix()
hook = L("#!/bin/sh", "while read old new ref; do", f'  "{Path(PY).as_posix()}" "{runner}" "{Path(remote).as_posix()}" "$new" "{Path(ci).as_posix()}"', "done")
(remote / "hooks" / "post-receive").write_bytes(hook.encode())
git(remote, "symbolic-ref", "HEAD", "refs/heads/main")

dev = init("02_dev")
git(dev, "remote", "add", "origin", str(remote))


def push() -> tuple[str, str]:
    code, out = git_rc(dev, "push", "origin", "main")
    sha = git(dev, "rev-parse", "HEAD")
    return sha, "\n".join(l for l in out.splitlines() if l.startswith("remote: [ci]"))


def result(sha: str) -> dict:
    return json.loads((ci / "results" / f"{sha}.json").read_text())


def names(res: dict) -> dict[str, str]:
    return {s["name"]: s["status"] for s in res["stages"]}


# ---- 1. a green push: lint, test, build, one artifact named after the commit ----
write(dev, "app.py", APP)
write(dev, "test_app.py", TEST)
write(dev, "build.py", BUILD)
write(dev, "pipeline.toml", PIPELINE)
commit_all(dev, "first version with a pipeline")
sha1, out = push()
show("git push origin main", out)
r1 = result(sha1)
check("the hook ran the pipeline for the pushed commit", r1["sha"] == sha1)
check("lint, test and build all passed", names(r1) == {"lint": "passed", "test": "passed", "build": "passed"}, str(names(r1)))
art1 = ci / "artifacts" / f"app-{sha1[:7]}.zip"
check("the artifact is named after the commit", art1.is_file(), str(list((ci / "artifacts").glob("*"))))
digest1 = hashlib.sha256(art1.read_bytes()).hexdigest()

# ---- 2. a red test: fail fast, no build, no artifact ----
write(dev, "app.py", L("def greet(name):", "    return 'hi ' + name"))
commit_all(dev, "change the greeting, forget the test")
sha2, out = push()
show("git push origin main", out)
r2 = result(sha2)
check("lint passed, test failed, build was skipped", names(r2) == {"lint": "passed", "test": "failed", "build": "skipped"}, str(names(r2)))
check("a failed commit leaves no artifact", not (ci / "artifacts" / f"app-{sha2[:7]}.zip").exists())
check("the log of the failed stage says what was expected", "hello ada" in r2["stages"][1]["log"])

# ---- 3. a syntax error: lint fails first, so the tests never run ----
write(dev, "app.py", L("def greet(name)", "    return 'hi ' + name"))
commit_all(dev, "broken syntax")
sha3, out = push()
r3 = result(sha3)
check("lint failed and both later stages were skipped", names(r3) == {"lint": "failed", "test": "skipped", "build": "skipped"}, str(names(r3)))

# ---- 4. the pipeline is code: a commit that adds a stage is judged by that stage ----
write(dev, "app.py", L("def greet(name):", "    return 'hello ' + name", "", "KEY = 'AKIAFAKEKEY0000000'"))
write(dev, "pipeline.toml", PIPELINE.replace('[[stage]]\nname = "build"', SCAN + '[[stage]]\nname = "build"'))
commit_all(dev, "add a secret scan, and (by mistake) a key")
sha4, out = push()
show("git push origin main", out)
r4 = result(sha4)
check("the new stage ran on the very push that added it", "secret-scan" in names(r4), str(names(r4)))
check("the scan blocked the commit with the key, the build was skipped", names(r4)["secret-scan"] == "failed" and names(r4)["build"] == "skipped", str(names(r4)))

# ---- 5. fix the mistake: green again, a second artifact ----
write(dev, "app.py", APP)
commit_all(dev, "remove the key")
sha5, out = push()
r5 = result(sha5)
check("all four stages pass once the key is gone", set(names(r5).values()) == {"passed"} and len(names(r5)) == 4, str(names(r5)))
check("two green commits, two artifacts", sorted(p.name for p in (ci / "artifacts").glob("*")) == sorted([f"app-{sha1[:7]}.zip", f"app-{sha5[:7]}.zip"]))

# ---- 6. build once: the same commit built again gives the same bytes ----
sys.path.insert(0, str(HERE))
from ci_runner import run_pipeline  # noqa: E402

ci_again = fresh("02_ci_again")
run_pipeline(remote, sha1, ci_again, quiet=True)
digest_again = hashlib.sha256((ci_again / "artifacts" / f"app-{sha1[:7]}.zip").read_bytes()).hexdigest()
print(f"  sha256 of the artifact, first build   {digest1[:16]}")
print(f"  sha256 of the artifact, second build  {digest_again[:16]}")
check("the same commit built twice gives byte for byte the same artifact", digest1 == digest_again)
check("the artifact of the last commit has the same bytes, because app.py is the same text as in the first commit", hashlib.sha256((ci / "artifacts" / f"app-{sha5[:7]}.zip").read_bytes()).hexdigest() == digest1)
print("ok")
