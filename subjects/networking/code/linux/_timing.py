"""Programs for exercise 14 (standard library only).

  serve PORT THINK_MS SIZE     answers every request with HTTP/1.1 200 after THINK_MS milliseconds of 'work', with a body of SIZE bytes, then closes
  get HOST PORT N              makes N requests, one connection each, and prints a JSON list: for each, the time (ms) until connect() returned, until the first byte of the answer, and until
                               the end of the body, all measured from the moment before connect() was called
"""
import json
import socket
import sys
import threading
import time

mode = sys.argv[1]


def serve(port, think_ms, size):
    body = b"x" * size
    head = b"HTTP/1.1 200 OK\r\nContent-Length: %d\r\nConnection: close\r\n\r\n" % size

    def one(c):
        try:
            c.recv(4096)
            time.sleep(think_ms / 1000.0)
            c.sendall(head + body)
        finally:
            c.close()

    srv = socket.socket()
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("0.0.0.0", port))
    srv.listen(16)
    print("listening", flush=True)
    while True:
        c, _ = srv.accept()
        threading.Thread(target=one, args=(c,), daemon=True).start()


def get(host, port, n):
    out = []
    for _ in range(n):
        s = socket.socket()
        s.settimeout(10)
        s.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        t0 = time.perf_counter()
        s.connect((host, port))
        t1 = time.perf_counter()
        s.sendall(b"GET / HTTP/1.1\r\nHost: garden.test\r\n\r\n")
        first = s.recv(65536)
        t2 = time.perf_counter()
        data = first
        while b"\r\n\r\n" not in data:
            data += s.recv(65536)
        head, _, rest = data.partition(b"\r\n\r\n")
        ln = int([l for l in head.split(b"\r\n") if l.lower().startswith(b"content-length")][0].split(b":")[1])
        while len(rest) < ln:
            rest += s.recv(65536)
        t3 = time.perf_counter()
        s.close()
        out.append({"connect": round((t1 - t0) * 1000, 1), "first_byte": round((t2 - t0) * 1000, 1), "total": round((t3 - t0) * 1000, 1)})
        time.sleep(0.05)
    print(json.dumps(out), flush=True)


if mode == "serve":
    serve(int(sys.argv[2]), float(sys.argv[3]), int(sys.argv[4]))
elif mode == "get":
    get(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))
