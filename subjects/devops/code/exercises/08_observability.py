"""Lesson 8: observability, three views of the same sixty requests.

A gateway calls an inventory service over HTTP. Both write one JSON log line per request, count requests and time them in a
`/metrics` page in the Prometheus text format, and pass a trace id from the first service to the second. Sixty requests are
sent (40 fast, 15 slow, 5 that fail). Asserts what each view can and cannot tell: the metrics say how many failed and how
slow the slow ones were but not which request; the logs name the requests; the trace id ties the two services together.
A real Prometheus (Docker image prom/prometheus) scrapes both services and answers with the same counters.
"""

import json
import random
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import itertools
from collections import defaultdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from devlab import check, docker, docker_ok, fresh, run, save_json, show, wait_until, write  # noqa: E402

NL = chr(10)
_ids = itertools.count(1)
BUCKETS = [0.025, 0.05, 0.1, 0.25]


class Service:
    """An HTTP service with a log, a request counter and a duration histogram."""

    def __init__(self, name: str, work):
        self.name = name
        self.logs: list[dict] = []
        self.count: dict[tuple[str, str], int] = defaultdict(int)
        self.hist: dict[str, list[int]] = defaultdict(lambda: [0] * (len(BUCKETS) + 1))
        self.sum: dict[str, float] = defaultdict(float)
        self.lock = threading.Lock()
        self.work = work
        service = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path == "/metrics":
                    body = service.render().encode()
                    self.send_response(200)
                    self.send_header("Content-Type", "text/plain; version=0.0.4")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                    return
                started = time.perf_counter()
                path = urllib.parse.urlparse(self.path).path
                trace_id = self.headers.get("X-Trace-Id") or f"t{next(_ids):04d}"
                parent = self.headers.get("X-Parent-Span")
                span = f"{service.name[0]}{trace_id[1:]}"
                status, body = service.work(self.path, trace_id, span)
                seconds = time.perf_counter() - started
                service.record(path, status, seconds, trace_id, span, parent)
                data = body.encode()
                self.send_response(status)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(("0.0.0.0", 0), Handler)
        self.port = self.server.server_address[1]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def record(self, path, status, seconds, trace_id, span, parent):
        with self.lock:
            self.logs.append({"service": self.name, "trace_id": trace_id, "span_id": span, "parent_id": parent, "path": path, "status": status, "ms": round(seconds * 1000, 1)})
            self.count[(path, str(status))] += 1
            counts = self.hist[path]
            for i, bound in enumerate(BUCKETS):
                if seconds <= bound:
                    counts[i] += 1
            counts[-1] += 1
            self.sum[path] += seconds

    def render(self) -> str:
        with self.lock:
            lines = ["# TYPE http_requests_total counter"]
            for (path, status), n in sorted(self.count.items()):
                lines.append(f'http_requests_total{{service="{self.name}",path="{path}",status="{status}"}} {n}')
            lines.append("# TYPE http_request_duration_seconds histogram")
            for path, counts in sorted(self.hist.items()):
                for bound, n in zip(BUCKETS, counts):
                    lines.append(f'http_request_duration_seconds_bucket{{service="{self.name}",path="{path}",le="{bound}"}} {n}')
                lines.append(f'http_request_duration_seconds_bucket{{service="{self.name}",path="{path}",le="+Inf"}} {counts[-1]}')
                lines.append(f'http_request_duration_seconds_sum{{service="{self.name}",path="{path}"}} {self.sum[path]:.6f}')
                lines.append(f'http_request_duration_seconds_count{{service="{self.name}",path="{path}"}} {counts[-1]}')
            return NL.join(lines) + NL

    def stop(self):
        self.server.shutdown()


def inventory_work(path, trace_id, span):
    item = urllib.parse.parse_qs(urllib.parse.urlparse(path).query).get("item", [""])[0]
    if item == "slow":
        time.sleep(0.15)
    if item == "bad":
        return 500, "out of stock database error"
    return 200, "in stock"


inventory = Service("inventory", inventory_work)


def gateway_work(path, trace_id, span):
    query = urllib.parse.urlparse(path).query
    request = urllib.request.Request(f"http://127.0.0.1:{inventory.port}/stock?{query}", headers={"X-Trace-Id": trace_id, "X-Parent-Span": span})
    try:
        with urllib.request.urlopen(request) as response:
            return 200, response.read().decode()
    except urllib.error.HTTPError as err:
        return 500, err.read().decode()


gateway = Service("gateway", gateway_work)

try:
    # ---- 1. send sixty requests, in a fixed (seeded) order ----
    items = ["apple"] * 40 + ["slow"] * 15 + ["bad"] * 5
    random.Random(3).shuffle(items)
    for i, item in enumerate(items):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{gateway.port}/order?item={item}&n={i}").read()
        except urllib.error.HTTPError:
            pass
    check("the gateway logged sixty requests and the inventory sixty", len(gateway.logs) == 60 and len(inventory.logs) == 60)

    # ---- 2. metrics: counts and durations, no names ----
    text = urllib.request.urlopen(f"http://127.0.0.1:{gateway.port}/metrics").read().decode()
    show("curl gateway:port/metrics (first lines)", NL.join(text.splitlines()[:6]))
    check("http_requests_total counts 55 answers with status 200 and 5 with status 500", gateway.count[("/order", "200")] == 55 and gateway.count[("/order", "500")] == 5)
    check("the text format has a TYPE line and one sample per label set", "# TYPE http_requests_total counter" in text and 'status="500"} 5' in text)
    h = gateway.hist["/order"]
    check("histogram buckets are cumulative and +Inf equals the count", h == sorted(h) and h[-1] == 60, str(h))
    fast_or_equal_100ms = h[BUCKETS.index(0.1)]
    check("the 15 slow requests (150 ms each) are all above the 0.1 bucket", 40 <= fast_or_equal_100ms <= 45, str(h))
    p95_bucket = next(b for b, n in zip(BUCKETS, h) if n >= 0.95 * 60)
    show("the 95th percentile by bucket", f"smallest bucket that holds 95 percent of the requests: le={p95_bucket}")
    check("the 95th percentile falls in the 0.25 bucket, because a quarter of the requests are slow", p95_bucket == 0.25, str(p95_bucket))
    mean = gateway.sum["/order"] / 60
    print(f"  average duration {mean * 1000:.0f} ms (sum divided by count), while 15 of 60 requests took 150 ms or more")
    check("the average (sum divided by count) sits far below what the slow quarter felt", mean < 0.06, f"{mean:.3f}")

    # ---- 3. logs: the names of the requests ----
    failed = [r for r in gateway.logs if r["status"] == 500]
    check("the logs name exactly five failed requests, each with a trace id", len(failed) == 5 and all(r["trace_id"] for r in failed))
    show("one failed request, from the gateway log", json.dumps(failed[0]))

    # ---- 4. a trace: one id in both services, with parent and child ----
    trace = failed[0]["trace_id"]
    spans = [r for r in gateway.logs + inventory.logs if r["trace_id"] == trace]
    show(f"all log lines with trace_id {trace}", NL.join(f"{s['service']:10} span={s['span_id']} parent={s['parent_id']} status={s['status']} {s['ms']} ms" for s in spans))
    check("the trace id appears in both services, once each", sorted(s["service"] for s in spans) == ["gateway", "inventory"])
    child = next(s for s in spans if s["service"] == "inventory")
    root = next(s for s in spans if s["service"] == "gateway")
    check("the inventory span names the gateway span as its parent", child["parent_id"] == root["span_id"])
    check("the child took less time than the parent that waited for it", child["ms"] <= root["ms"])
    check("the error started in the inventory (its own status is 500 too)", child["status"] == 500)

    if "--write" in sys.argv:
        samples = {}
        for kind in ("apple", "slow", "bad"):
            idx = items.index(kind)
            g = gateway.logs[idx]
            i_log = next(r for r in inventory.logs if r["trace_id"] == g["trace_id"])
            samples[kind] = {"index": idx, "gateway": g, "inventory": i_log}
        save_json("observe.json", {
            "items": items, "buckets": BUCKETS, "histogram": h, "counts": {"200": gateway.count[("/order", "200")], "500": gateway.count[("/order", "500")]},
            "meanMs": round(mean * 1000), "samples": samples,
        })
    # ---- 5. a real Prometheus scrapes both services ----
    if not docker_ok():
        print("  Docker is not running: the Prometheus part is skipped")
    else:
        work = fresh("08_prometheus")
        write(work, "prometheus.yml", NL.join([
            "global:", "  scrape_interval: 1s",
            "scrape_configs:",
            "  - job_name: shop",
            "    static_configs:",
            f"      - targets: ['host.docker.internal:{gateway.port}', 'host.docker.internal:{inventory.port}']",
        ]) + NL)
        prom_port = 9099
        run(["docker", "rm", "-f", "devops08-prom"])
        docker("run", "-d", "--name", "devops08-prom", "--add-host", "host.docker.internal:host-gateway", "-p", f"127.0.0.1:{prom_port}:9090", "-v", f"{(work / 'prometheus.yml').as_posix()}:/etc/prometheus/prometheus.yml:ro", "prom/prometheus:v3.5.0")

        def query(q: str) -> float:
            url = f"http://127.0.0.1:{prom_port}/api/v1/query?" + urllib.parse.urlencode({"query": q})
            data = json.loads(urllib.request.urlopen(url).read())
            return float(data["data"]["result"][0]["value"][1])

        try:
            ok = wait_until(lambda: query('sum(http_requests_total{service="gateway",status="500"})') == 5, timeout=40, step=1)
            check("Prometheus scraped the gateway and counts 5 requests with status 500", ok)
            check("sum of all gateway requests is 60 in Prometheus too", query('sum(http_requests_total{service="gateway"})') == 60)
            check("it scraped both services", query("count(up == 1)") == 2)
            check("histogram_quantile gives a 95th percentile above 0.1 s", query('histogram_quantile(0.95, sum(http_request_duration_seconds_bucket{service="gateway"}) by (le))') > 0.1)
        finally:
            run(["docker", "rm", "-f", "devops08-prom"])
finally:
    gateway.stop()
    inventory.stop()
print("ok")
