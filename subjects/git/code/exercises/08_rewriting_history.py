"""Lesson 8: undoing and rewriting. reset (soft, mixed, hard), revert, amend, cherry-pick and restore.

Asserts what each form of git reset moves (HEAD only, HEAD and index, HEAD and index and working tree), that revert adds a
new commit instead of removing one, how to revert a merge commit, that amend and cherry-pick make commits with new ids,
and what git restore changes in the working tree and in the index.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from gitlab import check, git, git_rc, init, reset_clock, save, show, tick, write  # noqa: E402

reset_clock()
rev = lambda repo, name: git(repo, "rev-parse", name)  # noqa: E731
subjects = lambda repo, rng="HEAD": git(repo, "log", "--format=%s", rng).splitlines()  # noqa: E731


def build(name: str):
    repo = init(name)
    save(repo, "a.txt", "1\n", "C1")
    save(repo, "a.txt", "1\n2\n", "C2")
    save(repo, "a.txt", "1\n2\n3\n", "C3")
    return repo


# ---- 1. the three kinds of reset: how far down the three areas each one goes ----
for mode, head_moves, index_matches_head, tree_matches_head in [("--soft", True, False, False), ("--mixed", True, True, False), ("--hard", True, True, True)]:
    repo = build("08_reset" + mode.replace("--", "_"))
    target = rev(repo, "HEAD~1")
    git(repo, "reset", "--quiet", mode, "HEAD~1")
    staged = git(repo, "diff", "--staged", "--name-only")
    unstaged = git(repo, "diff", "--name-only")
    content = (repo / "a.txt").read_text()
    show(f"git reset {mode} HEAD~1", f"HEAD moved: {rev(repo, 'HEAD') == target}\nstaged changes: {staged!r}\nunstaged changes: {unstaged!r}\nfile content: {content!r}")
    check(f"reset {mode}: the branch moves back one commit", rev(repo, "HEAD") == target)
    check(f"reset {mode}: the index {'matches' if index_matches_head else 'still holds the old commit, so a staged change is left'}", (staged == "") == index_matches_head)
    check(f"reset {mode}: the working tree {'matches HEAD' if tree_matches_head else 'keeps the file as it was'}", (content == "1\n2\n") == tree_matches_head)
    check(f"reset {mode}: the old commit is still in the object store", git(repo, "cat-file", "-t", git(repo, "rev-parse", "ORIG_HEAD")) == "commit")

repo = build("08_reset_path")
git(repo, "reset", "--quiet", "HEAD~1", "--", "a.txt")
check("reset with a path does not move the branch: it only copies that path from a commit into the index", rev(repo, "HEAD") != rev(repo, "HEAD~1") and git(repo, "diff", "--staged", "--name-only") == "a.txt" and (repo / "a.txt").read_text() == "1\n2\n3\n")

# ---- 2. revert: a new commit that undoes an old one, safe for shared history ----
repo = build("08_revert")
save(repo, "b.txt", "bug\n", "C4 introduce a bug")
save(repo, "c.txt", "ok\n", "C5 unrelated work")
before = rev(repo, "HEAD")
git(repo, "revert", "--no-edit", "--quiet", "HEAD~1")
show("git log --oneline  (after git revert HEAD~1)", git(repo, "log", "--oneline"))
check("revert added a commit on top and kept the old ones", subjects(repo)[0] == 'Revert "C4 introduce a bug"' and "C4 introduce a bug" in subjects(repo) and len(subjects(repo)) == 6)
check("the new commit's parent is the old tip, so a push is a plain fast-forward", rev(repo, "HEAD~1") == before)
check("the bug file is gone and the unrelated work stays", not (repo / "b.txt").exists() and (repo / "c.txt").exists())

repo = init("08_revert_merge")
save(repo, "a.txt", "1\n", "C1")
git(repo, "switch", "--quiet", "-c", "topic")
save(repo, "t.txt", "t\n", "T1 topic work")
git(repo, "switch", "--quiet", "main")
save(repo, "m.txt", "m\n", "M1 main work")
git(repo, "merge", "--no-ff", "--no-edit", "--quiet", "topic")
code, out = git_rc(repo, "revert", "--no-edit", "HEAD")
show("git revert HEAD  (a merge commit)", out)
check("git cannot revert a merge commit unless you say which parent is the mainline", code != 0 and "is a merge but no -m option was given" in out, out)
git(repo, "revert", "--no-edit", "--quiet", "-m", "1", "HEAD")
check("-m 1 keeps the first parent (main) as the line to return to, and removes the topic's files", not (repo / "t.txt").exists() and (repo / "m.txt").exists())

# ---- 3. amend: replace the last commit ----
repo = build("08_amend")
old = rev(repo, "HEAD")
write(repo, "a.txt", "1\n2\n3\nfixed\n")
git(repo, "add", "a.txt")
git(repo, "commit", "--quiet", "--amend", "-m", "C3 with the fix folded in")
check("amend makes a different commit, with the same parent", rev(repo, "HEAD") != old and rev(repo, "HEAD~1") == rev(repo, f"{old}~1"))
check("the old commit is not in any branch any more", git(repo, "branch", "--contains", old) == "")
check("the old commit still exists until garbage collection", git(repo, "cat-file", "-t", old) == "commit")
after = rev(repo, "HEAD")
tick()
git(repo, "commit", "--quiet", "--amend", "--no-edit")
check("even an amend that changes nothing gives a new id, because the committer time is part of the commit", rev(repo, "HEAD") != after and git(repo, "diff", after, "HEAD") == "")

# ---- 4. cherry-pick: copy one commit onto another branch ----
repo = init("08_cherry")
save(repo, "base.txt", "b\n", "B base")
git(repo, "switch", "--quiet", "-c", "dev")
save(repo, "x.txt", "x\n", "D1 feature x")
fix = save(repo, "fix.txt", "fix\n", "D2 hot fix")
save(repo, "y.txt", "y\n", "D3 feature y")
git(repo, "switch", "--quiet", "main")
git(repo, "cherry-pick", fix)
show("git log --oneline --all --graph", git(repo, "log", "--oneline", "--all", "--graph"))
check("cherry-pick copies exactly one commit onto the current branch", subjects(repo) == ["D2 hot fix", "B base"] and (repo / "fix.txt").exists() and not (repo / "x.txt").exists())
check("the copy has a new id because its parent is different", rev(repo, "HEAD") != rev(repo, fix))
same = lambda r: git(repo, "patch-id", "--stable", stdin=git(repo, "show", r)).split()[0]  # noqa: E731
check("but the change it makes is the same: same patch-id", same("HEAD") == same(fix))
git(repo, "cherry-pick", "-x", "--quiet", "dev~0")
check("-x records the original id in the message", f"(cherry picked from commit {rev(repo, 'dev~0')})" in git(repo, "log", "-n", "1", "--format=%B"))
check("git cherry marks a commit '-' when main already has the same change, and '+' when it does not", [l[:1] for l in git(repo, "cherry", "-v", "main", "dev").splitlines()] == ["+", "-", "-"], git(repo, "cherry", "-v", "main", "dev"))

# ---- 5. restore: take a file back from the index or from a commit ----
repo = build("08_restore")
write(repo, "a.txt", "1\n2\n3\nscribble\n")
git(repo, "add", "a.txt")
write(repo, "a.txt", "1\n2\n3\nscribble\nmore\n")
git(repo, "restore", "a.txt")
check("restore a.txt takes the file from the index, so the unstaged edit is lost", (repo / "a.txt").read_text() == "1\n2\n3\nscribble\n")
git(repo, "restore", "--staged", "a.txt")
check("restore --staged takes the index entry from HEAD and leaves the file alone", git(repo, "diff", "--staged") == "" and "scribble" in (repo / "a.txt").read_text())
git(repo, "restore", "--source", "HEAD~2", "a.txt")
check("restore --source takes the file from any commit", (repo / "a.txt").read_text() == "1\n")
write(repo, "junk.tmp", "x\n")
check("git clean -n only lists what it would delete", "junk.tmp" in git(repo, "clean", "-n") and (repo / "junk.tmp").exists())
git(repo, "clean", "-f", "--quiet")
check("git clean -f deletes untracked files for good (they were never in the object store)", not (repo / "junk.tmp").exists())
print("\nok")
