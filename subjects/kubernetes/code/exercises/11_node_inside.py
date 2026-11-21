"""Lesson 11 (inside a node): the kubelet, the container runtime (CRI), cgroups and the CNI, looked at from the node.

Asserts what the lesson prints:
  1. the kubelet asks containerd for containers over a unix socket; one Pod is one sandbox (the pause container) plus its containers
  2. the containers of one Pod share the network namespace of the sandbox and have their own mount and pid namespaces
  3. requests and limits become cgroup files: memory limit -> memory.max, cpu limit -> cpu.max, cpu request -> cpu.weight; a busy container under a CPU limit is throttled
  4. the Pod cgroup sits under the QoS class (kubepods/burstable/pod<uid>)
  5. CNI: every node owns a /24 Pod CIDR; a Pod is a veth pair; routes on a node send other nodes' CIDRs to that node's IP (kindnet, plugin ptp, no bridge)
  6. a Pod on another node is reached with two forwarding hops (TTL 64 becomes 62), and a Pod on the same node with none
  7. restarting the kubelet does not restart the containers
Run: python exercises/11_node_inside.py [--write]   (--write saves labs/kubernetes/node.json for the node lab)
"""

import json
import re
import sys
import time

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

WRITE = "--write" in sys.argv
W2, W3 = "garden-m02", "garden-m03"


def cstat(node: str, path: str) -> dict[str, int]:
    return {a: int(b) for a, b in (line.split() for line in node_sh(node, f"cat {path}/cpu.stat").splitlines())}


def main() -> None:
    result: dict = {}
    with namespace("node") as ns:
        apply(f"""apiVersion: v1
kind: Pod
metadata: {{name: lim, labels: {{app: lim}}}}
spec:
  nodeSelector: {{kubernetes.io/hostname: {W2}}}
  terminationGracePeriodSeconds: 1
  containers:
  - name: a
    image: {BUSYBOX}
    command: ["sh", "-c", "while :; do :; done"]
    resources: {{requests: {{cpu: 50m, memory: 32Mi}}, limits: {{cpu: 100m, memory: 64Mi}}}}
  - name: b
    image: {BUSYBOX}
    command: ["sleep", "3600"]
---
apiVersion: v1
kind: Pod
metadata: {{name: peer-local}}
spec:
  nodeSelector: {{kubernetes.io/hostname: {W2}}}
  terminationGracePeriodSeconds: 1
  containers: [{{name: c, image: {BUSYBOX}, command: [sleep, '3600']}}]
---
apiVersion: v1
kind: Pod
metadata: {{name: peer-far}}
spec:
  nodeSelector: {{kubernetes.io/hostname: {W3}}}
  terminationGracePeriodSeconds: 1
  containers: [{{name: c, image: {BUSYBOX}, command: [sleep, '3600']}}]
""", "-n", ns)
        for p in ("lim", "peer-local", "peer-far"):
            k("wait", "--for=condition=Ready", f"pod/{p}", "-n", ns, "--timeout=90s")
        uid = k("get", "pod", "lim", "-n", ns, "-o", "jsonpath={.metadata.uid}")

        # ---- 1. CRI -------------------------------------------------------------------------------------------
        sock = node_sh(W2, "ss -xl | grep -c 'containerd.sock '")
        kubelet_cmd = node_sh(W2, "ps -o args= -C kubelet")
        cfg = node_sh(W2, "grep -E 'containerRuntimeEndpoint|cgroupDriver' /var/lib/kubelet/config.yaml")
        show("kubelet config on a worker", cfg)
        check("containerd listens on a unix socket and the kubelet is configured to use it", sock.strip() == "1" and "containerd.sock" in cfg)
        sandboxes = node_sh(W2, f"crictl pods --state Ready --namespace klab-node --name ^lim$ -q").split()
        conts = node_sh(W2, f"crictl ps --pod {sandboxes[0]} --no-trunc -o json")
        names = sorted(c["metadata"]["name"] for c in json.loads(conts)["containers"])
        print(f"  Pod lim: sandbox {sandboxes[0][:12]}, containers {names}")
        check("one Pod is one sandbox plus its containers (a and b)", len(sandboxes) == 1 and names == ["a", "b"])
        sandbox_ps = node_sh(W2, f"crictl inspectp {sandboxes[0]}")
        pid_sb = json.loads(sandbox_ps)["info"]["pid"]
        cmd_sb = node_sh(W2, f"cat /proc/{pid_sb}/cmdline | tr '\\0' ' '")
        check("the sandbox runs the tiny /pause program that does nothing but keep the namespaces alive", cmd_sb.strip() == "/pause")
        result["pod"] = {"sandboxProcess": cmd_sb.strip(), "containers": names}

        # ---- 2. namespaces ------------------------------------------------------------------------------------
        pids = {}
        for c in json.loads(conts)["containers"]:
            pids[c["metadata"]["name"]] = json.loads(node_sh(W2, f"crictl inspect {c['id']}"))["info"]["pid"]
        pids["pause"] = pid_sb

        def ns_of(pid: int, kind: str) -> str:
            return node_sh(W2, f"readlink /proc/{pid}/ns/{kind}")

        net = {n: ns_of(p, "net") for n, p in pids.items()}
        mnt = {n: ns_of(p, "mnt") for n, p in pids.items()}
        pidns = {n: ns_of(p, "pid") for n, p in pids.items()}
        show("namespace ids seen from the node", "\n".join(f"{n:6} {net[n]}  {mnt[n]}  {pidns[n]}" for n in pids))
        check("a, b and pause share one network namespace", len(set(net.values())) == 1)
        check("each container has its own mount namespace", len({mnt["a"], mnt["b"], mnt["pause"]}) == 3)
        check("and its own pid namespace (processes are not shared by default)", len({pidns["a"], pidns["b"], pidns["pause"]}) == 3)
        result["namespaces"] = {"net": 1, "mnt": 3, "pid": 3}

        # ---- 3 and 4. cgroups ---------------------------------------------------------------------------------
        base = f"/sys/fs/cgroup/kubepods/burstable/pod{uid}"
        cid_a = next(c["id"] for c in json.loads(conts)["containers"] if c["metadata"]["name"] == "a")
        cid_b = next(c["id"] for c in json.loads(conts)["containers"] if c["metadata"]["name"] == "b")
        read = lambda cid, f: node_sh(W2, f"cat {base}/{cid}/{f}")  # noqa: E731
        vals = {"memory.max": read(cid_a, "memory.max"), "cpu.max": read(cid_a, "cpu.max"), "cpu.weight": read(cid_a, "cpu.weight"), "b memory.max": read(cid_b, "memory.max"), "b cpu.max": read(cid_b, "cpu.max")}
        show(f"cgroup files of container a (and b) under {base}", "\n".join(f"{a:13} {b}" for a, b in vals.items()))
        check("the Pod cgroup is under the QoS class folder (Burstable)", node_sh(W2, f"test -d {base} && echo yes") == "yes")
        check("limit memory 64Mi is memory.max 67108864", vals["memory.max"] == "67108864")
        check("limit cpu 100m is cpu.max '10000 100000' (10 ms of every 100 ms)", vals["cpu.max"] == "10000 100000")
        check("request cpu 50m is a small cpu.weight (2 here), only a share when the node is busy", int(vals["cpu.weight"]) <= 3)
        check("container b has no limits: memory.max is 'max' and cpu.max has no quota", vals["b memory.max"] == "max" and vals["b cpu.max"].startswith("max "))
        s1 = cstat(W2, f"{base}/{cid_a}")
        time.sleep(3)
        s2 = cstat(W2, f"{base}/{cid_a}")
        used = (s2["usage_usec"] - s1["usage_usec"]) / 3_000_000
        thr = s2["nr_throttled"] - s1["nr_throttled"]
        per = s2["nr_periods"] - s1["nr_periods"]
        print(f"  a loop that wants a whole CPU, over 3 s: used {used * 100:.0f}% of one CPU, throttled in {thr} of {per} periods")
        check("the busy container is held to about 10% of a CPU by the limit", 0.05 <= used <= 0.15, f"{used:.3f}")
        check("it was throttled in almost every 100 ms period", per > 0 and thr / per > 0.9, f"{thr}/{per}")
        result["cgroup"] = {"memoryMax": vals["memory.max"], "cpuMax": vals["cpu.max"], "cpuWeight": int(vals["cpu.weight"]), "usedPct": round(used * 100), "throttledPeriods": f"{thr}/{per}"}

        # ---- 5. CNI ---------------------------------------------------------------------------------------------
        cidrs = {n["metadata"]["name"]: n["spec"]["podCIDR"] for n in kj("get", "nodes")["items"]}
        print(f"  Pod CIDR per node: {cidrs}")
        check("every node owns a /24 of 10.244.0.0/16", all(re.fullmatch(r"10\.244\.\d+\.0/24", c) for c in cidrs.values()) and len(set(cidrs.values())) == 3)
        pod_ips = {p: k("get", "pod", p, "-n", ns, "-o", "jsonpath={.status.podIP}") for p in ("lim", "peer-local", "peer-far")}
        check("a Pod's IP is inside the CIDR of the node it runs on", pod_ips["lim"].startswith("10.244.1.") and pod_ips["peer-far"].startswith("10.244.2."))
        routes = node_sh(W2, "ip route")
        show(f"ip route on {W2}", routes)
        check("traffic for another node's CIDR is sent to that node's IP", f"{cidrs['garden']} via 192.168.67.2" in routes and f"{cidrs[W3]} via 192.168.67.4" in routes)
        check("each local Pod has a host route straight to its own veth (no bridge)", re.search(rf"{pod_ips['lim']} dev veth\w+ scope host", routes) is not None and "bridge" not in node_sh(W2, "ip -d link show type bridge | head -1"))
        pod_if = k("exec", "lim", "-n", ns, "-c", "b", "--", "ip", "-o", "link", "show", "eth0")
        peer = re.search(r"eth0@if(\d+)", pod_if)
        host_if = node_sh(W2, f"ip -o link | grep '^{peer.group(1)}:'")
        print(f"  Pod eth0 is half of a veth pair; the other half on the node: {host_if.split(':')[1].strip()}")
        check("the Pod's eth0 is one end of a veth pair whose other end is on the node", "veth" in host_if and "link-netns" in host_if)
        conf = node_sh(W2, "cat /etc/cni/net.d/10-kindnet.conflist")
        check("the CNI config of kindnet chains ptp, host-local IPAM and portmap", all(x in conf for x in ('"ptp"', '"host-local"', '"portmap"')))
        result["cni"] = {"cidrs": cidrs, "plugin": "ptp + host-local + portmap"}

        # ---- 6. two hops ------------------------------------------------------------------------------------------
        def ttl_of(target: str) -> int:
            out = k("exec", "lim", "-n", ns, "-c", "b", "--", "ping", "-c", "2", "-W", "2", target)
            return int(re.search(r"ttl=(\d+)", out).group(1))

        t_local, t_far = ttl_of(pod_ips["peer-local"]), ttl_of(pod_ips["peer-far"])
        print(f"  ping reply TTL: same node {t_local}, other node {t_far}")
        check("a Pod on the same node answers with TTL 63 (one hop: the node forwards)", t_local == 63, str(t_local))
        check("a Pod on another node answers with TTL 62 (two forwarding hops: both nodes)", t_far == 62, str(t_far))
        result["ttl"] = {"sameNode": t_local, "otherNode": t_far}

        # ---- 7. restart the kubelet --------------------------------------------------------------------------------
        before = node_sh(W2, f"crictl ps -q --pod {sandboxes[0]} | sort | tr '\\n' ' '")
        pid_before = pids["a"]
        node_sh(W2, "systemctl restart kubelet")
        wait_for(lambda: "Ready" in k("get", "node", W2, "--no-headers") and "NotReady" not in k("get", "node", W2, "--no-headers"), 90, 2, "node Ready")
        after = node_sh(W2, f"crictl ps -q --pod {sandboxes[0]} | sort | tr '\\n' ' '")
        pid_after = json.loads(node_sh(W2, f"crictl inspect {cid_a}"))["info"]["pid"]
        print(f"  kubelet restarted: containers before {before.split()[:2]} after {after.split()[:2]}; pid of a {pid_before} then {pid_after}")
        check("restarting the kubelet leaves the containers alone (same ids, same process)", before == after and pid_before == pid_after)
        check("the Pod never restarted", k("get", "pod", "lim", "-n", ns, "-o", "jsonpath={.status.containerStatuses[*].restartCount}") == "0 0")
        result["kubeletRestartKeepsContainers"] = True

    if WRITE:
        write_json(LABS / "node.json", result)


main_guard(main)
