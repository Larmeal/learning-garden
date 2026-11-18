"""Lesson 14: where to look when the network misbehaves.

Asserts: a request over a 20 ms round trip splits into three phases whose sizes follow the cause (connect is one round trip, wait is one round trip plus the server's work, and a 50 KB body
needs about two more round trips because of slow start), so a slow network and a slow application leave different fingerprints (a 100 ms path makes connect 200 ms, a slow application leaves connect
alone and grows wait). Then seven faults are tried with one connection attempt each, and each leaves its own signature in what the program sees and how long it took: nothing listening (refused at
once), a firewall that rejects (refused at once, with ICMP or with RST), a firewall that drops (silence, a timeout, the SYN sent again about once a second, and the client's socket in SYN-SENT),
a router with no route (an error at once), a cable that is cut (a timeout, like the drop) and a lossy link (connects, but some attempts take whole seconds). `--write` saves
site/src/components/labs/networking/debug.json for the lab.
"""

import json
import statistics as st
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from netlab import LABS, OUT, check, linux, load, show, table  # noqa: E402
from wire import read_pcap  # noqa: E402

WRITE = "--write" in sys.argv
print(linux("14_debugging.py").strip())
d = load("14_debugging.json")


def phases(runs):
    c = st.median(r["connect"] for r in runs)
    w = st.median(r["first_byte"] - r["connect"] for r in runs)
    t = st.median(r["total"] - r["first_byte"] for r in runs)
    return {"connect": round(c), "wait": round(w), "transfer": round(t)}


P = {k: phases(d[k]) for k in ("base", "slow_net", "slow_app")}
rtt_min = float(d["ping"].split("=")[1].split("/")[0])

# ---- 1. three phases ----
show("ping, the smallest question", d["ping"].splitlines()[-1])
check("the round trip on this path is 20 ms (10 ms each way), and ping shows its minimum as 20 ms", 19.5 <= rtt_min <= 22)
show("median of 7 requests, in milliseconds", table([[k, v["connect"], v["wait"], v["transfer"], sum(v.values())] for k, v in P.items()], ["case", "connect", "wait", "transfer", "total"]))
b, sn, sa = P["base"], P["slow_net"], P["slow_app"]
check("connect is one round trip: 20 ms on the normal path", 18 <= b["connect"] <= 26)
check("wait is one round trip plus the 50 ms the server works: about 70 ms", 62 <= b["wait"] <= 85)
check("a 50 KB body needs about two more round trips (slow start sends it in several flights): transfer is about 40 ms", 30 <= b["transfer"] <= 55)
check("a slow NETWORK (100 ms each way) makes connect 200 ms and every phase grows with the round trip", 190 <= sn["connect"] <= 215 and sn["wait"] >= 3 * b["wait"] and sn["transfer"] >= 5 * b["transfer"])
check("a slow APPLICATION (300 ms of work) leaves connect alone and grows only wait, by the extra 250 ms", abs(sa["connect"] - b["connect"]) <= 6 and 230 <= sa["wait"] - b["wait"] <= 280 and abs(sa["transfer"] - b["transfer"]) <= 12)

# ---- 2. seven faults ----
F = d["faults"]
rows = [["a service that answers", F["ok"]["result"], F["ok"]["secs"]]]
names = [("nothing_listening", "nothing listening on the port"), ("firewall_reject_icmp", "firewall REJECT (ICMP port unreachable)"), ("firewall_reject_rst", "firewall REJECT with a RST"),
         ("firewall_drop", "firewall DROP"), ("route_gone", "the router has no route to the server"), ("cable_cut", "cable cut (100 % loss)"), ("lossy_link", "lossy link (40 % loss, 20 tries)")]
for k, label in names:
    rows.append([label, F[k]["result"], F[k]["secs"]])
show("one connection attempt, what the program saw and how long it took (seconds)", table(rows, ["fault", "result", "seconds"]))
check("a working service connects at once", F["ok"]["result"] == "connected" and F["ok"]["secs"] < 0.2)
check("nothing listening: the kernel of the server answers with a RST, so the client gets 'refused' at once", F["nothing_listening"]["result"] == "refused" and F["nothing_listening"]["secs"] < 0.2)
check("a firewall that REJECTS also gives 'refused' at once, with an ICMP error or with a RST: from the client's side it looks the same as nothing listening", all(F[k]["result"] == "refused" and F[k]["secs"] < 0.2 for k in ("firewall_reject_icmp", "firewall_reject_rst")))
check("a firewall that DROPS gives silence: the client waits until its own timeout (3.5 s)", F["firewall_drop"]["result"] == "timeout" and 3.3 <= F["firewall_drop"]["secs"] <= 3.8)
check("while it waits, the client's socket is in SYN-SENT (ss shows the connection with the server's port 9000)", "10.0.2.2:9000" in d["ss_syn_sent"])
syns = [p for p in read_pcap(OUT / "14_drop.pcap") if p.tcp and p.tcp["flags"] == "SYN"]
show("SYNs that reached the server's cable during the 3.5 s", ", ".join(f"{p.t - syns[0].t:.1f}s" for p in syns))
check("the SYN was sent again about once a second (at least 3 times in 3.5 s), and the server's firewall dropped all of them", len(syns) >= 3 and all(0.8 <= b2.t - a.t <= 1.3 for a, b2 in zip(syns, syns[1:])))
check("a router with no route to the server answers with an ICMP error, so the client gets 'unreachable' at once", F["route_gone"]["result"] == "unreachable" and F["route_gone"]["secs"] < 0.2)
check("a cut cable looks exactly like a DROP firewall: a timeout of 3 s with no error", F["cable_cut"]["result"] == "timeout" and 2.9 <= F["cable_cut"]["secs"] <= 3.3)
runs = d["lossy_runs"]
slow = [r["secs"] for r in runs if r["secs"] >= 0.9]
show("20 attempts over a link that loses 40 % of the client's packets (seconds)", ", ".join(str(r["secs"]) for r in runs))
check("all 20 attempts connected: TCP kept sending the SYN until one got through", all(r["result"] == "connected" for r in runs))
check("but some attempts took whole seconds: each lost SYN costs about a second more", len(slow) >= 1 and all(abs(s - round(s)) <= 0.25 for s in slow))

if WRITE:
    out = {"rtt": 20, "phases": P,
           "faults": {k: F[k] for k, _ in names} | {"ok": F["ok"]},
           "synTimes": [round(p.t - syns[0].t, 1) for p in syns],
           "lossy": [r["secs"] for r in runs]}
    (LABS / "debug.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print("wrote", LABS / "debug.json")
print("ok")
