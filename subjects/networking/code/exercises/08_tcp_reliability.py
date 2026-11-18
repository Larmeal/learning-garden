"""Lesson 8: how TCP makes a lossy network reliable (retransmission, SACK, Nagle) and how the receiver slows the sender down (the window, zero window).

A client, a router and a server, 10 ms in each direction, one data segment per frame (gso_max_segs 1). The router drops chosen segments with iptables.
Asserts: a lost segment is sent again when the timer runs out and the timer doubles; a segment lost in a stream is sent again after one round trip because the SACK blocks show
what is missing; Nagle holds small writes back until the ACK of the first comes back; and a receiver that does not read makes the window go to zero, the sender probes with growing
gaps and continues the moment the window opens. `--write` saves site/src/components/labs/networking/tcpRel.json for the labs.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from netlab import LABS, OUT, check, linux, load, show, table  # noqa: E402
from wire import read_pcap  # noqa: E402

WRITE = "--write" in sys.argv
print(linux("08_tcp_reliability.py").strip())
d = load("08_tcp_reliability.json")
C = "10.0.1.2"


def tcp(name):
    return [p for p in read_pcap(OUT / name) if p.tcp]


# ---- 1. the timer ----
rto = tcp("08_rto.pcap")
isn = rto[0].tcp["seq"]
data = [p for p in rto if p.tcp["len"] == 100]
gaps = [round((data[i + 1].t - data[i].t) * 1000) for i in range(len(data) - 1)]
show("a 100-byte segment dropped by the router, until the rule is removed after 0.95 s (times in ms since the SYN)", table([[f"{p.t * 1000:.0f}", p.tcp["seq"] - isn, p.tcp["len"], "sent" if i == 0 else "again"] for i, p in enumerate(data)], ["time", "seq", "bytes", ""]) + f"\ngaps between the sends: {gaps} ms")
check("the same 100 bytes (same sequence number) are sent four times: once, then three times again", len(data) == 4 and len({p.tcp["seq"] for p in data}) == 1)
check("the first wait is a few hundred milliseconds, much more than the 20 ms round trip", 200 <= gaps[0] <= 320, str(gaps))
check("after the third send the wait doubles: the retransmission timer backs off exponentially", gaps[2] >= 1.8 * gaps[1], str(gaps))
check("the fourth send arrived (the rule was removed) and was acknowledged, so the application got its 100 bytes", any(p.ip["src"] == "10.0.2.2" and p.tcp["ack"] == data[0].tcp["seq"] + 100 for p in rto) and d["rto_sink"].startswith("sink 100"))

# ---- 2. fast retransmit ----
fast = tcp("08_fast_c.pcap")
fisn = fast[0].tcp["seq"]
sent = [p for p in fast if p.ip["src"] == C and p.tcp["len"] == 1448]
seqs = [p.tcp["seq"] for p in sent]
again = [s for s in set(seqs) if seqs.count(s) >= 2]
check("30 segments of 1448 bytes make 43,440 bytes, and exactly one of them was sent more than once", len(set(seqs)) == 30 and len(again) == 1 and d["fast_sink"].startswith("sink 43440"))
lost_seq = again[0]
copies = sorted(p.t for p in sent if p.tcp["seq"] == lost_seq)
first_t, second_t = copies[0], copies[1]
lost_no = sorted(set(seqs)).index(lost_seq) + 1
show("the lost segment", f"segment number {lost_no} (relative seq {lost_seq - fisn - 1}) was sent at {first_t * 1000:.1f} ms and again at {second_t * 1000:.1f} ms; copies in all: {len(copies)} (at {[round(c * 1000, 1) for c in copies]})")
check("the router dropped exactly one packet (the third segment of the flow)", d["fast_drops"].split()[0] == "1" and lost_no == 3)
check("it was sent again one round trip after the first time (about 20 ms), not after the retransmission timer (hundreds of ms)", 15 <= (second_t - first_t) * 1000 <= 30, f"{(second_t - first_t) * 1000:.1f}")
acks = [p for p in fast if p.ip["src"] == "10.0.2.2" and p.tcp["flagbits"] & 0x10 and p.tcp["len"] == 0]
stuck = [p for p in acks if p.tcp["ack"] == lost_seq]
check("the receiver kept acknowledging the same number, the first byte of the hole, whenever a later segment arrived", len(stuck) >= 4)
sacks = [p.tcp["opts"]["sack"][0] for p in stuck if "sack" in p.tcp["opts"]]
hole = sacks[0][0] - lost_seq
show("the acknowledgements stuck at the hole", f"{len(stuck)} ACKs with ack = {lost_seq - fisn} (relative). The first SACK block starts at {sacks[0][0] - fisn} and ends at {sacks[0][1] - fisn}: {(sacks[0][1] - sacks[0][0]) // 1448} segments received beyond the hole.")
check("the SACK blocks say which bytes did arrive after the hole, so the sender knows the hole is exactly one segment (1448 bytes)", hole == 1448)
check("a SACK block grows by one segment with each later segment", [b[1] - b[0] for b in sacks[:3]] == [b[1] - b[0] for b in sacks[:1]] + [sacks[0][1] - sacks[0][0] + 1448, sacks[0][1] - sacks[0][0] + 2 * 1448])
final_ack = next(p for p in acks if p.t > second_t and p.tcp["ack"] > lost_seq + 1448 and "sack" not in p.tcp["opts"])
check("once the segment arrived the cumulative ACK jumped past everything that had been received out of order", final_ack.tcp["ack"] - lost_seq > 5 * 1448)
check("the whole transfer took well under one retransmission timeout", (fast[-1].t - fast[0].t) < 0.25)

# ---- 3. Nagle ----
n0, n1 = tcp("08_nagle0.pcap"), tcp("08_nagle1.pcap")
sizes0 = [p.tcp["len"] for p in n0 if p.ip["src"] == C and p.tcp["len"]]
sizes1 = [p.tcp["len"] for p in n1 if p.ip["src"] == C and p.tcp["len"]]
t0 = [p.t for p in n0 if p.ip["src"] == C and p.tcp["len"]]
show("five writes of 10 bytes, 1 ms apart", f"Nagle on (default):   segments of {sizes0} bytes, {(t0[1] - t0[0]) * 1000:.0f} ms apart\nTCP_NODELAY:          segments of {sizes1} bytes")
check("with Nagle (the default) the first 10 bytes go out at once and the other 40 wait for one segment of 40", sizes0 == [10, 40])
check("the second segment left only after the first was acknowledged: a whole round trip later", 15 <= (t0[1] - t0[0]) * 1000 <= 35)
check("with TCP_NODELAY every write is its own segment: five segments of 10 bytes, 1 ms apart", sizes1 == [10] * 5)
check("both receivers got the same 50 bytes", d["nagle_sink0"].startswith("sink 50") and d["nagle_sink1"].startswith("sink 50"))

# ---- 4. zero window ----
z = tcp("08_zero_c.pcap")
zisn = z[0].tcp["seq"]
synack = z[1]
scale = synack.tcp["opts"].get("wscale", 0)
sw = [(p.t, p.tcp["win"] << scale, p.tcp["ack"]) for p in z if p.ip["src"] == "10.0.2.2" and p.tcp["flagbits"] & 0x10]
zero_at = next(t for t, w, a in sw if w == 0)
probes = [p for p in z if p.ip["src"] == C and p.tcp["len"] == 0 and p.t > zero_at and p.tcp["flags"] == "ACK"]
reopen = next(t for t, w, a in sw if t > zero_at and w > 0)
gaps_z = [round((probes[i + 1].t - probes[i].t) * 1000) for i in range(len(probes) - 1)]
show("the receiver's window (bytes) at the moments that matter", f"SYN,ACK announced {synack.tcp['win']} (window scale {scale})\nfirst window of 0 at {zero_at * 1000:.0f} ms, reopened at {reopen * 1000:.0f} ms\nthe sender's probes at {[round(p.t * 1000) for p in probes]} ms (gaps {gaps_z})")
check("a small receive buffer means a small window and no window scaling (the lesson 7 default of 1024 would hide this)", synack.tcp["win"] == 7240 and scale == 0)
check("the window shrinks to 0 when the application does not read and the buffer is full", any(w == 0 for _, w, _ in sw))
check("the sender stops: during the 1.9 seconds with a zero window it sends only empty probes, one byte before the next byte to send", len(probes) >= 3 and all(p.tcp["len"] == 0 for p in probes))
check("the probes get further apart each time (about 250, 500 and 1000 ms): the same exponential back-off as for lost data", all(1.6 <= gaps_z[i + 1] / gaps_z[i] <= 2.4 for i in range(len(gaps_z) - 1)), str(gaps_z))
check("the window opens when the receiver starts to read (after about 2 seconds) and the sender sends new data within 15 ms", 1.8 <= reopen <= 2.3 and any(0 < (p.t - reopen) * 1000 < 15 and p.tcp["len"] > 0 for p in z))
check("everything arrived: 200,000 bytes, in about 2.3 seconds of which 2 were spent waiting for the receiver", d["zero_sink"].startswith("sink 200000") and 2.0 <= float(d["zero_bulk"].split()[1]) <= 2.8)

if WRITE:
    out = {
        "rto": {"sent": [round(p.t * 1000) for p in data], "gaps": gaps, "rtt": 20},
        "fast": {"segments": [{"n": i + 1, "t": round(min(p.t for p in sent if p.tcp["seq"] == s) * 1000, 1)} for i, s in enumerate(sorted(set(seqs)))], "lost": lost_no, "retx": round(second_t * 1000, 1), "first": round(first_t * 1000, 1), "sack": [(b[0] - fisn - 1, b[1] - fisn - 1) for b in sacks[:4]], "ackStuck": lost_seq - fisn - 1},
        "nagle": {"on": sizes0, "off": sizes1, "gap": round((t0[1] - t0[0]) * 1000)},
        "zero": {"synWin": synack.tcp["win"], "zeroAt": round(zero_at * 1000), "probes": [round(p.t * 1000) for p in probes], "reopen": round(reopen * 1000), "win": [[round(t * 1000), w] for t, w, a in sw[:40]]},
    }
    (LABS / "tcpRel.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print("wrote", LABS / "tcpRel.json")
print("ok")
