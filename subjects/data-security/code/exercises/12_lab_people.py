"""Data for the labs that draw the crowd: the 2,000 synthetic people as one compact JSON file (`labPeople.json`).

The labs of lessons 1, 3, 4 and 11 do not read a result from an exercise, they group these rows in the browser, so what the reader sees is the real table.
This exercise writes the file and asserts that grouping the same rows here gives the numbers that exercises 01, 03 and 04 assert, and that the three people the
lab of lesson 1 follows become unique at the depth the lesson says. `node subjects/data-security/code/verify_labs.mts` repeats the same numbers with the code of the labs.

Row format: [sex (0 M, 1 F), zip index, birth year, month, day, diagnosis index, on the voter list (0 or 1)]. The name of person i is names[i].
"""

import collections
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dslab import check, done, show  # noqa: E402
from people import DIAGNOSES, ZIPS, population, voters  # noqa: E402

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "site" / "src" / "components" / "labs" / "data-security" / "labPeople.json"

people = population()
public = voters(people)
rnd = random.Random(11)  # the same stream as voters(): one draw per person, in order
on_list = [rnd.random() < 0.7 for _ in people]
check("the voter flags rebuilt here are the 1,413 people that voters() returns, in the same order", sum(on_list) == len(public) and [p.name for p, v in zip(people, on_list) if v] == [v[0] for v in public])

DIAG = sorted(set(DIAGNOSES), key=DIAGNOSES.index)
rows = [[0 if p.sex == "M" else 1, ZIPS.index(p.zip), p.birth.year, p.birth.month, p.birth.day, DIAG.index(p.diagnosis), int(v)] for p, v in zip(people, on_list)]


def group_sizes(depth: int):
    """Size of the group that each person falls in, when the first `depth` facts (sex, zip, year, month, day) are known."""
    keys = [tuple(r[:5][i] for i in order(depth)) for r in rows]
    c = collections.Counter(keys)
    return [c[k] for k in keys]


ORDER = [0, 1, 2, 3, 4]  # the facts in the order the lab adds them


def order(depth: int):
    return ORDER[:depth]


alone = [sum(1 for s in group_sizes(d) if s == 1) for d in range(1, 6)]
show("people alone in their group after sex, zip, year, month, day", alone)
check("people who are alone after 1, 2, 3, 4 and 5 facts: 0, 0, 450, 1,757 and 1,992 (the numbers of exercise 01)", alone == [0, 0, 450, 1757, 1992])

# three people for the lab: one who is alone once the birth year is known, one only at the month, one only at the day
sizes = [group_sizes(d) for d in range(1, 6)]
pick = {}
for i, p in enumerate(people):
    depth = next((d for d in range(1, 6) if sizes[d - 1][i] == 1), 0)
    if depth in (3, 4, 5) and depth not in pick and on_list[i]:
        pick[depth] = i
check("a person who is first alone at the year, one at the month and one at the day were all found, and all three are on the voter list", sorted(pick) == [3, 4, 5])
featured = [pick[3], pick[4], pick[5]]
show("the three people the lab follows (name, group size after each fact)", [(people[i].name, [s[i] for s in sizes]) for i in featured])
for i, d in zip(featured, (3, 4, 5)):
    check(f"{people[i].name} is alone after {d} facts and was not alone after {d - 1}", sizes[d - 1][i] == 1 and sizes[d - 2][i] > 1)

# the join of exercise 03, rebuilt from the compact rows: a person is named when exactly one voter shares the keys
def link(birth: str, zip_digits: int):
    def key(r):
        z = ZIPS[r[1]][:zip_digits] if zip_digits else ""
        b = (r[2], r[3], r[4]) if birth == "day" else (r[2], r[3]) if birth == "month" else r[2]
        return (z, b, r[0])
    voters_by_key = collections.defaultdict(list)
    for i, r in enumerate(rows):
        if r[6]:
            voters_by_key[key(r)].append(i)
    named = right = 0
    for i, r in enumerate(rows):
        c = voters_by_key.get(key(r), [])
        if len(c) == 1:
            named += 1
            right += people[c[0]].name == people[i].name  # the exercise compares names, as the attacker only has names
    return named, right


check("the join on the compact rows names 1,410 people and 1,409 of them correctly (exercise 03)", link("day", 5) == (1410, 1409))
check("month and year: 1,294 correct; year only: 502; year and a 3 digit zip: 273; year and a 2 digit zip: 0 (exercise 03)", [link("month", 5)[1], link("year", 5)[1], link("year", 3)[1], link("year", 2)[1]] == [1294, 502, 273, 0])

if "--write" in sys.argv:
    OUT.write_text(json.dumps({"n": len(rows), "zips": ZIPS, "diagnoses": DIAG, "names": [p.name for p in people], "rows": rows, "featured": featured}, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT}")
done()
