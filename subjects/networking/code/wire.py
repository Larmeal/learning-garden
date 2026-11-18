"""Reads packets from the bytes up: pcap files, Ethernet, ARP, IPv4, TCP, UDP, ICMP, DNS and DHCP.

Only `struct` is used (no scapy), so every field that a lesson names is read by a line a reader can follow. The captures come from `tcpdump -w`
run inside the Linux network namespaces of `linux/topo.py`.
"""

from __future__ import annotations

import ipaddress
import struct
from dataclasses import dataclass, field
from pathlib import Path


def mac(b: bytes) -> str:
    return ":".join(f"{x:02x}" for x in b)


@dataclass
class Pkt:
    t: float                      # seconds since the first packet of the capture
    raw: bytes
    eth_src: str = ""
    eth_dst: str = ""
    eth_type: int = 0
    arp: dict | None = None
    ip: dict | None = None
    tcp: dict | None = None
    udp: dict | None = None
    icmp: dict | None = None
    payload: bytes = b""
    kind: str = ""                # a short label such as "TCP SYN", "UDP", "ICMP echo request", "ARP request"

    @property
    def size(self) -> int:
        return len(self.raw)


TCP_FLAGS = [(0x01, "FIN"), (0x02, "SYN"), (0x04, "RST"), (0x08, "PSH"), (0x10, "ACK"), (0x20, "URG"), (0x40, "ECE"), (0x80, "CWR")]


def tcp_flag_names(flags: int) -> str:
    return ",".join(n for bit, n in TCP_FLAGS if flags & bit)


def parse_tcp_options(b: bytes) -> dict:
    out: dict = {}
    i = 0
    while i < len(b):
        kind = b[i]
        if kind == 0:
            break
        if kind == 1:
            i += 1
            continue
        ln = b[i + 1]
        body = b[i + 2 : i + ln]
        if kind == 2:
            out["mss"] = struct.unpack("!H", body)[0]
        elif kind == 3:
            out["wscale"] = body[0]
        elif kind == 4:
            out["sack_ok"] = True
        elif kind == 5:
            out["sack"] = [struct.unpack("!II", body[j : j + 8]) for j in range(0, len(body), 8)]
        elif kind == 8:
            out["ts"] = struct.unpack("!II", body)
        i += ln
    return out


def ip_checksum(header: bytes) -> int:
    """The Internet checksum of RFC 1071: the 16-bit ones'-complement sum of the header (a valid header with its checksum in place sums to 0xFFFF)."""
    if len(header) % 2:
        header += b"\x00"
    s = sum(struct.unpack("!%dH" % (len(header) // 2), header))
    while s >> 16:
        s = (s & 0xFFFF) + (s >> 16)
    return s


def parse_frame(raw: bytes, t: float = 0.0) -> Pkt:
    p = Pkt(t=t, raw=raw)
    if len(raw) < 14:
        return p
    p.eth_dst, p.eth_src = mac(raw[0:6]), mac(raw[6:12])
    p.eth_type = struct.unpack("!H", raw[12:14])[0]
    body = raw[14:]
    if p.eth_type == 0x0806 and len(body) >= 28:
        htype, ptype, hl, pl, op = struct.unpack("!HHBBH", body[:8])
        p.arp = {
            "op": op, "sha": mac(body[8:14]), "spa": str(ipaddress.IPv4Address(body[14:18])),
            "tha": mac(body[18:24]), "tpa": str(ipaddress.IPv4Address(body[24:28])),
        }
        p.kind = "ARP request" if op == 1 else "ARP reply" if op == 2 else f"ARP {op}"
    elif p.eth_type == 0x0800 and len(body) >= 20:
        vihl, tos, total, ident, ff, ttl, proto, csum = struct.unpack("!BBHHHBBH", body[:12])
        ihl = (vihl & 15) * 4
        p.ip = {
            "src": str(ipaddress.IPv4Address(body[12:16])), "dst": str(ipaddress.IPv4Address(body[16:20])),
            "ttl": ttl, "proto": proto, "total": total, "id": ident, "df": bool(ff & 0x4000), "mf": bool(ff & 0x2000),
            "frag": (ff & 0x1FFF) * 8, "ihl": ihl, "tos": tos, "csum": csum,
        }
        seg = body[ihl:total]
        if proto == 6 and len(seg) >= 20 and p.ip["frag"] == 0:
            sport, dport, seq, ack, off_fl, win, tcsum, urg = struct.unpack("!HHIIHHHH", seg[:20])
            off = (off_fl >> 12) * 4
            fl = off_fl & 0xFF
            p.tcp = {
                "sport": sport, "dport": dport, "seq": seq, "ack": ack, "flags": tcp_flag_names(fl), "flagbits": fl, "win": win,
                "hdr": off, "opts": parse_tcp_options(seg[20:off]), "len": len(seg) - off,
            }
            p.payload = seg[off:]
            f = p.tcp["flags"]
            p.kind = "TCP " + f
        elif proto == 17 and len(seg) >= 8 and p.ip["frag"] == 0:
            sport, dport, ln, ucsum = struct.unpack("!HHHH", seg[:8])
            p.udp = {"sport": sport, "dport": dport, "len": ln, "csum": ucsum}
            p.payload = seg[8:ln]
            p.kind = "UDP"
        elif p.ip["frag"] > 0:
            p.kind = "IP fragment"
            p.payload = seg
        elif proto == 1 and len(seg) >= 8:
            ty, code, ccsum = struct.unpack("!BBH", seg[:4])
            p.icmp = {"type": ty, "code": code, "rest": seg[4:8]}
            if ty in (0, 8):
                p.icmp["id"], p.icmp["seq"] = struct.unpack("!HH", seg[4:8])
            p.payload = seg[8:]
            p.kind = {0: "ICMP echo reply", 8: "ICMP echo request", 3: "ICMP unreachable", 11: "ICMP time exceeded", 5: "ICMP redirect"}.get(ty, f"ICMP {ty}")
        else:
            p.kind = f"IP proto {proto}"
            p.payload = seg
    return p


def read_pcap(path: str | Path) -> list[Pkt]:
    data = Path(path).read_bytes()
    magic = struct.unpack("<I", data[:4])[0]
    if magic in (0xA1B2C3D4, 0xA1B23C4D):
        end, scale = "<", (1e-6 if magic == 0xA1B2C3D4 else 1e-9)
    else:
        end, scale = ">", 1e-6
    linktype = struct.unpack(end + "I", data[20:24])[0]
    assert linktype == 1, f"expected Ethernet captures, got link type {linktype}"
    pos, out, t0 = 24, [], None
    while pos + 16 <= len(data):
        sec, frac, incl, _orig = struct.unpack(end + "IIII", data[pos : pos + 16])
        pos += 16
        raw = data[pos : pos + incl]
        pos += incl
        t = sec + frac * scale
        t0 = t if t0 is None else t0
        out.append(parse_frame(raw, t - t0))
    return out


# ---------- DNS (RFC 1035) ----------

TYPES = {1: "A", 2: "NS", 5: "CNAME", 15: "MX", 16: "TXT", 28: "AAAA", 6: "SOA"}
TYPE_NUM = {v: k for k, v in TYPES.items()}


def dns_name(msg: bytes, pos: int) -> tuple[str, int]:
    labels, jumped, end = [], False, pos
    while True:
        ln = msg[pos]
        if ln == 0:
            pos += 1
            break
        if ln & 0xC0 == 0xC0:
            ptr = ((ln & 0x3F) << 8) | msg[pos + 1]
            if not jumped:
                end = pos + 2
            pos, jumped = ptr, True
            continue
        labels.append(msg[pos + 1 : pos + 1 + ln].decode())
        pos += 1 + ln
    return ".".join(labels), (end if jumped else pos)


def dns_encode_name(name: str) -> bytes:
    out = b""
    for label in name.rstrip(".").split("."):
        out += bytes([len(label)]) + label.encode()
    return out + b"\x00"


def dns_query(name: str, qtype: str = "A", ident: int = 0x1234, rd: bool = True) -> bytes:
    flags = 0x0100 if rd else 0
    return struct.pack("!HHHHHH", ident, flags, 1, 0, 0, 0) + dns_encode_name(name) + struct.pack("!HH", TYPE_NUM[qtype], 1)


def parse_dns(msg: bytes) -> dict:
    ident, flags, qd, an, ns, ar = struct.unpack("!HHHHHH", msg[:12])
    pos = 12
    out = {"id": ident, "qr": flags >> 15, "opcode": (flags >> 11) & 15, "aa": (flags >> 10) & 1, "tc": (flags >> 9) & 1, "rd": (flags >> 8) & 1,
           "ra": (flags >> 7) & 1, "rcode": flags & 15, "questions": [], "answers": [], "authority": [], "additional": []}
    for _ in range(qd):
        name, pos = dns_name(msg, pos)
        qt, qc = struct.unpack("!HH", msg[pos : pos + 4])
        pos += 4
        out["questions"].append((name, TYPES.get(qt, qt)))
    for section, count in (("answers", an), ("authority", ns), ("additional", ar)):
        for _ in range(count):
            name, pos = dns_name(msg, pos)
            rt, rc, ttl, rdl = struct.unpack("!HHIH", msg[pos : pos + 10])
            pos += 10
            rd = msg[pos : pos + rdl]
            if rt == 1:
                val = str(ipaddress.IPv4Address(rd))
            elif rt in (2, 5):
                val = dns_name(msg, pos)[0]
            else:
                val = rd.hex()
            pos += rdl
            out[section].append((name, TYPES.get(rt, rt), ttl, val))
    return out


# ---------- TLS (RFC 8446 for 1.3, RFC 5246 for 1.2): the record layer and the ClientHello ----------

TLS_TYPES = {20: "change_cipher_spec", 21: "alert", 22: "handshake", 23: "application_data"}
HS_TYPES = {1: "ClientHello", 2: "ServerHello", 4: "NewSessionTicket", 8: "EncryptedExtensions", 11: "Certificate", 12: "ServerKeyExchange", 13: "CertificateRequest", 14: "ServerHelloDone", 15: "CertificateVerify", 16: "ClientKeyExchange", 20: "Finished"}
GROUPS = {23: "secp256r1", 24: "secp384r1", 25: "secp521r1", 29: "x25519", 30: "x448"}


def tls_records(stream: bytes) -> list[dict]:
    """Cut a byte stream (the TCP payloads of one direction, in order) into TLS records: type, version field, length and, for a plaintext handshake record, the handshake type."""
    out, pos = [], 0
    while pos + 5 <= len(stream):
        ty, ver, ln = struct.unpack("!BHH", stream[pos : pos + 5])
        body = stream[pos + 5 : pos + 5 + ln]
        rec = {"type": TLS_TYPES.get(ty, ty), "version": f"0x{ver:04x}", "length": ln, "wire": 5 + ln}
        if ty == 22 and body:
            rec["handshake"] = HS_TYPES.get(body[0], body[0])
        out.append(rec)
        pos += 5 + ln
    return out


def parse_client_hello(stream: bytes) -> dict:
    """The fields of a ClientHello that a lesson shows: SNI, ALPN, supported versions, key share groups, cipher suites."""
    body = stream[5:]
    assert body[0] == 1, "not a ClientHello"
    p = 4 + 2 + 32                      # handshake header, legacy version, random
    p += 1 + body[p]                    # session id
    (cs_len,) = struct.unpack("!H", body[p : p + 2])
    suites = [struct.unpack("!H", body[p + 2 + i : p + 4 + i])[0] for i in range(0, cs_len, 2)]
    p += 2 + cs_len
    p += 1 + body[p]                    # compression methods
    (ext_len,) = struct.unpack("!H", body[p : p + 2])
    p += 2
    end = p + ext_len
    out = {"cipher_suites": [f"0x{s:04x}" for s in suites], "extensions": []}
    while p < end:
        et, el = struct.unpack("!HH", body[p : p + 4])
        data = body[p + 4 : p + 4 + el]
        p += 4 + el
        out["extensions"].append(et)
        if et == 0:                     # server_name
            n = struct.unpack("!H", data[3:5])[0]
            out["sni"] = data[5 : 5 + n].decode()
        elif et == 16:                  # ALPN
            lst, i = [], 2
            while i < len(data):
                lst.append(data[i + 1 : i + 1 + data[i]].decode())
                i += 1 + data[i]
            out["alpn"] = lst
        elif et == 43:                  # supported_versions
            out["versions"] = [f"0x{struct.unpack('!H', data[1 + i : 3 + i])[0]:04x}" for i in range(0, data[0], 2)]
        elif et == 51:                  # key_share
            shares, i = [], 2
            while i < len(data):
                g, kl = struct.unpack("!HH", data[i : i + 4])
                shares.append((GROUPS.get(g, g), kl))
                i += 4 + kl
            out["key_share"] = shares
        elif et == 10:                  # supported_groups
            out["groups"] = [GROUPS.get(struct.unpack("!H", data[2 + i : 4 + i])[0], "?") for i in range(0, len(data) - 2, 2)]
    return out


# ---------- HTTP/2 (RFC 9113): frames ----------

H2_TYPES = {0: "DATA", 1: "HEADERS", 2: "PRIORITY", 3: "RST_STREAM", 4: "SETTINGS", 5: "PUSH_PROMISE", 6: "PING", 7: "GOAWAY", 8: "WINDOW_UPDATE", 9: "CONTINUATION"}
H2_PREFACE = b"PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n"


def h2_frames(stream: bytes, client: bool) -> list[dict]:
    """Cut one direction of an h2c connection into frames. The client's stream starts with the 24-byte preface. Each frame has a 9-byte header: length (3), type (1), flags (1), stream id (4)."""
    pos = 0
    if client:
        assert stream.startswith(H2_PREFACE), "no HTTP/2 preface"
        pos = len(H2_PREFACE)
    out = []
    while pos + 9 <= len(stream):
        ln = int.from_bytes(stream[pos : pos + 3], "big")
        ty, fl = stream[pos + 3], stream[pos + 4]
        sid = int.from_bytes(stream[pos + 5 : pos + 9], "big") & 0x7FFFFFFF
        out.append({"type": H2_TYPES.get(ty, ty), "length": ln, "flags": fl, "end_stream": bool(fl & 1) and ty in (0, 1), "ack": bool(fl & 1) and ty == 4, "stream": sid})
        pos += 9 + ln
    return out
