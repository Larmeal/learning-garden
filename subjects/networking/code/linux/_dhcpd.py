"""A tiny DHCP server for the exercises (standard library only). Gives 10.0.1.100 to whoever asks, on the interface named by the first argument.
Usage: _dhcpd.py IFACE SERVER_IP. It answers DISCOVER with OFFER and REQUEST with ACK, both as broadcasts, because the client has no address yet."""
import socket
import struct
import sys

iface, server = sys.argv[1], sys.argv[2]
OFFER_IP = "10.0.1.100"
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
s.setsockopt(socket.SOL_SOCKET, socket.SO_BINDTODEVICE, iface.encode())
s.bind(("0.0.0.0", 67))
print("listening", flush=True)


def options(kind):
    o = b"\x35\x01" + bytes([kind])
    o += b"\x36\x04" + socket.inet_aton(server)
    o += b"\x33\x04" + struct.pack("!I", 3600)
    o += b"\x01\x04" + socket.inet_aton("255.255.255.0")
    o += b"\x03\x04" + socket.inet_aton(server)
    o += b"\x06\x04" + socket.inet_aton(server)
    return o + b"\xff"


while True:
    data, _ = s.recvfrom(2048)
    if len(data) < 241 or data[0] != 1:
        continue
    xid, chaddr = data[4:8], data[28:44]
    kind = None
    i = 240
    while i < len(data) and data[i] != 255:
        if data[i] == 0:
            i += 1
            continue
        if data[i] == 53:
            kind = data[i + 2]
        i += 2 + data[i + 1]
    if kind not in (1, 3):
        continue
    reply = bytes([2, 1, 6, 0]) + xid + b"\x00\x00\x80\x00" + b"\x00" * 4 + socket.inet_aton(OFFER_IP) + socket.inet_aton(server) + b"\x00" * 4 + chaddr + b"\x00" * 192 + b"\x63\x82\x53\x63"
    reply += options(2 if kind == 1 else 5)
    s.sendto(reply, ("255.255.255.255", 68))
