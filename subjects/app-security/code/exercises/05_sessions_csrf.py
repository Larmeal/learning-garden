"""Lesson 5: sessions, cookies and CSRF, on a toy bank and a toy browser that run in this process.

Asserts the Set-Cookie header the lesson shows, that a session id from secrets.token_urlsafe(32) has 256 bits, that session fixation
works against a server that keeps the id across login and fails against one that issues a new id, that a bank which trusts the
cookie alone moves money for a page on another site, and that three defences (SameSite=Lax, a CSRF token, an Origin check) each stop
it. The browser is a model written for this exercise from the rules in the book and on MDN: it was not run in a real browser.
"""

import hmac
import secrets
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from seclab import check, done, show  # noqa: E402

BANK = "bank.test"
EVIL = "evil.test"


@dataclass
class Bank:
    rotate_on_login: bool = True
    samesite: str = "Lax"  # Lax, Strict or None
    csrf_token: bool = False
    origin_check: bool = False
    sessions: dict[str, dict] = field(default_factory=dict)
    balances: dict[str, int] = field(default_factory=lambda: {"ann": 1000, "evil": 0})

    def handle(self, method: str, path: str, cookie: str | None, form: dict, origin: str | None):
        """Returns (status, set_cookie, body)."""
        if path == "/login" and method == "POST":
            sid = cookie if (cookie in self.sessions and not self.rotate_on_login) else secrets.token_urlsafe(32)
            self.sessions.setdefault(sid, {})
            self.sessions[sid].update({"user": form["user"], "csrf": secrets.token_urlsafe(16)})
            attrs = f"sid={sid}; HttpOnly; Secure; Path=/; SameSite={self.samesite}"
            return 200, attrs, "logged in"
        if path == "/pre-login" and method == "GET":
            sid = secrets.token_urlsafe(32)
            self.sessions[sid] = {}
            return 200, f"sid={sid}; HttpOnly; Secure; Path=/; SameSite={self.samesite}", "welcome"
        session = self.sessions.get(cookie or "")
        if path == "/transfer" and method == "POST":
            if not session or "user" not in session:
                return 401, None, "login first"
            if self.origin_check and origin != f"https://{BANK}":
                return 403, None, "bad origin"
            if self.csrf_token and not hmac.compare_digest(form.get("csrf", ""), session["csrf"]):
                return 403, None, "bad csrf token"
            self.balances[session["user"]] -= form["amount"]
            self.balances[form["to"]] += form["amount"]
            return 200, None, "sent"
        return 404, None, "no such page"


@dataclass
class Browser:
    """Keeps cookies per site and applies the SameSite rule when a page on one site posts to another."""
    jar: dict[str, str] = field(default_factory=dict)
    flags: dict[str, str] = field(default_factory=dict)

    def store(self, site: str, set_cookie: str | None):
        if set_cookie:
            self.jar[site] = set_cookie.split(";")[0].split("=", 1)[1]
            self.flags[site] = set_cookie

    def send(self, bank: Bank, from_site: str, method: str, path: str, form: dict | None = None):
        cross_site = from_site != BANK
        flags = self.flags.get(BANK, "")
        cookie = self.jar.get(BANK)
        if cross_site and "SameSite=Strict" in flags:
            cookie = None
        if cross_site and "SameSite=Lax" in flags and method == "POST":
            cookie = None  # Lax sends the cookie on cross-site top-level GET only
        origin = f"https://{from_site}"
        status, set_cookie, body = bank.handle(method, path, cookie, form or {}, origin)
        self.store(BANK, set_cookie)
        return status, body

    def js_can_read_cookie(self) -> bool:
        return "HttpOnly" not in self.flags.get(BANK, "")


# ---- 1. what the server sends and what the id is ----
bank = Bank()
me = Browser()
status, body = me.send(bank, BANK, "POST", "/login", {"user": "ann"})
show("Set-Cookie after login", me.flags[BANK])
check("the cookie carries HttpOnly, Secure and SameSite=Lax", all(x in me.flags[BANK] for x in ("HttpOnly", "Secure", "SameSite=Lax")))
sid = me.jar[BANK]
check("a session id from token_urlsafe(32) is 43 characters of base64url (256 bits)", len(sid) == 43)
check("two ids are never the same in practice", secrets.token_urlsafe(32) != secrets.token_urlsafe(32))
check("JavaScript on the page cannot read a cookie marked HttpOnly", not me.js_can_read_cookie())
plain = Browser(flags={BANK: "sid=abc; Path=/"})
check("a cookie without HttpOnly can be read by script (what an XSS would steal)", plain.js_can_read_cookie())

# ---- 2. session fixation ----
for rotate, expect_hijack in ((False, True), (True, False)):
    bank = Bank(rotate_on_login=rotate)
    attacker = Browser()
    attacker.send(bank, BANK, "GET", "/pre-login")
    planted = attacker.jar[BANK]  # the attacker gets a session id and pushes it into the victim's browser
    victim = Browser(jar={BANK: planted}, flags={BANK: "sid=" + planted + "; HttpOnly; Secure; SameSite=Lax"})
    victim.send(bank, BANK, "POST", "/login", {"user": "ann"})
    hijacked = bank.sessions.get(planted, {}).get("user") == "ann"
    show(f"session id kept across login = {not rotate}", f"attacker's planted id is now logged in as ann: {hijacked}")
    check(f"{'keeping' if not rotate else 'replacing'} the id at login {'lets' if expect_hijack else 'does not let'} the attacker use the planted id", hijacked == expect_hijack)

# ---- 3. CSRF: a page on another site makes the browser send the request ----
def attack(bank: Bank) -> tuple[int, int]:
    victim = Browser()
    victim.send(bank, BANK, "POST", "/login", {"user": "ann"})
    status, _ = victim.send(bank, EVIL, "POST", "/transfer", {"to": "evil", "amount": 500})
    return status, bank.balances["evil"]


status, stolen = attack(Bank(samesite="None"))
show("evil.test posts a transfer, bank trusts the cookie alone, SameSite=None", f"status {status}, evil now has {stolen}")
check("with SameSite=None and no other defence the bank sends 500 to the attacker", (status, stolen) == (200, 500))

status, stolen = attack(Bank(samesite="Lax"))
check("SameSite=Lax: the browser leaves the cookie off a cross-site POST, so the bank answers 401", (status, stolen) == (401, 0))
status, stolen = attack(Bank(samesite="None", csrf_token=True))
check("a CSRF token the other site cannot read: the same request gets 403", (status, stolen) == (403, 0))
status, stolen = attack(Bank(samesite="None", origin_check=True))
check("an Origin check: the request says it came from evil.test and gets 403", (status, stolen) == (403, 0))

# the honest page still works with every defence on
bank = Bank(samesite="Lax", csrf_token=True, origin_check=True)
me = Browser()
me.send(bank, BANK, "POST", "/login", {"user": "ann"})
token = bank.sessions[me.jar[BANK]]["csrf"]
status, _ = me.send(bank, BANK, "POST", "/transfer", {"to": "evil", "amount": 1, "csrf": token})
check("the bank's own page, with its token and from its own origin, still works", status == 200 and bank.balances["ann"] == 999)
done()
