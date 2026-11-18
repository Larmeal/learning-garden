"""Lesson 2: pseudonymization. Four ways to replace an identifier, and what each one keeps and gives away.

Asserts that a plain SHA-256 of a 6 digit member number is undone by trying all 1,000,000 numbers, that the e-mail addresses of our people are found by a dictionary
of names and domains, that a salted hash per row stops the attack and also stops joining, that HMAC with a secret key stops the attacker who has only a dictionary and
keeps tokens joinable between two tables, that random tokens are not joinable, and that a new key makes every old token useless for a join.
`--write` saves the table of the four methods for the lab (site/src/components/labs/data-security/pseudonym.json).
"""

import hashlib
import hmac
import json
import secrets
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dslab import check, done, show  # noqa: E402
from people import DOMAINS, FIRST, LAST, population  # noqa: E402

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "site" / "src" / "components" / "labs" / "data-security" / "pseudonym.json"

people = population()
sha = lambda b: hashlib.sha256(b).hexdigest()  # noqa: E731

# ---- 1. a plain hash of a small space is undone by trying everything ----
members = {p.pid: f"{(p.pid * 7919) % 1_000_000:06d}" for p in people}  # a 6 digit member number per person
hashed = {pid: sha(m.encode()) for pid, m in members.items()}
start = time.perf_counter()
lookup = {sha(f"{n:06d}".encode()): f"{n:06d}" for n in range(1_000_000)}
secs = time.perf_counter() - start
undone = sum(1 for pid, h in hashed.items() if lookup.get(h) == members[pid])
show("all 1,000,000 member numbers hashed once into a table", f"{secs:.1f} s on this computer, {undone} of {len(people)} people undone")
check("a plain SHA-256 of a 6 digit number is undone for all 2,000 people", undone == 2000)
check("the table of one million hashes takes a few seconds, not days (under 60 s)", secs < 60)

# ---- 2. a hash of an e-mail falls to a dictionary of names and domains ----
guesses = {}
for first in (f.lower() for f in FIRST):
    for last in (l.lower() for l in LAST):
        for pid in range(1, 2001):
            for dom in DOMAINS:
                guesses[sha(f"{first}.{last}{pid}@{dom}".encode())] = True
                break  # keep the table small: the attacker knows one domain
email_hashes = {p.pid: sha(p.email.encode()) for p in people}
first_domain = [p for p in people if p.email.endswith("@" + DOMAINS[0])]
found = sum(1 for p in first_domain if email_hashes[p.pid] in guesses)
show("a dictionary of first names x last names x numbers, one domain", f"{len(guesses):,} guesses, finds {found} of {len(first_domain)} addresses on that domain")
check("names, numbers and a domain are guessable, so every e-mail on the guessed domain is found", found == len(first_domain))

# ---- 3. a salt per row stops the dictionary, and also stops joining ----
salts = {p.pid: secrets.token_bytes(16) for p in people}
salted = {pid: sha(salts[pid] + email_hashes[pid].encode()) for pid in salts}
check("the same dictionary finds none of the salted hashes", not any(h in guesses for h in salted.values()))
other_table = {pid: sha(secrets.token_bytes(16) + email_hashes[pid].encode()) for pid in salts}
matches = sum(1 for pid in salted if salted[pid] == other_table[pid])
check("but two tables that salted the same e-mail separately no longer match on it (0 of 2,000)", matches == 0)

# ---- 4. HMAC with a secret key: same input, same token, and only the key holder can compute it ----
key = secrets.token_bytes(32)
tok = lambda k, s: hmac.new(k, s.encode(), hashlib.sha256).hexdigest()[:16]  # noqa: E731
orders = {p.pid: tok(key, p.email) for p in people}
tickets = {p.pid: tok(key, p.email) for p in people}
check("two tables made with the same key hold the same token for the same person, so they join on it (2,000 of 2,000)", sum(orders[i] == tickets[i] for i in orders) == 2000)
dict_tokens = {tok(b"attacker-guess", e): e for e in [p.email for p in people]}
check("an attacker with the exact dictionary of e-mails but without the key finds nothing", not any(t in dict_tokens for t in orders.values()))
check("the token is shorter than the hash (16 hex characters) and shows no part of the e-mail", all(p.email.split("@")[0] not in orders[p.pid] for p in people))
distinct_before = len({p.email for p in people})
check("the number of distinct people is kept (2,000 distinct tokens), so counting still works", len(set(orders.values())) == distinct_before == 2000)

# ---- 5. random tokens in a vault: nothing to attack, nothing to join ----
vault: dict[str, str] = {}
def tokenize(value: str) -> str:
    t = secrets.token_hex(8)
    vault[t] = value
    return t
a = {p.pid: tokenize(p.email) for p in people}
b = {p.pid: tokenize(p.email) for p in people}
check("random tokens of the same e-mail differ between two tables (0 of 2,000 join)", sum(a[i] == b[i] for i in a) == 0)
check("only the vault can map a token back, and it holds 4,000 entries to protect", len(vault) == 4000 and vault[a[1]] == people[0].email)

# ---- 6. rotating the key breaks every old link ----
key2 = secrets.token_bytes(32)
new_orders = {p.pid: tok(key2, p.email) for p in people}
check("after a key change, no old token equals a new one (0 of 2,000), so tables made with different keys cannot be joined", sum(orders[i] == new_orders[i] for i in orders) == 0)

if "--write" in sys.argv:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "methods": {
            "hash": {"dictionary": True, "key": True, "join": True, "count": True, "example": email_hashes[1][:16]},
            "salted": {"dictionary": False, "key": False, "join": False, "count": False, "example": salted[1][:16]},
            "hmac": {"dictionary": False, "key": True, "join": True, "count": True, "example": orders[1]},
            "token": {"dictionary": False, "key": False, "join": False, "count": False, "example": a[1]},
        },
        "undone": undone, "n": len(people), "tableSeconds": round(secs, 1), "guesses": len(guesses),
    }
    OUT.write_text(json.dumps(data, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")
done()
