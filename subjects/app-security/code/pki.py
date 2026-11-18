"""A tiny certificate authority for the TLS exercise: makes a root CA and server certificates signed by it, in memory and in a temp folder."""

from __future__ import annotations

import datetime as dt
import ssl
import tempfile
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID

DIR = Path(tempfile.gettempdir()) / "app-security-lab"
NOW = dt.datetime(2026, 11, 1, tzinfo=dt.timezone.utc)


def _name(cn: str) -> x509.Name:
    return x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)])


def make_ca(cn: str = "Lab Root CA"):
    key = ec.generate_private_key(ec.SECP256R1())
    cert = (
        x509.CertificateBuilder()
        .subject_name(_name(cn))
        .issuer_name(_name(cn))
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(NOW - dt.timedelta(days=1))
        .not_valid_after(NOW + dt.timedelta(days=3650))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True, key_cert_sign=True, crl_sign=True, content_commitment=False, key_encipherment=False,
                data_encipherment=False, key_agreement=False, encipher_only=False, decipher_only=False,
            ),
            critical=True,
        )
        .sign(key, hashes.SHA256())
    )
    return key, cert


def make_server_cert(ca_key, ca_cert, host: str, days: int = 90, start: dt.datetime | None = None):
    key = ec.generate_private_key(ec.SECP256R1())
    begin = start or (NOW - dt.timedelta(days=1))
    cert = (
        x509.CertificateBuilder()
        .subject_name(_name(host))
        .issuer_name(ca_cert.subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(begin)
        .not_valid_after(begin + dt.timedelta(days=days))
        .add_extension(x509.SubjectAlternativeName([x509.DNSName(host)]), critical=False)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(ca_key, hashes.SHA256())
    )
    return key, cert


def pem(cert) -> str:
    return cert.public_bytes(serialization.Encoding.PEM).decode()


def server_context(key, cert) -> ssl.SSLContext:
    DIR.mkdir(exist_ok=True)
    cert_path, key_path = DIR / "server.crt", DIR / "server.key"
    cert_path.write_text(pem(cert))
    key_path.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(str(cert_path), str(key_path))
    return ctx


def client_context(*trusted) -> ssl.SSLContext:
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = True
    ctx.verify_mode = ssl.CERT_REQUIRED
    for cert in trusted:
        ctx.load_verify_locations(cadata=pem(cert))
    return ctx


def handshake(server_ctx: ssl.SSLContext, client_ctx: ssl.SSLContext, hostname: str):
    """Run a TLS handshake between two in-memory endpoints. Returns (flights, client_obj, error).

    A flight is one burst of bytes from one side, so the list shows who spoke in turn and how many bytes each said.
    """
    c_in, c_out = ssl.MemoryBIO(), ssl.MemoryBIO()
    s_in, s_out = ssl.MemoryBIO(), ssl.MemoryBIO()
    client = client_ctx.wrap_bio(c_in, c_out, server_hostname=hostname)
    server = server_ctx.wrap_bio(s_in, s_out, server_side=True)
    flights: list[tuple[str, int]] = []
    done_c = done_s = False
    for _ in range(12):
        for who, obj, out, peer_in in (("client", client, c_out, s_in), ("server", server, s_out, c_in)):
            try:
                obj.do_handshake()
                if who == "client":
                    done_c = True
                else:
                    done_s = True
            except ssl.SSLWantReadError:
                pass
            except ssl.SSLError as exc:
                data = out.read()
                if data:
                    flights.append((who, len(data)))
                return flights, client, exc
            data = out.read()
            if data:
                flights.append((who, len(data)))
                peer_in.write(data)
        if done_c and done_s:
            break
    return flights, client, None
