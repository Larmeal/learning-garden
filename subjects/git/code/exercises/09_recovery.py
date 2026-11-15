"""Lesson 9: stash, reflog and getting lost commits back.

Asserts that a stash is a pair of commits (on the refs/stash ref), what git stash does and does not take, that the reflog
records every move of HEAD and of a branch, how to bring back a commit after reset --hard, after a deleted branch and after a
bad rebase, what git fsck lists as dangling, and that a commit is really gone only after the reflog entry expires and
garbage collection runs.
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from gitlab import check, git, git_rc, init, reset_clock, save, show, write  # noqa: E402

reset_clock()
rev = lambda repo, name: git(repo, "rev-parse", name)  # noqa: E731

# ---- 1. stash: put the work in progress aside ----
repo = init("09_stash")
save(repo, "a.txt", "1\n", "C1")
save(repo, "b.txt", "b\n", "C2")
write(repo, "a.txt", "1\nwork in progress\n")
git(repo, "add", "a.txt")
write(repo, "b.txt", "b\nunstaged edit\n")
write(repo, "new.txt", "untracked\n")
out = git(repo, "stash", "push", "-m", "half done")
show("git stash push -m 'half done'", out)
check("the working tree is clean again for tracked files", git(repo, "status", "--short") == "?? new.txt")
check("an untracked file is not stashed unless you ask with -u", (repo / "new.txt").exists())
check("a stash is stored as a commit on the ref refs/stash", git(repo, "cat-file", "-t", "refs/stash") == "commit")
parents = git(repo, "rev-list", "--parents", "-n", "1", "refs/stash").split()[1:]
check("the stash commit has two parents: the commit you were on, and the index state", len(parents) == 2 and parents[0] == rev(repo, "HEAD"))
check("git stash list shows it with the message", git(repo, "stash", "list") == "stash@{0}: On main: half done")
git(repo, "switch", "--quiet", "-c", "other")
git(repo, "stash", "pop", "--quiet")
check("pop brings the edits back on another branch and drops the stash", (repo / "a.txt").read_text().endswith("work in progress\n") and git(repo, "stash", "list") == "")
check("the staged edit comes back unstaged, unless you pass --index", git(repo, "status", "--short").startswith(" M a.txt"))
git(repo, "stash", "push", "--quiet", "-u", "-m", "with untracked")
check("-u takes untracked files too", not (repo / "new.txt").exists())
git(repo, "stash", "apply", "--quiet")
check("apply restores but keeps the stash, so it can be applied again", git(repo, "stash", "list") != "" and (repo / "new.txt").exists())
git(repo, "stash", "drop", "--quiet")

# ---- 2. the reflog: where HEAD and each branch have been ----
repo = init("09_reflog")
c1 = save(repo, "a.txt", "1\n", "C1")
c2 = save(repo, "a.txt", "1\n2\n", "C2")
c3 = save(repo, "a.txt", "1\n2\n3\n", "C3")
git(repo, "reset", "--hard", "--quiet", "HEAD~2")
log = git(repo, "reflog")
show("git reflog", log)
lines = log.splitlines()
check("every move of HEAD is a line, newest first", lines[0].startswith(f"{c1} HEAD@{{0}}: reset: moving to HEAD~2") and len(lines) == 4, log)
check("HEAD@{1} names where HEAD was before the last move", rev(repo, "HEAD@{1}") == rev(repo, c3))
check("the branch has its own reflog", git(repo, "reflog", "show", "main").splitlines()[0].startswith(f"{c1} main@{{0}}"))
check("a reflog lives in .git/logs and is local: it is never pushed", (repo / ".git" / "logs" / "HEAD").is_file())

# ---- 3. bring back what reset --hard threw away ----
git(repo, "reset", "--hard", "--quiet", "HEAD@{1}")
check("git reset --hard HEAD@{1} returns to the lost tip, with the files", rev(repo, "HEAD") == rev(repo, c3) and (repo / "a.txt").read_text() == "1\n2\n3\n")

# ---- 4. a deleted branch ----
git(repo, "switch", "--quiet", "-c", "experiment")
dead = save(repo, "e.txt", "e\n", "E1 experiment")
git(repo, "switch", "--quiet", "main")
git(repo, "branch", "-D", "experiment")
check("the branch is gone", "experiment" not in git(repo, "branch"))
found = [l for l in git(repo, "reflog").splitlines() if "moving from experiment to main" in l]
check("the reflog still says where experiment was: the line before the switch", len(found) == 1)
entries = git(repo, "reflog", "--format=%h %gs").splitlines()
at = [i for i, l in enumerate(entries) if "moving from experiment to main" in l][0]
check("the line just below it (the older one) is the last commit made on the deleted branch, with its id in front", entries[at + 1].startswith(dead[:7]) and "E1 experiment" in entries[at + 1], entries[at + 1])
git(repo, "branch", "experiment", dead)
check("a branch made from the id brings it back", rev(repo, "experiment") == rev(repo, dead))

# ---- 5. dangling commits, found without the reflog ----
git(repo, "switch", "--quiet", "experiment")
lost = save(repo, "lost.txt", "x\n", "L1 will be lost")
git(repo, "switch", "--quiet", "main")
git(repo, "branch", "-D", "experiment")
dang = git(repo, "fsck", "--lost-found", "--no-reflogs")
show("git fsck --lost-found --no-reflogs", dang)
check("fsck lists a commit that nothing reaches as dangling", f"dangling commit {rev(repo, lost)}" in dang, dang)
check("--lost-found copies it into .git/lost-found/commit", (repo / ".git" / "lost-found" / "commit" / rev(repo, lost)).is_file())

# ---- 6. really gone: expire the reflog, then collect garbage ----
git(repo, "reflog", "expire", "--expire=now", "--all")
git(repo, "gc", "--quiet", "--prune=now")
code, text = git_rc(repo, "cat-file", "-t", lost)
show("git cat-file -t <lost commit>  (after reflog expire and gc --prune=now)", text)
check("after the reflog is expired and gc prunes, the object is deleted", code != 0)
check("a commit that is still in a branch survives the same cleanup", git(repo, "cat-file", "-t", c3) == "commit")
# ---- 7. how long does the reflog keep an entry? (measured, because the number differs between sources) ----
def entries_after(age_days: int, *expire_args: str) -> int:
    repo = init("09_expiry")
    save(repo, "a.txt", "1\n", "C1")
    stamp = int(time.time()) - age_days * 86400
    write(repo, "old.txt", "x\n")
    git(repo, "add", "old.txt")
    git(repo, "commit", "--quiet", "-m", "old work", env={"GIT_COMMITTER_DATE": f"{stamp} +0000", "GIT_AUTHOR_DATE": f"{stamp} +0000"})
    git(repo, "reflog", "expire", *expire_args)
    return git(repo, "reflog", "--format=%gs").count("commit: old work")


check("by default an entry 20 days old is kept", entries_after(20, "--all") == 1)
check("by default an entry 40 days old is already expired (Git 2.56.1: reflog.h sets the default to 30 days)", entries_after(40, "--all") == 0)
check("--expire=90.days.ago keeps the 40-day-old entry", entries_after(40, "--expire=90.days.ago", "--all") == 1)
print("\nok")
