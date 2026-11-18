"""Lesson 9: computing on data nobody shows. Additive secret sharing, secure aggregation with pairwise masks, and private set intersection.

Asserts that three people can learn the total of their salaries without anyone seeing another salary (each share alone is uniformly random), that two of three shares
still reveal nothing and three reveal everything, that 100 clients can send masked values whose sum is exact while each masked value looks random, that a client who drops out
breaks that sum (the known weakness), and that two companies can find the customers they have in common with a commutative encryption (each side sees only encrypted
values of the other) and that the size of each set and the intersection still leak. `--write` saves a small worked example for the labs.
"""

import hashlib
import json
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dslab import check, done, show  # noqa: E402
from people import population  # noqa: E402

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "site" / "src" / "components" / "labs" / "data-security" / "securecomp.json"
M = 2**61 - 1  # a prime: shares live in the integers modulo M

# ---- 1. additive secret sharing ----
salaries = {"Ann": 52_000, "Bob": 48_000, "Cat": 61_000}
rnd = random.Random(2026)


def share(secret: int, parties: int, rnd: random.Random) -> list[int]:
    parts = [rnd.randrange(M) for _ in range(parties - 1)]
    return parts + [(secret - sum(parts)) % M]


shares = {name: share(s, 3, rnd) for name, s in salaries.items()}  # shares[name][j] goes to party j
check("every secret is the sum of its three shares modulo M", all(sum(shares[n]) % M == s for n, s in salaries.items()))
partials = [sum(shares[n][j] for n in salaries) % M for j in range(3)]  # what party j adds up from the shares it received
total = sum(partials) % M
show("partial sums held by the three parties", [p % 1000 for p in partials])
check("the parties add up what they received and publish only the partial sums: together they give the total 161,000", total == 161_000)
check("no single share is a salary: they are numbers up to 2^61, uniformly random", all(max(shares[n]) > 10**12 for n in salaries))

# the statistical check: over many runs a share looks the same whatever the secret is
def last_digits(secret: int, which: int, trials: int = 30_000):
    r = random.Random(secret)
    counts = [0] * 10
    for _ in range(trials):
        counts[share(secret, 3, r)[which] % 10] += 1
    return [c / trials for c in counts]


for secret in (0, 52_000, 10**9):
    d = last_digits(secret, 0)
    check(f"share 1 of the secret {secret:,}: every last digit appears about 10% of the time (between 9% and 11%)", all(0.09 < x < 0.11 for x in d))
pair = lambda secret: [((lambda s: (s[0] + s[1]) % M % 10)(share(secret, 3, random.Random(i + secret)))) for i in range(20_000)]  # noqa: E731
pa, pb = pair(0), pair(100_000)
check("two shares of three added together look random too: their last digit is spread evenly for a secret of 0 and for a secret of 100,000", all(0.09 < pa.count(d) / 20_000 < 0.11 and 0.09 < pb.count(d) / 20_000 < 0.11 for d in range(10)))
check("all three shares together give the secret back exactly", sum(shares["Ann"]) % M == 52_000)

# ---- 2. secure aggregation: masks that cancel ----
clients = 100
values = [random.Random(i).randrange(1, 100) for i in range(clients)]  # for example, a number of steps walked today
masks = {(i, j): random.Random(i * 1000 + j).randrange(M) for i in range(clients) for j in range(i + 1, clients)}


def masked(i: int) -> int:
    y = values[i]
    for j in range(clients):
        if j > i:
            y += masks[(i, j)]
        elif j < i:
            y -= masks[(j, i)]
    return y % M


ys = [masked(i) for i in range(clients)]
check("the server adds up 100 masked numbers and gets the exact total of the real values", sum(ys) % M == sum(values))
check("each masked number is far from its real value (more than 10^12): the server learns nothing of one client from it", all(abs(ys[i] - values[i]) > 10**12 for i in range(clients)))
dropped = sum(ys[i] for i in range(clients) if i != 17) % M
check("if client 17 drops out after the others have masked, the masks of the other 99 no longer cancel and the sum is wrong", dropped != (sum(values) - values[17]) % M)

# ---- 3. private set intersection with commutative encryption ----
P = 2**127 - 1  # a prime of 127 bits; x -> x^a mod P is a bijection when gcd(a, P - 1) = 1, and (x^a)^b = (x^b)^a


def H(x: str) -> int:
    return int.from_bytes(hashlib.sha256(x.encode()).digest(), "big") % P


def key(seed: int) -> int:
    r = random.Random(seed)
    while True:
        k = r.randrange(3, P - 1)
        if math.gcd(k, P - 1) == 1:
            return k


people = population(600)
emails = [p.email for p in people]
A = set(emails[:300])  # company A's customers
B = set(emails[180:480])  # company B's customers: 120 in common
a, b = key(1), key(2)


def intersect(set_a, set_b):
    step1 = {pow(H(x), a, P) for x in set_a}  # A -> B: each A value encrypted with A's key
    step2 = {pow(v, b, P) for v in step1}  # B -> A: B encrypts them again (and shuffles)
    step3 = {pow(H(y), b, P) for y in set_b}  # B -> A: B's own values encrypted with B's key
    step4 = {pow(v, a, P) for v in step3}  # A encrypts those with its key
    return step1, step3, step2 & step4


step1, step3, found = intersect(A, B)
check("the double encrypted sets meet exactly where the plain sets do: 120 customers in common", len(found) == len(A & B) == 120)
check("B sees 300 values from A and none of them equals a plain hash of any e-mail (so a dictionary of e-mails does not help it)", not (step1 & {H(x) for x in emails}))
check("what the protocol does not hide: each side learns the size of the other's set (300 and 300) and the size of the intersection (120)", (len(step1), len(step3), len(found)) == (300, 300, 120))
target_in, target_out = emails[200], emails[550]  # 200 is in B only through A's probe below, 550 is in neither A nor B
check("the person at index 200 is in both sets and index 550 in neither", emails[200] in A and emails[200] in B and emails[550] not in A | B)
_, _, with_in = intersect(A | {target_in}, B)
_, _, with_out = intersect(A | {target_out}, B)
check("probing: a company that adds one e-mail to its own set learns whether B has that customer (the intersection grows by one or not), so the protocol must be used only with sets the other side may query", len(with_in) == 120 and len(with_out) == 120 and len(intersect(A | {emails[400]}, B)[2]) == 121)

if "--write" in sys.argv:
    p = 1019
    h = {"ann": 5, "bob": 7, "cat": 11, "dan": 13}
    ka, kb = 3, 7
    assert math.gcd(ka, p - 1) == 1 and math.gcd(kb, p - 1) == 1
    setA, setB = ["ann", "bob", "cat"], ["bob", "cat", "dan"]
    ex = {
        "p": p, "ka": ka, "kb": kb, "hash": h, "A": setA, "B": setB,
        "step1": {x: pow(h[x], ka, p) for x in setA}, "step2": {x: pow(pow(h[x], ka, p), kb, p) for x in setA},
        "step3": {y: pow(h[y], kb, p) for y in setB}, "step4": {y: pow(pow(h[y], kb, p), ka, p) for y in setB},
    }
    ex["common"] = sorted(x for x in setA if ex["step2"][x] in set(ex["step4"].values()))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"salaries": salaries, "modulus": 97, "psi": ex}, indent=1), encoding="utf-8")
    print(f"wrote {OUT} (common: {ex['common']})")
done()
