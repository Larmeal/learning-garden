#!/usr/bin/env python3
"""Open every page of a subject (Thai and English) in a headless browser and report script errors and sideways page scroll.

    # build and serve first, from site/:   npm run build   then   npm run preview -- --port 4399
    MSYS_NO_PATHCONV=1 uv run --with playwright python .claude/skills/create-learning/scripts/crawl-pages.py iceberg
    ... crawl-pages.py iceberg --base http://localhost:4399 --widths 1280 390 --channel msedge

The pages are found from the folders `site/src/content/lessons/<id>/` and `lessons-en/<id>/` (a lesson, its sub-pages and its quiz),
plus the subject home page. For each page and width it prints the h1, whether the page scrolls sideways (only `.viz-box` may), how many
buttons it has and any console error. Exit code 1 if anything was reported. It finds patterns; it does not read the text.
It once found a lesson whose `summary` showed a literal backtick on the lesson cover, which no linter had seen: look at a cover too.

If Chrome is not installed use `--channel msedge`. If neither is, run `playwright install chromium` and pass `--channel ""`.
In Git Bash put `MSYS_NO_PATHCONV=1` in front, or `/iceberg/` becomes a Windows path.
"""
import argparse
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parents[4]


def pages_of(subject: str):
    out = ["/", f"/{subject}/", f"/en/{subject}/"]
    for base, prefix in (("lessons", ""), ("lessons-en", "/en")):
        d = ROOT / "site" / "src" / "content" / base / subject
        if not d.exists():
            continue
        for p in sorted(d.iterdir()):
            if p.is_dir():
                for f in sorted(p.glob("*.mdx")):
                    slug = "" if f.stem == "index" else f.stem + "/"
                    out.append(f"{prefix}/{subject}/{p.name}/{slug}")
            elif p.suffix == ".mdx":
                out.append(f"{prefix}/{subject}/{p.stem}/")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("subject")
    ap.add_argument("--base", default="http://localhost:4399")
    ap.add_argument("--widths", type=int, nargs="+", default=[1280, 390])
    ap.add_argument("--channel", default="msedge")
    args = ap.parse_args()
    paths = pages_of(args.subject)
    bad = 0
    with sync_playwright() as p:
        b = p.chromium.launch(channel=args.channel) if args.channel else p.chromium.launch()
        for w in args.widths:
            ctx = b.new_context(viewport={"width": w, "height": 900})
            for path in paths:
                pg = ctx.new_page()
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
                pg.on("console", lambda m: errs.append(m.text[:120]) if m.type == "error" else None)
                pg.goto(args.base + path, wait_until="networkidle")
                sideways = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                h1 = pg.locator("h1").first.inner_text() if pg.locator("h1").count() else "-"
                flag = bool(errs) or sideways > 1
                bad += flag
                print(f"{'!!' if flag else 'ok'} {w:5d} {path:50s} h1={h1[:30]!r} sideways={sideways} errors={errs[:2]}")
                pg.close()
            ctx.close()
        b.close()
    print(f"{len(paths) * len(args.widths)} page loads, problems: {bad}")
    raise SystemExit(1 if bad else 0)


if __name__ == "__main__":
    main()
