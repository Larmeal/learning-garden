#!/usr/bin/env python3
"""Screenshot a lab in the state that matters (a given step, a given option), so that you can look at it as the reader would.

    MSYS_NO_PATHCONV=1 uv run --with playwright python .claude/skills/create-learning/scripts/lab-steps.py \\
        --out <folder> \\
        "/iceberg/writing/|0|7. เปลี่ยนตัวชี้|write7_clash|มี" \\
        "/en/iceberg/reading/|0||read_default|"

Each spec is `path | figure index | buttons to click, separated by ; | file name | option to click first` (the last two may be empty).
`figure index` counts the `figure.viz` of the page from 0. The names of the buttons are what the page shows, for example `3. Manifest List`
(a step player numbers its steps). The script opens the page, switches to the long page if the figure is hidden (the step player shows one
card at a time), clicks, and screenshots the figure alone.

`scripts/lab-audit.py` takes one screenshot per lab in its default state. That is not enough: a lab that looks fine at step 1 can have text
over text at step 6, or in English, where strings are longer. Take the steps with the longest text and the last step, in both languages, and
open the images (the Read tool shows them).

If Chrome is not installed use `--channel msedge`.
"""
import argparse
import os
import sys

from playwright.sync_api import sync_playwright

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("specs", nargs="+")
    ap.add_argument("--out", required=True)
    ap.add_argument("--base", default="http://localhost:4399")
    ap.add_argument("--channel", default="msedge")
    ap.add_argument("--width", type=int, default=1100)
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel=args.channel) if args.channel else p.chromium.launch()
        pg = b.new_page(viewport={"width": args.width, "height": 1200})
        for spec in args.specs:
            path, idx, clicks, name, option = (spec.split("|") + [""] * 5)[:5]
            pg.goto(args.base + path, wait_until="networkidle")
            fig = pg.locator("figure.viz").nth(int(idx))
            if not fig.is_visible():
                pg.evaluate("document.querySelector('[data-toggle-view]').click()")
                pg.wait_for_timeout(700)
            fig.scroll_into_view_if_needed()
            if option:
                fig.get_by_role("button", name=option).first.click()
            for c in [c for c in clicks.split(";") if c]:
                fig.get_by_role("button", name=c).first.click()
                pg.wait_for_timeout(250)
            pg.wait_for_timeout(500)
            target = os.path.join(args.out, name + ".png")
            fig.screenshot(path=target)
            print("saved", target)
        b.close()


if __name__ == "__main__":
    main()
