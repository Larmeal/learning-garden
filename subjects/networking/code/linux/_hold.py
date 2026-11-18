"""Opens a TCP connection, keeps it open for a while without sending anything, then closes it. Usage: _hold.py HOST PORT SECONDS LOCAL_PORT."""
import socket
import sys
import time

s = socket.socket()
s.bind(("0.0.0.0", int(sys.argv[4])))
s.connect((sys.argv[1], int(sys.argv[2])))
print("connected", flush=True)
time.sleep(float(sys.argv[3]))
s.close()
