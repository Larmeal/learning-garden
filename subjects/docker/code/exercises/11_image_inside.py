"""Lesson 11: what an image is made of on disk and in a registry. Blobs named by their sha256, a manifest, a config, an index, and a registry that serves them over HTTP.

Asserts, from `docker save`, that an image is a folder of blobs named by the sha256 of their bytes, that the image id is the sha256 of the config blob, that the layer blobs are tar files
whose sha256 is the diff id, that the config's history records one line per Dockerfile instruction (and which of them made no layer), and that the manifest names the config and the
layers. Then, against a real registry (`registry:3`, in a container), that pushing sends only the layers the registry lacks, that the HTTP API shows tags, manifests and compressed layers,
that the digest of a manifest is the sha256 of its bytes, that a tag can move while a digest cannot, and that a tag of an official image points at an index of one manifest per platform.
`--write` saves the digests and sizes as site/src/components/labs/docker/imageinside.json for the lab.
"""

import hashlib
import json
import socket
import sys
import tarfile
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dlab import ALPINE, LABEL, LABS, REGISTRY, check, docker, fresh_dir, inspect, main_guard, run, show, table, write_json  # noqa: E402

WRITE = "--write" in sys.argv
SHA = lambda b: hashlib.sha256(b).hexdigest()  # noqa: E731
OCI_ACCEPT = "application/vnd.oci.image.manifest.v1+json, application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.v2+json"


def save(tag: str) -> dict[str, bytes]:
    out = fresh_dir("save-" + tag.replace(":", "-").replace("/", "-")) / "image.tar"
    run("save", "-o", str(out), tag)
    files = {}
    with tarfile.open(out) as t:
        for m in t.getmembers():
            if m.isfile():
                files[m.name] = t.extractfile(m).read()
    return files


def short(d: str) -> str:
    return d.replace("sha256:", "")[:12]


def http(url: str, accept: str | None = None) -> tuple[bytes, dict]:
    req = urllib.request.Request(url, headers={"Accept": accept} if accept else {})
    with urllib.request.urlopen(req, timeout=10) as r:
        return r.read(), dict(r.headers)


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main() -> None:
    # ---- 1. docker save: an image is a folder of blobs ----
    files = save(ALPINE)
    names = sorted(files)
    show("what docker save wrote for alpine:3.22", "\n".join(f"{n}  ({len(files[n])} bytes)" for n in names))
    blobs = {n.split("/")[-1]: b for n, b in files.items() if n.startswith("blobs/sha256/")}
    check("the file has the OCI layout: oci-layout, index.json, manifest.json and a blobs/sha256 folder", {"oci-layout", "index.json", "manifest.json"} <= set(names) and blobs)
    check("every blob is named by the sha256 of its own bytes (content addressing)", all(SHA(b) == name for name, b in blobs.items()))
    index = json.loads(files["index.json"])
    manifest_digest = index["manifests"][0]["digest"].split(":")[1]
    manifest = json.loads(blobs[manifest_digest])
    config_name = manifest["config"]["digest"].split(":")[1]
    config = json.loads(blobs[config_name])
    check("index.json points at one manifest blob", index["mediaType"].endswith("image.index.v1+json") and len(index["manifests"]) == 1)
    check("the manifest names a config blob and a list of layer blobs", manifest["config"]["digest"].startswith("sha256:") and len(manifest["layers"]) == 1)
    img_id = inspect(ALPINE)["Id"].split(":")[1]
    check("the image id that docker shows is the sha256 of the config blob", config_name == img_id)
    layer_name = manifest["layers"][0]["digest"].split(":")[1]
    check("the layer blob is a tar file, and its sha256 is the diff id written in the config", config["rootfs"]["diff_ids"] == [f"sha256:{layer_name}"] and tarfile.is_tarfile(__import__("io").BytesIO(blobs[layer_name])))
    with tarfile.open(fileobj=__import__("io").BytesIO(blobs[layer_name])) as lt:
        layer_names = lt.getnames()
    check("opening the layer shows the files of the operating system (alpine-release, busybox)", "etc/alpine-release" in layer_names and "bin/busybox" in layer_names)
    check("the config holds what docker run needs: the command, and the platform", config["config"]["Cmd"] == ["/bin/sh"] and config["os"] == "linux" and config["architecture"] in ("amd64", "arm64"))

    # ---- 2. our own image: history has one line per instruction ----
    ctx = fresh_dir("own")
    (ctx / "hello.txt").write_text("hello\n", encoding="utf-8")
    (ctx / "Dockerfile").write_text(f'FROM {ALPINE}\nENV GREETING=hi\nCOPY hello.txt /hello.txt\nCMD ["cat", "/hello.txt"]\n', encoding="utf-8")
    run("build", "-q", "--label", LABEL, "-t", "dlab-own:1", str(ctx))
    own = save("dlab-own:1")
    own_blobs = {n.split("/")[-1]: b for n, b in own.items() if n.startswith("blobs/sha256/")}
    own_index = json.loads(own["index.json"])
    own_manifest = json.loads(own_blobs[own_index["manifests"][0]["digest"].split(":")[1]])
    own_config = json.loads(own_blobs[own_manifest["config"]["digest"].split(":")[1]])
    hist = own_config["history"]
    made = [h for h in hist if not h.get("empty_layer")]
    show("history of dlab-own:1 (what created each step, and whether it made a layer)", table([[("layer" if not h.get("empty_layer") else "metadata only"), h["created_by"][:60]] for h in hist[-4:]], ["kind", "created by"]))
    check("the manifest lists the layer of alpine first, unchanged, then one layer of our own", len(own_manifest["layers"]) == 2 and own_manifest["layers"][0]["digest"] == manifest["layers"][0]["digest"])
    check("the history has more lines than there are layers: ENV and CMD are lines without a layer (empty_layer)", len(hist) > len(own_manifest["layers"]) and len(made) == 2, f"{len(hist)} lines, {len(made)} layers")
    own_layer = own_manifest["layers"][1]["digest"].split(":")[1]
    with tarfile.open(fileobj=__import__("io").BytesIO(own_blobs[own_layer])) as lt:
        own_files = lt.getnames()
    check("our layer holds only the file we copied", own_files == ["hello.txt"], str(own_files))
    check("the metadata is in the config: ENV and CMD", "GREETING=hi" in own_config["config"]["Env"] and own_config["config"]["Cmd"] == ["cat", "/hello.txt"])

    # ---- 3. a registry is a server of blobs and manifests ----
    port = free_port()
    docker("run", "-d", "--name", "dlab-registry", "--label", LABEL, "-p", f"127.0.0.1:{port}:5000", REGISTRY)
    base = f"http://127.0.0.1:{port}"
    for _ in range(30):
        try:
            http(base + "/v2/")
            break
        except Exception:  # noqa: BLE001
            time.sleep(1)
    host = f"localhost:{port}"
    docker("tag", "dlab-own:1", f"{host}/lesson/app:1")
    first = run("push", f"{host}/lesson/app:1")
    show("docker push, the first time", first.stdout.strip())
    check("the first push sends the layers the registry does not have yet", first.stdout.count("Pushed") >= 2, first.stdout)
    ctx2 = fresh_dir("own2")
    (ctx2 / "other.txt").write_text("other\n", encoding="utf-8")
    (ctx2 / "Dockerfile").write_text(f'FROM {ALPINE}\nCOPY other.txt /other.txt\n', encoding="utf-8")
    run("build", "-q", "--label", LABEL, "-t", f"{host}/lesson/other:1", str(ctx2))
    second = run("push", f"{host}/lesson/other:1")
    show("docker push of a second image on the same base", second.stdout.strip())
    check("pushing a second image on the same base sends only its own layer: the base layer is not uploaded again, the registry says Mounted from the other repository", "Mounted from lesson/app" in second.stdout and second.stdout.count("Pushed") == 1, second.stdout)
    cat = json.loads(http(base + "/v2/_catalog")[0])
    tags = json.loads(http(base + "/v2/lesson/app/tags/list")[0])
    check("the HTTP API lists the repositories and the tags", sorted(cat["repositories"]) == ["lesson/app", "lesson/other"] and tags["tags"] == ["1"], str((cat, tags)))
    mbytes, mheaders = http(base + "/v2/lesson/app/manifests/1", OCI_ACCEPT)
    reg_manifest = json.loads(mbytes)
    reg_digest = mheaders.get("Docker-Content-Digest", "")
    check("the digest of a manifest is the sha256 of its bytes", reg_digest == "sha256:" + SHA(mbytes), reg_digest)
    check("docker inspect remembers it as a RepoDigest", any(reg_digest in d for d in inspect(f"{host}/lesson/app:1")["RepoDigests"]))
    check("the config blob in the registry is the same bytes as local: its digest is the image id", reg_manifest["config"]["digest"] == f"sha256:{inspect('dlab-own:1')['Id'].split(':')[1]}")
    layer_media = reg_manifest["layers"][1]["mediaType"]
    reg_layer = reg_manifest["layers"][1]
    check("the layers in the registry are compressed (gzip), so their digests differ from the diff ids", "gzip" in layer_media and reg_layer["digest"].split(":")[1] != own_layer, layer_media)
    blob = http(f"{base}/v2/lesson/app/blobs/{reg_layer['digest']}")[0]
    check("a layer can be downloaded by its digest, and its sha256 is that digest", "sha256:" + SHA(blob) == reg_layer["digest"] and len(blob) == reg_layer["size"])

    # ---- 4. a tag moves, a digest does not ----
    ctx3 = fresh_dir("own3")
    (ctx3 / "hello.txt").write_text("a different hello\n", encoding="utf-8")
    (ctx3 / "Dockerfile").write_text(f'FROM {ALPINE}\nCOPY hello.txt /hello.txt\nCMD ["cat", "/hello.txt"]\n', encoding="utf-8")
    run("build", "-q", "--label", LABEL, "-t", f"{host}/lesson/app:1", str(ctx3))
    run("push", f"{host}/lesson/app:1")
    new_digest = http(base + "/v2/lesson/app/manifests/1", OCI_ACCEPT)[1].get("Docker-Content-Digest")
    check("pushing again under the same tag moves the tag to a new manifest", new_digest != reg_digest, f"{reg_digest} -> {new_digest}")
    run("rmi", "-f", f"{host}/lesson/app:1")
    pulled = docker("run", "--rm", "--label", LABEL, f"{host}/lesson/app@{reg_digest}")
    check("the old digest still gives the old image, so a digest is a safe way to pin a version", pulled == "hello", pulled)

    # ---- 5. an official tag is an index of one manifest per platform ----
    raw = run("buildx", "imagetools", "inspect", "--raw", ALPINE, check=False)
    plats = []
    if raw.returncode == 0:
        idx = json.loads(raw.stdout)
        plats = sorted({f"{m['platform']['os']}/{m['platform']['architecture']}" for m in idx.get("manifests", []) if "platform" in m and m["platform"]["os"] != "unknown"})
        check("the tag alpine:3.22 on Docker Hub is an index with one manifest per platform", idx["mediaType"].endswith("image.index.v1+json") and "linux/amd64" in plats and "linux/arm64" in plats and len(plats) >= 4, str(plats))
        idx_digest = SHA(raw.stdout.encode("utf-8"))
        tool = docker("buildx", "imagetools", "inspect", "--format", "{{.Manifest.Digest}}", ALPINE)
        check("the digest of that index is the sha256 of its raw bytes", tool == "sha256:" + idx_digest, f"{tool} vs {idx_digest}")
        amd = next(m for m in idx["manifests"] if m.get("platform", {}).get("architecture") == "amd64" and m["platform"]["os"] == "linux")
        remote = json.loads(run("buildx", "imagetools", "inspect", "--raw", f"{ALPINE.split(':')[0]}@{amd['digest']}").stdout)
        check("the manifest of linux/amd64 on Docker Hub names the same config blob as the local image: the image id is the same everywhere", remote["config"]["digest"] == f"sha256:{img_id}", remote["config"]["digest"])
        same_manifest = amd["digest"].split(":")[1] == manifest_digest
        show("manifest digest of alpine:3.22 for linux/amd64", f"on Docker Hub: {short(amd['digest'])}\nin docker save: {short(manifest_digest)}  ({'same' if same_manifest else 'different'})")
        remote_layers = [layer["digest"] for layer in remote["layers"]]
        check("and its layer is stored compressed there: a different digest from the diff id", len(remote_layers) == 1 and remote_layers[0].split(":")[1] != layer_name)
        show("platforms behind alpine:3.22", ", ".join(plats))

    if WRITE:
        write_json(
            LABS / "imageinside.json",
            {
                "alpine": {"image": short(img_id), "manifest": short(manifest_digest), "config": short(config_name), "layer": short(layer_name), "layerBytes": len(blobs[layer_name]), "manifestBytes": len(blobs[manifest_digest]), "configBytes": len(blobs[config_name])},
                "own": {"layers": len(own_manifest["layers"]), "history": len(hist), "emptyLayer": len(hist) - len(made), "ownFile": own_files[0], "ownLayer": short(own_layer), "ownLayerBytes": len(own_blobs[own_layer])},
                "registry": {"digest": short(reg_digest), "newDigest": short(new_digest or ""), "layerGzipBytes": reg_layer["size"], "layerDigest": short(reg_layer["digest"]), "pushedFirst": first.stdout.count("Pushed"), "mountedSecond": second.stdout.count("Mounted from")},
                "platforms": plats,
                "hub": {"index": short("sha256:" + idx_digest) if plats else "", "amd64": short(amd["digest"]) if plats else "", "sameManifestAsSave": same_manifest if plats else False, "layerGzip": short(remote_layers[0]) if plats else ""},
            },
        )


if __name__ == "__main__":
    main_guard(main)
