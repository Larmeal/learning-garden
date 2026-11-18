"""Lesson 10: the life of personal data. Consent, purpose, retention and erasure across tables, derived data, an export and a backup, with a lineage graph to find every copy.

Asserts, on a small platform in SQLite, that a marketing query uses only people who gave consent for that purpose and not those who withdrew it, that a retention job removes
events older than 90 days, that deleting a user from the users table alone leaves the user in 4 other places, that walking a lineage graph finds all of them and a request
for access returns every row, and that a backup still holds the person until an erasure log is applied on restore. `--write` saves the graph and the counts for the lab.
"""

import datetime as dt
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dslab import check, done, show  # noqa: E402
from people import population  # noqa: E402

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "site" / "src" / "components" / "labs" / "data-security" / "lifecycle.json"

TODAY = dt.date(2026, 11, 18)
people = population(200)
db = sqlite3.connect(":memory:")
db.executescript("""
CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT);
CREATE TABLE consents (user_id INTEGER, purpose TEXT, granted TEXT, withdrawn TEXT);
CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER, amount INTEGER, day TEXT);
CREATE TABLE events (id INTEGER PRIMARY KEY, user_id INTEGER, kind TEXT, day TEXT);
CREATE TABLE customer_360 (user_id INTEGER, orders_total INTEGER, events_count INTEGER);
CREATE TABLE partner_export (user_id INTEGER, email TEXT);
""")
for p in people:
    db.execute("INSERT INTO users VALUES (?,?)", (p.pid, p.email))
    db.execute("INSERT INTO consents VALUES (?,?,?,?)", (p.pid, "service", "2025-01-01", None))
    if p.pid % 3 != 0:
        db.execute("INSERT INTO consents VALUES (?,?,?,?)", (p.pid, "marketing", "2025-03-01", "2026-06-01" if p.pid % 7 == 0 else None))
    for k in range(3):
        db.execute("INSERT INTO orders (user_id, amount, day) VALUES (?,?,?)", (p.pid, 100 + (p.pid * 13 + k * 7) % 900, (TODAY - dt.timedelta(days=(p.pid * 5 + k * 40) % 400)).isoformat()))
    for k in range(5):
        db.execute("INSERT INTO events (user_id, kind, day) VALUES (?,?,?)", (p.pid, "view", (TODAY - dt.timedelta(days=(p.pid * 3 + k * 37) % 300)).isoformat()))
db.execute("INSERT INTO customer_360 SELECT u.id, (SELECT sum(amount) FROM orders o WHERE o.user_id = u.id), (SELECT count(*) FROM events e WHERE e.user_id = u.id) FROM users u")
db.execute("INSERT INTO partner_export SELECT id, email FROM users WHERE id % 2 = 0")
snapshot = {t: db.execute(f"SELECT * FROM {t}").fetchall() for t in ("users", "consents", "orders", "events", "customer_360", "partner_export")}  # the backup tape

# ---- 1. consent and purpose ----
marketing = db.execute("SELECT count(DISTINCT user_id) FROM consents WHERE purpose = 'marketing' AND withdrawn IS NULL").fetchone()[0]
withdrawn = db.execute("SELECT count(DISTINCT user_id) FROM consents WHERE purpose = 'marketing' AND withdrawn IS NOT NULL").fetchone()[0]
never = 200 - db.execute("SELECT count(DISTINCT user_id) FROM consents WHERE purpose = 'marketing'").fetchone()[0]
show("marketing consent", {"may be contacted": marketing, "withdrew": withdrawn, "never asked or refused": never})
check("200 users: 115 may be used for marketing, 19 withdrew their consent and 66 never gave it", (marketing, withdrawn, never) == (115, 19, 66))
sent = db.execute("SELECT count(*) FROM users u JOIN consents c ON c.user_id = u.id AND c.purpose = 'marketing' AND c.withdrawn IS NULL").fetchone()[0]
check("a campaign built by joining the consent table reaches only the users with an active marketing consent", sent == marketing)
check("a campaign built from the users table alone would reach all 200, which is 85 people who did not agree (or who withdrew)", 200 - marketing == 85)

# ---- 2. retention ----
cutoff = (TODAY - dt.timedelta(days=90)).isoformat()
before = db.execute("SELECT count(*) FROM events").fetchone()[0]
old = db.execute("SELECT count(*) FROM events WHERE day < ?", (cutoff,)).fetchone()[0]
db.execute("DELETE FROM events WHERE day < ?", (cutoff,))
after = db.execute("SELECT count(*) FROM events").fetchone()[0]
show("retention of events: keep 90 days", {"before": before, "older than 90 days": old, "after": after})
check("the job removes exactly the events older than 90 days (the number it counted before)", before - after == old and old > 0)
check("what the job did not touch: customer_360 still holds an events_count computed from the old events", db.execute("SELECT sum(events_count) FROM customer_360").fetchone()[0] == before)

# ---- 3. a request for erasure: the naive way and the lineage way ----
UID = db.execute("SELECT min(id) FROM users WHERE id % 2 = 0 AND id IN (SELECT user_id FROM events)").fetchone()[0]  # the first even user who still has events after the retention job (so also in the partner export)
show("the user of the erasure request", UID)
EDGES = {"users": ["customer_360", "partner_export"], "orders": ["customer_360"], "events": ["customer_360"], "consents": []}
PLACES = ["users", "consents", "orders", "events", "customer_360", "partner_export"]


def holds(uid: int):
    return {t: db.execute(f"SELECT count(*) FROM {t} WHERE {'id' if t == 'users' else 'user_id'} = ?", (uid,)).fetchone()[0] for t in PLACES}


start = holds(UID)
show("rows of the user before the request", start)
check("the user has rows in 6 places at the start (users, consents, orders, events, the derived table and the partner export)", sum(1 for v in start.values() if v) == 6)

db.execute("DELETE FROM users WHERE id = ?", (UID,))
naive = holds(UID)
show("after deleting from the users table only", naive)
check("deleting from the users table alone leaves the user in 5 other places (consents, orders, events, customer_360, partner_export)", sum(1 for t, v in naive.items() if v) == 5 and naive["users"] == 0)


def erase(uid: int):
    """Walk the lineage graph from the source tables and delete the user wherever data derived from them lives."""
    seen, stack = set(), ["users", "orders", "events", "consents"]
    while stack:
        node = stack.pop()
        if node in seen:
            continue
        seen.add(node)
        stack.extend(EDGES.get(node, []))
    for t in sorted(seen):
        db.execute(f"DELETE FROM {t} WHERE {'id' if t == 'users' else 'user_id'} = ?", (uid,))
    return sorted(seen)


visited = erase(UID)
after_erase = holds(UID)
check("the lineage walk reaches all 6 tables", len(visited) == 6)
check("after it, no live table holds the user", sum(after_erase.values()) == 0)

# ---- 4. the backup tape ----
backup_rows = sum(1 for r in snapshot["orders"] if r[1] == UID) + sum(1 for r in snapshot["events"] if r[1] == UID) + sum(1 for r in snapshot["users"] if r[0] == UID)
check("the backup taken earlier still holds the user: 3 orders, events and the user row, which a delete on the live database cannot reach", backup_rows >= 4)
erasure_log = [UID]  # kept, with no other data about the person, so it can be re-applied


IDX = {"users": 0, "consents": 0, "orders": 1, "events": 1, "customer_360": 0, "partner_export": 0}  # the position of the user id in each table


def restore(snap, log):
    return {t: [r for r in rows if r[IDX[t]] not in log] for t, rows in snap.items()}


restored = restore(snapshot, erasure_log)
check("restoring the tape and then applying the erasure log removes the user from every restored table", all(not [r for r in rows if r[IDX[t]] == UID] for t, rows in restored.items()))
check("and it removed that user's rows in every one of the 6 tables of the tape (they were there before)", all(any(r[IDX[t]] == UID for r in snapshot[t]) for t in PLACES))
check("a restore without the log would bring the user back (the tape is unchanged)", all(any(r[IDX[t]] == UID for r in snapshot[t]) for t in PLACES))

# ---- 5. a request for access ----
db2_rows = {t: len([r for r in snapshot[t] if r[IDX[t]] == 4]) for t in PLACES}
check("the same lineage tells what to return when a person asks for a copy of their data: user 4 has rows in 6 places", sum(1 for v in db2_rows.values() if v) == 6)

if "--write" in sys.argv:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"edges": EDGES, "places": PLACES, "start": start, "naive": naive, "lineage": after_erase, "backup": backup_rows, "consent": {"yes": marketing, "withdrew": withdrawn, "never": never}, "retention": {"before": before, "removed": old, "after": after}}, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")
done()
