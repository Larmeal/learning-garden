"""Lesson 5: rebase. It replays your commits on a new base, so they get new ids, and the history stays a straight line.

Asserts what plain rebase does to ids and to the shape of the history, that the old commits stay reachable through
ORIG_HEAD and the reflog, how a conflict stops the replay and how --continue and --abort end it, what --onto changes,
and what an interactive rebase (squash, reword, drop) produces. The interactive todo list is written by a script, so the
exercise needs no editor.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from gitlab import check, git, git_rc, init, reset_clock, save, show, write  # noqa: E402

reset_clock()


def lines(repo, rev="HEAD", fmt="%s"):
    return git(repo, "log", f"--format={fmt}", rev).splitlines()


# ---- 1. plain rebase: same changes, new ids ----
repo = init("05_rebase")
save(repo, "base.txt", "b\n", "B1 base")
git(repo, "switch", "--quiet", "-c", "feature")
f1 = save(repo, "f1.txt", "one\n", "F1 feature one")
f2 = save(repo, "f2.txt", "two\n", "F2 feature two")
git(repo, "switch", "--quiet", "main")
save(repo, "m.txt", "main work\n", "M1 main one")
git(repo, "switch", "--quiet", "feature")
old_tip = git(repo, "rev-parse", "HEAD")
old_f1 = git(repo, "rev-parse", f1)
show("git log --oneline --graph --all  (before)", git(repo, "log", "--oneline", "--graph", "--all"))
out = git(repo, "rebase", "main")
show("git rebase main", out)
show("git log --oneline --graph --all  (after)", git(repo, "log", "--oneline", "--graph", "--all"))
check("the history is a straight line again", lines(repo) == ["F2 feature two", "F1 feature one", "M1 main one", "B1 base"])
check("no merge commit was made", all(len(l.split()) <= 2 for l in git(repo, "rev-list", "--parents", "HEAD").splitlines()))
check("the replayed commits have new ids", git(repo, "rev-parse", "HEAD") != old_tip and git(repo, "rev-parse", "HEAD~1") != old_f1)
check("a parent is part of a commit's id, so every commit above the new base changed", git(repo, "rev-parse", "HEAD~2") == git(repo, "rev-parse", "main"))
check("the changes themselves are the same: same patch-id", git(repo, "patch-id", "--stable", stdin=git(repo, "show", "HEAD")).split()[0] == git(repo, "patch-id", "--stable", stdin=git(repo, "show", old_tip)).split()[0])
check("main did not move", git(repo, "rev-parse", "main") == git(repo, "rev-parse", "HEAD~2"))

# ---- 2. the old commits are not gone ----
check("ORIG_HEAD holds the tip from before the rebase", git(repo, "rev-parse", "ORIG_HEAD") == old_tip)
check("the old commit object still exists", git(repo, "cat-file", "-t", old_tip) == "commit")
check("no branch contains the old tip any more", git(repo, "branch", "--contains", old_tip) == "")
reflog = git(repo, "reflog", "-n", "6")
show("git reflog -n 6", reflog)
check("the reflog remembers the rebase", "rebase (finish)" in reflog and "rebase (start)" in reflog)
git(repo, "reset", "--hard", "--quiet", "ORIG_HEAD")
check("git reset --hard ORIG_HEAD undoes the rebase", git(repo, "rev-parse", "HEAD") == old_tip)
git(repo, "rebase", "--quiet", "main")

# ---- 3. a conflict stops the replay ----
repo = init("05_rebase_conflict")
save(repo, "menu.txt", "soup\nsalad\nbread\n", "B1 base")
git(repo, "switch", "--quiet", "-c", "egg")
save(repo, "menu.txt", "soup\nsalad with egg\nbread\n", "E1 egg")
save(repo, "extra.txt", "x\n", "E2 extra")
git(repo, "switch", "--quiet", "main")
save(repo, "menu.txt", "soup\nsalad with tuna\nbread\n", "T1 tuna")
git(repo, "switch", "--quiet", "egg")
code, out = git_rc(repo, "rebase", "main")
show("git rebase main  (conflict)", out)
check("rebase stops at the first commit that conflicts", code == 1 and "CONFLICT (content): Merge conflict in menu.txt" in out)
check("git status says a rebase is in progress", "rebase in progress" in git(repo, "status"))
check("HEAD is detached while the replay runs", (repo / ".git" / "HEAD").read_text().strip() == git(repo, "rev-parse", "HEAD"))
text = (repo / "menu.txt").read_text()
check("in a rebase, 'HEAD' side is the branch you rebase onto and the other side is your commit", "<<<<<<< HEAD\nsalad with tuna\n=======\nsalad with egg\n>>>>>>>" in text, text)
write(repo, "menu.txt", "soup\nsalad with egg and tuna\nbread\n")
git(repo, "add", "menu.txt")
git(repo, "-c", "core.editor=true", "rebase", "--continue")
check("after --continue the replay finishes", "rebase in progress" not in git(repo, "status"))
check("the result is a straight line with the resolved file", lines(repo) == ["E2 extra", "E1 egg", "T1 tuna", "B1 base"] and "egg and tuna" in (repo / "menu.txt").read_text())

repo = init("05_rebase_abort")
save(repo, "menu.txt", "soup\nsalad\nbread\n", "B1 base")
git(repo, "switch", "--quiet", "-c", "egg")
save(repo, "menu.txt", "soup\nsalad with egg\nbread\n", "E1 egg")
before = git(repo, "rev-parse", "HEAD")
git(repo, "switch", "--quiet", "main")
save(repo, "menu.txt", "soup\nsalad with tuna\nbread\n", "T1 tuna")
git(repo, "switch", "--quiet", "egg")
git_rc(repo, "rebase", "main")
git(repo, "rebase", "--abort")
check("rebase --abort gives back the branch exactly as it was", git(repo, "rev-parse", "HEAD") == before and git(repo, "status", "--short") == "")

# ---- 4. --onto: move a slice of history somewhere else ----
repo = init("05_rebase_onto")
save(repo, "a.txt", "a\n", "A base")
git(repo, "switch", "--quiet", "-c", "topic1")
save(repo, "t1.txt", "1\n", "T1 topic one")
git(repo, "switch", "--quiet", "-c", "topic2")
save(repo, "t2.txt", "2\n", "T2 topic two (built on topic one)")
git(repo, "switch", "--quiet", "main")
save(repo, "m.txt", "m\n", "M main moves on")
git(repo, "switch", "--quiet", "topic2")
git(repo, "rebase", "--quiet", "--onto", "main", "topic1")
show("git rebase --onto main topic1  (on topic2)", git(repo, "log", "--oneline", "--graph", "--all"))
check("--onto main topic1 replays only what topic2 has beyond topic1, onto main", lines(repo) == ["T2 topic two (built on topic one)", "M main moves on", "A base"])
check("topic1 was left alone", lines(repo, "topic1") == ["T1 topic one", "A base"])

# ---- 5. interactive rebase: squash, reword, drop ----
repo = init("05_rebase_interactive")
save(repo, "log.txt", "start\n", "S0 start")
save(repo, "a.txt", "a\n", "A1 add a")
save(repo, "a.txt", "a\nfix\n", "A2 fix typo in a")
save(repo, "b.txt", "b\n", "B1 add b")
save(repo, "oops.txt", "debug\n", "O1 debug print")
script = repo.parent / "todo-editor.py"
script.write_text(
    "import sys\n"
    "path = sys.argv[1]\n"
    "out = []\n"
    "for line in open(path).read().splitlines():\n"
    "    if line.startswith('pick') and 'A2 fix typo' in line:\n"
    "        line = line.replace('pick', 'fixup', 1)\n"
    "    elif line.startswith('pick') and 'B1 add b' in line:\n"
    "        line = line.replace('pick', 'reword', 1)\n"
    "    elif line.startswith('pick') and 'O1 debug' in line:\n"
    "        line = line.replace('pick', 'drop', 1)\n"
    "    out.append(line)\n"
    "open(path, 'w').write('\\n'.join(out) + '\\n')\n"
)
msg_editor = repo.parent / "msg-editor.py"
msg_editor.write_text("import sys\nopen(sys.argv[1], 'w').write('B1 add b (reworded)\\n')\n")
py = sys.executable.replace("\\", "/")
git(repo, "rebase", "--quiet", "-i", "HEAD~4", env={"GIT_SEQUENCE_EDITOR": f'"{py}" "{script.as_posix()}"', "GIT_EDITOR": f'"{py}" "{msg_editor.as_posix()}"'})
result = lines(repo)
show("git log --format=%s  (after the interactive rebase)", "\n".join(result))
check("fixup folded A2 into A1, reword changed B1, drop removed O1", result == ["B1 add b (reworded)", "A1 add a", "S0 start"], str(result))
check("the folded commit holds both changes", (repo / "a.txt").read_text() == "a\nfix\n")
check("the dropped commit's file is gone", not (repo / "oops.txt").exists())
print("\nok")
