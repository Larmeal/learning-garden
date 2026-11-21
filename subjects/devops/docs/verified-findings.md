# DevOps: verified findings

Every claim of a lesson carries one tag:

- **ran** (Thai "รัน"): an exercise in `subjects/devops/code/exercises/NN_*.py` asserts it. `python verify.py` re-runs all of them.
- **book** (Thai "หนังสือ"): chapter and printed page of a book of `E:\books\DevOps & Cloud\` (see `sources.md` for the page offsets; The DevOps Handbook has no printed page numbers, so only its chapter is cited).
- **author** (Thai "ผู้เขียน"): advice, framing or an inference.
- **not run** ("ไม่ได้รัน"): said next to anything that could not be run here.

Tested with Git 2.56.1 (Windows), Docker Engine 29.9.3 (Docker Desktop, WSL2), Terraform 1.16.6 (provider hashicorp/local 2.5), Python 3.12, `registry:3`, `prom/prometheus:v3.5.0`, `aquasec/trivy:0.67.2`.

**Invented data, said in the lessons:** 00 (example hours of a hand-off process and of a pipeline), 09 (a synthetic month of requests with a fixed seed), 10 (the minutes a person takes: 5, 10, 35 and 3), 12 (which releases fail and the restore times).
The exercises check the arithmetic and the behaviour of the code; none of them proves a claim that rests on those numbers.

| Lesson | Claim | Tag |
|---|---|---|
| 0 | A change handed between teams has 19 hours of work and 178 hours of waiting; a pipeline cuts the waiting by more than 95% | ran 00 (example numbers) |
| 0 | A finished change waits 11 hours (daily release) to 349.8 hours (every 4 weeks) | ran 00 (example numbers) |
| 0 | Dev and Ops had opposing goals, the cycle of ever rarer releases, the goal of DevOps | book FDSD preface pp. xvi to xvii |
| 0 | DORA table of 2024 (182x, 127x, 8x, 2,293x) | book FDSD preface p. xv (cites a report, not checked) |
| 0 | The Three Ways | book DOH ch. 1 |
| 1 | Two long branches merge with no conflict and the tests fail; bisect lands on the merge commit in 3 runs; 11 commits in doubt | ran 01 |
| 1 | Small batches: the failure shows while 2 commits are unpushed | ran 01 |
| 1 | Space station picture, late integration, trunk-based development, conflicts hurt because branches live long | book FDSD ch. 5 pp. 177 to 179 |
| 2 | post-receive hook runs a runner; lint, test, build; fail fast; no artifact for a red commit; the pipeline comes from the commit | ran 02 |
| 2 | Same commit built twice gives byte-identical zip (fixed times in the zip) | ran 02 |
| 2 | Gates and transformations; webhook instead of running by hand | book GCD ch. 2 pp. 21 to 22, 27 to 29 |
| 2 | GitHub Actions workflow file (on, jobs, runs-on, steps) | book LGA ch. 4 pp. 41 to 42 (not run) |
| 3 | One app.py (sha256 3f00593d55ea) prints different lines in dev, staging, prod; missing variable stops with exit code 2; parity check | ran 03 |
| 3 | ENV in a Dockerfile readable from docker history; -e from docker inspect; a mounted file only from inside (a 3 by 3 table) | ran 03 |
| 3 | dev, staging, prod; "do not store secrets as plaintext"; three groups of secrets | book FDSD ch. 6 pp. 228 to 229, ch. 8 pp. 348 to 350 |
| 4 | Same files built twice without cache give different image IDs; digest equals what the registry reports; staging and prod tags on one digest; a moved tag leaves the old digest answering; two containers from one digest | ran 04 |
| 4 | Package once, use the same package at every stage; an image that lives on our computer needs a registry | book DOH ch. 9; FDSD ch. 3 p. 123 |
| 5 | Smoke test and health check pass on a buggy version; failures 32, 32, 18, 3, 3 for all-at-once, blue-green, rolling, canary, flag; no failure after rollback | ran 05 |
| 5 | Definitions of rolling, blue-green, canary, feature toggle; blue-green needs twice the servers | book FDSD ch. 5 pp. 200 to 205 |
| 5 | Speed of rollback per strategy (seconds, minutes) | author (from the mechanism, not timed) |
| 6 | plan 2 to add; apply; state lists 2; second plan No changes; changing a variable gives 1 to add 1 to destroy with must be replaced; hand edit and hand deletion planned as create; destroy empties the state | ran 06 (Terraform, local provider only) |
| 6 | Reasons for IaC; families of tools | book FDSD ch. 2 pp. 39 to 40, 61 |
| 7 | A controller creates, replaces and removes containers to match desired.json; self-healing; release is a commit; rollback is git revert; history has 3 lines | ran 07 |
| 7 | Orchestration problems; GitOps definition and principles | book FDSD ch. 3 pp. 82 to 83; GOC 1.1 pp. 1 to 2, 1.2 p. 2 |
| 8 | Counters 55 and 5; cumulative histogram (45, 45, 45, 60, 60); mean 39 ms hides a slow quarter; logs name 5 failures; one trace id in two services with parent and child; real Prometheus gives 5, 60 and 2 | ran 08 |
| 8 | Logs, metrics; counters and cumulative histograms | book FDSD ch. 10 pp. 450, 461; PUR ch. 3 pp. 43 to 55 |
| 9 | 99.9% allows 43.2 minutes per 30 days and about 10 minutes a week; SLI 99.95%; 50% of the budget used; one incident eats 31%; burn rate 14.4 for 1 hour uses 2% | ran 09 (synthetic data) |
| 9 | The 5% per minute rule pages 25 times (24 at night); the burn rate rule pages once, 4 minutes after the deploy | ran 09 (synthetic data) |
| 9 | SLO, SLA, nines; error budget | book FDSD ch. 10 pp. 462, 463, 484 |
| 9 | The value 14.4 and the windows of 1 hour and 5 minutes | author (SRE practice; not in a book of this path) |
| 10 | Tags v1.1 (14:00) and v1.1.1 (14:19) read from Git; time to detect 4 min, to recover 21 min; 34%, 16%, 9% of the month's budget in three ways of working; a postmortem with every section and no name | ran 10 |
| 10 | The 5, 10, 35 and 3 minutes of people | author (assumptions) |
| 10 | Blameless post-mortems | book DOH ch. 19 |
| 11 | A scan of the current files finds no key, a scan of the history does, git log -S names two commits; an SBOM matches 1 advisory on day 1 and 3 on day 30 (invented advisories); Trivy finds 101 (11 critical) on nginx:1.21-alpine and flags EOSL | ran 11 |
| 11 | Why an out-of-support image may show fewer findings | author (a guess, not checked) |
| 11 | Security in daily work; software supply chain; SBOM | book DOH ch. 22 |
| 12 | Frequency 3 and 80, median lead time 200 and 10 hours, failure rate 33% and 10%, restore 305 and 10 minutes, read from commits and tags | ran 12 (made-up data) |
| 12 | Start with the four DORA metrics; internal developer platforms | book FDSD ch. 10 p. 466, ch. 11 pp. 501 to 502 |
| 12 | Metrics tied to rewards get distorted | author (opinion) |
| 13 | A push builds an image in a registry; a config commit becomes containers; v2 passes CI; the canary got 20 requests and 5 failed (25%); git revert removes it; the v3 test fails on v2 code; three images, four config commits, containers on the last image | ran 13 |

## Not checked

GitHub Actions, Jenkins, Kubernetes, Argo CD, Flux, Helm, Ansible, Packer, OpenTofu, Vault, real registries with a login, real clouds, Grafana, Alertmanager, OpenTelemetry, Loki, Jaeger, Backstage, PagerDuty,
nginx / Argo Rollouts / Istio, image signing, SAST and DAST. The books were read as text; no figure was seen.
