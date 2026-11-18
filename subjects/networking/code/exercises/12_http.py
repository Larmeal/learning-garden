"""Lesson 12: HTTP/1.1, HTTP/2 and QUIC.

Needs the libraries h2 and aioquic for the Python 3.10 of the Linux in WSL. They are not committed. Make them once, from this folder:
    uv pip install --target vendor --python-platform x86_64-manylinux_2_28 --python-version 3.10 h2 aioquic
Part 1: six requests, a server that needs 100 ms for each, a round trip of 20 ms. HTTP/1.1 with a new connection per request, with one kept-alive connection, with six connections at once, and HTTP/2
(in the clear, 'prior knowledge') with six streams on one connection, read frame by frame from the capture. Part 2: the first request over a round trip of 100 ms with plain TCP, TCP + TLS 1.3 and QUIC.
`--write` saves site/src/components/labs/networking/http.json for the lab.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from netlab import LABS, OUT, check, linux, load, show, table  # noqa: E402
from wire import H2_PREFACE, h2_frames, read_pcap  # noqa: E402

WRITE = "--write" in sys.argv
print(linux("12_http.py").strip())
d = load("12_http.json")
RTT = 20
WORK = 100

# ---- 1. six requests, three ways with HTTP/1.1 and one with HTTP/2 ----
t_new, t_reuse, t_par, t_h2 = d["h1_new"], d["h1_reuse"], d["h1_parallel"], d["h2"]
pk = [p for p in read_pcap(OUT / "12_h2.pcap") if p.tcp]
syn_t = next(p.t for p in pk if p.tcp["flags"] == "SYN")
last_t = max(p.t for p in pk if p.ip["src"] == "10.0.2.2" and p.tcp["len"] > 0)
h2_total = (last_t - syn_t) * 1000
show("six requests, each needs 100 ms of work at the server, round trip 20 ms (times in ms until the last response)", table([
    ["HTTP/1.1, a new connection for every request", 1, 6, t_new["total"]],
    ["HTTP/1.1, one connection, one request at a time (keep-alive)", 1, 1, t_reuse["total"]],
    ["HTTP/1.1, six connections at once", 6, 6, t_par["total"]],
    ["HTTP/2, one connection, six streams at once", 1, 6, round(h2_total)],
], ["", "requests at a time", "connections", "total"]))
check("a new connection per request costs, for each request, a handshake (20 ms), the request and response (20 ms) and the work (100 ms): about 140 ms each, 6 in a row", 800 <= t_new["total"] <= 900, str(t_new["total"]))
check("keeping the connection saves the 20 ms of the handshake each time: about 120 ms per request", 700 <= t_reuse["total"] <= 790 and 80 <= t_new["total"] - t_reuse["total"] <= 140, f"{t_reuse['total']}")
check("each request on a kept-alive HTTP/1.1 connection waits for the one before it: the finishing times are 120 ms apart", all(110 <= b - a <= 135 for a, b in zip(t_reuse["done"][1:-1], t_reuse["done"][2:])), str(t_reuse["done"]))
check("six connections at once finish together after about 150 ms: the cost of six handshakes in parallel plus one request", 130 <= t_par["total"] <= 175, str(t_par["total"]))
check("HTTP/2 does it on ONE connection in about the same time (one handshake, then six requests in flight together)", 125 <= h2_total <= 175 and abs(h2_total - t_par["total"]) < 30, f"{h2_total:.0f}")
check("all six HTTP/2 responses arrive within 5 ms of each other", max(s["done"] for s in t_h2["streams"]) - min(s["done"] for s in t_h2["streams"]) <= 5)

# ---- 2. HTTP/2 frames from the capture ----
sp = next(p.tcp["sport"] for p in pk if p.tcp["flags"] == "SYN")
c2s = b"".join(p.payload for p in sorted((p for p in pk if p.ip["src"] == "10.0.1.2" and p.tcp["len"] and p.tcp["sport"] == sp), key=lambda p: p.tcp["seq"]))
s2c = b"".join(p.payload for p in sorted((p for p in pk if p.ip["src"] == "10.0.2.2" and p.tcp["len"] and p.tcp["dport"] == sp), key=lambda p: p.tcp["seq"]))
fc, fs = h2_frames(c2s, True), h2_frames(s2c, False)
show("frames from the client", table([[f["type"], f["stream"], f["length"], "END_STREAM" if f["end_stream"] else ""] for f in fc], ["type", "stream", "length", "flag"]))
show("frames from the server", table([[f["type"], f["stream"], f["length"], "END_STREAM" if f["end_stream"] else ("ACK" if f["ack"] else "")] for f in fs], ["type", "stream", "length", "flag"]))
check("the client starts with the 24-byte connection preface 'PRI * HTTP/2.0' and then a SETTINGS frame", c2s.startswith(H2_PREFACE) and len(H2_PREFACE) == 24 and fc[0]["type"] == "SETTINGS")
check("every frame has a 9-byte header and the lengths add up to exactly the bytes on the wire (no byte left over)", len(c2s) == 24 + sum(9 + f["length"] for f in fc) and len(s2c) == sum(9 + f["length"] for f in fs))
hdr = [f for f in fc if f["type"] == "HEADERS"]
check("the six requests are six HEADERS frames on the streams 1, 3, 5, 7, 9 and 11 (a client uses odd numbers), each with END_STREAM because a GET has no body", [f["stream"] for f in hdr] == [1, 3, 5, 7, 9, 11] and all(f["end_stream"] for f in hdr))
check("HPACK compresses the repeated headers: the first request is bigger than all the next ones", hdr[0]["length"] > max(f["length"] for f in hdr[1:]), str([f["length"] for f in hdr]))
check("the later five requests are identical, so their HEADERS frames are all the same size (8 bytes)", len({f["length"] for f in hdr[1:]}) == 1)
rh = [f for f in fs if f["type"] == "HEADERS"]
rd = [f for f in fs if f["type"] == "DATA"]
check("the server answers on the same six streams, each with a HEADERS frame and a DATA frame that carries the 1000 bytes and END_STREAM", sorted(f["stream"] for f in rh) == [1, 3, 5, 7, 9, 11] and sorted(f["stream"] for f in rd) == [1, 3, 5, 7, 9, 11] and all(f["length"] == 1000 and f["end_stream"] for f in rd))
check("the server's SETTINGS is acknowledged: a SETTINGS frame with the ACK flag in each direction", any(f["type"] == "SETTINGS" and f["ack"] for f in fc) and any(f["type"] == "SETTINGS" and f["ack"] for f in fs))
check("frames of different streams share one TCP byte stream, one after another, and every frame is tagged with its stream id", len({f["stream"] for f in fs if f["stream"]}) == 6)
bytes_c = len(c2s)
show("what six requests cost on the wire", f"HTTP/2: {bytes_c} bytes from the client in all, including the preface and the settings")

# ---- 3. the first request over a round trip of 100 ms ----
pl, tl, qu = d["plain100"], d["tls100"]["runs"][0], d["quic100"]
ping = float(d["ping100"].split("=")[1].split("/")[1])
show("time to the first byte of the response, from the start of connect, round trip 100 ms", table([
    ["plain TCP, HTTP/1.1", "-", f"{pl['t_first']:.0f}", f"{pl['t_first'] / ping:.1f}"],
    ["TCP + TLS 1.3, HTTP/1.1", f"{tl['t_handshake']:.0f}", f"{tl['t_first']:.0f}", f"{tl['t_first'] / ping:.1f}"],
    ["QUIC (aioquic 1.3.0)", f"{qu['t_connect']:.0f}", f"{qu['first_abs']:.0f}", f"{qu['first_abs'] / ping:.1f}"],
], ["", "connection ready (ms)", "first byte (ms)", "round trips"]))
check("the round trip is 100 ms (ping)", 99 <= ping <= 102, f"{ping}")
check("plain TCP takes 2 round trips and TCP + TLS 1.3 takes 3, as in lesson 11", 195 <= pl["t_first"] <= 215 and 295 <= tl["t_first"] <= 320)
check("QUIC here took about 2 round trips to be ready and 3 to the first byte: the same as TCP + TLS 1.3, not one round trip less (an observation about this library and this run, not about the protocol)", 170 <= qu["t_connect"] <= 230 and 280 <= qu["first_abs"] <= 330 and abs(qu["first_abs"] - tl["t_first"]) < 40, f"{qu['t_connect']} / {qu['first_abs']}")
q = [p for p in read_pcap(OUT / "12_quic.pcap") if p.udp]
first = q[0].payload
show("the first packets of the QUIC connection (UDP payload size, first byte, version)", table([[f"{p.t * 1000:.0f} ms", "client" if p.ip["src"] == "10.0.1.2" else "server", p.udp["len"] - 8, f"0x{p.payload[0]:02x}", f"0x{int.from_bytes(p.payload[1:5], 'big'):08x}" if p.payload[0] & 0x80 else "short header"] for p in q[:8]], ["time", "from", "UDP payload", "first byte", "version"]))
check("QUIC rides on UDP (port 4433 here), not on TCP", all(p.udp for p in q) and all(4433 in (p.udp["sport"], p.udp["dport"]) for p in q))
check("the first datagram of the client is exactly 1200 bytes (padding, so that the server cannot be used to amplify an attack) and is an Initial packet of QUIC version 1", q[0].udp["len"] - 8 == 1200 and first[0] & 0x80 and ((first[0] >> 4) & 3) == 0 and int.from_bytes(first[1:5], "big") == 1)
check("the connection starts with long-header packets and continues with short-header packets that carry the data", any(p.payload[0] & 0x80 for p in q[:4]) and any(not p.payload[0] & 0x80 for p in q))
check("the request and the response are nowhere in the clear on the wire", all(b"GET" not in p.payload and b"xxxxxxxx" not in p.payload for p in q))

if WRITE:
    out = {
        "rtt": RTT, "work": WORK,
        "h1": {"new": t_new["done"], "reuse": t_reuse["done"], "parallel": t_par["done"]}, "h2": [s["done"] for s in t_h2["streams"]], "h2Total": round(h2_total),
        "frames": {"client": [[f["type"], f["stream"], f["length"]] for f in fc], "server": [[f["type"], f["stream"], f["length"]] for f in fs]},
        "first": {"plain": pl["t_first"], "tls": tl["t_first"], "quic": qu["first_abs"], "quicConnect": qu["t_connect"], "rtt": ping},
        "quic": [[round(p.t * 1000), "c" if p.ip["src"] == "10.0.1.2" else "s", p.udp["len"] - 8, bool(p.payload[0] & 0x80)] for p in q[:8]],
    }
    (LABS / "http.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print("wrote", LABS / "http.json")
print("ok")
