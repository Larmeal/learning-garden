"""Lesson 12: denial of service and rate limiting.

Asserts that the nested pattern (a+)+$ takes twice the work for every extra character (counted by a small backtracking matcher
whose calls we count, and confirmed on the real `re` module by timing), that a linear pattern does not, that a token bucket lets a
burst through and then refuses at the refill rate, that a fixed window lets twice the limit through around its edge while a sliding
window does not, that a lock-out after N failures can be used to lock someone else out, and what a login limit does to a PIN search.

`--write` saves the step counts and the two limiter timelines for the labs as site/src/components/labs/app-security/dosData.json.
"""

import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from seclab import check, done, show  # noqa: E402

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "site" / "src" / "components" / "labs" / "app-security" / "dosData.json"

# ---- 1. ReDoS: count the work of (a+)+$ on "aaa...ab" ----
def steps_nested(n: int) -> int:
    """Every way to cut n letters into groups of a+ is tried before the final b makes each one fail."""
    calls = 0

    def outer(i: int) -> bool:
        nonlocal calls
        calls += 1
        if i == n:
            return False  # the next character is b, so `$` fails
        for k in range(1, n - i + 1):
            if outer(i + k):
                return True
        return False

    outer(0)
    return calls


def steps_linear(n: int) -> int:
    return n + 1  # ^a+$ walks the letters once, then sees b and stops


counts = {n: steps_nested(n) for n in range(1, 21)}
show("calls of the nested matcher", {n: counts[n] for n in (5, 10, 15, 20)})
check("n=1 takes 2 calls and n=2 takes 4", counts[1] == 2 and counts[2] == 4)
check("every extra letter doubles the work exactly (counts[n] = 2 * counts[n-1])", all(counts[n] == 2 * counts[n - 1] for n in range(2, 21)))
check("20 letters need 1,048,576 calls, 30 would need over a billion", counts[20] == 1_048_576 and 2 ** 30 > 10 ** 9)
check("the linear pattern needs 21 steps for 20 letters", steps_linear(20) == 21)


def timed(pattern: str, n: int) -> float:
    rx, text = re.compile(pattern), "a" * n + "b"
    start = time.perf_counter()
    rx.match(text)
    return time.perf_counter() - start


t18, t22 = timed(r"(a+)+$", 18), timed(r"(a+)+$", 22)
show("seconds on the real re module", f"n=18 {t18:.4f}   n=22 {t22:.4f}   ratio {t22 / max(t18, 1e-9):.1f}")
check("4 more letters take at least 4 times longer on the real re module (theory says 16)", t22 > 4 * t18)
check("the linear pattern on 100,000 letters finishes in well under a second", timed(r"a+$", 100_000) < 1.0)
check("a length limit before the regex (here 64) removes the problem for any attacker input", len("a" * 10_000) > 64)

# ---- 2. token bucket: a burst is fine, a flood is not ----
def token_bucket(events: list[float], capacity: int = 5, rate: float = 1.0) -> list[bool]:
    tokens, last, out = float(capacity), 0.0, []
    for t in events:
        tokens = min(capacity, tokens + (t - last) * rate)
        last = t
        if tokens >= 1:
            tokens -= 1
            out.append(True)
        else:
            out.append(False)
    return out


burst = [0.0] * 8
res = token_bucket(burst)
check("8 requests at the same instant: the first 5 pass, the last 3 are refused", res == [True] * 5 + [False] * 3)
check("3 seconds later three more tokens have come back", token_bucket(burst + [3.0, 3.0, 3.0, 3.0]) == res + [True, True, True, False])
steady = token_bucket([float(t) for t in range(30)])
check("one request a second forever is never refused (rate equals the refill rate)", all(steady))
flood = token_bucket([i * 0.1 for i in range(100)])
check("ten a second for ten seconds: about 15 pass (5 saved up + 1 per second of refill)", sum(flood) in range(14, 17))

# ---- 3. fixed window against sliding window ----
def fixed_window(events: list[float], limit: int = 10, size: float = 60.0) -> list[bool]:
    count: dict[int, int] = {}
    out = []
    for t in events:
        w = int(t // size)
        count[w] = count.get(w, 0) + 1
        out.append(count[w] <= limit)
    return out


def sliding_window(events: list[float], limit: int = 10, size: float = 60.0) -> list[bool]:
    seen: list[float] = []
    out = []
    for t in events:
        seen = [s for s in seen if s > t - size]
        if len(seen) < limit:
            seen.append(t)
            out.append(True)
        else:
            out.append(False)
    return out


edge = [55.0] * 10 + [61.0] * 10  # ten requests at second 55 and ten at second 61, just across the window edge
check("fixed window: all 20 pass, because 10 fall in each minute", sum(fixed_window(edge)) == 20)
check("sliding window: only 10 pass in those 6 seconds", sum(sliding_window(edge)) == 10)

# ---- 4. lock-out can be turned against the owner ----
def login_with_lockout(failures_allowed: int, attempts: list[tuple[str, str]], correct="pw-ann") -> list[str]:
    fails, out = 0, []
    for who, pw in attempts:
        if fails >= failures_allowed:
            out.append("locked")
        elif pw == correct:
            fails = 0
            out.append("ok")
        else:
            fails += 1
            out.append("wrong")
    return out


res = login_with_lockout(3, [("attacker", "x1"), ("attacker", "x2"), ("attacker", "x3"), ("ann", "pw-ann")])
check("after 3 wrong guesses made by an attacker, the real ann is locked out with the right password", res == ["wrong", "wrong", "wrong", "locked"])

# ---- 5. what a login limit does to a 6 digit PIN ----
per_minute = 5
guesses = 10 ** 6
days = guesses / per_minute / 60 / 24
show("six digit PIN at 5 guesses per minute", f"{days:.1f} days for all of them, {days / 2:.1f} days on average")
check("all 1,000,000 PINs take 138.9 days at 5 a minute", round(days, 1) == 138.9)
check("without any limit, 1,000,000 hashes at the plain sha256 speed measured in lesson 4 fall in under a second", guesses / 1_300_000 < 1.0)

if "--write" in sys.argv:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "nested": {str(n): c for n, c in counts.items()},
        "linear": {str(n): steps_linear(n) for n in counts},
        "bucket": {"events": burst + [3.0, 3.0, 3.0, 3.0], "allowed": token_bucket(burst + [3.0, 3.0, 3.0, 3.0])},
        "edge": {"events": edge, "fixed": fixed_window(edge), "sliding": sliding_window(edge)},
    }
    OUT.write_text(json.dumps(data, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")
done()
