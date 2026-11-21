"""Lesson 6: infrastructure as code, with the real Terraform.

The "infrastructure" here is two files on this computer, made with the `local` provider, because that is what can run
without a cloud account. The loop is the same one a cloud resource goes through: write the desired state, plan, apply,
let the state file remember what was made, plan again (nothing to do), change the code (a diff), change the world by hand
(drift) and destroy. Asserts what Terraform prints at every step.
"""

import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from devlab import LAB, check, fresh, run, show, write  # noqa: E402

NL = chr(10)


def L(*rows: str) -> str:
    return NL.join(rows) + NL


MAIN = L(
    "terraform {",
    "  required_providers {",
    '    local = { source = "hashicorp/local", version = "~> 2.5" }',
    "  }",
    "}",
    "",
    'variable "app_version" {',
    "  type    = string",
    '  default = "1.0.0"',
    "}",
    "",
    'resource "local_file" "config" {',
    '  filename = "${path.module}/out/config.json"',
    '  content  = jsonencode({ version = var.app_version, replicas = 2 })',
    "}",
    "",
    'resource "local_file" "motd" {',
    '  filename = "${path.module}/out/motd.txt"',
    '  content  = "welcome to the shop"',
    "}",
)

cache = LAB / "terraform-plugin-cache"
cache.mkdir(parents=True, exist_ok=True)
ENV = {"TF_PLUGIN_CACHE_DIR": str(cache), "TF_IN_AUTOMATION": "1", "TF_CLI_ARGS": "-no-color"}


def tf(*args: str, cwd: Path) -> tuple[int, str]:
    return run(["terraform", *args], cwd=cwd, env=ENV)


work = fresh("06_terraform")
write(work, "main.tf", MAIN)

code, out = tf("init", "-input=false", cwd=work)
check("terraform init downloads the provider", code == 0 and "Terraform has been successfully initialized" in out, out[-300:])
code, out = tf("validate", cwd=work)
check("terraform validate accepts the code", code == 0 and "valid" in out, out)
code, out = tf("fmt", "-check", cwd=work)
check("terraform fmt -check is quiet when the code is formatted (exit 3 and the file name otherwise)", code in (0, 3))

# ---- 1. plan: what would be done ----
code, out = tf("plan", "-input=false", cwd=work)
show("terraform plan", NL.join(l for l in out.splitlines() if l.startswith("Plan:") or "will be created" in l))
check("the first plan wants to create two resources", "Plan: 2 to add, 0 to change, 0 to destroy." in out, out[-300:])
check("nothing exists yet, plan changed nothing", not (work / "out").exists())

# ---- 2. apply: make it so, and remember ----
code, out = tf("apply", "-input=false", "-auto-approve", cwd=work)
check("apply reports two resources added", "Apply complete! Resources: 2 added, 0 changed, 0 destroyed." in out, out[-300:])
config = json.loads((work / "out" / "config.json").read_text())
check("the file was written with the content of the code", config == {"version": "1.0.0", "replicas": 2}, str(config))
code, out = tf("state", "list", cwd=work)
show("terraform state list", out)
check("the state file knows both resources", out.splitlines() == ["local_file.config", "local_file.motd"], out)
state = json.loads((work / "terraform.tfstate").read_text())
check("terraform.tfstate holds the id of what it made (a hash of the content for local_file)", all(r["instances"][0]["attributes"]["id"] for r in state["resources"]))

# ---- 3. plan again: idempotent ----
code, out = tf("plan", "-input=false", cwd=work)
check("a second plan finds nothing to do", "No changes. Your infrastructure matches the configuration." in out, out[-300:])
code, out = tf("apply", "-input=false", "-auto-approve", cwd=work)
check("a second apply changes nothing", "Apply complete! Resources: 0 added, 0 changed, 0 destroyed." in out, out[-300:])

# ---- 4. change the code: a diff, not a rebuild from zero ----
code, out = tf("plan", "-input=false", "-var", "app_version=1.1.0", cwd=work)
show("terraform plan -var app_version=1.1.0", NL.join(l for l in out.splitlines() if "~" in l or "->" in l or l.startswith("Plan:") or "replaced" in l))
check("only the config file is touched, the motd stays", "Plan: 1 to add, 0 to change, 1 to destroy." in out and "local_file.motd" not in out.split("Plan:")[0].split("Terraform will perform")[-1], out[-500:])
check("plan says why the config file has to be replaced", "must be replaced" in out and "content" in out)
code, out = tf("apply", "-input=false", "-auto-approve", "-var", "app_version=1.1.0", cwd=work)
check("apply replaces one resource", "Apply complete! Resources: 1 added, 0 changed, 1 destroyed." in out, out[-300:])
check("the file on disk has the new version", json.loads((work / "out" / "config.json").read_text())["version"] == "1.1.0")

# ---- 5. drift: someone edits the world by hand ----
write(work, "out/config.json", json.dumps({"version": "9.9.9", "replicas": 50}))
code, out = tf("plan", "-input=false", "-var", "app_version=1.1.0", cwd=work)
show("terraform plan after a hand edit of out/config.json", NL.join(l for l in out.splitlines() if "changed outside" in l or l.startswith("Plan:") or "# local_file" in l))
check("this provider reads the file on refresh and, finding other content, drops it from the state: the drift shows as a resource to create", "Refreshing state" in out and "local_file.config will be created" in out, out[-500:])
check("and plans to put it back", "Plan: 1 to add, 0 to change, 0 to destroy." in out and "local_file.config will be created" in out, out[-300:])
code, out = tf("apply", "-input=false", "-auto-approve", "-var", "app_version=1.1.0", cwd=work)
check("apply puts the hand edit back", json.loads((work / "out" / "config.json").read_text()) == {"version": "1.1.0", "replicas": 2})
os.remove(work / "out" / "motd.txt")
code, out = tf("plan", "-input=false", "-var", "app_version=1.1.0", cwd=work)
check("a file deleted by hand is planned as a new resource", "Plan: 1 to add, 0 to change, 0 to destroy." in out and "local_file.motd" in out, out[-400:])
code, out = tf("apply", "-input=false", "-auto-approve", "-var", "app_version=1.1.0", cwd=work)
check("apply makes the deleted file again", (work / "out" / "motd.txt").read_text() == "welcome to the shop")

# ---- 6. destroy ----
code, out = tf("destroy", "-input=false", "-auto-approve", "-var", "app_version=1.1.0", cwd=work)
check("destroy removes both files", "Destroy complete! Resources: 2 destroyed." in out and not (work / "out" / "config.json").exists() and not (work / "out" / "motd.txt").exists(), out[-300:])
state = json.loads((work / "terraform.tfstate").read_text())
check("the state is empty again", state["resources"] == [])
print("ok")
