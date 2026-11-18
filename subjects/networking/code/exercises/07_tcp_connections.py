"""Lesson 7: the life of a TCP connection.

A client, a router and a server with 10 ms of delay in each direction. One request is made over a captured TCP connection. Asserts the three-way handshake (what each segment
holds, that SYN and FIN each use one sequence number, the options in the SYN), the states that `ss` shows on each side, who ends in TIME-WAIT and for how long, what a reset
looks like, and how often a SYN is sent again when nobody answers. `--write` saves site/src/components/labs/networking/tcpConn.json for the labs.
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from netlab import LABS, OUT, check, linux, load, show, table  # noqa: E402
from wire import read_pcap  # noqa: E402

WRITE = "--write" in sys.argv
print(linux("07_tcp_connections.py").strip())
d = load("07_tcp_connections.json")
c = [p for p in read_pcap(OUT / "07_c.pcap") if p.tcp]
s = [p for p in read_pcap(OUT / "07_s.pcap") if p.tcp]
isn_c, isn_s = c[0].tcp["seq"], c[1].tcp["seq"]
rel = lambda p: ((p.tcp["seq"] - (isn_c if p.ip["src"] == "10.0.1.2" else isn_s)) % 2**32, (p.tcp["ack"] - (isn_s if p.ip["src"] == "10.0.1.2" else isn_c)) % 2**32 if p.tcp["flagbits"] & 0x10 else 0)  # noqa: E731

# ---- 1. the segments of one connection, with relative numbers ----
rows = []
for p in c:
    rs, ra = rel(p)
    rows.append([f"{p.t * 1000:5.1f} ms", "client -> server" if p.ip["src"] == "10.0.1.2" else "server -> client", p.tcp["flags"], rs, ra if p.tcp["flagbits"] & 0x10 else "", p.tcp["len"], p.tcp["win"]])
show("the whole connection at the client (sequence and acknowledgement numbers are relative to each side's first number)", table(rows, ["time", "direction", "flags", "seq", "ack", "data", "window field"]))
check("the first three segments are SYN, SYN+ACK and ACK: the three-way handshake", [p.tcp["flags"] for p in c[:3]] == ["SYN", "SYN,ACK", "ACK"])
check("each side picks its own random first sequence number (ISN), so the two numbers differ", isn_c != isn_s)
check("a SYN uses one sequence number: the SYN,ACK acknowledges ISN + 1", c[1].tcp["ack"] == (isn_c + 1) % 2**32)
check("the third segment acknowledges the server's ISN + 1 and carries the client's next number (ISN + 1)", (c[2].tcp["ack"], c[2].tcp["seq"]) == ((isn_s + 1) % 2**32, (isn_c + 1) % 2**32))
req = next(p for p in c if p.tcp["len"] == 65)
resp = next(p for p in c if p.tcp["len"] == 98)
ack_of_req = next(p for p in c if p.ip["src"] == "10.0.2.2" and p.tcp["flags"] == "ACK" and p.tcp["ack"] == (req.tcp["seq"] + 65) % 2**32)
check("the request carries 65 bytes and the server's ACK says 'next I expect byte ISN + 66'", rel(ack_of_req)[1] == 66)
check("the response carries 98 bytes of data after the server's own ISN + 1", rel(resp)[0] == 1)
syn, synack = c[0], c[1]
show("the options of the SYN and the SYN,ACK", f"SYN      {syn.tcp['opts']}\nSYN,ACK  {synack.tcp['opts']}")
check("the SYN announces the maximum segment size 1460, selective acknowledgements, timestamps and a window scale of 10", syn.tcp["opts"]["mss"] == 1460 and syn.tcp["opts"]["sack_ok"] and "ts" in syn.tcp["opts"] and syn.tcp["opts"]["wscale"] == 10)
check("the options are only in the two SYN segments: later segments carry only the timestamp", all(set(p.tcp["opts"]) == {"ts"} for p in c[2:]))
after = c[2]
check("the window in later segments is multiplied by 2^10: a field of 63 means 64,512 bytes", after.tcp["win"] == 63 and after.tcp["win"] * 2 ** 10 == 64512)
rtt = (c[1].t - c[0].t) * 1000
check("the SYN,ACK came back 20 ms after the SYN: one round trip (10 ms in each direction was set with netem)", 18 <= rtt <= 26, f"{rtt:.1f}")
check("the first byte of data is sent in the same moment as the third segment, one round trip after the connection was started: the cost of the handshake", abs(c[3].t - c[2].t) < 0.002 and c[3].t * 1000 >= rtt)
check("the server's capture shows the same segments with the same numbers", [(p.tcp["flags"], p.tcp["seq"]) for p in s[:3]] == [(p.tcp["flags"], p.tcp["seq"]) for p in c[:3]])

# ---- 2. closing ----
fins = [p for p in c if "FIN" in p.tcp["flags"]]
show("the closing segments", table([[f"{p.t * 1000:5.1f} ms", "client" if p.ip["src"] == "10.0.1.2" else "server", p.tcp["flags"], rel(p)[0], rel(p)[1]] for p in c[-4:]], ["time", "from", "flags", "seq", "ack"]))
check("the server sent the first FIN (the HTTP response said 'Connection: close'), then the client sent its own", [p.ip["src"] for p in fins] == ["10.0.2.2", "10.0.1.2"])
check("a FIN uses one sequence number too: the ACK for the server's FIN says FIN seq + 1", any(p.ip["src"] == "10.0.1.2" and p.tcp["ack"] == (fins[0].tcp["seq"] + 1) % 2**32 for p in c))
check("the last segment is the server's ACK of the client's FIN, and the connection is over", c[-1].tcp["flags"] == "ACK" and c[-1].ip["src"] == "10.0.2.2" and c[-1].tcp["ack"] == (fins[1].tcp["seq"] + 1) % 2**32)

# ---- 3. the states ----
show("ss -tan, server, before any connection", d["listen"])
check("before the first client the server has a socket in LISTEN, and its backlog (Send-Q) is the 16 asked for in listen()", "0.0.0.0:8080" in d["listen"] and re.search(r"\s16\s", d["listen"]) is not None)
check("while a connection is open and quiet, both sides show it as ESTAB", "10.0.1.2:50001" in d["client_estab"] and "10.0.2.2:8080" in d["server_estab"] and "10.0.1.2:50001" in d["server_estab"])
tw = re.search(r"TIME-WAIT .*?10\.0\.1\.2:50000 timer:\(timewait,(\d+)sec", d["server_states_after"])
show("ss -tano, server, right after the exchange", d["server_states_after"])
check("the side that sent the first FIN (the server) keeps the connection in TIME-WAIT, with a timer of about 60 seconds", tw is not None and 55 <= int(tw.group(1)) <= 60)
check("the client has no socket left for that connection", d["client_states_after"].count("\n") == 0 or "10.0.1.2:50000" not in d["client_states_after"])
tw2 = re.search(r"timewait,(\d+)sec", d["tw_timer"])
check("TIME-WAIT counts down: the same connection shows less time about 14 seconds later", tw2 is not None and int(tw2.group(1)) < int(tw.group(1)) - 5, f"{tw.group(1)} -> {tw2.group(1)}")

# ---- 4. a reset, and a connect nobody answers ----
rst = [p for p in read_pcap(OUT / "07_rst.pcap") if p.tcp]
show("a connection to a port where no program listens", "\n".join(f"{p.t * 1000:5.1f} ms  {'client' if p.ip['src'] == '10.0.1.2' else 'server'}  {p.tcp['flags']}" for p in rst) + f"\nthe program was told: {d['refused'].strip()}")
check("the answer to a SYN for a closed port is an RST,ACK, and the connect fails at once with 'refused'", [p.tcp["flags"] for p in rst] == ["SYN", "RST,ACK"] and d["refused"].split()[0] == "refused")
check("the RST acknowledges the SYN (ISN + 1) and carries no data", rst[1].tcp["ack"] == (rst[0].tcp["seq"] + 1) % 2**32 and rst[1].tcp["len"] == 0)
sil = [p for p in read_pcap(OUT / "07_silent.pcap") if p.tcp]
times = [round(p.t, 1) for p in sil]
show("a SYN to a server that drops everything: when it is sent again (seconds since the first)", f"{times}\ntcp_syn_retries={d['syn_retries'].strip()}   tcp_syn_linear_timeouts={d['syn_linear'].strip()}")
check("the client keeps sending the same SYN: seven in 9 seconds and no answer at all", len(sil) == 7 and all(p.tcp["flags"] == "SYN" for p in sil))
check("the first retransmission comes after about 1 second", 0.9 <= times[1] <= 1.2)
check("the gaps grow only after the first few: this Linux backs off linearly at first (1 s) and doubles later", [round(times[i + 1] - times[i]) for i in range(len(times) - 1)] == [1, 1, 1, 1, 1, 2])
check("the program gave up by itself after its own timeout of 9 seconds, with no message from the server", d["silent"].split()[0] == "timeout")
check("the same SYN is sent again every time, with the same sequence number", len({p.tcp["seq"] for p in sil}) == 1)

if WRITE:
    flow = []
    for p in c:
        rs, ra = rel(p)
        flow.append({"t": round(p.t * 1000, 1), "dir": "c2s" if p.ip["src"] == "10.0.1.2" else "s2c", "flags": p.tcp["flags"], "seq": rs, "ack": ra if p.tcp["flagbits"] & 0x10 else None, "len": p.tcp["len"], "win": p.tcp["win"], "opts": {k: v for k, v in p.tcp["opts"].items() if k != "ts"}})
    out = {"rtt": round(rtt, 1), "flow": flow, "synRetries": times, "timeWait": [int(tw.group(1)), int(tw2.group(1))], "rst": [{"t": round(p.t * 1000, 1), "flags": p.tcp["flags"]} for p in rst]}
    (LABS / "tcpConn.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print("wrote", LABS / "tcpConn.json")
print("ok")
