"""Synthetic people for the Data Security exercises. Nobody here is real: names come from short lists and every number from a seeded random generator.

`population()` is the table a company would hold (2,000 people). `voters()` is a public list that covers 70% of them with name, zip, birth date and sex only.
The same call always gives the same rows, so the numbers that the lessons print repeat.
"""

from __future__ import annotations

import datetime as dt
import random
from dataclasses import dataclass

FIRST = ["Ann", "Bob", "Cat", "Dan", "Eve", "Fay", "Gus", "Hal", "Ivy", "Jon", "Kim", "Lia", "Max", "Nia", "Oto", "Pia", "Quin", "Rae", "Sam", "Tia"]
LAST = ["Stone", "Reed", "Park", "Cole", "Frost", "Hale", "Moss", "Lane", "Voss", "Wade", "Yoon", "Zane", "Bell", "Crow", "Dunn"]
ZIPS = ["10110", "10120", "10230", "10240", "10310", "10330", "10400", "10500", "10510", "10600", "10700", "10900"]
DIAGNOSES = ["flu", "flu", "flu", "asthma", "asthma", "diabetes", "hypertension", "migraine", "depression", "HIV"]
DOMAINS = ["mail.test", "post.test", "inbox.test"]


@dataclass(frozen=True)
class Person:
    pid: int
    name: str
    email: str
    phone: str
    zip: str
    birth: dt.date
    sex: str
    diagnosis: str
    salary: int
    notes: str


def population(n: int = 2000, seed: int = 7) -> list[Person]:
    rnd = random.Random(seed)
    clinic = random.Random(seed + 99)  # a separate stream, so that adding this effect leaves every other column as it was
    rows: list[Person] = []
    for pid in range(1, n + 1):
        first, last = rnd.choice(FIRST), rnd.choice(LAST)
        birth = dt.date(1950, 1, 1) + dt.timedelta(days=rnd.randrange(0, 365 * 55))
        phone = "08" + "".join(str(rnd.randrange(10)) for _ in range(8))
        email = f"{first.lower()}.{last.lower()}{pid}@{rnd.choice(DOMAINS)}"
        sex = rnd.choice("MF")
        zip_ = rnd.choice(ZIPS)
        diag = rnd.choice(DIAGNOSES)
        if zip_ == "10900" and clinic.random() < 0.9:  # the area of a specialist clinic: most of its patients share one diagnosis
            diag = "HIV"
        salary = int(rnd.gauss(45000, 12000)) // 100 * 100
        notes = ""
        if pid % 10 == 0:
            notes = f"call back on {phone}"
        elif pid % 17 == 0:
            notes = f"wrote from {email}, please reply"
        rows.append(Person(pid, f"{first} {last}", email, phone, zip_, birth, sex, diag, max(salary, 12000), notes))
    return rows


def voters(people: list[Person], share: float = 0.7, seed: int = 11) -> list[tuple[str, str, dt.date, str]]:
    rnd = random.Random(seed)
    return [(p.name, p.zip, p.birth, p.sex) for p in people if rnd.random() < share]
