"""Exercise 03 (Linux side): three hosts on one switch. What a switch learns, what ARP asks, and what the MTU does to the TCP segment size."""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import topo  # noqa: E402

HOSTS = ("nla", "nlb", "nlc")
topo.build_switch(HOSTS)
result = {}

# ---- 1. unknown unicast is flooded, then the switch has learned ----
# static neighbours on both sides, so that no ARP is needed and the first frame the switch ever sees is an ICMP echo request from a to b
topo.ns("nla", "ip neigh add 10.0.1.3 lladdr 02:00:00:00:00:0b dev e0 nud permanent")
topo.ns("nlb", "ip neigh add 10.0.1.2 lladdr 02:00:00:00:00:0a dev e0 nud permanent")
result["fdb_before"] = topo.ns("nlsw", "bridge fdb show br br0 | grep -v permanent | grep -v 33:33 | grep -v 01:00:5e || true")
with topo.Capture("nla", "e0", "03_a.pcap"), topo.Capture("nlb", "e0", "03_b.pcap"), topo.Capture("nlc", "e0", "03_c.pcap"):
    time.sleep(0.4)
    topo.ns("nla", "ping -c1 -W1 10.0.1.3")
    time.sleep(0.3)
    result["fdb_after_first"] = topo.ns("nlsw", "bridge fdb show br br0 | grep -v permanent | grep -v 33:33 | grep -v 01:00:5e || true")
    topo.ns("nla", "ping -c1 -W1 10.0.1.3")
    time.sleep(0.4)
result["fdb_after"] = topo.ns("nlsw", "bridge fdb show br br0 | grep -v permanent | grep -v 33:33 | grep -v 01:00:5e || true")

# ---- 2. ARP: a asks for c, nobody told it ----
topo.ns("nla", "ip neigh flush dev e0")
result["neigh_before"] = topo.ns("nla", "ip neigh show dev e0")
with topo.Capture("nla", "e0", "03_arp_a.pcap"), topo.Capture("nlb", "e0", "03_arp_b.pcap"), topo.Capture("nlc", "e0", "03_arp_c.pcap"):
    time.sleep(0.4)
    topo.ns("nla", "ping -c1 -W1 10.0.1.4")
    time.sleep(0.4)
result["neigh_after"] = topo.ns("nla", "ip neigh show dev e0")
result["link_a"] = topo.ns("nla", "ip -o link show e0")

# ---- 3. the MTU decides the TCP segment size ----
topo.spawn("nlb", ["python3", os.path.join(topo.HERE, "_canned_server.py"), "8080"])
time.sleep(0.6)
with topo.Capture("nla", "e0", "03_mtu.pcap", "tcp port 8080"):
    time.sleep(0.4)
    topo.ns("nla", "python3 %s 10.0.1.3 8080 50000" % os.path.join(topo.HERE, "_get.py"))
    topo.ns("nla", "ip link set e0 mtu 1400")
    topo.ns("nlb", "ip link set e0 mtu 1400")
    time.sleep(0.8)
    topo.ns("nla", "python3 %s 10.0.1.3 8080 50001" % os.path.join(topo.HERE, "_get.py"))
    time.sleep(0.8)
result["mtu_after"] = topo.ns("nla", "ip -o link show e0")
topo.stop_all()
topo.teardown()
topo.save_json("03_link.json", result)
print("ok")
