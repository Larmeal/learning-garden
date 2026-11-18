"""Lesson 5: NAT, a stateful firewall and DHCP.

Two clients with private addresses (10.0.1.2 and 10.0.3.2) sit behind one router that does NAT (iptables MASQUERADE). Both open a connection from the same source port 50000 to
the same server, and captures are taken at the server and at both clients. Asserts what the server sees, how a clash of ports is solved, that the translation is undone on the way
back, what the router remembers (conntrack), that nobody outside can start a conversation, and that a stateful firewall lets replies in but not new connections. Then the real
dhclient of Linux asks a small DHCP server (linux/_dhcpd.py) for an address and the four messages are read from the capture.
`--write` saves site/src/components/labs/networking/natDhcp.json for the labs.
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dhcp import parse_dhcp  # noqa: E402
from netlab import LABS, OUT, check, linux, load, show, table  # noqa: E402
from wire import read_pcap  # noqa: E402

WRITE = "--write" in sys.argv
print(linux("05_nat_dhcp.py").strip())
d = load("05_nat_dhcp.json")


def flows(pcap):
    return [p for p in read_pcap(OUT / pcap) if p.tcp]


def first(pk, flag):
    return next(p for p in pk if p.tcp["flags"] == flag)


# ---- 1. what the server sees ----
plain = flows("05_plain_s.pcap")
s_pk = flows("05_nat_s.pcap")
c1, c2 = flows("05_nat_c1.pcap"), flows("05_nat_c2.pcap")
syn_plain = first(plain, "SYN")
syn_s = [p for p in s_pk if p.tcp["flags"] == "SYN"]
rows = [
    ["no NAT", syn_plain.ip["src"], syn_plain.tcp["sport"], "10.0.1.2", 50000],
    ["NAT, client 1", syn_s[0].ip["src"], syn_s[0].tcp["sport"], "10.0.1.2", 50000],
    ["NAT, client 2", syn_s[1].ip["src"], syn_s[1].tcp["sport"], "10.0.3.2", 50000],
]
show("the source address and port of the SYN, as the server sees it", table(rows, ["case", "server sees address", "server sees port", "client really is", "client's port"]))
check("without NAT the server sees the client's own address (a private one: it would not be routable on the internet)", (syn_plain.ip["src"], syn_plain.tcp["sport"]) == ("10.0.1.2", 50000))
check("with NAT both clients look like the router: 10.0.2.1", {p.ip["src"] for p in syn_s} == {"10.0.2.1"})
check("client 1 keeps its source port 50000, because nobody else uses it with this server yet", syn_s[0].tcp["sport"] == 50000)
check("client 2 also chose 50000, which would collide, so the router gave it another source port (that is PAT, port translation)", syn_s[1].tcp["sport"] != 50000 and 1024 <= syn_s[1].tcp["sport"] <= 65535, str(syn_s[1].tcp["sport"]))
check("the same SYN is recognisable on both sides by its sequence number: the router changed the address and port, not the TCP bytes", first(c1, "SYN").tcp["seq"] == syn_s[0].tcp["seq"] and first(c2, "SYN").tcp["seq"] == syn_s[1].tcp["seq"])

# ---- 2. the way back is translated too ----
synack_s = [p for p in s_pk if p.tcp["flags"] == "SYN,ACK"]
synack_c2 = first(c2, "SYN,ACK")
show("the SYN,ACK for client 2: what the server sent, and what client 2 received", f"server sent to   {synack_s[1].ip['dst']}:{synack_s[1].tcp['dport']}\nclient 2 got it for {synack_c2.ip['dst']}:{synack_c2.tcp['dport']}")
check("the server answers the address and port it saw (the router's)", (synack_s[1].ip["dst"], synack_s[1].tcp["dport"]) == ("10.0.2.1", syn_s[1].tcp["sport"]))
check("the router turns the destination back into the private address and the original port before it reaches client 2", (synack_c2.ip["dst"], synack_c2.tcp["dport"]) == ("10.0.3.2", 50000))
ct = [l for l in d["conntrack"].splitlines() if "8080" in l]
show("the router's connection table (conntrack), one line per connection", "\n".join(re.sub(r"\s+", " ", l) for l in ct))
check("the router remembers each connection with two tuples: what the client sent, and what the server will answer", len(ct) == 2 and all(l.count("sport=") == 2 for l in ct))
check("the table holds the translated port for client 2 (the server will answer to it)", any(f"dport={syn_s[1].tcp['sport']}" in l and "src=10.0.3.2" in l for l in ct))
check("the NAT rule is a single line in the POSTROUTING chain", "-A POSTROUTING -s 10.0.0.0/16 -o rs -j MASQUERADE" in d["nat_rule"])

# ---- 3. outside cannot start a conversation ----
check("a connection started from the server side to the router's public address and the port the client used is refused: the router has no mapping and no program there", d["inbound_probe"].strip() == "refused")
show("iptables -S FORWARD (default drop, replies of known connections allowed)", d["fw_rules"])
check("the client's connection out works through the firewall (a 98-byte response came back)", d["fw_out_ok"].strip() == "98")
check("a new connection from the server to the client's address is dropped: the connect attempt times out", d["fw_in_probe"].strip() == "timeout")
m = re.search(r"policy DROP (\d+) packets", d["fw_counters"])
check("the router counted the packets it dropped by the default policy", m is not None and int(m.group(1)) >= 1, d["fw_counters"].splitlines()[0])

# ---- 4. DHCP ----
msgs = []
for p in read_pcap(OUT / "05_dhcp.pcap"):
    if p.udp:
        msgs.append((p, parse_dhcp(p.payload)))
show("the DHCP conversation (tcpdump on the client, dhclient is the real one)", table([[f"{p.t * 1000:.2f} ms", f"{p.ip['src']}:{p.udp['sport']}", f"{p.ip['dst']}:{p.udp['dport']}", m["type"], m["yiaddr"]] for p, m in msgs], ["time", "from", "to", "message", "your address (yiaddr)"]))
check("four messages in this order: DISCOVER, OFFER, REQUEST, ACK", [m["type"] for _, m in msgs] == ["DISCOVER", "OFFER", "REQUEST", "ACK"])
check("all four belong to one transaction (same xid) and name the client by its MAC", len({m["xid"] for _, m in msgs}) == 1 and {m["chaddr"] for _, m in msgs} == {"02:00:00:00:00:c0"})
disc, offer, req, ack = msgs
check("the DISCOVER is a broadcast from 0.0.0.0 (the client has no address yet) on UDP port 68 to port 67", (disc[0].ip["src"], disc[0].ip["dst"], disc[0].udp["sport"], disc[0].udp["dport"], disc[0].eth_dst) == ("0.0.0.0", "255.255.255.255", 68, 67, "ff:ff:ff:ff:ff:ff"))
check("the OFFER proposes 10.0.1.100 with a mask, a router, a DNS server and a lease of 3600 seconds", (offer[1]["yiaddr"], offer[1]["options"]["subnet mask"], offer[1]["options"]["router"], offer[1]["options"]["lease time"]) == ("10.0.1.100", "255.255.255.0", ["10.0.1.1"], 3600))
check("the REQUEST names the server it accepts and the address it wants", (req[1]["options"]["requested ip"], req[1]["options"]["server id"]) == ("10.0.1.100", "10.0.1.1"))
check("the ACK confirms the same address and the lease; the client may now use it", ack[1]["yiaddr"] == "10.0.1.100" and ack[1]["options"]["lease time"] == 3600)
check("the DHCP message starts with the magic cookie 63825363", all(m["cookie"] == "63825363" for _, m in msgs))
env = dict(l.split("=", 1) for l in d["dhcp_env"].splitlines() if "=" in l)
show("what dhclient handed to its script", d["dhcp_env"].strip())
check("dhclient hands the lease to the system: address, mask, router and lease time", (env["new_ip_address"], env["new_subnet_mask"], env["new_routers"], env["new_dhcp_lease_time"]) == ("10.0.1.100", "255.255.255.0", "10.0.1.1", "3600"))

if WRITE:
    out = {
        "nat": [
            {"client": "10.0.1.2", "cport": 50000, "natIp": "10.0.2.1", "natPort": syn_s[0].tcp["sport"]},
            {"client": "10.0.3.2", "cport": 50000, "natIp": "10.0.2.1", "natPort": syn_s[1].tcp["sport"]},
        ],
        "dhcp": [{"type": m["type"], "src": f"{p.ip['src']}:{p.udp['sport']}", "dst": f"{p.ip['dst']}:{p.udp['dport']}", "yiaddr": m["yiaddr"], "options": m["options"], "xid": f"0x{m['xid']:08x}"} for p, m in msgs],
    }
    (LABS / "natDhcp.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print("wrote", LABS / "natDhcp.json")
print("ok")
