"""Exercise 14 (Linux side): how a failure shows itself. Client, router and server with 10 ms of delay each way. First a request is timed in three phases (connect, wait, transfer) while
the network is made slow and then the application is made slow. Then the same connection attempt is made against seven different faults (nothing listening, a firewall that drops, a firewall that
rejects, a route that is gone, a cable that is cut, a lossy link) and what the program sees, and how long it took, is recorded."""
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import topo  # noqa: E402

T = os.path.join(topo.HERE, "_timing.py")
PROBE = os.path.join(topo.HERE, "_probe.py")
R = {}


def last(txt):
    return json.loads(txt.strip().splitlines()[-1])


def probe(port=9000, secs=3):
    out = topo.ns("nlc", "python3 %s 10.0.2.2 %d %s" % (PROBE, port, secs), check=False).strip().splitlines()[-1].split()
    return {"result": out[0], "secs": float(out[1])}


topo.build()
topo.ns("nlc", "tc qdisc add dev c0 root netem delay 10ms")
topo.ns("nls", "tc qdisc add dev s0 root netem delay 10ms")

# ---- 1. ping and the three phases of a request ----
R["ping"] = topo.ns("nlc", "ping -c4 -i 0.2 10.0.2.2 | tail -2")
srv = topo.spawn("nls", ["python3", T, "serve", "9000", "50", "50000"])
time.sleep(0.6)
R["base"] = last(topo.ns("nlc", "python3 %s get 10.0.2.2 9000 7" % T))
topo.ns("nlc", "tc qdisc change dev c0 root netem delay 100ms")
topo.ns("nls", "tc qdisc change dev s0 root netem delay 100ms")
R["slow_net"] = last(topo.ns("nlc", "python3 %s get 10.0.2.2 9000 7" % T))
topo.ns("nlc", "tc qdisc change dev c0 root netem delay 10ms")
topo.ns("nls", "tc qdisc change dev s0 root netem delay 10ms")
srv.kill()
time.sleep(0.3)
srv = topo.spawn("nls", ["python3", T, "serve", "9000", "300", "50000"])
time.sleep(0.6)
R["slow_app"] = last(topo.ns("nlc", "python3 %s get 10.0.2.2 9000 7" % T))
srv.kill()
time.sleep(0.3)

# ---- 2. seven faults, one connection attempt each ----
srv = topo.spawn("nls", ["python3", T, "serve", "9000", "0", "100"])
time.sleep(0.6)
F = {}
F["ok"] = probe()
F["nothing_listening"] = probe(port=9999)

topo.ns("nls", "iptables -A INPUT -p tcp --dport 9000 -j DROP")
with topo.Capture("nls", "s0", "14_drop.pcap", "tcp port 9000"):
    time.sleep(0.3)
    p = topo.spawn("nlc", ["python3", PROBE, "10.0.2.2", "9000", "3.5"])
    time.sleep(1.5)
    R["ss_syn_sent"] = topo.ns("nlc", "ss -tnH state syn-sent")
    out, _ = p.communicate(timeout=10)
    o = out.decode().strip().splitlines()[-1].split()
    F["firewall_drop"] = {"result": o[0], "secs": float(o[1])}
    time.sleep(0.3)
topo.ns("nls", "iptables -F INPUT")

topo.ns("nls", "iptables -A INPUT -p tcp --dport 9000 -j REJECT")
F["firewall_reject_icmp"] = probe()
topo.ns("nls", "iptables -F INPUT")
topo.ns("nls", "iptables -A INPUT -p tcp --dport 9000 -j REJECT --reject-with tcp-reset")
F["firewall_reject_rst"] = probe()
topo.ns("nls", "iptables -F INPUT")

topo.ns("nlr", "ip route del 10.0.2.0/24")
F["route_gone"] = probe()
topo.ns("nlr", "ip route add 10.0.2.0/24 dev rs")

topo.ns("nls", "tc qdisc change dev s0 root netem delay 10ms loss 100%")
F["cable_cut"] = probe()
topo.ns("nls", "tc qdisc change dev s0 root netem delay 10ms")
time.sleep(0.3)

topo.ns("nlc", "tc qdisc change dev c0 root netem delay 10ms loss 40%")
runs = []
for _ in range(20):
    runs.append(probe(secs=6))
topo.ns("nlc", "tc qdisc change dev c0 root netem delay 10ms")
R["lossy_runs"] = runs
F["lossy_link"] = {"result": "connected" if all(r["result"] == "connected" for r in runs) else "mixed", "secs": max(r["secs"] for r in runs)}
R["faults"] = F
R["route_after"] = topo.ns("nlr", "ip route show")

topo.stop_all()
topo.teardown()
topo.save_json("14_debugging.json", R)
print("ok")
