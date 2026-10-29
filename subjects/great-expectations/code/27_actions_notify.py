"""Lesson: actions-data-docs. Which notify_on values send, what a Slack message looks like, a custom action, and
what Data Docs pages contain.

Slack is replaced by a tiny HTTP server on localhost, so nothing leaves the machine.

Run: uv run python 27_actions_notify.py
"""

import json
import re
import tempfile
import threading
import warnings
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import great_expectations as gx
import great_expectations.expectations as gxe
import pandas as pd
from great_expectations.checkpoint.actions import SlackNotificationAction, UpdateDataDocsAction, ValidationAction

import gxlab  # noqa: F401

warnings.filterwarnings("ignore")

RECEIVED: list[tuple[str, dict]] = []


class Hook(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        RECEIVED.append((self.path, json.loads(body or b"{}")))
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, *args):  # silence the access log
        pass


server = HTTPServer(("127.0.0.1", 0), Hook)
threading.Thread(target=server.serve_forever, daemon=True).start()
PORT = server.server_address[1]

context = gx.get_context()
bd = gxlab.pandas_batch_definition(context, "notify")


def make_vd(tag, expectations):
    s = context.suites.add(gx.ExpectationSuite(name=f"s_{tag}"))
    for e in expectations:
        c = e.copy()  # an expectation that already belongs to a suite cannot join another one
        c.id = None
        s.add_expectation(c)
    return context.validation_definitions.add(gx.ValidationDefinition(name=f"vd_{tag}", data=bd, suite=s))


df = pd.DataFrame({"age": [10, 20, 300], "name": ["a", None, "c"]})
SCENARIOS = {
    "pass": [gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=500)],
    "fail warning": [gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=120, severity="warning")],
    "fail critical": [gxe.ExpectColumnValuesToNotBeNull(column="name")],
    "fail both": [gxe.ExpectColumnValuesToBeBetween(column="age", min_value=0, max_value=120, severity="warning"), gxe.ExpectColumnValuesToNotBeNull(column="name")],
}
MODES = ["all", "success", "failure", "critical", "warning", "info"]

print("--- 1. does a Slack action send? (1 = a POST arrived) ---")
print(f"{'scenario':14}" + "".join(f"{m:>10}" for m in MODES))
first_payload = None
for sname, exps in SCENARIOS.items():
    vd = make_vd(sname.replace(" ", "_"), exps)
    row = []
    for mode in MODES:
        RECEIVED.clear()
        action = SlackNotificationAction(name=f"slack_{mode}", slack_webhook=f"http://127.0.0.1:{PORT}/{mode}", notify_on=mode)
        cp = gx.Checkpoint(name=f"cp_{sname}_{mode}".replace(" ", "_"), validation_definitions=[vd], actions=[action])
        cp = context.checkpoints.add(cp)
        cp.run(batch_parameters={"dataframe": df})
        row.append(len(RECEIVED))
        if RECEIVED and first_payload is None and sname == "fail critical":
            first_payload = RECEIVED[0][1]
    print(f"{sname:14}" + "".join(f"{n:>10}" for n in row))

print("\n--- 2. what the Slack body looks like (fail critical, notify_on=all) ---")
print("top-level keys:", list(first_payload.keys()) if first_payload else None)
if first_payload:
    text = json.dumps(first_payload, ensure_ascii=False)
    print("size:", len(text), "chars")
    for piece in re.findall(r'"text": "([^"]{0,110})', text)[:6]:
        print("  text:", piece)

print("\n--- 3. a custom action ---")
SEEN = {}


class WriteStatus(ValidationAction):
    type: str = "write_status"
    name: str = "write_status"
    path: str = ""

    def run(self, checkpoint_result, action_context=None):
        SEEN["context_type"] = type(action_context).__name__
        SEEN["success"] = checkpoint_result.success
        Path(self.path).write_text("ok" if checkpoint_result.success else "failed", encoding="utf-8")
        return {"written": self.path}


out = Path(tempfile.mkdtemp(prefix="gx_act_")) / "status.txt"
vd = make_vd("custom", SCENARIOS["fail critical"])
cp = context.checkpoints.add(gx.Checkpoint(name="cp_custom", validation_definitions=[vd], actions=[WriteStatus(path=str(out))]))
cp.run(batch_parameters={"dataframe": df})
print("file content:", out.read_text(encoding="utf-8"), "| saw:", SEEN)

print("\n--- 4. a notification action that fails does not lose the stored result ---")


class Boom(ValidationAction):
    type: str = "boom"
    name: str = "boom"

    def run(self, checkpoint_result, action_context=None):
        raise RuntimeError("webhook is down")


before = len(context.validation_results_store.list_keys())
vd2 = make_vd("boomed", SCENARIOS["pass"])
cp2 = context.checkpoints.add(gx.Checkpoint(name="cp_boom", validation_definitions=[vd2], actions=[Boom()]))
try:
    cp2.run(batch_parameters={"dataframe": df})
except Exception as e:  # noqa: BLE001
    print("run raised:", type(e).__name__, "|", str(e)[:60])
print("results stored anyway:", len(context.validation_results_store.list_keys()) - before)

print("\n--- 5. a stored checkpoint whose custom action class is not imported ---")
import os  # noqa: E402
import subprocess  # noqa: E402
import sys  # noqa: E402
import textwrap  # noqa: E402

root = tempfile.mkdtemp(prefix="gx_act_missing_")
here = str(Path(__file__).parent)
BUILD = textwrap.dedent(
    """
    import sys; sys.path.insert(0, {here!r})
    import great_expectations as gx, great_expectations.expectations as gxe, pandas as pd
    from great_expectations.checkpoint.actions import ValidationAction
    class WriteStatus(ValidationAction):
        type: str = "write_status"
        name: str = "write_status"
        def run(self, checkpoint_result, action_context=None):
            return {{}}
    ctx = gx.get_context(mode="file", project_root_dir={root!r})
    bd = ctx.data_sources.add_pandas("s").add_dataframe_asset("a").add_batch_definition_whole_dataframe("w")
    suite = ctx.suites.add(gx.ExpectationSuite(name="x"))
    suite.add_expectation(gxe.ExpectColumnValuesToNotBeNull(column="id"))
    vd = ctx.validation_definitions.add(gx.ValidationDefinition(name="v", data=bd, suite=suite))
    ctx.checkpoints.add(gx.Checkpoint(name="cp", validation_definitions=[vd], actions=[WriteStatus()]))
    print("A: stored")
    """
)
LOAD = textwrap.dedent(
    """
    import sys; sys.path.insert(0, {here!r})
    import great_expectations as gx
    try:
        ctx = gx.get_context(mode="file", project_root_dir={root!r})
        print("B: loaded, checkpoints =", [c.name for c in ctx.checkpoints.all()])
        cp = ctx.checkpoints.get("cp")
        print("B: actions =", [type(a).__name__ for a in cp.actions])
    except Exception as e:
        print("B:", type(e).__name__, "|", str(e).replace(chr(10), " ")[:160])
    """
)
for label, code in (("A", BUILD), ("B", LOAD)):
    out = subprocess.run([sys.executable, "-c", code.format(here=here, root=root)], capture_output=True, text=True, env={**os.environ, "PYTHONIOENCODING": "utf-8"})
    lines = [line for line in out.stdout.splitlines() if line.startswith(label + ":")]
    print("\n".join(lines) or out.stderr[-300:])
