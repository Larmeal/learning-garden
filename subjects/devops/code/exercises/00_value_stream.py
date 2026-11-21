"""Lesson 0: what DevOps is trying to shorten, with two small models.

Nothing here is measured on a real team: the times are the author's example numbers, and the exercise checks the arithmetic
of two ideas the lesson explains. (1) Lead time is mostly waiting: the same change through a ticket based hand-off process
and through an automated pipeline, compared by flow efficiency (time somebody works on it divided by the whole time).
(2) How often you release decides how long a finished change waits: 20 finished changes spread over 4 weeks, released daily,
weekly, every two weeks or monthly.

Run with --write to save the numbers that the DevOps loop lab draws (loop.json).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from devlab import check, save_json, show  # noqa: E402

# ---- 1. one change through two ways of working (hours; work = somebody is doing it, wait = it sits in a queue) ----
HANDOFF = [
    ("write the code", 8, 0),
    ("code review", 1, 16),
    ("hand to test, manual test", 6, 40),
    ("ask Ops for a deploy window", 1, 90),
    ("Ops deploys by hand", 2, 24),
    ("check in production", 1, 8),
]
PIPELINE = [
    ("write the code", 8, 0),
    ("code review", 1, 2),
    ("pipeline: build and test", 0.2, 0.1),
    ("deploy by pipeline", 0.1, 0.1),
    ("check in production (dashboards)", 0.2, 0),
]


def lead_and_efficiency(steps):
    work = sum(w for _, w, _ in steps)
    wait = sum(q for _, _, q in steps)
    return work + wait, work / (work + wait), work, wait


lead_h, eff_h, work_h, wait_h = lead_and_efficiency(HANDOFF)
lead_p, eff_p, work_p, wait_p = lead_and_efficiency(PIPELINE)
show("a change with hand-offs", f"work {work_h:g} h, waiting {wait_h:g} h, lead time {lead_h:g} h ({lead_h / 24:.1f} days), flow efficiency {eff_h:.0%}")
show("the same change with a pipeline", f"work {work_p:g} h, waiting {wait_p:g} h, lead time {lead_p:.1f} h, flow efficiency {eff_p:.0%}")
check("with hand-offs, the change waits about ten times longer than anybody works on it", 8 < wait_h / work_h < 12, f"{wait_h / work_h:.1f}")
check("flow efficiency with hand-offs is under 10 percent", eff_h < 0.10, f"{eff_h:.3f}")
check("with a pipeline the same human work (the code) is left, and the waiting is a small part of the day", wait_p < 3 and eff_p > 0.7, f"{eff_p:.2f}")
check("the waiting dropped by more than 95 percent, and what is left of the work is the code and its review (9 of 9.5 hours)", (wait_h - wait_p) / wait_h > 0.95 and work_p - 9 < 1)

# ---- 2. release cadence: how long does a finished change wait for its release? ----
HOURS = 24 * 28
finished = [i * HOURS / 20 + 3.0 for i in range(20)]  # 20 changes, one about every 33 hours, spread over 4 weeks
CADENCE = {"every day": 24, "every week": 24 * 7, "every 2 weeks": 24 * 14, "every 4 weeks": 24 * 28}


def waits(every_hours: float) -> list[float]:
    releases = [every_hours * k for k in range(1, int(HOURS // every_hours) + 2)]
    return [next(r for r in releases if r >= f) - f for f in finished]


results = {}
for name, hours in CADENCE.items():
    w = waits(hours)
    per_release = max(1, round(20 / (HOURS / hours)))
    results[name] = {"average_wait_h": sum(w) / len(w), "max_wait_h": max(w), "changes_per_release": per_release}
    print(f"  {name:14} average wait {sum(w) / len(w):6.1f} h, longest {max(w):6.1f} h, about {per_release:2} changes in each release")
check("the average wait grows with the length of the release interval", [r["average_wait_h"] for r in results.values()] == sorted(r["average_wait_h"] for r in results.values()))
check("a daily release leaves a finished change waiting 12 hours on average, give or take a few", abs(results["every day"]["average_wait_h"] - 12) < 3)
check("a monthly release leaves it waiting more than a week on average", results["every 4 weeks"]["average_wait_h"] > 24 * 7)
check("a monthly release puts all 20 changes into one release, a daily one puts one or two", results["every 4 weeks"]["changes_per_release"] == 20 and results["every day"]["changes_per_release"] <= 2)
check("the longest wait is about the whole interval for the monthly release", results["every 4 weeks"]["max_wait_h"] > 24 * 25)

if "--write" in sys.argv:
    save_json("loop.json", {
        "handoff": [{"step": s, "work": w, "wait": q} for s, w, q in HANDOFF],
        "pipeline": [{"step": s, "work": w, "wait": q} for s, w, q in PIPELINE],
        "leadHandoff": lead_h, "leadPipeline": round(lead_p, 1),
        "efficiencyHandoff": round(eff_h, 3), "efficiencyPipeline": round(eff_p, 3),
        "cadence": {k: {kk: round(vv, 1) for kk, vv in v.items()} for k, v in results.items()},
    })
print("ok")
