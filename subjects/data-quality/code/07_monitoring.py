"""Lesson: monitoring. Detectors for freshness, volume and null rate, scored with precision and recall.

Tests catch the problems you thought of. Monitoring catches deviation from what the data usually does (DQF chapter 4).
A detector is a query plus a parameter, and the parameter decides what counts as an alert, so every choice trades
false alarms against missed incidents.

The series are SYNTHETIC: 120 days of a daily load with a weekly cycle and incidents planted on known days, so the
true answer is known and detectors can be scored. The first 28 days are clean and serve as the calibration window.

Run: uv run python 07_monitoring.py            (prints the evaluation)
     uv run python 07_monitoring.py --write    (also writes the JSON that the threshold lab reads)
"""

import json
import random
import statistics
import sys
from datetime import date, timedelta
from pathlib import Path

DAYS = 120
CAL = 28  # calibration window: days 0..27 contain no incident
START = date(2026, 7, 1)  # a Wednesday
BASE = {0: 1000, 1: 1000, 2: 1000, 3: 1000, 4: 1000, 5: 520, 6: 430}  # rows per weekday, Monday = 0

VOLUME_DROPS = [35, 50, 64, 79, 94, 100]  # rows are cut to 40% of normal (94 is a Saturday)
INCIDENT_GAPS = [(42, 2), (71, 3), (108, 4)]  # (first day, days with no load at all)
BENIGN_GAPS = [(30, 1), (57, 1), (85, 2)]  # planned pauses: no load, but not incidents
NULL_SPIKES = {38: 0.35, 55: 0.52, 83: 0.60, 84: 0.58, 92: 0.20, 105: 0.30}  # share of null customer_id on that day


def build() -> dict:
    rng = random.Random(777)
    weekday = [(START + timedelta(i)).weekday() for i in range(DAYS)]
    rows = [max(0, round(rng.gauss(BASE[w], 0.04 * BASE[w]))) for w in weekday]
    for d in VOLUME_DROPS:
        rows[d] = round(rows[d] * 0.4)
    for first, length in INCIDENT_GAPS + BENIGN_GAPS:
        for d in range(first, first + length):
            rows[d] = 0
    null_rate = [round(min(1.0, max(0.0, rng.gauss(0.06, 0.012))), 4) for _ in range(DAYS)]
    for d, v in NULL_SPIKES.items():
        null_rate[d] = v
    gaps = [{"start": s, "length": n, "incident": True} for s, n in INCIDENT_GAPS] + [
        {"start": s, "length": n, "incident": False} for s, n in BENIGN_GAPS
    ]
    return {
        "start": START.isoformat(), "days": DAYS, "calibrationDays": CAL, "weekday": weekday,
        "rows": rows, "nullRate": null_rate, "volumeIncidentDays": VOLUME_DROPS,
        "nullIncidentDays": sorted(NULL_SPIKES), "gaps": sorted(gaps, key=lambda g: g["start"]),
    }


def score(tp: int, fp: int, fn: int) -> dict:
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    f = lambda beta: (1 + beta**2) * p * r / (beta**2 * p + r) if p + r else 0.0  # noqa: E731
    return {"tp": tp, "fp": fp, "fn": fn, "precision": round(p, 4), "recall": round(r, 4), "f1": round(f(1), 4), "f2": round(f(2), 4)}


def median(values: list[float]) -> float:
    return statistics.median(values)


# ---- detectors. Each returns the set of day indexes (or gap indexes) it flags ---------------------------------------
def freshness_flags(data: dict, min_days: int) -> set[int]:
    """Flag a gap (by index) when it lasts at least min_days with no load."""
    return {i for i, g in enumerate(data["gaps"]) if g["length"] >= min_days}


def naive_volume_flags(data: dict, k: float) -> set[int]:
    cal = data["rows"][:CAL]
    mu, sd = statistics.fmean(cal), statistics.pstdev(cal)
    return {d for d in range(CAL, DAYS) if data["rows"][d] > 0 and (data["rows"][d] - mu) / sd < -k}


def weekday_volume_flags(data: dict, ratio: float) -> set[int]:
    flags = set()
    for d in range(CAL, DAYS):
        if data["rows"][d] == 0:
            continue
        prev = [data["rows"][e] for e in range(d - 7, -1, -7) if data["rows"][e] > 0][:4]
        if prev and data["rows"][d] / median(prev) < ratio:
            flags.add(d)
    return flags


def null_fixed_flags(data: dict, threshold: float) -> set[int]:
    return {d for d in range(CAL, DAYS) if data["nullRate"][d] > threshold}


def null_spc_flags(data: dict, sigmas: float) -> set[int]:
    cal = data["nullRate"][:CAL]
    limit = statistics.fmean(cal) + sigmas * statistics.pstdev(cal)
    return {d for d in range(CAL, DAYS) if data["nullRate"][d] > limit}


def null_rolling_flags(data: dict, jump: float) -> set[int]:
    flags = set()
    for d in range(CAL, DAYS):
        base = median(data["nullRate"][d - 14 : d])
        if data["nullRate"][d] - base > jump:
            flags.add(d)
    return flags


def evaluate(flags: set[int], truth: set[int], universe: set[int]) -> dict:
    return score(len(flags & truth), len(flags - truth), len(truth - flags) if truth <= universe else len((truth & universe) - flags))


def run() -> dict:
    data = build()
    cal_idx = set(range(CAL, DAYS))
    loaded = {d for d in cal_idx if data["rows"][d] > 0}
    vol_truth = set(VOLUME_DROPS)
    null_truth = set(NULL_SPIKES)
    out: dict[str, dict] = {"freshness": {}, "naive": {}, "weekday": {}, "nullFixed": {}, "nullSpc": {}, "nullRolling": {}}

    for x in range(1, 6):
        flagged = freshness_flags(data, x)
        truth = {i for i, g in enumerate(data["gaps"]) if g["incident"]}
        out["freshness"][str(x)] = score(len(flagged & truth), len(flagged - truth), len(truth - flagged))
    for k in (0.5, 1.0, 1.5, 2.0, 2.5, 3.0):
        out["naive"][str(k)] = evaluate(naive_volume_flags(data, k), vol_truth, loaded)
    for t in (0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3):
        out["weekday"][str(t)] = evaluate(weekday_volume_flags(data, t), vol_truth, loaded)
    for t in (0.9, 0.5, 0.3, 0.15, 0.1, 0.08):
        out["nullFixed"][str(t)] = evaluate(null_fixed_flags(data, t), null_truth, cal_idx)
    for s in (1, 2, 3, 4):
        out["nullSpc"][str(s)] = evaluate(null_spc_flags(data, s), null_truth, cal_idx)
    for j in (0.02, 0.05, 0.1, 0.15, 0.3):
        out["nullRolling"][str(j)] = evaluate(null_rolling_flags(data, j), null_truth, cal_idx)
    data["expected"] = out
    return data


def table(title: str, label: str, rows: dict) -> None:
    print(f"\n{title}")
    print(f"  {label:>8s} {'flag':>5s} {'TP':>3s} {'FP':>3s} {'FN':>3s} {'prec':>6s} {'recall':>7s} {'F1':>6s} {'F2':>6s}")
    for key, s in rows.items():
        print(f"  {key:>8s} {s['tp'] + s['fp']:5d} {s['tp']:3d} {s['fp']:3d} {s['fn']:3d} {s['precision']:6.2f} {s['recall']:7.2f} {s['f1']:6.2f} {s['f2']:6.2f}")


if __name__ == "__main__":
    data = run()
    exp = data["expected"]
    cal = data["rows"][:CAL]
    print(f"calibration window rows: mean {statistics.fmean(cal):.0f}, std {statistics.pstdev(cal):.0f} (one number for a series with a weekly cycle)")
    ncal = data["nullRate"][:CAL]
    mu, sd = statistics.fmean(ncal), statistics.pstdev(ncal)
    print(f"null rate in calibration window: mean {mu:.4f}, std {sd:.4f}, control limits {mu - 3 * sd:.4f} .. {mu + 3 * sd:.4f}")

    table("Freshness: flag a no-load gap lasting at least N days (3 incident gaps of 2, 3, 4 days; 3 planned gaps of 1, 1, 2 days)", "N days", exp["freshness"])
    table("Volume, naive: flag when z-score of rows < -k (one mean for all days)", "k", exp["naive"])
    table("Volume, weekday-aware: flag when rows < T x median of the same weekday over the last 4 weeks", "T", exp["weekday"])
    table("Null rate, fixed threshold: flag when null rate > t", "t", exp["nullFixed"])
    table("Null rate, control limit: flag when null rate > mean + s x std of the calibration window", "s", exp["nullSpc"])
    table("Null rate, jump over the 14-day median: flag when rate - median > j", "j", exp["nullRolling"])

    best = lambda block, key="f1": max(block.values(), key=lambda s: s[key])[key]  # noqa: E731
    print(f"\nbest F1 over the sweep: naive volume {best(exp['naive']):.2f}, weekday-aware volume {best(exp['weekday']):.2f}")
    print(f"best F2 over the sweep: naive volume {best(exp['naive'], 'f2'):.2f}, weekday-aware volume {best(exp['weekday'], 'f2'):.2f}")

    # Self-checks on what the synthetic series was built to show.
    assert exp["freshness"]["1"]["fp"] == 3 and exp["freshness"]["1"]["recall"] == 1.0
    assert exp["freshness"]["2"]["fp"] == 1 and exp["freshness"]["2"]["recall"] == 1.0
    assert exp["freshness"]["3"]["fp"] == 0 and exp["freshness"]["3"]["tp"] == 2
    assert best(exp["weekday"]) >= 0.9, "weekday-aware detector should find nearly all drops"
    assert best(exp["naive"]) <= best(exp["weekday"]) - 0.2, "seasonality should hurt the naive detector"
    assert exp["nullFixed"]["0.9"]["recall"] == 0.0, "a threshold of 90% sees none of these spikes"
    assert exp["nullFixed"]["0.15"]["f1"] == 1.0
    print("self-checks passed")

    if "--write" in sys.argv:
        target = Path(__file__).resolve().parents[3] / "site" / "src" / "components" / "labs" / "data-quality" / "monitoring.json"
        target.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        print("wrote", target)
