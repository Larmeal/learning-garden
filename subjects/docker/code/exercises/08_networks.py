"""Lesson 8: how containers find each other, and how the outside reaches them. Default bridge, user-defined networks, published ports, none and host.

Asserts that containers on the default bridge reach each other by IP but not by name, that a user-defined network adds name resolution through Docker's DNS, that two networks
are walled off from each other until a container joins both, that a port is reachable from the computer only when it is published (and on which address), that an alias can name
two containers, that `--network none` leaves only the loopback and `--network host` shows the engine's own interfaces, and that an application container reaches Postgres by its name.
`--write` saves who can reach whom as site/src/components/labs/docker/networks.json for the lab.
"""

import socket
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dlab import ALPINE, LABEL, LABS, POSTGRES, PYTHON, check, docker, inspect, main_guard, run, show, table, write_json  # noqa: E402

WRITE = "--write" in sys.argv


def ip_of(name: str, net: str) -> str:
    return docker("inspect", "-f", f"{{{{(index .NetworkSettings.Networks \"{net}\").IPAddress}}}}", name)


def ping(frm: str, target: str) -> bool:
    return run("exec", frm, "ping", "-c", "1", "-W", "1", target, check=False).returncode == 0


def sleeper(name: str, *opts: str) -> None:
    docker("run", "-d", "--name", name, "--label", LABEL, *opts, ALPINE, "sleep", "300")


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def reachable(host: str, port: int) -> bool:
    with socket.socket() as s:
        s.settimeout(2)
        return s.connect_ex((host, port)) == 0


def main() -> None:
    # ---- 1. default bridge: IP yes, name no ----
    nets = docker("network", "ls", "--format", "{{.Name}} {{.Driver}}").splitlines()
    show("docker network ls (the three that always exist)", "\n".join(n for n in nets if n.split()[0] in ("bridge", "host", "none")))
    check("a fresh Docker has the networks bridge, host and none", {"bridge", "host", "none"} <= {n.split()[0] for n in nets})
    sleeper("dlab-a1")
    sleeper("dlab-b1")
    ia, ib = ip_of("dlab-a1", "bridge"), ip_of("dlab-b1", "bridge")
    show("two containers on the default bridge", f"a: {ia}\nb: {ib}")
    check("they get addresses in one private range of the default bridge (172.17.x.x)", ia.startswith("172.17.") and ib.startswith("172.17.") and ia != ib)
    default_ip = ping("dlab-a1", ib)
    default_name = ping("dlab-a1", "dlab-b1")
    check("on the default bridge a reaches b by IP address", default_ip)
    check("but not by name: the default bridge has no name resolution", not default_name)
    docker("rm", "-f", "dlab-a1", "dlab-b1")

    # ---- 2. a user-defined network adds DNS ----
    run("network", "create", "--label", LABEL, "dlab-net1")
    sleeper("dlab-a2", "--network", "dlab-net1")
    sleeper("dlab-b2", "--network", "dlab-net1")
    user_name = ping("dlab-a2", "dlab-b2")
    user_ip = ping("dlab-a2", ip_of("dlab-b2", "dlab-net1"))
    resolv = docker("exec", "dlab-a2", "cat", "/etc/resolv.conf")
    net_info = inspect("dlab-net1")
    show("docker network inspect dlab-net1 (the parts we need)", f"Driver: {net_info['Driver']}\nSubnet: {net_info['IPAM']['Config'][0]['Subnet']}\nGateway: {net_info['IPAM']['Config'][0]['Gateway']}\nresolv.conf inside a:\n{resolv}")
    check("on a user-defined network a reaches b by name", user_name)
    check("and by IP", user_ip)
    check("name lookups go to Docker's own DNS at 127.0.0.11 inside the container", "127.0.0.11" in resolv, resolv)
    check("the network has its own subnet, a different one from the default bridge", net_info["IPAM"]["Config"][0]["Subnet"].split(".")[1] != "17", net_info["IPAM"]["Config"][0]["Subnet"])

    # ---- 3. two networks are walled off from each other ----
    run("network", "create", "--label", LABEL, "dlab-net2")
    sleeper("dlab-c2", "--network", "dlab-net2")
    ic = ip_of("dlab-c2", "dlab-net2")
    across_name = ping("dlab-a2", "dlab-c2")
    across_ip = ping("dlab-a2", ic)
    check("a on one network cannot reach c on another by name", not across_name)
    check("nor by IP address", not across_ip)
    docker("network", "connect", "dlab-net2", "dlab-a2")
    joined = ping("dlab-a2", "dlab-c2")
    check("once a joins the second network too, it reaches c by name", joined)
    show("who can reach whom", table([
        ["default bridge", default_ip, default_name],
        ["same user-defined network", user_ip, user_name],
        ["two separate user-defined networks", across_ip, across_name],
        ["a joined to both networks", True, joined],
    ], ["setup", "a reaches b by IP", "a reaches b by name"]))
    docker("rm", "-f", "dlab-a2", "dlab-b2", "dlab-c2")

    # ---- 4. publishing a port: reaching a container from the computer ----
    ctx_cmd = ["python", "-m", "http.server", "8000"]
    port = free_port()
    docker("run", "-d", "--name", "dlab-web-pub", "--label", LABEL, "--network", "dlab-net1", "-p", f"127.0.0.1:{port}:8000", PYTHON, *ctx_cmd)
    docker("run", "-d", "--name", "dlab-web-priv", "--label", LABEL, "--network", "dlab-net1", PYTHON, *ctx_cmd)
    time.sleep(2)
    pub_ok = reachable("127.0.0.1", port)
    priv_ip = ip_of("dlab-web-priv", "dlab-net1")
    priv_from_host = reachable(priv_ip, 8000)
    docker("run", "-d", "--name", "dlab-client", "--label", LABEL, "--network", "dlab-net1", ALPINE, "sleep", "300")
    inner_pub = run("exec", "dlab-client", "wget", "-q", "-O", "-", "-T", "3", "http://dlab-web-pub:8000/", check=False)
    inner_priv = run("exec", "dlab-client", "wget", "-q", "-O", "-", "-T", "3", "http://dlab-web-priv:8000/", check=False)
    port_map = docker("port", "dlab-web-pub")
    show("who can reach the web servers on port 8000", table([
        ["from the computer, to the published one (127.0.0.1:%d)" % port, pub_ok],
        ["from the computer, to the one with no -p (container IP)", priv_from_host],
        ["from another container, to the one with -p (by name)", inner_pub.returncode == 0],
        ["from another container, to the one with no -p (by name)", inner_priv.returncode == 0],
    ], ["request", "reached"]) + f"\n\ndocker port: {port_map}")
    check("a published port is reachable from the computer", pub_ok)
    check("an unpublished one is not reachable from the computer", not priv_from_host)
    check("another container on the same network reaches both by name and port, published or not", inner_pub.returncode == 0 and inner_priv.returncode == 0 and "Directory listing" in inner_priv.stdout)
    check("docker port shows the address the port is bound to (127.0.0.1 here, because -p said so)", port_map == f"8000/tcp -> 127.0.0.1:{port}", port_map)
    docker("rm", "-f", "dlab-web-pub", "dlab-web-priv", "dlab-client")

    # ---- 5. aliases, none and host ----
    sleeper("dlab-r1", "--network", "dlab-net1", "--network-alias", "workers")
    sleeper("dlab-r2", "--network", "dlab-net1", "--network-alias", "workers")
    sleeper("dlab-q", "--network", "dlab-net1")
    lookup = docker("exec", "dlab-q", "nslookup", "workers")
    addrs = sorted({line.split()[-1] for line in lookup.splitlines() if line.startswith("Address") and "127.0.0.11" not in line and "#" not in line})
    show("nslookup workers (an alias given to two containers)", lookup)
    check("one alias given to two containers resolves to both addresses (simple DNS balancing)", len(addrs) == 2 and set(addrs) == {ip_of("dlab-r1", "dlab-net1"), ip_of("dlab-r2", "dlab-net1")}, str(addrs))
    docker("rm", "-f", "dlab-r1", "dlab-r2", "dlab-q")
    ifaces_none = docker("run", "--rm", "--label", LABEL, "--network", "none", ALPINE, "ls", "/sys/class/net").split()
    ifaces_host = docker("run", "--rm", "--label", LABEL, "--network", "host", ALPINE, "ls", "/sys/class/net").split()
    ifaces_bridge = docker("run", "--rm", "--label", LABEL, ALPINE, "ls", "/sys/class/net").split()
    show("network interfaces seen inside", f"--network none:   {ifaces_none}\ndefault bridge:   {ifaces_bridge}\n--network host:   {ifaces_host}")
    check("--network none leaves only the loopback interface", ifaces_none == ["lo"])
    check("a normal container has the loopback and one interface of its own (eth0)", sorted(ifaces_bridge) == ["eth0", "lo"])
    check("--network host shows the interfaces of the Linux that runs the engine, including the bridge docker0", "docker0" in ifaces_host and len(ifaces_host) > 2, str(ifaces_host))

    # ---- 6. an application reaches its database by name ----
    docker("run", "-d", "--name", "dlab-db", "--label", LABEL, "--network", "dlab-net1", "-e", "POSTGRES_PASSWORD=lesson", POSTGRES)
    ready = ""
    for _ in range(60):
        probe = run("run", "--rm", "--label", LABEL, "--network", "dlab-net1", POSTGRES, "pg_isready", "-h", "dlab-db", check=False)
        if probe.returncode == 0:
            ready = probe.stdout.strip()
            break
        time.sleep(1)
    show("pg_isready -h dlab-db, run in a second container", ready)
    check("a client container on the same network finds Postgres by the name of its container", "accepting connections" in ready, ready)
    outside = reachable("127.0.0.1", 5432)
    check("and nothing was published, so the computer itself cannot reach port 5432", not outside)

    if WRITE:
        write_json(
            LABS / "networks.json",
            {
                "bridge": {"ip": default_ip, "name": default_name},
                "user": {"ip": user_ip, "name": user_name},
                "separate": {"ip": across_ip, "name": across_name},
                "joined": {"ip": True, "name": joined},
                "port": {"published": pub_ok, "unpublished": priv_from_host, "innerPublished": inner_pub.returncode == 0, "innerUnpublished": inner_priv.returncode == 0},
                "ifaces": {"none": ifaces_none, "bridge": sorted(ifaces_bridge), "hostCount": len(ifaces_host)},
                "subnets": {"default": ia.rsplit(".", 1)[0] + ".0/16", "user": net_info["IPAM"]["Config"][0]["Subnet"]},
            },
        )


if __name__ == "__main__":
    main_guard(main)
