"""Lesson 6: tokens and JWT, built by hand so every part is visible.

Asserts the shape of a JWT (three base64url parts, payload readable by anyone), that editing the payload breaks an HS256 signature,
that a verifier which trusts the `alg` field accepts a token with `alg: none` and one signed with the RSA public key used as an HMAC
secret, that a careful verifier rejects both, that a weak secret falls to a short word list, and that a signed token cannot be
revoked before it expires unless the server keeps a list.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from cryptography.hazmat.primitives import serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import padding, rsa  # noqa: E402
from cryptography.hazmat.primitives.hashes import SHA256  # noqa: E402
from jwtlib import b64d, b64e, sign_hs256, split, verify, verify_naive  # noqa: E402
from seclab import check, done, show  # noqa: E402

SECRET = b"a-long-random-secret-of-at-least-32-bytes!!"
NOW = 1_800_000_000
claims = {"sub": "ann", "role": "user", "iss": "https://shop.test", "aud": "shop-api", "iat": NOW, "exp": NOW + 900}

# ---- 1. what a token is ----
token = sign_hs256(claims, SECRET)
head, body, sig = token.split(".")
show("token", token)
check("a JWT is three base64url parts joined by dots", token.count(".") == 2 and "=" not in token)
check("the header says HS256", split(token)[0] == {"alg": "HS256", "typ": "JWT"})
check("anyone can read the payload without the secret", split(token)[1]["sub"] == "ann" and split(token)[1]["role"] == "user")
check("the signature is 32 bytes (a SHA-256 HMAC)", len(b64d(sig)) == 32)
check("the server accepts its own token", verify(token, SECRET, now=NOW + 10, issuer="https://shop.test", audience="shop-api")["sub"] == "ann")

# ---- 2. editing the payload breaks the signature ----
forged_claims = dict(claims, role="admin")
forged = f"{head}.{b64e(json.dumps(forged_claims, separators=(',', ':')).encode())}.{sig}"
try:
    verify(forged, SECRET, now=NOW + 10)
    accepted = True
except ValueError as exc:
    accepted = False
    reason = str(exc)
show("same signature, payload says role=admin", reason)
check("a payload edited without the key is rejected (bad signature)", not accepted and reason == "bad signature")

# ---- 3. the verifier that believes the token about itself ----
none_token = b64e(json.dumps({"alg": "none", "typ": "JWT"}, separators=(",", ":")).encode()) + "." + b64e(json.dumps(forged_claims, separators=(",", ":")).encode()) + "."
check("a naive verifier accepts a token with alg none and no signature at all", verify_naive(none_token, SECRET)["role"] == "admin")
try:
    verify(none_token, SECRET, now=NOW + 10)
    none_ok = True
except ValueError as exc:
    none_ok = False
    none_reason = str(exc)
show("careful verifier on the alg none token", none_reason)
check("a careful verifier refuses alg none because its own list of algorithms does not contain it", not none_ok)

# ---- 4. algorithm confusion: RS256 server, HS256 forgery with the public key ----
private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
public_pem = private.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
check("the public key is public: the attacker has these bytes too", public_pem.startswith(b"-----BEGIN PUBLIC KEY-----"))
confused = sign_hs256(forged_claims, public_pem)  # the attacker uses the public key as an HMAC secret
check("a naive verifier that picks the algorithm from the token and keeps the public key as 'the key' accepts the forgery", verify_naive(confused, public_pem)["role"] == "admin")
try:
    verify(confused, public_pem, algorithms=("RS256",), now=NOW + 10)
    confused_ok = True
except ValueError as exc:
    confused_ok = False
    confused_reason = str(exc)
show("careful verifier (only RS256 allowed) on the HS256 forgery", confused_reason)
check("the forgery is stopped by the fixed algorithm list", not confused_ok)
rs_sig = private.sign(f"{head}.{body}".encode(), padding.PKCS1v15(), SHA256())
check("a real RS256 signature is 256 bytes (2048 bit key) and is checked with the public key only", len(rs_sig) == 256 and private.public_key().verify(rs_sig, f"{head}.{body}".encode(), padding.PKCS1v15(), SHA256()) is None)

# ---- 5. claims are checked too ----
for label, kwargs, reason in (
    ("expired", {"now": NOW + 901}, "token expired"),
    ("wrong audience", {"now": NOW + 10, "audience": "other-api"}, "wrong audience"),
    ("wrong issuer", {"now": NOW + 10, "issuer": "https://evil.test"}, "wrong issuer"),
):
    try:
        verify(token, SECRET, **kwargs)
        got = "accepted"
    except ValueError as exc:
        got = str(exc)
    check(f"a correct signature is not enough: {label} gives '{reason}'", got == reason)

# ---- 6. a weak secret falls to a word list ----
weak = sign_hs256(claims, b"secret")
WORDS = [b"123456", b"password", b"admin", b"secret", b"changeme", b"jwtsecret"]
found = next((w for w in WORDS if sign_hs256(claims, w) == weak), None)
show("trying 6 guesses against a token signed with a weak secret", found)
check("a signing secret of 'secret' is found on the 4th guess from a tiny list", found == b"secret" and WORDS.index(found) == 3)
check("the long random secret above is not in that list", sign_hs256(claims, SECRET) not in [sign_hs256(claims, w) for w in WORDS])

# ---- 7. no way to take a signed token back ----
revoked: set[str] = set()
check("before expiry a signed token is valid even after the user logs out (the server holds no state)", verify(token, SECRET, now=NOW + 800)["sub"] == "ann")
revoked.add(token)  # the fix: remember what was revoked, which gives back the state we wanted to avoid


def verify_with_denylist(t: str, now: float) -> dict:
    if t in revoked:
        raise ValueError("revoked")
    return verify(t, SECRET, now=now)


try:
    verify_with_denylist(token, NOW + 800)
    still = True
except ValueError:
    still = False
check("a deny list stops it, at the price of a lookup on every request", not still)
check("a short life (exp - iat = 900 s) limits how long a leaked token is worth anything", claims["exp"] - claims["iat"] == 900)
done()
