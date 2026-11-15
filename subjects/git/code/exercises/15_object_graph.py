"""Feeds the object store lab: the objects of two small commits, read from the repository, with their ids and their bytes.

Builds the repository of exercise 11 (notes.txt and src/app.txt, a first commit, then a second commit that changes notes.txt only),
reads every object that the two commits reach with git cat-file, asserts which objects the second commit reuses, and with --write saves
the lot as site/src/components/labs/git/objectGraph.json. The lab imports that file, so no id in the picture is invented.

Run: python exercises/15_object_graph.py            (checks and prints)
     python exercises/15_object_graph.py --write    (also writes the JSON next to the lab)
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from gitlab import check, commit, git, init, reset_clock, save, show, write  # noqa: E402

WRITE = "--write" in sys.argv
OUT = Path(__file__).resolve().parents[4] / "site" / "src" / "components" / "labs" / "git" / "objectGraph.json"

reset_clock()
repo = init("15_object_graph")
write(repo, "notes.txt", "hello\n")
write(repo, "src/app.txt", "app\n")
git(repo, "add", ".")
c1 = git(repo, "rev-parse", commit(repo, "First commit"))
save(repo, "notes.txt", "hello\nworld\n", "Second commit")
c2 = git(repo, "rev-parse", "HEAD")


def tree_of(c: str) -> str:
    return git(repo, "rev-parse", f"{c}^{{tree}}")


t1, t2 = tree_of(c1), tree_of(c2)
src = git(repo, "rev-parse", f"{c1}:src")
blob_hello, blob_app, blob_hello2 = git(repo, "rev-parse", f"{c1}:notes.txt"), git(repo, "rev-parse", f"{c1}:src/app.txt"), git(repo, "rev-parse", f"{c2}:notes.txt")

check("the top tree of the first commit is the one exercise 11 printed", t1 == "e5f88fb95dd95ea6a9cf8bca89ec2efcfcd12664", t1)
check("and so is its subtree src", src == "8e37aeb42fda047c1de512588a05f5849757d605", src)
check("the second commit reuses the subtree src, because nothing in src changed", git(repo, "rev-parse", f"{c2}:src") == src)
check("and the blob of src/app.txt", git(repo, "rev-parse", f"{c2}:src/app.txt") == blob_app)
check("notes.txt got a new blob and so the top tree is new", blob_hello2 != blob_hello and t2 != t1)
check("the two commits reach 8 different objects: 2 commits, 3 trees (the subtree src is shared), 3 blobs (app.txt is shared)", len({c1, c2, t1, t2, src, blob_hello, blob_app, blob_hello2}) == 8)
check("the repository holds exactly those 8 objects", "count: 8" in git(repo, "count-objects", "-v").splitlines())


def entry(oid: str) -> dict:
    kind = git(repo, "cat-file", "-t", oid)
    size = int(git(repo, "cat-file", "-s", oid))
    pretty = git(repo, "cat-file", "-p", oid)
    points: list[str] = []
    if kind == "tree":
        points = [line.split()[2] for line in pretty.splitlines()]
    elif kind == "commit":
        points = [line.split()[1] for line in pretty.splitlines() if line.startswith(("tree ", "parent "))]
    store = f"{kind} {size}\\0" + (pretty.replace("\n", "\\n") + "\\n" if kind in ("blob", "commit") else "")
    return {"id": oid, "short": oid[:7], "type": kind, "size": size, "pretty": pretty, "points": points, "store": store}


objects = {oid: entry(oid) for oid in [c1, c2, t1, t2, src, blob_hello, blob_app, blob_hello2]}
check("the second commit's parent line is the first commit", c1 in objects[c2]["points"])
check("a blob's stored form is 'blob <size>' NUL and the content", objects[blob_hello]["store"] == "blob 6\\0hello\\n", objects[blob_hello]["store"])
show("the objects", "\n".join(f"{o['short']} {o['type']:6} {o['size']:3}  -> {[p[:7] for p in o['points']]}" for o in objects.values()))
data = {"c1": c1, "c2": c2, "t1": t1, "t2": t2, "src": src, "hello": blob_hello, "app": blob_app, "hello2": blob_hello2, "objects": objects}
if WRITE:
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nwrote {OUT}")
print("\nok")
