"""Lesson 1: a repository, the three areas and the first commit.

Asserts that git init makes a .git folder and nothing else, that a file moves from the working tree to the index with
git add and into the repository with git commit, that git diff and git diff --staged compare different pairs of the
three areas, and that the ids printed in the lesson repeat on every run.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from gitlab import check, commit, git, git_rc, init, reset_clock, show, write  # noqa: E402

reset_clock()
repo = init("01_first_commit")

# ---- 1. git init makes only the .git folder ----
names = sorted(p.name for p in repo.iterdir())
check("a new repository holds only .git", names == [".git"], str(names))
head = (repo / ".git" / "HEAD").read_text().strip()
check("HEAD points at the branch main that does not exist yet", head == "ref: refs/heads/main", head)
show("git status", git(repo, "status"))
check("status says there are no commits yet", "No commits yet" in git(repo, "status"))

# ---- 2. an untracked file: only the working tree knows it ----
write(repo, "notes.txt", "hello\n")
show("git status --short", git(repo, "status", "--short"))
check("a new file is untracked", git(repo, "status", "--short") == "?? notes.txt")
check("the index holds nothing", git(repo, "ls-files", "--stage") == "")

# ---- 3. git add copies the file into the index and the content into the object store ----
git(repo, "add", "notes.txt")
check("a new file that is staged is 'A '", git(repo, "status", "--short") == "A  notes.txt")
staged = git(repo, "ls-files", "--stage")
show("git ls-files --stage", staged)
check("the index entry holds the blob id of 'hello' with mode 100644", staged == "100644 ce013625030ba8dba906f756967f9e9ca394464a 0\tnotes.txt", staged)
check("git add already wrote the blob into .git/objects", (repo / ".git" / "objects" / "ce" / "013625030ba8dba906f756967f9e9ca394464a").is_file())

# ---- 4. git commit builds a tree and a commit from the index ----
first = commit(repo, "Add notes")
show("git log --oneline", git(repo, "log", "--oneline"))
check("the first commit has the same id on every run", first == "41d3c6b", first)
check("status is clean after the commit", git(repo, "status", "--short") == "")
check("the branch main now exists", (repo / ".git" / "refs" / "heads" / "main").is_file())
check("a root commit has no parent line", "parent" not in git(repo, "cat-file", "-p", "HEAD"))

# ---- 5. git diff compares working tree with index, git diff --staged compares index with the last commit ----
write(repo, "notes.txt", "hello\nworld\n")
check("git diff shows an unstaged change", "+world" in git(repo, "diff"))
check("git diff --staged shows nothing yet", git(repo, "diff", "--staged") == "")
git(repo, "add", "notes.txt")
check("after git add, git diff shows nothing", git(repo, "diff") == "")
check("after git add, git diff --staged shows the change", "+world" in git(repo, "diff", "--staged"))
check("status short for a staged modification is 'M '", git(repo, "status", "--short") == "M  notes.txt")
write(repo, "notes.txt", "hello\nworld\nagain\n")
check("a file that changed after git add is 'MM'", git(repo, "status", "--short") == "MM notes.txt")

# ---- 6. a commit stores what is in the index, not what is in the file now ----
second = commit(repo, "Add world")
show("git log --oneline", git(repo, "log", "--oneline"))
check("the second commit has the same id on every run too", second == "66df49b", second)
check("the commit holds the version that was staged, without the line added afterwards", git(repo, "show", f"{second}:notes.txt") == "hello\nworld")
check("the later edit is still in the working tree and shows up as an unstaged change", git(repo, "status", "--short") == " M notes.txt" and (repo / "notes.txt").read_text() == "hello\nworld\nagain\n")
check("git commit -a would have taken it, because -a stages every tracked file that changed", "again" in git(repo, "diff"))

# ---- 7. .gitignore: a rule that keeps files out of status, and out of git add ----
write(repo, ".gitignore", "*.log\n")
write(repo, "debug.log", "noise\n")
git(repo, "add", "notes.txt")
commit(repo, "Add again")
status = git(repo, "status", "--short")
show("git status --short  (with .gitignore and debug.log)", status)
check("an ignored file is not listed as untracked, and the .gitignore itself is", status == "?? .gitignore")
check("git check-ignore -v names the rule and the line that ignored the file", git(repo, "check-ignore", "-v", "debug.log") == ".gitignore:1:*.log\tdebug.log")
code, out = git_rc(repo, "add", "debug.log")
check("git add refuses an ignored file unless it is forced with -f", code != 0 and "ignored by one of your .gitignore files" in out, out)
git(repo, "add", "-f", "debug.log")
check("a file that was forced in is tracked from then on, whatever the rule says", git(repo, "ls-files", "debug.log") == "debug.log")
print("\nok")
