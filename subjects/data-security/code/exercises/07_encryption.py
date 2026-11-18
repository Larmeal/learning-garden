"""Lesson 7: encrypting data at rest. Field level encryption, a key for each table wrapped by a master key, key rotation and crypto shredding.

Asserts that AES-GCM with the row id as associated data refuses a ciphertext moved to another row, that deterministic encryption (AES-SIV) shows which rows are equal
while random encryption does not, that envelope encryption lets a key rotation re-wrap 3 data keys instead of re-encrypting every row (bytes touched are counted),
that throwing away a data key makes its rows unreadable even from a backup, and that none of this stops a query that runs as the application. Real `cryptography` 47.0.0.
`--write` saves the sizes for the lab (site/src/components/labs/data-security/envelope.json).
"""

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from cryptography.exceptions import InvalidTag  # noqa: E402
from cryptography.hazmat.primitives.ciphers.aead import AESGCM, AESSIV  # noqa: E402
from dslab import check, done, show  # noqa: E402
from people import population  # noqa: E402

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "site" / "src" / "components" / "labs" / "data-security" / "envelope.json"

people = population(300)
ssn = {p.pid: f"{(p.pid * 104729) % 10**9:09d}" for p in people}  # a made up 9 digit national number per person

# ---- 1. encrypt one column, bind each value to its row ----
dek = AESGCM.generate_key(256)  # data encryption key
gcm = AESGCM(dek)


def enc(pid: int, value: str) -> bytes:
    nonce = os.urandom(12)
    return nonce + gcm.encrypt(nonce, value.encode(), str(pid).encode())  # the row id is associated data


def dec(pid: int, blob: bytes) -> str:
    return gcm.decrypt(blob[:12], blob[12:], str(pid).encode()).decode()


table = {pid: enc(pid, v) for pid, v in ssn.items()}
check("every value decrypts to the original with the right row id", all(dec(pid, blob) == ssn[pid] for pid, blob in table.items()))
check("a 9 character value becomes 37 bytes: 12 for the nonce, 9 for the text and 16 for the tag", len(table[1]) == 12 + 9 + 16)
swapped = table[2]
try:
    dec(1, swapped)
    moved = True
except InvalidTag:
    moved = False
check("copying the ciphertext of row 2 into row 1 is detected (InvalidTag), because the row id is part of what the tag covers", not moved)
check("two encryptions of the same value differ (random nonce), so an attacker cannot see which rows hold equal values", enc(1, "123") != enc(1, "123"))

# ---- 2. deterministic encryption keeps equality visible, on purpose or by accident ----
siv = AESSIV(AESSIV.generate_key(512))
same = [siv.encrypt(p.diagnosis.encode(), None) for p in people]
distinct_plain = len({p.diagnosis for p in people})
distinct_siv = len(set(same))
check("with AES-SIV the number of different ciphertexts equals the number of different diagnoses (7): equality is visible, so a search on the encrypted column works", distinct_siv == distinct_plain == 7)
counts = {}
for c, p in zip(same, people):
    counts.setdefault(c, []).append(p.diagnosis)
top = max(counts.values(), key=len)
check("and the most common ciphertext belongs to the most common diagnosis, which an attacker who knows the outline of the data can name (frequency analysis)", top[0] == "flu")
random_enc = {enc(p.pid, p.diagnosis)[12:] for p in people}
check("random encryption of the same column gives 300 different ciphertexts, and no search is possible without decrypting", len(random_enc) == 300)

# ---- 3. envelope: a key per table, wrapped by a master key ----
kek = AESGCM.generate_key(256)  # key encryption key, kept in a KMS or an HSM in real systems
wrap = lambda k, key: (lambda n: n + AESGCM(k).encrypt(n, key, b"dek"))(os.urandom(12))  # noqa: E731
unwrap = lambda k, blob: AESGCM(k).decrypt(blob[:12], blob[12:], b"dek")  # noqa: E731
tables = {name: AESGCM.generate_key(256) for name in ("customers", "orders", "tickets")}
wrapped = {name: wrap(kek, key) for name, key in tables.items()}
rows_per_table = {"customers": 100_000, "orders": 2_000_000, "tickets": 400_000}
check("a wrapped data key is 60 bytes (12 nonce, 32 key, 16 tag)", all(len(w) == 60 for w in wrapped.values()))
check("the master key unwraps each data key", all(unwrap(kek, wrapped[n]) == tables[n] for n in tables))

# rotate the master key
new_kek = AESGCM.generate_key(256)
rewrapped = {n: wrap(new_kek, unwrap(kek, w)) for n, w in wrapped.items()}
bytes_touched_envelope = sum(len(w) for w in rewrapped.values())
bytes_touched_direct = sum(rows * 37 for rows in rows_per_table.values())  # re-encrypt every 9 character value (37 bytes) with a new key
show("rotating the master key", f"envelope: {bytes_touched_envelope} bytes re-written; direct: {bytes_touched_direct:,} bytes (2.5 million rows of 37 bytes)")
check("with envelope encryption a master key rotation rewrites 180 bytes (3 wrapped keys) and no row", bytes_touched_envelope == 180)
check("without it every one of the 2,500,000 values would be decrypted and encrypted again (92,500,000 bytes)", bytes_touched_direct == 92_500_000)
check("the data keys are unchanged, so the rows still decrypt", all(unwrap(new_kek, rewrapped[n]) == tables[n] for n in tables))
try:
    unwrap(kek, rewrapped["customers"])
    old_works = True
except InvalidTag:
    old_works = False
check("and the old master key no longer unwraps anything", not old_works)

# ---- 4. crypto shredding: forgetting a key forgets the data, backups included ----
keystore = {"customers": AESGCM.generate_key(256)}
customers = AESGCM(keystore["customers"])
rows_enc = {}
for pid, v in ssn.items():
    n = os.urandom(12)
    rows_enc[pid] = n + customers.encrypt(n, v.encode(), str(pid).encode())
backup = dict(rows_enc)  # a copy on tape, never touched again
read = lambda pid, blob: AESGCM(keystore["customers"]).decrypt(blob[:12], blob[12:], str(pid).encode()).decode()  # noqa: E731
check("with the key in the key store the live table and its backup both read normally", read(1, rows_enc[1]) == ssn[1] and read(1, backup[1]) == ssn[1])
del keystore["customers"]
try:
    read(1, backup[1])
    readable = True
except KeyError:
    readable = False
check("after the key is deleted from the key store, no row of the table or of its backup can be read (the key is not there to ask for)", not readable)
try:
    AESGCM(AESGCM.generate_key(256)).decrypt(backup[1][:12], backup[1][12:], b"1")
    guessed = True
except InvalidTag:
    guessed = False
check("and a different key does not decrypt the backup either (InvalidTag), so erasing 32 bytes of key erased 300 rows in every copy", not guessed)

# ---- 5. what encryption at rest does not do ----
import sqlite3  # noqa: E402

db = sqlite3.connect(":memory:")
db.execute("CREATE TABLE people (pid INTEGER PRIMARY KEY, ssn BLOB)")
db.executemany("INSERT INTO people VALUES (?, ?)", list(table.items()))


def app_lookup(expr: str):
    """The application decrypts every row it selects, because it holds the key. The attacker controls the WHERE clause (an injection, lesson 8 of Application Security)."""
    rows = db.execute(f"SELECT pid, ssn FROM people WHERE {expr}").fetchall()
    return [dec(pid, blob) for pid, blob in rows]


check("a normal lookup returns one decrypted value", app_lookup("pid = 1") == [ssn[1]])
leaked = app_lookup("pid = 1 OR 1 = 1")
check("an injected condition makes the application decrypt and return all 300 values: encryption at rest protects the disk and the backup tape, not a query that runs as the application", leaked == [ssn[pid] for pid in sorted(ssn)])

if "--write" in sys.argv:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"valueBytes": len(table[1]), "wrappedBytes": 60, "rows": rows_per_table, "envelopeBytes": bytes_touched_envelope, "directBytes": bytes_touched_direct, "example": {"nonce": table[1][:12].hex(), "cipher": table[1][12:].hex()[:18] + "..."}}, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")
done()
