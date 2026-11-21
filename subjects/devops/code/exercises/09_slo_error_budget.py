"""Lesson 9: SLI, SLO, error budget and an alert that does not cry wolf.

Thirty days of request counts, one number per minute, made with a fixed seed: busy by day (about 200 requests a minute),
quiet at night (about 8), a background error rate of 0.02 percent, and one bad deploy on day 12 that fails 20 percent of
the requests for 40 minutes. Asserts the arithmetic of an SLO of 99.9 percent (the budget, the downtime it allows), how much
of the budget the incident burned, and what two alert rules do on the same data: a plain threshold on one minute pages
people for a single failed request at night, a burn rate alert over two windows pages once, soon after the incident starts.

Run with --write to save the curves that the error budget lab draws (budget.json).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from devlab import check, save_json, show  # noqa: E402

from slolab import BAD_LEN, BAD_START, DAYS, MIN_PER_DAY, SLO, make_month  # noqa: E402
import slolab  # noqa: E402

total, bad = make_month()

sum_total, sum_bad = sum(total), sum(bad)

# ---- 1. SLI, SLO, budget ----
sli = 1 - sum_bad / sum_total
print(f"  requests in 30 days {sum_total:,}, failed {sum_bad:,}, SLI {sli:.5f}")
budget = (1 - SLO) * sum_total
print(f"  error budget: {budget:,.0f} failed requests (0.1 percent of the requests)")
check("an SLO of 99.9 percent allows 43.2 minutes of full outage in 30 days", abs((1 - SLO) * DAYS * MIN_PER_DAY - 43.2) < 1e-9)
check("and about 10 minutes a week (the figure of the book)", abs((1 - SLO) * 7 * MIN_PER_DAY - 10.08) < 1e-9)
used = sum_bad / budget
print(f"  budget used: {used:.0%}")
incident_bad = sum(bad[BAD_START:BAD_START + BAD_LEN])
check("the 40 minute incident failed more requests than the background noise of the whole month", incident_bad > (sum_bad - incident_bad), f"{incident_bad} vs {sum_bad - incident_bad}")
check("the month ends above the SLO, but about half of the budget is gone", sli >= SLO and 0.4 < used < 0.7, f"sli={sli:.5f} used={used:.2f}")
check("without the incident the month would have used less than a fifth of the budget", (sum_bad - incident_bad) / budget < 0.2)

# ---- 2. burn rate ----
check("a burn rate of 1 spends the whole budget in exactly the 30 days of the SLO window", 1 * 30 * 24 / 1 == 720)
check("a burn rate of 14.4 for one hour spends 2 percent of the monthly budget", abs(14.4 * 1 / 720 - 0.02) < 1e-12)
check("a burn rate of 6 for six hours spends 5 percent", abs(6 * 6 / 720 - 0.05) < 1e-12)


def burn(start: int, length: int, minute: int) -> float:
    return slolab.burn(total, bad, length, minute)


# ---- 3. two alert rules on the same month ----
def evaluate(rule) -> list[int]:
    """The minutes at which a new page starts (the rule turns from quiet to firing)."""
    pages, firing = [], False
    for m in range(len(total)):
        now = rule(m)
        if now and not firing:
            pages.append(m)
        firing = now
    return pages


naive = evaluate(lambda m: bad[m] / total[m] > 0.05)  # more than 5 percent failed within this minute
burn_alert = evaluate(lambda m: burn(0, 60, m) > 14.4 and burn(0, 5, m) > 14.4)


def when(m: int) -> str:
    return f"day {m // MIN_PER_DAY + 1} {m % MIN_PER_DAY // 60:02d}:{m % 60:02d}"


night_pages = [m for m in naive if not (8 <= (m % MIN_PER_DAY) // 60 < 22)]
show("naive rule: page when more than 5 percent of one minute failed", f"{len(naive)} pages, {len(night_pages)} of them at night, first at {when(naive[0])}")
show("burn rate rule: page when the burn rate is above 14.4 over the last hour and over the last 5 minutes", f"{len(burn_alert)} page(s): " + ", ".join(when(m) for m in burn_alert))
check("the naive rule pages many times, most of them for a handful of requests at night", len(naive) >= 10 and len(night_pages) >= 8, f"{len(naive)} / {len(night_pages)}")
check("the burn rate rule pages exactly once", len(burn_alert) == 1, str(burn_alert))
delay = burn_alert[0] - BAD_START
check("and it pages while the incident is still running, within ten minutes of its start", 0 <= delay <= 10, str(delay))
print(f"  the burn rate alert fired {delay} minutes after the bad deploy, which failed requests for {BAD_LEN} minutes")
check("the naive rule also catches the incident (it pages during those 40 minutes)", any(BAD_START <= m < BAD_START + BAD_LEN for m in naive))
spent_at_page = sum(bad[BAD_START:burn_alert[0]]) / budget
print(f"  budget burned before the page: {spent_at_page:.0%}; by the end of the incident: {incident_bad / budget:.0%}")
check("by the time the page arrives, less than half of the incident's damage is done", spent_at_page < 0.5 * incident_bad / budget)
check("a rollback at the page would have saved more than half of the budget the incident burned", (incident_bad - sum(bad[BAD_START:burn_alert[0] + 5])) / incident_bad > 0.5)

if "--write" in sys.argv:
    cum, running = [], 0.0
    for d in range(DAYS):
        running += sum(bad[d * MIN_PER_DAY:(d + 1) * MIN_PER_DAY])
        cum.append(round(running / budget, 4))
    data = {
        "days": DAYS, "slo": SLO, "budget": round(budget), "total": sum_total, "failed": sum_bad,
        "cumulativeBudgetUsed": cum, "badStart": BAD_START, "badLen": BAD_LEN,
        "incidentDay": 12, "burnAlertMinute": burn_alert[0], "naivePages": len(naive), "naiveNightPages": len(night_pages), "naivePageMinutes": naive,
        "perMinuteFailRate": [round(sum(bad[m:m + 10]) / max(1, sum(total[m:m + 10])), 4) for m in range(BAD_START - 60, BAD_START + 120, 10)],
        "incidentBudgetUsed": round(incident_bad / budget, 4),
    }
    save_json("budget.json", data)
print("ok")
