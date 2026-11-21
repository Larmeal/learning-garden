"""Lesson 6: smaller and safer images. Base image, multi-stage build, a user that is not root, and a secret that stays out of the image.

Asserts the size of the same program on three base images, that a multi-stage build leaves the compilers and the big base behind, that `docker build --target` stops at a
named stage, that a process started as a non-root user cannot write where root owns the folder until `COPY --chown` fixes it, and that a build secret mounted with
`--mount=type=secret` can be read during the build but is not in the image, its history, or the running container (unlike an ARG). `--write` saves the sizes as
site/src/components/labs/docker/smallimages.json for the lab.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dlab import ALPINE, LABEL, LABS, PYTHON, check, docker, fresh_dir, inspect, main_guard, mb, run, show, table, write_json  # noqa: E402

WRITE = "--write" in sys.argv
FULL = "python:3.13"
ALP = "python:3.13-alpine"
APP = 'import six\nprint("six", six.__version__)\n'


def build(tag: str, ctx: Path, text: str, *extra: str, check_ok: bool = True):
    (ctx / "Dockerfile").write_text(text, encoding="utf-8")
    return run("build", "--progress=plain", "--label", LABEL, "-t", tag, *extra, str(ctx), check=check_ok)


def main() -> None:
    # ---- 1. the same program on three base images ----
    ctx = fresh_dir("sizes")
    (ctx / "app.py").write_text(APP, encoding="utf-8")
    sizes = {}
    for label, base in (("python:3.13", FULL), ("python:3.13-slim", PYTHON), ("python:3.13-alpine", ALP)):
        tag = "dlab-size-" + label.split(":")[1].replace(".", "")
        build(tag, ctx, f"FROM {base}\nRUN pip install --no-cache-dir six==1.17.0\nCOPY app.py /app/app.py\nCMD [\"python\", \"/app/app.py\"]\n")
        out = docker("run", "--rm", "--label", LABEL, tag)
        sizes[label] = (mb(inspect(tag)["Size"]), out)
    show("the same three-line program on three base images", table([[k, v[0], v[1]] for k, v in sizes.items()], ["base image", "image size MB", "prints"]))
    check("it prints the same thing on all three", len({v[1] for v in sizes.values()}) == 1)
    check("the full image is about 9 times the slim one and the alpine one about 40% of the slim one", sizes["python:3.13"][0] > 8 * sizes["python:3.13-slim"][0] and sizes["python:3.13-alpine"][0] < 0.5 * sizes["python:3.13-slim"][0], str(sizes))
    has_gcc = {b: run("run", "--rm", "--label", LABEL, b, "sh", "-c", "which gcc", check=False).returncode == 0 for b in (FULL, PYTHON)}
    check("the full image carries a C compiler, the slim one does not (less to attack, less to patch)", has_gcc[FULL] and not has_gcc[PYTHON], str(has_gcc))

    # ---- 2. multi-stage: build with the big image, ship with the small one ----
    mctx = fresh_dir("multi")
    (mctx / "app.py").write_text(APP, encoding="utf-8")
    multi = f"""FROM {FULL} AS build
RUN pip install --no-cache-dir --target /deps six==1.17.0

FROM {PYTHON}
COPY --from=build /deps /deps
ENV PYTHONPATH=/deps
COPY app.py /app/app.py
CMD ["python", "/app/app.py"]
"""
    build("dlab-multi", mctx, multi)
    single = sizes["python:3.13"][0]
    final = mb(inspect("dlab-multi")["Size"])
    out = docker("run", "--rm", "--label", LABEL, "dlab-multi")
    show("single stage on python:3.13 against a multi-stage build", table([["single stage (python:3.13)", single], ["multi-stage (build on python:3.13, ship on slim)", final]], ["Dockerfile", "image size MB"]))
    check("the multi-stage image still runs the program", out == sizes["python:3.13"][1], out)
    check("and it is as small as the slim base plus the package, far below the single-stage image", final < 125 and final < single / 8, f"{final} MB vs {single} MB")
    check("the compiler of the build stage is not in the final image", run("run", "--rm", "--label", LABEL, "dlab-multi", "sh", "-c", "which gcc", check=False).returncode != 0)
    layer_ids_build = set(inspect(FULL)["RootFS"]["Layers"])
    check("none of the layers of the big build image are in the final image", not (layer_ids_build & set(inspect("dlab-multi")["RootFS"]["Layers"])))
    stop = build("dlab-stage", mctx, multi, "--target", "build")
    stage = inspect("dlab-stage")
    check("--target build stops at the first stage: that image is the big one", mb(stage["Size"]) > 1000, str(mb(stage["Size"])))
    del stop

    # ---- 3. a user that is not root ----
    uctx = fresh_dir("user")
    (uctx / "app.py").write_text("import os\nopen('/app/out.txt', 'w').write('ok')\nprint('uid', os.getuid(), 'wrote /app/out.txt')\n", encoding="utf-8")
    common = f"FROM {PYTHON}\nRUN useradd --system --uid 10001 app && mkdir /app && chown root:root /app && chmod 755 /app\n"
    build("dlab-user-bad", uctx, common + 'COPY app.py /app/app.py\nUSER app\nCMD ["python", "/app/app.py"]\n')
    bad = run("run", "--rm", "--label", LABEL, "dlab-user-bad", check=False)
    show("as a non-root user in a folder that root owns", (bad.stdout + bad.stderr).strip().splitlines()[-1])
    check("the program runs as uid 10001, not root, and cannot write into a folder owned by root", bad.returncode != 0 and "PermissionError" in bad.stderr, bad.stderr[-160:])
    build("dlab-user-ok", uctx, f"FROM {PYTHON}\nRUN useradd --system --uid 10001 app && mkdir /app && chown app:app /app\nCOPY --chown=app:app app.py /app/app.py\nUSER app\nCMD [\"python\", \"/app/app.py\"]\n")
    ok = docker("run", "--rm", "--label", LABEL, "dlab-user-ok")
    check("with the folder and the file given to the app user, it writes fine", ok == "uid 10001 wrote /app/out.txt", ok)
    as_root = docker("run", "--rm", "--label", LABEL, "--user", "0", "dlab-user-ok", "id", "-u")
    check("--user on docker run overrides the USER of the image", as_root == "0")
    default_user = docker("run", "--rm", "--label", LABEL, PYTHON, "id", "-u")
    check("without any USER line a container runs as root (uid 0) by default", default_user == "0")

    # ---- 4. a secret that is not in the image ----
    sctx = fresh_dir("secret")
    secret_value = "s3cr3t-value-for-the-test"
    (sctx / "token.txt").write_text(secret_value, encoding="utf-8")
    build("dlab-secret", sctx, f"FROM {ALPINE}\nRUN --mount=type=secret,id=tok sh -c 'wc -c < /run/secrets/tok > /length.txt'\nARG LEAKY=x\nCMD [\"sh\", \"-c\", \"cat /length.txt; ls /run/secrets 2>&1\"]\n", "--secret", f"id=tok,src={sctx / 'token.txt'}")
    done = run("run", "--rm", "--label", LABEL, "dlab-secret", check=False)
    out = (done.stdout + done.stderr).strip()
    hist = docker("history", "--no-trunc", "--format", "{{.CreatedBy}}", "dlab-secret")
    show("what the running container sees", out)
    check("the RUN line could read the secret while building (it wrote its length, 25)", out.splitlines()[0].strip() == str(len(secret_value)), out)
    check("the secret is not in the image's history", secret_value not in hist)
    check("and there is no /run/secrets in the running container", "No such file" in out.splitlines()[-1], out)
    saved = fresh_dir("save") / "image.tar"
    run("save", "-o", str(saved), "dlab-secret")
    check("the value is nowhere in the saved image either (searched every byte of the tar)", secret_value.encode() not in saved.read_bytes())

    if WRITE:
        write_json(LABS / "smallimages.json", {"bases": {k: v[0] for k, v in sizes.items()}, "single": single, "multi": final, "stageMb": mb(stage["Size"])})


if __name__ == "__main__":
    main_guard(main)
