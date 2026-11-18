"""Shared helpers for the Data Security exercises.

Everything here runs on this computer only: toy apps are plain functions or a server on 127.0.0.1, the "attacks" are
strings sent to our own code, and nothing touches a real site. Only the standard library and `cryptography` are used.
Output is deterministic where a lesson prints it (fixed salts, fixed keys, a fixed clock), so the numbers repeat.
"""

from __future__ import annotations

import sys

# Windows consoles default to a legacy code page; the exercises print Thai-free ASCII, but keep UTF-8 anyway.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:  # pragma: no cover
    pass


def check(message: str, condition: bool) -> None:
    """Print `  ok   message` or stop with FAIL. verify.py counts the ok lines."""
    if not condition:
        print(f"  FAIL {message}")
        raise SystemExit(f"FAIL: {message}")
    print(f"  ok   {message}")


def show(title: str, body: object = "") -> None:
    print(f"\n$ {title}")
    if body != "":
        print(str(body))


def done() -> None:
    print("\nok")
