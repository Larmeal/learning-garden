"""Lesson 1: version control as the base, and why small batches matter.

Two developers change the same project. Alice renames a function, Bob writes new code that calls the old name.
Asserts that (a) when each works on a long branch for five commits, git merges without a single conflict and the tests
fail only on the merge commit, which `git bisect` has to find among eleven commits; (b) when each integrates in small
steps and runs the tests before pushing, the same mistake shows up on the very first commit that meets the rename.
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from devlab import PY, check, commit_all, fresh, git, git_rc, init, reset_clock, run, show, write  # noqa: E402

TEST_CMD = f'"{Path(PY).as_posix()}" -m unittest discover -q'

SHOP = '''PRICES = {"apple": 3, "pear": 5}


def price(item):
    return PRICES[item]


def total(items):
    return sum(price(i) for i in items)
'''
TEST_SHOP = '''import unittest
from shop import total


class ShopTest(unittest.TestCase):
    def test_total(self):
        self.assertEqual(total(["apple", "pear"]), 8)
'''


def tests_pass(repo: Path) -> bool:
    code, _ = run([PY, "-m", "unittest", "discover", "-q"], cwd=repo)
    return code == 0


def base_repo(name: str) -> Path:
    repo = init(name)
    write(repo, "shop.py", SHOP)
    write(repo, "test_shop.py", TEST_SHOP)
    commit_all(repo, "Start the shop")
    return repo


# ---- 1. two long branches: five commits each, merged at the end ----
reset_clock()
repo = base_repo("01_long_branches")
git(repo, "checkout", "-q", "-b", "alice")
write(repo, "docs.md", "# Shop\n")
commit_all(repo, "alice 1: add docs")
write(repo, "shop.py", SHOP.replace("def price(item)", "def unit_price(item)").replace("sum(price(i)", "sum(unit_price(i)"))
commit_all(repo, "alice 2: rename price to unit_price")
write(repo, "docs.md", "# Shop\nprices are per item\n")
commit_all(repo, "alice 3: docs")
write(repo, "shop.py", (repo / "shop.py").read_text() + "\n\ndef discount(amount):\n    return amount * 9 // 10\n")
commit_all(repo, "alice 4: discount")
write(repo, "docs.md", "# Shop\nprices are per item\nsee discount()\n")
commit_all(repo, "alice 5: docs")
git(repo, "checkout", "-q", "main")
git(repo, "checkout", "-q", "-b", "bob")
write(repo, "invoice.py", "from shop import price\n")
commit_all(repo, "bob 1: invoice skeleton")
write(repo, "invoice.py", "from shop import price\n\n\ndef line(item):\n    return f'{item}: {price(item)}'\n")
commit_all(repo, "bob 2: invoice line")
write(repo, "test_invoice.py", "import unittest\nfrom invoice import line\n\n\nclass InvoiceTest(unittest.TestCase):\n    def test_line(self):\n        self.assertEqual(line('pear'), 'pear: 5')\n")
commit_all(repo, "bob 3: test the line")
write(repo, "invoice.py", (repo / "invoice.py").read_text() + "\n\ndef invoice(items):\n    return [line(i) for i in items]\n")
commit_all(repo, "bob 4: invoice")
write(repo, "invoice.py", (repo / "invoice.py").read_text() + "\n# done\n")
commit_all(repo, "bob 5: tidy")
check("Bob's branch passes its own tests", tests_pass(repo))
git(repo, "checkout", "-q", "alice")
check("Alice's branch passes its own tests", tests_pass(repo))
git(repo, "checkout", "-q", "main")
check("main before the merge passes", tests_pass(repo))

git(repo, "merge", "-q", "--no-edit", "alice")
code, out = git_rc(repo, "merge", "--no-edit", "bob")
show("git merge bob", out)
check("git merges Bob's branch without any conflict", code == 0 and "CONFLICT" not in out, out)
merge_sha = git(repo, "rev-parse", "--short", "HEAD")
check("the merged main fails its tests", not tests_pass(repo))
log = git(repo, "log", "--oneline", "main").splitlines()
check("main holds 12 commits: start, 5 + 5 and the merge (Alice was fast-forwarded)", len(log) == 12, str(len(log)))
good = git(repo, "rev-list", "--max-parents=0", "HEAD")
git(repo, "bisect", "start", "HEAD", good)
code, out = git_rc(repo, "bisect", "run", "sh", "-c", TEST_CMD)
steps = out.count("running")
first_bad = re.findall(r"^([0-9a-f]{40}) is the first .bad. commit", out, flags=re.M)
show("git bisect run (the lines that matter)", chr(10).join(l for l in out.splitlines() if "running" in l or "first" in l and "bad" in l or l.startswith("Bisecting")))
check("bisect names the merge commit as the first bad one (no single feature commit is at fault)", bool(first_bad) and first_bad[0].startswith(merge_sha[:7]), repr(first_bad) + merge_sha)
check("bisect needed more than one test run to get there", steps >= 3, str(steps))
git(repo, "bisect", "reset")
long_cost = {"commits_to_look_at": 10 + 1, "bisect_runs": steps}
print(f"  long branches: {long_cost['commits_to_look_at']} commits in doubt, {steps} test runs of bisect")

# ---- 2. small batches: integrate often and run the tests before every push ----
reset_clock()
remote = init("01_trunk_remote", bare=True)
seed = base_repo("01_trunk_seed")
git(seed, "remote", "add", "origin", str(remote))
git(seed, "push", "-q", "origin", "main")
git(remote, "symbolic-ref", "HEAD", "refs/heads/main")
alice = fresh("01_trunk_alice")
bob = fresh("01_trunk_bob")
git(remote.parent, "clone", "-q", str(remote), str(alice))
git(remote.parent, "clone", "-q", str(remote), str(bob))

def L(*rows: str) -> str:
    return chr(10).join(rows) + chr(10)


# Bob: skeleton first, pushed at once.
write(bob, "invoice_lines.py", L("# invoice lines will go here"))
commit_all(bob, "bob 1: skeleton")
git(bob, "pull", "-q", "--rebase", "origin", "main")
check("Bob's tests pass before push 1", tests_pass(bob))
git(bob, "push", "-q", "origin", "main")

# Alice: the rename, with every caller she can see, pushed at once.
git(alice, "pull", "-q", "--rebase", "origin", "main")
write(alice, "shop.py", SHOP.replace("def price(item)", "def unit_price(item)").replace("sum(price(i)", "sum(unit_price(i)"))
commit_all(alice, "alice: rename price to unit_price")
check("Alice's tests pass before her push", tests_pass(alice))
git(alice, "push", "-q", "origin", "main")

# Bob keeps working on his old base and writes the first line that calls price().
write(bob, "invoice_lines.py", L("from shop import price", "", "", "def line(item):", "    return f'{item}: {price(item)}'"))
commit_all(bob, "bob 2: invoice line")
check("on his own base Bob's tests pass (he has not seen the rename)", tests_pass(bob))
code, out = git_rc(bob, "pull", "--rebase", "origin", "main")
show("git pull --rebase (Bob, before pushing commit 2)", out)
check("git rebases the second commit without any conflict", code == 0, out)
check("the tests are still fine, because nothing imports the new file yet", tests_pass(bob))
write(bob, "test_invoice.py", L("import unittest", "from invoice_lines import line", "", "", "class InvoiceTest(unittest.TestCase):", "    def test_line(self):", "        self.assertEqual(line('pear'), 'pear: 5')"))
commit_all(bob, "bob 3: test the line")
check("the tests fail at once, with two commits of Bob that are not pushed yet", not tests_pass(bob) and int(git(bob, "rev-list", "--count", "origin/main..HEAD")) == 2)
code, out = run([PY, "-m", "unittest", "discover", "-q"], cwd=bob)
show("python -m unittest (Bob, after the rebase)", chr(10).join(out.splitlines()[-4:]))
check("the error names the old function", "cannot import name 'price'" in out, out)
write(bob, "invoice_lines.py", L("from shop import unit_price", "", "", "def line(item):", "    return f'{item}: {unit_price(item)}'"))
commit_all(bob, "bob 4: use unit_price")
check("one more small commit and the tests pass again", tests_pass(bob))
git(bob, "push", "-q", "origin", "main")
check("the shared main passes its tests after both pushes", tests_pass(bob))
doubt = 2
print("  small batches: the failure appeared with 2 commits of Bob unpushed, and he fixed it in 1 more commit")
check("the long branches left 11 commits in doubt, the small batches 2", long_cost["commits_to_look_at"] == 11 and doubt == 2)
print("ok")
