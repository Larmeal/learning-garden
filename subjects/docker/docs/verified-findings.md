# Docker: verified findings

Tags: **ran** (an exercise in `code/exercises/` asserts it), **book** (section and printed page, see `sources.md`), **author** (an inference or advice, marked so in the lesson), **not run** (said so in the lesson).
Written against Docker Engine 29.2.1 and Docker Compose v5.7.0 (Docker Desktop, WSL2, overlay2, cgroup v2); the whole set was run again on Engine 29.9.3 and passed.

| Lesson | Exercise | Checks | Main claims (all ran unless marked) |
|---|---|---|---|
| 1 containers | `01_containers.py` | 22 | one kernel for every image; the program is PID 1 inside and an ordinary process outside; a container lives as long as its process; two containers of one image do not share files; `NetworkSettings.IPAddress` is gone in Docker 29 (the books use it). Book: not a VM (DIA 1.1.3), ten kernel features (1.1.4). |
| 2 images and layers | `02_images_layers.py` | 29 | layer counts, shared base layers, `docker diff` A/C/D, copy-on-write copies the whole file (20 MB), a later `rm` does not shrink the image, tags are names, overlay2 lower directories. Book: DIA 3.3, 7.2. |
| 3 life of a container | `03_lifecycle.py` | 37 | states and commands, exit codes 126/127/137/143, `docker stop` against SIGTERM handling (5.3 s, 0.4 s, 0.3 s), about 3.3 s without `-t` (reason not looked for), restart policies, `exec` refused when restarting or exited. Book: DIA 2.5, DUR p105. |
| 4 Dockerfile | `04_dockerfile.py` | 31 | which lines add layers (WORKDIR does), CMD/ENTRYPOINT in exec and shell form, PID 1 under shell form, ENV against ARG (ARG leaks in history), COPY against ADD, COPY owner is root. Book: DIA 8.1 to 8.2. |
| 5 build cache | `05_build_cache.py` | 18 | cache is a chain, order decides rebuild (3.5 s against 0.8 s), content not mtime, `--no-cache` leaves WORKDIR CACHED (reason not looked for), BuildKit sends only needed files, `.dockerignore`, COPY outside the context fails. Book: DIA 8.1, DUR p79. |
| 6 small and safe images | `06_small_safe_images.py` | 16 | 1121.1 / 126.8 / 54.1 MB, multi-stage 118.4 MB, `--target`, non-root user and `COPY --chown`, `--user` overrides, build secret not in history or tar. Book: DIA 10.2, 8.6.2. |
| 7 volumes | `07_volumes.py` | 19 | survival matrix for layer, volume, bind, tmpfs; bind mount both ways and read-only; volume filled from image, bind hides it; anonymous volumes pile up; Postgres on a volume. Book: DIA 4.1 to 4.6. |
| 8 networks | `08_networks.py` | 21 | default bridge has no name resolution, user-defined network has DNS at 127.0.0.11, networks are walled off, published port bound to 127.0.0.1, alias with two addresses, none and host, Postgres by name. Book: DIA 5.2, 5.3. |
| 9 compose | `09_compose.py` | 19 | names Compose creates, `service_healthy` against a plain list, `down` keeps the volume, `.env` and shell variables, `--scale`, profiles. Book: DIA 11.2 (idea only). |
| 10 namespaces and cgroups | `10_namespaces_cgroups.py` | 26 | six own namespaces and a shared user namespace, `--pid=container:`, `unshare`, cgroup files, OOM kill at 64 MB and 32 MB, CPU throttling, `--pids-limit`. Namespace numbers are reused after a container ends (cause is our inference). Book: CS 3, 4. |
| 11 inside an image | `11_image_inside.py` | 26 | OCI layout from `docker save`, blobs named by sha256, image id is the config hash, history and `empty_layer`, registry push sends missing layers (`Mounted from`), manifest digest, tag moves and digest does not, index of 7 platforms. `docker save` manifest hash differs from Docker Hub's (reason not looked for). Book: DIA 8.6.1, 9.3. |
| 12 capstone | `12_capstone_pipeline.py` | 24 | rows loaded and rejected, every safeguard from `docker inspect` and from inside (CapEff 0), secret file not in env or history, internal network, three breakages (1, 1, 137) and the command that tells them apart. Book: CS 2. |

Total: 288 checks in 12 exercises (`python verify.py`).

## Not run

Swarm, Kubernetes, a registry on the internet, Windows containers, rootless Docker, Podman, seccomp and AppArmor, `userns-remap`, volume drivers other than local, image scanning and signing, cgroup v1, the Docker source (moby), a real setuid attack, `-p 8000:8000` without an address, ONBUILD, VOLUME driver options, HEALTHCHECK in a Dockerfile, Compose `watch`, `extends` and `include`.
