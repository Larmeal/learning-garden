"""The thirty days of requests that lessons 9, 10 and 13 share (see exercise 09 for what it holds)."""

import random

DAYS, MIN_PER_DAY = 30, 1440
SLO = 0.999
BAD_START = 11 * MIN_PER_DAY + 14 * 60  # day 12, 14:00
BAD_LEN = 40


def make_month():
    rng = random.Random(21)
    total, bad = [], []
    for minute in range(DAYS * MIN_PER_DAY):
        hour = (minute % MIN_PER_DAY) // 60
        rate = 200 if 8 <= hour < 22 else 8
        n = max(1, int(rng.gauss(rate, rate ** 0.5)))
        p = 0.0002 + (0.20 if BAD_START <= minute < BAD_START + BAD_LEN else 0.0)
        e = sum(1 for _ in range(n) if rng.random() < p)
        total.append(n)
        bad.append(e)
    return total, bad


def burn(total, bad, length, minute):
    """Burn rate over the last `length` minutes up to and including `minute`."""
    lo = max(0, minute - length + 1)
    t, e = sum(total[lo:minute + 1]), sum(bad[lo:minute + 1])
    return (e / t) / (1 - SLO) if t else 0.0


def first_page(total, bad, since=0):
    """The first minute at which both the 1 hour and the 5 minute burn rate are above 14.4."""
    for m in range(since, len(total)):
        if burn(total, bad, 60, m) > 14.4 and burn(total, bad, 5, m) > 14.4:
            return m
    return None
