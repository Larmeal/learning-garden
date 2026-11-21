"""Lesson 12: measuring delivery with the four DORA metrics, read from a Git history.

Two invented teams work for 8 weeks in two real Git repositories. Team Batch merges all the time but releases every
two weeks; team Flow releases about twice a day. Every release is an annotated tag whose message says whether it failed and
when service was restored. The exercise reads the metrics back the way a real tool does: lead time from the commit dates and
the tag date, deployment frequency from the tags, change failure rate and time to restore from the tag messages. The data
are made up, so it checks that the calculation is right and does NOT prove that small batches fail less (that claim
comes from the book, with its own data).

Run with --write to save the numbers that the DORA lab draws (dora.json).
"""

import statistics
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from devlab import check, git, init, save_json, show  # noqa: E402

START = datetime(2026, 1, 5, 9, 0, tzinfo=timezone.utc)  # a Monday
WEEKS = 8


def stamp(t: datetime) -> str:
    return t.strftime("%Y-%m-%dT%H:%M:%S +0000")


def build_team(name: str, commits_per_day: int, deploy_every_hours: int, fail_every: int, restore_minutes: int):
    repo = init(f"12_{name}")
    # commits: on working days between 09:00 and 17:00
    commit_times = []
    day = START
    while day < START + timedelta(weeks=WEEKS):
        if day.weekday() < 5:
            for k in range(commits_per_day):
                commit_times.append(day + timedelta(minutes=int(480 * (k + 0.5) / commits_per_day)))
        day += timedelta(days=1)
    # deploys: the first working-hour slot at or after each deploy interval
    deploys, t = [], START + timedelta(hours=deploy_every_hours)
    while t < START + timedelta(weeks=WEEKS):
        while t.weekday() >= 5 or not (9 <= t.hour < 17):
            t += timedelta(hours=1)
        deploys.append(t)
        t += timedelta(hours=deploy_every_hours)
    events = sorted([(c, "commit", None) for c in commit_times] + [(d, "deploy", None) for d in deploys], key=lambda e: (e[0], e[1] == "deploy"))
    n_deploy = 0
    for when, kind, _ in events:
        env = {"GIT_AUTHOR_DATE": stamp(when), "GIT_COMMITTER_DATE": stamp(when)}
        if kind == "commit":
            git(repo, "commit", "--allow-empty", "--quiet", "-m", f"change at {when:%m-%d %H:%M}", env=env)
        else:
            n_deploy += 1
            failed = n_deploy % fail_every == 0
            message = f"failed restored={stamp(when + timedelta(minutes=restore_minutes + (n_deploy % 5 - 2) * 5))}" if failed else "ok"
            git(repo, "tag", "-a", f"deploy-{n_deploy:03d}", "-m", message, env=env)
    return repo


def read_metrics(repo: Path) -> dict:
    tags = git(repo, "for-each-ref", "--sort=creatordate", "--format=%(refname:short)|%(creatordate:iso-strict)|%(contents:subject)", "refs/tags").splitlines()
    lead_hours, failures, restore_minutes, deploys, previous = [], 0, [], [], None
    for line in tags:
        tag, when_s, subject = line.split("|", 2)
        when = datetime.fromisoformat(when_s)
        rng = f"{previous}..{tag}" if previous else tag
        commit_dates = [datetime.fromisoformat(d) for d in git(repo, "log", rng, "--format=%aI").splitlines()]
        lead_hours += [(when - c).total_seconds() / 3600 for c in commit_dates]
        failed = subject.startswith("failed")
        if failed:
            failures += 1
            restored = datetime.fromisoformat(subject.split("restored=")[1].replace(" +0000", "+00:00"))
            restore_minutes.append((restored - when).total_seconds() / 60)
        deploys.append({"tag": tag, "at": when.isoformat(), "commits": len(commit_dates), "failed": failed})
        previous = tag
    return {
        "deploys": len(tags),
        "per_week": len(tags) / WEEKS,
        "lead_median_h": statistics.median(lead_hours),
        "lead_mean_h": statistics.mean(lead_hours),
        "change_fail_rate": failures / len(tags),
        "restore_mean_min": statistics.mean(restore_minutes) if restore_minutes else 0.0,
        "failures": failures,
        "commits": sum(d["commits"] for d in deploys),
        "timeline": deploys,
    }


batch = build_team("batch", commits_per_day=6, deploy_every_hours=24 * 14, fail_every=3, restore_minutes=300)
flow = build_team("flow", commits_per_day=6, deploy_every_hours=4, fail_every=10, restore_minutes=20)
mb, mf = read_metrics(batch), read_metrics(flow)

for label, m in (("Batch", mb), ("Flow ", mf)):
    show(label, f"deployments {m['deploys']:3} ({m['per_week']:.1f} per week), median lead time {m['lead_median_h']:.1f} h, change failure rate {m['change_fail_rate']:.0%} ({m['failures']} of {m['deploys']}), mean time to restore {m['restore_mean_min']:.0f} min")

# ---- the calculation is right ----
check("Batch deployed 3 times in 8 weeks (every 14 days at the earliest working hour)", mb["deploys"] == 3, str(mb["deploys"]))
check("Flow deployed about twice every working day (between 8 and 14 a week)", 8 <= mf["per_week"] <= 14, str(mf["per_week"]))
check("every commit is counted in exactly one release (the ones after the last tag wait for the next)", mb["commits"] <= 6 * 5 * WEEKS and mf["commits"] <= 6 * 5 * WEEKS and mb["commits"] > 0)
check("the median lead time of Batch is measured in days (more than 48 hours)", mb["lead_median_h"] > 48, str(mb["lead_median_h"]))
check("the median lead time of Flow is under a day (a commit made late in the afternoon waits for the next release in the morning)", mf["lead_median_h"] < 24, str(mf["lead_median_h"]))
check("a team that deploys every 14 days has an average lead time of about a week, a few hundred hours at most", 100 < mb["lead_mean_h"] < 340, str(mb["lead_mean_h"]))
check("change failure rate is failures over deployments", abs(mf["change_fail_rate"] - mf["failures"] / mf["deploys"]) < 1e-12)
check("time to restore comes from the tag messages: the failed release of Batch took hours", mb["failures"] == 1 and mb["restore_mean_min"] > 120)
check("and Flow restored in minutes", mf["failures"] == 8 and mf["restore_mean_min"] < 40, str(mf["restore_mean_min"]))
# the point of the lesson, on made up data: with a quarter of the commits per release the damage of a failure is smaller
check("a release of Batch carries many more commits than one of Flow (batch size)", mb["commits"] / mb["deploys"] > 5 * mf["commits"] / mf["deploys"])
print("  note: which releases fail (every 3rd of Batch, every 10th of Flow) and the restore times were chosen by this exercise; the lesson says so")

if "--write" in sys.argv:
    save_json("dora.json", {
        "weeks": WEEKS,
        "teams": {
            "batch": {k: (round(v, 2) if isinstance(v, float) else v) for k, v in mb.items() if k != "timeline"} | {"timeline": mb["timeline"]},
            "flow": {k: (round(v, 2) if isinstance(v, float) else v) for k, v in mf.items() if k != "timeline"} | {"timeline": mf["timeline"]},
        },
    })
print("ok")
