"""Lesson 3: the link layer. Ethernet frames, what a switch learns, ARP, and how the MTU sets the TCP segment size.

Three hosts (a, b, c) hang on one switch (a Linux bridge) and each one is captured. Asserts what an Ethernet header holds, that a switch floods a frame to a
destination it has not seen yet and sends it only to one port after it has learned the sender, what an ARP request and reply contain and who sees them, and that
the MSS a TCP connection announces is the MTU minus 40. `--write` saves site/src/components/labs/networking/linkLayer.json for the labs.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from netlab import LABS, OUT, check, linux, load, show, table  # noqa: E402
from wire import read_pcap  # noqa: E402

WRITE = "--write" in sys.argv
print(linux("03_link.py").strip())
d = load("03_link.json")
MAC = {"a": "02:00:00:00:00:0a", "b": "02:00:00:00:00:0b", "c": "02:00:00:00:00:0c"}
name_of = {v: k for k, v in MAC.items()}


def frames(pcap, kinds):
    return [p for p in read_pcap(OUT / pcap) if p.kind in kinds]


# ---- 1. an Ethernet header is a destination, a source and a type ----
req = frames("03_a.pcap", {"ICMP echo request"})[0]
check("an Ethernet header is 14 bytes: 6 of destination, 6 of source, 2 of type", req.raw[:6].hex(":") == req.eth_dst.replace(":", ":") and len(req.raw) - len(req.raw[14:]) == 14)
check("the type 0x0800 says that an IPv4 packet follows (a value above 1536 is a type, below it a length)", req.eth_type == 0x0800 and req.eth_type > 1536)
first = lambda mac: int(mac.split(":")[0], 16)  # noqa: E731
check("the lowest bit of the first byte is the group bit: 0 for one receiver, 1 for broadcast and multicast", first(MAC["a"]) & 1 == 0 and first("ff:ff:ff:ff:ff:ff") & 1 == 1)
check("the next bit says the address was assigned locally, not by a manufacturer (our lab addresses begin with 02)", first(MAC["a"]) & 2 == 2)

# ---- 2. a switch floods what it does not know, then sends to one port ----
sw = {n: frames(f"03_{n}.pcap", {"ICMP echo request", "ICMP echo reply"}) for n in "abc"}
rows = []
for kind in ("ICMP echo request", "ICMP echo reply"):
    for k in range(2):
        seen = [n for n in "abc" if len([p for p in sw[n] if p.kind == kind]) > k]
        src = [p for p in sw["a"] if p.kind == kind][k].eth_src
        rows.append([f"{kind} #{k + 1}", name_of[src], ", ".join(seen)])
show("which host saw each frame (hosts a, b and c on one switch, a pings b twice)", table(rows, ["frame", "sent by", "seen by"]))
check("before any traffic the switch has learned nothing", d["fdb_before"].strip() == "")
check("the first echo request went to a destination the switch did not know: it was flooded and c saw it", len([p for p in sw["c"] if p.kind == "ICMP echo request"]) == 1)
check("the echo reply was NOT seen by c: the switch had learned a from the request and sent the reply to one port", not [p for p in sw["c"] if p.kind == "ICMP echo reply"])
check("the second echo request was not seen by c either: both a and b are known now", len([p for p in sw["c"] if p.kind == "ICMP echo request"]) == 1 and len([p for p in sw["b"] if p.kind == "ICMP echo request"]) == 2)
fdb = [l.split() for l in d["fdb_after"].splitlines()]
show("bridge fdb show (what the switch learned)", d["fdb_after"])
check("the switch learned the sender of each frame it saw: a on p1 and b on p2, and nothing about c", {(l[0], l[2]) for l in fdb} == {(MAC["a"], "p1"), (MAC["b"], "p2")})
check("one cable carries every frame that a host sends and gets: a host that is not the destination sees only floods and broadcasts", len(sw["c"]) == 1)

# ---- 3. ARP: who has 10.0.1.4? ----
arp = {n: [p for p in read_pcap(OUT / f"03_arp_{n}.pcap") if p.arp] for n in "abc"}
rq, rp = arp["a"]
show("the ARP request and reply", f"{rq.kind}: {rq.eth_src} -> {rq.eth_dst}   who has {rq.arp['tpa']}? tell {rq.arp['spa']}\n{rp.kind}: {rp.eth_src} -> {rp.eth_dst}   {rp.arp['spa']} is at {rp.arp['sha']}")
check("the request is sent to the broadcast address ff:ff:ff:ff:ff:ff", rq.eth_dst == "ff:ff:ff:ff:ff:ff" and rq.arp["op"] == 1)
check("the request carries the sender's own IP and MAC and asks for the MAC of 10.0.1.4 (target MAC all zeros)", (rq.arp["spa"], rq.arp["sha"], rq.arp["tpa"], rq.arp["tha"]) == ("10.0.1.2", MAC["a"], "10.0.1.4", "00:00:00:00:00:00"))
check("the reply is unicast to the asker and says 'the owner of 10.0.1.4 is MAC 0c'", rp.arp["op"] == 2 and rp.eth_dst == MAC["a"] and rp.arp["sha"] == MAC["c"] and rp.arp["spa"] == "10.0.1.4")
check("host b, who is not 10.0.1.4, saw the request (broadcast) but not the reply", [p.kind for p in arp["b"]] == ["ARP request"])
check("an ARP frame in the capture is 42 bytes: Ethernet 14 + ARP 28", rq.size == 42 and rp.size == 42)
check("the answer is kept in the neighbour cache, and the ping that followed went out as a unicast frame", "10.0.1.4 lladdr 02:00:00:00:00:0c REACHABLE" in d["neigh_after"] and any(p.kind == "ICMP echo request" and p.eth_dst == MAC["c"] for p in read_pcap(OUT / "03_arp_a.pcap")))
show("ip neigh (the cache of a)", d["neigh_after"])

# ---- 4. the MTU decides the segment size ----
syn = [p for p in read_pcap(OUT / "03_mtu.pcap") if p.kind in ("TCP SYN", "TCP SYN,ACK")]
rows = [[p.kind, p.eth_src and name_of[p.eth_src], p.tcp["opts"]["mss"]] for p in syn]
show("the MSS in the SYN and the SYN,ACK, first with MTU 1500 and then with MTU 1400", table(rows, ["packet", "from", "MSS"]))
check("with MTU 1500 both sides announce MSS 1460 = 1500 - 20 (IP) - 20 (TCP)", [p.tcp["opts"]["mss"] for p in syn[:2]] == [1460, 1460])
check("after the MTU of both links is set to 1400 the MSS becomes 1360", [p.tcp["opts"]["mss"] for p in syn[2:]] == [1360, 1360])
check("ip link reports the MTU the lesson talks about", "mtu 1500" in d["link_a"] and "mtu 1400" in d["mtu_after"])

if WRITE:
    ev = []
    for kind in ("ICMP echo request", "ICMP echo reply"):
        for k in range(2):
            frame = [p for p in sw["a"] if p.kind == kind][k]
            ev.append({"kind": kind, "n": k + 1, "src": name_of[frame.eth_src], "dst": name_of[frame.eth_dst], "seenBy": [n for n in "abc" if len([p for p in sw[n] if p.kind == kind]) > k]})
    order = [ev[0], ev[2], ev[1], ev[3]]  # request 1, reply 1, request 2, reply 2
    order = [ev[0], ev[2], ev[1], ev[3]]
    out = {
        "macs": MAC,
        "switch": {"events": [ev[0], ev[2], ev[1], ev[3]], "fdb": {l[0]: l[2] for l in fdb}},
        "arp": {"request": {"src": "a", "who": rq.arp["tpa"], "tell": rq.arp["spa"], "seenBy": [n for n in "abc" if any(p.kind == "ARP request" for p in arp[n])], "size": rq.size},
                "reply": {"src": "c", "ip": rp.arp["spa"], "mac": rp.arp["sha"], "seenBy": [n for n in "abc" if any(p.kind == "ARP reply" for p in arp[n])], "size": rp.size}},
        "mtu": {"1500": [p.tcp["opts"]["mss"] for p in syn[:2]], "1400": [p.tcp["opts"]["mss"] for p in syn[2:]]},
    }
    (LABS / "linkLayer.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print("wrote", LABS / "linkLayer.json")
print("ok")
