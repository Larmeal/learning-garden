"""Shared helpers for the Networking exercises.

The real network stack here is the Linux kernel of WSL: `linux/topo.py` builds client, router and server out of network namespaces joined by veth pairs,
`tc netem` adds delay and loss, `iptables` does NAT, and `tcpdump -w` writes the packets to `out/`. This module runs those scripts as root from
Windows (`wsl.exe -u root`), reads the JSON and pcap files they leave behind and prints the checks that the lessons quote.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)
LABS = HERE.parents[2] / "site" / "src" / "components" / "labs" / "networking"


def _wsl_dir() -> str:
    s = str(HERE).replace("\\", "/")
    if len(s) > 1 and s[1] == ":":
        s = f"/mnt/{s[0].lower()}{s[2:]}"
    return s


def linux(script: str, *args: str, timeout: int = 180) -> str:
    """Run `linux/<script>` as root on Linux (inside WSL when started from Windows) and return its output. A failure stops the exercise with the output."""
    inner = f"cd '{_wsl_dir()}' && python3 linux/{script} " + " ".join(f"'{a}'" for a in args)
    cmd = ["wsl.exe", "-u", "root", "-e", "bash", "-lc", inner] if sys.platform == "win32" else ["sudo", "bash", "-lc", inner]
    done = subprocess.run(cmd, capture_output=True, timeout=timeout)
    text = (done.stdout + done.stderr).decode("utf-8", errors="replace").replace("\x00", "")
    if done.returncode != 0:
        sys.exit(f"linux/{script} failed ({done.returncode}):\n{text[-3000:]}")
    return text


def load(name: str) -> dict:
    return json.loads((OUT / name).read_text(encoding="utf-8"))


def check(label: str, ok: bool, detail: str = "") -> None:
    """Print one result line and fail loudly, because the lessons quote these results."""
    print(f"  {'ok  ' if ok else 'FAIL'} {label}" + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        sys.exit(f"FAILED: {label} {detail}")


def show(title: str, text: str = "") -> None:
    print(f"\n$ {title}" if title else "")
    if text:
        print(text)


def table(rows: list[list], head: list[str] | None = None) -> str:
    """A plain text table that the lessons paste."""
    rows = [[str(c) for c in r] for r in rows]
    if head:
        rows.insert(0, head)
    widths = [max(len(r[i]) for r in rows) for i in range(len(rows[0]))]
    return "\n".join("  ".join(c.ljust(w) for c, w in zip(r, widths)).rstrip() for r in rows)
