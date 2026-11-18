"""Lesson 8: who may see which cell. Roles, views that mask columns and filter rows, SQLite's authorizer, an audit log, and a scan of what leaves.

Asserts, on a real SQLite database, that three roles see different columns and rows of one table through views, that a role cannot read the base table directly (the
authorizer denies it), that masking keeps the shape but not the value (and that a keyed token keeps joins), that a purpose check is enforced and every query is logged,
that groups of fewer than 5 people are held back from an analyst's counts, and that a data loss prevention scan catches an e-mail, a phone number and a card number
(Luhn) in text that is about to leave. `--write` saves the views for the lab (site/src/components/labs/data-security/access.json).
"""

import hashlib
import hmac
import json
import re
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dslab import check, done, show  # noqa: E402
from people import population  # noqa: E402

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "site" / "src" / "components" / "labs" / "data-security" / "access.json"

people = population(600)
KEY = b"token-key-kept-by-the-data-platform"

db = sqlite3.connect(":memory:", cached_statements=0)  # see the pitfall in section 2
db.create_function("mask_email", 1, lambda e: e[0] + "***@" + e.split("@")[1])
db.create_function("mask_phone", 1, lambda p: p[:2] + "******" + p[-2:])
db.create_function("tok", 1, lambda s: hmac.new(KEY, s.encode(), hashlib.sha256).hexdigest()[:10])
db.create_function("band", 2, lambda v, w: f"{v // w * w}-{v // w * w + w - 1}")
db.executescript("""
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, email TEXT, phone TEXT, zip TEXT, birth TEXT, salary INTEGER, diagnosis TEXT, notes TEXT);
CREATE TABLE audit (n INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT, purpose TEXT, sql TEXT, rows INTEGER, outcome TEXT);
CREATE VIEW v_support AS SELECT id, name, mask_email(email) AS email, mask_phone(phone) AS phone, zip FROM customers WHERE substr(zip, 1, 3) IN ('101', '102', '103');
CREATE VIEW v_analyst AS SELECT tok(email) AS person, substr(zip, 1, 3) AS zip3, substr(birth, 1, 4) AS birth_year, band(salary, 10000) AS salary_band, diagnosis FROM customers;
CREATE VIEW v_admin AS SELECT * FROM customers;
""")
db.executemany("INSERT INTO customers VALUES (?,?,?,?,?,?,?,?,?)", [(p.pid, p.name, p.email, p.phone, p.zip, p.birth.isoformat(), p.salary, p.diagnosis, p.notes) for p in people])
check("600 customers are in the base table", db.execute("SELECT count(*) FROM customers").fetchone()[0] == 600)

GRANTS = {"support": {"v_support"}, "analyst": {"v_analyst"}, "admin": {"v_admin", "customers"}}
PURPOSES = {"support": {"ticket"}, "analyst": {"reporting"}, "admin": {"operations", "audit"}}
current = {"role": None}


def authorizer(action, arg1, arg2, dbname, source):
    role = current["role"]
    if role is None or action != sqlite3.SQLITE_READ:
        return sqlite3.SQLITE_OK
    if arg1 == "customers":  # the base table: only through a view that the role is granted, or directly for the admin
        return sqlite3.SQLITE_OK if (source in GRANTS[role] or "customers" in GRANTS[role]) else sqlite3.SQLITE_DENY
    if arg1 == "audit":
        return sqlite3.SQLITE_OK if role == "admin" else sqlite3.SQLITE_DENY
    return sqlite3.SQLITE_OK if arg1 in GRANTS[role] or source in GRANTS[role] else sqlite3.SQLITE_DENY


db.set_authorizer(authorizer)


def run(role: str, purpose: str, sql: str):
    current["role"] = None
    if purpose not in PURPOSES[role]:
        db.execute("INSERT INTO audit (role, purpose, sql, rows, outcome) VALUES (?,?,?,?,?)", (role, purpose, sql, 0, "refused: purpose"))
        raise PermissionError("purpose not allowed for this role")
    current["role"] = role
    try:
        cur = db.execute(sql)
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
    except sqlite3.DatabaseError as exc:
        current["role"] = None
        db.execute("INSERT INTO audit (role, purpose, sql, rows, outcome) VALUES (?,?,?,?,?)", (role, purpose, sql, 0, f"denied: {exc}"))
        raise PermissionError(str(exc)) from exc
    current["role"] = None
    db.execute("INSERT INTO audit (role, purpose, sql, rows, outcome) VALUES (?,?,?,?,?)", (role, purpose, sql, len(rows), "ok"))
    return cols, rows


# ---- 1. the same table, three different views ----
cols_admin, rows_admin = run("admin", "operations", "SELECT * FROM v_admin")
cols_sup, rows_sup = run("support", "ticket", "SELECT * FROM v_support")
cols_an, rows_an = run("analyst", "reporting", "SELECT * FROM v_analyst")
show("columns and rows per role", {"admin": (len(cols_admin), len(rows_admin)), "support": (len(cols_sup), len(rows_sup)), "analyst": (len(cols_an), len(rows_an))})
check("admin sees 9 columns and all 600 rows", (len(cols_admin), len(rows_admin)) == (9, 600))
check("support sees 5 columns and only the rows of three zip areas (row level filter)", len(cols_sup) == 5 and len(rows_sup) == sum(1 for p in people if p.zip[:3] in ("101", "102", "103")) and len(rows_sup) < 600)
check("analyst sees 5 columns, all 600 rows, and no name, e-mail or phone", cols_an == ["person", "zip3", "birth_year", "salary_band", "diagnosis"] and len(rows_an) == 600)
check("support's e-mail is masked: first letter, three stars and the domain", re.fullmatch(r"[a-z]\*\*\*@\w+\.test", rows_sup[0][cols_sup.index("email")]) is not None)
check("support's phone is masked: first 2 and last 2 digits remain", re.fullmatch(r"08\*{6}\d\d", rows_sup[0][cols_sup.index("phone")]) is not None)
check("salary is shown as a 10,000 band, not the exact figure", re.fullmatch(r"\d+-\d+", rows_an[0][3]) is not None)

# ---- 2. the authorizer stops a direct read of the base table ----
def denied(role, purpose, sql):
    try:
        run(role, purpose, sql)
        return False
    except PermissionError:
        return True


check("the analyst cannot read the base table directly (SELECT * FROM customers is denied)", denied("analyst", "reporting", "SELECT * FROM customers"))
check("the analyst cannot reach the same columns through a sub query on the base table either", denied("analyst", "reporting", "SELECT name FROM (SELECT * FROM customers)"))
check("support cannot read the analyst's view", denied("support", "ticket", "SELECT * FROM v_analyst"))
check("nobody but the admin can read the audit table", denied("support", "ticket", "SELECT * FROM audit") and not denied("admin", "audit", "SELECT count(*) FROM audit"))

# ---- 2b. a pitfall: the authorizer runs when a statement is compiled, and Python caches compiled statements ----
def pitfall(cached: int):
    d = sqlite3.connect(":memory:", cached_statements=cached)
    d.executescript("CREATE TABLE secret (v); INSERT INTO secret VALUES ('x');")
    who = {"role": "owner"}
    d.set_authorizer(lambda a, x, y, db_, src: sqlite3.SQLITE_DENY if (a == sqlite3.SQLITE_READ and x == "secret" and who["role"] != "owner") else sqlite3.SQLITE_OK)
    d.execute("SELECT v FROM secret").fetchall()  # compiled and cached while the owner is asking
    who["role"] = "guest"
    try:
        d.execute("SELECT v FROM secret").fetchall()  # the same text again, now asked by a guest
        return "read"
    except sqlite3.DatabaseError:
        return "denied"


check("with Python's default statement cache a guest who sends the same text as the owner reads the table (the check ran for the owner, not again)", pitfall(128) == "read")
check("with cached_statements=0 every statement is compiled again, the authorizer runs for the guest and the read is denied", pitfall(0) == "denied")

# ---- 3. purpose limitation ----
check("the analyst asking with the purpose 'marketing' is refused before any query runs", denied("analyst", "marketing", "SELECT * FROM v_analyst"))

# ---- 4. a keyed token keeps joins between two views, a mask does not ----
tokens_a = {r[0] for r in rows_an}
cols_a2, rows_a2 = run("analyst", "reporting", "SELECT person FROM v_analyst")
check("the person token is the same in two queries, so an analyst can follow a person across tables without knowing who it is", {r[0] for r in rows_a2} == tokens_a and len(tokens_a) == 600)
masked_emails = [r[cols_sup.index("email")] for r in rows_sup]
check("masked e-mails are not unique (different people share 'a***@mail.test'), so a mask cannot be used to join", len(set(masked_emails)) < len(masked_emails))

# ---- 5. small groups are held back from aggregates ----
def analyst_counts(group: str, k: int = 5):
    cols, rows = run("analyst", "reporting", f"SELECT {group}, count(*) FROM v_analyst GROUP BY {group}")
    shown = [r for r in rows if r[-1] >= k]
    return shown, len(rows) - len(shown)

shown, held = analyst_counts("zip3, birth_year, diagnosis")
check("grouping by zip area, birth year and diagnosis gives many groups of 1 to 4 people, which are held back", held > 0 and all(r[-1] >= 5 for r in shown))
shown2, held2 = analyst_counts("diagnosis")
check("grouping by diagnosis only gives groups of more than 5 people, so nothing is held back", held2 == 0 and len(shown2) == 7)
show("held back", {"zip3+birth_year+diagnosis": held, "diagnosis": held2})

# ---- 6. what leaves: a scan for e-mails, phone numbers and card numbers ----
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
PHONE = re.compile(r"\b0[689]\d{8}\b")
CARD = re.compile(r"\b(?:\d[ -]?){13,19}\b")


def luhn(number: str) -> bool:
    digits = [int(c) for c in re.sub(r"\D", "", number)][::-1]
    return len(digits) >= 13 and sum(d if i % 2 == 0 else (d * 2 - 9 if d * 2 > 9 else d * 2) for i, d in enumerate(digits)) % 10 == 0


def dlp(rows):
    hits = []
    for row in rows:
        for cell in row:
            text = str(cell)
            if EMAIL.search(text):
                hits.append("email")
            if PHONE.search(text):
                hits.append("phone")
            for m in CARD.findall(text):
                if luhn(m):
                    hits.append("card")
    return hits


check("the support export (masked) passes the scan: no raw e-mail, phone or card in it", dlp(rows_sup) == [])
cols_n, rows_n = run("admin", "operations", "SELECT id, notes FROM v_admin WHERE notes != ''")
hits = dlp(rows_n)
show("admin export of the notes column", {h: hits.count(h) for h in set(hits)})
check("the notes column holds raw phone numbers and e-mails and the scan stops the export (over 50 hits)", hits.count("phone") + hits.count("email") > 50)
check("a card number with a correct Luhn check digit is caught (4539 1488 0343 6467) and one with a wrong digit is not (…6468)", dlp([("pay with 4539 1488 0343 6467",)]) == ["card"] and dlp([("pay with 4539 1488 0343 6468",)]) == [])

# ---- 7. the audit log ----
n_ok = db.execute("SELECT count(*) FROM audit WHERE outcome = 'ok'").fetchone()[0]
n_refused = db.execute("SELECT count(*) FROM audit WHERE outcome != 'ok'").fetchone()[0]
show("audit", {"ok": n_ok, "refused or denied": n_refused})
check("every query was logged, the refused ones too: 8 answered and 5 refused or denied (4 denied by the authorizer and 1 by the purpose check)", (n_ok, n_refused) == (8, 5))

if "--write" in sys.argv:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    cut = lambda cols, rows: {"columns": cols, "rows": [list(map(str, r)) for r in rows[:5]], "count": len(rows)}  # noqa: E731
    OUT.write_text(json.dumps({"admin": cut(cols_admin, rows_admin), "support": cut(cols_sup, rows_sup), "analyst": cut(cols_an, rows_an), "heldBack": held, "dlpHits": len(hits)}, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")
done()
