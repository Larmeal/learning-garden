"""Lesson 2: reading history. Names of a commit (HEAD~n, ^, id prefix), ranges (A..B, A...B), log filters and diff.

Asserts what each name points at on a small linear history and on a history with a merge, what the two range
operators select, what git log -- <path> and --stat show, and which pair of areas each form of git diff compares.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from gitlab import check, commit, git, init, reset_clock, save, show, write  # noqa: E402

reset_clock()
repo = init("02_history")

# A linear history of five commits: c1 (root) ... c5.
ids = []
ids.append(save(repo, "readme.txt", "Garden notes\n", "c1 add readme"))
ids.append(save(repo, "plants.txt", "tomato\n", "c2 add plants"))
ids.append(save(repo, "plants.txt", "tomato\nbasil\n", "c3 add basil"))
ids.append(save(repo, "readme.txt", "Garden notes\nupdated\n", "c4 update readme"))
ids.append(save(repo, "plants.txt", "tomato\nbasil\nmint\n", "c5 add mint"))
full = lambda rev: git(repo, "rev-parse", rev)  # noqa: E731
short = lambda rev: git(repo, "rev-parse", "--short", rev)  # noqa: E731

# ---- 1. names for one commit ----
show("git log --oneline", git(repo, "log", "--oneline"))
check("HEAD is the newest commit", short("HEAD") == ids[4])
check("HEAD~1 and HEAD^ are the parent", short("HEAD~1") == short("HEAD^") == ids[3])
check("HEAD~3 goes back three parents", short("HEAD~3") == ids[1])
check("an id prefix of 4 letters is enough while it is unique", full(ids[4][:4]) == full("HEAD"))
check("main is a name for the same commit as HEAD", full("main") == full("HEAD"))
check("a full id has 40 hex letters", len(full("HEAD")) == 40)
check("HEAD:plants.txt names a blob, not a commit", git(repo, "cat-file", "-t", "HEAD:plants.txt") == "blob")
check("HEAD^{tree} names the tree of the commit", git(repo, "cat-file", "-t", "HEAD^{tree}") == "tree")

# ---- 2. ranges ----
r = git(repo, "log", "--format=%s", "HEAD~3..HEAD").splitlines()
show("git log --format=%s HEAD~3..HEAD", "\n".join(r))
check("A..B is the commits that B reaches and A does not", r == ["c5 add mint", "c4 update readme", "c3 add basil"])
check("the same range written as HEAD ^HEAD~3", git(repo, "log", "--format=%s", "HEAD", "^HEAD~3").splitlines() == r)
check("B..A is empty when B is behind A", git(repo, "log", "--format=%s", "HEAD..HEAD~3") == "")

# ---- 3. log filters ----
by_path = git(repo, "log", "--format=%s", "--", "readme.txt").splitlines()
check("git log -- path lists only the commits that touched the path", by_path == ["c4 update readme", "c1 add readme"], str(by_path))
check("git log -n 2 limits the count", len(git(repo, "log", "--format=%s", "-n", "2").splitlines()) == 2)
check("git log --grep finds a word in the message", git(repo, "log", "--format=%s", "--grep=basil") == "c3 add basil")
stat = git(repo, "log", "--stat", "--format=%s", "-n", "1")
show("git log --stat -n 1", stat)
check("--stat names the changed file and one added line", "plants.txt | 1 +" in stat and "1 file changed, 1 insertion(+)" in stat, stat)
check("--oneline --graph draws one star per commit", git(repo, "log", "--oneline", "--graph").count("*") == 5)

# ---- 4. the forms of git diff ----
write(repo, "plants.txt", "tomato\nbasil\nmint\nsage\n")
check("git diff: working tree against the index", "+sage" in git(repo, "diff"))
git(repo, "add", "plants.txt")
check("git diff --staged: index against HEAD", "+sage" in git(repo, "diff", "--staged"))
check("git diff HEAD: working tree against HEAD", "+sage" in git(repo, "diff", "HEAD"))
d = git(repo, "diff", "HEAD~2", "HEAD~1")
show("git diff HEAD~2 HEAD~1", d)
check("git diff A B compares two commits (c3 against c4 touches readme only)", "readme.txt" in d and "plants.txt" not in d)
check("git diff --name-status lists the letter and the path", git(repo, "diff", "--name-status", "HEAD") == "M\tplants.txt")
check("git diff --stat summarises", "1 file changed, 1 insertion(+)" in git(repo, "diff", "--stat", "HEAD"))
commit(repo, "c6 add sage")
ids.append(short("HEAD"))

# ---- 5. a history with a merge: two parents, and the two range operators ----
git(repo, "switch", "--quiet", "-c", "feature", "HEAD~2")           # start a branch at c4
save(repo, "feature.txt", "f1\n", "f1 feature one")
save(repo, "feature.txt", "f1\nf2\n", "f2 feature two")
git(repo, "switch", "--quiet", "main")
save(repo, "main.txt", "m1\n", "m1 main one")
git(repo, "merge", "--quiet", "--no-ff", "-m", "Merge feature", "feature")
parents = git(repo, "rev-list", "--parents", "-n", "1", "HEAD").split()
check("a merge commit has two parents", len(parents) == 3)
check("HEAD^1 is the branch you were on and HEAD^2 the one you merged", git(repo, "log", "--format=%s", "-n", "1", "HEAD^1") == "m1 main one" and git(repo, "log", "--format=%s", "-n", "1", "HEAD^2") == "f2 feature two")
two = git(repo, "log", "--format=%s", "main..feature").splitlines()
check("main..feature after the merge is empty (everything is reachable from main)", two == [])

# ---- 6. two dots and three dots, on a clean fork ----
base = short("HEAD")
git(repo, "switch", "--quiet", "-c", "left", base)
save(repo, "left.txt", "l\n", "L1 left")
git(repo, "switch", "--quiet", "-c", "right", base)
save(repo, "right.txt", "r\n", "R1 right")
save(repo, "right.txt", "r\nr\n", "R2 right")
two_dots = git(repo, "log", "--format=%s", "left..right").splitlines()
three_dots = sorted(git(repo, "log", "--format=%s", "left...right").splitlines())
show("git log --format=%s left..right", "\n".join(two_dots))
show("git log --format=%s left...right", "\n".join(three_dots))
check("left..right: only what right has and left does not", two_dots == ["R2 right", "R1 right"])
check("left...right: what only one of them has, from both sides", three_dots == ["L1 left", "R1 right", "R2 right"])
check("git merge-base finds where they forked", short(git(repo, "merge-base", "left", "right")) == base)
print("\nok")
