"""Lesson 3: a linkage attack. A medical table with the names removed is joined with a public voter list on zip, birth date and sex.

Asserts how many people the join re-identifies when the quasi identifiers are exact, and how that falls when the birth date is coarsened (month, year) and the zip
is shortened (4, 3, 2 digits, or dropped), and that removing the names did not protect anybody. `--write` saves the grid for the lab.
"""

import collections
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dslab import check, done, show  # noqa: E402
from people import population, voters  # noqa: E402

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "site" / "src" / "components" / "labs" / "data-security" / "linkage.json"

people = population()
public = voters(people)
N = len(people)
check("the company table holds 2,000 people and the public voter list covers 1,413 of them", N == 2000 and len(public) == 1413)

BIRTH = {"day": lambda d: d, "month": lambda d: (d.year, d.month), "year": lambda d: d.year}
ZIP = {5: lambda z: z, 4: lambda z: z[:4], 3: lambda z: z[:3], 2: lambda z: z[:2], 0: lambda z: ""}


def attack(birth: str, zip_digits: int):
    """The medical table has no names. The attacker links each row to the voters who share its (zip, birth, sex)."""
    key = lambda z, b, s: (ZIP[zip_digits](z), BIRTH[birth](b), s)  # noqa: E731
    voter_groups = collections.defaultdict(list)
    for name, z, b, s in public:
        voter_groups[key(z, b, s)].append(name)
    reidentified = right = 0
    for p in people:
        cands = voter_groups.get(key(p.zip, p.birth, p.sex), [])
        if len(cands) == 1:  # exactly one voter fits: the attacker names the row
            reidentified += 1
            right += cands[0] == p.name
    table_groups = collections.Counter(key(p.zip, p.birth, p.sex) for p in people)
    unique_rows = sum(1 for p in people if table_groups[key(p.zip, p.birth, p.sex)] == 1)
    return {"unique": unique_rows, "reidentified": reidentified, "correct": right}


grid = {}
for b in BIRTH:
    for z in ZIP:
        grid[f"{b}-{z}"] = attack(b, z)
exact = grid["day-5"]
show("exact birth date, 5 digit zip", exact)
check("with exact quasi identifiers more than 1,300 of 2,000 rows are named by the join", exact["reidentified"] > 1300)
check("1,409 of the 1,410 names the join gives are right, and the one wrong name belongs to a person who is not on the list but shares zip, birth date and sex with a voter", (exact["reidentified"], exact["correct"]) == (1410, 1409))
check("70.5% of the people are named, which is almost exactly the share that is on the voter list, so removing the names protected almost nobody on it", abs(exact["reidentified"] / N - 1413 / N) < 0.01)
show("rows named correctly, by how much the quasi identifiers were coarsened", {k: v["correct"] for k, v in grid.items()})
c = {k: v["correct"] for k, v in grid.items()}
check("month and year instead of the day: 1,294 people are still named correctly (65%)", c["month-5"] == 1294)
check("year only: 502 are still named correctly, so the diagnosis of 1 in 4 people is still tied to a name", c["year-5"] == 502)
check("year and a 3 digit zip: 273 are named correctly", c["year-3"] == 273)
check("year and a 2 digit zip: nobody is named, because every group then holds many voters", c["year-2"] == 0 and c["year-0"] == 0)
check("a shorter zip barely helps while the exact birth date is kept (1,363 still named correctly with a 2 digit zip)", c["day-2"] == 1363)
check("the named count (rows with exactly one voter) is higher than the correct count once the keys are coarse: the attacker is more often wrong (year-5: 711 named, 502 right)", (grid["year-5"]["reidentified"], c["year-5"]) == (711, 502))
check("coarsening never increases the number of people named correctly (day >= month >= year for every zip length)", all(c[f"day-{z}"] >= c[f"month-{z}"] >= c[f"year-{z}"] for z in ZIP))

if "--write" in sys.argv:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sample = [{"name": n, "zip": z, "birth": b.isoformat(), "sex": s} for n, z, b, s in public[:5]]
    med = [{"zip": p.zip, "birth": p.birth.isoformat(), "sex": p.sex, "diagnosis": p.diagnosis} for p in people if any(p.name == v[0] for v in public[:5])][:5]
    OUT.write_text(json.dumps({"n": N, "voters": len(public), "grid": grid, "sampleVoters": sample, "sampleMedical": med, "sampleNames": [v[0] for v in public[:5]]}, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")
done()
