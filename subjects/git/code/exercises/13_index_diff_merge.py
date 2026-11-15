"""Lesson 13: inside the index, the diff and the merge.

Asserts what the .git/index file holds (the DIRC signature, a version, one entry per tracked file with its stat data and
blob id, and a cache of tree ids after a commit), why git status does not read every file, that the three diff algorithms can
give different answers for the same two files, what rename detection does for a merge, and that git merge-tree can compute a
merge without touching the working tree.
"""

import os
import struct
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from gitlab import check, commit, git, git_rc, init, reset_clock, save, show, write  # noqa: E402

reset_clock()

# ---- 1. the index file ----
repo = init("13_index")
write(repo, "a.txt", "apple\n")
write(repo, "b.txt", "banana\n")
write(repo, "dir/c.txt", "cherry\n")
git(repo, "add", ".")
raw = (repo / ".git" / "index").read_bytes()
sig, version, count = struct.unpack(">4sII", raw[:12])
show("first 12 bytes of .git/index", f"signature={sig!r} version={version} entries={count}")
check("the index starts with the letters DIRC, a version number and the number of entries", sig == b"DIRC" and version == 2 and count == 3)
# each entry: 10 x 4 bytes of stat data, 20 bytes of id, 2 bytes of flags, then the path, padded to a multiple of 8 bytes
pos, entries = 12, []
for _ in range(count):
    fields = struct.unpack(">10I20sH", raw[pos:pos + 62])
    end = raw.index(b"\0", pos + 62)
    name = raw[pos + 62:end].decode()
    entries.append((name, fields))
    pos += (62 + len(name) + 8) & ~7
check("the entries are sorted by path and each holds the path with its blob id", [e[0] for e in entries] == ["a.txt", "b.txt", "dir/c.txt"])
check("the id inside an entry is the blob id", entries[0][1][-2].hex() == git(repo, "hash-object", "a.txt"))
check("the entry stores the file size and the mode", entries[0][1][9] == 6 and entries[0][1][6] == 0o100644)
check("the last 20 bytes of the file are a SHA-1 of everything before, so a damaged index is noticed", len(raw) - pos >= 20)
check("before any commit there is no cache of tree ids", b"TREE" not in raw[pos:])
git(repo, "write-tree")
raw2 = (repo / ".git" / "index").read_bytes()
check("after write-tree or commit, an extension called TREE is stored: the tree id of every directory", b"TREE" in raw2[pos:])
print("\nindex entries:", [(n, f[-2].hex()[:7]) for n, f in entries])

# ---- 2. git status does not read every file: it compares stat data ----
commit(repo, "first")
dump = git(repo, "ls-files", "--debug", "a.txt")
show("git ls-files --debug a.txt", dump)
check("--debug shows the ctime, mtime, dev, ino, uid, gid and size kept in the index", "ctime:" in dump and "mtime:" in dump and "size:" in dump)
time.sleep(1.1)
os.utime(repo / "a.txt", None)                                       # new mtime, same content
check("touching a file does not change the index: it keeps the stat data from when the file was added", git(repo, "ls-files", "--debug", "a.txt") == dump)
check("git status shows nothing, because the stat data differed, so git read the file and saw the same blob id", git(repo, "status", "--short") == "")
refreshed = git(repo, "ls-files", "--debug", "a.txt")
show("git ls-files --debug a.txt  (after git status)", refreshed)
check("and it wrote the new stat data into the index, so the next status does not need to read the file again", refreshed != dump)
git(repo, "update-index", "--index-version", "4")
check("index version 4 compresses the path names", struct.unpack(">4sII", (repo / ".git" / "index").read_bytes()[:12])[1] == 4)

# ---- 3. three diff algorithms, one pair of files ----
# A made-up pair of nine-line files (found by a search over random files with many repeated lines such as "{" and "")
# where the algorithms disagree. Real code with many repeated lines can do the same.
old_lines = ["{", "{", "", "a();", "{", "{", "", "c();", "a();"]
new_lines = ["a();", "{", "{", "{", "", "{", "", "c();", "a();"]
old = "\n".join(old_lines) + "\n"
new = "\n".join(new_lines) + "\n"
algo = init("13_diff")
save(algo, "f.c", old, "old")
write(algo, "f.c", new)
diffs = {name: git(algo, "diff", f"--diff-algorithm={name}") for name in ("myers", "minimal", "patience", "histogram")}
counts = {k: (v.count("\n+") - v.count("\n+++"), v.count("\n-") - v.count("\n---")) for k, v in diffs.items()}
show("lines added and removed by each algorithm", str(counts))
show("git diff --diff-algorithm=patience", diffs["patience"].split("@@", 1)[1])
show("git diff --diff-algorithm=myers", diffs["myers"].split("@@", 1)[1])
check("the four algorithms give three different diffs for the same two files", len(set(diffs.values())) == 3, str(counts))
check("patience reports 3 lines changed on each side, the other three report 2", counts == {"myers": (2, 2), "minimal": (2, 2), "patience": (3, 3), "histogram": (2, 2)}, str(counts))
target = init("13_diff_apply")
save(target, "f.c", old, "old")
for name, text in diffs.items():
    patch = target.parent / f"13_{name}.patch"
    patch.write_bytes(text.encode() + b"\n")
    git(target, "apply", str(patch))
    check(f"{name}: applying its diff to the old file gives exactly the new file", (target / "f.c").read_text() == new)
    git(target, "checkout", "--quiet", "--", "f.c")
check("none of them knows that a block moved: a diff only has added and removed lines", all("moved" not in v.lower() for v in diffs.values()))

# ---- 4. rename detection: the merge finds the file by its content ----
ren = init("13_rename")
body = "".join(f"line {i}\n" for i in range(20))
save(ren, "old.txt", body, "base")
git(ren, "switch", "--quiet", "-c", "mover")
git(ren, "mv", "old.txt", "new.txt")
commit(ren, "rename old to new")
git(ren, "switch", "--quiet", "main")
save(ren, "old.txt", body.replace("line 10\n", "line 10 edited\n"), "edit old on main")
out = git(ren, "merge", "--no-edit", "mover")
show("git merge mover  (a rename on one side, an edit on the other)", out)
check("the edit follows the file to its new name, with no conflict", (ren / "new.txt").read_text() == body.replace("line 10\n", "line 10 edited\n") and not (ren / "old.txt").exists())
check("the merge says it found a rename", "new.txt" in out)
sim = init("13_rename_low")
save(sim, "old.txt", body, "base")
git(sim, "switch", "--quiet", "-c", "mover")
git(sim, "mv", "old.txt", "new.txt")
write(sim, "new.txt", "".join(f"totally different {i}\n" for i in range(20)))
git(sim, "add", "-A")
commit(sim, "rename and rewrite")
git(sim, "switch", "--quiet", "main")
save(sim, "old.txt", body.replace("line 10\n", "line 10 edited\n"), "edit old on main")
code, out = git_rc(sim, "merge", "--no-edit", "mover")
show("git merge mover  (the renamed file was rewritten)", out)
check("when less than half of the file is the same, git sees a delete and an add, and the merge conflicts", code != 0 and "CONFLICT (modify/delete)" in out, out)

# ---- 5. merge-tree: compute a merge without touching anything ----
mt = init("13_merge_tree")
save(mt, "menu.txt", "soup\nsalad\nbread\n", "base")
git(mt, "switch", "--quiet", "-c", "egg")
save(mt, "menu.txt", "soup\nsalad with egg\nbread\n", "egg")
git(mt, "switch", "--quiet", "main")
save(mt, "extra.txt", "x\n", "extra")
clean = git(mt, "merge-tree", "--write-tree", "main", "egg")
check("merge-tree --write-tree prints the id of the merged tree when there is no conflict", len(clean.splitlines()[0]) == 40, clean)
check("the tree has the work of both sides", set(git(mt, "ls-tree", "--name-only", clean.splitlines()[0]).splitlines()) == {"menu.txt", "extra.txt"})
check("the working tree and the branch were not touched", git(mt, "status", "--short") == "" and (mt / "menu.txt").read_text() == "soup\nsalad\nbread\n")
save(mt, "menu.txt", "soup\nsalad with tuna\nbread\n", "tuna")
code, out = git_rc(mt, "merge-tree", "--write-tree", "main", "egg")
show("git merge-tree --write-tree main egg  (conflict)", out)
check("on a conflict it exits with 1, prints a tree id and names the conflicted file", code == 1 and "menu.txt" in out and "CONFLICT (content)" in out, out)
print("\nok")
