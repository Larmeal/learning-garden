"""Lesson 10: sockets. What a program sees of TCP through the socket API.

Asserts: TCP is a byte stream (three writes of 5 bytes arrive as one read of 15, and a recv(4) reads pieces that split the data anywhere); a listen backlog of 2 lets 3 connections
finish the handshake and the fourth and later ones get no answer, so the client's SYN is sent again and its program times out; a client socket gets an ephemeral local port from a range, and
when the range is used up connect fails with EADDRNOTAVAIL; and a port cannot be bound again right after the server side closed first (TIME-WAIT) unless SO_REUSEADDR is set.
`--write` saves site/src/components/labs/networking/sockets.json for the lab.
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from netlab import LABS, OUT, check, linux, load, show, table  # noqa: E402
from wire import read_pcap  # noqa: E402

WRITE = "--write" in sys.argv
print(linux("10_sockets.py").strip())
d = load("10_sockets.json")

# ---- 1. a stream has no message boundaries ----
st = d["stream"]
show("the client wrote 'aaaaa', 'bbbbb', 'ccccc' (three sendall of 5 bytes, 1 ms apart); the server slept 0.6 s and then read", f"recv(100) returned: {st['chunks']}  sizes {st['sizes']}")
check("the client made three separate writes of 5 bytes", d["stream_client"]["sent"] == [5, 5, 5])
check("the server's single recv returned all 15 bytes at once: the three writes were joined, TCP has no message boundaries", st["sizes"] == [15] and st["chunks"] == ["aaaaabbbbbccccc"])
segs = [p for p in read_pcap(OUT / "10_stream.pcap") if p.tcp and p.tcp["len"] > 0]
show("the data segments on the wire", ", ".join(f"{p.tcp['len']} bytes" for p in segs))
check("on the wire, with TCP_NODELAY set, they were three segments of 5 bytes (so the joining happened in the receiving socket's buffer, not in the network)", [p.tcp["len"] for p in segs] == [5, 5, 5])
show("recv(4) on the same 15 bytes", f"sizes {d['small']['sizes']}")
check("a recv(4) returns pieces of at most 4 bytes and the last piece is what is left: 4, 4, 4, 3", d["small"]["sizes"] == [4, 4, 4, 3])
check("a program that needs messages must add its own framing (a length or a delimiter): a read gives bytes, not messages", sum(d["small"]["sizes"]) == 15)

# ---- 2. the listen backlog ----
res = d["backlog"]["results"]
show("a server calls listen(2) and never accept(); a client opens six connections one after another (timeout 1.5 s each)", table([[r["n"], r["result"], r["seconds"]] for r in res], ["connection", "result", "seconds"]))
check("ss shows the backlog of the listening socket as Send-Q 2 before anyone connects", re.search(r"LISTEN\s+0\s+2\s", d["listen_before"]) is not None, d["listen_before"])
check("backlog 2 lets three connections finish the handshake (backlog + 1 on Linux): they connect in about 20 ms, one round trip", [r["result"] for r in res[:3]] == ["connected"] * 3 and all(r["seconds"] <= 0.05 for r in res[:3]))
check("the fourth and later connections get no answer at all and the client's program times out", [r["result"] for r in res[3:]] == ["timeout"] * 3)
show("ss on the server while the clients hold their connections", d["listen_during"])
check("ss shows the accept queue full: Recv-Q 3 connections waiting for accept(), of a backlog of 2", re.search(r"LISTEN\s+3\s+2\s", d["listen_during"]) is not None)
syn = [p for p in read_pcap(OUT / "10_backlog.pcap") if p.tcp and p.tcp["flags"] == "SYN"]
by_port = {}
for p in syn:
    by_port.setdefault(p.tcp["sport"], []).append(round(p.t, 2))
fourth = sorted(by_port.items(), key=lambda kv: kv[1][0])[3]
show("the SYN of the fourth connection, from the capture (seconds since the first packet)", f"source port {fourth[0]}: {fourth[1]}")
check("the fourth SYN was sent again after about 1 second: nobody answered, so the kernel kept trying while the program waited", len(fourth[1]) >= 2 and 0.9 <= fourth[1][1] - fourth[1][0] <= 1.2)
nstat = {m.group(1): int(m.group(2)) for m in re.finditer(r"(TcpExt\w+)\s+(\d+)", d["backlog_drops"])}
show("the kernel's own counter", d["backlog_drops"].strip())
check("the kernel counted the SYNs it ignored because the accept queue was full (ListenOverflows and ListenDrops, 10 here)", nstat.get("TcpExtListenOverflows", 0) >= 6 and nstat.get("TcpExtListenDrops", 0) >= 6, str(nstat))

# ---- 3. ephemeral ports ----
lo, hi = map(int, d["port_range_default"].split())
pd = [r["port"] for r in d["ports_default"]["results"]]
show("local ports given to three connections with no bind()", f"range {lo} to {hi}: {pd}")
check("the default range of ephemeral ports is 32768 to 60999 (28,232 ports)", (lo, hi) == (32768, 60999) and hi - lo + 1 == 28232)
check("a client that does not bind gets a port from that range, a different one for each connection", all(lo <= p <= hi for p in pd) and len(set(pd)) == 3)
ps = d["ports_small"]["results"]
show("the same after the range was cut to 40000 to 40002, and five connections to one server and port", table([[r["n"], r.get("port", r.get("error")), r.get("text", "")] for r in ps], ["connection", "local port", "error"]))
check("with a range this small, connections get the ports in it", [r.get("port") for r in ps[:2]] == [40000, 40001])
check("when the ports are used up connect() fails at once with EADDRNOTAVAIL: 'Cannot assign requested address'", all(r.get("error") == "EADDRNOTAVAIL" for r in ps[2:]) and ps[2]["text"] == "Cannot assign requested address")

# ---- 4. bind and TIME-WAIT ----
r0, r1 = d["reuse0"], d["reuse1"]
show("a program closes its connection first, then its listening socket, and starts again at once on the same port", f"without SO_REUSEADDR: {r0['bind']} ({r0['text']})\nwith SO_REUSEADDR:    {r1['bind']}")
check("without SO_REUSEADDR bind() fails with EADDRINUSE: 'Address already in use', although no program is using the port", r0["bind"] == "EADDRINUSE")
check("the connection that was closed first is still in TIME-WAIT with the port as its local port (ss shows it)", "127.0.0.1:9400" in d["tw_range"])
check("with SO_REUSEADDR the same bind() works", r1["bind"] == "ok")

if WRITE:
    out = {
        "stream": {"writes": [5, 5, 5], "reads": st["sizes"], "small": d["small"]["sizes"], "chunks": st["chunks"]},
        "backlog": {"n": 2, "results": [{"n": r["n"], "result": r["result"], "seconds": r["seconds"]} for r in res], "synAgain": fourth[1][:5], "overflows": nstat.get("TcpExtListenOverflows", 0)},
        "ports": {"range": [lo, hi], "small": [r.get("port", r.get("error")) for r in ps], "sample": pd},
        "reuse": {"without": r0["bind"], "with": r1["bind"]},
    }
    (LABS / "sockets.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print("wrote", LABS / "sockets.json")
print("ok")
