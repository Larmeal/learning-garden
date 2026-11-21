"""Lesson 7, second part (Ingress): one entry point that routes by host name and path to Services.

Needs the minikube `ingress` addon (ingress-nginx v1.11.2), which the setup of this subject enables; its Pods are pinned to the control plane node.
Asserts what the lesson prints:
  1. an Ingress is only a set of rules: without a controller nothing listens; the controller is an ordinary Pod that runs nginx
  2. host based routing and path based routing reach different Services; an unknown host gets the default 404 of the controller
  3. the rules end up as nginx configuration inside the controller Pod (read from /etc/nginx/nginx.conf)
  4. a Service with no ready Pod behind it gives 503 from the controller
  5. `pathType: Prefix` matches whole path segments (/api matches /api/x but not /apix)
Run: python exercises/07b_ingress.py [--write]   (--write saves labs/kubernetes/ingress.json for the Ingress lab)
"""

import sys

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
from klab import *  # noqa: E402,F403

WRITE = "--write" in sys.argv


def backend(name: str) -> str:
    return f"""apiVersion: apps/v1
kind: Deployment
metadata: {{name: {name}}}
spec:
  replicas: 1
  selector: {{matchLabels: {{app: {name}}}}}
  template:
    metadata: {{labels: {{app: {name}}}}}
    spec:
      terminationGracePeriodSeconds: 1
      containers:
      - name: c
        image: {BUSYBOX}
        command: ["sh", "-c", "mkdir -p /www/api/x; echo {name} > /www/index.html; echo {name}-x > /www/api/x/index.html; exec httpd -f -p 8080 -h /www"]
        readinessProbe: {{httpGet: {{path: /, port: 8080}}, periodSeconds: 1}}
---
apiVersion: v1
kind: Service
metadata: {{name: {name}}}
spec:
  selector: {{app: {name}}}
  ports: [{{port: 80, targetPort: 8080}}]
"""


def main() -> None:
    result: dict = {}
    ctrl = kj("get", "pods", "-n", "ingress-nginx", "-l", "app.kubernetes.io/component=controller")["items"]
    check("the ingress-nginx controller is an ordinary Pod and it is Running", len(ctrl) == 1 and ctrl[0]["status"]["phase"] == "Running")
    cp_ip = [a["address"] for a in kj("get", "node", "garden")["status"]["addresses"] if a["type"] == "InternalIP"][0]
    ctrl_name = ctrl[0]["metadata"]["name"]
    print(f"  controller Pod {ctrl_name} on {ctrl[0]['spec']['nodeName']}, hostPort 80 on {cp_ip}")

    def get(host: str, path: str) -> tuple[str, str]:
        out = node_sh("garden", f"curl -s -m 5 -o /tmp/body -w '%{{http_code}}' -H 'Host: {host}' http://{cp_ip}{path}; echo; cat /tmp/body | head -c 120", check=False)
        code, _, body = out.partition("\n")
        return code.strip(), body.strip().replace("\n", " ")

    with namespace("ingress") as ns:
        for n in ("shop", "blog", "api"):
            apply(backend(n), "-n", ns)
        wait_for(lambda: all(len(ready_pods(ns, f"app={n}")) == 1 for n in ("shop", "blog", "api")), 90, 1, "backends")

        # ---- 1. no rules yet -------------------------------------------------------------------------------
        code, body = get("shop.test", "/")
        print(f"  before any Ingress: GET http://shop.test/ -> {code} {body[:40]!r}")
        check("with no Ingress the controller answers 404 to every host", code == "404")

        # ---- 2. host and path rules -----------------------------------------------------------------------
        apply(f"""apiVersion: networking.k8s.io/v1
kind: Ingress
metadata: {{name: site}}
spec:
  ingressClassName: nginx
  rules:
  - host: shop.test
    http:
      paths:
      - {{path: /, pathType: Prefix, backend: {{service: {{name: shop, port: {{number: 80}}}}}}}}
      - {{path: /api, pathType: Prefix, backend: {{service: {{name: api, port: {{number: 80}}}}}}}}
  - host: blog.test
    http:
      paths:
      - {{path: /, pathType: Prefix, backend: {{service: {{name: blog, port: {{number: 80}}}}}}}}
""", "-n", ns)
        wait_for(lambda: get("shop.test", "/")[0] == "200", 60, 1, "ingress active")
        rows = []
        for host, path in (("shop.test", "/"), ("shop.test", "/api/x/"), ("shop.test", "/apix"), ("blog.test", "/"), ("blog.test", "/api/x/"), ("other.test", "/")):
            c, b = get(host, path)
            rows.append([host, path, c, b[:20]])
        show("curl -H 'Host: <host>' http://<controller>/<path>", table(rows, ["host", "path", "code", "body"]))
        got = {(r[0], r[1]): (r[2], r[3]) for r in rows}
        check("shop.test / goes to the shop Service", got[("shop.test", "/")] == ("200", "shop"))
        check("shop.test /api/x/ goes to the api Service (the longest matching path wins)", got[("shop.test", "/api/x/")] == ("200", "api-x"))
        check("pathType Prefix matches whole segments: /apix is not under /api, so it goes to the shop Service, which has no such file (a 404 in capital letters from httpd, not the controller's own)", got[("shop.test", "/apix")][0] == "404" and got[("shop.test", "/apix")][1].startswith("<HTML>"))
        check("the controller does not strip the prefix: the api Pod received the whole path /api/x/", got[("shop.test", "/api/x/")][1] == "api-x")
        check("blog.test goes to blog, and blog has no /api rule so /api/x/ stays in blog", got[("blog.test", "/")] == ("200", "blog") and got[("blog.test", "/api/x/")] == ("200", "blog-x"))
        check("a host with no rule gets the default 404 of the controller", got[("other.test", "/")][0] == "404")
        result["routes"] = [{"host": r[0], "path": r[1], "code": r[2], "body": r[3]} for r in rows]

        # ---- 3. the rules become nginx.conf ---------------------------------------------------------------
        conf = k("exec", "-n", "ingress-nginx", ctrl_name, "--", "sh", "-c", "cat /etc/nginx/nginx.conf")
        servers = [line.strip() for line in conf.splitlines() if "server_name shop.test" in line or "server_name blog.test" in line]
        upstreams = sorted({line.strip() for line in conf.splitlines() if line.strip().startswith("set $proxy_upstream_name") and f'"{ns}-' in line})
        show("lines of /etc/nginx/nginx.conf inside the controller Pod", "\n".join(servers + upstreams))
        check("the controller wrote a server block for each host", len(servers) == 2)
        check("and a location that names each of the three Services it routes to (set $proxy_upstream_name)", len(upstreams) == 3, str(upstreams))
        result["nginx"] = {"servers": len(servers), "upstreams": len(upstreams)}

        # ---- 4. backend with no ready Pod -----------------------------------------------------------------
        k("scale", "deployment/blog", "--replicas=0", "-n", ns)
        wait_for(lambda: get("blog.test", "/")[0] == "503", 60, 1, "503")
        code, _ = get("blog.test", "/")
        print(f"  blog scaled to 0 Pods: GET blog.test/ -> {code}")
        check("a Service with no ready Pod behind it gives 503 (the rule is fine, the backend is gone)", code == "503")
        check("the other host is not affected", get("shop.test", "/")[0] == "200")
        result["noBackend"] = code

    if WRITE:
        write_json(LABS / "ingress.json", result)


main_guard(main)
