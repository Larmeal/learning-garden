# Application Security

A path for someone who writes code for the web and wants to see how it is attacked and how each hole is closed. Thirteen lessons in Thai and English, each with a quiz and one or two animated labs.
Every attack runs against a toy app on this computer only: an in-memory SQLite, a certificate authority made on the spot, a throwaway Git repository, a small authorization server.
Nothing is sent over a network and nothing real is touched.

## Lessons

| # | Lesson | Phase | Labs |
|---|---|---|---|
| 1 | How a defender thinks (CIA, STRIDE, the path of a request) | A | `RequestPathLab` |
| 2 | Hash, HMAC, encryption and signatures | A | `HashLab`, `CryptoToolboxLab` |
| 3 | TLS and certificates | A | `TlsHandshakeLab`, `KeyExchangeLab` |
| 4 | Storing passwords | B | `SaltLab`, `PasswordCrackLab` |
| 5 | Sessions, cookies and CSRF | B | `CookieSessionLab`, `CsrfLab` |
| 6 | Tokens and JWT | B | `JwtLab` |
| 7 | OAuth 2.0 and OpenID Connect | B | `OAuthFlowLab` |
| 8 | Injection (SQL and commands) | C | `SqlInjectionLab`, `BlindSqliLab` |
| 9 | XSS and CSP | C | `XssLab` |
| 10 | Access control, path traversal, SSRF, pickle, XXE | C | `AccessLab` |
| 11 | Dependencies and secrets | D | `DependencyLab`, `SecretGitLab` |
| 12 | Being flooded, and rate limits | D | `ReDosLab`, `RateLimitLab` |
| 13 | Capstone: a shop with ten holes | D | `CapstoneLab` |

Twenty labs in `site/src/components/labs/app-security/`, all drawn again on 2026-11-19 after the owner said the first ones explained nothing (each draws the objects of its lesson: an envelope, parcels with seals, a lookup book, a ticket and a desk, a board of characters, a shelf of folders, a bucket of coins, a wall with holes; `bits.tsx` has the shared pieces). Seven are clock labs (`RequestPathLab`, `TlsHandshakeLab`, `CookieSessionLab`, `CsrfLab`, `OAuthFlowLab`, `BlindSqliLab`, `RateLimitLab`; four of them
draw their messages with `seq.tsx`), one is a step lab (`SecretGitLab`) and twelve are controls and a picture. `sha256.ts` and `jwt.ts` compute a real SHA-256, HMAC and HS256 token in the browser.

## Code

`subjects/app-security/code/` is its own `uv` project (Python 3.12 or newer, `cryptography` 47.0.0). `seclab.py` has `check`, `show` and `done`, `pki.py` a tiny certificate authority, `jwtlib.py` a JWT written by hand and
`shopapp.py` the capstone shop. Exercises `01` to `13` assert what the lessons print and `verify.py` re-runs them. Exercises 04, 08, 09, 10, 12 and 13 take `--write` and save the JSON that a lab reads
(`passwordData.json`, `injection.json`, `xss.json`, `access.json`, `dosData.json`, `capstone.json`).

## Backlog

- A real browser run (Playwright) of SameSite, CSP and XSS, to replace the models of exercises 05 and 09.
- bcrypt and Argon2, a real OAuth provider (Keycloak in a container), and a TLS server with a certificate chain of two levels.
- Lessons on logging and detection, on security headers as a whole, on file upload and deserialization in depth, and on API specific risks (rate limits by key, GraphQL).
- The Data Security subject (privacy, anonymization, differential privacy) is a separate subject that has not been built yet.
