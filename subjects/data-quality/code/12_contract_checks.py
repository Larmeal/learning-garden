"""Lesson: agreements, contracts in practice. Check the contract file, gate a release, measure two SLIs.

1. Lint the contract definition itself (a file written by people can be wrong before any data is involved).
2. Gate a release: a breaking change needs a new version number.
3. Measure completeness and timeliness on the data and compare them with an SLO.

Run: uv run python 12_contract_checks.py
"""

import copy

import dqcontract
import dqlab

con = dqlab.connect()
v1 = dqcontract.load("orders.v1.yaml")
v2 = dqcontract.load("orders.v2.yaml")

print("== 1. is the contract file itself valid? ==")
for name, c in (("v1", v1), ("v2", v2)):
    problems = dqcontract.lint_definition(c)
    print(f"  {name}: {len(problems)} problems")
    assert problems == [], problems

# A contract somebody edited carelessly: the owner was dropped and two descriptions were left empty.
careless = copy.deepcopy(v1)
del careless["owner"]
careless["schema"][1]["description"] = ""
del careless["schema"][4]["description"]
problems = dqcontract.lint_definition(careless)
for p in problems:
    print("  careless:", p)
assert problems == ["missing owner", "customer_id: missing description", "status: missing description"], problems

print("\n== 2. may this version be released? ==")
reasons = dqcontract.release_gate(v1, v2)
print(f"  v1 -> v2 (version {v1['version']} -> {v2['version']}): {'refused: ' + '; '.join(reasons) if reasons else 'allowed'}")
assert reasons == []
sneaky = copy.deepcopy(v2)
sneaky["version"] = v1["version"]
reasons = dqcontract.release_gate(v1, sneaky)
print(f"  same changes, version left at {sneaky['version']}: refused: {'; '.join(reasons)}")
assert reasons == ["3 breaking change(s) but version stays 1: bump the version"], reasons
quiet = copy.deepcopy(v1)
quiet["schema"].append({"name": "channel", "type": "VARCHAR", "nullable": True, "description": "Sales channel."})
reasons = dqcontract.release_gate(v1, quiet)
print(f"  only an optional column added, version left at {quiet['version']}: {'refused' if reasons else 'allowed'}")
assert reasons == []

print("\n== 3. two SLIs against an SLO ==")
measured = dqcontract.slis(con, v1)
slo = {"completeness_percent": 100.0, "timeliness_percent": 99.0}   # numbers written for this course
for key, value in measured.items():
    print(f"  {key}: measured {value:.2f}, objective {slo[key]} -> {'ok' if value >= slo[key] else 'BREACH'}")
assert round(measured["completeness_percent"], 2) == 99.50      # 15 of 3,020 rows have no customer_id
assert round(measured["timeliness_percent"], 2) == 98.68        # 40 of 3,020 rows arrived after 24 h
assert all(measured[k] < slo[k] for k in slo)
