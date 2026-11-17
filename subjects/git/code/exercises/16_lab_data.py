"""Feeds the animated labs: nine small data sets, each read from a real repository, with the checks that make them trustworthy.

1. integrate: the same start (main has M1 and M2, the topic has C1 and C2) taken in three ways, merge commit, squash and rebase.
2. ranges:    one history with a merge, and the commits that each revision selector (HEAD~2, A..B, A...B, ^B main, --first-parent) names.
3. bisect:    for every possible first bad commit among 16, the commits that git bisect tests and the answer each one gets.
4. reflog:    the reflog of HEAD before a reset --hard, after it, and after the way back.
5. pack:      20 versions of one file, the size of their loose objects, the size of the pack, and the delta chain of each blob.
6. merge:     a fast-forward, a real merge, and one file changed on different lines or on the same line.
7. snapshot:  two commits and the objects they share.   8. diff: four algorithms on one made-up pair.
9. hook and submodule: a pre-commit that says no, and a submodule pointer that does not follow.

Run: python exercises/16_lab_data.py            (checks and prints)
     python exercises/16_lab_data.py --write    (also writes site/src/components/labs/git/labData.json)
"""

import json
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from gitlab import check, commit, fresh, git, init, reset_clock, save, show, tick, write  # noqa: E402

WRITE = "--write" in sys.argv
OUT = Path(__file__).resolve().parents[4] / "site" / "src" / "components" / "labs" / "git" / "labData.json"
data: dict = {}
rev = lambda repo, name: git(repo, "rev-parse", "--short=7", name)  # noqa: E731


def log_rows(repo: Path, *args: str) -> list[dict]:
    """Commits as {id, subject, parents} (short ids, newest first, topological order)."""
    out = git(repo, "log", "--abbrev=7", "--topo-order", "--format=%h%x09%p%x09%s", *args)
    rows = []
    for line in out.splitlines():
        h, p, s = line.split("\t")
        rows.append({"id": h, "parents": p.split(), "subject": s})
    return rows


# ---- 1. three ways to take in a topic branch, from the same start ----
def start(tag: str):
    reset_clock()
    origin = init(f"16_{tag}_origin.git", bare=True)
    maint = fresh(f"16_{tag}_maintainer")
    git(maint, "init", "--quiet")
    git(maint, "remote", "add", "origin", origin.as_posix())
    save(maint, "app.txt", "v1\n", "M1 first version")
    git(maint, "push", "--quiet", "-u", "origin", "main")
    contrib = fresh(f"16_{tag}_contributor")
    git(contrib, "clone", "--quiet", origin.as_posix(), ".")
    git(contrib, "switch", "--quiet", "-c", "topic/search")
    save(contrib, "search.txt", "s1\n", "C1 start search")
    save(contrib, "search.txt", "s1\ns2\n", "C2 finish search")
    git(contrib, "push", "--quiet", "-u", "origin", "topic/search")
    save(maint, "app.txt", "v1\nv2\n", "M2 main moves on meanwhile")
    git(maint, "push", "--quiet")
    git(maint, "fetch", "--quiet")
    return origin, maint, contrib


def summary(maint: Path, topic_old: list[str]) -> dict:
    rows = log_rows(maint, "main")
    return {
        "history": rows,
        "tree": git(maint, "rev-parse", "HEAD^{tree}"),
        "commits_on_main": len(rows),
        "merge_commits": int(git(maint, "rev-list", "--merges", "--count", "main")),
        "first_parent": len(git(maint, "rev-list", "--first-parent", "main").splitlines()),
        "topic_reported_merged": "origin/topic/search" in git(maint, "branch", "-r", "--merged", "main"),
        "old_topic_ids_in_main": [i for i in topic_old if _is_ancestor(maint, i)],
    }


def _is_ancestor(repo: Path, oid: str) -> bool:
    from gitlab import git_rc
    return git_rc(repo, "merge-base", "--is-ancestor", oid, "main")[0] == 0


integrate: dict = {}
origin, maint, contrib = start("merge")
old = [rev(maint, "origin/topic/search~1"), rev(maint, "origin/topic/search")]
base_ids = {"M1": rev(maint, "main~1"), "M2": rev(maint, "main"), "C1": old[0], "C2": old[1]}
git(maint, "merge", "--no-ff", "--no-edit", "--quiet", "origin/topic/search")
integrate["merge"] = summary(maint, old)

origin, maint, contrib = start("squash")
check("every strategy starts from the same four commits (same ids)", [rev(maint, "main~1"), rev(maint, "main"), rev(maint, "origin/topic/search~1"), rev(maint, "origin/topic/search")] == list(base_ids.values()))
git(maint, "merge", "--squash", "--quiet", "origin/topic/search")
git(maint, "commit", "--quiet", "-m", "Add search (#1)")
integrate["squash"] = summary(maint, old)

origin, maint, contrib = start("rebase")
git(contrib, "fetch", "--quiet")
git(contrib, "rebase", "--quiet", "origin/main")
git(contrib, "push", "--quiet", "--force-with-lease")
git(maint, "fetch", "--quiet")
git(maint, "merge", "--ff-only", "--quiet", "origin/topic/search")
integrate["rebase"] = summary(maint, old)
integrate["start"] = base_ids
for k in ("merge", "squash", "rebase"):
    show(f"history of main after {k}", "\n".join(f"{r['id']} {r['parents']} {r['subject']}" for r in integrate[k]["history"]))
m, s, r = integrate["merge"], integrate["squash"], integrate["rebase"]
check("all three give the same files: one tree id", m["tree"] == s["tree"] == r["tree"], f"{m['tree']} {s['tree']} {r['tree']}")
check("merge: 5 commits on main, 1 of them a merge commit, and C1 and C2 are still ancestors of main with their old ids", (m["commits_on_main"], m["merge_commits"]) == (5, 1) and sorted(m["old_topic_ids_in_main"]) == sorted(old))
check("squash: 3 commits, no merge, none of the old topic ids is in main, and git does not call the topic merged", (s["commits_on_main"], s["merge_commits"]) == (3, 0) and s["old_topic_ids_in_main"] == [] and not s["topic_reported_merged"])
check("rebase: 4 commits in a line, no merge, the old C1 and C2 are not in main (new ids), and the topic counts as merged", (r["commits_on_main"], r["merge_commits"]) == (4, 0) and r["old_topic_ids_in_main"] == [] and r["topic_reported_merged"])
check("the rebased commits have new ids", {x["id"] for x in r["history"][:2]}.isdisjoint(old))
check("git log --first-parent of the merge shows 3 lines (the merge, M2, M1), the way a list of pull requests reads", m["first_parent"] == 3)
data["integrate"] = integrate

# ---- 2. one history, and the commits that each selector names ----
reset_clock()
repo = init("16_ranges")
save(repo, "f.txt", "a\n", "A first")
save(repo, "f.txt", "a\nb\n", "B second")
git(repo, "switch", "--quiet", "-c", "feature")
save(repo, "g.txt", "1\n", "F1 start feature")
save(repo, "g.txt", "1\n2\n", "F2 finish feature")
git(repo, "switch", "--quiet", "main")
save(repo, "f.txt", "a\nb\nc\n", "C third")
git(repo, "merge", "--no-ff", "--no-edit", "--quiet", "feature")
save(repo, "f.txt", "a\nb\nc\nd\n", "D fourth")
git(repo, "switch", "--quiet", "-c", "topic")
save(repo, "t.txt", "x\n", "T1 start topic")
save(repo, "t.txt", "x\ny\n", "T2 finish topic")
git(repo, "switch", "--quiet", "main")
save(repo, "f.txt", "a\nb\nc\nd\ne\n", "E fifth")
allc = log_rows(repo, "--all")
by_subject = {r["subject"].split()[0]: r["id"] for r in allc}
check("the history has 10 commits: A B C D E on main, a merge, F1 F2 on feature, T1 T2 on topic", len(allc) == 10, str(len(allc)))
merge_id = [r for r in allc if len(r["parents"]) == 2][0]["id"]
by_subject["Merge"] = merge_id
sel = {
    "HEAD~2": [rev(repo, "HEAD~2")],
    "HEAD~3": [rev(repo, "HEAD~3")],
    "M^2": [rev(repo, f"{merge_id}^2")],
    "main..topic": [i[:7] for i in git(repo, "rev-list", "main..topic").splitlines()],
    "topic..main": [i[:7] for i in git(repo, "rev-list", "topic..main").splitlines()],
    "main...topic": [i[:7] for i in git(repo, "rev-list", "main...topic").splitlines()],
    "^B main": [i[:7] for i in git(repo, "rev-list", f"^{by_subject['B']}", "main").splitlines()],
    "main --first-parent": [i[:7] for i in git(repo, "rev-list", "--first-parent", "main").splitlines()],
    "feature": [i[:7] for i in git(repo, "rev-list", "feature").splitlines()],
}
for k, v in sel.items():
    show(f"git rev-list {k}", " ".join(v))
name = {r["id"]: r["subject"].split()[0] for r in allc}
name[merge_id] = "M"
names = {k: [name[i] for i in v] for k, v in sel.items()}
check("HEAD~2 is the merge commit, HEAD~3 is C, M^2 is the tip of feature", names["HEAD~2"] == ["M"] and names["HEAD~3"] == ["C"] and names["M^2"] == ["F2"], str(names))
check("main..topic is what topic has and main has not: T2, T1", names["main..topic"] == ["T2", "T1"], str(names["main..topic"]))
check("topic..main is what main has and topic has not: E", names["topic..main"] == ["E"], str(names["topic..main"]))
check("main...topic is each side's own commits: E, T2, T1", sorted(names["main...topic"]) == ["E", "T1", "T2"], str(names["main...topic"]))
check("^B main is everything after B on the way to main, including both sides of the merge", sorted(names["^B main"]) == sorted(["E", "D", "M", "C", "F2", "F1"]), str(names["^B main"]))
check("--first-parent leaves out F1 and F2: it follows only the first parent of the merge", names["main --first-parent"] == ["E", "D", "M", "C", "B", "A"], str(names["main --first-parent"]))
check("feature reaches F2, F1, B, A", names["feature"] == ["F2", "F1", "B", "A"], str(names["feature"]))
data["ranges"] = {
    "commits": [{"name": name[r["id"]], "id": r["id"], "parents": [name[p] for p in r["parents"]], "subject": r["subject"]} for r in allc],
    "branches": {"main": name[rev(repo, "main")], "feature": name[rev(repo, "feature")], "topic": name[rev(repo, "topic")]},
    "selectors": names,
}

# ---- 3. bisect: the commits it tests, for every possible culprit ----
reset_clock()
repo = init("16_bisect")
ids = []
for n in range(1, 17):
    write(repo, "notes.txt", f"change {n}\n")
    git(repo, "add", ".")
    ids.append(rev(repo, commit(repo, f"commit {n}")))
index_of = {i: n + 1 for n, i in enumerate(ids)}
paths: dict[str, list[dict]] = {}
for culprit in range(2, 17):
    git(repo, "bisect", "start", ids[15], ids[0])
    tried: list[dict] = []
    for _ in range(8):
        here = index_of[rev(repo, "HEAD")]
        verdict = "bad" if here >= culprit else "good"
        tried.append({"commit": here, "verdict": verdict})
        out = git(repo, "bisect", verdict)
        if "is the first 'bad' commit" in out:
            found = index_of[out.split()[0][:7]]
            check(f"bisect finds commit {culprit} as the first bad one", found == culprit, f"found {found}")
            break
    paths[str(culprit)] = tried
    check(f"commit {culprit}: at most 4 answers", len(tried) <= 4, str(len(tried)))
    git(repo, "bisect", "reset")
show("bisect path when commit 11 is the first bad one", " ".join(f"{p['commit']}:{p['verdict']}" for p in paths["11"]))
check("with commit 11 as the culprit the first commit tested is 8, as in the lesson", paths["11"][0]["commit"] == 8, str(paths["11"]))
data["bisect"] = {"ids": ids, "paths": paths}

# ---- 4. the reflog around a reset --hard ----
reset_clock()
repo = init("16_reflog")
c1 = save(repo, "a.txt", "1\n", "C1")
c2 = save(repo, "a.txt", "1\n2\n", "C2")
c3 = save(repo, "a.txt", "1\n2\n3\n", "C3")


def reflog(repo: Path) -> list[dict]:
    rows = []
    for line in git(repo, "reflog", "--abbrev=7", "--format=%h%x09%gd%x09%gs").splitlines():
        h, d, s = line.split("\t")
        rows.append({"id": h, "ref": d, "what": s})
    return rows


stages = {"before": reflog(repo)}
git(repo, "reset", "--hard", "--quiet", "HEAD~2")
stages["after_reset"] = reflog(repo)
git(repo, "reset", "--hard", "--quiet", "HEAD@{1}")
stages["after_recover"] = reflog(repo)
check("before the reset the reflog has three commit lines", len(stages["before"]) == 3)
check("the reset adds one line and HEAD@{1} is the lost C3", len(stages["after_reset"]) == 4 and stages["after_reset"][1]["id"] == c3 and stages["after_reset"][1]["what"].startswith("commit: C3"), str(stages["after_reset"][:2]))
check("the way back adds another line and HEAD is C3 again", len(stages["after_recover"]) == 5 and rev(repo, "HEAD") == c3)
show("reflog after the way back", "\n".join(f"{x['id']} {x['ref']} {x['what']}" for x in stages["after_recover"]))
data["reflog"] = {"commits": {"C1": c1, "C2": c2, "C3": c3}, "stages": stages}

# ---- 5. packs: 20 versions of one file ----
reset_clock()
for _ in range(3):  # exercise 12 made three commits before its pack, so its clock stood at 3; the same start gives the same bytes
    tick()
big = init("16_pack")
text = "".join(f"line {i:03d} of a file that grows and changes a little in every commit\n" for i in range(200))
versions = []
for n in range(1, 21):
    text = text.replace("\n", f" v{n}\n", 1) if n > 1 else text
    save(big, "data.txt", text + f"edit {n}\n", f"V{n}")
    versions.append(git(big, "rev-parse", "HEAD:data.txt"))
loose = sum(p.stat().st_size for p in (big / ".git" / "objects").rglob("*") if p.is_file() and len(p.parent.name) == 2)
loose_blob = {v: (big / ".git" / "objects" / v[:2] / v[2:]).stat().st_size for v in versions}
git(big, "gc", "--quiet")
pack = next((big / ".git" / "objects" / "pack").glob("*.pack"))
rows = [r.split() for r in git(big, "verify-pack", "-v", str(pack)).splitlines()]
objs = {r[0]: r for r in rows if len(r) in (5, 6, 7) and len(r[0]) == 40 and r[1] in ("blob", "tree", "commit")}
check("60 objects in the pack", len(objs) == 60)
blobs = []
for n, v in enumerate(versions, start=1):
    r = objs[v]
    blobs.append({"version": n, "id": v[:7], "size": int(r[2]), "in_pack": int(r[3]), "loose": loose_blob[v], "depth": int(r[5]) if len(r) >= 7 else 0, "base": r[6][:7] if len(r) >= 7 else None})
check("19 of the 20 versions are deltas and the newest is stored whole", sum(1 for b in blobs if b["depth"] > 0) == 19 and blobs[-1]["depth"] == 0)
check("the pack file is under a third of the loose objects: 4838 against 16613 bytes", loose == 16613 and pack.stat().st_size == 4838, f"{loose} {pack.stat().st_size}")
check("PACK header counts 60 objects", struct.unpack(">4sII", pack.read_bytes()[:12]) == (b"PACK", 2, 60))
show("blobs in the pack", "\n".join(f"V{b['version']:<2} {b['id']} size {b['size']:5} loose {b['loose']:4} in pack {b['in_pack']:4} depth {b['depth']} base {b['base']}" for b in blobs))
data["pack"] = {"loose_total": loose, "pack_total": pack.stat().st_size, "objects": 60, "blobs": blobs}

# ---- 6. merge: a fast-forward, a real merge, and the same file changed on two lines or on one ----
from gitlab import git_rc  # noqa: E402

reset_clock()
repo = init("16_merge")
m1 = save(repo, "menu.txt", "soup\nsalad\nbread\n", "m1 first menu")
git(repo, "switch", "--quiet", "-c", "dessert")
d1 = save(repo, "dessert.txt", "cake\n", "d1 add dessert")
git(repo, "switch", "--quiet", "main")
ff_out = git(repo, "merge", "dessert")
ff = {"m1": m1, "d1": d1, "main_after": rev(repo, "main"), "output": ff_out}
git(repo, "switch", "--quiet", "-c", "drinks")
k1 = save(repo, "drinks.txt", "tea\n", "k1 add drinks")
git(repo, "switch", "--quiet", "main")
m2 = save(repo, "menu.txt", "soup\nsalad\nbread\nrice\n", "m2 add rice on main")
base = git(repo, "merge-base", "main", "drinks")[:7]
three_out = git(repo, "merge", "--no-edit", "drinks")
three = {"base": base, "m2": m2, "k1": k1, "merge": rev(repo, "main"), "parents": [p[:7] for p in git(repo, "rev-list", "--parents", "-n", "1", "main").split()[1:]], "output": three_out}
check("fast-forward: main ends on d1, and merge-base of the real merge is d1", ff["main_after"] == d1 and base == d1, str((ff["main_after"], base, d1)))
check("the real merge has parents m2 and k1", three["parents"] == [m2, k1], str(three["parents"]))

BASE = "soup\nsalad\nbread\n"
cases = {}
for label, ours, theirs in (("apart", "soup\nsalad\ngarlic bread\n", "tomato soup\nsalad\nbread\n"), ("same", "soup\nsalad with tuna\nbread\n", "soup\nsalad with egg\nbread\n")):
    reset_clock()
    r = init(f"16_merge_{label}")
    save(r, "menu.txt", BASE, "m1 first menu")
    git(r, "switch", "--quiet", "-c", "theirs")
    save(r, "menu.txt", theirs, "t1 their change")
    git(r, "switch", "--quiet", "main")
    save(r, "menu.txt", ours, "o1 our change")
    code, out = git_rc(r, "merge", "--no-edit", "theirs")
    text = (r / "menu.txt").read_text()
    entry = {"base": BASE, "ours": ours, "theirs": theirs, "exit": code, "output": out, "result": text}
    if label == "same":
        git(r, "checkout", "--conflict=diff3", "menu.txt")
        entry["diff3"] = (r / "menu.txt").read_text()
        entry["unmerged"] = git(r, "ls-files", "--unmerged").splitlines()
    cases[label] = entry
check("changes on different lines merge by themselves, with both changes in the file", cases["apart"]["exit"] == 0 and cases["apart"]["result"] == "tomato soup\nsalad\ngarlic bread\n", repr(cases["apart"]["result"]))
check("changes on the same line stop with a conflict and markers", cases["same"]["exit"] == 1 and cases["same"]["result"] == "soup\n<<<<<<< HEAD\nsalad with tuna\n=======\nsalad with egg\n>>>>>>> theirs\nbread\n", repr(cases["same"]["result"]))
show("merge outputs", "\n---\n".join([three_out, cases["apart"]["output"], cases["same"]["output"]]))
data["merge"] = {"ff": ff, "three": three, "cases": cases}

# ---- 7. snapshots: two commits and the objects they share (lesson 0) ----
reset_clock()
repo = init("16_snapshots")
write(repo, "a.txt", "alpha\n")
write(repo, "b.txt", "beta\n")
git(repo, "add", ".")
s1 = rev(repo, commit(repo, "Add a and b"))
count1 = git(repo, "count-objects", "-v").splitlines()
save(repo, "a.txt", "alpha\nmore\n", "Change a")
s2 = rev(repo, "HEAD")
count2 = git(repo, "count-objects", "-v").splitlines()
entries = lambda c: {l.split("\t")[1]: l.split()[2][:7] for l in git(repo, "ls-tree", c).splitlines()}  # noqa: E731
e1, e2 = entries(s1), entries(s2)
check("the first commit made 4 objects and the second made 3 more", "count: 4" in count1 and "count: 7" in count2)
check("b.txt is the same blob in both commits, a.txt is not", e1["b.txt"] == e2["b.txt"] and e1["a.txt"] != e2["a.txt"])
data["snapshot"] = {
    "commits": [{"id": s1, "tree": rev(repo, f"{s1}^{{tree}}"), "files": e1, "message": "Add a and b"}, {"id": s2, "tree": rev(repo, "HEAD^{tree}"), "files": e2, "message": "Change a"}],
    "contents": {"a1": "alpha", "a2": "alpha\nmore", "b": "beta"},
    "objects_after": [4, 7],
}

# ---- 8. four diff algorithms on one made-up pair (lesson 13) ----
old_lines = ["{", "{", "", "a();", "{", "{", "", "c();", "a();"]
new_lines = ["a();", "{", "{", "{", "", "{", "", "c();", "a();"]
reset_clock()
algo = init("16_diff")
save(algo, "f.c", "\n".join(old_lines) + "\n", "old")
write(algo, "f.c", "\n".join(new_lines) + "\n")
algos = {}
for name in ("myers", "minimal", "patience", "histogram"):
    text = git(algo, "diff", f"--diff-algorithm={name}")
    body = text.split("\n@@", 1)[1].split("\n")[1:]
    algos[name] = [{"t": l[0], "s": l[1:]} for l in body if l[:1] in (" ", "+", "-")]
check("patience marks 3 lines on each side, the others 2 (the claim of exercise 13)", {k: sum(1 for l in v if l["t"] == "+") for k, v in algos.items()} == {"myers": 2, "minimal": 2, "patience": 3, "histogram": 2})
data["diff"] = {"old": old_lines, "new": new_lines, "algos": algos}

# ---- 9. a pre-commit hook says no (lesson 14) ----
import stat  # noqa: E402

reset_clock()
repo = init("16_hooks")
save(repo, "a.txt", "1\n", "C1")
hook_path = repo / ".git" / "hooks" / "pre-commit"
hook_path.write_bytes(b'#!/bin/sh\nif git diff --cached | grep -q "^+.*DEBUG"; then\n  echo "pre-commit: remove the DEBUG line first" >&2\n  exit 1\nfi\n')
hook_path.chmod(hook_path.stat().st_mode | stat.S_IXUSR)
write(repo, "a.txt", "1\nDEBUG print\n")
git(repo, "add", "a.txt")
code, out = git_rc(repo, "commit", "-m", "C2 with debug")
log_after = git(repo, "log", "--format=%s").splitlines()
code2, out2 = git_rc(repo, "commit", "--no-verify", "-m", "C2 with debug")
check("the hook stops the commit and --no-verify skips it", code != 0 and log_after == ["C1"] and code2 == 0, out)
data["hook"] = {"script": '#!/bin/sh\nif git diff --cached | grep -q "^+.*DEBUG"; then\n  echo "pre-commit: remove the DEBUG line first" >&2\n  exit 1\nfi', "fail_output": out.strip(), "exit": code, "log_after_fail": log_after, "log_after_no_verify": git(repo, "log", "--format=%s").splitlines()}

# ---- 10. a submodule: a pointer to one commit of another repository (lesson 14) ----
reset_clock()
lib = init("16_lib")
save(lib, "lib.txt", "v1\n", "L1 library v1")
lib1 = git(lib, "rev-parse", "HEAD")
main = init("16_super")
save(main, "app.txt", "app\n", "S1 app")
git(main, "-c", "protocol.file.allow=always", "submodule", "add", "--quiet", lib.as_posix(), "vendor/lib")
gm = (main / ".gitmodules").read_text()
git(main, "commit", "--quiet", "-m", "S2 add the library")
s2c = rev(main, "HEAD")
entry1 = git(main, "ls-tree", "HEAD", "vendor/lib")
save(lib, "lib.txt", "v1\nv2\n", "L2 library v2")
lib2 = git(lib, "rev-parse", "HEAD")
status_before = git(main, "submodule", "status").strip()
git(main / "vendor" / "lib", "-c", "protocol.file.allow=always", "pull", "--quiet", "origin", "main")
status_after = git(main, "status", "--short")
git(main, "add", "vendor/lib")
git(main, "commit", "--quiet", "-m", "S3 use library v2")
s3c = rev(main, "HEAD")
entry2 = git(main, "ls-tree", "HEAD", "vendor/lib")
clone = fresh("16_super_clone")
git(clone, "-c", "protocol.file.allow=always", "clone", "--quiet", main.as_posix(), ".")
empty = not any((clone / "vendor" / "lib").iterdir())
check("the gitlink holds the commit of the library: 160000 commit <id>", entry1 == f"160000 commit {lib1}\tvendor/lib" and entry2 == f"160000 commit {lib2}\tvendor/lib", f"{entry1!r} {entry2!r} {lib1} {lib2}")
check("the main repository does not follow the library until the pointer is added and committed", status_before.startswith(lib1) and status_after == " M vendor/lib" and empty)
data["submodule"] = {"lib": [lib1[:7], lib2[:7]], "main": [s2c[:7], s3c[:7]], "gitmodules": gm.strip(), "entry": [entry1.replace(lib1, lib1[:7]), entry2.replace(lib2, lib2[:7])], "status_after_pull": status_after, "clone_empty": empty}

if WRITE:
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nwrote {OUT}")
print("\nok")
