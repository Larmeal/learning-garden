"""Exercise 11 (Linux side): TLS 1.3 and TLS 1.2 with certificates made on the spot, 10 ms of delay in each direction. Python's ssl module on both sides, packets captured on the client's cable."""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import topo  # noqa: E402

HERE = topo.HERE
TOOL = os.path.join(HERE, "_tls_tools.py")
PKI = os.path.join(topo.OUT, "pki")
R = {}


def last(txt):
    return json.loads(txt.strip().splitlines()[-1])


topo.build()
topo.ns("nlc", "tc qdisc add dev c0 root netem delay 10ms")
topo.ns("nls", "tc qdisc add dev s0 root netem delay 10ms")
topo.sh("python3 %s pki %s" % (TOOL, PKI))
for n, args in (("valid", ["8443", "valid"]), ("wrong", ["8444", "wrongname"]), ("expired", ["8445", "expired"]), ("other", ["8446", "other"]), ("v12", ["8447", "valid", "tls12"])):
    topo.spawn("nls", ["python3", TOOL, "server", args[0], os.path.join(PKI, args[1] + ".pem"), os.path.join(PKI, args[1] + ".key")] + args[2:])
topo.spawn("nls", ["python3", TOOL, "plain_server", "8080"])
time.sleep(1.0)
CA = os.path.join(PKI, "ca1.pem")


def cli(port, ca=CA, name="garden.test", extra=""):
    return last(topo.ns("nlc", "python3 %s client 10.0.2.2 %d %s %s %s" % (TOOL, port, ca, name, extra), check=False))


# warm up ARP, so that no first-time ARP shows in the times
topo.ns("nlc", "ping -c1 -W1 10.0.2.2")
R["plain"] = last(topo.ns("nlc", "python3 %s plain_client 10.0.2.2 8080" % TOOL))
R["plain"] = last(topo.ns("nlc", "python3 %s plain_client 10.0.2.2 8080" % TOOL))

with topo.Capture("nlc", "c0", "11_tls13.pcap", "tcp port 8443"):
    time.sleep(0.2)
    R["tls13"] = cli(8443)
    time.sleep(0.3)
R["tls13_nagle"] = cli(8443, extra="tls13 nagle")
with topo.Capture("nlc", "c0", "11_tls12.pcap", "tcp port 8447"):
    time.sleep(0.2)
    R["tls12"] = cli(8447, extra="tls12")
    time.sleep(0.3)

R["bad_name"] = cli(8444)
R["expired"] = cli(8445)
R["other_ca"] = cli(8446)
R["no_name_check"] = cli(8443, name="other.test")
R["wrong_ca_file"] = cli(8443, ca=os.path.join(PKI, "ca2.pem"))
R["openssl_show"] = topo.ns("nlc", "bash -c \"echo | openssl s_client -connect 10.0.2.2:8443 -servername garden.test -CAfile %s -tls1_3 -showcerts 2>&1 | head -40\"" % CA, check=False)
topo.stop_all()
topo.teardown()
topo.save_json("11_tls.json", R)
print("ok")
