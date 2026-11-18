"""Receives UDP datagrams on a port for a few seconds and prints JSON with the size and the first bytes of each one. Usage: _udp_sink.py PORT SECONDS."""
import json
import socket
import sys
import time

s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.bind(("0.0.0.0", int(sys.argv[1])))
end = time.time() + float(sys.argv[2])
got = []
while time.time() < end:
    s.settimeout(max(0.05, end - time.time()))
    try:
        data, addr = s.recvfrom(4096)
        got.append({"size": len(data), "head": data[:6].decode(errors="replace"), "from": addr[0]})
    except socket.timeout:
        pass
print(json.dumps(got))
