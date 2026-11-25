"""Raw CDP connection to an arbitrary websocket URL (browser target or a service-worker target)."""
import socket, os, base64, urllib.parse
from cdpsession import Session

class Raw(Session):
    def __init__(self, ws_url):
        self.ws_url = ws_url
    def __enter__(self):
        u = urllib.parse.urlparse(self.ws_url)
        self.s = socket.create_connection((u.hostname, u.port), timeout=120)
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((f"GET {u.path} HTTP/1.1\r\nHost: {u.hostname}:{u.port}\r\nUpgrade: websocket\r\n"
                        f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
        buf = b''
        while b'\r\n\r\n' not in buf:
            buf += self.s.recv(4096)
        self.buf = buf.split(b'\r\n\r\n', 1)[1]
        self._id = 0
        return self
    def __exit__(self, *a):
        try: self.s.close()
        except Exception: pass
