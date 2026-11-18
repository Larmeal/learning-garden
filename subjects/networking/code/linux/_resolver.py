"""A small recursive resolver with a cache for the exercises (standard library only). Usage: _resolver.py MY_IP ROOT_IP.

A client asks it with recursion desired. It starts at the root and follows the referrals (NS records with glue) until it gets an answer, remembers the answer for its TTL
and answers the client. Every query it sends goes out on UDP port 53 from a new socket."""
import socket
import struct
import sys
import time

my_ip, root_ip = sys.argv[1], sys.argv[2]
CACHE = {}


def enc(name):
    out = b""
    for label in name.rstrip(".").split("."):
        if label:
            out += bytes([len(label)]) + label.encode()
    return out + b"\x00"


def dec(msg, pos):
    labels = []
    jumped, end = False, pos
    while True:
        ln = msg[pos]
        if ln == 0:
            pos += 1
            break
        if ln & 0xC0 == 0xC0:
            if not jumped:
                end = pos + 2
            pos, jumped = ((ln & 0x3F) << 8) | msg[pos + 1], True
            continue
        labels.append(msg[pos + 1 : pos + 1 + ln].decode())
        pos += 1 + ln
    return ".".join(labels) + ".", (end if jumped else pos)


def parse(msg):
    ident, flags, qd, an, ns, ar = struct.unpack("!HHHHHH", msg[:12])
    pos = 12
    qname, pos = dec(msg, pos)
    qtype = struct.unpack("!H", msg[pos : pos + 2])[0]
    pos += 4
    out = {"id": ident, "flags": flags, "qname": qname, "qtype": qtype, "an": [], "ns": [], "ar": []}
    for key, n in (("an", an), ("ns", ns), ("ar", ar)):
        for _ in range(n):
            name, pos = dec(msg, pos)
            t, c, ttl, rdl = struct.unpack("!HHIH", msg[pos : pos + 10])
            pos += 10
            rd = msg[pos : pos + rdl]
            val = socket.inet_ntoa(rd) if t == 1 else dec(msg, pos)[0]
            pos += rdl
            out[key].append((name, t, ttl, val))
    return out


def ask(server, name, qtype, rd=0):
    q = struct.pack("!HHHHHH", int(time.time() * 1000) & 0xFFFF, rd << 8, 1, 0, 0, 0) + enc(name) + struct.pack("!HH", qtype, 1)
    u = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    u.settimeout(2)
    u.sendto(q, (server, 53))
    data, _ = u.recvfrom(1500)
    u.close()
    return parse(data)


def resolve(name, qtype):
    key = (name.lower(), qtype)
    now = time.time()
    if key in CACHE and CACHE[key][1] > now:
        left = int(CACHE[key][1] - now)
        return [(n, ty, left, v) for (n, ty, _, v) in CACHE[key][0]], 0, [], True
    server, steps = root_ip, []
    for _ in range(8):
        r = ask(server, name, qtype)
        steps.append(server)
        if r["flags"] & 15 == 3:
            return None, 3, steps, False
        if r["an"]:
            ttl = min(a[2] for a in r["an"])
            CACHE[key] = (r["an"], now + ttl)
            return r["an"], 0, steps, False
        glue = {a[0]: a[3] for a in r["ar"] if a[1] == 1}
        nxt = [glue[n[3]] for n in r["ns"] if n[3] in glue]
        if not nxt:
            return [], 0, steps, False
        server = nxt[0]
    return [], 2, steps, False


def rr(name, rtype, ttl, value, qname=""):
    rd = socket.inet_aton(value) if rtype == 1 else enc(value)
    owner = b"\xc0\x0c" if name.lower() == qname.lower() else enc(name)
    return owner + struct.pack("!HHIH", rtype, 1, ttl, len(rd)) + rd


s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind((my_ip, 53))
print("listening", flush=True)
while True:
    data, addr = s.recvfrom(1500)
    q = parse(data)
    answers, rcode, _, hit = resolve(q["qname"], q["qtype"])
    body = b""
    ttl_left = 0
    if answers:
        for (n, t, ttl, v) in answers:
            body += rr(n, t, ttl, v, q["qname"])
    flags = 0x8000 | 0x0100 | 0x0080 | rcode
    msg = struct.pack("!HHHHHH", q["id"], flags, 1, len(answers or []), 0, 0) + data[12 : 12 + len(enc(q["qname"])) + 4] + body
    s.sendto(msg, addr)
