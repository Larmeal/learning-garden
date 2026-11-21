"""Lesson 13: capstone, one change from commit to production and back again.

Everything of lessons 1 to 12 runs together on this computer: a Git remote with a hook (CI), a registry (a container
image is the artifact), a second repository that holds the desired state (GitOps), a controller that makes Docker match it,
a canary release judged by an error rate, and a revert as the rollback. Three releases of a small web service:
v1 is fine; v2 adds coupons and breaks on one code that no test covers (the pipeline passes, a canary catches it);
v3 fixes it and adds the test. Asserts what happens at every hand-off, and that the audit trail answers
"what is running, which commit made it, and who changed the desired state when".

Run with --write to save the story that the capstone lab walks through (capstone.json).
"""

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from devlab import HERE, PY, check, commit_all, docker, docker_ok, free_port, fresh, git, init, reset_clock, run, save_json, show, wait_until, write  # noqa: E402

sys.path.insert(0, str(HERE))
from ci_runner import run_pipeline  # noqa: E402,F401
from gitops import cleanup, reconcile  # noqa: E402

NL = chr(10)
GROUP = "devops13"
if not docker_ok():
    sys.exit("Docker is not running")


def L(*rows: str) -> str:
    return NL.join(rows) + NL


# ---- the service, in three versions ----
def app(discounts: str, price_body: str) -> str:
    return L(
        "import os",
        "import urllib.parse",
        "from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer",
        "",
        'VERSION = os.environ.get("VERSION", "dev")',
        f"DISCOUNTS = {discounts}",
        "",
        "",
        "def price(coupon=None):",
        *price_body.splitlines(),
        "",
        "",
        "class Handler(BaseHTTPRequestHandler):",
        "    def do_GET(self):",
        "        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)",
        "        try:",
        '            amount = price(query.get("coupon", [None])[0])',
        '            body, status = f"price={amount} version={VERSION}", 200',
        "        except Exception:",
        '            body, status = f"error version={VERSION}", 500',
        "        data = body.encode()",
        "        self.send_response(status)",
        '        self.send_header("Content-Length", str(len(data)))',
        "        self.end_headers()",
        "        self.wfile.write(data)",
        "",
        "    def log_message(self, *args):",
        "        pass",
        "",
        "",
        'if __name__ == "__main__":',
        '    ThreadingHTTPServer(("0.0.0.0", 8000), Handler).serve_forever()',
    )


APP_V1 = app("{}", "    return 100")
APP_V2 = app('{"SAVE10": 10}', "    return 100 if coupon is None else 100 - DISCOUNTS[coupon]")
APP_V3 = app('{"SAVE10": 10, "WELCOME5": 5}', "    return 100 if coupon is None else 100 - DISCOUNTS[coupon]")
TEST_V1 = L("import unittest", "from app import price", "", "", "class T(unittest.TestCase):", "    def test_plain(self):", "        self.assertEqual(price(), 100)")
TEST_V2 = TEST_V1 + L("", "    def test_save10(self):", "        self.assertEqual(price('SAVE10'), 90)")
TEST_V3 = TEST_V2 + L("", "    def test_welcome5(self):", "        self.assertEqual(price('WELCOME5'), 95)")
DOCKERFILE = L("FROM python:3.13-slim", "ARG VERSION=dev", "ENV VERSION=$VERSION", "WORKDIR /app", "COPY app.py .", 'CMD ["python", "app.py"]')
BUILD_IMAGE = L(
    "import os, subprocess",
    "sha, reg = os.environ['CI_SHORT_SHA'], os.environ['REGISTRY']",
    "tag = f'{reg}/shop:{sha}'",
    "subprocess.run(['docker', 'build', '-q', '--build-arg', f'VERSION={sha}', '-t', tag, '.'], check=True)",
    "subprocess.run(['docker', 'push', '-q', tag], check=True)",
)
PIPELINE = L(
    "[[stage]]", 'name = "lint"', 'run = "python -m py_compile app.py"', "",
    "[[stage]]", 'name = "test"', 'run = "python -m unittest discover -q"', "",
    "[[stage]]", 'name = "image"', 'run = "python build_image.py"',
)

reset_clock()
cleanup(GROUP)
run(["docker", "rm", "-f", "devops13-registry"])
reg_port = free_port()
registry = f"localhost:{reg_port}"
ci_dir = fresh("13_ci_server")
app_remote = init("13_app_remote", bare=True)
cfg_remote = init("13_config_remote", bare=True)
for r in (app_remote, cfg_remote):
    git(r, "symbolic-ref", "HEAD", "refs/heads/main")
runner = (HERE / "ci_runner.py").as_posix()
hook = L("#!/bin/sh", "while read old new ref; do", f'  REGISTRY={registry} "{Path(PY).as_posix()}" "{runner}" "{app_remote.as_posix()}" "$new" "{ci_dir.as_posix()}" > "{(ci_dir / "last.log").as_posix()}" 2>&1', "done")
(app_remote / "hooks" / "post-receive").write_bytes(hook.encode())
dev = init("13_dev")
git(dev, "remote", "add", "origin", str(app_remote))
cfg = init("13_config")
git(cfg, "remote", "add", "origin", str(cfg_remote))
story = []  # what the capstone lab walks through


def version_of(port: int, query: str = "") -> tuple[int, str]:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/{query}", timeout=5) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as err:
        return err.code, err.read().decode()


def push_app(app_text: str, test_text: str, message: str):
    write(dev, "app.py", app_text)
    write(dev, "test_app.py", test_text)
    write(dev, "Dockerfile", DOCKERFILE)
    write(dev, "build_image.py", BUILD_IMAGE)
    write(dev, "pipeline.toml", PIPELINE)
    sha = commit_all(dev, message)
    full = git(dev, "rev-parse", "HEAD")
    git(dev, "push", "-q", "origin", "main")
    result = json.loads((ci_dir / "results" / f"{full}.json").read_text())
    return sha, full, result


def release(services: list[dict], message: str) -> str:
    write(cfg, "desired.json", json.dumps({"services": services}, indent=2) + NL)
    commit_all(cfg, message)
    git(cfg, "push", "-q", "origin", "main")
    return git(cfg, "rev-parse", "--short", "HEAD")


def web(sha: str, name: str, replicas: int, port_base: int) -> dict:
    return {"name": name, "version": sha, "replicas": replicas, "port_base": port_base, "image": f"{registry}/shop:{sha}", "cmd": ["python", "app.py"]}


def wait_up(ports: list[int]) -> bool:
    return wait_until(lambda: all(version_of(p)[0] == 200 for p in ports), timeout=40, step=0.5)


try:
    docker("run", "-d", "--name", "devops13-registry", "-p", f"127.0.0.1:{reg_port}:5000", "registry:3")
    check("the registry is up", wait_until(lambda: urllib.request.urlopen(f"http://{registry}/v2/").status == 200))

    # ---- 1. v1: commit, CI, image, desired state, controller ----
    sha1, full1, r1 = push_app(APP_V1, TEST_V1, "v1: price service")
    show("CI log of the push of v1", (ci_dir / "last.log").read_text().strip())
    check("v1: lint, test and image pass", [s["status"] for s in r1["stages"]] == ["passed"] * 3, str(r1["stages"]))
    tags = json.loads(urllib.request.urlopen(f"http://{registry}/v2/shop/tags/list").read())["tags"]
    check("the registry holds one image, tagged with the commit", tags == [sha1], str(tags))
    c1 = release([web(sha1, "web", 2, 18100)], f"release {sha1} to production")
    steps = reconcile(GROUP, cfg_remote)
    check("the controller starts two replicas", steps == [("create", "web-1"), ("create", "web-2")], str(steps))
    check("both answer", wait_up([18101, 18102]))
    status, body = version_of(18101, "?coupon=SAVE10")
    check("a user sees version 1, which ignores the coupon", (status, body) == (200, f"price=100 version={sha1}"), body)
    story.append({"step": "v1", "ci": [s["status"] for s in r1["stages"]], "image": sha1, "config": c1, "running": {"web": sha1}})

    # ---- 2. v2: a bug that no test covers; the pipeline is green, the canary is not ----
    sha2, full2, r2 = push_app(APP_V2, TEST_V2, "v2: coupons")
    check("v2 passes all three stages, because no test uses the code WELCOME5", [s["status"] for s in r2["stages"]] == ["passed"] * 3, str(r2["stages"]))
    c2 = release([web(sha1, "web", 2, 18100), web(sha2, "canary", 1, 18110)], f"canary {sha2}: one replica of three")
    steps = reconcile(GROUP, cfg_remote)
    check("the controller adds one canary replica and leaves the two stable ones alone", steps == [("create", "canary-1")], str(steps))
    check("all three replicas answer", wait_up([18101, 18102, 18111]))
    ports = [18101, 18102, 18111]
    results = []
    for i in range(60):
        port = ports[i % 3]
        query = "?coupon=WELCOME5" if i % 4 == 0 else ""
        status, body = version_of(port, query)
        results.append((port, status, body.split("version=")[1]))
    failed = [r for r in results if r[1] != 200]
    on_canary = [r for r in results if r[2] == sha2]
    rate = sum(1 for r in on_canary if r[1] != 200) / len(on_canary)
    show("60 requests, round robin over three replicas", f"{len(on_canary)} went to the canary, {len(failed)} requests failed in all, error rate of the canary {rate:.0%}")
    check("only the canary failed", all(r[2] == sha2 for r in failed) and len(failed) > 0)
    check("the canary served a third of the traffic", len(on_canary) == 20)
    check("its error rate is above the 10 percent threshold of the judge", rate > 0.10, f"{rate:.2f}")
    check("the stable version failed no request", not any(r[1] != 200 for r in results if r[2] == sha1))
    story.append({"step": "v2 canary", "ci": [s["status"] for s in r2["stages"]], "image": sha2, "config": c2, "failed": len(failed), "canaryRate": round(rate, 2)})

    # ---- 3. the rollback is a revert of the config commit ----
    git(cfg, "revert", "--no-edit", "HEAD")
    git(cfg, "push", "-q", "origin", "main")
    steps = reconcile(GROUP, cfg_remote)
    check("the controller removes the canary and nothing else", steps == [("remove", "canary-1")], str(steps))
    after = [version_of(p, "?coupon=WELCOME5")[0] for p in (18101, 18102)]
    check("every request works again (the stable version ignores coupons)", after == [200, 200])
    story.append({"step": "rollback", "config": git(cfg, "rev-parse", "--short", "HEAD"), "running": {"web": sha1}})

    # ---- 4. v3: the fix comes with the test that was missing ----
    write(dev, "app.py", APP_V3)
    write(dev, "test_app.py", TEST_V3)
    code, out = run([PY, "-m", "unittest", "discover", "-q"], cwd=dev)
    check("the new test passes on the new code", code == 0, out)
    old_app = fresh("13_old_app")
    write(old_app, "app.py", APP_V2)
    write(old_app, "test_app.py", TEST_V3)
    code, out = run([PY, "-m", "unittest", "discover", "-q"], cwd=old_app)
    check("the same test fails on the code of v2: it would have blocked the release", code != 0 and "KeyError" in out, out[-200:])
    git(dev, "checkout", "--", ".")
    sha3, full3, r3 = push_app(APP_V3, TEST_V3, "v3: fix WELCOME5 and test it")
    check("v3 passes the pipeline", [s["status"] for s in r3["stages"]] == ["passed"] * 3)
    c3 = release([web(sha3, "web", 2, 18100)], f"release {sha3} to production")
    steps = reconcile(GROUP, cfg_remote)
    check("both stable replicas are replaced by the new image", steps == [("replace", "web-1"), ("replace", "web-2")], str(steps))
    check("the replicas answer again", wait_up([18101, 18102]))
    final = [version_of(p, "?coupon=WELCOME5") for p in (18101, 18102)]
    check("the code that broke v2 now gives a price of 95 on version 3", final == [(200, f"price=95 version={sha3}")] * 2, str(final))
    story.append({"step": "v3", "ci": [s["status"] for s in r3["stages"]], "image": sha3, "config": c3, "running": {"web": sha3}})

    # ---- 5. the audit trail ----
    tags = sorted(json.loads(urllib.request.urlopen(f"http://{registry}/v2/shop/tags/list").read())["tags"])
    check("the registry keeps the three images, one per commit", tags == sorted([sha1, sha2, sha3]), str(tags))
    log = git(cfg, "log", "--format=%s").splitlines()
    show("git log of the config repository", NL.join(log))
    check("the config history reads as the story: release, canary, revert, release", len(log) == 4 and log[1].startswith("Revert") and log[2].startswith("canary") and log[3].startswith("release"), str(log))
    running = docker("ps", "--filter", f"label=devops-gitops={GROUP}", "--format", "{{.Names}} {{.Image}}")
    check("the running containers use the image of the last commit", all(f"shop:{sha3}" in line for line in running.splitlines()) and len(running.splitlines()) == 2, running)
    if "--write" in sys.argv:
        save_json("capstone.json", {"story": story, "images": [sha1, sha2, sha3]})
finally:
    cleanup(GROUP)
    run(["docker", "rm", "-f", "devops13-registry"])
    for tag in ("shop",):
        out = run(["docker", "images", "--format", "{{.Repository}}:{{.Tag}}"])[1]
        for image in out.splitlines():
            if image.startswith(f"localhost:{reg_port}/{tag}"):
                run(["docker", "rmi", "-f", image])
print("ok")
