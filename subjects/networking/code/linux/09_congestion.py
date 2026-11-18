"""Exercise 09 (Linux side): congestion control. A client sends 3 MB to a server across a bottleneck of 8 Mbit/s on the router (token bucket filter with a queue), 20 ms round trip.
The congestion window (cwnd), slow start threshold, smoothed round trip and retransmissions of the client's socket are read from `ss -ti` every 20 ms.
Two runs differ only in the size of the queue in front of the bottleneck: 30 KB and 600 KB. While the transfer runs, a ping measures the round trip."""
import json
import os
import re
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import topo  # noqa: E402

TOOLS = os.path.join(topo.HERE, "_tcp_tools.py")
SIZE = 3_000_000
R = {"size": SIZE}


def sample(duration, step=0.012):
    """Read cwnd, ssthresh, rtt, bytes in flight... of the client's connection every `step` seconds."""
    out, t0 = [], time.time()
    while time.time() - t0 < duration:
        txt = subprocess.run(["ip", "netns", "exec", "nlc", "ss", "-tinH", "dst", "10.0.2.2"], capture_output=True, text=True).stdout
        m = re.search(r"cwnd:(\d+)", txt)
        if m:
            row = {"t": round(time.time() - t0, 3), "cwnd": int(m.group(1))}
            alg = re.search(r"(reno|cubic|bbr)", txt)
            if alg:
                row["algo"] = alg.group(1)
            for key, rx in (("ssthresh", r"ssthresh:(\d+)"), ("rtt", r"rtt:([\d.]+)/"), ("retrans", r"retrans:\d+/(\d+)"), ("unacked", r"unacked:(\d+)"), ("acked", r"bytes_acked:(\d+)"), ("rate", r"delivery_rate (\d+)bps")):
                mm = re.search(rx, txt)
                if mm:
                    row[key] = float(mm.group(1)) if "." in mm.group(1) else int(mm.group(1))
            out.append(row)
        time.sleep(step)
    return out


def run(name, queue_bytes, ping=False):
    topo.build()
    for nm, dev in (("nlc", "c0"), ("nls", "s0"), ("nlr", "rc"), ("nlr", "rs")):
        topo.ns(nm, "ip link set %s gso_max_segs 1 gso_max_size 1514" % dev)
    for nm in ("nlc", "nls"):
        topo.ns(nm, "sysctl -qw net.ipv4.tcp_congestion_control=reno")
    topo.ns("nlc", "tc qdisc add dev c0 root netem delay 10ms")
    topo.ns("nls", "tc qdisc add dev s0 root netem delay 10ms")
    algo = topo.ns("nlc", "sysctl -n net.ipv4.tcp_congestion_control")
    topo.ns("nlr", "tc qdisc add dev rs root tbf rate 8mbit burst 20000 limit %d" % queue_bytes)
    topo.spawn("nls", ["python3", TOOLS, "sink", "9300", "0"])
    time.sleep(0.6)
    res = {"algo": algo}
    with topo.Capture("nlc", "c0", "09_%s.pcap" % name, "tcp port 9300"):
        time.sleep(0.2)
        t0 = time.time()
        cl = topo.spawn("nlc", ["python3", TOOLS, "bulk", "10.0.2.2", "9300", str(SIZE), "50300"])
        pg = None
        if ping:
            pg = subprocess.Popen(["ip", "netns", "exec", "nlc", "bash", "-c", "sleep 0.4; ping -i 0.2 -c 20 10.0.2.2"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        res["series"] = sample(6.0)
        out, _ = cl.communicate(timeout=60)
        res["elapsed"] = round(time.time() - t0, 2)
        res["bulk"] = out.decode().strip()
        if pg:
            res["ping"] = pg.communicate(timeout=30)[0]
        time.sleep(0.4)
    res["qdisc"] = topo.ns("nlr", "tc -s qdisc show dev rs")
    topo.stop_all()
    return res


# idle round trip, for reference
topo.build()
topo.ns("nlc", "tc qdisc add dev c0 root netem delay 10ms")
topo.ns("nls", "tc qdisc add dev s0 root netem delay 10ms")
R["idle_ping"] = topo.ns("nlc", "ping -c4 -i 0.2 10.0.2.2 | tail -1")
R["algo"] = topo.ns("nlc", "sysctl -n net.ipv4.tcp_congestion_control")
R["init_cwnd"] = "10"
R["small"] = run("small", 30000)
R["big"] = run("big", 600000, ping=True)
topo.teardown()
topo.save_json("09_congestion.json", R)
print("ok")
