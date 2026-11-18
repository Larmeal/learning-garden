"""Lesson 4: storing passwords. Plain, fast hash, salted hash, slow hash.

Asserts what a leaked table gives an attacker in each case: with a plain sha256 the same password shows as the same hash and
a dictionary cracks most users in a blink, a per-user salt hides the repeats, and a slow hash (scrypt, PBKDF2) cuts the guesses per
second by orders of magnitude. The speeds are measured here on this computer (they differ on another one), the asserts use ratios.

`--write` saves the measured speeds as site/src/components/labs/app-security/passwordData.json for the password lab.
"""

import hashlib
import hmac
import json
import math
import secrets
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from seclab import check, done, show  # noqa: E402

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "site" / "src" / "components" / "labs" / "app-security" / "passwordData.json"

COMMON = ["123456", "password", "qwerty", "111111", "iloveyou", "dragon", "monkey", "letmein", "football", "sunshine",
          "master", "welcome", "shadow", "superman", "michael", "abc123", "trustno1", "batman", "login", "admin"]
# 1,000 guesses: the 20 common ones first, then numbered fillers so the list has a fixed size
WORDLIST = COMMON + [f"pass{n:04d}" for n in range(980)]
USERS = {"ann": "iloveyou", "bob": "iloveyou", "cat": "Tr0ub4dor&3", "dan": "letmein", "eve": "qwerty"}

# ---- 1. plain sha256: the same password gives the same hash ----
plain = {u: hashlib.sha256(p.encode()).hexdigest() for u, p in USERS.items()}
show("leaked table, plain sha256", "\n".join(f"{u:4} {h[:20]}..." for u, h in plain.items()))
check("ann and bob chose the same password and show the same hash", plain["ann"] == plain["bob"])
rainbow = {hashlib.sha256(w.encode()).hexdigest(): w for w in WORDLIST}
cracked = {u: rainbow[h] for u, h in plain.items() if h in rainbow}
show("a lookup table built once from the 1,000 word list", f"{len(rainbow)} entries, cracks {sorted(cracked)}")
check("one lookup table cracks 4 of the 5 users at once (Tr0ub4dor&3 is not in the list)", sorted(cracked) == ["ann", "bob", "dan", "eve"])
check("cracking ann also cracks bob, because their hashes are equal", cracked["ann"] == cracked["bob"] == "iloveyou")

# ---- 2. a salt per user: the same password no longer looks the same ----
salts = {u: hashlib.sha256(u.encode()).digest()[:16] for u in USERS}  # fixed here so the numbers repeat; in real life secrets.token_bytes(16)
salted = {u: hashlib.sha256(salts[u] + p.encode()).hexdigest() for u, p in USERS.items()}
check("with a salt, ann and bob show different hashes for the same password", salted["ann"] != salted["bob"])
check("the lookup table built before the leak finds nothing", not any(h in rainbow for h in salted.values()))
check("a real salt is 16 random bytes, different on every call", secrets.token_bytes(16) != secrets.token_bytes(16))
# the attacker now has to hash every guess for every user separately
guesses_plain = len(WORDLIST)
guesses_salted = len(WORDLIST) * len(USERS)
check("the work grows from one pass over the list to one pass per user (1,000 to 5,000 hashes)", (guesses_plain, guesses_salted) == (1000, 5000))

# ---- 3. a slow hash: measure guesses per second on this computer ----
def rate(fn, seconds: float = 0.4) -> float:
    count, start = 0, time.perf_counter()
    while time.perf_counter() - start < seconds:
        fn()
        count += 1
    return count / (time.perf_counter() - start)


salt = b"s" * 16
speeds = {
    "sha256": rate(lambda: hashlib.sha256(b"guess" + salt).digest()),
    "pbkdf2-600k": rate(lambda: hashlib.pbkdf2_hmac("sha256", b"guess", salt, 600_000), 1.2),
    "scrypt": rate(lambda: hashlib.scrypt(b"guess", salt=salt, n=2**15, r=8, p=1, maxmem=64 * 1024 * 1024), 1.2),
}
show("guesses per second on one core of this computer", "\n".join(f"{k:12} {v:>14,.1f}" for k, v in speeds.items()))
check("plain sha256 does more than 100,000 guesses a second on one core", speeds["sha256"] > 100_000)
check("PBKDF2 with 600,000 rounds is at least 1,000 times slower than plain sha256", speeds["sha256"] / speeds["pbkdf2-600k"] > 1_000)
check("scrypt (N=32768) is at least 1,000 times slower than plain sha256", speeds["sha256"] / speeds["scrypt"] > 1_000)
check("one honest login with a slow hash still takes well under a second", 1 / speeds["pbkdf2-600k"] < 1.0 and 1 / speeds["scrypt"] < 1.0)

# ---- 4. verifying a password the safe way ----
def hash_password(pw: str, salt: bytes) -> str:
    return "scrypt$" + salt.hex() + "$" + hashlib.scrypt(pw.encode(), salt=salt, n=2**14, r=8, p=1, maxmem=64 * 1024 * 1024).hex()


def verify_password(pw: str, stored: str) -> bool:
    _, salt_hex, digest_hex = stored.split("$")
    again = hashlib.scrypt(pw.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1, maxmem=64 * 1024 * 1024)
    return hmac.compare_digest(again.hex(), digest_hex)


stored = hash_password("Tr0ub4dor&3", b"\x01" * 16)
show("what the table keeps (algorithm$salt$hash)", stored)
check("the stored value holds the algorithm, the salt and the hash, so the check needs nothing else", stored.count("$") == 2)
check("the right password verifies", verify_password("Tr0ub4dor&3", stored))
check("a wrong password does not", not verify_password("tr0ub4dor&3", stored))

# ---- 5. how long a password lasts: bits and time ----
def bits(length: int, alphabet: int) -> float:
    return length * math.log2(alphabet)


rows = [("6 digits", bits(6, 10)), ("8 lower case letters", bits(8, 26)), ("8 mixed letters and digits", bits(8, 62)), ("4 random words (2048 word list)", 4 * math.log2(2048))]
show("entropy in bits", "\n".join(f"{n:34} {b:5.1f} bits" for n, b in rows))
check("6 digits is 19.9 bits, which is only 1,000,000 guesses", round(rows[0][1], 1) == 19.9 and 10**6 == 1_000_000)
check("4 random words from 2,048 is 44 bits and 8 mixed characters is 47.6 bits", rows[3][1] == 44.0 and round(rows[2][1], 1) == 47.6)

days = lambda b, per_s: 2 ** (b - 1) / per_s / 86400  # on average half the space  # noqa: E731
fast_years = days(rows[2][1], speeds["sha256"]) / 365
slow_years = days(rows[2][1], speeds["scrypt"]) / 365
show("8 mixed characters, years for one core to try half the space", f"plain sha256 {fast_years:,.1f}   scrypt {slow_years:,.0f}")
check("the same 8 mixed characters last at least 1,000 times longer behind scrypt than behind plain sha256", slow_years / fast_years > 1_000)

if "--write" in sys.argv:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "speeds": {k: round(v, 1) for k, v in speeds.items()},
        "bits": {n: round(b, 1) for n, b in rows},
        "wordlist": len(WORDLIST),
        "note": "measured on one core of the computer that ran 04_passwords.py --write; another computer gives other speeds",
    }
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {OUT}")
done()
