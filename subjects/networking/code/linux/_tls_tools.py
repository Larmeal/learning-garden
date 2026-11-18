"""TLS programs for exercise 11 (Python ssl and cryptography of the Linux in WSL).

  pki OUTDIR                             make two certificate authorities and four server certificates (valid, wrong name, expired, signed by the other CA)
  server PORT CERT KEY [tls12]           a TLS server that answers every request with a small HTTP response (tls12: allow only TLS 1.2)
  plain_server PORT                      the same without TLS
  client HOST PORT CA NAME [tls12|tls13] [resume]   connect with verification, print JSON of what was seen and how long each step took
  plain_client HOST PORT                 the same request without TLS, with timings
"""
import datetime
import json
import os
import socket
import ssl
import sys
import threading
import time

REQ = b"GET /hello HTTP/1.1\r\nHost: garden.test\r\nConnection: close\r\n\r\n"
BODY = b"hello, garden\n"
RESP = b"HTTP/1.1 200 OK\r\nContent-Length: %d\r\nConnection: close\r\n\r\n" % len(BODY) + BODY
mode = sys.argv[1]


def pki(outdir):
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.x509.oid import NameOID

    now = datetime.datetime.utcnow()

    def key():
        return ec.generate_private_key(ec.SECP256R1())

    def name(cn):
        return x509.Name([x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Garden Lab"), x509.NameAttribute(NameOID.COMMON_NAME, cn)])

    def pem_key(k):
        return k.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())

    def ca(cn):
        k = key()
        c = (x509.CertificateBuilder().subject_name(name(cn)).issuer_name(name(cn)).public_key(k.public_key()).serial_number(x509.random_serial_number())
             .not_valid_before(now - datetime.timedelta(days=1)).not_valid_after(now + datetime.timedelta(days=3650))
             .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
             .add_extension(x509.KeyUsage(digital_signature=True, key_cert_sign=True, crl_sign=True, content_commitment=False, key_encipherment=False, data_encipherment=False, key_agreement=False, encipher_only=False, decipher_only=False), critical=True)
             .sign(k, hashes.SHA256()))
        return k, c

    def leaf(ca_key, ca_cert, dns, start, end, serial):
        k = key()
        c = (x509.CertificateBuilder().subject_name(name(dns)).issuer_name(ca_cert.subject).public_key(k.public_key()).serial_number(serial)
             .not_valid_before(start).not_valid_after(end)
             .add_extension(x509.SubjectAlternativeName([x509.DNSName(dns), x509.IPAddress(__import__("ipaddress").ip_address("10.0.2.2"))]), critical=False)
             .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
             .sign(ca_key, hashes.SHA256()))
        return k, c

    os.makedirs(outdir, exist_ok=True)
    ca1k, ca1 = ca("Garden Test CA")
    ca2k, ca2 = ca("Other Test CA")
    items = {
        "valid": leaf(ca1k, ca1, "garden.test", now - datetime.timedelta(days=1), now + datetime.timedelta(days=90), 1001),
        "wrongname": leaf(ca1k, ca1, "other.test", now - datetime.timedelta(days=1), now + datetime.timedelta(days=90), 1002),
        "expired": leaf(ca1k, ca1, "garden.test", now - datetime.timedelta(days=30), now - datetime.timedelta(days=1), 1003),
        "other": leaf(ca2k, ca2, "garden.test", now - datetime.timedelta(days=1), now + datetime.timedelta(days=90), 1004),
    }
    for n, c in (("ca1", ca1), ("ca2", ca2)):
        open(os.path.join(outdir, n + ".pem"), "wb").write(c.public_bytes(serialization.Encoding.PEM))
    for n, (k, c) in items.items():
        open(os.path.join(outdir, n + ".pem"), "wb").write(c.public_bytes(serialization.Encoding.PEM))
        open(os.path.join(outdir, n + ".key"), "wb").write(pem_key(k))
    print(json.dumps({"made": sorted(items) + ["ca1", "ca2"]}))


def serve(port, tls_ctx):
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("0.0.0.0", port))
    s.listen(16)
    print("listening", flush=True)

    def handle(c):
        try:
            if tls_ctx:
                c = tls_ctx.wrap_socket(c, server_side=True)
            c.recv(4096)
            c.sendall(RESP)
            c.close()
        except Exception:
            pass

    while True:
        c, _ = s.accept()
        c.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        threading.Thread(target=handle, args=(c,), daemon=True).start()


def client(host, port, ca, sni, ver, resume, nagle=False):
    ctx = ssl.create_default_context(cafile=ca)
    if ver == "tls12":
        ctx.maximum_version = ssl.TLSVersion.TLSv1_2
    elif ver == "tls13":
        ctx.minimum_version = ssl.TLSVersion.TLSv1_3
    out = {"runs": []}
    session = None
    for i in range(2 if resume else 1):
        r = {}
        t0 = time.perf_counter()
        raw = socket.create_connection((host, port))
        if not nagle:
            raw.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        r["t_tcp"] = round((time.perf_counter() - t0) * 1000, 1)
        try:
            c = ctx.wrap_socket(raw, server_hostname=sni, session=session)
        except ssl.SSLError as e:
            r["error"] = type(e).__name__
            r["text"] = getattr(e, "verify_message", None) or str(e)
            r["code"] = getattr(e, "verify_code", None)
            out["runs"].append(r)
            break
        r["t_handshake"] = round((time.perf_counter() - t0) * 1000, 1)
        c.sendall(REQ)
        r["version"] = c.version()
        r["cipher"] = c.cipher()[0]
        cert = c.getpeercert()
        r["subject"] = dict(x[0] for x in cert["subject"])
        r["issuer"] = dict(x[0] for x in cert["issuer"])
        r["san"] = [list(x) for x in cert["subjectAltName"]]
        r["notAfter"] = cert["notAfter"]
        data = b""
        while True:
            d = c.recv(4096)
            if not d:
                break
            data += d
            if r.get("t_first") is None:
                r["t_first"] = round((time.perf_counter() - t0) * 1000, 1)
        r["reused"] = bool(c.session_reused)
        r["ticket"] = bool(c.session.has_ticket)
        r["bytes"] = len(data)
        session = c.session
        c.close()
        out["runs"].append(r)
    print(json.dumps(out), flush=True)


def plain_client(host, port):
    t0 = time.perf_counter()
    c = socket.create_connection((host, port))
    c.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    t_tcp = round((time.perf_counter() - t0) * 1000, 1)
    c.sendall(REQ)
    first, data = None, b""
    while True:
        d = c.recv(4096)
        if not d:
            break
        data += d
        if first is None:
            first = round((time.perf_counter() - t0) * 1000, 1)
    print(json.dumps({"t_tcp": t_tcp, "t_first": first, "bytes": len(data)}), flush=True)


if mode == "pki":
    pki(sys.argv[2])
elif mode == "server":
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(sys.argv[3], sys.argv[4])
    if len(sys.argv) > 5 and sys.argv[5] == "tls12":
        ctx.maximum_version = ssl.TLSVersion.TLSv1_2
    serve(int(sys.argv[2]), ctx)
elif mode == "plain_server":
    serve(int(sys.argv[2]), None)
elif mode == "client":
    client(sys.argv[2], int(sys.argv[3]), sys.argv[4], sys.argv[5], sys.argv[6] if len(sys.argv) > 6 and sys.argv[6] in ("tls12", "tls13") else "", "resume" in sys.argv[6:], "nagle" in sys.argv[6:])
elif mode == "plain_client":
    plain_client(sys.argv[2], int(sys.argv[3]))
