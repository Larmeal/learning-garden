# Verified findings (Application Security)

Every statement in a lesson is tagged **ran** (produced by an exercise in `code/exercises/` with Python 3.14.9 and `cryptography` 47.0.0 on Windows, no network), **book**
(chapter or section and the printed page where it starts; `docs/sources.md` has the page offsets) or **author** (advice, framing or a guess, said so in the lesson).
No source tree was read for this subject, so there is no **source** tag. `code/verify.py` re-runs the 13 exercises (217 checks) and exits non-zero if one changes.
`node subjects/app-security/code/verify_labs.mts` (17 checks) and `verify_jwt.mts` (3 checks) check that the TypeScript used by the labs gives the same bytes as the Python.

Speeds (`04_passwords.py`) and one timing (`12_dos_rate_limit.py`, 4 more letters take about 16 times as long) belong to the computer that ran them. The asserts use ratios.

| Lesson | Claim | Tag | Where |
|---|---|---|---|
| mindset | a handler that ignores `who` gives Ann the order of Bob, a price taken from the client charges 1 for a bag of 900, an unlimited `limit` is asked for 10,000,000 rows, and each fix lives on the server | ran | `01_mindset.py` |
| mindset | the path of a request has 5 stops and 2 trust boundaries; STRIDE has 6 threats that break 6 different things | ran | `01_mindset.py` |
| mindset | CIA, STRIDE | book | API Security in Action 1.4.2 p. 14, ch. 1 p. 18 |
| crypto-basics | SHA-256 of `pay bob 100` and `pay bob 900` differ in 133 of 256 bits; a hash is 32 bytes; a 4 digit PIN behind it is found in 7,352 tries | ran | `02_crypto_basics.py` |
| crypto-basics | HMAC needs the key; AES-GCM refuses one flipped bit and a changed label; an Ed25519 signature is 64 bytes and fails on a changed message | ran | `02_crypto_basics.py` |
| crypto-basics | the TypeScript SHA-256 and HMAC of the labs equal Python and Node | ran | `verify_labs.mts` |
| crypto-basics | MAC definition, authenticated encryption, nonce reuse breaks AES-GCM | book | API Security in Action ch. 5 p. 172, 6.3.1 p. 197, p. 202 (nonce reuse not run) |
| tls | TLS 1.3 handshake with our CA in 4 turns (client, server, client, server), refused when the CA is unknown, the name differs or the certificate is expired | ran | `03_tls.py` |
| tls | toy Diffie-Hellman p=23 g=5: 8 and 19 on the wire, shared 2, eavesdropper finds the secret at 6 | ran | `03_tls.py` |
| tls | message sizes 1524, 1818, 80 and 510 bytes (OpenSSL 3.5.9) | ran | `03_tls.py` (depend on the certificate and the version) |
| tls | SSL and TLS in a web app | book | Web Application Security ch. 18 p. 195 |
| tls | order of messages in TLS 1.3 (RFC 8446) | author | the spec was not read |
| passwords | Ann and Bob share a hash; a 1,000 word table cracks 4 of 5; a salt hides repeats and the table finds 0 | ran | `04_passwords.py` |
| passwords | sha256, PBKDF2 (600,000) and scrypt (N=32768) guesses per second; ratios at least 1,000 | ran | `04_passwords.py` (numbers are machine specific) |
| passwords | bits per kind of password (19.9, 37.6, 47.6, 44.0) | ran | `04_passwords.py` |
| passwords | a random salt per password | book | API Security in Action ch. 3 p. 78 |
| sessions-csrf | Set-Cookie flags, a 43 character id, HttpOnly hides from script, fixation works when the id is kept and fails with a new one | ran | `05_sessions_csrf.py` (browser is a model) |
| sessions-csrf | CSRF succeeds with SameSite=None and no defence, and fails with Lax (401), a token (403) and an Origin check (403) | ran | `05_sessions_csrf.py` (browser is a model) |
| sessions-csrf | Secure and HttpOnly on security cookies, new id at login, SameSite, CSRF header check and tokens | book | API Security in Action p. 122, 4.3.1 p. 119, p. 127; Web Application Security ch. 11 p. 131, ch. 23 p. 247, 249 |
| jwt | structure of a JWT, payload readable, edited payload fails, alg none and RSA public key as HMAC secret forge a token past a trusting verifier and not past a careful one | ran | `06_jwt.py` |
| jwt | exp, aud and iss checks; a secret of `secret` found on the 4th guess; revocation list | ran | `06_jwt.py` |
| jwt | the lab signs the same token as Python, byte for byte | ran | `verify_jwt.mts` |
| jwt | alg none and algorithm confusion | author | not checked against a book |
| jwt | standard claims, revocation | book | API Security in Action p. 187, 6.5 p. 209 |
| oauth | six messages in order, code used once, scope limits the token, a thief gets a token only without PKCE, prefix redirect_uri leaks the code, exact comparison refuses, four id_token checks | ran | `07_oauth.py` (toy authorization server) |
| oauth | PKCE, redirect_uri exact match, state, nonce | book | OAuth 2 in Action p. 174, 158, 3.2.3 p. 51, p. 248 |
| injection | `' OR '1'='1`, `admin' --`, UNION, a blind read of an 11 character password in 85 requests, parameters stop all of it, a column name needs an allow list, `shell=True` runs a second command | ran | `08_injection.py` (SQLite in memory, the shell of Windows) |
| injection | SQL, command injection and their defences | book | Web Application Security ch. 13 p. 147, 155, ch. 25 p. 259 to 265 |
| xss | a comment becomes a `script` element; quote, script block and link contexts; allow list sanitizer; a nonce CSP blocks, `unsafe-inline` lets it run | ran | `09_xss.py` (Python's html.parser, the CSP is a model) |
| xss | stored XSS, encoding, hyperlinks, CSP | book | Web Application Security ch. 10 p. 121, ch. 22 p. 239, 240, 242 |
| access-control | IDOR, a hidden button without an endpoint check, mass assignment, `../`, 5 of 7 spellings of an address pass a text blocklist, pickle runs code, Python's XML parser does not follow an external entity | ran | `10_access_control.py` |
| access-control | least authority, SSRF, path traversal in secrets, XXE | book | API Security in Action p. 46, 354, 361, 420; Web Application Security ch. 12 p. 141 |
| supply-chain-secrets | `^1.2.0` and `~1.2.0` pick 1.9.9 and 1.2.3 and `^` moves to 1.9.10; a hash catches a file with one line added; names within 2 edits; a deleted key is still in history; the scanner finds shape and entropy | ran | `11_supply_chain_secrets.py` |
| supply-chain-secrets | secure package management, dependencies and CVEs | book | Web Application Security ch. 27 p. 278, ch. 15 p. 180 |
| dos-rate-limit | `(a+)+$` doubles with every letter (1,048,576 at 20); the real `re` 16 times slower for 4 letters; token bucket, fixed and sliding window, lockout, 138.9 days for a 6 digit PIN at 5 a minute | ran | `12_dos_rate_limit.py` |
| dos-rate-limit | ReDoS, logical DoS, DDoS and defence | book | Web Application Security ch. 14 p. 162, 164, 167, ch. 26 p. 270 (DDoS not run) |
| capstone | ten exploits all work with no fix and none with all fixes; one fix closes only its own hole (90 cells open); seven honest uses work | ran | `13_capstone.py` |
| capstone | the CSRF fix hid the mass assignment hole when the attack sent no token | author | found while writing the exercise |
| every lesson | the order in which to fix, the choice between a session cookie and a JWT, four random words as a password | author | |

## Not run

A real browser (SameSite, CSP, a script that runs, mutation XSS, DOM XSS), a real network and a real TLS server, certificates with several levels and revocation, bcrypt and Argon2,
a real OAuth provider and JWKS, other databases (MySQL, PostgreSQL) and NoSQL, DNS rebinding and redirects in SSRF, `git filter-repo`, a real scanner, DDoS, and anything in production.
