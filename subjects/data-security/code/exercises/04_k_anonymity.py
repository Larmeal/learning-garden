"""Lesson 4: k-anonymity. Generalize zip and birth date until every group of look-alike rows has at least k people, and see what that costs.

Asserts the smallest group size (k) for each level of generalization, how many rows must be suppressed to reach k = 5, that a group where everybody has the same
diagnosis (homogeneity) still leaks even when k is large, and that a group with one diagnosis can be told by looking at the generalized rows alone.
`--write` saves the grid for the lab (site/src/components/labs/data-security/kanon.json).
"""

import collections
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dslab import check, done, show  # noqa: E402
from people import population  # noqa: E402

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "site" / "src" / "components" / "labs" / "data-security" / "kanon.json"

people = population()
N = len(people)

BAND = {1: lambda y: y, 5: lambda y: y // 5 * 5, 10: lambda y: y // 10 * 10, 20: lambda y: y // 20 * 20}  # age band of the birth year
ZIP = {5: lambda z: z, 4: lambda z: z[:4], 3: lambda z: z[:3], 2: lambda z: z[:2]}


def groups(band: int, zip_digits: int):
    g = collections.defaultdict(list)
    for p in people:
        g[(ZIP[zip_digits](p.zip), BAND[band](p.birth.year), p.sex)].append(p)
    return g


def stats(band: int, zip_digits: int, k_target: int = 5):
    g = groups(band, zip_digits)
    sizes = [len(v) for v in g.values()]
    small = [v for v in g.values() if len(v) < k_target]
    suppressed = sum(len(v) for v in small)
    kept = [v for v in g.values() if len(v) >= k_target]
    homo = [v for v in kept if len({p.diagnosis for p in v}) == 1]
    return {"k": min(sizes), "groups": len(g), "suppressed": suppressed, "homogeneous": len(homo), "homogeneousPeople": sum(len(v) for v in homo), "kept": sum(len(v) for v in kept), "avg": round(N / len(g), 1)}


grid = {f"{b}-{z}": stats(b, z) for b in BAND for z in ZIP}
show("k and suppressed rows for each level", {key: (v["k"], v["suppressed"]) for key, v in grid.items()})

check("exact year of birth and 5 digit zip: k is 1, some people are unique", grid["1-5"]["k"] == 1)
check("with exact keys, 1,872 of the 2,000 rows are in groups smaller than 5 and would have to be suppressed", grid["1-5"]["suppressed"] == 1872)
check("5 year bands and a 3 digit zip: k is 3 and 38 rows must go to reach k = 5", (grid["5-3"]["k"], grid["5-3"]["suppressed"]) == (3, 38))
check("10 year bands and a 3 digit zip: only 10 rows (0.5%) must be suppressed to reach k = 5", (grid["10-3"]["suppressed"], grid["10-3"]["kept"]) == (10, 1990))
check("a 2 digit zip is the whole city here, and 10 year bands then give 12 groups of 82 or more: k = 82, nothing suppressed, but very little detail left", (grid["10-2"]["k"], grid["10-2"]["groups"], grid["10-2"]["suppressed"]) == (82, 12, 0))
check("20 year bands add nothing over 10 year bands at the same zip (the people were born over only 55 years)", all(grid[f"20-{z}"]["suppressed"] == grid[f"10-{z}"]["suppressed"] for z in (5, 4, 3)))
check("for a fixed zip, widening the age band never lowers k (1 to 5 to 10 to 20)", all(grid[f"{b2}-{z}"]["k"] >= grid[f"{b1}-{z}"]["k"] for z in ZIP for b1, b2 in ((1, 5), (5, 10), (10, 20))))
check("the price is information: the average group grows from 1.9 people to 166.7", (grid["1-5"]["avg"], grid["10-2"]["avg"]) == (1.9, 166.7))

# ---- homogeneity: k-anonymity does not look at the sensitive column ----
chosen = grid["10-3"]
show("10 year bands, 3 digit zip (k >= 5 after suppressing 10 rows)", chosen)
g = {key: v for key, v in groups(10, 3).items() if len(v) >= 5}
check("every remaining group has 5 or more people, so k-anonymity holds", min(len(v) for v in g.values()) >= 5)
homo = [(key, v) for key, v in g.items() if len({p.diagnosis for p in v}) == 1]
check("yet 5 of its groups (62 people) have one diagnosis only: nothing has to be known about a person beyond zip area, age band and sex to know the illness", (len(homo), sum(len(v) for _, v in homo)) == (5, 62))
sample_key, sample = homo[0]
show("one such group", {"group": sample_key, "people": len(sample), "diagnosis": sample[0].diagnosis})
share = collections.Counter(p.diagnosis for p in people if p.zip == "10900")
check("the zip area 109 is the area of a specialist clinic: 169 of its 181 people have the same diagnosis", share["HIV"] == 169 and sum(share.values()) == 181)
check("2-diversity (at least two diagnoses in every group) fails for this release", not all(len({p.diagnosis for p in v}) >= 2 for v in g.values()))
check("most groups of the area 109 are near homogeneous even when they are not exactly so (the share of the top diagnosis is at least 80%)", all(max(collections.Counter(p.diagnosis for p in v).values()) / len(v) >= 0.8 for key, v in g.items() if key[0] == "109"))

if "--write" in sys.argv:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    example = [{"zip": ZIP[3](p.zip), "age": BAND[10](p.birth.year), "sex": p.sex, "diagnosis": p.diagnosis} for p in sample[:5]]
    OUT.write_text(json.dumps({"n": N, "grid": grid, "bands": list(BAND), "zips": list(ZIP), "homogeneousExample": example}, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")
done()
