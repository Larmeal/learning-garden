#!/usr/bin/env python3
"""Make `thai-lint.mjs` stop warning about English words that start with a lower-case letter, in Thai MDX files.

    python .claude/skills/create-learning/scripts/fix-capitals.py site/src/content/lessons/<id>/*/*.mdx

The linter ([english-capital]) wants every English word in Thai text to start with a capital letter, except code in backticks. The
warnings you meet most are in the props of a quiz (`q=`, `options=`, `why=`), where backticks are not rendered, so an identifier such as
`total-records` or `operation` cannot be quoted. This script reads the lint output and capitalises exactly the words it names, on exactly
the lines it names, outside backticks. It does not touch words with an underscore, a dot, a slash or a hyphen in front or behind
(identifiers such as `int_from_float`), so a few warnings can remain: reword those lines by hand (for example "ตาราง Snapshots" instead of
".snapshots", or "ค่า Total Records" instead of "total-records"). Run the lint again afterwards: 0 warn is the goal.

It never rewrites a line that the lint did not flag, and it prints how many lines it changed.
"""
import collections
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]  # .claude/skills/create-learning/scripts/this file -> repo root
LINT = ROOT / ".claude" / "skills" / "thaihumanize" / "scripts" / "thai-lint.mjs"


def main():
    files = sys.argv[1:]
    if not files:
        print(__doc__)
        raise SystemExit(2)
    out = subprocess.run(["node", str(LINT), *files], capture_output=True, text=True, encoding="utf-8", cwd=ROOT).stdout
    todo = collections.defaultdict(list)
    for line in out.splitlines():
        m = re.match(r"(\S+):(\d+)\s+warn \[english-capital\] English word\(s\) without a capital letter: (.*)", line)
        if m:
            todo[m.group(1)].append((int(m.group(2)), [w.strip() for w in m.group(3).split(",")]))
    changed = 0
    for f, items in todo.items():
        path = Path(f) if Path(f).is_absolute() else ROOT / f
        lines = path.read_text(encoding="utf-8").split("\n")
        for ln, words in items:
            parts = re.split(r"(`[^`]*`)", lines[ln - 1])
            for i in range(0, len(parts), 2):  # even parts are outside backticks
                for w in words:
                    parts[i] = re.sub(r"(?<![\w\-_/.'])" + re.escape(w) + r"(?![\w\-_/])", w[0].upper() + w[1:], parts[i])
            new = "".join(parts)
            if new != lines[ln - 1]:
                changed += 1
            lines[ln - 1] = new
        path.write_text("\n".join(lines), encoding="utf-8")
    print(f"lines changed: {changed}. Run the lint again; reword by hand what is left.")


if __name__ == "__main__":
    main()
