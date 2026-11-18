"""Exercise 08 (Linux side): lost segments, the retransmission timer, fast retransmit with SACK, Nagle with delayed ACK, and a receiver that does not read (zero window).
A client, a router and a server with 10 ms of delay in each direction (round trip 20 ms). Packets are dropped by iptables rules on the router."""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import topo  # noqa: E402

TOOLS = os.path.join(topo.HERE, "_tcp_tools.py")
R = {}
topo.build()
for nm, dev in (("nlc", "c0"), ("nls", "s0"), ("nlr", "rc"), ("nlr", "rs")):
    topo.ns(nm, "ip link set %s gso_max_segs 1 gso_max_size 1514" % dev)
topo.ns("nlc", "tc qdisc add dev c0 root netem delay 10ms")
topo.ns("nls", "tc qdisc add dev s0 root netem delay 10ms")
# one segment per frame in the captures (otherwise the kernel hands the card frames of several segments at once)


def sink(port, delay=0.0, rcvbuf=None):
    argv = ["python3", TOOLS, "sink", str(port), str(delay)] + ([str(rcvbuf)] if rcvbuf else [])
    p = topo.spawn("nls", argv)
    time.sleep(0.6)
    return p


def finish(p):
    out, _ = p.communicate(timeout=30)
    return out.decode().strip().splitlines()[-1]


# ---- 1. a lost segment is sent again when the timer runs out, and the timer doubles ----
sk = sink(9000)
topo.ns("nlr", "iptables -A FORWARD -p tcp --dport 9000 -m length --length 100: -j DROP")
with topo.Capture("nlc", "c0", "08_rto.pcap", "tcp port 9000"):
    time.sleep(0.2)
    cl = topo.spawn("nlc", ["python3", TOOLS, "bulk", "10.0.2.2", "9000", "100", "50000", "3.2"])
    time.sleep(0.95)
    topo.ns("nlr", "iptables -D FORWARD -p tcp --dport 9000 -m length --length 100: -j DROP")
    R["rto_sink"] = finish(sk)
    cl.communicate(timeout=10)
    time.sleep(0.3)
R["rto_min"] = topo.ns("nlc", "ip route show; ss -ti state established | head -1 || true", check=False)

# ---- 2. a segment lost in a stream: three duplicate ACKs make the sender send it again at once ----
sk = sink(9001)
topo.ns("nlr", "iptables -A FORWARD -p tcp --dport 9001 -m length --length 1000: -m statistic --mode nth --every 1000 --packet 2 -j DROP")
with topo.Capture("nlc", "c0", "08_fast_c.pcap", "tcp port 9001"), topo.Capture("nls", "s0", "08_fast_s.pcap", "tcp port 9001"):
    time.sleep(0.2)
    R["fast_bulk"] = topo.ns("nlc", "python3 %s bulk 10.0.2.2 9001 43440 50001" % TOOLS)
    R["fast_sink"] = finish(sk)
    time.sleep(0.4)
R["fast_drops"] = topo.ns("nlr", "iptables -L FORWARD -v -n -x | grep 9001")

# ---- 3. Nagle: five small writes, with and without TCP_NODELAY ----
for nd in (0, 1):
    sk = sink(9100 + nd)
    with topo.Capture("nlc", "c0", "08_nagle%d.pcap" % nd, "tcp port %d" % (9100 + nd)):
        time.sleep(0.2)
        topo.ns("nlc", "python3 %s small 10.0.2.2 %d %d %d" % (TOOLS, 9100 + nd, nd, 50010 + nd))
        R["nagle_sink%d" % nd] = finish(sk)
        time.sleep(0.2)

# ---- 4. a receiver that does not read: the window closes, the sender probes, the window opens again ----
sk = sink(9200, delay=2.0, rcvbuf=8192)
with topo.Capture("nlc", "c0", "08_zero_c.pcap", "tcp port 9200"):
    time.sleep(0.2)
    R["zero_bulk"] = topo.ns("nlc", "python3 %s bulk 10.0.2.2 9200 200000 50020" % TOOLS)
    R["zero_sink"] = finish(sk)
    time.sleep(0.3)
topo.stop_all()
topo.teardown()
topo.save_json("08_tcp_reliability.json", R)
print("ok")
