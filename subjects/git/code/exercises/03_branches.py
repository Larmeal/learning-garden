"""Lesson 3: a branch is a file with one commit id, and HEAD says which branch you are on.

Asserts that a branch is a 41-byte file under .git/refs/heads, that a new commit moves only the current branch,
that switching branches rewrites the working tree, that a detached HEAD holds a commit id, that git refuses to switch
when a change would be lost, and what deleting a branch does (and does not) remove.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from gitlab import check, git, git_rc, init, reset_clock, save, show, write  # noqa: E402

reset_clock()
repo = init("03_branches")
git_dir = repo / ".git"
c1 = save(repo, "app.txt", "v1\n", "c1")
c2 = save(repo, "app.txt", "v1\nv2\n", "c2")
full = lambda rev: git(repo, "rev-parse", rev)  # noqa: E731

# ---- 1. a branch is a small file ----
main_file = git_dir / "refs" / "heads" / "main"
content = main_file.read_text()
show("cat .git/refs/heads/main", content.strip())
check("the file holds the 40-letter id of the newest commit and a newline (41 bytes)", len(content) == 41 and content.strip() == full("main"))
check("HEAD holds the name of the current branch, not an id", (git_dir / "HEAD").read_text().strip() == "ref: refs/heads/main")
git(repo, "branch", "feature")
check("git branch makes a second file with the same id", (git_dir / "refs" / "heads" / "feature").read_text().strip() == full("main"))
check("making a branch does not touch the working tree or add an object", git(repo, "status", "--short") == "")
check("git branch lists both, and marks the current one", git(repo, "branch").splitlines() == ["  feature", "* main"])

# ---- 2. a commit moves the current branch only ----
git(repo, "switch", "--quiet", "feature")
check("HEAD now names feature", (git_dir / "HEAD").read_text().strip() == "ref: refs/heads/feature")
c3 = save(repo, "feature.txt", "f\n", "c3 on feature")
check("feature moved to the new commit", full("feature") == full(c3))
check("main stayed where it was", full("main") == full(c2))
check("the new file is in the working tree on feature", (repo / "feature.txt").exists())
git(repo, "switch", "--quiet", "main")
check("switching to main removes the file from the working tree", not (repo / "feature.txt").exists())
git(repo, "switch", "--quiet", "feature")
check("switching back brings it back", (repo / "feature.txt").read_text() == "f\n")
git(repo, "switch", "--quiet", "main")

# ---- 3. git switch -c, and what happens to a change that has not been committed ----
write(repo, "app.txt", "v1\nv2\nwip\n")
git(repo, "switch", "--quiet", "-c", "wip")      # nothing conflicts, so the change comes along
check("an uncommitted change travels to the new branch", (repo / "app.txt").read_text().endswith("wip\n"))
git(repo, "add", "app.txt")
save(repo, "app.txt", "v1\nv2\nwip\n", "c4 wip")
git(repo, "switch", "--quiet", "main")
write(repo, "app.txt", "v1\nv2\nlocal edit\n")
code, text = git_rc(repo, "switch", "wip")      # app.txt differs between the branches and has a local edit
show("git switch wip  (with a local edit of app.txt)", text)
check("git refuses to switch when it would overwrite a local change", code != 0 and "would be overwritten" in text, text)
git(repo, "checkout", "--quiet", "--", "app.txt")

# ---- 4. detached HEAD ----
git(repo, "switch", "--quiet", "--detach", c1)
head = (git_dir / "HEAD").read_text().strip()
check("a detached HEAD holds a commit id", head == full(c1))
check("git branch shows the detached state", "HEAD detached at" in git(repo, "branch").splitlines()[0])
c5 = save(repo, "lost.txt", "x\n", "c5 made on a detached HEAD")
git(repo, "switch", "--quiet", "main")
check("no branch points at the commit made while detached", git(repo, "branch", "--contains", c5) == "")
git(repo, "branch", "rescue", c5)
check("a branch made from its id keeps it", git(repo, "branch", "--contains", c5) == "  rescue")

# ---- 5. deleting a branch removes the name, not the commits ----
code, text = git_rc(repo, "branch", "-d", "feature")
show("git branch -d feature  (c3 is only on feature)", text)
check("-d refuses a branch whose commits are not merged anywhere", code != 0 and "not fully merged" in text, text)
git(repo, "branch", "-D", "feature")
check("-D deletes the name", not (git_dir / "refs" / "heads" / "feature").exists())
check("the commit is still in the object store", git(repo, "cat-file", "-t", c3) == "commit")
git(repo, "merge", "--quiet", "wip")
check("-d works after the branch is merged", git_rc(repo, "branch", "-d", "wip")[0] == 0)
print("\nok")
