"""Lesson 4: IP forwarding. A client, three routers and a server in a line (5 ms of delay on every cable).

Asserts what a router does to an IP packet (TTL down by one, checksum recomputed and still valid), how the routing table picks a route (the most specific
prefix wins), that traceroute is only TTL and ICMP time-exceeded messages, that a routing loop is stopped by nothing but the TTL, how an oversized packet is
fragmented, and how a packet with DF set finds the path MTU from an ICMP error. `--write` saves site/src/components/labs/networking/routing.json for the labs.
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from netlab import LABS, OUT, check, linux, load, show, table  # noqa: E402
from wire import ip_checksum, read_pcap  # noqa: E402

WRITE = "--write" in sys.argv
print(linux("04_routing.py").strip())
d = load("04_routing.json")

# ---- 1. each router lowers the TTL and recomputes the checksum ----
cap = {i: [p for p in read_pcap(OUT / f"04_01_l{i}.pcap") if p.icmp] for i in (1, 2, 3, 4)}
rows = []
for i in (1, 2, 3, 4):
    rq, rp = cap[i]
    rows.append([f"link {i}", rq.ip["ttl"], f"0x{rq.ip['csum']:04x}", rp.ip["ttl"], f"0x{rp.ip['csum']:04x}"])
show("one ping across three routers, captured on every link", table(rows, ["where", "request TTL", "request checksum", "reply TTL", "reply checksum"]))
check("the request leaves the client with TTL 64 and loses one at each of the three routers: 64, 63, 62, 61", [cap[i][0].ip["ttl"] for i in (1, 2, 3, 4)] == [64, 63, 62, 61])
check("the reply starts at the server with TTL 64 and arrives at the client with 61", [cap[i][1].ip["ttl"] for i in (4, 3, 2, 1)] == [64, 63, 62, 61])
check("ping prints the same ttl=61", "ttl=61" in d["ping"])
check("every captured IP header has a valid checksum (the ones'-complement sum of the 20 bytes is 0xFFFF)", all(ip_checksum(p.raw[14:14 + p.ip["ihl"]]) == 0xFFFF for i in cap for p in cap[i]))
check("the checksum changes at every router, because the TTL in the header changed", len({cap[i][0].ip["csum"] for i in cap}) == 4)
check("the IP addresses and the identification number are the same at every link", len({(cap[i][0].ip["src"], cap[i][0].ip["dst"], cap[i][0].ip["id"]) for i in cap}) == 1)

# ---- 2. the routing table ----
show("ip route on router 1", d["tables"]["nlr1"])
check("router 1 has its two own networks plus one route for each network behind router 2", d["tables"]["nlr1"].count("\n") + 1 == 4 and "10.0.4.0/24 via 10.0.2.2" in d["tables"]["nlr1"])
check("a directly connected network has no 'via' (the router is on it)", "10.0.2.0/24 dev r0 proto kernel scope link" in d["tables"]["nlr1"])
show("ip route get 10.0.4.2 on router 1, with a route 10.0.4.0/24 and then a more specific 10.0.4.2/32 'unreachable'", f"{d['lpm_get_specific']}\n{d['lpm_get_other'].splitlines()[0]}   (this is 10.0.4.3, which only the /24 covers)")
check("the most specific route (/32) wins over the /24 for 10.0.4.2", "No route to host" in d["lpm_get_specific"] or "unreachable" in d["lpm_get_specific"].lower())
check("10.0.4.3 still follows the /24 route through router 2", "10.0.4.3 via 10.0.2.2 dev r0" in d["lpm_get_other"])
check("the client is told by router 1 that the destination host is unreachable", "From 10.0.1.2" in d["lpm_ping"] and "Destination Host Unreachable" in d["lpm_ping"])

# ---- 3. traceroute is TTL plus ICMP ----
tr = d["traceroute"]
show("traceroute (UDP probes with TTL 1, 2, 3, 4)", table([[r["ttl"], r["from"], {11: "time exceeded", 3: "port unreachable"}[r["type"]], f"{r['rtt']} ms"] for r in tr], ["TTL", "answer from", "ICMP", "round trip"]))
check("each probe is answered by the next router on the path, with an ICMP time exceeded (type 11)", [(r["from"], r["type"]) for r in tr[:3]] == [("10.0.1.2", 11), ("10.0.2.2", 11), ("10.0.3.2", 11)])
check("the probe that reaches the server is answered with ICMP port unreachable (type 3, code 3): that ends the trace", (tr[3]["from"], tr[3]["type"], tr[3]["code"]) == ("10.0.4.2", 3, 3))
check("the answer comes from the address of the interface the probe arrived on", [r["from"] for r in tr] == ["10.0.1.2", "10.0.2.2", "10.0.3.2", "10.0.4.2"])
check("the round trip grows by about 10 ms per hop (5 ms of delay each way)", all(abs(tr[i]["rtt"] - 10 * (i + 1)) < 4 for i in range(4)), str([r["rtt"] for r in tr]))
check("ping with -t 2 gets 'Time to live exceeded' from the second router", "From 10.0.2.2" in d["ping_ttl2"] and "Time to live exceeded" in d["ping_ttl2"])

# ---- 4. a loop is stopped by the TTL and nothing else ----
loop = [p for p in read_pcap(OUT / "04_loop.pcap") if p.icmp]
requests = [p.ip["ttl"] for p in loop if p.kind == "ICMP echo request"]
show("a routing loop between router 1 and router 2, a ping sent with TTL 8: the request as seen on the link between them", f"TTL of each pass: {requests}\nthen: {loop[-1].kind} from {loop[-1].ip['src']}")
check("the same request crosses the link again and again, one TTL lower each time (7 down to 1)", requests == [7, 6, 5, 4, 3, 2, 1])
check("when the TTL reaches 0 the router that holds the packet throws it away and sends ICMP time exceeded to the sender", loop[-1].kind == "ICMP time exceeded" and "Time to live exceeded" in d["loop_ping"])

# ---- 5. fragmentation and path MTU (the last link has an MTU of 1400) ----
frag = [p for p in read_pcap(OUT / "04_frag.pcap") if p.ip and p.ip["id"] == read_pcap(OUT / "04_frag.pcap")[0].ip["id"]]
rows = [[p.ip["id"], p.ip["frag"], p.ip["total"] - 20, "more fragments" if p.ip["mf"] else "last", p.size] for p in frag]
show("a ping with 3000 bytes of data, as the last link (MTU 1400) carries it", table(rows, ["IP id", "offset", "data bytes", "flag", "frame bytes"]))
check("all the fragments carry the same identification number", len({p.ip["id"] for p in frag}) == 1)
check("every fragment fits the MTU of 1400 (IP packet at most 1400 bytes)", all(p.ip["total"] <= 1400 for p in frag))
check("the offsets are multiples of 8 and each starts where the previous one ended", all(p.ip["frag"] % 8 == 0 for p in frag) and all(frag[i + 1].ip["frag"] == frag[i].ip["frag"] + frag[i].ip["total"] - 20 for i in range(len(frag) - 1)))
check("the last fragment is the only one without the More Fragments flag, and the data adds up to 3008 bytes (3000 + 8 of ICMP)", [p.ip["mf"] for p in frag] == [True] * (len(frag) - 1) + [False] and frag[-1].ip["frag"] + frag[-1].ip["total"] - 20 == 3008)
check("the client still got the whole answer: 3008 bytes, reassembled", "3008 bytes from 10.0.4.2" in d["ping_big"])
pm = [p for p in read_pcap(OUT / "04_pmtu.pcap") if p.kind == "ICMP unreachable"][0]
mtu = int.from_bytes(pm.icmp["rest"][2:4], "big")
show("ping -M do -s 1472 (DF set, 1500 bytes) towards a link with MTU 1400", d["ping_df"].splitlines()[1] + f"\nICMP type {pm.icmp['type']} code {pm.icmp['code']} from {pm.ip['src']}, next-hop MTU field = {mtu}")
check("a router that cannot fragment (DF set) answers ICMP type 3 code 4 'fragmentation needed' with the MTU it can take", (pm.icmp["type"], pm.icmp["code"], mtu) == (3, 4, 1400))
check("the answer comes from router 3, the one in front of the small link", pm.ip["src"] == "10.0.3.2")

pm_all = read_pcap(OUT / "04_pmtu.pcap")
first_id = pm_all[0].ip["id"]
frag1 = [p for p in pm_all if p.ip["id"] == first_id and p.ip["src"] == "10.0.1.1"]
check("on the first link (MTU 1500) the client already cut the 3008 bytes into 1480 + 1480 + 48", [p.ip["total"] - 20 for p in frag1] == [1480, 1480, 48])
check("router 3 cut the 1480-byte fragments again for the link with MTU 1400: 1376 + 104 each (the offsets of fragments are counted in the original data)", [(p.ip["frag"], p.ip["total"] - 20) for p in frag] == [(0, 1376), (1376, 104), (1480, 1376), (2856, 104), (2960, 48)])

if WRITE:
    tables = {}
    for nm in ("nlr1", "nlr2", "nlr3"):
        tables[nm[-2:]] = [{"net": l.split()[0], "via": (re.search(r"via (\S+)", l) or [None, None])[1], "dev": re.search(r"dev (\S+)", l).group(1)} for l in d["tables"][nm].splitlines() if l.strip()]
    out = {
        "ttl": {"request": [cap[i][0].ip["ttl"] for i in (1, 2, 3, 4)], "reply": [cap[i][1].ip["ttl"] for i in (4, 3, 2, 1)], "csum": [f"0x{cap[i][0].ip['csum']:04x}" for i in (1, 2, 3, 4)]},
        "tables": tables,
        "traceroute": tr,
        "loop": requests,
        "frags1": [{"off": p.ip["frag"], "data": p.ip["total"] - 20, "mf": p.ip["mf"]} for p in frag1],
        "frags": [{"off": p.ip["frag"], "data": p.ip["total"] - 20, "mf": p.ip["mf"]} for p in frag],
        "mtu": mtu,
    }
    (LABS / "routing.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print("wrote", LABS / "routing.json")
print("ok")
