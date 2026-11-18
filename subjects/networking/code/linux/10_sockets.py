"""Exercise 10 (Linux side): what a program sees through the socket API. A byte stream without message boundaries, a listen backlog that fills up, ephemeral ports that run out,
and a port that cannot be bound again right after a close. Client, router and server with 10 ms of delay in each direction."""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import topo  # noqa: E402

TOOL = os.path.join(topo.HERE, "_sock_tools.py")
R = {}
topo.build()
topo.ns("nlc", "tc qdisc add dev c0 root netem delay 10ms")
topo.ns("nls", "tc qdisc add dev s0 root netem delay 10ms")


def line(p):
    out, _ = p.communicate(timeout=40)
    return json.loads(out.decode().strip().splitlines()[-1])


def server(args, ns="nls"):
    p = topo.spawn(ns, ["python3", TOOL] + args)
    time.sleep(0.6)
    return p


# ---- 1. TCP is a stream: three writes arrive as one read; and a small recv gets pieces ----
sv = server(["stream_server", "9500"])
with topo.Capture("nls", "s0", "10_stream.pcap", "tcp port 9500"):
    time.sleep(0.2)
    R["stream_client"] = json.loads(topo.ns("nlc", "python3 %s stream_client 10.0.2.2 9500" % TOOL).strip().splitlines()[-1])
    R["stream"] = line(sv)
    time.sleep(0.3)
sv = server(["small_recv", "9501"])
topo.ns("nlc", "python3 %s stream_client 10.0.2.2 9501" % TOOL)
R["small"] = line(sv)

# ---- 2. the listen backlog: the server listens with a backlog of 2 and never calls accept ----
sv = server(["backlog_server", "9600", "2", "9"])
R["listen_before"] = topo.ns("nls", "ss -ltnH 'sport = :9600'")
with topo.Capture("nlc", "c0", "10_backlog.pcap", "tcp port 9600"):
    time.sleep(0.3)
    R["backlog"] = json.loads(topo.ns("nlc", "python3 %s connect_n 10.0.2.2 9600 6 1.5" % TOOL).strip().splitlines()[-1])
    R["listen_during"] = topo.ns("nls", "ss -ltnH 'sport = :9600'")
    time.sleep(0.2)
R["backlog_drops"] = topo.ns("nls", "nstat -az TcpExtListenOverflows TcpExtListenDrops | tail -2")
sv.kill()

# ---- 3. ephemeral ports ----
R["port_range_default"] = topo.ns("nlc", "sysctl -n net.ipv4.ip_local_port_range")
sv = server(["hold_server", "9700", "6"])
R["ports_default"] = json.loads(topo.ns("nlc", "python3 %s ports 10.0.2.2 9700 3" % TOOL).strip().splitlines()[-1])
topo.ns("nlc", "sysctl -qw net.ipv4.ip_local_port_range='40000 40002'")
R["port_range_small"] = topo.ns("nlc", "sysctl -n net.ipv4.ip_local_port_range")
R["ports_small"] = json.loads(topo.ns("nlc", "python3 %s ports 10.0.2.2 9700 5" % TOOL).strip().splitlines()[-1])
sv.kill()

# ---- 4. bind again right after a close ----
for flag in ("0", "1"):
    R["reuse" + flag] = json.loads(topo.ns("nls", "python3 %s reuse %s" % (TOOL, flag)).strip().splitlines()[-1])
R["tw_range"] = topo.ns("nls", "ss -tan state time-wait | head -3")
topo.stop_all()
topo.teardown()
topo.save_json("10_sockets.json", R)
print("ok")
