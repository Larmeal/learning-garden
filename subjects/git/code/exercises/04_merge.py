"""Lesson 4: merge. Fast-forward against a real merge commit, what a conflict looks like, and how to leave one.

Asserts that a merge moves the pointer only when one side is an ancestor of the other, that a real merge makes a commit
with two parents, that git finds the common ancestor with merge-base, that a conflict writes markers into the file and
three versions into the index (stages 1, 2 and 3), and that git merge --abort puts everything back.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from gitlab import check, git, git_rc, init, reset_clock, save, show, write  # noqa: E402

reset_clock()
repo = init("04_merge")
full = lambda rev: git(repo, "rev-parse", rev)  # noqa: E731
parents = lambda rev: git(repo, "rev-list", "--parents", "-n", "1", rev).split()[1:]  # noqa: E731

save(repo, "menu.txt", "soup\nsalad\nbread\n", "m1 first menu")

# ---- 1. fast-forward: main is an ancestor of the branch, so only the pointer moves ----
git(repo, "switch", "--quiet", "-c", "dessert")
save(repo, "dessert.txt", "cake\n", "d1 add dessert")
tip = full("dessert")
git(repo, "switch", "--quiet", "main")
out = git(repo, "merge", "dessert")
show("git merge dessert", out)
check("the message says Fast-forward", "Fast-forward" in out)
check("main now points at the very same commit as dessert", full("main") == tip)
check("no new commit was made: the tip has one parent", len(parents("main")) == 1)

# ---- 2. a real merge: both sides moved, so git makes a commit with two parents ----
git(repo, "switch", "--quiet", "-c", "drinks")
save(repo, "drinks.txt", "tea\n", "k1 add drinks")
git(repo, "switch", "--quiet", "main")
save(repo, "menu.txt", "soup\nsalad\nbread\nrice\n", "m2 add rice on main")
base = git(repo, "merge-base", "main", "drinks")
check("merge-base is the commit where the two histories split", base == full("dessert"))
out = git(repo, "merge", "--no-edit", "drinks")
show("git merge drinks", out)
check("the message names the ort strategy", "Merge made by the 'ort' strategy." in out, out)
check("the merge commit has two parents: main before, drinks", len(parents("main")) == 2 and parents("main")[1] == full("drinks"))
check("the working tree has the work of both sides", (repo / "drinks.txt").exists() and "rice" in (repo / "menu.txt").read_text())
check("git merge on a branch that is already included does nothing", "Already up to date" in git(repo, "merge", "drinks"))
git(repo, "switch", "--quiet", "-c", "snacks")
save(repo, "snacks.txt", "nuts\n", "s1 add snacks")
git(repo, "switch", "--quiet", "main")
git(repo, "merge", "--quiet", "--no-ff", "--no-edit", "snacks")
check("--no-ff on a branch that could fast-forward still makes a commit with two parents", len(parents("main")) == 2)

# ---- 3. a conflict: both sides changed the same line ----
repo = init("04_merge_conflict")
save(repo, "menu.txt", "soup\nsalad\nbread\n", "m1 first menu")
git(repo, "switch", "--quiet", "-c", "egg")
save(repo, "menu.txt", "soup\nsalad with egg\nbread\n", "e1 egg salad")
git(repo, "switch", "--quiet", "main")
save(repo, "menu.txt", "soup\nsalad with tuna\nbread\n", "t1 tuna salad")
before = full("main")
code, out = git_rc(repo, "merge", "egg")
show("git merge egg", out)
check("a conflict makes git merge exit with 1", code == 1)
check("the output names the file and the kind of conflict", "CONFLICT (content): Merge conflict in menu.txt" in out, out)
text = (repo / "menu.txt").read_text()
show("cat menu.txt", text)
check("the file now holds both versions between markers", text == "soup\n<<<<<<< HEAD\nsalad with tuna\n=======\nsalad with egg\n>>>>>>> egg\nbread\n", repr(text))
check("MERGE_HEAD records the branch being merged", (repo / ".git" / "MERGE_HEAD").read_text().strip() == full("egg"))
check("status says both sides modified the file", git(repo, "status", "--short") == "UU menu.txt")
stages = git(repo, "ls-files", "--unmerged").splitlines()
show("git ls-files --unmerged", "\n".join(stages))
check("the index keeps three versions: stage 1 base, 2 ours, 3 theirs", [s.split()[2] for s in stages] == ["1", "2", "3"])
check("stage 1 is the common ancestor's version", git(repo, "show", ":1:menu.txt") == "soup\nsalad\nbread")
check("stage 2 is ours and stage 3 is theirs", git(repo, "show", ":2:menu.txt").splitlines()[1] == "salad with tuna" and git(repo, "show", ":3:menu.txt").splitlines()[1] == "salad with egg")
git(repo, "checkout", "--conflict=diff3", "menu.txt")
diff3 = (repo / "menu.txt").read_text()
show("cat menu.txt  (after git checkout --conflict=diff3)", diff3)
check("diff3 style adds the base version between ||||||| and =======", "||||||| " in diff3 and "salad\n=======" in diff3, diff3)

# ---- 4. leave the conflict: abort, or resolve and commit ----
git(repo, "merge", "--abort")
check("--abort puts main back where it was", full("main") == before and git(repo, "status", "--short") == "")
check("--abort removes MERGE_HEAD", not (repo / ".git" / "MERGE_HEAD").exists())
git_rc(repo, "merge", "egg")
write(repo, "menu.txt", "soup\nsalad with egg and tuna\nbread\n")
git(repo, "add", "menu.txt")
check("after git add the conflict is marked as resolved", git(repo, "ls-files", "--unmerged") == "")
git(repo, "commit", "--quiet", "--no-edit")
check("the resolved merge is a commit with two parents", len(parents("main")) == 2 and parents("main")[1] == full("egg"))
check("git log shows one merge commit on top", git(repo, "log", "--format=%s", "-n", "1").startswith("Merge branch 'egg'"))
print("\nok")
