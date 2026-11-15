"""Lesson 7: the team workflow behind a pull request.

A pull request is a feature of a hosting site, not of Git. What Git itself provides is a branch that is pushed, a way to
compare it with main (git diff main...topic), and three ways to take it in: merge commit, squash and rebase. The exercise
runs all of that with two clones and a bare repository, and runs git request-pull, the command that writes the same
summary by hand. The site (reviews, checks, buttons) is not run.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from gitlab import LAB, check, fresh, git, init, reset_clock, save, show  # noqa: E402

reset_clock()
rev = lambda repo, name: git(repo, "rev-parse", name)  # noqa: E731
parents = lambda repo, name: git(repo, "rev-list", "--parents", "-n", "1", name).split()[1:]  # noqa: E731


def setup(tag: str):
    """A remote, a maintainer clone and a contributor clone that pushed a topic branch with two commits."""
    origin = init(f"07_{tag}_origin.git", bare=True)
    url = origin.as_posix()
    maint = fresh(f"07_{tag}_maintainer")
    git(maint, "init", "--quiet")
    git(maint, "remote", "add", "origin", url)
    save(maint, "app.txt", "v1\n", "M1 first version")
    git(maint, "push", "--quiet", "-u", "origin", "main")
    contrib = fresh(f"07_{tag}_contributor")
    git(contrib, "clone", "--quiet", url, ".")
    git(contrib, "switch", "--quiet", "-c", "topic/search")
    save(contrib, "search.txt", "s1\n", "C1 start search")
    save(contrib, "search.txt", "s1\ns2\n", "C2 finish search")
    git(contrib, "push", "--quiet", "-u", "origin", "topic/search")
    return origin, maint, contrib


# ---- 1. what a reviewer can ask Git before the site shows anything ----
origin, maint, contrib = setup("merge")
git(maint, "fetch", "--quiet")
show("git log --oneline main..origin/topic/search", git(maint, "log", "--oneline", "main..origin/topic/search"))
check("two commits are waiting on the topic branch", len(git(maint, "log", "--oneline", "main..origin/topic/search").splitlines()) == 2)
save(maint, "app.txt", "v1\nv2\n", "M2 main moves on meanwhile")
two = git(maint, "diff", "--stat", "main", "origin/topic/search")
three = git(maint, "diff", "--stat", "main...origin/topic/search")
show("git diff --stat main origin/topic/search", two)
show("git diff --stat main...origin/topic/search", three)
check("two dots compare the two tips, so main's own new change shows up as a removal", "app.txt" in two)
check("three dots compare from the fork point, so only the topic's work shows (the pull request diff)", "app.txt" not in three and "search.txt" in three)
req = git(contrib, "request-pull", "origin/main", (LAB / "07_merge_origin.git").as_posix(), "topic/search")  # the contributor runs it
show("git request-pull origin/main <url> topic/search  (run by the contributor)", req)
check("request-pull writes the summary a pull request shows: base, url, commits and diffstat", "The following changes since commit" in req and "C2 finish search" in req and "search.txt" in req, req)

# ---- 2. take it in with a merge commit (the default button) ----
git(maint, "merge", "--no-ff", "--no-edit", "--quiet", "origin/topic/search")
show("git log --oneline --graph  (merge commit)", git(maint, "log", "--oneline", "--graph"))
check("the history keeps the branch: a merge commit with two parents", len(parents(maint, "HEAD")) == 2)
check("both topic commits are still there with their own ids", git(maint, "log", "--format=%s", "--first-parent", "-n", "1").startswith("Merge") and "C1 start search" in git(maint, "log", "--format=%s"))
check("git log --first-parent reads like a list of pull requests", git(maint, "log", "--format=%s", "--first-parent").splitlines()[1:] == ["M2 main moves on meanwhile", "M1 first version"])

# ---- 3. squash: the topic becomes one new commit ----
origin, maint, contrib = setup("squash")
git(maint, "fetch", "--quiet")
git(maint, "merge", "--squash", "--quiet", "origin/topic/search")
git(maint, "commit", "--quiet", "-m", "Add search (#1)")
show("git log --oneline --graph  (squash)", git(maint, "log", "--oneline", "--graph"))
check("squash gives one commit with one parent", len(parents(maint, "HEAD")) == 1)
check("the topic's own commits are not part of main's history", "C1 start search" not in git(maint, "log", "--format=%s"))
check("the files are the same as with a merge", (maint / "search.txt").read_text() == "s1\ns2\n")
check("so git still thinks the topic is not merged", "origin/topic/search" not in git(maint, "branch", "-r", "--merged", "main"))

# ---- 4. rebase and merge: replay the commits, then fast-forward ----
origin, maint, contrib = setup("rebase")
save(maint, "app.txt", "v1\nv2\n", "M2 main moves on meanwhile")
git(maint, "push", "--quiet")
git(contrib, "fetch", "--quiet")
git(contrib, "rebase", "--quiet", "origin/main")
git(contrib, "push", "--quiet", "--force-with-lease")
git(maint, "fetch", "--quiet")
out = git(maint, "merge", "--ff-only", "origin/topic/search")
show("git log --oneline --graph  (rebase and merge)", git(maint, "log", "--oneline", "--graph"))
check("--ff-only succeeds because the topic now starts at main's tip", "Fast-forward" in out)
check("the history is a straight line of four commits, no merge commit", len(git(maint, "log", "--format=%s").splitlines()) == 3 + 1 and all(len(parents(maint, f"HEAD~{i}")) <= 1 for i in range(3)))

# ---- 5. a fork: a second remote called upstream ----
upstream = init("07_fork_upstream.git", bare=True)
seed = fresh("07_fork_seed")
git(seed, "init", "--quiet")
git(seed, "remote", "add", "origin", upstream.as_posix())
save(seed, "lib.txt", "1\n", "U1 upstream first")
git(seed, "push", "--quiet", "-u", "origin", "main")
mine = fresh("07_fork_mine")
git(mine, "clone", "--quiet", upstream.as_posix(), ".")
git(mine, "remote", "add", "upstream", upstream.as_posix())
git(mine, "remote", "rename", "origin", "fork")
check("a fork workflow has two remotes: your copy and the original", sorted(git(mine, "remote").splitlines()) == ["fork", "upstream"])
save(seed, "lib.txt", "1\n2\n", "U2 upstream moves")
git(seed, "push", "--quiet")
git(mine, "fetch", "--quiet", "upstream")
check("fetch upstream brings the original's new commit into upstream/main", git(mine, "log", "--format=%s", "main..upstream/main") == "U2 upstream moves")
git(mine, "merge", "--ff-only", "--quiet", "upstream/main")
check("main catches up with the original", rev(mine, "main") == rev(mine, "upstream/main"))
print("\nok")
