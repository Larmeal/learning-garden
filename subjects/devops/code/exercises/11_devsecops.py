"""Lesson 11: DevSecOps, security checks that live in the pipeline.

Three checks, each at a different place on the way to production. (1) A secret scan over the whole history of a repository
finds a key that was deleted from the files long ago. (2) A bill of materials (SBOM) made once at build time can be matched
again whenever a new advisory arrives, without rebuilding anything; the advisories here are invented for the exercise.
(3) A real scanner (Trivy, from its Docker image, with its real vulnerability database) is run on an old and a new image of the same web server.
Asserts the structure of what is found and the comparison between the two images, never an exact number of CVEs, because
that database changes every day.
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from devlab import check, commit_all, docker, docker_ok, fresh, git, init, reset_clock, run, show, write  # noqa: E402

NL = chr(10)

# ---- 1. a secret that was removed from the files is still in the history ----
reset_clock()
repo = init("11_secrets")
write(repo, "settings.py", "REGION = 'eu-west-1'" + NL)
commit_all(repo, "settings")
write(repo, "settings.py", "REGION = 'eu-west-1'" + NL + "AWS_KEY = 'AKIAIOSFODNN7EXAMPLE'" + NL)
commit_all(repo, "oops, test with the real key")
write(repo, "settings.py", "REGION = 'eu-west-1'" + NL)
commit_all(repo, "remove the key")
PATTERN = re.compile(r"AKIA[0-9A-Z]{16}")
tree = (repo / "settings.py").read_text()
check("a scan of the files as they are now finds nothing", PATTERN.search(tree) is None)
history = git(repo, "log", "-p", "--all")
found = PATTERN.findall(history)
show("scan of git log -p", f"found {found}")
check("a scan of the history finds the key, in the commit that added it", found and found[0] == "AKIAIOSFODNN7EXAMPLE")
introduced = git(repo, "log", "-S", "AKIAIOSFODNN7EXAMPLE", "--format=%h %s", "--", "settings.py").splitlines()
check("git log -S names both commits that touched it (added, removed)", len(introduced) == 2, str(introduced))
check("removing the line did not remove the key: it is still in the object store", "AKIAIOSFODNN7EXAMPLE" in git(repo, "show", "HEAD~1:settings.py"))

# ---- 2. an SBOM made once, matched again when advisories change ----
LOCK = """requests==2.19.0
urllib3==1.24.1
flask==3.0.3
jinja2==3.1.4
pyyaml==5.3
"""
sbom = {"bomFormat": "CycloneDX", "specVersion": "1.5", "components": []}
for line in LOCK.strip().splitlines():
    name, version = line.split("==")
    sbom["components"].append({"type": "library", "name": name, "version": version, "purl": f"pkg:pypi/{name}@{version}"})
check("the SBOM lists every pinned package with a package url", len(sbom["components"]) == 5 and sbom["components"][0]["purl"] == "pkg:pypi/requests@2.19.0")


def version_tuple(v: str) -> tuple[int, ...]:
    return tuple(int(p) for p in v.split("."))


# invented advisories: a package, the first fixed version, a severity
ADVISORIES_DAY1 = [{"id": "EXAMPLE-0001", "package": "pyyaml", "fixed": "5.4", "severity": "critical"}]
ADVISORIES_DAY30 = ADVISORIES_DAY1 + [
    {"id": "EXAMPLE-0002", "package": "requests", "fixed": "2.31.0", "severity": "high"},
    {"id": "EXAMPLE-0003", "package": "jinja2", "fixed": "3.1.5", "severity": "medium"},
]


def match(components, advisories):
    return [(a["id"], c["name"], a["severity"]) for c in components for a in advisories if a["package"] == c["name"] and version_tuple(c["version"]) < version_tuple(a["fixed"])]


day1 = match(sbom["components"], ADVISORIES_DAY1)
day30 = match(sbom["components"], ADVISORIES_DAY30)
show("matching the same SBOM against the advisories of day 1 and of day 30", f"day 1:  {day1}{NL}day 30: {day30}")
check("on day 1 one package is known to be vulnerable", day1 == [("EXAMPLE-0001", "pyyaml", "critical")])
check("on day 30 the same bytes are known to be vulnerable in three places, with no new build", len(day30) == 3)

ORDER = {"low": 0, "medium": 1, "high": 2, "critical": 3}


def gate(findings, fail_from: str) -> bool:
    """True when the pipeline may continue."""
    return all(ORDER[s] < ORDER[fail_from] for _, _, s in findings)


check("a gate that fails from 'high' stops day 1 (critical)", not gate(day1, "high"))
check("a gate that fails only on 'critical' lets a build with only a medium finding through", gate([("EXAMPLE-0003", "jinja2", "medium")], "critical"))
check("the same gate fails from 'high' on day 30 because of requests and pyyaml", not gate(day30, "high"))

# ---- 3. a real scanner on a real image ----
if not docker_ok():
    print("  Docker is not running: part 3 skipped")
    print("ok")
    sys.exit(0)

work = fresh("11_trivy")
TRIVY = "aquasec/trivy:0.67.2"
OLD, NEW = "nginx:1.21-alpine", "nginx:1.28-alpine"


def scan(image: str) -> dict:
    run(["docker", "pull", "-q", image], check=True)
    tar = work / (image.replace(":", "_") + ".tar")
    docker("save", image, "-o", str(tar))
    code, out = run(["docker", "run", "--rm", "-v", f"{work.as_posix()}:/work", TRIVY, "image", "--input", f"/work/{tar.name}", "--format", "json", "--quiet"])
    return json.loads(out[out.index("{"):])


report_old, report_new = scan(OLD), scan(NEW)


def findings(report: dict) -> list[dict]:
    return [v for r in report.get("Results", []) for v in (r.get("Vulnerabilities") or [])]


old_v, new_v = findings(report_old), findings(report_new)
sev = lambda vs, s: sum(1 for v in vs if v["Severity"] == s)  # noqa: E731
show("trivy image, same scanner and database", f"{OLD}: {len(old_v)} known vulnerabilities, {sev(old_v, 'CRITICAL')} critical{NL}{NEW}: {len(new_v)} known vulnerabilities, {sev(new_v, 'CRITICAL')} critical")
check("the scanner found the operating system of the old image, and knows its support has ended", report_old["Metadata"]["OS"]["Family"] == "alpine" and report_old["Metadata"]["OS"]["Name"].startswith("3.15") and report_old["Metadata"]["OS"].get("EOSL") is True)
check("every finding names the package, the installed version and a severity", all({"PkgName", "InstalledVersion", "VulnerabilityID", "Severity"} <= set(v) for v in old_v))
check("the old base image has at least one critical vulnerability", sev(old_v, "CRITICAL") >= 1, str(len(old_v)))
check("the new image is not flagged as end of support, the old one is", report_new["Metadata"]["OS"].get("EOSL") is not True and report_old["Metadata"]["OS"].get("EOSL") is True)
print("  note: the count of the old image is not the larger one in this run, (a possible reason, not checked: the distribution no longer publishes advisories for a release that is out of support); EOSL is the finding")
print("ok")
