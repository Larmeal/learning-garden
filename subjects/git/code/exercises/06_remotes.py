"""Lesson 6: remotes. Clone, fetch, push, tracking branches and what a rejected push means.

The remote is a bare repository in a folder, and two clones play Alice and Bob, so the exercise needs no network and no account.
Asserts what git clone records in .git/config, that fetch moves only the remote-tracking branch, that pull is fetch plus
merge, that a push that would lose commits is rejected, how --force-with-lease protects against overwriting a colleague,
and how branches are deleted and pruned.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from gitlab import LAB, check, fresh, git, git_rc, init, reset_clock, save, show  # noqa: E402

reset_clock()
rev = lambda repo, name: git(repo, "rev-parse", name)  # noqa: E731

# ---- 1. a bare repository is the meeting point; a clone remembers where it came from ----
origin = init("06_origin.git", bare=True)
check("a bare repository has no working tree: its content is what .git normally holds", (origin / "HEAD").is_file() and not (origin / ".git").exists())
url = origin.as_posix()
alice = fresh("06_alice")
git(alice, "init", "--quiet")
git(alice, "remote", "add", "origin", url)
save(alice, "readme.txt", "Garden\n", "A1 first commit")
out = git(alice, "push", "-u", "origin", "main")
show("git push -u origin main", out)
cfg = (alice / ".git" / "config").read_text()
show("cat .git/config  (the parts about origin and main)", "\n".join(l for l in cfg.splitlines() if l.startswith("[remote") or l.startswith("[branch") or "origin" in l or "merge" in l or "remote =" in l))
check("the remote is stored as a name and a url", f'[remote "origin"]' in cfg and f"url = {url}" in cfg)
check("-u wrote the tracking pair into [branch \"main\"]", '[branch "main"]' in cfg and "merge = refs/heads/main" in cfg)
check("push created the branch in the remote", rev(origin, "main") == rev(alice, "main"))
check("a remote-tracking branch is a local file that remembers the last known place of the remote", (alice / ".git" / "refs" / "remotes" / "origin" / "main").read_text().strip() == rev(alice, "main"))

bob = fresh("06_bob")
git(bob, "clone", "--quiet", url, ".")
check("clone copies the whole history and checks out main", git(bob, "log", "--format=%s") == "A1 first commit")
check("clone names the remote origin", git(bob, "remote", "-v").splitlines() == [f"origin\t{url} (fetch)", f"origin\t{url} (push)"])
check("clone sets main to track origin/main", "[origin/main]" in git(bob, "branch", "-vv"))

# ---- 2. fetch moves only origin/main; merge moves main ----
save(alice, "readme.txt", "Garden\nplants\n", "A2 add plants")
git(alice, "push", "--quiet")
check("before fetch Bob does not know the new commit", rev(bob, "origin/main") != rev(alice, "main"))
out = git(bob, "fetch")
show("git fetch", out or "(the output goes to stderr)")
check("fetch moved the remote-tracking branch", rev(bob, "origin/main") == rev(alice, "main"))
check("fetch did not touch Bob's own branch or his files", rev(bob, "main") != rev(alice, "main") and (bob / "readme.txt").read_text() == "Garden\n")
check("git status counts the commits Bob is behind", "Your branch is behind 'origin/main' by 1 commit" in git(bob, "status"))
check("git log main..origin/main lists what a merge would bring", git(bob, "log", "--format=%s", "main..origin/main") == "A2 add plants")
check("git merge origin/main is a fast-forward here", "Fast-forward" in git(bob, "merge", "origin/main"))
check("git status is up to date again", "up to date" in git(bob, "status"))

# ---- 3. pull is fetch plus merge (or plus rebase) ----
save(alice, "readme.txt", "Garden\nplants\nwater\n", "A3 add water")
git(alice, "push", "--quiet")
out = git(bob, "pull")
check("git pull = fetch + merge: Bob has the new commit and a clean tree", "Fast-forward" in out and git(bob, "log", "--format=%s", "-n", "1") == "A3 add water")

# ---- 4. a rejected push: the remote has a commit you do not have ----
save(alice, "alice.txt", "a\n", "A4 alice work")
git(alice, "push", "--quiet")
save(bob, "bob.txt", "b\n", "B1 bob work")
code, out = git_rc(bob, "push")
show("git push  (Bob, who has not fetched A4)", out)
check("the push is rejected and nothing changed in the remote", code != 0 and "rejected" in out and "fetch first" in out and rev(origin, "main") == rev(alice, "main"), out)
git(bob, "pull", "--no-rebase", "--no-edit", "--quiet")
check("after pull Bob's main has both lines of work (a merge commit)", len(git(bob, "rev-list", "--parents", "-n", "1", "HEAD").split()) == 3)
git(bob, "push", "--quiet")
check("now the push is accepted", rev(origin, "main") == rev(bob, "main"))
git(alice, "pull", "--quiet", "--no-rebase")

# ---- 5. pull --rebase keeps the history straight ----
save(alice, "alice2.txt", "a2\n", "A5 alice again")
git(alice, "push", "--quiet")
save(bob, "bob2.txt", "b2\n", "B2 bob again")
git(bob, "pull", "--rebase", "--quiet")
check("pull --rebase replays Bob's commit on top of Alice's, with no merge commit", git(bob, "log", "--format=%s", "-n", "2") == "B2 bob again\nA5 alice again" and len(git(bob, "rev-list", "--parents", "-n", "1", "HEAD").split()) == 2)
git(bob, "push", "--quiet")
git(alice, "pull", "--quiet", "--no-rebase")

# ---- 6. force with lease ----
git(alice, "fetch", "--quiet")
git(alice, "reset", "--quiet", "--hard", "HEAD~1")
save(alice, "alice3.txt", "a3\n", "A6 replaces the last commit")
code, out = git_rc(alice, "push")
check("a plain push of a rewritten history is rejected", code != 0 and "rejected" in out, out)
save(bob, "bob3.txt", "b3\n", "B3 bob pushes meanwhile")
git(bob, "push", "--quiet")
code, out = git_rc(alice, "push", "--force-with-lease")
show("git push --force-with-lease  (Bob pushed after Alice's last fetch)", out)
check("--force-with-lease refuses when the remote moved since the last fetch", code != 0 and ("stale info" in out or "rejected" in out), out)
git(alice, "fetch", "--quiet")
git(alice, "rebase", "--quiet", "origin/main")
code, out = git_rc(alice, "push", "--force-with-lease")
check("after fetching and rebasing, the lease matches and the push goes through", code == 0 and rev(origin, "main") == rev(alice, "main"), out)

# ---- 7. other branches, listing, deleting and pruning ----
git(alice, "push", "--quiet", "origin", "main:release")
check("main:release pushes the local main to a remote branch called release", rev(origin, "release") == rev(alice, "main"))
ls = git(alice, "ls-remote", "--heads", "origin")
show("git ls-remote --heads origin", ls)
check("ls-remote lists the branches of the remote with their ids", {l.split("\t")[1] for l in ls.splitlines()} == {"refs/heads/main", "refs/heads/release"})
git(bob, "fetch", "--quiet")
check("Bob now has origin/release", (bob / ".git" / "refs" / "remotes" / "origin" / "release").exists() or "origin/release" in git(bob, "branch", "-r"))
git(alice, "push", "--quiet", "origin", "--delete", "release")
check("the branch is gone from the remote", "release" not in git(alice, "ls-remote", "--heads", "origin"))
git(bob, "fetch", "--quiet")
check("a plain fetch keeps the stale remote-tracking branch", "origin/release" in git(bob, "branch", "-r"))
git(bob, "fetch", "--quiet", "--prune")
check("fetch --prune removes it", "origin/release" not in git(bob, "branch", "-r"))
print("\nok")
