"""Lesson 13: the capstone. A toy shop with ten planted flaws, ten exploits, and ten fixes.

Asserts that all ten exploits work against the app with no fix, that none works with every fix, that each fix stops exactly its own
exploit (a 10 by 10 table with only the diagonal blocked), that the honest flows (login, own order, profile update, review, search)
still work with every fix on, and that the scanner of lesson 11 finds the key in the unfixed source.

`--write` saves the table as site/src/components/labs/app-security/capstone.json for the capstone lab.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from seclab import check, done, show  # noqa: E402
from shopapp import EXPLOITS, FIXES, SIGNING_KEY_IN_CODE, ShopApp  # noqa: E402

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "site" / "src" / "components" / "labs" / "app-security" / "capstone.json"

# ---- 1. nothing fixed ----
open_app = {name: fn(ShopApp()) for name, fn in EXPLOITS.items()}
show("exploits against the app with no fix", open_app)
check("all ten exploits work against the app with no fix", all(open_app.values()) and len(open_app) == 10)

# ---- 2. everything fixed ----
closed = {name: fn(ShopApp(fixed=set(FIXES))) for name, fn in EXPLOITS.items()}
show("exploits against the app with all ten fixes", closed)
check("none of the ten exploits works once every fix is on", not any(closed.values()))

# ---- 3. one fix at a time: the table ----
table: dict[str, dict[str, bool]] = {}
for fix in FIXES:
    table[fix] = {name: fn(ShopApp(fixed={fix})) for name, fn in EXPLOITS.items()}
show("rows: the fix that is on. columns: the exploit that still works", "\n".join(f"{fix:16} " + " ".join("X" if v else "." for v in row.values()) for fix, row in table.items()))
check("each fix blocks its own exploit", all(not table[f][f] for f in FIXES))
check("and only its own: the other nine exploits still work (90 of 90)", sum(v for f in FIXES for e, v in table[f].items() if e != f) == 90)

# ---- 4. the honest flows still work with all fixes on ----
app = ShopApp(fixed=set(FIXES))
r = app.login("ann", "pw-ann")
check("ann can log in with her password", r.status == 200 and len(r.cookie) == 43)
check("ann reads her own order", app.order(r.cookie, 101).status == 200)
check("ann updates her e-mail from the shop's own page, with her token", app.update_profile(r.cookie, {"email": "new@shop.test"}, csrf=app.sessions[r.cookie]["csrf"]).status == 200)
check("ann posts a review and sees it escaped on the page", app.add_review(r.cookie, "pen", "<b>nice</b>").status == 201 and "&lt;b&gt;nice&lt;/b&gt;" in app.product_page("pen").body)
check("a search for 'pen' finds the pen", "pen" in app.search("pen").body)
check("a wrong password is refused with a plain 401", app.login("ann", "nope").status == 401)
check("the sixth wrong try in a row gets 429", [app.login("bob", f"x{i}").status for i in range(6)][-1] == 429)

# ---- 5. the key in the source ----
import re  # noqa: E402

source = Path(__file__).resolve().parent.parent.joinpath("shopapp.py").read_text(encoding="utf-8")
check("the scanner shape for an AWS key id finds the key that the unfixed source carries", bool(re.search(r"\bAKIA[0-9A-Z]{16}\b", source)) and SIGNING_KEY_IN_CODE in source)

if "--write" in sys.argv:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"fixes": FIXES, "open": open_app, "closed": closed, "table": table}, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")
done()
