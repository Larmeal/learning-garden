"""Lesson 7 (Service): a stable name and address in front of Pods that come and go.

Asserts what the lesson prints:
  1. a Service has a virtual ClusterIP and a selector; the EndpointSlice lists the IPs of the Ready Pods that the selector matches
  2. DNS: the short name works in the same namespace, the long name works from anywhere, the search path and ndots in /etc/resolv.conf explain why
  3. requests are spread over the Pods (kube-proxy: a random choice per connection, so the counts are close but not equal)
  4. a Pod that fails its readiness probe leaves the EndpointSlice and receives no traffic; a selector that matches nothing gives an empty list and a refused connection
  5. kube-proxy in iptables mode: one chain per Service, one rule per Pod with a probability, and a DNAT to the Pod IP
  6. NodePort answers on every node, also on a node without a Pod of the Service; a headless Service returns the Pod IPs themselves
Run: python exercises/07_services.py [--write]   (--write saves labs/kubernetes/services.json for the Service lab)
"""

import ipaddress
import re
import sys
import time
from collections import Counter

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

WRITE = "--write" in sys.argv

WEB = f"""apiVersion: apps/v1
kind: Deployment
metadata: {{name: web}}
spec:
  replicas: 3
  selector: {{matchLabels: {{app: web}}}}
  template:
    metadata: {{labels: {{app: web}}}}
    spec:
      terminationGracePeriodSeconds: 1
      containers:
      - name: web
        image: {BUSYBOX}
        command: ["sh", "-c", "mkdir -p /www; touch /tmp/ok; echo $(hostname) > /www/index.html; exec httpd -f -p 8080 -h /www"]
        readinessProbe:
          exec: {{command: ["cat", "/tmp/ok"]}}
          periodSeconds: 1
          failureThreshold: 1
---
apiVersion: v1
kind: Service
metadata: {{name: web}}
spec:
  selector: {{app: web}}
  ports: [{{port: 80, targetPort: 8080}}]
"""


def endpoint_ips(ns: str, svc: str) -> list[str]:
    items = kj("get", "endpointslices", "-n", ns, "-l", f"kubernetes.io/service-name={svc}")["items"]
    ips = []
    for sl in items:
        for ep in sl.get("endpoints") or []:
            if ep.get("conditions", {}).get("ready", True):
                ips += ep["addresses"]
    return sorted(ips)


def hits(ns: str, url: str, n: int = 30) -> Counter:
    out = k("exec", "client", "-n", ns, "--", "sh", "-c", f"for i in $(seq {n}); do wget -qO- -T 2 {url}; done")
    return Counter(out.split())


def main() -> None:
    result: dict = {}
    with namespace("services") as ns:
        apply(WEB, "-n", ns)
        apply(f"apiVersion: v1\nkind: Pod\nmetadata: {{name: client}}\nspec:\n  terminationGracePeriodSeconds: 1\n  containers:\n  - name: c\n    image: {BUSYBOX}\n    command: [sleep, '3600']\n", "-n", ns)
        wait_for(lambda: len(ready_pods(ns, "app=web")) == 3, 90, 1, "3 web Pods")
        k("wait", "--for=condition=Ready", "pod/client", "-n", ns, "--timeout=60s")

        # ---- 1. the object ------------------------------------------------------------------------------
        svc = kj("get", "service", "web", "-n", ns)
        cip = svc["spec"]["clusterIP"]
        pod_ips = sorted(p["status"]["podIP"] for p in pods(ns, "app=web"))
        eps = endpoint_ips(ns, "web")
        print(f"  Service web: ClusterIP {cip}, port {svc['spec']['ports'][0]['port']} -> targetPort {svc['spec']['ports'][0]['targetPort']}")
        print(f"  Pod IPs:  {pod_ips}\n  EndpointSlice: {eps}")
        check("the ClusterIP is in the Service range 10.96.0.0/12 and is the IP of no Pod", cip not in pod_ips and ipaddress.ip_address(cip) in ipaddress.ip_network("10.96.0.0/12"))
        check("the EndpointSlice holds exactly the IPs of the three Ready Pods", eps == pod_ips)
        result["service"] = {"clusterIP": cip, "podIPs": pod_ips}

        # ---- 2. DNS -----------------------------------------------------------------------------------------
        short = k("exec", "client", "-n", ns, "--", "wget", "-qO-", "http://web/")
        long_name = k("exec", "client", "-n", ns, "--", "wget", "-qO-", f"http://web.{ns}.svc.cluster.local/")
        check("the short name `web` reaches a web Pod from a Pod in the same namespace", short.startswith("web-"))
        check("the long name web.<namespace>.svc.cluster.local reaches it too", long_name.startswith("web-"))
        ns_lookup = k("exec", "client", "-n", ns, "--", "nslookup", f"web.{ns}.svc.cluster.local")
        show("nslookup web.<ns>.svc.cluster.local", ns_lookup)
        check("DNS answers with the ClusterIP", cip in ns_lookup)
        resolv = k("exec", "client", "-n", ns, "--", "cat", "/etc/resolv.conf")
        show("/etc/resolv.conf of a Pod", resolv)
        check("the search path starts with the Pod's own namespace and ndots is 5", f"search {ns}.svc.cluster.local svc.cluster.local cluster.local" in resolv and "ndots:5" in resolv)
        dns_ip = re.search(r"nameserver (\S+)", resolv).group(1)
        kube_dns = k("get", "service", "kube-dns", "-n", "kube-system", "-o", "jsonpath={.spec.clusterIP}")
        check("the DNS server a Pod uses is itself a Service (kube-dns in kube-system)", dns_ip == kube_dns)
        result["dns"] = {"server": dns_ip, "search": f"{ns}.svc.cluster.local svc.cluster.local cluster.local"}

        # ---- 3. spreading --------------------------------------------------------------------------------------
        c = hits(ns, "http://web/", 60)
        print(f"  60 requests: {dict(sorted(c.items()))}")
        check("all three Pods answered", len(c) == 3 and sum(c.values()) == 60)
        check("no Pod got all the traffic (each between 8 and 35 of 60)", all(8 <= v <= 35 for v in c.values()), str(dict(c)))
        result["spread"] = sorted(c.values())

        # ---- 4. readiness and selectors ------------------------------------------------------------------------
        sick = sorted(ready_pods(ns, "app=web"))[0]
        sick_ip = k("get", "pod", sick, "-n", ns, "-o", "jsonpath={.status.podIP}")
        k("exec", sick, "-n", ns, "--", "rm", "/tmp/ok")
        wait_for(lambda: sick_ip not in endpoint_ips(ns, "web"), 30, 0.5, "endpoint removed")
        c2 = hits(ns, "http://web/", 40)
        print(f"  {sick} not Ready: endpoints {len(endpoint_ips(ns, 'web'))}, 40 requests: {dict(sorted(c2.items()))}")
        check("a Pod that fails its readiness probe leaves the EndpointSlice", len(endpoint_ips(ns, "web")) == 2 and sick_ip not in endpoint_ips(ns, "web"))
        check("it gets no request at all, yet it is still Running (no restart)", sick not in c2 and k("get", "pod", sick, "-n", ns, "-o", "jsonpath={.status.phase}") == "Running")
        k("exec", sick, "-n", ns, "--", "touch", "/tmp/ok")
        wait_for(lambda: sick_ip in endpoint_ips(ns, "web"), 30, 0.5, "endpoint back")
        k("patch", "service", "web", "-n", ns, "-p", '{"spec":{"selector":{"app":"nobody"}}}')
        wait_for(lambda: endpoint_ips(ns, "web") == [], 30, 0.5, "empty endpoints")
        t0 = time.time()
        refused = kubectl("exec", "client", "-n", ns, "--", "wget", "-qO-", "-T", "3", "http://web/", check=False)
        print(f"  selector app=nobody: endpoints [], request fails after {time.time() - t0:.1f}s: {(refused.stderr or refused.stdout).strip().splitlines()[0]}")
        check("a selector that matches no Pod leaves the Service with no endpoints, and the request fails", refused.returncode != 0 and endpoint_ips(ns, "web") == [])
        k("patch", "service", "web", "-n", ns, "-p", '{"spec":{"selector":{"app":"web"}}}')
        wait_for(lambda: len(endpoint_ips(ns, "web")) == 3, 30, 0.5, "endpoints back")

        # ---- 5. kube-proxy rules ----------------------------------------------------------------------------------
        mode = k("get", "configmap", "kube-proxy", "-n", "kube-system", "-o", "jsonpath={.data.config\\.conf}")
        proxy_mode = re.search(r"mode:\s*(\S*)", mode).group(1) or "iptables (default)"
        print(f"  kube-proxy mode: {proxy_mode}")
        rules = node_sh("garden-m02", f"iptables-save -t nat | grep -E 'default|{ns}' | grep -E '{cip}|KUBE-SVC|KUBE-SEP' | grep -E '{ns}/web' ")
        svc_rules = [r for r in rules.splitlines() if "KUBE-SVC" in r or "KUBE-SEP" in r or cip in r]
        show("iptables nat rules for Service web (node garden-m02)", "\n".join(r[:150] for r in svc_rules))
        check("a rule sends traffic for the ClusterIP to the chain of the Service", any(cip in r and "KUBE-SVC" in r for r in svc_rules))
        check("the Service chain has one rule per Pod, with probabilities 0.33333 and 0.5 and a last rule without one", sum("statistic" in r for r in svc_rules) == 2 and any("0.33333" in r for r in svc_rules) and any("0.50000" in r for r in svc_rules))
        check("each Pod has a chain that does DNAT to its IP and port 8080", all(any(f"--to-destination {ip}:8080" in r for r in svc_rules) for ip in pod_ips))
        result["iptables"] = {"mode": proxy_mode, "rules": len(svc_rules)}

        # ---- 6. NodePort and headless ------------------------------------------------------------------------------
        k("patch", "service", "web", "-n", ns, "-p", '{"spec":{"type":"NodePort"}}')
        port = k("get", "service", "web", "-n", ns, "-o", "jsonpath={.spec.ports[0].nodePort}")
        node_ips = {n["metadata"]["name"]: [a["address"] for a in n["status"]["addresses"] if a["type"] == "InternalIP"][0] for n in kj("get", "nodes")["items"]}
        answers = {}
        for n, ip in node_ips.items():
            answers[n] = node_sh("garden", f"curl -s -m 3 http://{ip}:{port}/ || echo FAIL")
        show(f"curl http://<node ip>:{port}/ from the control plane node", "\n".join(f"{n:11} {ip}  ->  {answers[n]}" for n, ip in node_ips.items()))
        no_pod_nodes = [n for n in node_ips if n not in {p["spec"]["nodeName"] for p in pods(ns, "app=web")}]
        check("every node answers on the NodePort", all(a.startswith("web-") for a in answers.values()))
        check("including a node that runs no web Pod (kube-proxy forwards)", bool(no_pod_nodes) and all(answers[n].startswith("web-") for n in no_pod_nodes), str(no_pod_nodes))
        check("the NodePort is in the range 30000 to 32767", 30000 <= int(port) <= 32767)
        apply(f"apiVersion: v1\nkind: Service\nmetadata: {{name: web-headless}}\nspec:\n  clusterIP: None\n  selector: {{app: web}}\n  ports: [{{port: 80, targetPort: 8080}}]\n", "-n", ns)
        time.sleep(2)
        look = k("exec", "client", "-n", ns, "--", "nslookup", f"web-headless.{ns}.svc.cluster.local")
        addrs = sorted(set(re.findall(r"Address: (10\.244\.\S+)", look)))
        show("nslookup of a headless Service", look)
        check("a headless Service has no ClusterIP: DNS returns the three Pod IPs", addrs == pod_ips, str(addrs))
        result["nodePort"] = int(port)

    if WRITE:
        write_json(LABS / "services.json", result)


main_guard(main)
