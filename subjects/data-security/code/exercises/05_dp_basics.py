"""Lesson 5: differential privacy. A count with Laplace noise, a mean with clipping, and randomized response.

Asserts that the Laplace mechanism with scale sensitivity / epsilon never changes the probability of any output by more than the factor e^epsilon between two tables
that differ by one person, that the average size of the noise is exactly its scale (so the error is sensitivity / epsilon), that the error of a mean depends on how many
people it covers, that randomized response with a fair coin gives epsilon = ln 3 and a good estimate of a share, and that the local version is far less accurate
than the central one. `--write` saves the numbers for the lab (site/src/components/labs/data-security/laplace.json).
"""

import json
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dslab import check, done, show  # noqa: E402
from people import population  # noqa: E402

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "site" / "src" / "components" / "labs" / "data-security" / "laplace.json"

people = population()
TRUE = sum(1 for p in people if p.diagnosis == "HIV")  # the number we want to publish
check("the true count of people with the diagnosis HIV is 351", TRUE == 351)


def laplace(rnd: random.Random, scale: float) -> float:
    u = rnd.random() - 0.5
    return -scale * math.copysign(1, u) * math.log(1 - 2 * abs(u))


def density(x: float, centre: float, scale: float) -> float:
    return math.exp(-abs(x - centre) / scale) / (2 * scale)


# ---- 1. the guarantee: neighbouring tables give output distributions within a factor e^epsilon ----
for eps in (0.1, 0.5, 1.0, 2.0):
    b = 1 / eps  # sensitivity of a count is 1: one person changes it by at most 1
    ratios = [density(x / 10, TRUE, b) / density(x / 10, TRUE - 1, b) for x in range(3300, 3700)]
    worst = max(max(ratios), 1 / min(ratios))
    check(f"epsilon {eps}: for every output the probability with Ann in the table is at most {math.exp(eps):.3f} times the probability without her (worst ratio {worst:.3f})", worst <= math.exp(eps) + 1e-9)
check("the bound is reached (not just respected): outside the two true values the ratio is exactly e^epsilon", abs(density(500, TRUE, 1) / density(500, TRUE - 1, 1) - math.exp(1)) < 1e-9)

# ---- 2. how close are the two worlds? the overlap of the two distributions ----
def overlap(eps: float) -> float:
    b = 1 / eps
    step = 0.001
    return sum(min(density(x * step, TRUE, b), density(x * step, TRUE - 1, b)) for x in range(int((TRUE - 60) / step), int((TRUE + 60) / step))) * step

show("overlap of the two output distributions (1.0 = cannot tell them apart)", {e: round(overlap(e), 3) for e in (0.1, 0.5, 1.0, 2.0)})
check("at epsilon 1 the two output distributions overlap by 60.7% (e to the power -epsilon/2), summing the smaller of the two densities", abs(overlap(1.0) - math.exp(-0.5)) < 0.003)
check("at epsilon 0.1 the overlap is 95%: a smaller epsilon hides one person better", abs(overlap(0.1) - math.exp(-0.05)) < 0.003)

# ---- 3. the price: the error ----
rnd = random.Random(2026)
results = {}
for eps in (0.01, 0.1, 0.5, 1.0, 5.0):
    b = 1 / eps
    draws = [laplace(rnd, b) for _ in range(50_000)]
    mean_abs = sum(abs(d) for d in draws) / len(draws)
    results[eps] = round(mean_abs, 3)
    check(f"epsilon {eps}: the average error of a count is its scale {b:g} (measured {mean_abs:.2f} over 50,000 answers)", abs(mean_abs - b) / b < 0.03)
check("ten times more privacy (epsilon / 10) means ten times more error", abs(results[0.1] / results[1.0] - 10) < 0.6)
check("for the count of 351 the relative error is about 0.3% at epsilon 1 and 28% at epsilon 0.01", abs(results[1.0] / TRUE - 0.0028) < 0.0003 and abs(results[0.01] / TRUE - 0.285) < 0.02)

# ---- 4. a mean needs a clip, and its error depends on the number of people ----
LO, HI = 20_000, 80_000
clipped = [min(max(p.salary, LO), HI) for p in people]
true_mean = sum(clipped) / len(clipped)
for n in (2000, 200, 20):
    sens = (HI - LO) / n  # one person can move a mean of n clipped values by at most (HI - LO) / n
    check(f"mean salary of {n} people: sensitivity {sens:g}, so at epsilon 1 the average error is {sens:g} on a mean of about 45,000", abs(sens - 60000 / n) < 1e-9)
check("a group of 20 people has a noise 100 times larger than a group of 2,000 (relative error 6.7% against 0.07%)", abs((60000 / 20) / (60000 / 2000) - 100) < 1e-9)
check("without the clip the sensitivity would be unbounded: one salary of 10 million moves the mean of 2,000 people by 5,000", abs(((10_000_000 - 45000) / 2000) - 4977.5) < 1)

# ---- 5. randomized response: noise added by each person before they answer ----
def respond(truth: bool, rnd: random.Random, p_truth: float = 0.75) -> bool:
    return truth if rnd.random() < p_truth else (rnd.random() < 0.5)  # with prob 1 - p_truth answer with a fair coin


p = 0.75
eps_rr = math.log((p + (1 - p) / 2) / ((1 - p) / 2))
check("answering truthfully with probability 0.75 and with a fair coin otherwise gives epsilon = ln 7", abs(eps_rr - math.log(7)) < 1e-9)
rnd2 = random.Random(5)
answers = [respond(person.diagnosis == "HIV", rnd2, p) for person in people]
obs = sum(answers) / len(answers)
est = (obs - (1 - p) / 2) / p
show("randomized response", f"true share {TRUE / 2000:.4f}, share of 'yes' answers {obs:.4f}, estimate after removing the noise {est:.4f}")
check("the estimate of the share is within 3 points of the truth from 2,000 noisy answers", abs(est - TRUE / 2000) < 0.03)
local_error = 2000 * math.sqrt(obs * (1 - obs) / 2000) / p  # std of the estimated count
central_error = 1 / eps_rr
check("the same epsilon applied centrally gives an error below 1, and applied by each person it gives an error of about 26 people (more than 20)", central_error < 1 and local_error > 20)
check("local noise costs about sqrt(n) times more than central noise: the price of not trusting the one who collects", local_error / central_error > 40)

if "--write" in sys.argv:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    rows = {}
    for eps in (0.1, 0.5, 1.0, 2.0, 5.0):
        r = random.Random(100 + int(eps * 10))
        rows[str(eps)] = {"scale": 1 / eps, "overlap": round(overlap(eps), 4), "answers": [round(TRUE + laplace(r, 1 / eps), 2) for _ in range(120)]}
    OUT.write_text(json.dumps({"true": TRUE, "eps": rows, "meanAbs": {str(k): v for k, v in results.items()}}, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")
done()
