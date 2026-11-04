"""Reading, checking and comparing data contracts (see contracts/*.yaml).

A contract states what the producer promises. Checking a dataset against it, and classifying a change between two
versions of it as breaking or not, are both plain functions here. The classification is written from the point of
view of a consumer that reads the data. It is this course's rule set, not a standard.
"""

from __future__ import annotations

from pathlib import Path

import duckdb
import yaml

import dqrules

HERE = Path(__file__).parent


class ContractError(Exception):
    """Raised when a batch must be rejected before it is loaded."""


def load(name: str) -> dict:
    return yaml.safe_load((HERE / "contracts" / name).read_text(encoding="utf-8"))


def check_schema(con: duckdb.DuckDBPyConnection, contract: dict, table: str | None = None) -> list[str]:
    """Differences between the table and the contract's schema, as readable sentences. Empty means it conforms."""
    table = table or contract["dataset"]
    actual = dict(con.execute(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ?", [table]
    ).fetchall())
    problems = []
    for col in contract["schema"]:
        name = col["name"]
        if name not in actual:
            problems.append(f"column {name} is missing")
            continue
        if actual[name] != col["type"]:
            problems.append(f"column {name} is {actual[name]}, contract says {col['type']}")
        if not col.get("nullable", True):
            nulls = con.execute(f'SELECT count(*) FROM {table} WHERE "{name}" IS NULL').fetchone()[0]
            if nulls:
                problems.append(f"column {name} must not be null but has {nulls} nulls")
        if col.get("unique"):
            extra = con.execute(f'SELECT count(*) - count(DISTINCT "{name}") FROM {table}').fetchone()[0]
            if extra:
                problems.append(f"column {name} must be unique but has {extra} extra rows")
        if "allowed" in col:
            marks = ",".join("?" for _ in col["allowed"])
            off = con.execute(f'SELECT count(*) FROM {table} WHERE "{name}" NOT IN ({marks})', col["allowed"]).fetchone()[0]
            if off:
                problems.append(f"column {name} has {off} values outside {col['allowed']}")
    declared = {c["name"] for c in contract["schema"]}
    for name in actual:
        if name not in declared:
            problems.append(f"column {name} is not in the contract")
    return problems


def check_quality(con: duckdb.DuckDBPyConnection, contract: dict) -> list[dqrules.Result]:
    wanted = set(contract["quality"]["rules"])
    return dqrules.run(con, [r for r in dqrules.RULES if r.id in wanted])


def freshness_hours(con: duckdb.DuckDBPyConnection, contract: dict, as_of) -> float:
    f = contract["freshness"]
    seconds = con.execute(
        f"SELECT epoch(TIMESTAMP '{as_of:%Y-%m-%d %H:%M:%S}') - epoch(max({f['column']})) FROM {contract['dataset']}"
    ).fetchone()[0]
    return seconds / 3600


def diff(old: dict, new: dict) -> list[tuple[str, str]]:
    """List (change, class) between two contract versions. class is 'breaking', 'review' or 'safe' for a consumer."""
    a = {c["name"]: c for c in old["schema"]}
    b = {c["name"]: c for c in new["schema"]}
    changes: list[tuple[str, str]] = []
    removed = [n for n in a if n not in b]
    added = [n for n in b if n not in a]
    # A removed column and an added column with the same type look like a rename.
    for gone in list(removed):
        twin = next((n for n in added if b[n]["type"] == a[gone]["type"] and b[n].get("nullable") == a[gone].get("nullable")), None)
        if twin:
            changes.append((f"{gone} renamed to {twin}", "breaking"))
            removed.remove(gone)
            added.remove(twin)
    for n in removed:
        changes.append((f"column {n} removed", "breaking"))
    for n in added:
        nullable = b[n].get("nullable", True)
        changes.append((f"column {n} added ({'optional' if nullable else 'required'})", "safe"))
    for n in (n for n in a if n in b):
        x, y = a[n], b[n]
        if x["type"] != y["type"]:
            changes.append((f"{n} type {x['type']} -> {y['type']}", "breaking"))
        if not x.get("nullable", True) and y.get("nullable", True):
            changes.append((f"{n} may now be null", "breaking"))
        if x.get("nullable", True) and not y.get("nullable", True):
            changes.append((f"{n} is now never null", "safe"))
        if set(y.get("allowed", [])) - set(x.get("allowed", [])) and "allowed" in x:
            new_values = sorted(set(y["allowed"]) - set(x["allowed"]))
            changes.append((f"{n} gains values {new_values}", "review"))
        if set(x.get("allowed", [])) - set(y.get("allowed", [])) and "allowed" in y:
            changes.append((f"{n} loses allowed values", "safe"))
    return changes


def enforce_on_ingest(batch_columns: dict[str, str], contract: dict) -> None:
    """Reject a batch before loading when its columns or types do not match the contract."""
    problems = []
    for col in contract["schema"]:
        if col["name"] not in batch_columns:
            problems.append(f"missing column {col['name']}")
        elif batch_columns[col["name"]] != col["type"]:
            problems.append(f"{col['name']} arrived as {batch_columns[col['name']]}, expected {col['type']}")
    if problems:
        raise ContractError("; ".join(problems))


REQUIRED_TOP = ("dataset", "version", "owner", "consumers", "purpose", "schema", "on_breach")


def lint_definition(contract: dict) -> list[str]:
    """Problems in the contract file itself, before any data is looked at.

    Contracts are written by people and are not reviewed by a central team, so the contract is checked by code in
    continuous integration: the required top-level fields exist, and every column has a name, a type and a description.
    """
    problems = [f"missing {key}" for key in REQUIRED_TOP if not contract.get(key)]
    for i, col in enumerate(contract.get("schema") or []):
        label = col.get("name", f"column #{i + 1}")
        for key in ("name", "type", "description"):
            if not col.get(key):
                problems.append(f"{label}: missing {key}")
    return problems


def release_gate(old: dict, new: dict) -> list[str]:
    """Reasons to refuse releasing `new` over `old`. Empty means the release may go ahead.

    A breaking change is allowed, but only as a new version, so consumers can be moved over on a plan. Releasing it
    under the old version number would change the promise for everyone at once.
    """
    breaking = [change for change, kind in diff(old, new) if kind == "breaking"]
    reasons = []
    if breaking and new["version"] <= old["version"]:
        reasons.append(f"{len(breaking)} breaking change(s) but version stays {new['version']}: bump the version")
    return reasons


def slis(con: duckdb.DuckDBPyConnection, contract: dict, within_hours: int = 24) -> dict[str, float]:
    """Two service level indicators measured on the data, as percentages over all rows.

    completeness: rows where every column the contract says is not null is filled in.
    timeliness: rows that reached the warehouse within `within_hours` of the order being placed.
    """
    table = contract["dataset"]
    required = [c["name"] for c in contract["schema"] if not c.get("nullable", True)]
    all_filled = " AND ".join(f'"{n}" IS NOT NULL' for n in required)
    complete, on_time, total = con.execute(
        f"SELECT count(*) FILTER (WHERE {all_filled}), "
        f"count(*) FILTER (WHERE ingested_at - order_ts <= INTERVAL {within_hours} HOUR), count(*) FROM {table}"
    ).fetchone()
    return {"completeness_percent": 100 * complete / total, "timeliness_percent": 100 * on_time / total}
