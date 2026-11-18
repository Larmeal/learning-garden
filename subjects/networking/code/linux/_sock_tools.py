"""Socket programs for exercise 10, one file, chosen by the first argument. Everything prints one line of JSON. Standard library only.

  stream_server PORT          accept one connection, wait 0.6 s, recv(100) until EOF, print the size of every recv
  stream_client HOST PORT     connect, send 'aaaaa' 'bbbbb' 'ccccc' with 1 ms between them, wait 1 s, close
  small_recv PORT             accept one connection, recv(4) until EOF, print the sizes
  backlog_server PORT N SECS  listen(N), never accept, sleep SECS
  connect_n HOST PORT N SECS  open N connections one after another (each with a timeout of SECS), keep them open, print result and seconds of each
  hold_server PORT SECS       accept in a loop and hold every connection for SECS
  ports HOST PORT N           connect N times without binding, print the local port of each, or the error
  reuse FLAG                  bind a port, take a connection, close the accepted side first, close the listener, bind again with (FLAG 1) or without (FLAG 0) SO_REUSEADDR
"""
import errno
import json
import socket
import sys
import time

mode = sys.argv[1]
out = {}

if mode == "stream_server":
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("0.0.0.0", int(sys.argv[2])))
    s.listen(4)
    print("listening", flush=True)
    c, _ = s.accept()
    time.sleep(0.6)
    sizes, chunks = [], []
    while True:
        d = c.recv(100)
        if not d:
            break
        sizes.append(len(d))
        chunks.append(d.decode())
    out = {"sizes": sizes, "chunks": chunks}
elif mode == "stream_client":
    c = socket.socket()
    c.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    c.connect((sys.argv[2], int(sys.argv[3])))
    for m in (b"aaaaa", b"bbbbb", b"ccccc"):
        c.sendall(m)
        time.sleep(0.001)
    time.sleep(1.0)
    c.close()
    out = {"sent": [5, 5, 5]}
elif mode == "small_recv":
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("0.0.0.0", int(sys.argv[2])))
    s.listen(4)
    print("listening", flush=True)
    c, _ = s.accept()
    time.sleep(0.6)
    sizes = []
    while True:
        d = c.recv(4)
        if not d:
            break
        sizes.append(len(d))
    out = {"sizes": sizes}
elif mode == "backlog_server":
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("0.0.0.0", int(sys.argv[2])))
    s.listen(int(sys.argv[3]))
    print("listening", flush=True)
    time.sleep(float(sys.argv[4]))
    out = {"slept": float(sys.argv[4])}
elif mode == "connect_n":
    keep, res = [], []
    for i in range(int(sys.argv[4])):
        c = socket.socket()
        c.settimeout(float(sys.argv[5]))
        t0 = time.time()
        try:
            c.connect((sys.argv[2], int(sys.argv[3])))
            r = "connected"
        except socket.timeout:
            r = "timeout"
        except OSError as e:
            r = errno.errorcode.get(e.errno, str(e.errno))
        res.append({"n": i + 1, "result": r, "seconds": round(time.time() - t0, 2)})
        keep.append(c)
    out = {"results": res}
elif mode == "hold_server":
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("0.0.0.0", int(sys.argv[2])))
    s.listen(16)
    print("listening", flush=True)
    end, keep = time.time() + float(sys.argv[3]), []
    s.settimeout(0.2)
    while time.time() < end:
        try:
            keep.append(s.accept()[0])
        except socket.timeout:
            pass
    out = {"accepted": len(keep)}
elif mode == "ports":
    keep, res = [], []
    for i in range(int(sys.argv[4])):
        c = socket.socket()
        try:
            c.connect((sys.argv[2], int(sys.argv[3])))
            res.append({"n": i + 1, "port": c.getsockname()[1]})
            keep.append(c)
        except OSError as e:
            res.append({"n": i + 1, "error": errno.errorcode.get(e.errno, str(e.errno)), "text": e.strerror})
    out = {"results": res}
elif mode == "reuse":
    flag = sys.argv[2] == "1"
    port = 9400
    a = socket.socket()
    a.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    a.bind(("127.0.0.1", port))
    a.listen(2)
    cl = socket.socket()
    cl.connect(("127.0.0.1", port))
    srv, _ = a.accept()
    srv.close()          # the server side closes first: it will hold TIME-WAIT
    time.sleep(0.2)
    cl.close()
    a.close()
    time.sleep(0.2)
    b = socket.socket()
    if flag:
        b.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        b.bind(("127.0.0.1", port))
        out = {"flag": flag, "bind": "ok"}
    except OSError as e:
        out = {"flag": flag, "bind": errno.errorcode.get(e.errno, str(e.errno)), "text": e.strerror}
print(json.dumps(out), flush=True)
