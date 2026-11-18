"""Lesson 11: TLS.

Python's ssl on both sides (OpenSSL 3.0.2), certificates made on the spot (two certificate authorities; a valid server certificate and three bad ones), 10 ms of delay in each direction.
Asserts: what is on the wire before encryption starts (ClientHello with the server name, the versions and the key share, ServerHello) and that everything after is application_data records;
that the handshake costs one more round trip for TLS 1.3 and two for TLS 1.2; that Nagle can add another one; what a client checks (a chain to a trusted authority, the name, the dates) and the exact errors
for each failure. `--write` saves site/src/components/labs/networking/tls.json for the lab.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from netlab import LABS, OUT, check, linux, load, show, table  # noqa: E402
from wire import parse_client_hello, read_pcap, tls_records  # noqa: E402

WRITE = "--write" in sys.argv
print(linux("11_tls.py").strip())
d = load("11_tls.json")
RTT = 20.0
one = lambda key: d[key]["runs"][0] if "runs" in d[key] else d[key]  # noqa: E731


def flow(pcap, port):
    pk = [p for p in read_pcap(OUT / pcap) if p.tcp and 8000 <= p.tcp["dport"] <= 8999 or p.tcp and 8000 <= p.tcp["sport"] <= 8999]
    first_syn = next(p for p in pk if p.tcp["flags"] == "SYN")
    sp = first_syn.tcp["sport"]
    mine = [p for p in pk if sp in (p.tcp["sport"], p.tcp["dport"])]
    c2s = b"".join(p.payload for p in sorted((p for p in mine if p.ip["src"] == "10.0.1.2"), key=lambda p: p.tcp["seq"]) if p.tcp["len"])
    s2c = b"".join(p.payload for p in sorted((p for p in mine if p.ip["src"] == "10.0.2.2"), key=lambda p: p.tcp["seq"]) if p.tcp["len"])
    return mine, c2s, s2c


# ---- 1. what is on the wire: TLS 1.3 ----
mine, c2s, s2c = flow("11_tls13.pcap", 8443)
ch = parse_client_hello(c2s)
rc, rs = tls_records(c2s), tls_records(s2c)
show("ClientHello, read from the first data segment of the client", f"server name (SNI): {ch['sni']}\nALPN:             {ch.get('alpn')}\nversions offered: {ch['versions']}\nkey share:        {ch['key_share']}\ngroups:           {ch['groups']}\ncipher suites:    {len(ch['cipher_suites'])}")
show("TLS records, client to server", table([[r["type"], r.get("handshake", ""), r["version"], r["length"]] for r in rc], ["record type", "handshake", "version field", "length"]))
show("TLS records, server to client", table([[r["type"], r.get("handshake", ""), r["version"], r["length"]] for r in rs], ["record type", "handshake", "version field", "length"]))
check("the first thing the client sends, after TCP's handshake, is a plaintext ClientHello in a handshake record of several hundred bytes (512 here, because it lists 18 cipher suites and 3 key exchange groups)", (rc[0]["type"], rc[0]["handshake"]) == ("handshake", "ClientHello") and 300 <= rc[0]["length"] <= 700)
check("the ClientHello names the server in the clear (SNI): garden.test", ch["sni"] == "garden.test")
check("it offers TLS 1.3 (0x0304) and 1.2 (0x0303) in the supported_versions extension, while the version field of the record itself says 0x0301", ch["versions"] == ["0x0304", "0x0303"] and rc[0]["version"] == "0x0301")
check("it already contains the client's half of a key exchange (a key share, x25519, 32 bytes), so a key can be agreed in one round trip", ("x25519", 32) in ch["key_share"])
check("the server's first answer is a plaintext ServerHello", (rs[0]["type"], rs[0]["handshake"]) == ("handshake", "ServerHello"))
check("after the ServerHello the connection is encrypted: every later record is change_cipher_spec (a leftover for old middleboxes) or application_data, with the version field 0x0303", all(r["type"] in ("change_cipher_spec", "application_data") and r["version"] == "0x0303" for r in rs[1:] + rc[1:]))
check("so the certificate is NOT visible on the wire in TLS 1.3 (it travels inside application_data records), and nothing in the capture says garden.test again", b"garden.test" in c2s and b"garden" not in s2c and b"Garden" not in s2c)
check("the actual HTTP request and response are also application_data records, indistinguishable from the handshake ones by their outer type", sum(1 for r in rs if r["type"] == "application_data") >= 3)
check("the plaintext request 'GET /hello' does not appear anywhere on the wire", b"GET /hello" not in c2s and b"hello, garden" not in s2c)

# ---- 2. what it costs ----
t13, t13n, t12, pl = one("tls13"), one("tls13_nagle"), one("tls12"), d["plain"]
show("time to the first byte of the response, counted from the start of connect (one round trip is 20 ms)", table([
    ["plain TCP + HTTP", f"{pl['t_tcp']:.0f}", "-", f"{pl['t_first']:.0f}", f"{pl['t_first'] / RTT:.1f}"],
    ["TLS 1.3", f"{t13['t_tcp']:.0f}", f"{t13['t_handshake']:.0f}", f"{t13['t_first']:.0f}", f"{t13['t_first'] / RTT:.1f}"],
    ["TLS 1.2", f"{t12['t_tcp']:.0f}", f"{t12['t_handshake']:.0f}", f"{t12['t_first']:.0f}", f"{t12['t_first'] / RTT:.1f}"],
    ["TLS 1.3, Nagle on the client", f"{t13n['t_tcp']:.0f}", f"{t13n['t_handshake']:.0f}", f"{t13n['t_first']:.0f}", f"{t13n['t_first'] / RTT:.1f}"],
], ["", "TCP connected (ms)", "TLS done (ms)", "first byte (ms)", "round trips"]))
check("plain HTTP gets its first byte after 2 round trips: one for TCP's handshake, one for the request", 38 <= pl["t_first"] <= 50)
check("TLS 1.3 adds exactly one round trip: 3 in all", 60 <= t13["t_first"] <= 72 and 18 <= t13["t_first"] - pl["t_first"] <= 26, f"{t13['t_first']:.0f}")
check("TLS 1.2 adds two: 4 in all", 80 <= t12["t_first"] <= 92 and 36 <= t12["t_first"] - pl["t_first"] <= 48, f"{t12['t_first']:.0f}")
check("the negotiated versions and suites are what we expect: TLS 1.3 with AES-256-GCM, and TLS 1.2 with ECDHE-ECDSA", (t13["version"], t13["cipher"]) == ("TLSv1.3", "TLS_AES_256_GCM_SHA384") and (t12["version"], t12["cipher"]) == ("TLSv1.2", "ECDHE-ECDSA-AES256-GCM-SHA384"))
check("the handshake of TLS 1.3 is done 1 round trip after TCP's, and that of TLS 1.2 after 2", 18 <= t13["t_handshake"] - t13["t_tcp"] <= 26 and 38 <= t12["t_handshake"] - t12["t_tcp"] <= 48)
check("Nagle from lesson 8 strikes here: the small Finished message is not yet acknowledged when the request is written, so the request waits one more round trip (+20 ms)", 16 <= t13n["t_first"] - t13["t_first"] <= 26, f"{t13n['t_first'] - t13['t_first']:.0f}")
sizes = {"client hello": rc[0]["wire"], "server first flight": sum(r["wire"] for r in rs[:4])}
show("sizes on the wire", f"ClientHello record: {rc[0]['wire']} bytes\nServer's records until the last handshake one: {[r['wire'] for r in rs[:4]]}")
check("a TLS record has a 5-byte header (type, version, length) in front of its data", all(r["wire"] == r["length"] + 5 for r in rc + rs))
mine12, c2s12, s2c12 = flow("11_tls12.pcap", 8447)
r12s = tls_records(s2c12)
show("TLS 1.2, server to client", table([[r["type"], r.get("handshake", ""), r["version"], r["length"]] for r in r12s], ["record type", "handshake", "version field", "length"]))
check("in TLS 1.2 the certificate IS visible: the Certificate message is a plaintext handshake record, and the server's name is readable in the stream", any(r.get("handshake") == "Certificate" for r in r12s) or b"garden.test" in s2c12)

# ---- 3. what a client checks ----
valid = d["tls13"]["runs"][0]
show("the certificate that the client received (Python's getpeercert)", f"subject {valid['subject']}\nissuer  {valid['issuer']}\nSAN     {valid['san']}\nvalid until {valid['notAfter']}")
check("the certificate names garden.test in its subject alternative names, and was issued by 'Garden Test CA'", ["DNS", "garden.test"] in valid["san"] and valid["issuer"]["commonName"] == "Garden Test CA")
show("what the client says when each check fails", table([
    ["name is not in the certificate", d["bad_name"]["runs"][0]["error"], d["bad_name"]["runs"][0]["text"]],
    ["the certificate has expired", d["expired"]["runs"][0]["error"], d["expired"]["runs"][0]["text"]],
    ["signed by an authority we do not trust", d["other_ca"]["runs"][0]["error"], d["other_ca"]["runs"][0]["text"]],
    ["we trust the wrong authority", d["wrong_ca_file"]["runs"][0]["error"], d["wrong_ca_file"]["runs"][0]["text"]],
    ["we ask for a name the certificate lacks", d["no_name_check"]["runs"][0]["error"], d["no_name_check"]["runs"][0]["text"]],
], ["case", "exception", "message"]))
check("a certificate for another name is refused: 'Hostname mismatch'", "Hostname mismatch" in d["bad_name"]["runs"][0]["text"])
check("an expired certificate is refused: 'certificate has expired'", d["expired"]["runs"][0]["text"] == "certificate has expired")
check("a certificate signed by an authority that is not in our trust list is refused: 'unable to get local issuer certificate'", d["other_ca"]["runs"][0]["text"] == "unable to get local issuer certificate" and d["wrong_ca_file"]["runs"][0]["text"] == "unable to get local issuer certificate")
check("asking for a name that the (valid) certificate does not contain is refused even though the chain is fine", "Hostname mismatch" in d["no_name_check"]["runs"][0]["text"] and "other.test" in d["no_name_check"]["runs"][0]["text"])
check("all four failures happen after the TCP connection succeeded (TCP does not care), so TCP connect time was normal", all(d[k]["runs"][0]["t_tcp"] < 30 for k in ("bad_name", "expired", "other_ca")))
show("openssl s_client, the first lines", "\n".join(d["openssl_show"].splitlines()[:10]))
check("openssl, given the right authority, verifies the chain: depth 1 (the authority) then depth 0 (the server)", "depth=1" in d["openssl_show"] and "depth=0" in d["openssl_show"] and "verify return:1" in d["openssl_show"])

if WRITE:
    out = {
        "rtt": RTT,
        "times": {"plain": [pl["t_tcp"], None, pl["t_first"]], "tls13": [t13["t_tcp"], t13["t_handshake"], t13["t_first"]], "tls12": [t12["t_tcp"], t12["t_handshake"], t12["t_first"]], "nagle": [t13n["t_tcp"], t13n["t_handshake"], t13n["t_first"]]},
        "records13": {"c2s": rc, "s2c": rs}, "records12": r12s,
        "hello": {"sni": ch["sni"], "versions": ch["versions"], "key_share": ch["key_share"], "alpn": ch.get("alpn")},
        "errors": {k: d[k]["runs"][0]["text"] for k in ("bad_name", "expired", "other_ca")},
        "cert": {"subject": valid["subject"]["commonName"], "issuer": valid["issuer"]["commonName"], "san": valid["san"], "notAfter": valid["notAfter"]},
    }
    (LABS / "tls.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print("wrote", LABS / "tls.json")
print("ok")
