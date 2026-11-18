"""Lesson 9: TCP congestion control.

3 MB are sent over a bottleneck of 8 Mbit/s (a token bucket filter on the router) with a 20 ms round trip, using Reno, the textbook algorithm (the default of this Linux is CUBIC).
The client's congestion window (cwnd), slow start threshold (ssthresh), smoothed round trip and retransmissions are read from `ss -ti` every 12 ms. Two runs differ only in the queue in
front of the bottleneck: 30 KB and 600 KB. A ping runs alongside the second one. Asserts slow start (the window doubles each round trip), what happens at the first loss (ssthresh is
half of cwnd), additive increase afterwards (about one segment per round trip), the sawtooth, that the pipe holds the bandwidth-delay product plus the queue, that throughput reaches the
bottleneck, and that a long queue turns the same bottleneck into a latency of more than half a second (bufferbloat). `--write` saves site/src/components/labs/networking/cong.json.
"""

import json
import re
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from netlab import LABS, check, linux, load, show, table  # noqa: E402

WRITE = "--write" in sys.argv
print(linux("09_congestion.py").strip())
d = load("09_congestion.json")
SIZE = 3_000_000
MSS, RATE, RTT0, QS, QB = 1448, 8_000_000, 0.020, 30000, 600000
BDP = RATE / 8 * RTT0
small, big = d["small"], d["big"]
s, b = small["series"], big["series"]

# ---- 0. the setting ----
show("the setting", f"bottleneck {RATE / 1e6:.0f} Mbit/s on the router, round trip {RTT0 * 1000:.0f} ms, so the bandwidth-delay product is {BDP:.0f} bytes = {BDP / MSS:.1f} segments of {MSS} bytes\nidle ping: {d['idle_ping']}\ncongestion control in the namespaces: {small['algo']} (the system default is {d['algo']})")
check("the transfer ran with Reno (set inside the namespaces, the system default stays CUBIC)", small["algo"] == "reno" and big["algo"] == "reno" and d["algo"] == "cubic")
check("the bandwidth-delay product is the amount of data that fills the pipe: about 14 segments here", 13 <= BDP / MSS <= 15)
check("the idle round trip is the 20 ms of the cables", 19 <= float(re.search(r"= ([\d.]+)/", d["idle_ping"]).group(1)) <= 30)


def drops(series, factor=0.8):
    """Index of the sample that starts each cut: the window falls below `factor` of the highest value since the last cut."""
    out, top = [], series[0]["cwnd"]
    for i in range(1, len(series)):
        c = series[i]["cwnd"]
        if c < top * factor:
            out.append(i)
            top = c
        else:
            top = max(top, c)
    return out


def cut_to(series, i):
    """(peak before, low after) of a cut that starts at sample i."""
    peak = max(r["cwnd"] for r in series[max(0, i - 6) : i])
    low = min(r["cwnd"] for r in series[i : i + 6])
    return peak, low


# ---- 1. slow start ----
steps = [s[0]["cwnd"]]
for r in s[1:]:
    if r["cwnd"] != steps[-1]:
        steps.append(r["cwnd"])
show("the first values of cwnd (segments), small queue", str(steps[:8]))
check("the connection starts with a congestion window of 10 segments", s[0]["cwnd"] == 10)
check("then cwnd doubles each round trip: 10, 20, 40 (slow start)", steps[:3] == [10, 20, 40] or (steps[1] == 20 and steps[2] >= 32), str(steps[:4]))
check("while there has been no loss, ssthresh is huge (it does not limit slow start)", s[0]["ssthresh"] > 10000)
check("the same start in the second run: 10, then 20", b[0]["cwnd"] == 10 and 20 in [r["cwnd"] for r in b[:8]])

# ---- 2. the first loss ----
i0 = next(i for i, r in enumerate(s) if r["ssthresh"] < 10000)
peak = max(r["cwnd"] for r in s[:i0 + 1])
show("the first loss in the small run", f"cwnd reached {peak} segments, then ssthresh was set to {s[i0]['ssthresh']} (retransmissions so far: {s[i0].get('retrans', 0)})")
check("slow start ends at the first loss: ssthresh becomes half of cwnd (the signature of Reno)", 0.42 <= s[i0]["ssthresh"] / peak <= 0.58, f"{s[i0]['ssthresh']} / {peak}")
check("the loss happened when the pipe was full: the cwnd at that moment is about the bandwidth-delay product plus the queue (50,000 bytes = 34 segments), plus what slow start overshoots", 33 <= peak <= 70, str(peak))
j0 = next(i for i, r in enumerate(b) if r["ssthresh"] < 10000)
bpeak = max(r["cwnd"] for r in b[:j0 + 1])
check("with the long queue the first loss comes much later: slow start keeps doubling until the 600 KB queue is full (cwnd of several hundred)", bpeak >= 400, str(bpeak))
check("here too ssthresh is about half of cwnd", 0.42 <= b[j0]["ssthresh"] / bpeak <= 0.58, f"{b[j0]['ssthresh']} / {bpeak}")

# ---- 3. additive increase and the sawtooth ----
runs, cur = [], [i0 + 1]
for i in range(i0 + 2, len(s)):
    if s[i]["cwnd"] >= s[i - 1]["cwnd"]:
        cur.append(i)
    else:
        if len(cur) > 12:
            runs.append(cur)
        cur = [i]
best = max(runs, key=lambda r: s[r[-1]]["t"] - s[r[0]]["t"])
a, z = s[best[0]], s[best[-1]]
rtt_mean = statistics.mean(s[i]["rtt"] for i in best) / 1000
slope = (z["cwnd"] - a["cwnd"]) / (z["t"] - a["t"]) * rtt_mean
show("congestion avoidance: the longest climb after the first loss", f"from {a['cwnd']} to {z['cwnd']} segments in {z['t'] - a['t']:.2f} s, with a mean round trip of {rtt_mean * 1000:.0f} ms: {slope:.2f} segments per round trip")
check("after a loss cwnd grows by about one segment per round trip (additive increase)", 0.7 <= slope <= 1.4, f"{slope:.2f}")
check("it climbs for at least half a second without a break", z["t"] - a["t"] >= 0.5)
cuts = []
for i in drops(s):
    if not cuts or s[i]["t"] - s[cuts[-1]]["t"] > 0.15:
        cuts.append(i)
sawtooth = [(round(s[i]["t"], 2),) + cut_to(s, i) for i in cuts]
show("sudden cuts of cwnd (time, before, after), small queue", str(sawtooth))
check("cwnd is cut again and again as the pipe fills: at least two cuts in the run, a sawtooth", len(cuts) >= 2, str(sawtooth))
check("each cut brings cwnd to about half of what it was (multiplicative decrease)", all(0.4 <= lo / pk <= 0.8 for _, pk, lo in sawtooth), str(sawtooth))
tops = [pk for _, pk, lo in sawtooth[1:]]
check("the later peaks stay near 33 segments: the bandwidth-delay product plus the 30 KB queue is about 34", tops and all(26 <= x <= 44 for x in tops), str(tops))

# ---- 4. throughput and delay ----
t1 = next(r for r in s if r["t"] >= 0.8)
t2 = next(r for r in s if r["t"] >= 2.0)
tp = (t2["acked"] - t1["acked"]) * 8 / (t2["t"] - t1["t"])
show("throughput between 0.8 s and 2.0 s", f"{tp / 1e6:.2f} Mbit/s of the 8 Mbit/s bottleneck")
check("the connection uses almost the whole bottleneck, 7 Mbit/s or more of 8", tp >= 7.0e6, f"{tp / 1e6:.2f}")
check("it cannot do more: nothing above the bottleneck (the headers also take their share)", tp <= RATE * 1.02)
rt_s = [r["rtt"] for r in s if "rtt" in r]
rt_b = [r["rtt"] for r in b if "rtt" in r]
ping = [float(x) for x in re.findall(r"time=([\d.]+) ms", big["ping"])]
show("round trip while the transfer runs (ms)", table([["30 KB queue", f"{min(rt_s):.0f}", f"{statistics.mean(rt_s):.0f}", f"{max(rt_s):.0f}"], ["600 KB queue", f"{min(rt_b):.0f}", f"{statistics.mean(rt_b):.0f}", f"{max(rt_b):.0f}"], ["ping during the 600 KB run", f"{min(ping):.0f}", f"{statistics.mean(ping):.0f}", f"{max(ping):.0f}"]], ["", "min", "mean", "max"]))
check("with the short queue the round trip stays between 20 ms and about 60 ms (30 KB at 1 MB/s is 30 ms of queue)", max(rt_s) <= 80 and min(rt_s) >= 20, f"{min(rt_s):.0f}-{max(rt_s):.0f}")
check("with the long queue the same transfer, on the same 8 Mbit/s, makes the round trip grow past half a second (bufferbloat)", max(rt_b) >= 500, f"{max(rt_b):.0f}")
check("another program's ping, which sends almost nothing, suffers the same delay: it grows from 20 ms to more than 500 ms", min(ping) <= 22 and max(ping) >= 500, f"{min(ping):.0f}-{max(ping):.0f}")
done = lambda series: next(r["t"] for r in series if r.get("acked", 0) >= 0.97 * SIZE)  # noqa: E731
t_s, t_b = done(s), done(b)
show("time to deliver 3 MB", f"30 KB queue: {t_s:.2f} s    600 KB queue: {t_b:.2f} s    (3 MB at 8 Mbit/s: {SIZE * 8 / RATE:.2f} s at best, without headers)")
check("both runs deliver the 3 MB in the same time, about 3.2 s: the long queue buys no throughput, only delay", abs(t_s - t_b) / t_s < 0.1 and 3.0 <= t_s <= 3.6, f"{t_s:.2f} vs {t_b:.2f}")
tp_b = SIZE * 8 / t_b
dq = lambda txt: int(re.search(r"dropped (\d+)", txt).group(1))  # noqa: E731
show("what the bottleneck's queue did", f"30 KB queue: dropped {dq(small['qdisc'])} packets\n600 KB queue: dropped {dq(big['qdisc'])} packets")
check("loss is how the bottleneck says 'full': both queues dropped packets, and the sender slowed down only because of that", dq(small["qdisc"]) >= 1 and dq(big["qdisc"]) >= 1)
check("the long queue delays the first loss and makes it bigger: slow start kept doubling into the 600 KB queue, so the burst that overflowed it was about ten times larger (410 packets against 40)", dq(big["qdisc"]) >= 5 * dq(small["qdisc"]), f"{dq(big['qdisc'])} vs {dq(small['qdisc'])}")

if WRITE:
    def thin(series, every, upto):
        return [[r["t"], r["cwnd"], r["ssthresh"] if r["ssthresh"] < 10000 else None, round(r.get("rtt", 0))] for r in series[::every] if r["t"] <= upto]
    out = {
        "mss": MSS, "rate": RATE, "rtt0": RTT0 * 1000, "bdp": round(BDP), "queues": [QS, QB],
        "small": thin(s, 2, 3.0), "big": thin(b, 2, 3.0),
        "ping": ping, "pingMs": [round(0.4 + 0.2 * i, 1) for i in range(len(ping))],
        "tp": round(tp / 1e6, 2), "tpBig": round(tp_b / 1e6, 2),
        "peak": peak, "bigPeak": bpeak, "cuts": sawtooth, "slope": round(slope, 2),
    }
    (LABS / "cong.json").write_text(json.dumps(out), encoding="utf-8")
    print("wrote", LABS / "cong.json")
print("ok")
