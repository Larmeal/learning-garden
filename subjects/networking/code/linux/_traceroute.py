"""A traceroute for the exercises: UDP probes with a rising TTL, ICMP answers read from a raw socket. Usage: _traceroute.py DEST MAXHOPS. Prints JSON."""
import json
import socket
import sys
import time

dst = sys.argv[1]
max_hops = int(sys.argv[2])
rows = []
for ttl in range(1, max_hops + 1):
    icmp = socket.socket(socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_ICMP)
    icmp.settimeout(1.0)
    udp = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    udp.setsockopt(socket.IPPROTO_IP, socket.IP_TTL, ttl)
    t0 = time.time()
    udp.sendto(b"x" * 32, (dst, 33434 + ttl))
    try:
        data, addr = icmp.recvfrom(1024)
        rtt = (time.time() - t0) * 1000
        ihl = (data[0] & 15) * 4
        rows.append({"ttl": ttl, "from": addr[0], "type": data[ihl], "code": data[ihl + 1], "rtt": round(rtt, 1)})
        if data[ihl] == 3:
            break
    except socket.timeout:
        rows.append({"ttl": ttl, "from": None})
    finally:
        icmp.close()
        udp.close()
print(json.dumps(rows))
