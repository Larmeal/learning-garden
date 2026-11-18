"""A tiny server for the exercises: answers every connection with one fixed HTTP response and closes. Usage: _canned_server.py PORT [BODY_BYTES]."""
import socket
import sys

port = int(sys.argv[1])
size = int(sys.argv[2]) if len(sys.argv) > 2 else 14
body = (b"hello, garden\n" * (size // 14 + 1))[:size]
head = b"HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: %d\r\nConnection: close\r\n\r\n" % len(body)
srv = socket.socket()
srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
srv.bind(("0.0.0.0", port))
srv.listen(16)
print("listening", flush=True)
while True:
    c, _ = srv.accept()
    try:
        c.recv(4096)
        c.sendall(head + body)
    finally:
        c.close()
