"""Exercise 05 (Linux side): NAT with two clients behind one router, a stateful firewall, and a real DHCP client talking to a small DHCP server."""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import topo  # noqa: E402

HERE = topo.HERE
GET = os.path.join(HERE, "_get.py")
R = {}


def add_second_client():
    topo.sh("ip netns add nlc2")
    topo.ns("nlc2", "sysctl -qw net.ipv6.conf.all.disable_ipv6=1")
    topo.ns("nlc2", "ip link set lo up")
    topo.sh("ip link add c2 netns nlc2 type veth peer name rc2 netns nlr")
    topo.ns("nlc2", "ip addr add 10.0.3.2/24 dev c2")
    topo.ns("nlc2", "ip link set c2 up")
    topo.ns("nlr", "ip addr add 10.0.3.1/24 dev rc2")
    topo.ns("nlr", "ip link set rc2 up")
    topo.ns("nlc2", "ip route add default via 10.0.3.1")


# ---- 1. without NAT the server sees the real address; with NAT it sees the router ----
topo.build()
add_second_client()
topo.spawn("nls", ["python3", os.path.join(HERE, "_canned_server.py"), "8080"])
time.sleep(0.6)
with topo.Capture("nls", "s0", "05_plain_s.pcap", "tcp port 8080"):
    time.sleep(0.3)
    R["plain_get"] = topo.ns("nlc", "python3 %s 10.0.2.2 8080 50000" % GET)
    time.sleep(0.5)

topo.ns("nlr", "iptables -t nat -A POSTROUTING -s 10.0.0.0/16 -o rs -j MASQUERADE")
caps = [("nls", "s0", "05_nat_s.pcap"), ("nlc", "c0", "05_nat_c1.pcap"), ("nlc2", "c2", "05_nat_c2.pcap")]
cs = [topo.Capture(n, d, f, "tcp port 8080") for n, d, f in caps]
for c in cs:
    c.__enter__()
time.sleep(0.3)
topo.ns("nlc", "python3 %s 10.0.2.2 8080 50000" % GET)
topo.ns("nlc2", "python3 %s 10.0.2.2 8080 50000" % GET)
time.sleep(0.4)
for c in cs:
    c.__exit__()
R["conntrack"] = topo.ns("nlr", "cat /proc/net/nf_conntrack 2>&1 | grep 8080 || true")
R["nat_rule"] = topo.ns("nlr", "iptables -t nat -S POSTROUTING")

# ---- 2. nobody outside can start a conversation with an inside address, and the router has no mapping for a port nobody opened ----
probe = os.path.join(HERE, "_probe.py")
R["inbound_probe"] = topo.ns("nls", "python3 %s 10.0.2.1 50000" % probe)

# ---- 3. a stateful firewall in front of the clients ----
topo.ns("nlr", "iptables -P FORWARD DROP")
topo.ns("nlr", "iptables -A FORWARD -i rc -j ACCEPT")
topo.ns("nlr", "iptables -A FORWARD -i rc2 -j ACCEPT")
topo.ns("nlr", "iptables -A FORWARD -o rc -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT")
topo.ns("nlr", "iptables -A FORWARD -o rc2 -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT")
R["fw_rules"] = topo.ns("nlr", "iptables -S FORWARD")
R["fw_out_ok"] = topo.ns("nlc", "python3 %s 10.0.2.2 8080 50010" % GET)
topo.spawn("nlc", ["python3", os.path.join(HERE, "_canned_server.py"), "9000"])
time.sleep(0.6)
R["fw_in_probe"] = topo.ns("nls", "python3 %s 10.0.1.2 9000" % probe)
R["fw_counters"] = topo.ns("nlr", "iptables -L FORWARD -v -n -x")
topo.stop_all()

# ---- 4. DHCP: the real dhclient asks, a small server answers ----
topo.build()
topo.ns("nlc", "ip addr flush dev c0")
topo.ns("nlc", "ip route flush dev c0", check=False)
env_out = os.path.join(topo.OUT, "05_dhcp_env.txt")
script = os.path.join(topo.OUT, "dhclient_script.sh")
with open(script, "w") as f:
    lines = [
        "#!/bin/sh",
        'case "$reason" in',
        "  BOUND|REBOOT|RENEW|REBIND)",
        "    {",
        '      echo "reason=$reason"; echo "interface=$interface"; echo "new_ip_address=$new_ip_address"; echo "new_subnet_mask=$new_subnet_mask"',
        '      echo "new_routers=$new_routers"; echo "new_domain_name_servers=$new_domain_name_servers"; echo "new_dhcp_lease_time=$new_dhcp_lease_time"',
        '      echo "new_dhcp_server_identifier=$new_dhcp_server_identifier"',
        '    } > ' + env_out,
        "    ;;",
        "esac",
        "exit 0",
    ]
    f.write("\n".join(lines) + "\n")
os.chmod(script, 0o755)
for stale in ("/tmp/nl_lease", "/tmp/nl_pid"):
    if os.path.exists(stale):
        os.remove(stale)
if os.path.exists(env_out):
    os.remove(env_out)
topo.spawn("nlr", ["python3", os.path.join(HERE, "_dhcpd.py"), "rc", "10.0.1.1"])
time.sleep(0.6)
with topo.Capture("nlc", "c0", "05_dhcp.pcap", "udp port 67 or udp port 68"):
    time.sleep(0.3)
    R["dhclient"] = topo.sh("timeout 20 ip netns exec nlc dhclient -1 -v -sf %s -lf /tmp/nl_lease -pf /tmp/nl_pid c0 2>&1 | tail -12" % script, check=False)
    time.sleep(0.4)
R["dhcp_env"] = open(env_out).read() if os.path.exists(env_out) else ""
topo.stop_all()
topo.sh("pkill dhclient", check=False)
topo.teardown()
topo.save_json("05_nat_dhcp.json", R)
print("ok")
