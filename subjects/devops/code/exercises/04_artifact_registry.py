"""Lesson 4: the container image as the artifact that moves, and the registry that keeps it.

Builds an image, pushes it to a registry that runs on this computer, and asserts the rules of "build once, deploy many":
a rebuild of the same files makes a different image (so you must not rebuild per environment), a digest names exactly one
image while a tag can be moved, and staging and prod can run the very same digest with different configuration.
"""

import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from devlab import check, docker, docker_ok, free_port, fresh, run, show, wait_until, write  # noqa: E402

NL = chr(10)


def L(*rows: str) -> str:
    return NL.join(rows) + NL


if not docker_ok():
    sys.exit("Docker is not running")

work = fresh("04_artifact")
write(work, "app.py", L("import os", "print('hello from version', os.environ.get('VERSION', '1'), 'in', os.environ.get('APP_ENV', '?'))"))
write(work, "Dockerfile", L("FROM python:3.13-slim", "WORKDIR /app", "COPY app.py .", 'CMD ["python", "app.py"]'))

port = free_port()
registry = f"localhost:{port}"
names = ["devops04-registry", "devops04-staging", "devops04-prod"]
created_images: list[str] = []
MANIFEST_TYPES = ", ".join(
    [
        "application/vnd.oci.image.index.v1+json",
        "application/vnd.oci.image.manifest.v1+json",
        "application/vnd.docker.distribution.manifest.v2+json",
        "application/vnd.docker.distribution.manifest.list.v2+json",
    ]
)


def digest_of(repo: str, tag: str) -> str:
    request = urllib.request.Request(f"http://{registry}/v2/{repo}/manifests/{tag}", method="HEAD", headers={"Accept": MANIFEST_TYPES})
    with urllib.request.urlopen(request) as response:
        return response.headers["Docker-Content-Digest"]


try:
    docker("run", "-d", "--name", names[0], "-p", f"127.0.0.1:{port}:5000", "registry:3")
    check("the registry answers on /v2/", wait_until(lambda: urllib.request.urlopen(f"http://{registry}/v2/").status == 200))

    # ---- 1. a rebuild makes a different image ----
    docker("build", "-q", "-t", "devops04-app:a", str(work))
    docker("build", "-q", "--no-cache", "-t", "devops04-app:b", str(work))
    created_images += ["devops04-app:a", "devops04-app:b"]
    id_a = docker("image", "inspect", "--format", "{{.Id}}", "devops04-app:a")
    id_b = docker("image", "inspect", "--format", "{{.Id}}", "devops04-app:b")
    show("docker image inspect (two builds of the same files)", f"{id_a[:19]}...{NL}{id_b[:19]}...")
    check("building the same files twice without cache gives two different image ids", id_a != id_b)
    layers_a = json.loads(docker("image", "inspect", "devops04-app:a"))[0]["RootFS"]["Layers"]
    layers_b = json.loads(docker("image", "inspect", "devops04-app:b"))[0]["RootFS"]["Layers"]
    check("the layers of the base image are shared, only what the build created can differ (the copy layer holds timestamps)", layers_a[:-1] == layers_b[:-1] and len(layers_a) == len(layers_b))

    # ---- 2. push once, name it by the commit ----
    sha = "3f9c1a7"
    docker("tag", "devops04-app:a", f"{registry}/shop:{sha}")
    created_images.append(f"{registry}/shop:{sha}")
    push_out = docker("push", f"{registry}/shop:{sha}")
    digest = digest_of("shop", sha)
    show(f"docker push {registry}/shop:{sha}", push_out.splitlines()[-1])
    check("the push printed the same digest the registry reports", digest in push_out, digest)
    check("a digest has the form sha256 and 64 hex characters", digest.startswith("sha256:") and len(digest) == 71)

    # ---- 3. promote by moving a tag, not by building ----
    for env in ("staging", "prod"):
        docker("tag", f"{registry}/shop:{sha}", f"{registry}/shop:{env}")
        docker("push", f"{registry}/shop:{env}")
        created_images.append(f"{registry}/shop:{env}")
    check("shop:staging and shop:prod point at the digest of the build", digest_of("shop", "staging") == digest_of("shop", "prod") == digest)

    # ---- 4. a tag can be moved, a digest cannot ----
    write(work, "app.py", L("import os", "print('hello from version', os.environ.get('VERSION', '2'), 'in', os.environ.get('APP_ENV', '?'))"))
    docker("build", "-q", "-t", f"{registry}/shop:v2", str(work))
    created_images.append(f"{registry}/shop:v2")
    docker("push", f"{registry}/shop:v2")
    docker("tag", f"{registry}/shop:v2", f"{registry}/shop:prod")
    docker("push", f"{registry}/shop:prod")
    digest_v2 = digest_of("shop", "v2")
    print(f"  digest of {sha}: {digest[:19]}...   digest of v2: {digest_v2[:19]}...")
    check("moving the tag prod to the new build changes what the name means", digest_of("shop", "prod") == digest_v2 != digest)
    check("the old digest still resolves in the registry", digest_of("shop", digest) == digest)
    tags = json.loads(urllib.request.urlopen(f"http://{registry}/v2/shop/tags/list").read())["tags"]
    show("GET /v2/shop/tags/list", str(sorted(tags)))
    check("the registry lists the four tags", sorted(tags) == sorted([sha, "staging", "prod", "v2"]), str(tags))

    # ---- 5. run the same digest in two environments ----
    for image in [i for i in created_images if i.startswith(registry)]:
        run(["docker", "rmi", "-f", image])
    ref = f"{registry}/shop@{digest}"
    docker("pull", "-q", ref)
    for name, env in ((names[1], "staging"), (names[2], "prod")):
        docker("run", "-d", "--name", name, "-e", f"APP_ENV={env}", ref, "sh", "-c", "python app.py; sleep 20")
    check("both containers started from one image id", docker("inspect", "--format", "{{.Image}}", names[1]) == docker("inspect", "--format", "{{.Image}}", names[2]))
    wait_until(lambda: "hello" in docker("logs", names[1]) and "hello" in docker("logs", names[2]))
    log_staging, log_prod = docker("logs", names[1]).strip(), docker("logs", names[2]).strip()
    show("docker logs", f"{log_staging}{NL}{log_prod}")
    check("same image, different environment value, different output", log_staging == "hello from version 1 in staging" and log_prod == "hello from version 1 in prod", f"{log_staging}|{log_prod}")
finally:
    for name in names:
        run(["docker", "rm", "-f", name])
    for image in created_images + ["devops04-app:a", "devops04-app:b"]:
        run(["docker", "rmi", "-f", image])
    run(["docker", "rmi", "-f", f"localhost:{port}/shop@sha256:none"])
print("ok")
