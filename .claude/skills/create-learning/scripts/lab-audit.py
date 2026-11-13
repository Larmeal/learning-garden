#!/usr/bin/env python3
"""Audit the labs (figure.viz) of lesson pages in a running `astro dev` server.

    uv run --with playwright python lab-audit.py /spark/foundations/ /en/spark/foundations/
    python lab-audit.py --base http://localhost:4321 --out ./shots /spark/architecture/

For every page it
  1. screenshots every lab (figure.viz) into --out (default: a temp folder, printed at the end),
  2. clicks every option group (.seg and .viz-steps whose buttons are not numbered steps) and reports one whose buttons all give
     the same picture (NO VISIBLE EFFECT),
  3. goes through every step of every option and reports text inside an SVG that overlaps other text (OVERLAP),
  4. loads the page at a 1920 px screen and reports a lab box that scrolls sideways (BOX SCROLLS), and at 390 px a sideways scroll of the page itself (PHONE),
  5. reports script errors (ERROR).
Exit code 1 when something was reported. It finds patterns; read the screenshots too.
"""
import argparse
import hashlib
import re
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

GROUPS = '.viz-steps, .seg'

# what the reader sees in a figure, without its buttons (page text plus the drawing of every SVG)
SNAP = """e => {
  const c = e.cloneNode(true);
  c.querySelectorAll('button, input, select').forEach(x => x.remove());
  return c.innerText + '|' + [...c.querySelectorAll('svg')].map(s => s.innerHTML.replace(/ style="[^"]*"/g, '')).join('#');
}"""

# the visible SVG texts with their boxes in page pixels
TEXTS = """e => {
  const out = [];
  e.querySelectorAll('svg text').forEach(t => {
    const cs = getComputedStyle(t);
    let op = 1, n = t;
    while (n && n.tagName !== 'svg') { const o = parseFloat(getComputedStyle(n).opacity); if (!isNaN(o)) op *= o; n = n.parentElement; }
    if (op < 0.2 || cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = t.getBoundingClientRect();
    const txt = t.textContent.trim();
    if (!txt || r.width < 2) return;
    out.push([txt.slice(0, 34), Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]);
  });
  return out;
}"""

GROUP_FIRST_TEXT = "e => [...e.querySelectorAll('.viz-steps, .seg')].map(g => (g.querySelector('button') || {innerText: ''}).innerText)"


def digest(s):
    return hashlib.md5(s.encode()).hexdigest()[:8]


def overlaps(boxes, share=0.45):
    found = []
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            a, b = boxes[i], boxes[j]
            w = min(a[3], b[3]) - max(a[1], b[1])
            h = min(a[4], b[4]) - max(a[2], b[2])
            if w > 3 and h > 3:
                small = min((a[3] - a[1]) * (a[4] - a[2]), (b[3] - b[1]) * (b[4] - b[2]))
                # two one-letter texts at the same spot are usually dots that sit on top of each other on purpose
                if small and w * h / small > share and not (a[0] == b[0] and len(a[0]) == 1):
                    found.append((a[0], b[0], round(w * h / small, 2)))
    return found


def audit_figure(pg, fig, name, report, settle):
    first = fig.evaluate(GROUP_FIRST_TEXT)
    steps_g = [g for g, t in enumerate(first) if re.match(r'^\d+\.', t)]
    option_g = [g for g in range(len(first)) if g not in steps_g]
    group = lambda g: fig.locator(GROUPS).nth(g)

    def go_to_end():
        if steps_g:
            last = group(steps_g[-1]).locator('button')
            last.nth(last.count() - 1).click()
            pg.wait_for_timeout(settle)

    # 2. does each option group change the picture?
    for g in option_g:
        buttons = group(g).locator('button')
        n = buttons.count()
        if n < 2:
            continue
        # the other option groups go back to their first button: a choice in one group can make another group irrelevant
        for h in option_g:
            if h != g:
                group(h).locator('button').first.click()
        pg.wait_for_timeout(200)
        seen = []
        for b in range(n):
            buttons.nth(b).click()
            pg.wait_for_timeout(300)
            go_to_end()
            seen.append(digest(fig.evaluate(SNAP)))
        if len(set(seen)) == 1:
            labels = [buttons.nth(b).inner_text()[:24] for b in range(n)]
            report.append(f'NO VISIBLE EFFECT  {name} group {g}: {labels}')

    # 3. text over text: one option at a time (the others at their first button), every step of each
    def check_steps(tag):
        if steps_g:
            sb = group(steps_g[-1]).locator('button')
            for s in range(sb.count()):
                sb.nth(s).click()
                pg.wait_for_timeout(settle)
                for o in overlaps(fig.evaluate(TEXTS)):
                    bad.setdefault((o[0], o[1]), (tag, f'step {s + 1}', o[2]))
        else:
            for o in overlaps(fig.evaluate(TEXTS)):
                bad.setdefault((o[0], o[1]), (tag, 'still', o[2]))

    bad = {}
    for g in option_g:
        group(g).locator('button').first.click()
    pg.wait_for_timeout(300)
    check_steps('first options')
    for g in option_g:
        buttons = group(g).locator('button')
        for b in range(1, buttons.count()):
            buttons.nth(b).click()
            pg.wait_for_timeout(300)
            check_steps(f'group {g} option {b + 1}')
        buttons.first.click()
        pg.wait_for_timeout(300)
    for (a, b), (opt, step, share) in list(bad.items())[:6]:
        report.append(f'OVERLAP           {name} {opt}, {step}: "{a}" over "{b}" ({share:.0%} of the smaller)')
    if len(bad) > 6:
        report.append(f'OVERLAP           {name}: and {len(bad) - 6} more pairs')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('paths', nargs='+', help='page paths such as /spark/foundations/ (Thai) or /en/spark/foundations/')
    ap.add_argument('--base', default='http://localhost:4321')
    ap.add_argument('--out', default=None, help='folder for the screenshots (default: a temp folder)')
    ap.add_argument('--channel', default='chrome', help='browser channel; use "" for the bundled Chromium')
    ap.add_argument('--settle', type=int, default=900, help='ms to wait after choosing a step before reading the picture')
    args = ap.parse_args()

    # Git Bash turns an argument that starts with / into a Windows path ("C:/Program Files/Git/spark/..."): undo that
    # (setting MSYS_NO_PATHCONV=1 for the command avoids it altogether)
    args.paths = [re.sub(r'^[A-Za-z]:[/\\].*?[/\\]Git(?=[/\\])', '', p).replace('\\', '/') for p in args.paths]
    out = Path(args.out) if args.out else Path(tempfile.mkdtemp(prefix='lab-audit-'))
    out.mkdir(parents=True, exist_ok=True)
    report = []
    labs = 0

    with sync_playwright() as p:
        br = p.chromium.launch(channel=args.channel) if args.channel else p.chromium.launch()
        desk = br.new_context(viewport={'width': 1100, 'height': 900})
        desk.add_init_script("localStorage.setItem('garden:view','read')")
        pg = desk.new_page()
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)[:160]))
        for path in args.paths:
            slug = path.strip('/').replace('/', '_') or 'home'
            pg.goto(args.base + path, wait_until='networkidle', timeout=180000)
            figs = pg.locator('figure.viz')
            for i in range(figs.count()):
                fig = figs.nth(i)
                fig.scroll_into_view_if_needed()
                pg.wait_for_timeout(600)
                name = f'{path} lab {i + 1}'
                fig.screenshot(path=str(out / f'{slug}_{i + 1}.png'))
                labs += 1
                audit_figure(pg, fig, name, report, args.settle)
            for e in errors:
                report.append(f'ERROR             {path}: {e}')
            errors.clear()

        # the lesson column is only 700 px wide on a big desktop screen: a lab box that is wider than that scrolls sideways and loses its edge
        wide = br.new_context(viewport={'width': 1920, 'height': 900})
        wide.add_init_script("localStorage.setItem('garden:view','read')")
        wp = wide.new_page()
        for path in args.paths:
            wp.goto(args.base + path, wait_until='networkidle', timeout=180000)
            for row in wp.evaluate("() => [...document.querySelectorAll('.viz-box')].map((b, i) => [i + 1, b.clientWidth, b.scrollWidth])"):
                if row[2] > row[1] + 1:
                    report.append(f'BOX SCROLLS       {path} lab {row[0]}: the box is {row[1]} px wide but its drawing needs {row[2]} (at a 1920 px screen)')
        phone = br.new_context(viewport={'width': 390, 'height': 800})
        phone.add_init_script("localStorage.setItem('garden:view','read')")
        pp = phone.new_page()
        for path in args.paths:
            pp.goto(args.base + path, wait_until='networkidle', timeout=180000)
            width = pp.evaluate('document.documentElement.scrollWidth')
            if width > 390:
                report.append(f'PHONE             {path}: the page scrolls sideways (scrollWidth {width} at 390)')
        br.close()

    for line in report:
        print(line)
    print(f'{labs} labs on {len(args.paths)} pages, {len(report)} things reported. Screenshots: {out}')
    sys.exit(1 if report else 0)


if __name__ == '__main__':
    main()
