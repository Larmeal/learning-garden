"""A small authoritative DNS server for the exercises (standard library only). Usage: _dnsd.py ZONE.json IP.

It answers from the records of one zone. For a name below a delegation it does not answer: it sends the NS records of the delegation (authority) and the addresses of those
name servers (additional, called glue), which is what a real root or TLD server does. Answers use the compression pointer 0xC00C for the name of the question."""
import json
import socket
import struct
import sys

zone = json.load(open(sys.argv[1]))
ip = sys.argv[2]
APEX = zone["zone"]
RECS = zone["records"]
TYPE = {"A": 1, "NS": 2, "CNAME": 5}
NAME = {v: k for k, v in TYPE.items()}


def enc(name):
    out = b""
    for label in name.rstrip(".").split("."):
        if label:
            out += bytes([len(label)]) + label.encode()
    return out + b"\x00"


def dec(msg, pos):
    labels = []
    while True:
        ln = msg[pos]
        if ln == 0:
            return ".".join(labels) + ".", pos + 1
        if ln & 0xC0 == 0xC0:
            return dec(msg, ((ln & 0x3F) << 8) | msg[pos + 1])[0], pos + 2
        labels.append(msg[pos + 1 : pos + 1 + ln].decode())
        pos += 1 + ln


def rr(name_bytes, rtype, ttl, value):
    if rtype == "A":
        rd = socket.inet_aton(value)
    else:
        rd = enc(value)
    return name_bytes + struct.pack("!HHIH", TYPE[rtype], 1, ttl, len(rd)) + rd


def suffix(name, apex):
    return name == apex or name.endswith("." + apex) or apex == "."


def answer(msg):
    ident, flags, qd = struct.unpack("!HHH", msg[:6])
    qname, pos = dec(msg, 12)
    qtype = struct.unpack("!H", msg[pos : pos + 2])[0]
    question = msg[12 : pos + 4]
    qn = qname.lower()
    ptr = b"\xc0\x0c"
    answers, authority, additional, rcode, aa = [], [], [], 0, 0
    # a delegation below the apex? (the longest NS owner that is a suffix of the question and not the apex itself)
    deleg = [r for r in RECS if r["type"] == "NS" and r["name"] != APEX and suffix(qn, r["name"])]
    if deleg:
        best = max((r["name"] for r in deleg), key=len)
        for r in deleg:
            if r["name"] == best:
                authority.append(rr(enc(r["name"]), "NS", r["ttl"], r["value"]))
                for g in RECS:
                    if g["type"] == "A" and g["name"] == r["value"]:
                        additional.append(rr(enc(g["name"]), "A", g.get("ttl", 172800), g["value"]))
    else:
        aa = 1
        name = qn
        seen = 0
        while seen < 4:
            seen += 1
            cn = [r for r in RECS if r["name"] == name and r["type"] == "CNAME"]
            if cn and qtype != TYPE["CNAME"]:
                answers.append(rr(ptr if name == qn else enc(name), "CNAME", cn[0]["ttl"], cn[0]["value"]))
                name = cn[0]["value"]
                continue
            hit = [r for r in RECS if r["name"] == name and TYPE.get(r["type"]) == qtype]
            for r in hit:
                answers.append(rr(ptr if name == qn else enc(name), r["type"], r["ttl"], r["value"]))
            break
        if not answers and not any(r["name"] == qn for r in RECS):
            rcode = 3
    hdr = struct.pack("!HHHHHH", ident, 0x8000 | (aa << 10) | (flags & 0x0100) | rcode, 1, len(answers), len(authority), len(additional))
    return hdr + question + b"".join(answers) + b"".join(authority) + b"".join(additional)


s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind((ip, 53))
print("listening", flush=True)
while True:
    data, addr = s.recvfrom(1500)
    try:
        s.sendto(answer(data), addr)
    except Exception as e:  # keep serving
        print("error", e, flush=True)
