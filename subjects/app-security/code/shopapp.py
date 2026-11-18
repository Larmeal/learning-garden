"""The capstone app: a tiny shop with ten planted flaws, each one a switch.

`ShopApp(fixed={...})` turns a fix on by name. With no fixes, every exploit in `EXPLOITS` works. With all of them, none does and
the honest flows still work. Everything runs in this process on an in-memory SQLite database. It is a teaching app: do not copy it.
"""

from __future__ import annotations

import hashlib
import hmac
import html
import itertools
import secrets
import sqlite3
import time
from dataclasses import dataclass, field

FIXES = [
    "sqli", "password_hash", "session_id", "idor", "mass_assignment",
    "xss", "csrf", "error_detail", "rate_limit", "secret_in_code",
]

# a secret written into the source on purpose, so the scanner of lesson 11 has something to find
SIGNING_KEY_IN_CODE = "AKIAIOSFODNN7EXAMPLE"


@dataclass
class Resp:
    status: int
    body: str = ""
    cookie: str | None = None


@dataclass
class ShopApp:
    fixed: set[str] = field(default_factory=set)

    def __post_init__(self):
        self.db = sqlite3.connect(":memory:")
        self.db.executescript(
            """
            CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT UNIQUE, pw TEXT, role TEXT, email TEXT, salt TEXT);
            CREATE TABLE orders (id INTEGER PRIMARY KEY, owner TEXT, item TEXT, total INTEGER);
            CREATE TABLE reviews (id INTEGER PRIMARY KEY, item TEXT, author TEXT, text TEXT);
            INSERT INTO orders VALUES (101, 'ann', 'pen', 20), (102, 'bob', 'bag', 900);
            """
        )
        self.sessions: dict[str, dict] = {}
        self.counter = itertools.count(1000)
        self.fails: dict[str, int] = {}
        self.register("ann", "pw-ann")
        self.register("bob", "pw-bob")
        self.db.execute("UPDATE users SET role='admin' WHERE name='bob'")  # bob is the admin; ann is a normal user

    # --- helpers ---
    def on(self, fix: str) -> bool:
        return fix in self.fixed

    def _hash(self, pw: str, salt: str) -> str:
        if self.on("password_hash"):
            return hashlib.scrypt(pw.encode(), salt=salt.encode(), n=2**12, r=8, p=1).hex()
        return hashlib.sha256(pw.encode()).hexdigest()

    def register(self, name: str, pw: str, extra: dict | None = None) -> Resp:
        salt = secrets.token_hex(8)
        self.db.execute("INSERT INTO users (name, pw, role, email, salt) VALUES (?, ?, 'user', ?, ?)", (name, self._hash(pw, salt), f"{name}@shop.test", salt))
        if extra and not self.on("mass_assignment"):
            for k, v in extra.items():
                if k in {"role", "email"}:
                    self.db.execute(f"UPDATE users SET {k}=? WHERE name=?", (v, name))
        return Resp(201)

    def _new_sid(self) -> str:
        return secrets.token_urlsafe(32) if self.on("session_id") else str(next(self.counter))

    def _user(self, cookie: str | None) -> dict | None:
        return self.sessions.get(cookie or "")

    # --- routes ---
    def login(self, name: str, pw: str) -> Resp:
        if self.on("rate_limit") and self.fails.get(name, 0) >= 5:
            return Resp(429, "too many attempts")
        row = self.db.execute("SELECT name, role, pw, salt FROM users WHERE name=?", (name,)).fetchone()
        if not (row and hmac.compare_digest(row[2], self._hash(pw, row[3]))):
            self.fails[name] = self.fails.get(name, 0) + 1
            return Resp(401, "wrong name or password")
        sid = self._new_sid()
        self.sessions[sid] = {"user": row[0], "role": row[1], "csrf": secrets.token_urlsafe(16)}
        self.fails[name] = 0
        return Resp(200, "ok", cookie=sid)

    def order_text(self, cookie: str | None, raw_id: str) -> Resp:
        """The same lookup as order(), but the id comes in as text from the URL, so it can fail to parse."""
        sql = "SELECT owner, item, total FROM orders WHERE id=" + raw_id
        try:
            return self.order(cookie, int(raw_id))
        except ValueError as exc:
            return Resp(500, "server error" if self.on("error_detail") else f"{exc!r} while building: {sql}")

    def order(self, cookie: str | None, order_id: int) -> Resp:
        u = self._user(cookie)
        if not u:
            return Resp(401)
        row = self.db.execute("SELECT owner, item, total FROM orders WHERE id=?", (order_id,)).fetchone()
        if not row:
            return Resp(404)
        if self.on("idor") and row[0] != u["user"] and u["role"] != "admin":
            return Resp(403)
        return Resp(200, f"{row[1]} {row[2]} (owner {row[0]})")

    def update_profile(self, cookie: str | None, body: dict, csrf: str | None = None, origin: str = "https://shop.test") -> Resp:
        u = self._user(cookie)
        if not u:
            return Resp(401)
        if self.on("csrf") and (origin != "https://shop.test" or csrf != u["csrf"]):
            return Resp(403, "csrf")
        allowed = {"email"} if self.on("mass_assignment") else {"email", "role"}
        for k, v in body.items():
            if k in allowed:
                self.db.execute(f"UPDATE users SET {k}=? WHERE name=?", (v, u["user"]))
                if k == "role":
                    u["role"] = v
        return Resp(200, "saved")

    def add_review(self, cookie: str | None, item: str, text: str) -> Resp:
        u = self._user(cookie)
        if not u:
            return Resp(401)
        self.db.execute("INSERT INTO reviews (item, author, text) VALUES (?, ?, ?)", (item, u["user"], text))
        return Resp(201)

    def product_page(self, item: str) -> Resp:
        rows = self.db.execute("SELECT author, text FROM reviews WHERE item=?", (item,)).fetchall()
        render = html.escape if self.on("xss") else (lambda s: s)
        return Resp(200, "<ul>" + "".join(f"<li>{render(a)}: {render(t)}</li>" for a, t in rows) + "</ul>")

    def search(self, term: str) -> Resp:
        if self.on("sqli"):
            return Resp(200, str(self.db.execute("SELECT item, total FROM orders WHERE item LIKE ?", (f"%{term}%",)).fetchall()))
        sql = f"SELECT item, total FROM orders WHERE item LIKE '%{term}%'"
        try:
            return Resp(200, str(self.db.execute(sql).fetchall()))
        except sqlite3.Error:
            return Resp(200, "[]")

    def source_has_secret(self) -> bool:
        return not self.on("secret_in_code")


# ---- the exploits: each returns True when it WORKS against the app it is pointed at ----
def exploit_sqli(app: ShopApp) -> bool:
    stolen = app.db.execute("SELECT pw FROM users WHERE name='ann'").fetchone()[0]
    return stolen in app.search("zzz' UNION SELECT name, pw FROM users --").body


def exploit_password_hash(app: ShopApp) -> bool:
    stolen = app.db.execute("SELECT pw FROM users WHERE name='ann'").fetchone()[0]
    return stolen == hashlib.sha256(b"pw-ann").hexdigest()  # a table of plain sha256 values is cracked from a word list


def exploit_session_id(app: ShopApp) -> bool:
    mine = app.login("ann", "pw-ann").cookie
    guess = str(int(mine) + 1) if mine and mine.isdigit() else None
    app.login("bob", "pw-bob")
    return bool(guess) and guess in app.sessions and app.sessions[guess]["user"] == "bob"


def exploit_idor(app: ShopApp) -> bool:
    c = app.login("ann", "pw-ann").cookie
    return app.order(c, 102).status == 200


def exploit_mass_assignment(app: ShopApp) -> bool:
    c = app.login("ann", "pw-ann").cookie
    app.update_profile(c, {"email": "ann@shop.test", "role": "admin"}, csrf=app.sessions[c]["csrf"])  # ann sends it herself, from the shop's own page
    return app.db.execute("SELECT role FROM users WHERE name='ann'").fetchone()[0] == "admin"


def exploit_xss(app: ShopApp) -> bool:
    c = app.login("ann", "pw-ann").cookie
    app.add_review(c, "pen", "<script>steal()</script>")
    return "<script>" in app.product_page("pen").body


def exploit_csrf(app: ShopApp) -> bool:
    c = app.login("ann", "pw-ann").cookie
    r = app.update_profile(c, {"email": "attacker@evil.test"}, csrf=None, origin="https://evil.test")
    return r.status == 200


def exploit_error_detail(app: ShopApp) -> bool:
    c = app.login("ann", "pw-ann").cookie
    return "SELECT" in app.order_text(c, "abc").body


def exploit_rate_limit(app: ShopApp) -> bool:
    tries = [app.login("ann", f"guess{i}").status for i in range(20)]
    return 429 not in tries


def exploit_secret_in_code(app: ShopApp) -> bool:
    return app.source_has_secret()


EXPLOITS = {
    "sqli": exploit_sqli, "password_hash": exploit_password_hash, "session_id": exploit_session_id, "idor": exploit_idor,
    "mass_assignment": exploit_mass_assignment, "xss": exploit_xss, "csrf": exploit_csrf,
    "error_detail": exploit_error_detail, "rate_limit": exploit_rate_limit, "secret_in_code": exploit_secret_in_code,
}
