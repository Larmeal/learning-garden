"""Lesson 11: the capstone. Release a table about 2,000 people in four stages and measure, at each one, what an attacker can do and what the data is still good for.

Stages: (0) the raw table, (1) names, e-mails, phones and notes removed, (2) zip and birth date generalized so that every group has 5 or more people, (3) only noisy
aggregates (differential privacy, epsilon 1 in total). Attacks: a linkage with the public voter list, and a difference attack (does the table with Ann differ from the table
without her?). Utility: the error of the mean salary per zip area and of the count of each diagnosis.
Asserts the numbers of every stage, that the difference attack is perfect against any table of exact counts and close to a coin flip against the noisy ones, and that each of
the Five Safes is covered by a control. `--write` saves the stages for the lab (site/src/components/labs/data-security/release.json).
"""

import collections
import json
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dslab import check, done, show  # noqa: E402
from people import population, voters  # noqa: E402

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "site" / "src" / "components" / "labs" / "data-security" / "release.json"

people = population()
public = voters(people)
N = len(people)
LO, HI = 20_000, 80_000
ZIP3 = lambda z: z[:3]  # noqa: E731
BAND = lambda y: y // 10 * 10  # noqa: E731


def laplace(rnd, scale):
    u = rnd.random() - 0.5
    return -scale * math.copysign(1, u) * math.log(1 - 2 * abs(u))


def linkage(key_person, key_voter):
    groups = collections.defaultdict(list)
    for name, z, b, s in public:
        groups[key_voter(z, b, s)].append(name)
    right = 0
    for p in people:
        c = groups.get(key_person(p), [])
        if len(c) == 1 and c[0] == p.name:
            right += 1
    return right


true_mean = {z: sum(min(max(p.salary, LO), HI) for p in people if ZIP3(p.zip) == z) / sum(1 for p in people if ZIP3(p.zip) == z) for z in sorted({ZIP3(p.zip) for p in people})}
true_dx = collections.Counter(p.diagnosis for p in people)

stages = []

# ---- stage 0 and 1: raw and without direct identifiers ----
named0 = linkage(lambda p: (p.zip, p.birth, p.sex), lambda z, b, s: (z, b, s))
stages.append({"name": "raw", "named": named0, "diff": 1.0, "salaryErr": 0.0, "dxErr": 0.0})
stages.append({"name": "no direct identifiers", "named": named0, "diff": 1.0, "salaryErr": 0.0, "dxErr": 0.0})
check("stage 0 and 1: the join with the voter list names 1,409 people correctly, with or without the names in the table", named0 == 1409)

# ---- stage 2: generalize to k >= 5 and suppress the smaller groups ----
g = collections.defaultdict(list)
for p in people:
    g[(ZIP3(p.zip), BAND(p.birth.year), p.sex)].append(p)
kept_groups = {k: v for k, v in g.items() if len(v) >= 5}
kept = [p for v in kept_groups.values() for p in v]
named2 = linkage(lambda p: (ZIP3(p.zip), BAND(p.birth.year), p.sex), lambda z, b, s: (ZIP3(z), BAND(b.year), s))
mean2 = {z: sum(min(max(p.salary, LO), HI) for p in kept if ZIP3(p.zip) == z) / sum(1 for p in kept if ZIP3(p.zip) == z) for z in true_mean}
sal_err2 = sum(abs(mean2[z] - true_mean[z]) / true_mean[z] for z in true_mean) / len(true_mean)
dx2 = collections.Counter(p.diagnosis for p in kept)
dx_err2 = sum(abs(dx2[d] - true_dx[d]) / true_dx[d] for d in true_dx) / len(true_dx)
stages.append({"name": "k-anonymous (k>=5)", "named": named2, "diff": 1.0, "salaryErr": round(sal_err2, 4), "dxErr": round(dx_err2, 4), "suppressed": N - len(kept)})
show("stage 2", stages[-1])
check("stage 2: 10 rows are suppressed and the linkage names nobody correctly (0 of 2,000)", N - len(kept) == 10 and named2 == 0)
check("stage 2: the mean salary per zip area is still within 1% on average, and the diagnosis counts within 1%", sal_err2 < 0.01 and dx_err2 < 0.01)

# ---- the difference attack: one table with Ann and one without ----
def counts_of(rows):
    return sum(1 for p in rows if ZIP3(p.zip) == "109" and p.diagnosis == "HIV")

ann = next(p for p in people if ZIP3(p.zip) == "109" and p.diagnosis == "HIV")
without = [p for p in people if p.pid != ann.pid]
exact_with, exact_without = counts_of(people), counts_of(without)
check("exact counts: the table with Ann has one more person with that diagnosis in that area than the table without her, so the attacker learns it for certain", exact_with - exact_without == 1)


def difference_accuracy(eps: float, trials: int = 40_000, seed: int = 3) -> float:
    """The attacker knows the table without Ann and gets a noisy count of the table that may or may not include her; he guesses 'included' when the answer is closer to count+1 than to count."""
    rnd = random.Random(seed)
    right = 0
    base = exact_without
    for _ in range(trials):
        included = rnd.random() < 0.5
        answer = base + (1 if included else 0) + laplace(rnd, 1 / eps)
        guess = answer > base + 0.5
        right += guess == included
    return right / trials


acc = {e: difference_accuracy(e) for e in (0.1, 1.0, 5.0)}
show("difference attack, accuracy of the best guess (0.5 is a coin flip)", acc)
check("epsilon 1: the attacker is right 69.7% of the time (1/2 + 1/2 (1 - e^-0.5))", abs(acc[1.0] - (0.5 + 0.5 * (1 - math.exp(-0.5)))) < 0.01)
check("epsilon 0.1: 52.4%, close to a coin flip", abs(acc[0.1] - (0.5 + 0.5 * (1 - math.exp(-0.05)))) < 0.01)
check("epsilon 5: 95.9%, so a large epsilon protects little", abs(acc[5.0] - (0.5 + 0.5 * (1 - math.exp(-2.5)))) < 0.01)

# ---- stage 3: noisy aggregates only ----
rnd = random.Random(2026)
eps_counts, eps_mean = 0.5, 0.5  # two queries on disjoint groups, so epsilon adds as 0.5 + 0.5 = 1
dp_dx = {d: max(0, round(true_dx[d] + laplace(rnd, 1 / eps_counts))) for d in true_dx}
sizes = collections.Counter(ZIP3(p.zip) for p in people)
dp_mean = {z: true_mean[z] + laplace(rnd, ((HI - LO) / sizes[z]) / eps_mean) for z in true_mean}
sal_err3 = sum(abs(dp_mean[z] - true_mean[z]) / true_mean[z] for z in true_mean) / len(true_mean)
dx_err3 = sum(abs(dp_dx[d] - true_dx[d]) / true_dx[d] for d in true_dx) / len(true_dx)
stages.append({"name": "noisy aggregates (epsilon 1)", "named": 0, "diff": round(acc[1.0], 3), "salaryErr": round(sal_err3, 4), "dxErr": round(dx_err3, 4)})
show("stage 3", stages[-1])
check("stage 3: no row level data is published, so the linkage names nobody (0 of 2,000)", stages[-1]["named"] == 0)
check("stage 3: the mean salary per zip area has an error under 3% and the diagnosis counts under 3%", sal_err3 < 0.03 and dx_err3 < 0.03)
check("stage 3: the difference attack falls from certain (100%) to 69.7%", stages[2]["diff"] == 1.0 and abs(stages[3]["diff"] - 0.697) < 0.01)
check("each step costs some utility: the error of the salary means grows from 0 to under 1% (stage 2) to a larger value (stage 3)", stages[0]["salaryErr"] == 0 and stages[2]["salaryErr"] < stages[3]["salaryErr"])

# ---- the Five Safes: one control for each ----
SAFES = {
    "projects": "a request states a purpose, and the role is limited to it (lesson 8)",
    "people": "analysts get a role with views, not the base table (lesson 8)",
    "settings": "queries run through views, are logged and are scanned for what leaves (lesson 8)",
    "data": "direct identifiers removed, values generalized to k >= 5 (lessons 2 to 4)",
    "outputs": "only noisy aggregates leave, charged against a privacy budget (lessons 5 and 6)",
}
check("five controls, one for each of the Five Safes (projects, people, settings, data, outputs)", list(SAFES) == ["projects", "people", "settings", "data", "outputs"])

if "--write" in sys.argv:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"n": N, "stages": stages, "diffByEps": {str(k): round(v, 3) for k, v in acc.items()}, "safes": SAFES}, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")
done()
