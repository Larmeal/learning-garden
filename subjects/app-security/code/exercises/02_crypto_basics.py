"""Lesson 2: the four building blocks. Hash, HMAC, authenticated encryption (AES-GCM) and a signature (Ed25519).

Asserts the SHA-256 digests the lesson prints, that one changed letter flips about half of the 256 bits (the exact count is printed
and fixed), that HMAC needs the key, that AES-GCM refuses a ciphertext with one flipped byte, that a signature fails on a changed
message, and that a 4 digit PIN falls in at most 10,000 guesses even though its hash cannot be reversed.
"""

import hashlib
import hmac
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from cryptography.exceptions import InvalidSignature, InvalidTag  # noqa: E402
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey  # noqa: E402
from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # noqa: E402
from seclab import check, done, show  # noqa: E402

# ---- 1. hash: same input same output, a small change changes everything ----
h1 = hashlib.sha256(b"pay bob 100").hexdigest()
h2 = hashlib.sha256(b"pay bob 900").hexdigest()
show("sha256('pay bob 100')", h1)
show("sha256('pay bob 900')", h2)
check("sha256 of the empty string is the well known e3b0c442...", hashlib.sha256(b"").hexdigest().startswith("e3b0c44298fc1c14"))
check("sha256('hello') is 2cf24dba...", hashlib.sha256(b"hello").hexdigest().startswith("2cf24dba5fb0a30e"))
bits = bin(int(h1, 16) ^ int(h2, 16)).count("1")
show("bits that differ between the two digests", f"{bits} of 256")
check("one changed character flips about half of 256 bits (the exact count is 133)", bits == 133)
check("the digest is 32 bytes (64 hex characters) whatever the input", len(h1) == 64 and len(hashlib.sha256(b"x" * 10_000).hexdigest()) == 64)

# ---- 2. a hash is not a lock: a short secret is guessed, not reversed ----
secret_pin = "7351"
target = hashlib.sha256(secret_pin.encode()).hexdigest()
tries = 0
for n in range(10_000):
    tries += 1
    if hashlib.sha256(f"{n:04d}".encode()).hexdigest() == target:
        break
show("guessing the PIN behind a sha256", f"found after {tries} tries")
check("a 4 digit PIN behind a plain hash is found in 7,352 tries", tries == 7352)
check("the most it can ever take is 10,000 tries", tries <= 10_000)

# ---- 3. HMAC: a hash that needs a key, so only a key holder can make or check the tag ----
key = b"k" * 32
msg = b"pay bob 100"
tag = hmac.new(key, msg, hashlib.sha256).hexdigest()
show("hmac-sha256(key, 'pay bob 100')", tag)
check("the same key and message give the same tag", hmac.new(key, msg, hashlib.sha256).hexdigest() == tag)
check("a different key gives a different tag", hmac.new(b"j" * 32, msg, hashlib.sha256).hexdigest() != tag)
check("a changed message gives a different tag", hmac.new(key, b"pay bob 900", hashlib.sha256).hexdigest() != tag)
check("an attacker without the key cannot compute it from the plain hash", tag != hashlib.sha256(msg).hexdigest())
check("compare_digest says equal for the real tag and not equal for a forged one", hmac.compare_digest(tag, tag) and not hmac.compare_digest(tag, "0" * 64))

# ---- 4. AES-GCM: encrypt and detect tampering in one step ----
aes_key = bytes(range(32))
nonce = bytes(range(12))
aes = AESGCM(aes_key)
plain = b"card 4111 1111 1111 1111"
box = aes.encrypt(nonce, plain, b"order-17")
show("AES-GCM ciphertext (hex)", box.hex())
check("ciphertext is the message plus a 16 byte tag", len(box) == len(plain) + 16)
check("the right key, nonce and associated data decrypt it", aes.decrypt(nonce, box, b"order-17") == plain)
flipped = bytes([box[0] ^ 1]) + box[1:]
try:
    aes.decrypt(nonce, flipped, b"order-17")
    rejected = False
except InvalidTag:
    rejected = True
check("one flipped bit makes decryption fail instead of returning wrong text", rejected)
try:
    aes.decrypt(nonce, box, b"order-18")
    wrong_ad = False
except InvalidTag:
    wrong_ad = True
check("the same ciphertext under another label (associated data) is refused too", wrong_ad)
same_nonce = aes.encrypt(nonce, b"AAAAAAAA", b"") 
same_nonce2 = aes.encrypt(nonce, b"AAAAAAAA", b"")
check("reusing a nonce with the same key gives the same ciphertext (the reason a nonce must be new each time)", same_nonce == same_nonce2)

# ---- 5. signature: anyone can check, only the key holder can make ----
private = Ed25519PrivateKey.from_private_bytes(bytes(range(32)))
public = private.public_key()
signature = private.sign(b"release 1.4.2")
show("Ed25519 signature (hex, 64 bytes)", signature.hex())
check("an Ed25519 signature is 64 bytes", len(signature) == 64)
public.verify(signature, b"release 1.4.2")
check("the public key verifies the real message", True)
try:
    public.verify(signature, b"release 1.4.3")
    forged = False
except InvalidSignature:
    forged = True
check("the same signature on a changed message does not verify", forged)

# ---- 6. what each block promises (the table of the lesson) ----
PROMISES = {
    "hash": {"confidentiality": False, "integrity": "only if the hash itself is safe", "authenticity": False},
    "hmac": {"confidentiality": False, "integrity": True, "authenticity": "between key holders"},
    "aes-gcm": {"confidentiality": True, "integrity": True, "authenticity": "between key holders"},
    "signature": {"confidentiality": False, "integrity": True, "authenticity": "to anyone with the public key"},
}
check("four blocks, and only AES-GCM keeps the content secret", [k for k, v in PROMISES.items() if v["confidentiality"] is True] == ["aes-gcm"])
done()
