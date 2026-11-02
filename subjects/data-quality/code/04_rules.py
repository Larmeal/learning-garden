"""Lesson: rule-design. A rule is a query plus an owner, a threshold, an impact and a confirmation.

Runs the 14 registered rules, reports each one the DMBOK2 Table 30 way (share that conforms and share that does not),
compares the result with an acceptability threshold, lints the registry, and shows a rule that lint rejects.

Run: uv run python 04_rules.py
"""

from dataclasses import replace

import dqlab
import dqrules

con = dqlab.connect()
results = dqrules.run(con)

print(f"{'rule':24s} {'dimension':12s} {'sev':5s} {'status':9s} {'bad':>5s} {'total':>6s} {'bad%':>6s} {'max%':>5s}  verdict")
for r in results:
    verdict = "pass" if r.passed else "FAIL"
    print(
        f"{r.rule.id:24s} {r.rule.dimension:12s} {r.rule.severity:5s} {r.rule.status:9s} "
        f"{r.bad:5d} {r.total:6d} {r.bad_pct:6.2f} {r.rule.max_bad_pct:5.1f}  {verdict}"
    )

print("\nSelf-check: every rule finds exactly what was planted")
dqrules.ensure_planted(results)

# The same measurement can pass or fail depending on the threshold. The threshold is a business decision.
dup = next(r for r in results if r.rule.id == "CUST-EMAIL-UNIQUE")
print(f"\n{dup.rule.id}: {dup.bad_pct:.2f}% duplicate emails")
for limit in (0.0, 0.5, 2.0, 5.0):
    print(f"  threshold {limit:>4.1f}% -> {'pass' if dup.bad_pct <= limit else 'FAIL'}")

# Which failing rules may stop a pipeline? Only active rules with severity 'error'.
failing = [r for r in results if not r.passed]
blocking = dqrules.gating(results)
print(f"\nfailing rules: {len(failing)}, of which can block publishing: {len(blocking)}")
for r in blocking:
    print(f"  blocks: {r.rule.id} ({r.rule.owner}) impact: {r.rule.impact}")
proposed = [r for r in results if r.rule.status == "proposed" and not r.passed]
print("failing but only proposed (reported, never blocking):", [r.rule.id for r in proposed])

# Lint the registry, then show what a careless rule looks like.
print("\n== lint ==")
problems = {r.id: dqrules.lint(r) for r in dqrules.RULES}
assert all(not p for p in problems.values()), problems
print(f"all {len(dqrules.RULES)} registered rules are well formed")

careless = replace(
    dqrules.RULES[0], id="MKT-MAGIC", dimension="goodness", owner="", impact="", max_bad_pct=150, confirmed_by=None,
)
found = dqrules.lint(careless)
for p in found:
    print("  MKT-MAGIC:", p)
assert len(found) == 5

# Counting by dimension and by owner shows who gets paged, and what is covered.
print("\n== coverage ==")
for key in ("dimension", "owner", "origin"):
    tally: dict[str, int] = {}
    for r in dqrules.RULES:
        tally[getattr(r, key)] = tally.get(getattr(r, key), 0) + 1
    print(f"by {key}: {dict(sorted(tally.items()))}")
