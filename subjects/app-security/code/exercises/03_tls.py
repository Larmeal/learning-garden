"""Lesson 3: TLS and certificates, run with real certificates made by a tiny CA and a handshake between two in-memory endpoints.

Asserts that a client that trusts our CA completes a TLS 1.3 handshake in three flights, that the same certificate is refused
when the client does not trust the CA, when the name does not match and when the certificate is expired, that the certificate chain
is certificate -> root, and that two sides derive the same secret with X25519 without ever sending it.
"""

import datetime as dt
import ssl
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from cryptography.hazmat.primitives.asymmetric.ec import ECDSA  # noqa: E402
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey  # noqa: E402
from cryptography.hazmat.primitives.hashes import SHA256  # noqa: E402
from pki import NOW, client_context, handshake, make_ca, make_server_cert, server_context  # noqa: E402
from seclab import check, done, show  # noqa: E402

HOST = "shop.example.test"
ca_key, ca_cert = make_ca()
srv_key, srv_cert = make_server_cert(ca_key, ca_cert, HOST)
server = server_context(srv_key, srv_cert)

# ---- 1. a good handshake ----
flights, client, err = handshake(server, client_context(ca_cert), HOST)
show("handshake flights (who spoke, how many bytes)", flights)
check("the handshake finished without an error", err is None)
check("the connection is TLS 1.3", client.version() == "TLSv1.3")
cipher = client.cipher()
show("cipher chosen", cipher)
check("the cipher is an AEAD suite (AES-GCM or ChaCha20-Poly1305)", cipher[0] in {"TLS_AES_256_GCM_SHA384", "TLS_AES_128_GCM_SHA256", "TLS_CHACHA20_POLY1305_SHA256"})
show("OpenSSL of this Python", ssl.OPENSSL_VERSION)
check("the first three flights are client hello, server answer, client finished", [f[0] for f in flights[:3]] == ["client", "server", "client"])
check("the server answer is the biggest of the three because it carries the certificate", flights[1][1] > flights[0][1] and flights[1][1] > flights[2][1])
check("the server then sends one more flight (session tickets) after the handshake is done", [f[0] for f in flights] == ["client", "server", "client", "server"])
check("the client finished flight is tiny next to the server answer", flights[2][1] < 200)

# ---- 2. the same server is refused in three ways ----
_, _, e1 = handshake(server, client_context(), HOST)
show("client that trusts nobody", str(e1)[:80])
check("a client that does not trust our CA refuses the certificate", isinstance(e1, ssl.SSLCertVerificationError))
_, _, e2 = handshake(server, client_context(ca_cert), "evil.example.test")
show("client that expects another name", str(e2)[:80])
check("a certificate for another host name is refused", isinstance(e2, ssl.SSLCertVerificationError) and "match" in str(e2).lower())
old_key, old_cert = make_server_cert(ca_key, ca_cert, HOST, days=30, start=NOW - dt.timedelta(days=100))
_, _, e3 = handshake(server_context(old_key, old_cert), client_context(ca_cert), HOST)
show("client meets an expired certificate", str(e3)[:80])
check("an expired certificate is refused", isinstance(e3, ssl.SSLCertVerificationError) and "expired" in str(e3).lower())

# ---- 3. what a certificate says ----
check("the server certificate names the host", srv_cert.subject.rfc4514_string() == f"CN={HOST}")
check("it was signed by our CA (issuer is the CA subject)", srv_cert.issuer == ca_cert.subject)
ca_cert.public_key().verify(srv_cert.signature, srv_cert.tbs_certificate_bytes, ECDSA(srv_cert.signature_hash_algorithm))
check("the CA public key verifies the signature on the server certificate", True)
check("the root certificate signs itself (issuer equals subject)", ca_cert.issuer == ca_cert.subject)
check("the certificate lasts 90 days", (srv_cert.not_valid_after_utc - srv_cert.not_valid_before_utc).days == 90)
check("its fingerprint is a SHA-256 of 32 bytes", len(srv_cert.fingerprint(SHA256())) == 32)

# ---- 4. key exchange: two sides get one secret and never send it ----
a, b = X25519PrivateKey.generate(), X25519PrivateKey.generate()
secret_a = a.exchange(b.public_key())
secret_b = b.exchange(a.public_key())
check("both sides derive the same 32 byte secret from the other side's public value", secret_a == secret_b and len(secret_a) == 32)
check("the secret is not any of the values that were sent", secret_a not in (a.public_key().public_bytes_raw(), b.public_key().public_bytes_raw()))

# ---- 5. the same idea with numbers small enough to follow by hand (the key exchange lab uses these) ----
P, G = 23, 5
a_priv, b_priv = 6, 15
A_pub, B_pub = pow(G, a_priv, P), pow(G, b_priv, P)
show("toy Diffie-Hellman, p=23 g=5, Alice's secret 6, Bob's secret 15", f"Alice sends {A_pub}, Bob sends {B_pub}")
check("Alice sends 5^6 mod 23 = 8 and Bob sends 5^15 mod 23 = 19", (A_pub, B_pub) == (8, 19))
check("Alice computes 19^6 mod 23 and Bob computes 8^15 mod 23: both get 2", pow(B_pub, a_priv, P) == pow(A_pub, b_priv, P) == 2)
tries = next(k for k in range(1, P) if pow(G, k, P) == A_pub)
check("an eavesdropper who sees p, g, 8 and 19 finds Alice's secret by trying 1, 2, 3 ... and stops at 6 (with p this small)", tries == 6)
check("with p = 23 there are only 22 secrets to try, which is why real sizes are about 2^255 (X25519) or 2^2048", P - 1 == 22 and 2**255 > 10**76)
done()
