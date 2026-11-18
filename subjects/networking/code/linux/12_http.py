"""Exercise 12 (Linux side): HTTP/1.1, HTTP/2 and QUIC. Six requests, a server that takes 100 ms to answer each, a round trip of 20 ms; then a transfer of 3 x 150 KB with one packet lost, over a round trip of 100 ms."""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import topo  # noqa: E402

TOOL = os.path.join(topo.HERE, "_http_tools.py")
TLS = os.path.join(topo.HERE, "_tls_tools.py")
PKI = os.path.join(topo.OUT, "pki")
R = {}


def last(txt):
    return json.loads(txt.strip().splitlines()[-1])


def py(ns, args):
    return topo.ns(ns, "python3 %s %s" % (TOOL, args), check=False)


def fresh(delay_ms):
    topo.build()
    for nm, dev in (("nlc", "c0"), ("nls", "s0"), ("nlr", "rc"), ("nlr", "rs")):
        topo.ns(nm, "ip link set %s gso_max_segs 1 gso_max_size 1514" % dev)
    topo.ns("nlc", "tc qdisc add dev c0 root netem delay %dms" % delay_ms)
    topo.ns("nls", "tc qdisc add dev s0 root netem delay %dms" % delay_ms)


if not os.path.exists(os.path.join(PKI, "valid.pem")):
    topo.sh("python3 %s pki %s" % (TLS, PKI))

# ---- 1. six requests, 100 ms of work each, RTT 20 ms ----
fresh(10)
topo.spawn("nls", ["python3", TOOL, "h1_server", "8080", "100", "1000"])
topo.spawn("nls", ["python3", TOOL, "h2_server", "8082", "100", "1000"])
time.sleep(1.2)
topo.ns("nlc", "ping -c1 -W1 10.0.2.2")
for how in ("new", "reuse", "parallel"):
    R["h1_" + how] = last(py("nlc", "h1_client 10.0.2.2 8080 6 %s" % how))
with topo.Capture("nlc", "c0", "12_h2.pcap", "tcp port 8082"):
    time.sleep(0.2)
    R["h2"] = last(py("nlc", "h2_client 10.0.2.2 8082 6"))
    time.sleep(0.3)
topo.stop_all()

# ---- 2. the same first request over a round trip of 100 ms: plain TCP, TCP + TLS 1.3, and QUIC ----
fresh(50)
topo.spawn("nls", ["python3", TOOL, "h1_server", "8080", "0", "1000"])
topo.spawn("nls", ["python3", TOOL, "quic_server", "4433", os.path.join(PKI, "valid.pem"), os.path.join(PKI, "valid.key"), "0", "1000"])
topo.spawn("nls", ["python3", TLS, "server", "8443", os.path.join(PKI, "valid.pem"), os.path.join(PKI, "valid.key")])
time.sleep(1.5)
topo.ns("nlc", "ping -c1 -W1 10.0.2.2")
R["ping100"] = topo.ns("nlc", "ping -c3 -i0.2 10.0.2.2 | tail -1")
R["plain100"] = last(topo.ns("nlc", "python3 %s plain_client 10.0.2.2 8080" % TLS))
R["tls100"] = last(topo.ns("nlc", "python3 %s client 10.0.2.2 8443 %s garden.test" % (TLS, os.path.join(PKI, "ca1.pem"))))
with topo.Capture("nlc", "c0", "12_quic.pcap", "udp port 4433"):
    time.sleep(0.3)
    R["quic100"] = last(py("nlc", "quic_client 10.0.2.2 4433 %s 1" % os.path.join(PKI, "ca1.pem")))
    time.sleep(0.4)
topo.stop_all()
topo.teardown()
topo.save_json("12_http.json", R)
print("ok")
