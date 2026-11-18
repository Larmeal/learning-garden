"""A small JWT implementation (HS256 and RS256 verification, `alg: none`) written by hand so the lessons can show what each line checks.

It is for teaching: real code should use a maintained library. `verify_naive` has the three classic mistakes on purpose.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time


def b64e(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def b64d(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def sign_hs256(payload: dict, secret: bytes, header: dict | None = None) -> str:
    header = header or {"alg": "HS256", "typ": "JWT"}
    head = b64e(json.dumps(header, separators=(",", ":")).encode())
    body = b64e(json.dumps(payload, separators=(",", ":")).encode())
    mac = hmac.new(secret, f"{head}.{body}".encode(), hashlib.sha256).digest()
    return f"{head}.{body}.{b64e(mac)}"


def split(token: str) -> tuple[dict, dict, str]:
    head, body, sig = token.split(".")
    return json.loads(b64d(head)), json.loads(b64d(body)), sig


def verify_naive(token: str, key: bytes, now: float = 0) -> dict:
    """What a careless verifier does: it believes the `alg` in the token, and it never looks at `exp`."""
    header, payload, sig = split(token)
    alg = header["alg"]
    head, body, _ = token.split(".")
    if alg == "none":
        return payload
    if alg == "HS256":
        mac = hmac.new(key, f"{head}.{body}".encode(), hashlib.sha256).digest()
        if hmac.compare_digest(b64e(mac), sig):
            return payload
    raise ValueError("bad signature")


def verify(token: str, key: bytes, *, algorithms: tuple[str, ...] = ("HS256",), now: float | None = None, issuer: str | None = None, audience: str | None = None) -> dict:
    """What a careful verifier does: a fixed list of algorithms chosen by the server, the signature, then the claims."""
    header, payload, sig = split(token)
    if header.get("alg") not in algorithms:
        raise ValueError(f"algorithm {header.get('alg')!r} is not allowed")
    head, body, _ = token.split(".")
    mac = hmac.new(key, f"{head}.{body}".encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(b64e(mac), sig):
        raise ValueError("bad signature")
    t = time.time() if now is None else now
    if "exp" in payload and t >= payload["exp"]:
        raise ValueError("token expired")
    if issuer is not None and payload.get("iss") != issuer:
        raise ValueError("wrong issuer")
    if audience is not None and payload.get("aud") != audience:
        raise ValueError("wrong audience")
    return payload
