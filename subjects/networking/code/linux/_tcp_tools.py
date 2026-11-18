"""Small TCP programs for the exercises, one file, chosen by the first argument (standard library only).

  sink PORT [DELAY_SECONDS] [RCVBUF]   accept one connection, wait DELAY before reading, read until EOF, print the number of bytes and the seconds it took
  bulk HOST PORT BYTES LOCAL_PORT [HOLD]  connect, send BYTES zero bytes with one sendall, wait HOLD seconds, close, print the seconds it took
  small HOST PORT NODELAY LOCAL_PORT   connect, write 5 chunks of 10 bytes 1 ms apart (NODELAY 1 sets TCP_NODELAY), wait half a second, close
"""
import socket
import sys
import time

mode = sys.argv[1]
if mode == "sink":
    port = int(sys.argv[2])
    delay = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    if len(sys.argv) > 4:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, int(sys.argv[4]))
    s.bind(("0.0.0.0", port))
    s.listen(4)
    print("listening", flush=True)
    c, _ = s.accept()
    t0 = time.time()
    time.sleep(delay)
    total = 0
    while True:
        d = c.recv(65536)
        if not d:
            break
        total += len(d)
    print("sink %d %.2f" % (total, time.time() - t0), flush=True)
elif mode == "bulk":
    c = socket.socket()
    c.bind(("0.0.0.0", int(sys.argv[5])))
    c.connect((sys.argv[2], int(sys.argv[3])))
    t0 = time.time()
    c.sendall(b"\x00" * int(sys.argv[4]))
    if len(sys.argv) > 6:
        time.sleep(float(sys.argv[6]))
    c.close()
    print("bulk %.2f" % (time.time() - t0), flush=True)
elif mode == "small":
    c = socket.socket()
    if sys.argv[4] == "1":
        c.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    c.bind(("0.0.0.0", int(sys.argv[5])))
    c.connect((sys.argv[2], int(sys.argv[3])))
    for i in range(5):
        c.sendall(b"0123456789")
        time.sleep(0.001)
    time.sleep(0.5)
    c.close()
    print("small done", flush=True)
