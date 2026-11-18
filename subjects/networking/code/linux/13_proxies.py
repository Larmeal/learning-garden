"""Exercise 13 (Linux side): a host that behaves like a Docker or Kubernetes node. Client 10.0.1.2, the host nlr (10.0.1.1 and 10.0.2.1), an outside server 10.0.2.2, and two 'containers' on a bridge
inside the host: nlk1 (10.244.0.2) and nlk2 (10.244.0.3). Container network = network namespace + veth pair + bridge. NAT, port publishing, a layer-4 load balancer with iptables (the way kube-proxy
does it) and a layer-7 reverse proxy."""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import topo  # noqa: E402

TOOL = os.path.join(topo.HERE, "_lb_tools.py")
R = {}


def last(txt):
    return json.loads(txt.strip().splitlines()[-1])


topo.build(extra_ns=("nlk1", "nlk2"))
topo.ns("nlr", "ip link add br0 type bridge")
topo.ns("nlr", "ip addr add 10.244.0.1/24 dev br0")
topo.ns("nlr", "ip link set br0 up")
for i, ns in enumerate(("nlk1", "nlk2"), 1):
    topo.sh("ip link add vh%d type veth peer name eth0 netns %s" % (i, ns))
    topo.sh("ip link set vh%d netns nlr" % i) if False else None
for i, ns in enumerate(("nlk1", "nlk2"), 1):
    topo.sh("ip link set vh%d netns nlr" % i)
    topo.ns("nlr", "ip link set vh%d master br0" % i)
    topo.ns("nlr", "ip link set vh%d up" % i)
    topo.ns(ns, "ip addr add 10.244.0.%d/24 dev eth0" % (i + 1))
    topo.ns(ns, "ip link set eth0 up")
    topo.ns(ns, "ip route add default via 10.244.0.1")
R["bridge"] = topo.ns("nlr", "bridge link show")
R["k1_addr"] = topo.ns("nlk1", "ip -o -4 addr show dev eth0")
R["k1_route"] = topo.ns("nlk1", "ip route")
topo.spawn("nlk1", ["python3", TOOL, "backend", "k1", "80"])
topo.spawn("nlk2", ["python3", TOOL, "backend", "k2", "80"])
topo.spawn("nls", ["python3", TOOL, "backend", "outside", "8080"])
time.sleep(1.0)

# ---- 1. container to container over the bridge: layer 2 only, no router ----
R["k1_to_k2_ping"] = topo.ns("nlk1", "ping -c2 -W1 10.244.0.3 | tail -3")
R["k1_to_k2_ttl"] = topo.ns("nlk1", "ping -c1 -W1 10.244.0.3 | grep -o 'ttl=[0-9]*'")
R["k1_neigh"] = topo.ns("nlk1", "ip neigh show dev eth0")

# ---- 2. container to the outside: needs NAT, because the outside does not know 10.244.0.0/24 ----
R["out_before"] = last(topo.ns("nlk1", "python3 %s client 10.0.2.2 8080 1 new 2" % TOOL, check=False) or '["no answer"]')
topo.ns("nlr", "iptables -t nat -A POSTROUTING -s 10.244.0.0/24 ! -o br0 -j MASQUERADE")
with topo.Capture("nls", "s0", "13_egress.pcap", "tcp port 8080"):
    time.sleep(0.2)
    R["out_after"] = last(topo.ns("nlk1", "python3 %s client 10.0.2.2 8080 1 new 2" % TOOL, check=False) or '["no answer"]')
    time.sleep(0.3)
R["out_peer"] = None

# ---- 3. publish a port: the host's 8080 goes to the container's 80 ----
topo.ns("nlr", "iptables -t nat -A PREROUTING -p tcp --dport 8080 -d 10.0.1.1 -j DNAT --to-destination 10.244.0.2:80")
with topo.Capture("nlr", "br0", "13_publish_br.pcap", "tcp port 80"), topo.Capture("nlc", "c0", "13_publish_c.pcap", "tcp port 8080"):
    time.sleep(0.3)
    R["publish"] = last(topo.ns("nlc", "python3 %s client 10.0.1.1 8080 1 new 2" % TOOL))
    time.sleep(0.3)
R["conntrack_publish"] = topo.ns("nlr", "cat /proc/net/nf_conntrack | grep 'dport=8080' | head -2 || true")
R["nat_rules"] = topo.ns("nlr", "iptables -t nat -S")
topo.ns("nlr", "iptables -t nat -F PREROUTING")

# ---- 4. a layer-4 load balancer: a virtual address that no computer owns, spread over two backends by iptables ----
topo.ns("nlr", "iptables -t nat -A PREROUTING -d 10.96.0.10 -p tcp --dport 80 -m statistic --mode nth --every 2 --packet 0 -j DNAT --to-destination 10.244.0.2:80")
topo.ns("nlr", "iptables -t nat -A PREROUTING -d 10.96.0.10 -p tcp --dport 80 -j DNAT --to-destination 10.244.0.3:80")
R["l4_rules"] = topo.ns("nlr", "iptables -t nat -S PREROUTING")
R["l4_new"] = last(topo.ns("nlc", "python3 %s client 10.96.0.10 80 8 new 2" % TOOL))
R["l4_same"] = last(topo.ns("nlc", "python3 %s client 10.96.0.10 80 8 same 2" % TOOL))
R["l4_peer_note"] = ""

# ---- 5. a layer-7 reverse proxy on the host ----
px = topo.spawn("nlr", ["python3", TOOL, "proxy", "9000", "10.244.0.2:80", "10.244.0.3:80"])
time.sleep(0.8)
R["l7_new"] = last(topo.ns("nlc", "python3 %s client 10.0.1.1 9000 8 new 2" % TOOL))
R["l7_same"] = last(topo.ns("nlc", "python3 %s client 10.0.1.1 9000 8 same 2" % TOOL))
# what the backend saw (peer and X-Forwarded-For): ask the proxy once and read the whole JSON
R["l7_detail"] = topo.ns("nlc", "python3 -c \"import socket;s=socket.socket();s.connect(('10.0.1.1',9000));s.sendall(b'GET /x HTTP/1.1\\r\\nHost: g\\r\\n\\r\\n');import time;time.sleep(0.5);print(s.recv(4096).decode().split(chr(13)+chr(10)+chr(13)+chr(10))[1])\"")
R["l4_detail"] = topo.ns("nlc", "python3 -c \"import socket;s=socket.socket();s.connect(('10.96.0.10',80));s.sendall(b'GET /x HTTP/1.1\\r\\nHost: g\\r\\n\\r\\n');import time;time.sleep(0.5);print(s.recv(4096).decode().split(chr(13)+chr(10)+chr(13)+chr(10))[1])\"")

# ---- 6. one backend dies ----
for p in list(topo.PROCS):
    pass
topo.sh("ip netns pids nlk2 | xargs -r kill -9", check=False)
time.sleep(0.5)
R["dead_l4"] = last(topo.ns("nlc", "python3 %s client 10.96.0.10 80 8 new 1.5" % TOOL))
R["dead_l7"] = last(topo.ns("nlc", "python3 %s client 10.0.1.1 9000 8 new 3" % TOOL))
topo.stop_all()
topo.teardown()
topo.save_json("13_proxies.json", R)
print("ok")
