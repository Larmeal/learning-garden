"""Lesson 13: proxies, load balancers and container networks.

One Linux host (the namespace nlr) plays a node of Docker or Kubernetes: a bridge br0 (10.244.0.1) joins two 'containers' (network namespaces nlk1, nlk2 with a veth each). Asserts that two containers
talk over the bridge without a router (TTL 64, ARP), that a container reaches the outside through NAT (the server sees the host, not the container), that a published port is a DNAT rule and a
conntrack entry, that a layer-4 load balancer built from iptables spreads connections (not requests) and keeps the client's address, that a layer-7 proxy spreads requests and shows the
client only in X-Forwarded-For, and what each does when a backend dies. `--write` saves site/src/components/labs/networking/proxies.json for the lab.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from netlab import LABS, OUT, check, linux, load, show, table  # noqa: E402
from wire import read_pcap  # noqa: E402

WRITE = "--write" in sys.argv
print(linux("13_proxies.py").strip())
d = load("13_proxies.json")

# ---- 1. a container is a namespace, a veth and a bridge ----
show("bridge link show (on the host)", d["bridge"])
show("ip route inside container 1", d["k1_route"])
check("the host's bridge has two ports in the forwarding state, one veth per container", d["bridge"].count("master br0") == 2 and d["bridge"].count("state forwarding") == 2)
check("container 1 has one interface eth0 with 10.244.0.2/24 and a default route through the bridge address 10.244.0.1", "10.244.0.2/24" in d["k1_addr"] and "default via 10.244.0.1" in d["k1_route"])
check("container to container: the ping arrives with TTL 64, so no router was crossed, only the bridge (layer 2)", d["k1_to_k2_ttl"].strip() == "ttl=64" and "0% packet loss" in d["k1_to_k2_ping"])
check("and the neighbour is found by ARP, as in lesson 3", "10.244.0.3 lladdr" in d["k1_neigh"])

# ---- 2. leaving the host: NAT ----
eg = [p for p in read_pcap(OUT / "13_egress.pcap") if p.tcp]
syn = next(p for p in eg if p.tcp["flags"] == "SYN")
show("a container calls the outside server; what the server sees", f"source address {syn.ip['src']} (the container is 10.244.0.2)")
check("the outside server sees the host's address 10.0.2.1 and never the container's private address", syn.ip["src"] == "10.0.2.1" and all(p.ip["src"] != "10.244.0.2" for p in eg))
ct = [l for l in d["conntrack_publish"].splitlines() if "src=10.244.0.2 dst=10.0.2.2" in l]
check("the host remembers the translation in conntrack, exactly as the NAT router of lesson 5", len(ct) == 1 and "dst=10.0.2.1" in ct[0])

# ---- 3. publishing a port ----
pc = [p for p in read_pcap(OUT / "13_publish_c.pcap") if p.tcp]
pb = [p for p in read_pcap(OUT / "13_publish_br.pcap") if p.tcp]
c_syn = next(p for p in pc if p.tcp["flags"] == "SYN")
b_syn = next(p for p in pb if p.tcp["flags"] == "SYN")
show("a client connects to the host at 10.0.1.1:8080 (a port published for container 1)", table([["on the client's cable", f"{c_syn.ip['src']} -> {c_syn.ip['dst']}:{c_syn.tcp['dport']}"], ["on the bridge, inside the host", f"{b_syn.ip['src']} -> {b_syn.ip['dst']}:{b_syn.tcp['dport']}"]], ["where", "SYN"]))
check("the client talks to 10.0.1.1:8080 and the container receives the same SYN for 10.244.0.2:80: DNAT rewrote only the destination", (c_syn.ip["dst"], c_syn.tcp["dport"], b_syn.ip["dst"], b_syn.tcp["dport"]) == ("10.0.1.1", 8080, "10.244.0.2", 80) and b_syn.ip["src"] == c_syn.ip["src"])
check("the answer came from container 1, and the published port is a single DNAT rule in iptables", d["publish"] == ["k1"] and "-A PREROUTING -d 10.0.1.1/32 -p tcp -m tcp --dport 8080 -j DNAT --to-destination 10.244.0.2:80" in d["nat_rules"])

# ---- 4. layer 4: balance connections ----
show("iptables, the load balancer of the 'virtual address' 10.96.0.10 (the way kube-proxy does it)", d["l4_rules"])
show("8 requests, each on a NEW connection (the answering backend)", str(d["l4_new"]))
show("8 requests on ONE connection", str(d["l4_same"]))
show("what a backend sees through the layer-4 balancer", d["l4_detail"].strip())
check("no computer owns 10.96.0.10: it exists only as a DNAT rule, and new connections are spread over the two backends in turn", d["l4_new"] == ["k1", "k2"] * 4)
check("but a connection is pinned to one backend: all 8 requests of one connection went to k1", set(d["l4_same"]) == {"k1"})
check("the backend sees the client's real address, because the balancer only changed the destination", json.loads(d["l4_detail"])["peer"] == "10.0.1.2" and json.loads(d["l4_detail"])["xff"] is None)

# ---- 5. layer 7: balance requests ----
show("8 requests through the reverse proxy, each on a new connection", str(d["l7_new"]))
show("8 requests through the reverse proxy on ONE connection", str(d["l7_same"]))
show("what a backend sees through the layer-7 proxy", d["l7_detail"].strip())
check("the proxy balances requests: on ONE client connection the requests still alternate between k1 and k2", d["l7_same"] == ["k1", "k2"] * 4 and d["l7_new"] == ["k1", "k2"] * 4)
l7 = json.loads(d["l7_detail"])
check("the backend sees the proxy's address 10.244.0.1 as its peer, because the proxy opens its own connection to the backend", l7["peer"] == "10.244.0.1")
check("the client's address survives only as a header the proxy added: X-Forwarded-For: 10.0.1.2", l7["xff"] == "10.0.1.2")

# ---- 6. a backend dies ----
show("container 2 is killed; 8 more requests", f"layer 4 (new connections): {d['dead_l4']}\nlayer 7 (the proxy):       {d['dead_l7']}")
check("the layer-4 balancer does not know the backend died: every second connection is refused (ECONNREFUSED)", d["dead_l4"] == ["k1", "ECONNREFUSED"] * 4)
check("the layer-7 proxy noticed the refused connection and tried the other backend: all 8 requests answered", d["dead_l7"] == ["k1"] * 8)

if WRITE:
    out = {"l4New": d["l4_new"], "l4Same": d["l4_same"], "l7New": d["l7_new"], "l7Same": d["l7_same"], "l4Seen": json.loads(d["l4_detail"]), "l7Seen": l7, "deadL4": d["dead_l4"], "deadL7": d["dead_l7"],
           "publish": {"client": f"{c_syn.ip['src']} -> {c_syn.ip['dst']}:{c_syn.tcp['dport']}", "bridge": f"{b_syn.ip['src']} -> {b_syn.ip['dst']}:{b_syn.tcp['dport']}"}, "egressSrc": syn.ip["src"]}
    (LABS / "proxies.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print("wrote", LABS / "proxies.json")
print("ok")
