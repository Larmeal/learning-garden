"""Exercise 06 (Linux side): UDP datagrams that get lost, and DNS with a root, a TLD, an authoritative server and a caching resolver (all on one switch)."""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import topo  # noqa: E402

HERE = topo.HERE
R = {}
topo.build_switch(("nlc", "nlres", "nlroot", "nltld", "nlauth"))   # 10.0.1.2 client, .3 resolver, .4 root, .5 tld, .6 authoritative

# ---- 1. UDP: six datagrams, every third one is dropped on the way in, and nobody is told ----
topo.ns("nlroot", "iptables -A INPUT -p udp --dport 9999 -m statistic --mode nth --every 3 --packet 2 -j DROP")
topo.ns("nlc", "iptables -t mangle -A POSTROUTING -p udp --dport 9999 -j CHECKSUM --checksum-fill")   # the kernel would otherwise leave the checksum for the card to fill in
sink = topo.spawn("nlroot", ["python3", os.path.join(HERE, "_udp_sink.py"), "9999", "2.5"])
time.sleep(0.6)
with topo.Capture("nlc", "e0", "06_udp_c.pcap", "udp port 9999"):
    time.sleep(0.3)
    R["udp_send"] = topo.ns("nlc", "python3 %s 10.0.1.4 9999" % os.path.join(HERE, "_udp_send.py"))
    time.sleep(0.3)
out, _ = sink.communicate(timeout=10)
R["udp_sink"] = json.loads(out.decode().strip().splitlines()[-1])
R["udp_drops"] = topo.ns("nlroot", "iptables -L INPUT -v -n -x")
topo.stop_all()

# ---- 2. DNS ----
zones = {
    "root": {"zone": ".", "records": [
        {"name": ".", "type": "NS", "value": "a.root.", "ttl": 518400}, {"name": "a.root.", "type": "A", "value": "10.0.1.4", "ttl": 518400},
        {"name": "test.", "type": "NS", "value": "a.nic.test.", "ttl": 172800}, {"name": "a.nic.test.", "type": "A", "value": "10.0.1.5", "ttl": 172800}]},
    "tld": {"zone": "test.", "records": [
        {"name": "test.", "type": "NS", "value": "a.nic.test.", "ttl": 172800}, {"name": "a.nic.test.", "type": "A", "value": "10.0.1.5", "ttl": 172800},
        {"name": "example.test.", "type": "NS", "value": "ns1.example.test.", "ttl": 172800}, {"name": "ns1.example.test.", "type": "A", "value": "10.0.1.6", "ttl": 172800}]},
    "auth": {"zone": "example.test.", "records": [
        {"name": "example.test.", "type": "NS", "value": "ns1.example.test.", "ttl": 172800}, {"name": "ns1.example.test.", "type": "A", "value": "10.0.1.6", "ttl": 172800},
        {"name": "www.example.test.", "type": "A", "value": "10.0.2.50", "ttl": 300}, {"name": "api.example.test.", "type": "CNAME", "value": "www.example.test.", "ttl": 300}]},
}
for k, z in zones.items():
    with open(os.path.join(topo.OUT, "06_zone_%s.json" % k), "w") as f:
        json.dump(z, f)
for host, k, ip in (("nlroot", "root", "10.0.1.4"), ("nltld", "tld", "10.0.1.5"), ("nlauth", "auth", "10.0.1.6")):
    topo.ns(host, "tc qdisc add dev e0 root netem delay 20ms")   # every answer of these three takes 20 ms more
    topo.spawn(host, ["python3", os.path.join(HERE, "_dnsd.py"), os.path.join(topo.OUT, "06_zone_%s.json" % k), ip])
topo.spawn("nlres", ["python3", os.path.join(HERE, "_resolver.py"), "10.0.1.3", "10.0.1.4"])
time.sleep(1.0)


def dig(args):
    return topo.ns("nlc", "dig +time=3 +tries=1 %s" % args, check=False)


steps = [
    ("www1", "@10.0.1.3 www.example.test A +noall +answer +stats"),
    ("www2", "@10.0.1.3 www.example.test A +noall +answer +stats"),
    ("api", "@10.0.1.3 api.example.test A +noall +answer +stats"),
    ("nx", "@10.0.1.3 nope.example.test A +noall +comments +stats"),
]
for name, args in steps:
    with topo.Capture("nlres", "e0", "06_dns_%s.pcap" % name, "udp port 53"):
        time.sleep(0.3)
        R["dig_" + name] = dig(args)
        time.sleep(0.4)
R["dig_root"] = dig("@10.0.1.4 www.example.test A +norecurse +noall +authority +additional +comments")
R["dig_tld"] = dig("@10.0.1.5 www.example.test A +norecurse +noall +authority +additional +comments")
R["dig_auth"] = dig("@10.0.1.6 www.example.test A +norecurse +noall +answer +comments")
topo.stop_all()
topo.teardown()
topo.save_json("06_udp_dns.json", R)
print("ok")
