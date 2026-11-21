# DevOps: sources

The books are kept outside the repo (`E:\books\DevOps & Cloud\...`). They are PDFs, not markdown clippings; the text was extracted with PyMuPDF (`pdftotext` shifts capital letters) into a scratch folder
and searched. A citation in a lesson gives the chapter and the **printed** page where the section starts, for example `Fundamentals of DevOps and Software Delivery บทที่ 5 หน้า 178`, never the section sign or "ch.".
No figure of any book was seen (a text extract has captions and the text around a figure, not the picture).

## Books that are cited

| Short name | Book (path under `E:\books\DevOps & Cloud\`) | Printed page = PDF page minus | Checked on |
|---|---|---|---|
| FDSD | Fundamentals of DevOps and Software Delivery, Brikman (`DevOps Practices/`) | 30 | PDF 61 = page 31, 62 = 32, 101 = 71, 193 = 163 (chapter 1 starts at PDF 31 = page 1); the preface has roman numbers (PDF 17 = xv, 18 = xvi, 19 = xvii) |
| GCD | Grokking Continuous Delivery (`CI-CD & GitOps/`) | 34 | PDF 54 = page 20, 55 = 21, 56 = 22, 61 = 27, 63 = 29 |
| LGA | Learning GitHub Actions, Laster (`CI-CD & GitOps/`) | 22 | PDF 61 = page 39, 63 = 41, 64 = 42 |
| PUR | Prometheus Up and Running 2nd edition (`Monitoring & Logging/`) | 16 | PDF 61 = page 45, 63 = 47, 101 = 85 |
| GOC | GitOps Cookbook (`CI-CD & GitOps/`) | 18 | PDF 19 = page 1, 20 = 2, 25 = 7, 27 = 9 |
| DOH | The DevOps Handbook, second edition (`DevOps Practices/`) | none: the PDF has **no printed page numbers** and its Contents lists none | cited by chapter number only |

Pages cited by the lessons: FDSD preface xv, xvi, xvii; chapter 2 pages 39 to 40 and 61; chapter 3 pages 82 to 83 and 123; chapter 5 pages 177 to 179, 200 to 206; chapter 6 pages 228 to 229;
chapter 8 pages 348 to 350; chapter 10 pages 450, 461, 462, 463, 466 and 484; chapter 11 pages 501 to 502. GCD chapter 2 pages 20 to 22 and 27 to 29. LGA chapter 4 pages 41 to 42.
PUR chapter 3 pages 43 to 55. GOC section 1.1 pages 1 to 2 and 1.2 page 2. DOH chapters 1, 7, 9, 19 and 22 (chapter number only).

## Books that are not cited

The text of these was extracted and searched while planning, and **no claim of any lesson cites them**:

- The Phoenix Project (a novel), Effective DevOps, Terraform Up and Running (Brikman; its page numbers restart per chapter in the PDF), Infrastructure as Code (Morris), GitOps and Kubernetes (Yuen et al.),
  Pipeline as Code, Cloud Native DevOps with Kubernetes and the other books of `Containers & Orchestration` (Kubernetes is the subject of another path, not built when this was written).
- The Site Reliability Engineering books are **not** in `E:\books`. The burn rate of 14.4 over a window of one hour and one of five minutes (lesson 9) is practice that the author knows from SRE work; the exercise checks its arithmetic
  only, and the lesson says that it is not read from a book of this path.

## Tools, versions and what was fetched

| Tool | Version run | Note |
|---|---|---|
| Git | 2.56.1 (Windows) | hooks run through the `sh` of Git for Windows |
| Docker Engine | 29.9.3 (Docker Desktop, WSL2) | images `python:3.13-slim`, `alpine:3.22`, `registry:3`, `prom/prometheus:v3.5.0`, `aquasec/trivy:0.67.2`, `nginx:1.21-alpine`, `nginx:1.28-alpine` pulled from Docker Hub |
| Terraform | 1.16.6 | provider `hashicorp/local` 2.5 downloaded from the registry |
| Python | 3.12 (standard library only) | |

## Not run (said so in the lessons)

GitHub Actions, Jenkins, Kubernetes, Argo CD, Flux, Helm, Ansible, Packer, OpenTofu, Vault, Docker Hub / ECR / GHCR with a login, real AWS, GCP or Azure, Grafana, Alertmanager, OpenTelemetry, Jaeger, Loki,
Backstage, PagerDuty, nginx, Argo Rollouts or Istio for the release strategies, image signing, SAST and DAST.
