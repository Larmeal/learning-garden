"""Lesson 2: an image is a stack of read-only layers, and a container adds one writable layer on top.

Asserts how many layers real images have, that two images built on one base share the base layers byte for byte, what `docker diff` reports for an added, changed
and deleted file (A, C, D), that changing a file of a lower layer copies the whole file up, that a file deleted in a later layer still costs its size in the image,
that a tag is only a name for an image id, and that the container's overlay mount has one directory per layer. `--write` saves the real diff output and sizes as
site/src/components/labs/docker/layers.json for the labs.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dlab import ALPINE, BUSYBOX, LABEL, LABS, PYTHON, check, docker, fresh_dir, inspect, main_guard, mb, run, show, table, write_json  # noqa: E402

WRITE = "--write" in sys.argv


def build(tag: str, dockerfile: str) -> dict:
    ctx = fresh_dir(tag)
    (ctx / "Dockerfile").write_text(dockerfile, encoding="utf-8")
    run("build", "-q", "--label", LABEL, "-t", tag, str(ctx))
    return inspect(tag)


def layers(img: dict) -> list[str]:
    return img["RootFS"]["Layers"]


def main() -> None:
    # ---- 1. real images are stacks of layers ----
    rows = []
    infos = {}
    for ref in (ALPINE, BUSYBOX, PYTHON):
        info = inspect(ref)
        infos[ref] = info
        rows.append([ref, len(layers(info)), mb(info["Size"]), info["Id"].split(":")[1][:12]])
    show("docker image inspect: how many layers, how big", table(rows, ["image", "layers", "size MB", "image id"]))
    check("alpine is one layer, because it is one tarball of files", len(layers(infos[ALPINE])) == 1)
    check("python:3.13-slim is several layers (it is built on Debian step by step)", len(layers(infos[PYTHON])) >= 4, str(len(layers(infos[PYTHON]))))
    check("a layer id is a sha256 of the layer's content", all(l.startswith("sha256:") and len(l) == 71 for l in layers(infos[PYTHON])))
    check("the image id is 64 hex characters, docker shows the first 12", len(infos[ALPINE]["Id"].split(":")[1]) == 64)

    # ---- 2. two images on one base share its layers ----
    one = build("dlab-app1", f"FROM {ALPINE}\nRUN head -c 1048576 /dev/urandom > /data1\n")
    two = build("dlab-app2", f"FROM {ALPINE}\nRUN head -c 2097152 /dev/urandom > /data2\n")
    base = layers(infos[ALPINE])
    show("layer ids (first 12 hex digits) of the base and of the two images built on it", table(
        [["alpine:3.22", *[l[7:19] for l in base]],
         ["dlab-app1", *[l[7:19] for l in layers(one)]],
         ["dlab-app2", *[l[7:19] for l in layers(two)]]], ["image", "layer 1", "layer 2"]))
    check("each image has the base layer plus one layer of its own", len(layers(one)) == 2 and len(layers(two)) == 2)
    check("the first layer of both images is exactly the layer of alpine", layers(one)[0] == layers(two)[0] == base[0])
    check("the second layers differ because their files differ", layers(one)[1] != layers(two)[1])
    hist = docker("history", "--no-trunc", "--format", "{{.Size}}\t{{.CreatedBy}}", "dlab-app1").splitlines()
    check("docker history lists the RUN step with the 1 MB it wrote", any("1.05MB" in h and "data1" in h for h in hist), hist[0])
    user_size = [one["Size"] - infos[ALPINE]["Size"], two["Size"] - infos[ALPINE]["Size"]]
    check("the size an image adds on top of alpine is the size of the file in its own layer", abs(user_size[0] - 1048576) < 4096 and abs(user_size[1] - 2097152) < 4096, str(user_size))

    # ---- 3. what the writable layer records: A, C and D ----
    docker("run", "--name", "dlab-add", "--label", LABEL, BUSYBOX, "touch", "/mychange")
    docker("run", "--name", "dlab-del", "--label", LABEL, BUSYBOX, "rm", "/etc/passwd")
    docker("run", "--name", "dlab-chg", "--label", LABEL, BUSYBOX, "touch", "/etc/passwd")
    diffs = {k: docker("diff", f"dlab-{k}").splitlines() for k in ("add", "del", "chg")}
    show("docker diff after touch /mychange", "\n".join(diffs["add"]))
    show("docker diff after rm /etc/passwd", "\n".join(diffs["del"]))
    show("docker diff after touch /etc/passwd", "\n".join(diffs["chg"]))
    check("a new file is A", diffs["add"] == ["A /mychange"], str(diffs["add"]))
    check("a deleted file is D, and its folder is C because the folder changed", diffs["del"] == ["C /etc", "D /etc/passwd"], str(diffs["del"]))
    check("a changed file is C, and its folder is C", diffs["chg"] == ["C /etc", "C /etc/passwd"], str(diffs["chg"]))
    check("the image underneath was not touched: /etc/passwd is still in a new container", docker("run", "--rm", "--label", LABEL, BUSYBOX, "ls", "/etc/passwd") == "/etc/passwd")

    # ---- 4. copy-on-write: changing one byte copies the whole file up ----
    big = build("dlab-bigbase", f"FROM {ALPINE}\nRUN head -c 20971520 /dev/urandom > /big\n")
    docker("run", "--name", "dlab-cow", "--label", LABEL, "dlab-bigbase", "sh", "-c", "echo x >> /big")
    docker("run", "--name", "dlab-read", "--label", LABEL, "dlab-bigbase", "cat", "/big")
    rw_cow = inspect_size("dlab-cow")
    rw_read = inspect_size("dlab-read")
    show("size of the writable layer after reading a 20 MB file and after appending 2 bytes to it", table([["read only", rw_read], ["echo x >> /big", rw_cow]], ["container", "writable layer, bytes"]))
    check("reading a file writes nothing into the container's layer", rw_read < 4096, str(rw_read))
    check("appending 2 bytes copies the whole 20 MB file into the container's layer first", 20_971_520 <= rw_cow < 21_100_000, str(rw_cow))

    # ---- 5. layers only add: a file deleted later still costs its size ----
    kept = build("dlab-kept", f"FROM {ALPINE}\nRUN head -c 10485760 /dev/urandom > /big\nRUN rm /big\n")
    merged = build("dlab-merged", f"FROM {ALPINE}\nRUN head -c 10485760 /dev/urandom > /big && rm /big\n")
    rows = [["alpine:3.22", mb(infos[ALPINE]["Size"]), 1], ["write then rm, two RUN lines", mb(kept["Size"]), len(layers(kept))], ["write and rm in one RUN line", mb(merged["Size"]), len(layers(merged))]]
    show("image size when a 10 MB file is created and then deleted", table(rows, ["image", "size MB", "layers"]))
    check("deleting in a later layer does not shrink the image: it is still 10 MB bigger", kept["Size"] - infos[ALPINE]["Size"] >= 10_000_000, str(kept["Size"] - infos[ALPINE]["Size"]))
    check("the file is gone for the container even though the image still carries its bytes", docker("run", "--rm", "--label", LABEL, "dlab-kept", "sh", "-c", "ls /big 2>&1; true").endswith("No such file or directory"))
    check("doing both in one RUN line leaves no trace: the image is as small as alpine", merged["Size"] - infos[ALPINE]["Size"] < 4096, str(merged["Size"] - infos[ALPINE]["Size"]))

    # ---- 6. a tag is a name, the id is the identity ----
    docker("tag", ALPINE, "dlab-alias:1")
    a, b = inspect(ALPINE)["Id"], inspect("dlab-alias:1")["Id"]
    check("two names, one image id", a == b)
    docker("rmi", "dlab-alias:1")
    check("removing one name keeps the image while the other name exists", inspect(ALPINE)["Id"] == a)
    same_a = build("dlab-same", f"FROM {ALPINE}\nRUN echo same > /f\n")["Id"]
    same_b = build("dlab-same", f"FROM {ALPINE}\nRUN echo same > /f\n")["Id"]
    check("building the same Dockerfile twice gives the same image id (the second build is all cache)", same_a == same_b)

    # ---- 7. the container's file system is a mount of one directory per layer ----
    docker("run", "-d", "--name", "dlab-mount", "--label", LABEL, PYTHON, "sleep", "300")
    gd = inspect("dlab-mount")["GraphDriver"]
    lower = gd["Data"]["LowerDir"].split(":")
    n_layers = len(layers(infos[PYTHON]))
    show("container GraphDriver (paths are inside the Docker VM, not on Windows)", f"Name: {gd['Name']}\nkeys: {sorted(gd['Data'])}\nLowerDir entries: {len(lower)}  (image layers: {n_layers})")
    check("the storage driver here is overlay2", gd["Name"] == "overlay2")
    check("an overlay mount has a merged view, a writable upper directory, a work directory and the read-only lower ones", {"MergedDir", "UpperDir", "WorkDir", "LowerDir"} <= set(gd["Data"]))
    check("one lower directory per image layer, plus one more that Docker adds (its -init layer, not opened here)", len(lower) == n_layers + 1, f"{len(lower)} vs {n_layers}")

    # ---- 8. one container, three changes in a row, on an image of two layers (the story of the union lab) ----
    docker("run", "-d", "--name", "dlab-stack", "--label", LABEL, "dlab-app1", "sleep", "300")
    stack = [{"cmd": "", "diff": [], "sizeRw": inspect_size("dlab-stack")}]
    for cmd in ("touch /mychange", "touch /etc/passwd", "rm /data1"):
        docker("exec", "dlab-stack", "sh", "-c", cmd)
        stack.append({"cmd": cmd, "diff": docker("diff", "dlab-stack").splitlines(), "sizeRw": inspect_size("dlab-stack")})
    show("one container, three changes, docker diff after each", "\n\n".join(f"$ {s['cmd'] or '(nothing yet)'}\n" + "\n".join(s["diff"]) + f"\n   writable layer: {s['sizeRw']} bytes" for s in stack))
    check("the diff grows by exactly the entries each command caused", [len(s["diff"]) for s in stack] == [0, 1, 3, 4], str([len(s["diff"]) for s in stack]))
    check("the third command records a delete (D) for a file that lives in a lower layer", "D /data1" in stack[3]["diff"])
    check("the delete costs almost nothing in the container: it only hides the file", stack[3]["sizeRw"] < 8192, str(stack[3]["sizeRw"]))
    check("but the image still holds the 1 MB (a new container sees /data1)", docker("run", "--rm", "--label", LABEL, "dlab-app1", "sh", "-c", "wc -c < /data1") == "1048576")
    check("inside the container the file is gone", run("exec", "dlab-stack", "ls", "/data1", check=False).returncode != 0)

    if WRITE:
        write_json(
            LABS / "layers.json",
            {
                "storage": gd["Name"],
                "images": {ref: {"layers": len(layers(info)), "mb": mb(info["Size"])} for ref, info in infos.items()},
                "apps": {"dlab-app1": {"mb": mb(one["Size"]), "ownMb": mb(user_size[0])}, "dlab-app2": {"mb": mb(two["Size"]), "ownMb": mb(user_size[1])}},
                "baseMb": mb(infos[ALPINE]["Size"]),
                "layerIds": {"alpine": base[0][7:19], "app1": layers(one)[1][7:19], "app2": layers(two)[1][7:19]},
                "diff": diffs,
                "cow": {"fileMb": 20.97, "readBytes": rw_read, "writeBytes": rw_cow},
                "additive": {"baseMb": mb(infos[ALPINE]["Size"]), "keptMb": mb(kept["Size"]), "mergedMb": mb(merged["Size"])},
                "stack": stack,
                "lowerDirs": len(lower),
                "pythonLayers": n_layers,
            },
        )


def inspect_size(name: str) -> int:
    return int(docker("inspect", "--size", "-f", "{{.SizeRw}}", name))


if __name__ == "__main__":
    main_guard(main)
