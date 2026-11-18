"""Sends six UDP datagrams of 10, 20, 30, 40, 50 and 60 bytes, 50 ms apart, from port 40000, and prints how many sendto calls succeeded. Usage: _udp_send.py HOST PORT."""
import socket
import sys
import time

s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.bind(("0.0.0.0", 40000))
ok = 0
for i in range(1, 7):
    payload = (b"msg%d:" % i + b"x" * 100)[: 10 * i]
    s.sendto(payload, (sys.argv[1], int(sys.argv[2])))
    ok += 1
    time.sleep(0.05)
print(ok)
