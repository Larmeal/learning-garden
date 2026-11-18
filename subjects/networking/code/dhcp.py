"""Reads a DHCP message (RFC 2131) from the UDP payload: the fixed BOOTP header and the options."""

from __future__ import annotations

import ipaddress
import struct

TYPES = {1: "DISCOVER", 2: "OFFER", 3: "REQUEST", 4: "DECLINE", 5: "ACK", 6: "NAK", 7: "RELEASE", 8: "INFORM"}
OPTION_NAMES = {1: "subnet mask", 3: "router", 6: "dns", 12: "host name", 28: "broadcast", 50: "requested ip", 51: "lease time", 53: "message type", 54: "server id", 55: "parameter request list", 61: "client id"}


def ip4(b: bytes) -> str:
    return str(ipaddress.IPv4Address(b))


def parse_dhcp(msg: bytes) -> dict:
    op, htype, hlen, hops, xid, secs, flags = struct.unpack("!BBBBIHH", msg[:12])
    out = {
        "op": op, "xid": xid, "secs": secs, "broadcast_flag": bool(flags & 0x8000),
        "ciaddr": ip4(msg[12:16]), "yiaddr": ip4(msg[16:20]), "siaddr": ip4(msg[20:24]), "giaddr": ip4(msg[24:28]),
        "chaddr": ":".join(f"{x:02x}" for x in msg[28 : 28 + hlen]), "cookie": msg[236:240].hex(), "options": {},
    }
    i = 240
    while i < len(msg):
        code = msg[i]
        if code == 255:
            break
        if code == 0:
            i += 1
            continue
        ln = msg[i + 1]
        body = msg[i + 2 : i + 2 + ln]
        i += 2 + ln
        if code == 53:
            out["options"]["message type"] = TYPES.get(body[0], body[0])
        elif code in (1, 3, 6, 28, 50, 54):
            vals = [ip4(body[j : j + 4]) for j in range(0, len(body), 4)]
            out["options"][OPTION_NAMES[code]] = vals if code in (3, 6) else vals[0]
        elif code == 51:
            out["options"]["lease time"] = struct.unpack("!I", body)[0]
        else:
            out["options"][OPTION_NAMES.get(code, f"option {code}")] = body.hex() if code != 12 else body.decode(errors="replace")
    out["type"] = out["options"].get("message type")
    return out
