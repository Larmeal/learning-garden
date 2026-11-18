"""Builds the lab network inside Linux network namespaces. Runs as root, standard library only (Python 3.10 of Ubuntu in WSL).

    client (nlc) --- router (nlr) --- server (nls)
    10.0.1.2/24     10.0.1.1 | 10.0.2.1     10.0.2.2/24

Fixed MAC addresses and no IPv6, so that a capture holds only what the lesson is about and repeats on every run.
"""

import json
import os
import signal
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "out")
os.makedirs(OUT, exist_ok=True)

MAC = {"c0": "02:00:00:00:00:c0", "rc": "02:00:00:00:00:a1", "rs": "02:00:00:00:00:a2", "s0": "02:00:00:00:00:50"}


def sh(cmd, check=True):
    done = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if check and done.returncode != 0:
        raise RuntimeError("%s -> %s\n%s%s" % (cmd, done.returncode, done.stdout, done.stderr))
    return done.stdout.strip()


def ns(name, cmd, check=True):
    return sh("ip netns exec %s %s" % (name, cmd), check=check)


def spawn(name, argv):
    """Start a process inside a namespace and return it (it dies with stop_all)."""
    p = subprocess.Popen(["ip", "netns", "exec", name] + argv, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, preexec_fn=os.setsid)
    PROCS.append(p)
    return p


PROCS = []


def stop_all():
    for p in PROCS:
        try:
            os.killpg(os.getpgid(p.pid), signal.SIGTERM)
        except Exception:
            pass
    for p in PROCS:
        try:
            p.wait(timeout=3)
        except Exception:
            pass
    del PROCS[:]


def teardown():
    stop_all()
    for n in sh("ip netns list", check=False).split("\n"):
        n = n.split(" ")[0]
        if n.startswith("nl"):
            sh("ip netns del %s" % n, check=False)


def build(extra_ns=()):
    """client, router and server in a line. Returns nothing: the names are nlc, nlr, nls."""
    teardown()
    for n in ("nlc", "nlr", "nls") + tuple(extra_ns):
        sh("ip netns add %s" % n)
        ns(n, "sysctl -qw net.ipv6.conf.all.disable_ipv6=1 net.ipv6.conf.default.disable_ipv6=1")
        ns(n, "ip link set lo up")
    link("nlc", "c0", "nlr", "rc")
    link("nlr", "rs", "nls", "s0")
    for n, dev, addr in (("nlc", "c0", "10.0.1.2/24"), ("nlr", "rc", "10.0.1.1/24"), ("nlr", "rs", "10.0.2.1/24"), ("nls", "s0", "10.0.2.2/24")):
        ns(n, "ip addr add %s dev %s" % (addr, dev))
        ns(n, "ip link set %s up" % dev)
    ns("nlc", "ip route add default via 10.0.1.1")
    ns("nls", "ip route add default via 10.0.2.1")
    ns("nlr", "sysctl -qw net.ipv4.ip_forward=1")


def link(na, da, nb, db):
    sh("ip link add %s type veth peer name %s" % (da, db))
    for n, d in ((na, da), (nb, db)):
        sh("ip link set %s netns %s" % (d, n))
        if d in MAC:
            ns(n, "ip link set dev %s address %s" % (d, MAC[d]))


class Capture:
    """tcpdump -w on one interface of one namespace. Use as a context manager; the file is complete when the block ends."""

    def __init__(self, nsname, dev, name, filt=""):
        self.path = os.path.join(OUT, name)
        self.args = ["tcpdump", "-i", dev, "-n", "-U", "-Z", "root", "-w", self.path] + ([filt] if filt else [])
        self.nsname = nsname

    def __enter__(self):
        self.p = subprocess.Popen(["ip", "netns", "exec", self.nsname] + self.args, stderr=subprocess.PIPE, stdout=subprocess.PIPE)
        while True:
            line = self.p.stderr.readline().decode()
            if "listening" in line or not line:
                break
        time.sleep(0.3)   # tcpdump says 'listening' a little before the filter is really in place
        return self

    def __exit__(self, *a):
        time.sleep(0.5)
        self.p.send_signal(signal.SIGINT)
        self.p.wait(timeout=5)


def save_json(name, data):
    with open(os.path.join(OUT, name), "w") as f:
        json.dump(data, f, indent=1)


def build_switch(hosts=("nla", "nlb", "nlc")):
    """Hosts joined by a switch (a Linux bridge in the namespace nlsw): e0 of each host, p1..pN on the switch, 10.0.1.2, .3, .4 and MAC 02:..:0a, 0b, 0c."""
    teardown()
    names = ("nlsw",) + tuple(hosts)
    for n in names:
        sh("ip netns add %s" % n)
        ns(n, "sysctl -qw net.ipv6.conf.all.disable_ipv6=1 net.ipv6.conf.default.disable_ipv6=1")
        ns(n, "ip link set lo up")
    ns("nlsw", "ip link add br0 type bridge")
    ns("nlsw", "ip link set br0 type bridge stp_state 0")
    ns("nlsw", "ip link set br0 up")
    for i, h in enumerate(hosts):
        sh("ip link add e0 netns %s type veth peer name p%d netns nlsw" % (h, i + 1))
        ns(h, "ip link set dev e0 address 02:00:00:00:00:%02x" % (0x0A + i))
        ns(h, "ip addr add 10.0.1.%d/24 dev e0" % (i + 2))
        ns(h, "ip link set e0 up")
        ns("nlsw", "ip link set p%d master br0" % (i + 1))
        ns("nlsw", "ip link set p%d up" % (i + 1))


def build_chain(n=3, delay_ms=None):
    """client - r1 - ... - rn - server. Link s (1..n+1) is 10.0.s.0/24: node s-1 has 10.0.s.1 on r0, node s has 10.0.s.2 on l0. Names: nlc, nlr1.., nls."""
    teardown()
    names = ["nlc"] + ["nlr%d" % k for k in range(1, n + 1)] + ["nls"]
    for nm in names:
        sh("ip netns add %s" % nm)
        ns(nm, "sysctl -qw net.ipv6.conf.all.disable_ipv6=1 net.ipv6.conf.default.disable_ipv6=1")
        ns(nm, "ip link set lo up")
    for s in range(1, n + 2):
        left, right = names[s - 1], names[s]
        sh("ip link add r0 netns %s type veth peer name l0 netns %s" % (left, right))
        ns(left, "ip addr add 10.0.%d.1/24 dev r0" % s)
        ns(right, "ip addr add 10.0.%d.2/24 dev l0" % s)
        ns(left, "ip link set r0 up")
        ns(right, "ip link set l0 up")
        if delay_ms:
            ns(left, "tc qdisc add dev r0 root netem delay %dms" % delay_ms)
            ns(right, "tc qdisc add dev l0 root netem delay %dms" % delay_ms)
    ns("nlc", "ip route add default via 10.0.1.2")
    ns("nls", "ip route add default via 10.0.%d.1" % (n + 1))
    for k in range(1, n + 1):
        nm = names[k]
        ns(nm, "sysctl -qw net.ipv4.ip_forward=1")
        for s in range(1, n + 2):
            if s > k + 1:
                ns(nm, "ip route add 10.0.%d.0/24 via 10.0.%d.2" % (s, k + 1))
            elif s < k:
                ns(nm, "ip route add 10.0.%d.0/24 via 10.0.%d.1" % (s, k))
    return names
