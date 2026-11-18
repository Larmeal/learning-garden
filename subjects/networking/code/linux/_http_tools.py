"""HTTP/1.1, HTTP/2 (h2, in the clear, 'prior knowledge') and QUIC programs for exercise 12. Needs vendor/ (h2, aioquic): see exercises/12_http.py.

  h1_server PORT DELAY_MS BODY          HTTP/1.1 server, keep-alive, answers after DELAY_MS with BODY bytes (threads)
  h1_client HOST PORT N MODE            MODE new (a new connection per request, one after another), reuse (one connection, one after another), parallel (N connections at once)
  h2_server PORT DELAY_MS BODY          HTTP/2 server: every request is answered after DELAY_MS, the bodies of concurrent streams are sent round robin in chunks of 16 KB
  h2_client HOST PORT N                 one connection, N requests at once, prints when each stream finished
  quic_server PORT CERT KEY DELAY_MS BODY   the same over QUIC (one request per stream), with the TLS certificate of exercise 11
  quic_client HOST PORT CA N            N streams at once over one QUIC connection
All print one line of JSON (times in ms since the first request was sent).
"""
import asyncio
import http.client
import json
import os
import socket
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "vendor"))
mode = sys.argv[1]
CH = 16384


def h1_server(port, delay, body):
    payload = b"x" * body

    class H(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def do_GET(self):
            time.sleep(delay / 1000)
            self.send_response(200)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *a):
            pass

    class S(ThreadingHTTPServer):
        daemon_threads = True

        def server_bind(self):
            self.socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            super().server_bind()

    print("listening", flush=True)
    S(("0.0.0.0", port), H).serve_forever()


def h1_client(host, port, n, how):
    t0 = time.perf_counter()
    done = []

    def get(conn, i):
        conn.request("GET", "/r%d" % i)
        conn.getresponse().read()
        done.append(round((time.perf_counter() - t0) * 1000))

    if how == "new":
        for i in range(n):
            c = http.client.HTTPConnection(host, port)
            get(c, i)
            c.close()
    elif how == "reuse":
        c = http.client.HTTPConnection(host, port)
        for i in range(n):
            get(c, i)
    else:
        th = []
        for i in range(n):
            c = http.client.HTTPConnection(host, port)
            th.append(threading.Thread(target=get, args=(c, i)))
        for x in th:
            x.start()
        for x in th:
            x.join()
    print(json.dumps({"done": sorted(done), "total": max(done)}))


def h2_server(port, delay, body):
    import h2.config
    import h2.connection
    import h2.events

    class P(asyncio.Protocol):
        def connection_made(self, tr):
            self.tr = tr
            self.conn = h2.connection.H2Connection(config=h2.config.H2Configuration(client_side=False))
            self.conn.initiate_connection()
            self.tr.write(self.conn.data_to_send())
            self.pending = {}   # stream id -> bytes left
            self.sending = False

        def data_received(self, data):
            for ev in self.conn.receive_data(data):
                if isinstance(ev, h2.events.RequestReceived):
                    asyncio.get_event_loop().call_later(delay / 1000, self.start, ev.stream_id)
                elif isinstance(ev, h2.events.WindowUpdated):
                    self.pump()
            self.tr.write(self.conn.data_to_send())

        def start(self, sid):
            self.conn.send_headers(sid, [(":status", "200"), ("content-length", str(body))])
            self.pending[sid] = body
            self.pump()

        def pump(self):
            # round robin, one chunk of every open stream per turn of the event loop, so that concurrent streams really are interleaved
            for sid in list(self.pending):
                room = min(CH, self.pending[sid], self.conn.local_flow_control_window(sid), self.conn.max_outbound_frame_size)
                if room <= 0:
                    continue
                left = self.pending[sid] - room
                self.conn.send_data(sid, b"x" * room, end_stream=(left == 0))
                if left == 0:
                    del self.pending[sid]
                else:
                    self.pending[sid] = left
            self.tr.write(self.conn.data_to_send())
            if self.pending:
                asyncio.get_event_loop().call_later(0.0005, self.pump)

    async def main():
        loop = asyncio.get_running_loop()
        srv = await loop.create_server(P, "0.0.0.0", port)
        print("listening", flush=True)
        await srv.serve_forever()

    asyncio.run(main())


def h2_client(host, port, n):
    import h2.config
    import h2.connection
    import h2.events
    import h2.settings

    s = socket.create_connection((host, port))
    s.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    conn = h2.connection.H2Connection(config=h2.config.H2Configuration(client_side=True))
    conn.initiate_connection()
    conn.update_settings({h2.settings.SettingCodes.INITIAL_WINDOW_SIZE: 1 << 24})
    conn.increment_flow_control_window((1 << 24) - 65535)
    s.sendall(conn.data_to_send())
    t0 = time.perf_counter()
    sids = []
    for i in range(n):
        sid = conn.get_next_available_stream_id()
        conn.send_headers(sid, [(":method", "GET"), (":path", "/r%d" % i), (":scheme", "http"), (":authority", "garden.test")], end_stream=True)
        sids.append(sid)
    s.sendall(conn.data_to_send())
    done, first, got, log = {}, {}, {sid: 0 for sid in sids}, []
    while len(done) < n:
        data = s.recv(65535)
        if not data:
            break
        for ev in conn.receive_data(data):
            if isinstance(ev, h2.events.DataReceived):
                got[ev.stream_id] += len(ev.data)
                log.append([round((time.perf_counter() - t0) * 1000, 1), ev.stream_id, got[ev.stream_id]])
                first.setdefault(ev.stream_id, round((time.perf_counter() - t0) * 1000))
                conn.acknowledge_received_data(ev.flow_controlled_length, ev.stream_id)
            elif isinstance(ev, h2.events.StreamEnded):
                done[ev.stream_id] = round((time.perf_counter() - t0) * 1000)
        out = conn.data_to_send()
        if out:
            s.sendall(out)
    print(json.dumps({"streams": [{"id": sid, "first": first.get(sid), "done": done.get(sid), "bytes": got[sid]} for sid in sids], "total": max(done.values()), "log": log}))


def quic_server(port, cert, key, delay, body):
    from aioquic.asyncio import QuicConnectionProtocol, serve
    from aioquic.quic.configuration import QuicConfiguration
    from aioquic.quic.events import StreamDataReceived

    class P(QuicConnectionProtocol):
        def __init__(self, *a, **k):
            super().__init__(*a, **k)
            self.pending = {}

        def quic_event_received(self, ev):
            if isinstance(ev, StreamDataReceived) and ev.end_stream:
                asyncio.get_event_loop().call_later(delay / 1000, self.start, ev.stream_id)

        def start(self, sid):
            self.pending[sid] = body
            self.pump()

        def pump(self):
            for sid in list(self.pending):
                n = min(CH, self.pending[sid])
                left = self.pending[sid] - n
                self._quic.send_stream_data(sid, b"x" * n, end_stream=(left == 0))
                if left == 0:
                    del self.pending[sid]
                else:
                    self.pending[sid] = left
            self.transmit()
            if self.pending:
                asyncio.get_event_loop().call_later(0.0005, self.pump)

    async def main():
        cfg = QuicConfiguration(is_client=False, alpn_protocols=["hq-interop"])
        cfg.load_cert_chain(cert, key)
        await serve("0.0.0.0", port, configuration=cfg, create_protocol=P)
        print("listening", flush=True)
        await asyncio.Future()

    asyncio.run(main())


def quic_client(host, port, ca, n):
    from aioquic.asyncio import QuicConnectionProtocol, connect
    from aioquic.quic.configuration import QuicConfiguration
    from aioquic.quic.events import StreamDataReceived

    class C(QuicConnectionProtocol):
        def __init__(self, *a, **k):
            super().__init__(*a, **k)
            self.done, self.first, self.got, self.log = {}, {}, {}, []
            self.t0 = time.perf_counter()
            self.all = asyncio.Event()
            self.n = n

        def quic_event_received(self, ev):
            if isinstance(ev, StreamDataReceived):
                self.got[ev.stream_id] = self.got.get(ev.stream_id, 0) + len(ev.data)
                self.log.append([round((time.perf_counter() - self.t0) * 1000, 1), ev.stream_id, self.got[ev.stream_id]])
                self.first.setdefault(ev.stream_id, round((time.perf_counter() - self.t0) * 1000))
                if ev.end_stream:
                    self.done[ev.stream_id] = round((time.perf_counter() - self.t0) * 1000)
                    if len(self.done) >= self.n:
                        self.all.set()

    async def main():
        cfg = QuicConfiguration(is_client=True, alpn_protocols=["hq-interop"], cafile=ca, server_name="garden.test")
        t_start = time.perf_counter()
        async with connect(host, port, configuration=cfg, create_protocol=C) as c:
            t_connect = round((time.perf_counter() - t_start) * 1000)
            c.t0 = time.perf_counter()
            sids = []
            for i in range(n):
                sid = c._quic.get_next_available_stream_id()
                c._quic.send_stream_data(sid, b"GET /r%d" % i + bytes([13, 10]), end_stream=True)
                sids.append(sid)
            c.transmit()
            await asyncio.wait_for(c.all.wait(), 30)
            first_abs = min(c.first.values()) + t_connect
            print(json.dumps({"t_connect": t_connect, "first_abs": first_abs, "streams": [{"id": sid, "first": c.first.get(sid), "done": c.done.get(sid), "bytes": c.got.get(sid)} for sid in sids]}))

    asyncio.run(main())


if mode == "h1_server":
    h1_server(int(sys.argv[2]), float(sys.argv[3]), int(sys.argv[4]))
elif mode == "h1_client":
    h1_client(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5])
elif mode == "h2_server":
    h2_server(int(sys.argv[2]), float(sys.argv[3]), int(sys.argv[4]))
elif mode == "h2_client":
    h2_client(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))
elif mode == "quic_server":
    quic_server(int(sys.argv[2]), sys.argv[3], sys.argv[4], float(sys.argv[5]), int(sys.argv[6]))
elif mode == "quic_client":
    quic_client(sys.argv[2], int(sys.argv[3]), sys.argv[4], int(sys.argv[5]))
