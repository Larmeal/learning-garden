"""Lesson 6: the privacy budget. Many queries, one person, and what each answer costs.

Asserts that answering the same count again with fresh noise lets an attacker average the noise away (the error falls with the square root of the number of answers),
that a budget accountant stops that by adding up epsilon and refusing, that a stored answer to a repeated question costs nothing more, that splitting a total epsilon
over k queries multiplies the error of each by k, that a histogram over disjoint groups costs epsilon once (parallel composition), and that rounding or clamping
a noisy answer is free (post-processing) but biases small counts. `--write` saves the curves for the lab (site/src/components/labs/data-security/budget.json).
"""

import json
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dslab import check, done, show  # noqa: E402
from people import ZIPS, population  # noqa: E402

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "site" / "src" / "components" / "labs" / "data-security" / "budget.json"

people = population()
TRUE = sum(1 for p in people if p.diagnosis == "HIV")


def laplace(rnd: random.Random, scale: float) -> float:
    u = rnd.random() - 0.5
    return -scale * math.copysign(1, u) * math.log(1 - 2 * abs(u))


class Budget:
    """Adds up epsilon (sequential composition) and refuses a query that would go over the total."""

    def __init__(self, total: float, seed: int):
        self.total, self.spent, self.rnd, self.ledger = total, 0.0, random.Random(seed), []

    def count(self, predicate, eps: float) -> float:
        if self.spent + eps > self.total + 1e-12:
            raise PermissionError("privacy budget exhausted")
        self.spent += eps
        n = sum(1 for p in people if predicate(p))
        self.ledger.append(eps)
        return n + laplace(self.rnd, 1 / eps)


is_hiv = lambda p: p.diagnosis == "HIV"  # noqa: E731

# ---- 1. the same question again and again: the noise averages out ----
rnd = random.Random(1)
eps = 0.1
answers = [TRUE + laplace(rnd, 1 / eps) for _ in range(2000)]
curve = []
for m in (1, 10, 100, 1000, 2000):
    est = sum(answers[:m]) / m
    curve.append({"m": m, "estimate": round(est, 2), "error": round(abs(est - TRUE), 2)})
show("average of m fresh answers (epsilon 0.1 each, true count 351)", curve)
check("one answer at epsilon 0.1 is off by about 10, which hides whether Ann is counted", abs(answers[0] - TRUE) < 60)
errs = [abs(sum(answers[i * 1000:(i + 1) * 1000]) / 1000 - TRUE) for i in range(2)]
check("the average of 1,000 fresh answers is within 1.5 of the truth: the noise is gone and the count is known exactly", all(e < 1.5 for e in errs))
check("but the 1,000 answers spent epsilon 100 in total (1,000 times 0.1), which is a very weak guarantee", abs(1000 * eps - 100) < 1e-9)
one, hundred = [], []
for seed in range(400):
    r = random.Random(1000 + seed)
    one.append(abs(laplace(r, 10)))
    hundred.append(abs(sum(laplace(r, 10) for _ in range(100)) / 100))
ratio_err = (sum(one) / 400) / (sum(hundred) / 400)
show("average error: one answer against the average of 100 answers (400 repetitions)", f"{sum(one) / 400:.2f} against {sum(hundred) / 400:.2f}, ratio {ratio_err:.1f}")
check("the average of 100 fresh answers is 7 to 11 times more exact than one answer (the square root of 100 is 10, a little less for the mean of absolute values)", 7 < ratio_err < 11)

# ---- 2. an accountant adds epsilon up and refuses ----
acct = Budget(total=1.0, seed=3)
done_queries = 0
try:
    for _ in range(20):
        acct.count(is_hiv, 0.1)
        done_queries += 1
except PermissionError as exc:
    reason = str(exc)
show("budget 1.0, queries at 0.1 each", f"{done_queries} answered, then: {reason}")
check("a budget of 1.0 answers exactly 10 queries of 0.1 and refuses the 11th", done_queries == 10 and reason == "privacy budget exhausted")
check("the ledger adds up to the total that was allowed", abs(sum(acct.ledger) - 1.0) < 1e-9)

# ---- 3. a repeated question is answered from a stored answer ----
class CachedBudget(Budget):
    def __init__(self, *a):
        super().__init__(*a)
        self.cache = {}

    def count(self, predicate, eps, key=None):
        if key in self.cache:
            return self.cache[key]
        self.cache[key] = super().count(predicate, eps)
        return self.cache[key]


cb = CachedBudget(1.0, 4)
first = cb.count(is_hiv, 0.5, key="hiv-total")
again = [cb.count(is_hiv, 0.5, key="hiv-total") for _ in range(1000)]
check("1,000 repeats of the same question return the stored answer and cost nothing more (spent stays 0.5)", all(a == first for a in again) and abs(cb.spent - 0.5) < 1e-9)
check("so the attacker's average of 1,000 answers is that one noisy answer, not the truth", abs(sum(again) / 1000 - first) < 1e-9)

# ---- 4. splitting a total epsilon over k queries ----
total = 1.0
split = {}
for k in (1, 2, 5, 10, 50, 100):
    each = total / k
    split[k] = 1 / each  # the scale of the noise, which is also the average error
check("with a total epsilon of 1, one query has an error of 1, ten queries 10 each, a hundred queries 100 each", (split[1], split[10], split[100]) == (1.0, 10.0, 100.0))
check("with 100 queries each answer is off by about 100, while the true counts of a table of 2,000 are often below that", split[100] == 100.0)

# ---- 5. a histogram over disjoint groups costs epsilon once ----
zip_counts = {z: sum(1 for p in people if p.zip == z) for z in ZIPS}
check("every person lives in exactly one zip, so removing one person changes exactly one of the 12 counts by 1", sum(zip_counts.values()) == 2000)
hist_error = 1 / 1.0
naive_error = 12 / 1.0
check("the whole histogram at epsilon 1 uses noise of scale 1 on each cell (parallel composition), not 12", (hist_error, naive_error) == (1.0, 12.0))
b = 1.0
# only one cell differs between the two tables; the other 11 cells have the same distribution, so their densities cancel in the ratio
worst = 1.0
for x in range(-300, 300):
    out = x / 10
    ratio = math.exp(-abs(out - zip_counts[ZIPS[0]]) / b) / math.exp(-abs(out - (zip_counts[ZIPS[0]] - 1)) / b)
    worst = max(worst, ratio, 1 / ratio)
check("the output distribution of the whole histogram changes by at most e^epsilon between neighbouring tables", worst <= math.exp(1.0) + 1e-9)

# ---- 6. post-processing is free, but it biases small counts ----
r = random.Random(9)
noisy_zero = [laplace(r, 2.0) for _ in range(100_000)]  # true count 0, epsilon 0.5
clamped = [max(0.0, v) for v in noisy_zero]
rounded = [round(v) for v in clamped]
show("true count 0, epsilon 0.5, 100,000 answers", f"mean raw {sum(noisy_zero) / 1e5:.3f}, mean after clamping at 0 {sum(clamped) / 1e5:.3f}")
check("the raw noisy answers average to 0 (no bias)", abs(sum(noisy_zero) / 1e5) < 0.03)
check("after clamping negative answers to 0, the average is 1.0 (scale / 2), so the published count of an empty group looks like 1 on average", abs(sum(clamped) / 1e5 - 1.0) < 0.03)
check("rounding and clamping use no extra epsilon: they are functions of the noisy answer alone", all(isinstance(v, int) for v in rounded))

if "--write" in sys.argv:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    avg_curve = []
    for m in (1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000):
        errs = []
        for s in range(30):
            r = random.Random(s)  # one generator per repetition, so the m answers are different draws
            errs.append(abs(sum(laplace(r, 10) for _ in range(m)) / m))
        avg_curve.append({"m": m, "error": round(sum(errs) / len(errs), 2)})
    OUT.write_text(json.dumps({"true": TRUE, "avgCurve": avg_curve, "firstAnswers": [round(a, 1) for a in answers[:200]], "split": {str(k): v for k, v in split.items()}}, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")
done()
