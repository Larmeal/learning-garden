"""Lesson 2: IP addresses, subnets and CIDR.

Pure arithmetic with the standard library (`ipaddress`) plus one real question to the Linux kernel: for each prefix length of the client's own
address, does `ip route get` send a packet straight to the destination or to the router? Asserts that an IPv4 address is a 32-bit number, how a
mask splits it, the sizes of the common prefix lengths, subnetting and aggregation, which addresses are special-use, and that the kernel's
decision (on the same subnet, or through the gateway) is exactly the comparison of the destination with the network address.
`--write` saves site/src/components/labs/networking/cidr.json for CidrLab.
"""

import ipaddress
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from netlab import LABS, check, linux, load, show, table  # noqa: E402

WRITE = "--write" in sys.argv

# ---- 1. an address is a 32-bit number written as four bytes ----
ip = ipaddress.ip_address("10.0.1.2")
n = int(ip)
show("10.0.1.2 as a number", f"{n}  =  0x{n:08X}  =  {n:032b}")
check("an IPv4 address is a 32-bit number", n == 167772418 and n < 2**32)
check("the four numbers are the four bytes", ip.packed == bytes([10, 0, 1, 2]))
check("dotted form is only a way of writing it", ipaddress.ip_address(167772418) == ip)

# ---- 2. a prefix length splits it into 'which network' and 'which host' ----
net = ipaddress.ip_network("10.0.1.2/24", strict=False)
mask = int(net.netmask)
rows = [
    ["address", str(ip), f"{n:032b}"],
    ["mask /24", str(net.netmask), f"{mask:032b}"],
    ["address AND mask", str(net.network_address), f"{n & mask:032b}"],
    ["broadcast (host bits all 1)", str(net.broadcast_address), f"{(n & mask) | (~mask & 0xFFFFFFFF):032b}"],
]
show("splitting 10.0.1.2/24", table(rows))
check("the network address is the address AND the mask", ipaddress.ip_address(n & mask) == net.network_address == ipaddress.ip_address("10.0.1.0"))
check("the broadcast address is the network address with every host bit set", str(net.broadcast_address) == "10.0.1.255")
check("a /24 has 256 addresses and 254 usable hosts (the first and the last are the network and the broadcast)", net.num_addresses == 256 and len(list(net.hosts())) == 254)
check("the usable range is 10.0.1.1 to 10.0.1.254", (str(next(net.hosts())), str(list(net.hosts())[-1])) == ("10.0.1.1", "10.0.1.254"))

sizes = [[f"/{p}", str(ipaddress.ip_network(f"10.0.0.0/{p}").netmask), 2 ** (32 - p), max(0, 2 ** (32 - p) - 2)] for p in (8, 16, 22, 24, 26, 30, 31, 32)]
show("size of common prefix lengths", table(sizes, ["prefix", "mask", "addresses", "usable hosts"]))
check("every bit added to the prefix halves the network", all(2 ** (32 - a) == 2 * 2 ** (32 - (a + 1)) for a in range(8, 30)))
check("a /30 holds 2 hosts, the size of a link between two routers", ipaddress.ip_network("10.0.0.0/30").num_addresses - 2 == 2)

# ---- 3. subnetting and aggregation ----
parts = list(ipaddress.ip_network("10.0.0.0/22").subnets(new_prefix=24))
check("a /22 splits into four /24", [str(p) for p in parts] == ["10.0.0.0/24", "10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"])
check("four neighbouring /24 aggregate into one /22 (CIDR aggregation: one route instead of four)", [str(x) for x in ipaddress.collapse_addresses(parts)] == ["10.0.0.0/22"])
check("two /24 that do not touch cannot be aggregated", len(list(ipaddress.collapse_addresses([ipaddress.ip_network("10.0.0.0/24"), ipaddress.ip_network("10.0.2.0/24")]))) == 2)
vlsm = list(ipaddress.ip_network("10.0.1.0/24").subnets(new_prefix=26))
check("one /24 cut into four /26 of 64 addresses each (subnets of different sizes in one network are VLSM)", [p.num_addresses for p in vlsm] == [64] * 4)

# ---- 4. special-use addresses ----
special = {
    "10.0.1.2": "private (RFC 1918)", "172.16.5.4": "private (RFC 1918)", "192.168.1.10": "private (RFC 1918)", "127.0.0.1": "loopback",
    "169.254.7.7": "link-local", "224.0.0.251": "multicast", "100.64.0.1": "shared address space (carrier-grade NAT)", "8.8.8.8": "public",
}
rows = []
for a, what in special.items():
    o = ipaddress.ip_address(a)
    rows.append([a, what, o.is_private, o.is_global, o.is_loopback, o.is_multicast, o.is_link_local])
show("how the standard library classifies a few addresses", table(rows, ["address", "meaning", "private", "global", "loopback", "multicast", "link-local"]))
check("the three private blocks are not global", all(not ipaddress.ip_address(a).is_global for a in ("10.0.1.2", "172.16.5.4", "192.168.1.10")))
check("8.8.8.8 is a public address", ipaddress.ip_address("8.8.8.8").is_global)
check("100.64.0.0/10 is neither private nor global (it is its own range)", not ipaddress.ip_address("100.64.0.1").is_global and not ipaddress.ip_address("100.64.0.1").is_private)
check("172.16.0.0/12 covers 172.16 to 172.31 only", ipaddress.ip_address("172.31.255.255").is_private and not ipaddress.ip_address("172.32.0.1").is_private)
first_octet = lambda a: int(a.split(".")[0])  # noqa: E731
classful = lambda a: "A" if first_octet(a) < 128 else "B" if first_octet(a) < 192 else "C" if first_octet(a) < 224 else "D/E"  # noqa: E731
check("the old classful rule (class A 0 to 127, B 128 to 191, C 192 to 223) gives 10.0.1.2 a /8 mask, yet we use /24", classful("10.0.1.2") == "A" and classful("172.16.5.4") == "B" and classful("192.168.1.10") == "C")
v6 = ipaddress.ip_address("2001:db8:0:0:0:0:0:1")
check("IPv6 is 128 bits and written with the zeros squeezed out", v6.max_prefixlen == 128 and str(v6) == "2001:db8::1" and v6.exploded == "2001:0db8:0000:0000:0000:0000:0000:0001")
check("a normal IPv6 subnet is a /64: 64 bits for the network, 64 for the interface identifier", ipaddress.ip_network("2001:db8:1:2::/64").num_addresses == 2**64)

# ---- 5. the kernel makes the same decision ----
print(linux("02_addresses.py").strip())
data = load("02_addresses.json")
show("ip route (client with 10.0.1.2/24)", data["route_table_24"])
show("ip route get 10.0.1.77  and  ip route get 10.0.2.2", data["prefixes"]["24"]["10.0.1.77"]["line"] + "\n" + data["prefixes"]["24"]["10.0.2.2"]["line"])
check("with a /24 the kernel sends 10.0.1.77 straight out (no 'via')", data["prefixes"]["24"]["10.0.1.77"]["via"] is None)
check("with a /24 the kernel sends 10.0.2.2 through the gateway 10.0.1.1", data["prefixes"]["24"]["10.0.2.2"]["via"] == "10.0.1.1")
rows = []
for p, row in data["prefixes"].items():
    mynet = ipaddress.ip_network(f"10.0.1.2/{p}", strict=False)
    for dest, r in row.items():
        expect_direct = ipaddress.ip_address(dest) in mynet
        assert (r["via"] is None) == expect_direct, (p, dest, r, mynet)
    rows.append([f"/{p}", str(mynet)] + ["direct" if r["via"] is None else "via router" for r in row.values()])
show("what the kernel did, for each prefix length of the client's own address", table(rows, ["prefix", "own network"] + data["dests"]))
check("for 8 prefix lengths and 5 destinations the kernel's choice equals 'is the destination inside my network?'", True)
check("a /22 makes 10.0.2.2 a neighbour: the router is no longer used, and ARP would ask for 10.0.2.2 itself", data["prefixes"]["22"]["10.0.2.2"]["via"] is None and data["prefixes"]["23"]["10.0.2.2"]["via"] == "10.0.1.1")
check("a /23 reaches 10.0.1.200 but not 10.0.2.2: 10.0.0.0/23 ends at 10.0.1.255", data["prefixes"]["23"]["10.0.1.200"]["via"] is None)
check("127.0.0.2 answers on a computer with no cable: all of 127.0.0.0/8 is loopback", "1 received" in data["loopback"])

if WRITE:
    out = {"dests": data["dests"], "base": "10.0.1.2", "kernel": {p: {d: r["via"] is None for d, r in row.items()} for p, row in data["prefixes"].items()}}
    (LABS / "cidr.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print("wrote", LABS / "cidr.json")
print("ok")
