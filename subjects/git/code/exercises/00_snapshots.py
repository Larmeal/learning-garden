"""Lesson 0: what Git is. It stores a snapshot of every file at each commit, and an id is computed from the content.

Asserts that the same content always gets the same id (even in two different repositories), that a one-letter change
gives a different id, that two commits that share a file share one object, and that each commit holds the whole file.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from gitlab import check, commit, git, init, reset_clock, save, show, write  # noqa: E402

reset_clock()

# ---- 1. the id depends on the content only ----
a = init("00_snapshots_a")
b = init("00_snapshots_b")
id_a = git(a, "hash-object", "--stdin", stdin="hello\n")
id_b = git(b, "hash-object", "--stdin", stdin="hello\n")
show("git hash-object --stdin  (content: hello)", id_a)
check("two repositories give the same id to the same content", id_a == id_b == "ce013625030ba8dba906f756967f9e9ca394464a")
other = git(a, "hash-object", "--stdin", stdin="hellp\n")
show("git hash-object --stdin  (content: hellp)", other)
check("changing one letter gives a completely different id", other != id_a and other[:6] != id_a[:6])

# ---- 2. each commit points at a whole tree, and an unchanged file is stored once ----
repo = init("00_snapshots")
write(repo, "a.txt", "alpha\n")
write(repo, "b.txt", "beta\n")
git(repo, "add", ".")
first = commit(repo, "Add a and b")
check("the first commit made 4 objects: 2 blobs, 1 tree, 1 commit", "count: 4" in git(repo, "count-objects", "-v").splitlines())
save(repo, "a.txt", "alpha\nmore\n", "Change a")
second = git(repo, "rev-parse", "--short", "HEAD")
tree1 = git(repo, "ls-tree", first)
tree2 = git(repo, "ls-tree", second)
show(f"git ls-tree {first}", tree1)
show(f"git ls-tree {second}", tree2)
blob = lambda tree, name: [l.split()[2] for l in tree.splitlines() if l.endswith("\t" + name)][0]  # noqa: E731
check("b.txt did not change, so both commits point at the same blob", blob(tree1, "b.txt") == blob(tree2, "b.txt"))
check("a.txt changed, so the commits point at different blobs", blob(tree1, "a.txt") != blob(tree2, "a.txt"))
check("the second commit still lists both files (a snapshot, not a list of changes)", len(tree2.splitlines()) == 2)

# ---- 3. the new version of a file is stored whole, not as a diff ----
whole = git(repo, "cat-file", "-p", blob(tree2, "a.txt"))
check("the stored blob of the new version is the whole file", whole == "alpha\nmore")
objects = git(repo, "count-objects", "-v")
show("git count-objects -v", objects)
# 2 commits + 2 trees + 3 blobs (alpha, beta, alpha+more) = 7 loose objects
check("7 objects: 2 commits, 2 trees, 3 blobs", "count: 7" in objects.splitlines())

# ---- 4. an old version is one command away, because nothing was overwritten ----
check("the first version of a.txt can be read again", git(repo, "show", f"{first}:a.txt") == "alpha")
print("\nok")
