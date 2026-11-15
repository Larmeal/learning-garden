"""Lesson 10: finding the commit. bisect, blame, and searching history for a string (pickaxe) or a pattern.

Asserts that git bisect finds the first bad commit among 16 in at most 4 steps, that git bisect run does it unattended with
a script, what git blame prints per line and how -L and ignoring a whitespace-only commit change it, and the difference
between git log -S (the number of occurrences changed) and -G (a changed line matches a pattern).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from gitlab import check, commit, git, init, reset_clock, save, show, write  # noqa: E402

reset_clock()
rev = lambda repo, name: git(repo, "rev-parse", name)  # noqa: E731

# ---- 1. bisect: 16 commits, one of them breaks the test ----
repo = init("10_bisect")
write(repo, "check.py", "import sys\nvalue = int(open('config.txt').read().strip())\nsys.exit(0 if value >= 0 else 1)\n")
ids = []
for n in range(1, 17):
    value = "5" if n < 11 else "-5"                    # commit 11 is the first bad one
    write(repo, "config.txt", value + "\n")
    write(repo, "notes.txt", f"change {n}\n")
    git(repo, "add", ".")
    ids.append(commit(repo, f"commit {n}"))
bad = rev(repo, ids[10])
check("the test passes on commit 10 and fails on commit 11", git(repo, "show", f"{ids[9]}:config.txt") == "5" and git(repo, "show", f"{ids[10]}:config.txt") == "-5")
git(repo, "bisect", "start", "HEAD", ids[0])
steps = 0
while steps < 8:
    cfg = (repo / "config.txt").read_text().strip()
    verdict = "good" if int(cfg) >= 0 else "bad"
    out = git(repo, "bisect", verdict)
    steps += 1
    if "is the first 'bad' commit" in out:
        break
show("git bisect (the last answer)", out.splitlines()[0])
check("bisect names the first bad commit", "is the first 'bad' commit" in out and out.startswith(bad), out.splitlines()[0])
check("it needed at most log2(16) = 4 answers", steps <= 4, str(steps))
git(repo, "bisect", "reset")
check("bisect reset returns to where you started", git(repo, "rev-parse", "--abbrev-ref", "HEAD") == "main")

out = git(repo, "bisect", "start", "HEAD", ids[0])
log = git(repo, "bisect", "run", sys.executable, "check.py")
show("git bisect run python check.py", "\n".join(log.splitlines()[-6:]))
check("bisect run does the same unattended, with a script's exit code (0 good, 1 to 124 bad)", f"{bad} is the first 'bad' commit" in log, log[-300:])
check("the log lists the 4 steps it took", log.count("running") <= 5)
git(repo, "bisect", "reset")

# ---- 2. blame: who last changed each line ----
repo = init("10_blame")
save(repo, "poem.txt", "roses are red\nviolets are blue\nsugar is sweet\n", "P1 first draft")
write(repo, "poem.txt", "roses are red\nviolets are purple\nsugar is sweet\n")
git(repo, "add", "poem.txt")
git(repo, "-c", "user.name=Bea", "-c", "user.email=bea@example.com", "commit", "--quiet", "-m", "P2 change a color", env={"GIT_AUTHOR_NAME": "Bea", "GIT_AUTHOR_EMAIL": "bea@example.com"})
fix = rev(repo, "HEAD")
blame = git(repo, "blame", "--date=short", "poem.txt")
show("git blame poem.txt", blame)
rows = blame.splitlines()
first = rev(repo, "HEAD~1")[:7]
check("each line shows the commit that last changed it (a ^ marks the root commit)", rows[0].lstrip("^").startswith(first) and rows[1].startswith(fix[:7]) and rows[2].lstrip("^").startswith(first), blame)
check("the author column differs per commit", "Ada" in rows[0] and "Bea" in rows[1])
check("-L limits blame to a line range", len(git(repo, "blame", "-L", "2,2", "poem.txt").splitlines()) == 1)
check("blame HEAD~1 -- file looks at the file as it was before the last commit", "violets are blue" in git(repo, "blame", "HEAD~1", "--", "poem.txt"))
write(repo, "poem.txt", "roses are red\n  violets are purple\nsugar is sweet\n")
git(repo, "add", "poem.txt")
fmt = commit(repo, "P3 reindent")
check("the id of the reindent commit is a real id", len(fmt) >= 7)
check("a reindent takes the blame for the line", git(repo, "blame", "-L", "2,2", "poem.txt").startswith(fmt[:7]))
check("-w ignores whitespace changes and finds the real author", git(repo, "blame", "-w", "-L", "2,2", "poem.txt").startswith(fix[:7]))
write(repo, ".git-blame-ignore-revs", rev(repo, fmt) + "\n")   # the file needs full ids, a short one is an error
check("--ignore-revs-file skips a listed commit, so the blame goes through it", git(repo, "blame", "--ignore-revs-file", ".git-blame-ignore-revs", "-L", "2,2", "poem.txt").lstrip("^?").startswith(fix[:7]))

# ---- 3. search the history: -S and -G ----
repo = init("10_pickaxe")
save(repo, "code.txt", "def price():\n    return 10\n", "S1 add price")
save(repo, "code.txt", "def price():\n    return 12\n", "S2 raise the price")
save(repo, "code.txt", "def price():\n    # TODO tax\n    return 12\n", "S3 add a todo")
save(repo, "code.txt", "def price():\n    # TODO tax\n    return 12  # euro\n", "S4 comment the number")
save(repo, "other.txt", "TODO later\n", "S5 another todo elsewhere")
s_count = git(repo, "log", "--format=%s", "-S", "TODO").splitlines()
show("git log --format=%s -S TODO", "\n".join(s_count))
check("-S lists commits that changed how many times the string occurs", s_count == ["S5 another todo elsewhere", "S3 add a todo"], str(s_count))
g_lines = git(repo, "log", "--format=%s", "-G", "return 1[0-9]").splitlines()
show("git log --format=%s -G 'return 1[0-9]'", "\n".join(g_lines))
check("-G lists commits where a changed line matches the pattern (S4 touched a 'return' line)", g_lines == ["S4 comment the number", "S2 raise the price", "S1 add price"], str(g_lines))
check("-S 'return 12' skips S4, because the number of occurrences did not change", git(repo, "log", "--format=%s", "-S", "return 12").splitlines() == ["S2 raise the price"])
check("--diff-filter=A lists only commits that added files", git(repo, "log", "--format=%s", "--diff-filter=A").splitlines() == ["S5 another todo elsewhere", "S1 add price"])
check("git log -L follows the history of a line range", "return 12" in git(repo, "log", "-L", "3,3:code.txt", "--format=%s"))

# ---- 4. follow a renamed file ----
git(repo, "mv", "code.txt", "pricing.txt")
commit(repo, "S6 rename code to pricing")
check("git log -- pricing.txt stops at the rename", git(repo, "log", "--format=%s", "--", "pricing.txt") == "S6 rename code to pricing")
check("--follow goes on through the rename", len(git(repo, "log", "--follow", "--format=%s", "--", "pricing.txt").splitlines()) == 5)
print("\nok")
