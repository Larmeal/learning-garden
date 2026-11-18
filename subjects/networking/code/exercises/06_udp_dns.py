"""Lesson 6: UDP and DNS.

UDP: a client sends six datagrams of 10 to 60 bytes to a server where every third one is dropped on arrival. Asserts the 8-byte header, that the checksum covers a
pseudo-header, that datagram boundaries survive, and that the sender is never told about a loss.
DNS: a client asks a caching resolver for www.example.test. The resolver walks root, TLD and authoritative servers (small Python servers, linux/_dnsd.py, on a made-up top-level
domain .test), and every message is read from a capture of the resolver's cable. Asserts the walk, the referrals with glue, the wire format of a name and of a compression pointer,
the cache (second answer: two packets and a lower TTL), CNAME and NXDOMAIN. `--write` saves site/src/components/labs/networking/udpDns.json for the labs.
"""

import json
import re
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from netlab import LABS, OUT, check, linux, load, show, table  # noqa: E402
from wire import dns_encode_name, parse_dns, read_pcap  # noqa: E402

WRITE = "--write" in sys.argv
print(linux("06_udp_dns.py").strip())
d = load("06_udp_dns.json")


def udp_checksum(src: str, dst: str, udp: bytes) -> int:
    pseudo = bytes(int(x) for x in src.split(".")) + bytes(int(x) for x in dst.split(".")) + struct.pack("!BBH", 0, 17, len(udp))
    data = pseudo + udp
    if len(data) % 2:
        data += b"\x00"
    s = sum(struct.unpack("!%dH" % (len(data) // 2), data))
    while s >> 16:
        s = (s & 0xFFFF) + (s >> 16)
    return s


# ---- 1. UDP ----
sent = [p for p in read_pcap(OUT / "06_udp_c.pcap") if p.udp]
rows = [[i + 1, p.udp["sport"], p.udp["dport"], p.udp["len"], f"0x{p.udp['csum']:04x}", p.size] for i, p in enumerate(sent)]
show("the six UDP datagrams as the client sent them", table(rows, ["#", "source port", "destination port", "UDP length field", "checksum", "frame bytes"]))
check("UDP has no handshake: the first packet on the wire is already the data", len(sent) == 6 and all(p.udp for p in sent))
check("the header is 8 bytes: the length field is the 8 bytes plus the data (18, 28, 38, 48, 58, 68)", [p.udp["len"] for p in sent] == [18, 28, 38, 48, 58, 68])
check("a frame is 14 (Ethernet) + 20 (IP) + 8 (UDP) + the data", [p.size for p in sent] == [14 + 20 + 8 + 10 * (i + 1) for i in range(6)])
check("the checksum covers the data, the UDP header and a pseudo-header with the IP addresses (the sum is 0xFFFF)", all(udp_checksum(p.ip["src"], p.ip["dst"], p.raw[14 + p.ip["ihl"] : 14 + p.ip["total"]]) == 0xFFFF for p in sent))
check("the client's six sendto calls all succeeded", d["udp_send"].strip() == "6")
got = d["udp_sink"]
show("what the server program received (every third datagram was dropped by a firewall rule on the way in)", table([[g["head"], g["size"]] for g in got], ["datagram", "bytes"]))
check("the server got datagrams 1, 2, 4 and 5 and never saw 3 and 6, and no error reached the sender", [g["head"][:4] for g in got] == ["msg1", "msg2", "msg4", "msg5"])
check("each datagram arrived as one piece with its own size (10, 20, 40, 50): UDP keeps message boundaries", [g["size"] for g in got] == [10, 20, 40, 50])
check("the firewall counted the two datagrams it dropped", re.search(r"^\s*2\s+\d+\s+DROP", d["udp_drops"], flags=re.M) is not None, d["udp_drops"])

# ---- 2. DNS: a name on the wire ----
check("a name is written as length-prefixed labels and ends with a zero byte: www.example.test is 18 bytes", dns_encode_name("www.example.test") == b"\x03www\x07example\x04test\x00" and len(dns_encode_name("www.example.test")) == 18)


def dns_pkts(name):
    return [p for p in read_pcap(OUT / f"06_dns_{name}.pcap") if p.udp]


who = {"10.0.1.2": "client", "10.0.1.3": "resolver", "10.0.1.4": "root", "10.0.1.5": "TLD", "10.0.1.6": "authoritative"}
w1 = dns_pkts("www1")
rows = []
for p in w1:
    m = parse_dns(p.payload)
    what = "question" if not m["qr"] else ("answer " + ", ".join(f"{a[1]} {a[3]}" for a in m["answers"]) if m["answers"] else "referral to " + ", ".join(a[3] for a in m["authority"]))
    rows.append([f"{p.t * 1000:.0f} ms", f"{who[p.ip['src']]} -> {who[p.ip['dst']]}", f"RD={m['rd']} RA={m['ra']} AA={m['aa']}", what])
show("the first lookup of www.example.test, seen on the resolver's cable", table(rows, ["time", "who talks to whom", "flags", "what"]))
check("one question from the client turns into three questions from the resolver (root, TLD, authoritative) and one answer back: 8 packets", len(w1) == 8)
order = [(who[p.ip["src"]], who[p.ip["dst"]]) for p in w1]
check("the order is client-resolver, then resolver asks the root, the TLD and the authoritative server in turn, each answering before the next question", order == [("client", "resolver"), ("resolver", "root"), ("root", "resolver"), ("resolver", "TLD"), ("TLD", "resolver"), ("resolver", "authoritative"), ("authoritative", "resolver"), ("resolver", "client")])
m = [parse_dns(p.payload) for p in w1]
check("the client asks with 'recursion desired' and the resolver answers with 'recursion available'", m[0]["rd"] == 1 and m[7]["ra"] == 1)
check("the resolver asks the servers above with recursion off: it does the walking itself", m[1]["rd"] == 0 and m[3]["rd"] == 0 and m[5]["rd"] == 0)
check("the root does not know the answer: it sends the NS record of the 'test.' domain and the address of that name server (glue)", (m[2]["answers"], m[2]["authority"][0][1], m[2]["authority"][0][3], m[2]["additional"][0][3]) == ([], "NS", "a.nic.test", "10.0.1.5"))
check("the TLD server refers to example.test with its name server and glue 10.0.1.6", (m[4]["authority"][0][0], m[4]["additional"][0][3]) == ("example.test", "10.0.1.6"))
check("only the authoritative server answers, with the authoritative flag set, the address and a TTL of 300 seconds", (m[6]["aa"], m[6]["answers"][0][1], m[6]["answers"][0][3], m[6]["answers"][0][2]) == (1, "A", "10.0.2.50", 300) and not any(x["aa"] for x in (m[2], m[4])))
check("each question and its answer share the same query id", all(m[i]["id"] == m[i + 1]["id"] for i in (1, 3, 5)) and m[0]["id"] == m[7]["id"])
ans = w1[7].payload
check("the answer names www.example.test with a pointer (0xC00C) back to the question instead of writing the name again", ans[12 + 18 + 4 : 12 + 18 + 4 + 2] == b"\xc0\x0c")
check("the whole answer is 50 bytes: 12 header + 18 name + 4 type and class + 16 for the record", len(w1[7].payload) == 50 == 12 + 18 + 4 + (2 + 10 + 4))
check("DNS rides on UDP port 53, and the client's own port is a high random one", w1[0].udp["dport"] == 53 and w1[0].udp["sport"] > 1023)

# ---- 3. the cache ----
w2 = dns_pkts("www2")
m2 = [parse_dns(p.payload) for p in w2]
show("the second lookup, a moment later", f"{len(w2)} packets, TTL in the answer: {m2[1]['answers'][0][2]} seconds")
q1 = float(re.search(r"Query time: (\d+) msec", d["dig_www1"]).group(1))
q2 = float(re.search(r"Query time: (\d+) msec", d["dig_www2"]).group(1))
q3 = float(re.search(r"Query time: (\d+) msec", d["dig_api"]).group(1))
show("dig's own measure of the time (every server above the resolver adds 20 ms to each answer)", f"first lookup {q1:.0f} ms, second {q2:.0f} ms, api.example.test {q3:.0f} ms")
check("the second lookup is two packets: the resolver answered from its cache and asked nobody", len(w2) == 2 and {p.ip["src"] for p in w2} == {"10.0.1.2", "10.0.1.3"})
check("the cached answer carries a smaller TTL than 300, because the clock has been running", 290 <= m2[1]["answers"][0][2] < 300)
check("the second lookup is about 100 times faster, 0 ms against more than 100", q2 <= 3 and q1 >= 100)
check("the first lookup took 20 ms for each of three servers plus a first ARP for each (the 20 ms delay applies to ARP answers too)", 100 <= q1 <= 160)

# ---- 4. CNAME and NXDOMAIN ----
a = dns_pkts("api")
ma = [parse_dns(p.payload) for p in a]
check("api.example.test is an alias: the answer holds a CNAME and, in the same answer, the address of the real name", [(x[1], x[3]) for x in ma[7]["answers"]] == [("CNAME", "www.example.test"), ("A", "10.0.2.50")])
check("this lookup takes about 60 ms: three upstream servers, and ARP is already known", 55 <= q3 <= 90)
check("a name that does not exist gets rcode 3 (NXDOMAIN) from the authoritative server, and the resolver passes it on", "status: NXDOMAIN" in d["dig_nx"])

# ---- 5. what each server says when asked directly, without recursion ----
check("asked directly, the root gives a referral (no 'aa' flag, authority section with NS and the glue)", "flags: qr;" in d["dig_root"] and "AUTHORITY SECTION" in d["dig_root"] and "a.nic.test." in d["dig_root"])
check("asked directly, the authoritative server answers with the 'aa' flag", "flags: qr aa;" in d["dig_auth"] and "10.0.2.50" in d["dig_auth"])

if WRITE:
    out = {
        "udp": {"sent": [{"n": i + 1, "size": 10 * (i + 1), "lost": (i + 1) % 3 == 0} for i in range(6)], "got": [g["size"] for g in got], "header": {"sport": sent[0].udp["sport"], "dport": sent[0].udp["dport"], "len": sent[0].udp["len"], "csum": f"0x{sent[0].udp['csum']:04x}"}},
        "dns": {
            "walk": [{"t": round(p.t * 1000), "from": who[p.ip["src"]], "to": who[p.ip["dst"]], "q": not mm["qr"], "what": ("answer " + ", ".join(f"{a_[1]} {a_[3]}" for a_ in mm["answers"]) if mm["answers"] else ("referral " + ", ".join(a_[3] for a_ in mm["authority"]))) if mm["qr"] else "www.example.test A?", "aa": mm["aa"], "ttl": mm["answers"][0][2] if mm["answers"] else None} for p, mm in zip(w1, m)],
            "ms": {"www1": q1, "www2": q2, "api": q3},
            "cacheTtl": m2[1]["answers"][0][2],
        },
    }
    (LABS / "udpDns.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print("wrote", LABS / "udpDns.json")
print("ok")
