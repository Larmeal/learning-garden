"""A raw HTTP/1.1 client for the exercises. Usage: _get.py HOST PORT [LOCAL_PORT]. Prints the number of bytes received."""
import socket
import sys

host, port = sys.argv[1], int(sys.argv[2])
s = socket.socket()
if len(sys.argv) > 3:
    s.bind(("0.0.0.0", int(sys.argv[3])))
s.connect((host, port))
s.sendall(b"GET /hello.txt HTTP/1.1\r\nHost: garden.test\r\nConnection: close\r\n\r\n")
d = b""
while True:
    x = s.recv(4096)
    if not x:
        break
    d += x
print(len(d))
