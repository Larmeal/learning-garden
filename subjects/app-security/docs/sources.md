# Sources of the Application Security subject

## Books (kept outside the repo)

PDFs in `E:\books\Networking & Security\Security\Application Security\`. They were converted to text with `pdftotext -layout` (one page per form feed) into a
scratch folder, so a claim can be given a printed page. The text has captions and the words around a figure, but not the figures: **no figure of any book was seen**.

| Book | Used for | Page offset (printed page = PDF page minus offset) |
|---|---|---|
| *Web Application Security: Exploitation and Countermeasures for Modern Web Applications*, Andrew Hoffman (O'Reilly, 2020). 29 chapters in three parts (recon, offense, defense). Cited as **Hoffman** | the shape of the attacks (XSS, CSRF, XXE, injection, DoS, dependencies) and of the defences (architecture, credentials, TLS, each defence chapter) | 32. Checked on 3 pages (PDF 179 is printed 147, PDF 260 is 228, PDF 82 is 50). |
| *API Security in Action*, Neil Madden (Manning, 2020). 12 chapters in five parts. Cited as **Madden** in this file, and as "API Security in Action" in the lessons | security goals and STRIDE (chapter 1), password hashing (chapter 3), session cookies (4), tokens and JWT (5, 6), OAuth2 and OpenID Connect (7), access control (8, 9), authenticated encryption (6.3.1) | 22. Checked on 4 pages (PDF 36 is printed 14, PDF 194 is 172, PDF 224 is 202, PDF 40 is 18). |
| *OAuth 2 in Action*, Justin Richer and Antonio Sanso (Manning, 2017). 16 chapters. Cited as **Richer** | the authorization code grant, redirect URI and state, PKCE, bearer token attacks, OpenID Connect | 27. Checked on 4 pages (PDF 55 is printed 28, PDF 135 is 108, PDF 185 is 158, PDF 275 is 248). |

Page rule, as in the other subjects: a citation gives the chapter or section and the printed page where the section starts, for example `API Security in Action หัวข้อ 1.4.2 หน้า 14`.
Never the section sign or "ch.". A page header is the top of its page, so a passage belongs to the nearest header **above** it. The text was searched with a small script
(`fp.py`, not kept in the repo) that prints the PDF page and the printed numbers near the page edges; a page may be one off.

## Not used

No source tree was read for this subject. `cryptography` 47.0.0 and Python 3.14's `ssl`, `hashlib`, `hmac`, `sqlite3`, `html.parser` and `ipaddress` are used as the
real thing, and their output is what the lessons print. RFC 8446 (TLS 1.3), RFC 6749 (OAuth 2.0), RFC 7519 (JWT) and the OWASP cheat sheets were **not** read for the
lessons: a claim that depends on them says so.

## Models that stand in for a real thing

- **The browser** in lesson 5 (cookie flags, SameSite) and the **Content Security Policy** in lesson 9 are small models written for the exercises, from the rules in the
  books. They were not run in a real browser.
- **The shell** in lesson 8 is the real shell of the operating system that runs the exercise (`cmd` on Windows).
- The apps (`shopapp.py` and the small ones in each exercise) are written for teaching. They are not examples to copy.
