"""Exercise 02 (Linux side): which way does the kernel send a packet, for different prefix lengths of the client's own address?"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import topo  # noqa: E402

topo.build()
DESTS = ["10.0.1.77", "10.0.1.200", "10.0.2.2", "10.0.3.9", "10.1.0.5"]
PREFIXES = [8, 16, 22, 23, 24, 25, 26, 30]
result = {"dests": DESTS, "prefixes": {}}


def readdress(prefix):
    topo.ns("nlc", "ip addr flush dev c0")
    topo.ns("nlc", "ip addr add 10.0.1.2/%d dev c0" % prefix)
    topo.ns("nlc", "ip link set c0 up")
    topo.ns("nlc", "ip route replace default via 10.0.1.1", check=False)


for p in PREFIXES:
    readdress(p)
    row = {}
    for d in DESTS:
        out = topo.ns("nlc", "ip route get %s" % d)
        via = re.search(r"via (\S+)", out)
        row[d] = {"via": via.group(1) if via else None, "line": out.split("\n")[0]}
    result["prefixes"][str(p)] = row

# the table the lesson prints, in the kernel's own words
readdress(24)
result["route_table_24"] = topo.ns("nlc", "ip route")
result["addr_24"] = topo.ns("nlc", "ip -o -4 addr show dev c0")
# all of 127/8 is loopback on Linux: another 127.x address answers without any cable
result["loopback"] = topo.ns("nlc", "ping -c1 -W1 127.0.0.2 | tail -2")
topo.teardown()
topo.save_json("02_addresses.json", result)
print("ok")
