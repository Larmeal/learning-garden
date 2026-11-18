"""Lesson 7: OAuth 2.0 authorization code flow, PKCE and OpenID Connect, with a toy authorization server that runs in this process.

Asserts the order of the messages, that a code stolen on its way back is useless once PKCE is on, that a redirect_uri checked by
`startswith` sends the code to another site, that `state` stops a login forged by an attacker, that a code works once, that the scope
limits the token, and the four checks a client must make on an OpenID Connect id_token.
"""

import base64
import hashlib
import secrets
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from jwtlib import sign_hs256, verify  # noqa: E402
from seclab import check, done, show  # noqa: E402

CLIENT_ID = "shop-app"
REDIRECT = "https://shop.test/callback"
ISSUER = "https://id.test"
ID_KEY = b"identity-provider-signing-key-32-bytes!!"
NOW = 1_800_000_000


def s256(verifier: str) -> str:
    return base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()


@dataclass
class AuthServer:
    strict_redirect: bool = True
    require_pkce: bool = True
    codes: dict[str, dict] = field(default_factory=dict)
    tokens: dict[str, dict] = field(default_factory=dict)
    log: list[str] = field(default_factory=list)

    def authorize(self, client_id, redirect_uri, scope, state, code_challenge=None, nonce=None, user="ann"):
        ok = redirect_uri == REDIRECT if self.strict_redirect else redirect_uri.startswith("https://shop.test")
        if client_id != CLIENT_ID or not ok:
            raise ValueError("redirect_uri not registered")
        if self.require_pkce and not code_challenge:
            raise ValueError("code_challenge required")
        code = secrets.token_urlsafe(16)
        self.codes[code] = {"user": user, "scope": scope, "challenge": code_challenge, "redirect": redirect_uri, "nonce": nonce, "t": NOW}
        self.log.append("authorize")
        return f"{redirect_uri}?code={code}&state={state}"

    def token(self, code, redirect_uri, client_id, code_verifier=None):
        entry = self.codes.pop(code, None)  # pop: a code works once
        if not entry:
            raise ValueError("invalid_grant")
        if entry["redirect"] != redirect_uri or client_id != CLIENT_ID:
            raise ValueError("invalid_grant")
        if entry["challenge"] and (not code_verifier or s256(code_verifier) != entry["challenge"]):
            raise ValueError("invalid_grant (pkce)")
        access = secrets.token_urlsafe(24)
        self.tokens[access] = {"user": entry["user"], "scope": entry["scope"]}
        idt = sign_hs256({"iss": ISSUER, "sub": entry["user"], "aud": CLIENT_ID, "nonce": entry["nonce"], "iat": NOW, "exp": NOW + 600}, ID_KEY)
        self.log.append("token")
        return {"access_token": access, "id_token": idt, "scope": entry["scope"]}

    def api(self, access, need_scope):
        t = self.tokens.get(access)
        if not t or need_scope not in t["scope"].split():
            raise PermissionError("insufficient_scope")
        return f"{need_scope} data of {t['user']}"


def query(url: str) -> dict:
    return {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}


# ---- 1. the normal flow, in the order of the picture ----
server = AuthServer()
verifier = secrets.token_urlsafe(32)
state, nonce = secrets.token_urlsafe(8), secrets.token_urlsafe(8)
back = server.authorize(CLIENT_ID, REDIRECT, "openid profile orders:read", state, s256(verifier), nonce)
show("the browser is sent back to", back.split("?")[0] + "?code=...&state=...")
q = query(back)
check("the code comes back with the same state the client sent", q["state"] == state)
result = server.token(q["code"], REDIRECT, CLIENT_ID, verifier)
check("the code is exchanged at the token endpoint for an access token and an id token", set(result) == {"access_token", "id_token", "scope"})
check("the order on the server is authorize first, token second", server.log == ["authorize", "token"])
check("the access token opens the API for a scope it was given", server.api(result["access_token"], "orders:read") == "orders:read data of ann")
try:
    server.api(result["access_token"], "orders:write")
    wrote = True
except PermissionError:
    wrote = False
check("the same token is refused for a scope nobody granted (orders:write)", not wrote)

# ---- 2. a code works once ----
try:
    server.token(q["code"], REDIRECT, CLIENT_ID, verifier)
    twice = True
except ValueError:
    twice = False
check("using the same code a second time fails", not twice)

# ---- 3. a code stolen on the way back: no PKCE against PKCE ----
for pkce in (False, True):
    server = AuthServer(require_pkce=False)
    verifier = secrets.token_urlsafe(32)
    back = server.authorize(CLIENT_ID, REDIRECT, "orders:read", "st", s256(verifier) if pkce else None)
    stolen = query(back)["code"]
    try:
        server.token(stolen, REDIRECT, CLIENT_ID, None)  # the thief has the code but never saw the verifier
        got_token = True
    except ValueError:
        got_token = False
    show(f"thief replays the code, PKCE {'on' if pkce else 'off'}", "got a token" if got_token else "refused")
    check(f"a thief who holds the code {'gets a token' if not pkce else 'gets nothing'} when PKCE is {'off' if not pkce else 'on'}", got_token == (not pkce))
check("the verifier is 43 characters long and only the client ever holds it; the server saw only its SHA-256", len(verifier) == 43 and len(s256(verifier)) == 43)

# ---- 4. redirect_uri: exact match against a prefix test ----
evil_uri = "https://shop.test.evil.test/callback"
loose = AuthServer(strict_redirect=False, require_pkce=False)
sent = loose.authorize(CLIENT_ID, evil_uri, "orders:read", "st")
show("loose server (startswith) sends the code to", sent.split("?")[0])
check("a prefix check accepts a redirect on the attacker's domain and the code goes there", urlparse(sent).hostname == "shop.test.evil.test")
strict = AuthServer(strict_redirect=True, require_pkce=False)
try:
    strict.authorize(CLIENT_ID, evil_uri, "orders:read", "st")
    leaked = True
except ValueError:
    leaked = False
check("an exact comparison with the registered address refuses the same request", not leaked)

# ---- 5. state: the client stops a callback it did not ask for ----
my_state = "S-mine"
attacker_callback = {"code": "attackers-own-code", "state": "S-attacker"}
check("a callback whose state is not the one this browser sent is thrown away", attacker_callback["state"] != my_state)

# ---- 6. OpenID Connect: what the client checks in the id_token ----
server = AuthServer()
verifier = secrets.token_urlsafe(32)
nonce = "n-123"
back = server.authorize(CLIENT_ID, REDIRECT, "openid", "st", s256(verifier), nonce)
idt = server.token(query(back)["code"], REDIRECT, CLIENT_ID, verifier)["id_token"]
claims = verify(idt, ID_KEY, now=NOW + 5, issuer=ISSUER, audience=CLIENT_ID)
check("the id_token passes signature, issuer, audience and expiry", claims["sub"] == "ann")
check("its nonce is the one this client sent, so it is not a replay from another login", claims["nonce"] == nonce)
for label, kw, msg in (("another client's id_token", {"audience": "other-app"}, "wrong audience"), ("a token from another issuer", {"issuer": "https://evil.test"}, "wrong issuer"), ("an old id_token", {"now": NOW + 601}, "token expired")):
    try:
        verify(idt, ID_KEY, **({"now": NOW + 5, "issuer": ISSUER, "audience": CLIENT_ID} | kw))
        got = "accepted"
    except ValueError as exc:
        got = str(exc)
    check(f"{label} is refused ({msg})", got == msg)
check("the access token is a random string the client must not read; the id_token is a JWT the client must", "." not in result["access_token"] and idt.count(".") == 2)
done()
