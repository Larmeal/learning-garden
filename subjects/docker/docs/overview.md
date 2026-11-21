# Docker: overview

A learning path on Docker for a data engineer: what a container is, how images are built and stored, how data and networks work around a container, what the kernel does inside, and how to run a small data pipeline with Compose
and find the cause when it breaks. Thai and English, built on 2026-11-19 from three books (Docker in Action, Docker Up and Running, Container Security) and from runs against a real Docker Engine.

## Lessons

| # | Slug | Phase | Exercise | Labs |
|---|---|---|---|---|
| 1 | `containers` | A | `01_containers.py` | `RoomsLab`, `KernelStackLab` |
| 2 | `images-and-layers` | A | `02_images_layers.py` | `UnionLab`, `SharedLayersLab`, `AdditiveLab` |
| 3 | `container-lifecycle` | A | `03_lifecycle.py` | `LifecycleLab` |
| 4 | `dockerfile` | B | `04_dockerfile.py` | `DockerfileLab` |
| 5 | `build-cache` | B | `05_build_cache.py` | `CacheLab` |
| 6 | `small-and-safe-images` | B | `06_small_safe_images.py` | `MultiStageLab` |
| 7 | `volumes` | C | `07_volumes.py` | `VolumeLab` |
| 8 | `networks` | C | `08_networks.py` | `NetworkLab` |
| 9 | `compose` | C | `09_compose.py` | `ComposeLab` |
| 10 | `namespaces-and-cgroups` | D | `10_namespaces_cgroups.py` | `NamespaceLab`, `CgroupLab` |
| 11 | `images-inside` | D | `11_image_inside.py` | `ImageInsideLab` |
| 12 | `capstone-pipeline` | E | `12_capstone_pipeline.py` | `PipelineLab` |

Every lesson has a quiz page (4 or 5 questions, Thai and English). Sixteen labs in all; every lab takes `lang`, shares `ib.tsx` and the `ib-` classes with the Iceberg labs, and reads its numbers from a JSON file that an exercise wrote with `--write`.

## How it is checked

`code/verify.py` re-runs every exercise against the real `docker` command line and checks the engine version. Each exercise asserts what its lesson prints, and `dlab.py` labels everything an exercise creates with `dlab=1` and removes it at the end.
The books are a second source (tag book), and claims that are only read, or that came from the author's own inference, are tagged so in the sources table at the end of each lesson.

## What the exercises found that a reader may not expect

- Docker 29 removed `NetworkSettings.IPAddress`; the books use it.
- `docker stop` without `-t` took about 3.3 s on this engine, not 10 s; the cause was not looked for.
- `--no-cache` still reports `WORKDIR` as CACHED; the cause was not looked for.
- BuildKit sends only the files a COPY needs, so an unused 20 MB file next to the Dockerfile is not sent (the books describe the old builder).
- `WORKDIR` adds a layer (it creates the folder) although `docker history` shows 0B.
- Namespace numbers are reused after a container ends, so two containers must be compared while both run.
- The manifest that `docker save` writes has a different hash from the manifest on Docker Hub, with the same config.

## Not run (and why)

Swarm and Kubernetes (the subject is single-host), a registry on the internet (nothing was pushed to Docker Hub), Windows containers, rootless Docker and Podman, seccomp and AppArmor profiles, user namespaces with `userns-remap`, volume drivers other than local,
image scanning and signing, cgroup v1, a GPU, and the Docker source. These are the backlog of a second pass.
