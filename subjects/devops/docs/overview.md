# DevOps: overview

Built on 2026-11-19 from the owner's request: "lessons on DevOps concepts, mixing concepts and tools, tools only roughly, and put together a picture of what DevOps is", with the books of
`E:\books\DevOps & Cloud\` as the sources. The subject id is `devops` (never rename it: it is part of every URL and saved progress key).

## What it covers (14 lessons, 0 to 13, Thai and English, each with a quiz)

The loop that code travels from a developer's computer to the users, and that data from the users travels back along:

```
 Plan ─► Code ─► Build ─► Test ─► Release ─► Deploy ─► Operate ─► Monitor
   ▲                                                                │
   └──────────────── Feedback (alert, incident, metric) ◄───────────┘
```

| # | Slug | Lesson | Lab (`components/labs/devops/`) | Exercise (`subjects/devops/code/exercises/`) |
|---|---|---|---|---|
| 0 | `overview` | What DevOps is: where the time of a change goes, the cycle of ever rarer releases | `WaitLab` | `00_value_stream.py` |
| 1 | `version-control` | Version control as the base: long branches against small batches | `BatchLab` | `01_small_batches.py` |
| 2 | `ci` | Continuous integration: a git hook that runs a pipeline from `pipeline.toml` | `PipelineLab` | `02_ci_pipeline.py` |
| 3 | `config-secrets` | Environments, config and secrets | `EnvLab` | `03_config_secrets.py` |
| 4 | `artifacts` | Artifacts, images and registries: build once, promote by moving a tag | `ArtifactLab` | `04_artifact_registry.py` |
| 5 | `release` | Releasing safely: all at once, blue-green, rolling, canary, feature flag | `ReleaseLab` | `05_release_strategies.py` |
| 6 | `iac` | Infrastructure as code with the real Terraform (local provider) | `IacLab` | `06_infrastructure_as_code.py` |
| 7 | `gitops` | Orchestration and GitOps: a controller that drives Docker from a Git repository | `ReconcileLab` | `07_gitops_reconcile.py` |
| 8 | `observability` | Metrics, logs and traces, and a real Prometheus | `ThreeViewsLab` | `08_observability.py` |
| 9 | `slo` | SLI, SLO, error budget and burn rate alerts | `BudgetLab` | `09_slo_error_budget.py` |
| 10 | `incidents` | An incident from the tag in Git to a blameless postmortem | `IncidentLab` | `10_incident_postmortem.py` |
| 11 | `devsecops` | Secret scan over history, SBOM matched again, a real Trivy scan | `GatesLab` | `11_devsecops.py` |
| 12 | `metrics` | The four DORA metrics from a Git history, platform engineering | `DoraLab` | `12_dora_metrics.py` |
| 13 | `capstone` | One change from commit to canary to rollback, everything joined | `CapstoneLab` | `13_capstone_pipeline.py` |

Phases: A overview (0), B build and integrate (1 to 3), C deliver (4 to 7), D run the system (8 to 10), E improve and join (11 to 13).

## How it is built

- `code/` is its own `uv` project with no dependencies. `devlab.py` has the helpers, `ci_runner.py` is the small CI server (used by 02 and 13), `gitops.py` the small controller (07 and 13),
  `slolab.py` the synthetic month of requests (09 and 10). `python verify.py` re-runs everything (217 checks, about 8 minutes).
- Every exercise prints `ok` lines and asserts what its lesson says. Seven of them feed a lab with JSON written by `--write`:
  `loop.json` (00), `release.json` (05), `secrets.json` (03), `observe.json` (08), `budget.json` (09), `incident.json` (10), `dora.json` (12), `capstone.json` (13).
- The labs share `labs/devops/dv.tsx` (a segmented control, a tile, an arrow, a dot, a jar) and the `ib-` and `nw-` classes of the Iceberg and Networking labs, and the step and clock players of the Spark labs.

## Decisions

- **Concepts and tools mixed, tools only roughly.** Each lesson touches its tools (Git, GitHub Actions, Docker, Terraform, Prometheus, Trivy) enough to see where they sit on the loop, and links to the
  Docker and Git subjects for the details instead of repeating them. Kubernetes did not exist in the garden when this was written, so lesson 7 uses small Docker containers and a controller written for the exercise.
- **Everything that can run on one computer runs.** Real Git hooks, a real registry (`registry:3`), the real Terraform with the `local` provider, a real Prometheus (`prom/prometheus:v3.5.0`), a real Trivy (`aquasec/trivy:0.67.2`).
  What needs an account or a cluster is said to be not run.
- **Honest about invented data.** Lessons 0, 9, 10 and 12 use data or times that the author set (example hours, a synthetic month, the minutes a person takes, which releases fail). The exercises check the calculation,
  and every lesson says which numbers are invented and that the exercise does not prove the claim of the book that rests on them.

## Backlog (not done)

- A page on Kubernetes and Helm once the `k8s` subject exists (lessons 7 and 13 link to the Docker subject now); real Argo CD or Flux against a `kind` cluster.
- GitHub Actions run for real (needs GitHub); the `act` tool is not installed.
- Ansible and Packer (named in lesson 6, not run); OpenTelemetry and Grafana (named in lesson 8, not run).
- The Phoenix Project, Effective DevOps, Terraform Up and Running, the GitOps books and Cloud Native DevOps with Kubernetes were converted to text and searched, but no claim cites them (see `sources.md`).
- A deep-dive sub-page for any lesson (none was written); the owner has not read the Thai or seen the labs.
