"""Tries one TCP connection with a timeout and prints what happened. Usage: _probe.py HOST PORT [TIMEOUT_SECONDS] [LOCAL_PORT]."""
import errno
import socket
import sys
import time

s = socket.socket()
s.settimeout(float(sys.argv[3]) if len(sys.argv) > 3 else 2)
if len(sys.argv) > 4:
    s.bind(("0.0.0.0", int(sys.argv[4])))
t0 = time.time()
code = s.connect_ex((sys.argv[1], int(sys.argv[2])))
what = {0: "connected", errno.ECONNREFUSED: "refused", errno.EAGAIN: "timeout", errno.ETIMEDOUT: "timeout", errno.EHOSTUNREACH: "unreachable", errno.ENETUNREACH: "unreachable"}.get(code, "error %d" % code)
print(what if len(sys.argv) <= 3 else "%s %.1f" % (what, time.time() - t0))
