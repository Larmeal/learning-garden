"""Lesson 1: what happens between a request and its answer. One HTTP request across a client, a router and a server.

Builds the lab of linux/topo.py, sends `GET /hello.txt` over a real TCP connection and captures it at both ends. Asserts that the bytes are nested
(Ethernet in a frame, IP in Ethernet, TCP in IP, HTTP in TCP), what each layer adds, that the IP addresses and ports stay the same from end to end
while the Ethernet addresses and the TTL change at the router, and that the same bytes appear at both ends of the router. `--write` saves the
packets and layers as site/src/components/labs/networking/bigPicture.json for the lab.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from netlab import LABS, OUT, check, linux, show, table  # noqa: E402
from wire import read_pcap  # noqa: E402

WRITE = "--write" in sys.argv
print(linux("01_big_picture.py").strip())

all_client = read_pcap(OUT / "01_client.pcap")
all_server = read_pcap(OUT / "01_server.pcap")
arp = [p for p in all_client if p.arp]
all_tcp = [p for p in all_client if p.tcp]
at_client = [p for p in all_tcp if 50000 in (p.tcp["sport"], p.tcp["dport"])]
second = [p for p in all_tcp if 50001 in (p.tcp["sport"], p.tcp["dport"])]
at_server = [p for p in all_server if p.tcp and 50000 in (p.tcp["sport"], p.tcp["dport"])]
show("frames at the client that are not TCP", "\n".join(f"{p.kind}: {p.arp['spa']} {p.arp['sha']} asks about {p.arp['tpa']}" for p in arp))

# ---- 1. the conversation as the client saw it ----
rows = []
for i, p in enumerate(at_client, 1):
    who = "client -> server" if p.ip["src"] == "10.0.1.2" else "server -> client"
    info = f"seq={p.tcp['seq']} ack={p.tcp['ack']} len={p.tcp['len']}"
    rows.append([i, f"{p.t * 1000:6.2f} ms", who, p.kind, p.size, info])
show("tcpdump on the client, port 8080 (seq and ack are the real, random numbers of this run)", table(rows, ["#", "time", "direction", "what", "frame bytes", "tcp"]))
check("the capture holds a handshake, a request, a response and a close", len(at_client) >= 9)
check("the first three packets are SYN, SYN+ACK, ACK (the handshake)", [p.tcp["flags"] for p in at_client[:3]] == ["SYN", "SYN,ACK", "ACK"])

# ---- 2. the request is plain text inside a TCP segment ----
req = next(p for p in at_client if p.payload.startswith(b"GET "))
resp = next(p for p in at_client if p.payload.startswith(b"HTTP/1.1 200"))
show("the payload of the request packet", req.payload.decode().replace("\r", "\\r").replace("\n", "\\n\n"))
check("HTTP is text: the request is 65 bytes of characters", len(req.payload) == 65 and req.payload.endswith(b"\r\n\r\n"), str(len(req.payload)))
layers = {
    "ethernet": 14,
    "ip": req.ip["ihl"],
    "tcp": req.tcp["hdr"],
    "http": len(req.payload),
}
check("Ethernet + IP + TCP + HTTP add up to the size of the frame", sum(layers.values()) == req.size, str(layers))
show("what each layer adds to the request", table([[k, v] for k, v in layers.items()] + [["frame", req.size]], ["layer", "bytes"]))
check("the Ethernet header is 14 bytes, the IPv4 header 20, the TCP header 32 (20 + options with timestamps)", (layers["ethernet"], layers["ip"], layers["tcp"]) == (14, 20, 32), str(layers))
check("the type field of Ethernet says IPv4 (0x0800), the protocol field of IP says TCP (6), the destination port says 8080", (req.eth_type, req.ip["proto"], req.tcp["dport"]) == (0x0800, 6, 8080))
check("the response is bigger: headers and body of 14 bytes", len(resp.payload) == len(b"HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 14\r\nConnection: close\r\n\r\n") + 14)

# ---- 3. the router rewrites the link layer and the TTL, not the addresses of the conversation ----
req_s = next(p for p in at_server if p.payload.startswith(b"GET "))
rows = [
    ["Ethernet src", req.eth_src, req_s.eth_src],
    ["Ethernet dst", req.eth_dst, req_s.eth_dst],
    ["IP src", req.ip["src"], req_s.ip["src"]],
    ["IP dst", req.ip["dst"], req_s.ip["dst"]],
    ["TTL", req.ip["ttl"], req_s.ip["ttl"]],
    ["TCP ports", f"{req.tcp['sport']} -> {req.tcp['dport']}", f"{req_s.tcp['sport']} -> {req_s.tcp['dport']}"],
    ["TCP seq", req.tcp["seq"], req_s.tcp["seq"]],
    ["IP id", req.ip["id"], req_s.ip["id"]],
]
show("the same request packet, seen at the client and at the server", table(rows, ["field", "at client", "at server"]))
check("the IP addresses and the TCP ports are the same at both ends", (req.ip["src"], req.ip["dst"], req.tcp["sport"], req.tcp["dport"]) == (req_s.ip["src"], req_s.ip["dst"], req_s.tcp["sport"], req_s.tcp["dport"]))
check("the TCP bytes are identical at both ends (same seq, same payload)", req.tcp["seq"] == req_s.tcp["seq"] and req.payload == req_s.payload)
check("the Ethernet addresses are different: the router made a new frame", req.eth_src != req_s.eth_src and req.eth_dst != req_s.eth_dst)
check("the client frame is addressed to the router's MAC and the server frame comes from it", req.eth_dst == "02:00:00:00:00:a1" and req_s.eth_src == "02:00:00:00:00:a2" and req_s.eth_dst == "02:00:00:00:00:50")
check("the TTL went down by one at the router", req.ip["ttl"] == 64 and req_s.ip["ttl"] == 63)
check("the IP checksum changed because the TTL did", req.ip["csum"] != req_s.ip["csum"])

# ---- 4. a connection is told apart by four numbers ----
flows = {(p.ip["src"], p.tcp["sport"], p.ip["dst"], p.tcp["dport"]) for p in all_tcp if p.ip["src"] == "10.0.1.2"}
show("the connections the client opened (source address, source port, destination address, destination port)", "\n".join(str(f) for f in sorted(flows)))
check("two connections to the same server and port are two different flows because of the client's port", flows == {("10.0.1.2", 50000, "10.0.2.2", 8080), ("10.0.1.2", 50001, "10.0.2.2", 8080)})
check("each connection has its own handshake and its own sequence numbers", second[0].tcp["flags"] == "SYN" and second[0].tcp["seq"] != at_client[0].tcp["seq"])
check("the client asked ARP only once: the second connection reused the router's MAC", len(arp) == 2)

if WRITE:
    lab = LABS / "bigPicture.json"
    data = {
        "layers": layers,
        "frame": req.size,
        "request": req.payload.decode(),
        "client": {"ethSrc": req.eth_src, "ethDst": req.eth_dst, "ttl": req.ip["ttl"], "ipSrc": req.ip["src"], "ipDst": req.ip["dst"], "sport": req.tcp["sport"], "dport": req.tcp["dport"]},
        "server": {"ethSrc": req_s.eth_src, "ethDst": req_s.eth_dst, "ttl": req_s.ip["ttl"]},
        "packets": [{"t": round(p.t * 1000, 2), "dir": "c2s" if p.ip["src"] == "10.0.1.2" else "s2c", "kind": p.kind, "size": p.size, "len": p.tcp["len"]} for p in at_client],
    }
    lab.write_text(json.dumps(data, indent=1), encoding="utf-8")
    print("wrote", lab)
print("ok")
