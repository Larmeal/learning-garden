# Kubernetes: sources

The books are kept outside the repo, as PDFs under `E:\Books\DevOps & Cloud\Containers & Orchestration\Orchestration\`. They were converted to text with PyMuPDF into a scratch folder outside the repo, with a marker for every PDF page.
A citation in a lesson gives the section or chapter and the **printed** page where the section starts, for example `Core Kubernetes หัวข้อ 2.3 หน้า 29`, never the section sign or "ch.".

## Books that are cited

| Short name | Book | Printed page = PDF page minus | Checked on |
|---|---|---|---|
| KUR | Kubernetes: Up and Running, 2nd edition (Burns, Beda, Hightower, O'Reilly, 2019) | 20 | PDF 66 = page 46 (Thinking with Pods), 74 = 54 (Liveness Probe), 97 = 77 (Service DNS), 110 = 90 (Ingress Spec Versus Ingress Controllers), 134 = 114 (Deployment Internals) |
| CORE | Core Kubernetes (Vyas and Love, Manning, 2022) | 25 | PDF 34 = page 9 (1.6), 232 = 207 (11.2), 252 = 227 (12.2) |
| PROG | Programming Kubernetes (Hausenblas and Schimanski, O'Reilly, 2019) | 18 | PDF 38 = page 20 (The HTTP Interface of the API Server), 94 = 76 (Validating Custom Resources), 123 = 105 (chapter 6) |
| PAT | Kubernetes Patterns (Ibryam and Huss, O'Reilly, 2019) | 20 | PDF 67 = page 47 (Automated Placement), 83 = 63 (Batch Job), 107 = 87 (Stateful Service), 223 = 203 (Elastic Scale) |
| HELM | Learning Helm (Butcher, Farina and Dolitsky, O'Reilly, 2021) | 14 | PDF 32 = page 18, 44 = 30, 51 = 37 |

The offsets were taken from the page numbers printed at the top or bottom of the text of each PDF page (a script counted the most common difference), and then checked by hand on the pages above.
The figures of the books could not be seen, only the text around them.

## Books that exist and were not cited

| Book | Note |
|---|---|
| Kubernetes Up and Running, 3rd edition, early release (one chapter only, no printed pages) | converted, not used |
| Production Kubernetes (Rosso et al.) | converted, not opened for a lesson |
| Cloud Native DevOps with Kubernetes (Arundel and Domingus) | converted, not opened for a lesson |
| Networking and Kubernetes (Strong and Lancey) | cited by the Networking subject, not by this one |
| Certified Kubernetes Administrator and Security Specialist study guides, Kubernetes Operators, Platform Engineering on Kubernetes | not opened |

The books were printed in 2019 and 2022, and Kubernetes has moved on. Where this cluster differs from a book, the lesson says so (for example Pod Security Policy, which the books describe, was removed and replaced by Pod Security Admission, which the lesson ran).

## Kubernetes itself

Everything marked "ran" was run against the minikube profile `garden`: three nodes, Kubernetes v1.31.0, containerd 1.7.21, cgroup v2 (cgroupfs driver), CNI kindnet (`kindest/kindnetd:v20240813-c6f155d6`), the minikube addons `ingress` (ingress-nginx v1.11.2) and `metrics-server` (v0.7.2), kubectl client v1.30.6 and Helm v3.13.3.
The images used: busybox:1.37, nginx:1.28-alpine, alpine:3.22, curlimages/curl:8.11.1 and postgres:17-alpine (pulled on 2026-11-20; the tags move).
The Kubernetes source code was **not** read, and the Kubernetes documentation was not fetched: where a lesson says how something works inside, it says "ran", "book" or "author".
