# Docker: sources

The books are kept outside the repo, as PDFs under `E:\Books\DevOps & Cloud\Containers & Orchestration\Containerization\` and `E:\Books\Networking & Security\Security\Infrastructure & Cloud Security\`.
They were converted to text with PyMuPDF (`pdftotext` shifts capital letters) into a scratch folder outside the repo, with a marker for every PDF page. A citation in a lesson gives the section or chapter number and
the **printed** page where the section starts, for example `Docker in Action หัวข้อ 2.5.2 หน้า 42`, never the section sign or "ch.".

## Books that are cited

| Short name | Book | Printed page = PDF page minus | Checked on |
|---|---|---|---|
| DIA | Docker in Action, 2nd edition (Nickoloff and Kuenzli, Manning, 2019) | 26 | PDF 30 = page 4 (section 1.1.1), 31 = 5, 67 = 41 (section 2.5.1), 82 = 56 (section 3.3), 157 = 131 (section 7.2), 194 = 168 (section 8.6.1), 209 = 183 (section 9.3) |
| DUR | Docker Up and Running (Matthias and Kane, O'Reilly) | 22 | PDF 127 = page 105 (Stopping a Container), 128 = 106, 101 = 79 (Optimizing for the Cache) |
| CS | Container Security (Liz Rice, O'Reilly, 2020) | 18 | PDF 34 = page 16 (setuid and setgid), 41 = 23 (chapter 3, Control Groups), 49 = 31 (chapter 4, Container Isolation), 50 = 32 (Linux Namespaces) |

Pages cited by the lessons:

- DIA: 1.1.1 p3, 1.1.3 p5, 1.1.4 p6, 1.1.5 p7, 2.5.1 p41, 2.5.2 p42, 3.3 p56, 3.3.1 p57, 3.3.2 p58, 3.3.4 p60, 3.3.5 p60, 4.1 p63, 4.2 p64, 4.4 p68, 4.6 p77, 5.2 p83, 5.3 p89, 7.2.1 p131, 7.2.2 p134, 7.2.3 p137, 8.1 p145, 8.2.1 p149, 8.2.2 p153, 8.6.1 p168, 8.6.2 p169, 9.3 p183, 10.2 p199, 10.2.1 p200, 11.2 p229.
- DUR: Stopping a Container p105, Optimizing for the Cache p79.
- CS: chapter 2 p16 and p19, chapter 3 p23, chapter 4 p31 and p32.

The books were printed in 2020 and earlier, and Docker has moved on. What differs on Docker 29.2.1 and Compose v5.7.0 is listed in `verified-findings.md` and in the lessons: `NetworkSettings.IPAddress` is gone, `docker stop` without `-t`
waits about 3 s here, BuildKit sends only the files a COPY needs (the books describe the old builder), a classic `docker commit` workflow is not used, Compose is `docker compose` and not `docker stack deploy`, and the books explain cgroup v1 while this computer is on v2.
The figures of the books could not be seen, only their captions and the text around them (the text export has the labels of a figure but not the picture).

## Books that exist and were not cited

| Book | Note |
|---|---|
| Podman in Action (Daniel Walsh, Manning) | converted and not opened for a lesson; it would be the book for rootless containers, which the subject did not run |
| Container Security, first edition PDF (the second file of the same title in the folder) | the later converted file was used |
| Bootstrapping Microservices with Docker, Kubernetes, and Terraform (Ashley Davis) | not opened |

## Docker itself

Everything marked "ran" was written and first run against Docker Engine 29.2.1, and the whole set (288 checks) was run again at the end on Engine 29.9.3 after Docker Desktop had updated itself, with no change needed (Docker Desktop, WSL2 backend, Linux kernel 6.18.58.1-microsoft-standard-WSL2, storage driver overlay2, cgroup v2, runc) with Docker Compose v5.7.0 and Buildx v0.31.1. The Docker source (moby)
was **not** read: where a lesson says how the engine works inside, it says "ran" or "book" or "author". The Docker documentation was not fetched. Images used: alpine:3.22, busybox:1.37, python:3.13, python:3.13-slim, python:3.13-alpine,
postgres:17-alpine and registry:3 (pulled from Docker Hub on 2026-11-19; the tags move, so a later run may print other sizes).
