"""Lesson 5: releasing a new version, five ways.

Two real HTTP servers stand for version 1 and version 2. Version 2 has a bug that only shows on requests that use a
feature (a quarter of the requests, chosen with a fixed seed), so a smoke test with a plain request passes. 400 requests
arrive one after another, the new version is released at request 100, and a judge looks at the error rate of the new
version at request 200 (a window of 100 requests, an assumption of this exercise) and rolls back when it is above 10 percent.
Asserts how many users each strategy hurt and what each needs to roll back.

Run with --write to save the per-request outcomes that the release lab draws (release.json).
"""

import random
import sys
import threading
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from devlab import check, save_json, show  # noqa: E402

N, DEPLOY_AT, JUDGE_AT, THRESHOLD = 400, 100, 200, 0.10


def serve(version: int) -> tuple[ThreadingHTTPServer, int]:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            uses_feature = "feature=1" in self.path
            if version == 2 and uses_feature:  # the bug of version 2
                self.send_response(500)
                body = b"error"
            else:
                self.send_response(200)
                body = f"v{version}".encode()
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, server.server_address[1]


v1, port1 = serve(1)
v2, port2 = serve(2)
PORTS = {1: port1, 2: port2}


def call(version: int, uses_feature: bool) -> int:
    url = f"http://127.0.0.1:{PORTS[version]}/?feature={int(uses_feature)}"
    try:
        with urllib.request.urlopen(url) as response:
            return response.status
    except urllib.error.HTTPError as err:
        return err.code


rng_feature = random.Random(7)
rng_canary = random.Random(11)
FEATURE = [rng_feature.random() < 0.25 for _ in range(N)]  # does request i use the feature that version 2 breaks?
CANARY = [rng_canary.random() < 0.10 for _ in range(N)]  # is request i one of the 10 percent chosen for the new version?

# ---- 0. the smoke test passes and the bug is real ----
check("a plain request to version 2 works (this is all a smoke test sends)", call(2, False) == 200)
check("a request that uses the feature fails on version 2", call(2, True) == 500)
check("the same request works on version 1", call(1, True) == 200)
print(f"  {sum(FEATURE)} of {N} requests use the feature, {sum(CANARY)} are chosen for the canary")


def version_for(strategy: str, i: int) -> int:
    """Which version answers request i, for each strategy (version 2 is released at DEPLOY_AT, judged at JUDGE_AT)."""
    live = DEPLOY_AT <= i < JUDGE_AT  # the new version is in play only until the judge rolls it back
    if not live:
        return 1
    if strategy in ("all-at-once", "blue-green"):
        return 2
    if strategy == "canary":
        return 2 if CANARY[i] else 1
    if strategy == "flag":  # version 2 is deployed everywhere before DEPLOY_AT, the flag decides who takes the new path
        return 2 if CANARY[i] else 1
    if strategy == "rolling":  # four instances, one replaced every 25 requests, requests go round robin
        instance = i % 4
        replaced_at = DEPLOY_AT + 25 * instance
        return 2 if i >= replaced_at else 1
    raise ValueError(strategy)


results = {}
for strategy in ("all-at-once", "blue-green", "rolling", "canary", "flag"):
    versions, failed = [], []
    for i in range(N):
        v = version_for(strategy, i)
        status = call(v, FEATURE[i])
        versions.append(v)
        failed.append(status != 200)
    on_v2 = [i for i in range(N) if versions[i] == 2]
    bad = [i for i in range(N) if failed[i]]
    rate = sum(failed[i] for i in on_v2) / max(1, len(on_v2))
    results[strategy] = {"versions": versions, "failed": failed, "on_v2": len(on_v2), "failures": len(bad), "rate": rate}
    print(f"  {strategy:12} served {len(on_v2):3} requests on v2, {len(bad):3} failed, error rate of v2 traffic {rate:.0%}")
    check(f"{strategy}: the judge at request {JUDGE_AT} sees an error rate above {THRESHOLD:.0%} and rolls back", rate > THRESHOLD, f"{rate:.2f}")
    check(f"{strategy}: after the rollback every request succeeds", not any(failed[JUDGE_AT:]))
    check(f"{strategy}: before the release every request succeeds", not any(failed[:DEPLOY_AT]))

# ---- what the numbers say ----
show("failures by strategy", "\n".join(f"{k:12} {v['failures']:3}" for k, v in results.items()))
check("all-at-once and blue-green hurt exactly the same users", results["all-at-once"]["failed"] == results["blue-green"]["failed"])
check("rolling hurts fewer users than all-at-once, because it reaches the new version gradually", results["rolling"]["failures"] < results["all-at-once"]["failures"])
check("a canary of about 10 percent hurts far fewer than all-at-once (less than a third)", results["canary"]["failures"] * 3 < results["all-at-once"]["failures"])
check("the flag gives the same users as the canary in this run (same 10 percent), and needs no deploy to roll back", results["flag"]["failed"] == results["canary"]["failed"])
check("a health check does not see the bug, so the rolling update never stopped by itself", call(2, False) == 200)

# ---- what each strategy needs to go back ----
ROLLBACK = {
    "all-at-once": "deploy version 1 again (a new rollout, minutes)",
    "blue-green": "move the pointer back, version 1 is still running (seconds, but double the servers)",
    "rolling": "roll the replaced instances back one by one",
    "canary": "send 0 percent to version 2 (one setting)",
    "flag": "turn the flag off (no deploy at all)",
}
for k, v in ROLLBACK.items():
    print(f"  {k:12} rollback: {v}")

if "--write" in sys.argv:
    data = {
        "n": N, "deployAt": DEPLOY_AT, "judgeAt": JUDGE_AT, "threshold": THRESHOLD,
        "feature": "".join("1" if f else "0" for f in FEATURE),
        "strategies": {
            k: {
                "versions": "".join(str(x) for x in v["versions"]),
                "failed": "".join("1" if f else "0" for f in v["failed"]),
                "onV2": v["on_v2"], "failures": v["failures"],
            }
            for k, v in results.items()
        },
    }
    save_json("release.json", data)
v1.shutdown()
v2.shutdown()
print("ok")
