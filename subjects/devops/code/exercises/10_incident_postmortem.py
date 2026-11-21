"""Lesson 10: an incident from the page to the postmortem.

The bad deploy of exercise 09 (day 12 at 14:00) is rebuilt from three sources. The times of the deploy and of the rollback
come from tags in a real Git repository; the time of the page comes from the burn rate alert run on the request data; the
times a person needs to answer and to decide are assumptions of this exercise and are written down as such. Asserts the
measures of an incident (time to detect, to acknowledge, to mitigate), how much error budget three ways of working burn on
the same bug, and that a postmortem written from the event list names no person.
"""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from devlab import HERE, check, git, init, save_json, show, write  # noqa: E402

sys.path.insert(0, str(HERE))
import slolab  # noqa: E402
from slolab import BAD_START, MIN_PER_DAY, make_month  # noqa: E402

NL = chr(10)
total, bad = make_month()
budget = (1 - slolab.SLO) * sum(total)
DAY0 = datetime(2026, 1, 1, tzinfo=timezone.utc)


def at(minute: int) -> datetime:
    return DAY0 + timedelta(minutes=minute)


def hhmm(minute: int) -> str:
    return at(minute).strftime("%H:%M")


# ---- 1. the deploy and the rollback are tags in Git, with their own dates ----
repo = init("10_service")
write(repo, "app.txt", "v1.0 good" + NL)


def commit_at(message: str, minute: int, tag: str | None = None) -> None:
    stamp = at(minute).strftime("%Y-%m-%dT%H:%M:%S +0000")
    env = {"GIT_AUTHOR_DATE": stamp, "GIT_COMMITTER_DATE": stamp}
    git(repo, "add", "-A", env=env)
    git(repo, "commit", "--quiet", "-m", message, env=env)
    if tag:
        git(repo, "tag", "-a", tag, "-m", tag, env=env)


commit_at("release 1.0", BAD_START - 3 * MIN_PER_DAY, "v1.0")
write(repo, "app.txt", "v1.1 new search, drops requests that carry a coupon" + NL)
commit_at("add coupon search", BAD_START, "v1.1")
git(repo, "revert", "--no-edit", "HEAD", env={"GIT_AUTHOR_DATE": at(BAD_START + 19).strftime("%Y-%m-%dT%H:%M:%S +0000"), "GIT_COMMITTER_DATE": at(BAD_START + 19).strftime("%Y-%m-%dT%H:%M:%S +0000")})
git(repo, "tag", "-a", "v1.1.1", "-m", "rollback", env={"GIT_COMMITTER_DATE": at(BAD_START + 19).strftime("%Y-%m-%dT%H:%M:%S +0000")})
tags = git(repo, "for-each-ref", "--sort=creatordate", "--format=%(refname:short) %(creatordate:iso-strict)", "refs/tags")
show("git for-each-ref refs/tags", tags)
check("three tags with the dates we gave them", [t.split()[0] for t in tags.splitlines()] == ["v1.0", "v1.1", "v1.1.1"])
deploy_t = datetime.fromisoformat(tags.splitlines()[1].split()[1])
rollback_t = datetime.fromisoformat(tags.splitlines()[2].split()[1])
deploy_min = int((deploy_t - DAY0).total_seconds() // 60)
rollback_min = int((rollback_t - DAY0).total_seconds() // 60)
check("the deploy tag is at 14:00 of day 12 and the rollback tag 19 minutes later", deploy_min == BAD_START and rollback_min == BAD_START + 19)

# ---- 2. the page comes from the burn rate alert ----
page_min = slolab.first_page(total, bad, since=BAD_START - 120)
check("the burn rate alert pages 4 minutes after the deploy", page_min == BAD_START + 4, str(page_min - BAD_START))

# ---- 3. the human part, written as assumptions ----
ACK = 5  # minutes from the page to someone looking at it
DECIDE = 10  # minutes from looking to the decision to roll back and starting it
events = [
    (deploy_min, "deploy", "version 1.1 is released (tag v1.1)"),
    (page_min, "page", "the burn rate alert fires"),
    (page_min + ACK, "ack", "the on-call engineer acknowledges the page and opens the dashboard"),
    (rollback_min, "rollback", "the rollback commit is tagged v1.1.1 and the pipeline deploys it"),
    (rollback_min + 2, "recovered", "the error rate is back to normal"),
]
check("the engineer acknowledged at 14:09 and rolled back at 14:19 (the assumptions: 5 and 10 minutes)", events[2][0] == BAD_START + 9 and rollback_min == page_min + ACK + DECIDE)
ttd = page_min - deploy_min
tta = ACK
ttm = events[-1][0] - deploy_min
show("the measures", f"time to detect  {ttd} min{NL}time to acknowledge {tta} min{NL}time to mitigate (deploy to recovered) {ttm} min")
check("time to detect 4 minutes, time to mitigate 21 minutes", (ttd, ttm) == (4, 21))

# ---- 4. the same bug three ways: how much of the month's error budget does it burn? ----
rate_during_bug = 0.20  # the share of requests that fail while version 1.1 is live


def burned(until_minute: int) -> float:
    """Budget spent if the bug stays live from the deploy until `until_minute`, at the flat failure rate."""
    return rate_during_bug * sum(total[BAD_START:until_minute]) / budget


scenarios = {
    "no alert, a customer writes in after 35 minutes, rollback takes 10": BAD_START + 35 + 10,
    "alert, rollback decided by hand (this exercise)": rollback_min + 2,
    "alert and a one command rollback (3 minutes after the acknowledge)": page_min + ACK + 3,
}
shares = {}
for name, minute in scenarios.items():
    shares[name] = burned(minute)
    print(f"  {shares[name]:5.0%} of the monthly budget  {name}  (recovered at {hhmm(minute)})")
values = list(shares.values())
scenarios_minutes = list(scenarios.values())
check("each step of improvement burns less than the one before (no alert > by hand > one command)", values[0] > values[1] > values[2], str(values))
check("without an alert the incident burns about a quarter of the monthly budget more than the one command rollback", 0.2 < values[0] - values[2] < 0.3, str(values))

# ---- 5. a postmortem from the events, with no names in it ----
culprit = git(repo, "log", "--format=%s", "--diff-filter=M", "-n", "2", "v1.1").splitlines()[0]
author = git(repo, "log", "-1", "--format=%an", "v1.1")
lines = [
    "# Postmortem: failed requests after release 1.1",
    "",
    "## Summary",
    f"Release 1.1 (`{culprit}`) made about {int(rate_during_bug * 100)} percent of requests fail from {hhmm(deploy_min)} until the rollback was live at {hhmm(events[-1][0])}.",
    "",
    "## Impact",
    f"{shares['alert, rollback decided by hand (this exercise)']:.0%} of the 30 day error budget of an SLO of 99.9 percent.",
    "",
    "## Timeline (UTC)",
    *[f"- {hhmm(m)} {kind}: {text}" for m, kind, text in events],
    "",
    "## What went well",
    "- The burn rate alert paged 4 minutes after the deploy, before any customer wrote in.",
    "- The rollback was one commit (a revert) and the normal pipeline.",
    "",
    "## What went wrong",
    "- The change reached every request at once, so every user with a coupon was hit.",
    "- No test covered a request that carries a coupon.",
    "",
    "## Action items",
    "- Add a test for requests with a coupon (owner: the team that owns search).",
    "- Release search changes to 10 percent of the traffic first (lesson 5).",
]
postmortem = NL.join(lines)
show("postmortem (first 9 lines)", NL.join(lines[:9]))
check("the postmortem has the sections of a blameless report", all(h in postmortem for h in ("## Summary", "## Impact", "## Timeline", "## What went well", "## What went wrong", "## Action items")))
check("it names no person, only a team and a change", author not in postmortem and "Ada" not in postmortem)
check("every time in the timeline is one of the event times", all(hhmm(m) in postmortem for m, _, _ in events))
check("the numbers in it are the ones computed above", f"{shares['alert, rollback decided by hand (this exercise)']:.0%}" in postmortem)
if "--write" in sys.argv:
    cumulative = [round(rate_during_bug * sum(total[BAD_START:BAD_START + m]) / budget, 4) for m in range(0, 51)]
    save_json("incident.json", {
        "deployMinute": 0, "pageMinute": page_min - BAD_START, "ackMinute": page_min + ACK - BAD_START,
        "rollbackTagMinute": rollback_min - BAD_START, "recoveredMinute": events[-1][0] - BAD_START,
        "ttd": ttd, "ttm": ttm, "cumulative": cumulative,
        "scenarios": {
            "none": {"recovered": scenarios_minutes[0] - BAD_START, "share": round(values[0], 3)},
            "hand": {"recovered": scenarios_minutes[1] - BAD_START, "share": round(values[1], 3)},
            "one": {"recovered": scenarios_minutes[2] - BAD_START, "share": round(values[2], 3)},
        },
    })
print("ok")
