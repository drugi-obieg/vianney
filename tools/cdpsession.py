"""Minimal CDP session helper (stdlib only), adapted from the websocket code in cdp-fetch.py.

Usage:  from cdpsession import Session
        with Session() as s:
            s.goto(url, wait=4); print(s.eval("document.title"))
Opens its own tab in the already running headless Chrome (port 9222) and closes it on exit.
"""
import json, socket, os, base64, struct, time, urllib.request, urllib.parse

PORT = os.environ.get('CDP_PORT', '9222')


def _http(method, path):
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}' + path, method=method)
    with urllib.request.urlopen(req, timeout=10) as r:
        body = r.read()
        try:
            return json.loads(body or b'null')
        except Exception:
            return body.decode('utf-8', 'replace')


class Session:
    def __enter__(self):
        self.target = _http('PUT', '/json/new?about:blank')
        u = urllib.parse.urlparse(self.target['webSocketDebuggerUrl'])
        self.s = socket.create_connection((u.hostname, u.port), timeout=120)
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((f"GET {u.path} HTTP/1.1\r\nHost: {u.hostname}:{u.port}\r\nUpgrade: websocket\r\n"
                        f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
        buf = b''
        while b'\r\n\r\n' not in buf:
            buf += self.s.recv(4096)
        self.buf = buf.split(b'\r\n\r\n', 1)[1]
        self._id = 0
        self.call('Page.enable')
        self.call('Runtime.enable')
        return self

    def __exit__(self, *a):
        try:
            self.s.close()
        finally:
            try:
                _http('GET', '/json/close/' + self.target['id'])
            except Exception:
                pass

    # --- websocket framing
    def _send(self, text):
        data = text.encode(); mask = os.urandom(4); n = len(data)
        hdr = bytearray([0x81])
        if n < 126: hdr.append(0x80 | n)
        elif n < 65536: hdr.append(0x80 | 126); hdr += struct.pack('>H', n)
        else: hdr.append(0x80 | 127); hdr += struct.pack('>Q', n)
        self.s.sendall(bytes(hdr) + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def _exact(self, n):
        while len(self.buf) < n:
            chunk = self.s.recv(65536)
            if not chunk: raise ConnectionError('websocket closed')
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def _recv(self):
        parts = []
        while True:
            b0, b1 = self._exact(2)
            op, n = b0 & 0x0f, b1 & 0x7f
            if n == 126: n = struct.unpack('>H', self._exact(2))[0]
            elif n == 127: n = struct.unpack('>Q', self._exact(8))[0]
            payload = self._exact(n)
            if op == 8: raise ConnectionError('close frame')
            if op in (0, 1): parts.append(payload)
            if b0 & 0x80 and op in (0, 1): return b''.join(parts).decode('utf-8', 'replace')

    def call(self, method, params=None):
        self._id += 1
        self._send(json.dumps({'id': self._id, 'method': method, 'params': params or {}}))
        while True:
            m = json.loads(self._recv())
            if m.get('id') == self._id:
                if 'error' in m: raise RuntimeError(m['error'])
                return m.get('result', {})

    # --- conveniences
    def goto(self, url, wait=4.0):
        self.call('Page.navigate', {'url': url})
        time.sleep(wait)

    def eval(self, expr, await_promise=True, timeout_ms=60000):
        r = self.call('Runtime.evaluate', {'expression': expr, 'returnByValue': True,
                                           'awaitPromise': await_promise, 'timeout': timeout_ms})
        if 'exceptionDetails' in r:
            d = r['exceptionDetails']
            return {'__error__': (d.get('exception') or {}).get('description') or d.get('text')}
        return r.get('result', {}).get('value')

    def click_text(self, patterns):
        js = """((pats)=>{const els=[...document.querySelectorAll('button, a, [role=button], input[type=submit]')];
        for(const p of pats){const re=new RegExp(p,'i');const h=els.find(e=>re.test((e.innerText||e.value||e.getAttribute('aria-label')||'').trim()));
        if(h){h.click();return 'clicked '+p;}}return 'no match';})(%s)""" % json.dumps(patterns)
        return self.eval(js)

    def pass_consent(self):
        host = self.eval('location.host')
        if host and 'consent' in host:
            res = self.click_text([r'^(Alle ablehnen|Reject all)', r'(Alle ablehnen|Reject all)'])
            time.sleep(5)
            return f'consent page on {host}: {res} -> now {self.eval("location.href")}'
        return f'no consent wall (host={host})'
