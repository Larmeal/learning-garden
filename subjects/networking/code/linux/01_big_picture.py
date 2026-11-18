"""Exercise 01 (Linux side): one HTTP request from client to server across a router, captured on both ends."""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import topo  # noqa: E402

topo.build()
topo.spawn("nls", ["python3", os.path.join(topo.HERE, "_canned_server.py"), "8080"])
time.sleep(0.6)
with topo.Capture("nlc", "c0", "01_client.pcap"), topo.Capture("nls", "s0", "01_server.pcap"):
    time.sleep(0.3)
    got = topo.ns("nlc", "python3 %s 10.0.2.2 8080 50000" % os.path.join(topo.HERE, "_get.py"))
    got += " " + topo.ns("nlc", "python3 %s 10.0.2.2 8080 50001" % os.path.join(topo.HERE, "_get.py"))
    time.sleep(0.5)
topo.stop_all()
topo.teardown()
print("received", got)
