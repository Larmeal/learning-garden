"""Exercise 07 (Linux side): the life of a TCP connection: handshake, states, close, TIME-WAIT, reset, and a connect that nobody answers. 10 ms of delay in each direction."""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import topo  # noqa: E402

HERE = topo.HERE
R = {}
topo.build()
topo.ns("nlc", "tc qdisc add dev c0 root netem delay 10ms")
topo.ns("nls", "tc qdisc add dev s0 root netem delay 10ms")
topo.spawn("nls", ["python3", os.path.join(HERE, "_canned_server.py"), "8080"])
time.sleep(0.6)
R["listen"] = topo.ns("nls", "ss -tan state listening")

# ---- 1. one whole connection, captured at both ends ----
with topo.Capture("nlc", "c0", "07_c.pcap", "tcp port 8080"), topo.Capture("nls", "s0", "07_s.pcap", "tcp port 8080"):
    time.sleep(0.3)
    R["get"] = topo.ns("nlc", "python3 %s 10.0.2.2 8080 50000" % os.path.join(HERE, "_get.py"))
    time.sleep(0.2)
    R["server_states_after"] = topo.ns("nls", "ss -tano state time-wait state fin-wait-1 state fin-wait-2 state close-wait state last-ack")
    R["client_states_after"] = topo.ns("nlc", "ss -tano state time-wait state fin-wait-1 state fin-wait-2 state close-wait state last-ack")
    time.sleep(0.4)

# ---- 2. an open connection that does nothing: both sides ESTABLISHED ----
hold = topo.spawn("nlc", ["python3", os.path.join(HERE, "_hold.py"), "10.0.2.2", "8080", "2.5", "50001"])
time.sleep(1.0)
R["client_estab"] = topo.ns("nlc", "ss -tan state established")
R["server_estab"] = topo.ns("nls", "ss -tan state established")
hold.wait(timeout=6)

# ---- 3. a port where nobody listens: the answer is a reset ----
with topo.Capture("nlc", "c0", "07_rst.pcap", "tcp port 8099"):
    time.sleep(0.6)
    R["refused"] = topo.ns("nlc", "python3 %s 10.0.2.2 8099 3 50002" % os.path.join(HERE, "_probe.py"))
    time.sleep(0.8)

# ---- 4. a server that says nothing: the SYN is sent again and again ----
topo.ns("nls", "iptables -A INPUT -p tcp --dport 8081 -j DROP")
with topo.Capture("nlc", "c0", "07_silent.pcap", "tcp port 8081"):
    time.sleep(0.3)
    R["silent"] = topo.ns("nlc", "python3 %s 10.0.2.2 8081 9 50003" % os.path.join(HERE, "_probe.py"))
    time.sleep(0.3)
R["syn_retries"] = topo.ns("nlc", "sysctl -n net.ipv4.tcp_syn_retries")
R["syn_linear"] = topo.ns("nlc", "sysctl -n net.ipv4.tcp_syn_linear_timeouts 2>&1 || true")
R["tw_timer"] = topo.ns("nls", "ss -tano state time-wait")
topo.stop_all()
topo.teardown()
topo.save_json("07_tcp_connections.json", R)
print("ok")
