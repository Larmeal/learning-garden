"""Lesson 1: sensitive data and the identifiability spectrum, on 2,000 synthetic people.

Asserts that columns fall into three kinds (direct identifier, quasi identifier, sensitive value), that a regex finds an e-mail and a phone number
hidden in a free text column, and that a person becomes unique as columns are added one at a time (sex alone, then zip, then birth year, then full birth date).
`--write` saves the numbers as site/src/components/labs/data-security/identifiability.json for the lab.
"""

import collections
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dslab import check, done, show  # noqa: E402
from people import population  # noqa: E402

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "site" / "src" / "components" / "labs" / "data-security" / "identifiability.json"

people = population()
N = len(people)
check("the table has 2,000 people", N == 2000)

# ---- 1. three kinds of column ----
COLUMNS = {
    "name": lambda p: p.name, "email": lambda p: p.email, "phone": lambda p: p.phone, "zip": lambda p: p.zip,
    "birth": lambda p: p.birth, "sex": lambda p: p.sex, "diagnosis": lambda p: p.diagnosis, "salary": lambda p: p.salary,
}
distinct = {c: len({f(p) for p in people}) for c, f in COLUMNS.items()}
show("distinct values per column", distinct)
check("e-mail and phone are different for (almost) every person: they point at one person (direct identifiers)", distinct["email"] == N and distinct["phone"] >= 1990)
check("sex has 2 values, zip 12 and diagnosis 7: each alone fits hundreds of people (not identifying alone)", distinct["sex"] == 2 and distinct["zip"] == 12 and distinct["diagnosis"] == 7)
check("birth date has 1,900 different values among 2,000 people: a quasi identifier that is nearly unique on its own", distinct["birth"] == 1900)
KIND = {"name": "direct", "email": "direct", "phone": "direct", "zip": "quasi", "birth": "quasi", "sex": "quasi", "diagnosis": "sensitive", "salary": "sensitive"}

# ---- 2. identifiers hidden in free text ----
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
PHONE = re.compile(r"\b0[689]\d{8}\b")
with_email = [p for p in people if EMAIL.search(p.notes)]
with_phone = [p for p in people if PHONE.search(p.notes)]
show("free text column 'notes'", f"{len(with_phone)} rows hold a phone number, {len(with_email)} hold an e-mail")
check("200 notes hide a phone number (every 10th person)", len(with_phone) == 200)
check("an e-mail is hidden in the notes of 106 more people (every 17th person who is not a multiple of 10)", len(with_email) == 106)
check("a notes column that looks harmless therefore holds direct identifiers", len(with_email) + len(with_phone) == 306)

# ---- 3. how many columns make a person unique ----
def unique_count(cols):
    groups = collections.Counter(tuple(COLUMNS[c](p) for c in cols) for p in people)
    sizes = collections.Counter(groups.values())
    return sum(1 for g in groups.values() if g == 1), len(groups), dict(sorted(sizes.items()))

STEPS = [("sex",), ("sex", "zip"), ("sex", "zip", "birth_year"), ("sex", "zip", "birth_month"), ("sex", "zip", "birth")]
COLUMNS["birth_year"] = lambda p: p.birth.year
COLUMNS["birth_month"] = lambda p: (p.birth.year, p.birth.month)
rows = []
for cols in STEPS:
    u, g, sizes = unique_count(cols)
    rows.append({"cols": list(cols), "unique": u, "groups": g, "smallest": min(sizes), "largest": max(sizes)})
    show("+".join(cols), f"{g} groups, {u} people alone in their group ({u / N:.1%})")
check("sex alone: 2 groups, nobody is alone", rows[0]["groups"] == 2 and rows[0]["unique"] == 0)
check("adding zip: 24 groups, still nobody alone", rows[1]["groups"] == 24 and rows[1]["unique"] == 0)
check("adding birth year: the number of groups jumps and some people are alone in theirs", rows[2]["groups"] > 1000 and rows[2]["unique"] > 0)
check("adding birth month and year makes most people unique", rows[3]["unique"] / N > 0.5)
check("full birth date with zip and sex makes almost everyone unique (over 95%)", rows[4]["unique"] / N > 0.95)
check("the more columns, the more unique people (never fewer)", [r["unique"] for r in rows] == sorted(r["unique"] for r in rows))

if "--write" in sys.argv:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"n": N, "distinct": distinct, "kind": KIND, "steps": rows, "notes": {"phone": len(with_phone), "email": len(with_email)}}, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")
done()
