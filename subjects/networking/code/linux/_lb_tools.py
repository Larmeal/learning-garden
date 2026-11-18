"""Programs for exercise 13 (standard library only).

  backend NAME PORT                 HTTP/1.1 server with keep-alive. Every answer is JSON: which backend answered, the address of its peer, and the X-Forwarded-For header it got
  client HOST PORT N MODE [SECS]    MODE new (a new connection per request) or same (one connection for all N). Prints what every request got: the backend name, or the error
  proxy PORT BACKEND [BACKEND ...]  a small layer-7 reverse proxy: reads each request on the client's connection, picks a backend round robin (one request at a time, retrying the next one
                                    when a backend refuses the connection), adds X-Forwarded-For and forwards the answer. BACKEND is HOST:PORT
"""
import asyncio
import errno
import json
import socket
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

mode = sys.argv[1]


def backend(name, port):
    class H(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def do_GET(self):
            body = json.dumps({"backend": name, "peer": self.client_address[0], "xff": self.headers.get("X-Forwarded-For")}).encode()
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *a):
            pass

    class S(ThreadingHTTPServer):
        daemon_threads = True

    print("listening", flush=True)
    S(("0.0.0.0", port), H).serve_forever()


def read_response(sock):
    data = b""
    while b"\r\n\r\n" not in data:
        d = sock.recv(4096)
        if not d:
            raise ConnectionError("closed")
        data += d
    head, _, rest = data.partition(b"\r\n\r\n")
    ln = int([l for l in head.split(b"\r\n") if l.lower().startswith(b"content-length")][0].split(b":")[1])
    while len(rest) < ln:
        rest += sock.recv(4096)
    return json.loads(rest[:ln])


def client(host, port, n, how, secs):
    res = []
    conn = None
    for i in range(n):
        try:
            if how == "new" or conn is None:
                if conn:
                    conn.close()
                conn = socket.socket()
                conn.settimeout(secs)
                conn.connect((host, port))
            conn.sendall(b"GET /%d HTTP/1.1\r\nHost: garden.test\r\n\r\n" % i)
            r = read_response(conn)
            res.append(r["backend"])
        except socket.timeout:
            res.append("timeout")
            conn = None
        except OSError as e:
            res.append(errno.errorcode.get(e.errno, "error"))
            conn = None
        except ConnectionError:
            res.append("closed")
            conn = None
    print(json.dumps(res), flush=True)


def proxy(port, backends):
    rr = [0]

    async def handle(reader, writer):
        peer = writer.get_extra_info("peername")[0]
        try:
            while True:
                head = await reader.readuntil(b"\r\n\r\n")
                lines = head.rstrip(b"\r\n").split(b"\r\n")
                lines.insert(1, b"X-Forwarded-For: " + peer.encode())
                req = b"\r\n".join(lines) + b"\r\n\r\n"
                answer = None
                for k in range(len(backends)):
                    host, p = backends[(rr[0] + k) % len(backends)].split(":")
                    try:
                        br, bw = await asyncio.wait_for(asyncio.open_connection(host, int(p)), 1.0)
                    except (OSError, asyncio.TimeoutError):
                        continue
                    bw.write(req)
                    await bw.drain()
                    h = await br.readuntil(b"\r\n\r\n")
                    ln = int([x for x in h.split(b"\r\n") if x.lower().startswith(b"content-length")][0].split(b":")[1])
                    body = await br.readexactly(ln)
                    answer = h + body
                    bw.close()
                    rr[0] += k + 1
                    break
                if answer is None:
                    answer = b"HTTP/1.1 502 Bad Gateway\r\nContent-Length: 2\r\n\r\n{}"
                writer.write(answer)
                await writer.drain()
        except (asyncio.IncompleteReadError, ConnectionError):
            pass
        finally:
            writer.close()

    async def main():
        srv = await asyncio.start_server(handle, "0.0.0.0", port)
        print("listening", flush=True)
        await srv.serve_forever()

    asyncio.run(main())


if mode == "backend":
    backend(sys.argv[2], int(sys.argv[3]))
elif mode == "client":
    client(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5], float(sys.argv[6]) if len(sys.argv) > 6 else 3.0)
elif mode == "proxy":
    proxy(int(sys.argv[2]), sys.argv[3:])
