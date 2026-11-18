"""Exercise 04 (Linux side): a client, three routers and a server in a line. TTL, the IP header checksum, traceroute, a routing loop, fragmentation and path MTU."""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import topo  # noqa: E402

names = topo.build_chain(3, delay_ms=5)
SERVER = "10.0.4.2"
R = {}
R["tables"] = {nm: topo.ns(nm, "ip route") for nm in names}
R["route_get"] = {
    "nlr1_to_server": topo.ns("nlr1", "ip route get %s" % SERVER),
    "nlr2_to_client": topo.ns("nlr2", "ip route get 10.0.1.1"),
}

# ---- 1. one ping, captured on the left side of every router and the server: the TTL and the checksum at each link ----
caps = []
links = [("nlr1", "l0", "01_l1"), ("nlr2", "l0", "01_l2"), ("nlr3", "l0", "01_l3"), ("nls", "l0", "01_l4")]
for nm, dev, f in links:
    c = topo.Capture(nm, dev, "04_%s.pcap" % f, "icmp")
    c.__enter__()
    caps.append(c)
time.sleep(0.3)
R["ping"] = topo.ns("nlc", "ping -c1 -W2 %s" % SERVER)
time.sleep(0.4)
for c in caps:
    c.__exit__()

# ---- 2. traceroute ----
R["traceroute"] = json.loads(topo.ns("nlc", "python3 %s %s 6" % (os.path.join(topo.HERE, "_traceroute.py"), SERVER)))
R["ping_ttl2"] = topo.ns("nlc", "ping -c1 -W2 -t 2 %s || true" % SERVER)

# ---- 3. a routing loop between r1 and r2 for 10.0.9.0/24: only the TTL ends it ----
topo.ns("nlr1", "ip route add 10.0.9.0/24 via 10.0.2.2")
topo.ns("nlr2", "ip route add 10.0.9.0/24 via 10.0.2.1")
with topo.Capture("nlr2", "l0", "04_loop.pcap", "icmp"):
    time.sleep(0.3)
    R["loop_ping"] = topo.ns("nlc", "ping -c1 -W3 -t 8 10.0.9.1 || true")
    time.sleep(0.5)

# ---- 3b. the most specific route wins (longest prefix match) ----
topo.ns("nlr1", "ip route add unreachable 10.0.4.2/32")
R["lpm_get_specific"] = topo.ns("nlr1", "ip route get 10.0.4.2 2>&1 || true")
R["lpm_get_other"] = topo.ns("nlr1", "ip route get 10.0.4.3")
R["lpm_ping"] = topo.ns("nlc", "ping -c1 -W2 10.0.4.2 || true")
R["lpm_table"] = topo.ns("nlr1", "ip route")
topo.ns("nlr1", "ip route del unreachable 10.0.4.2/32")

# ---- 4. fragmentation and path MTU: the last link has an MTU of 1400 ----
topo.ns("nlr3", "ip link set r0 mtu 1400")
topo.ns("nls", "ip link set l0 mtu 1400")
with topo.Capture("nlr3", "r0", "04_frag.pcap", "icmp"), topo.Capture("nlc", "r0", "04_pmtu.pcap", "icmp"):
    time.sleep(0.3)
    R["ping_big"] = topo.ns("nlc", "ping -c1 -W2 -s 3000 %s" % SERVER)
    time.sleep(0.3)
    R["ping_df"] = topo.ns("nlc", "ping -c1 -W2 -M do -s 1472 %s || true" % SERVER)
    time.sleep(0.5)
topo.teardown()
topo.save_json("04_routing.json", R)
print("ok")
