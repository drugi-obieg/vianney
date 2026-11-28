"""A smoke test of the Firefox build in a real Firefox (stdlib only; the Firefox counterpart of tools/e2e.py, but much smaller).

    node tools/build.mjs firefox
    python3 -I tools/firefox-smoke.py [--firefox /usr/bin/firefox] [--dir dist/firefox]

It starts a headless Firefox with an empty profile and Marionette, installs the build as a temporary add-on, and checks:
  - the add-on installs (the manifest is accepted);
  - the content script starts on a page (the page is local, so the copy of the manifest that is installed matches 127.0.0.1 instead of youtube.com);
  - the background page answers the settings page: the local model's row is drawn, Chrome's model is not offered, and the checklist for it is hidden;
  - the local model is hosted in the background page itself (Firefox has no offscreen documents): a status request is answered by it.
With --model it also downloads the local model (about 380 MB from Hugging Face), waits until it is stored and checked, and asks it a question through
the background page, which is the whole path that Firefox takes (module Worker, the private file system, WebAssembly on one thread). Slow: minutes.
It does not open YouTube.
"""
import argparse, json, os, shutil, socket, subprocess, sys, tempfile, threading, time
from http.server import BaseHTTPRequestHandler, HTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = b'<!doctype html><meta charset=utf-8><title>test page</title><body><h1>a page</h1><a href="/watch?v=abcdefghijk" title="A title">a link</a></body>'


class Marionette:
    """The Marionette protocol: messages are `<length>:<json>`; a command is [0, id, name, params], its answer [1, id, error, result]."""
    def __init__(self, port):
        end = time.time() + 40
        while True:
            try:
                self.s = socket.create_connection(('127.0.0.1', port), timeout=90)
                break
            except OSError:
                if time.time() > end: raise
                time.sleep(0.3)
        self.id = 0
        self._read()                                   # the greeting

    def _read(self):
        head = b''
        while not head.endswith(b':'):
            c = self.s.recv(1)
            if not c: raise ConnectionError('Marionette closed')
            head += c
        n = int(head[:-1]); body = b''
        while len(body) < n: body += self.s.recv(n - len(body))
        return json.loads(body.decode())

    def call(self, name, params=None):
        self.id += 1
        msg = json.dumps([0, self.id, name, params or {}]).encode()
        self.s.sendall(str(len(msg)).encode() + b':' + msg)
        while True:
            m = self._read()
            if isinstance(m, list) and m[0] == 1 and m[1] == self.id:
                if m[2]: raise RuntimeError(f'{name}: {m[2]}')
                return m[3]

    def run(self, script, args=None):
        return (self.call('WebDriver:ExecuteScript', {'script': script, 'args': args or []}) or {}).get('value')

    def wait(self, script, timeout=15):
        end = time.time() + timeout
        while time.time() < end:
            v = self.run(script)
            if v: return v
            time.sleep(0.4)
        return None


def serve():
    class H(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200); self.send_header('Content-Type', 'text/html'); self.end_headers(); self.wfile.write(PAGE)
        def log_message(self, *a): pass
    srv = HTTPServer(('127.0.0.1', 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--firefox', default=shutil.which('firefox') or 'firefox')
    ap.add_argument('--dir', default=os.path.join(ROOT, 'dist', 'firefox'))
    ap.add_argument('--model', action='store_true', help='also download the local model and ask it a question')
    ap.add_argument('--minutes', type=int, default=20, help='how long the download may take')
    args = ap.parse_args()
    results = []
    def check(name, ok, detail=''):
        results.append(bool(ok)); print(('PASS  ' if ok else 'FAIL  ') + name + (f'   ({detail})' if detail else ''))

    tmp = tempfile.mkdtemp(prefix='vianney-ff-')
    # the copy that is installed: the same build, but its content scripts match the local page
    ext = os.path.join(tmp, 'ext'); shutil.copytree(args.dir, ext)
    mf = json.load(open(os.path.join(ext, 'manifest.json')))
    for c in mf['content_scripts']: c['matches'] = ['http://127.0.0.1/*']
    for r in mf['web_accessible_resources']: r['matches'] = ['http://127.0.0.1/*']
    if args.model: mf['host_permissions'] = ['https://huggingface.co/*', 'https://*.hf.co/*']      # granted at install: the doorhanger of an optional permission cannot be answered here
    json.dump(mf, open(os.path.join(ext, 'manifest.json'), 'w'))
    srv = serve(); url = f'http://127.0.0.1:{srv.server_port}/'
    profile = os.path.join(tmp, 'profile'); os.makedirs(profile)
    with open(os.path.join(profile, 'user.js'), 'w') as f:
        f.write('user_pref("marionette.port", 2828);\nuser_pref("extensions.autoDisableScopes", 0);\nuser_pref("xpinstall.signatures.required", false);\n'
                'user_pref("browser.shell.checkDefaultBrowser", false);\nuser_pref("datareporting.policy.dataSubmissionEnabled", false);\n')
    fx = subprocess.Popen([args.firefox, '--headless', '--marionette', '--no-remote', '--profile', profile, 'about:blank'], stdout=subprocess.DEVNULL, stderr=open(os.path.join(tmp, 'firefox.log'), 'w'),
                          env={**os.environ, 'MOZ_REMOTE_ALLOW_SYSTEM_ACCESS': '1'})   # to read the address that Firefox gave the add-on
    try:
        m = Marionette(2828)
        m.call('WebDriver:NewSession', {'capabilities': {}})
        try:
            addon_id = m.call('Addon:Install', {'path': ext, 'temporary': True})
            check('the add-on installs: its manifest is accepted', bool(addon_id), str(addon_id));
        except RuntimeError as e:
            check('the add-on installs: its manifest is accepted', False, str(e)[:300]); return finish(results)

        # 1. the content script starts on a page
        m.call('WebDriver:Navigate', {'url': url})
        armed = m.wait("return document.documentElement.hasAttribute('data-vianney-armed')", 20)
        check('the content script starts on a page (the feed filter arms the page)', armed)

        # 2. the settings page, through the address that this Firefox gave the add-on
        m.call('Marionette:SetContext', {'value': 'chrome'})
        uuids = json.loads(m.run('return Services.prefs.getStringPref("extensions.webextensions.uuids")'))
        m.call('Marionette:SetContext', {'value': 'content'})
        uuid = uuids.get('vianney@vianney.cc')
        check('the add-on has an address of its own', bool(uuid), str(uuid))
        m.call('WebDriver:Navigate', {'url': f'moz-extension://{uuid}/src/options/options.html#ai'})
        row = m.wait("const a = document.querySelector('#ai-models [data-model=kev]'); return a ? a.innerText : null", 25)
        check('the settings page draws the row of the local model (the background page answered it)', row and 'Kev-0.6B' in row, (row or '')[:90].replace('\n', ' | '))
        check('... which offers the download', row and 'Download Kev-0.6B' in row)
        check('Chrome\'s model is not offered here', m.run("return document.querySelectorAll('#ai-models [data-model]').length") == 1 and m.run("return document.getElementById('nano').hidden === true"))
        # 3. the model's host lives in the background page: ask it
        r = m.call('WebDriver:ExecuteAsyncScript', {'script': "const done = arguments[arguments.length - 1]; chrome.runtime.sendMessage({type: 'kev-status'}).then((r) => done(JSON.stringify(r)), (e) => done('ERR ' + e));", 'args': []})
        st = json.loads(r['value']) if r.get('value') and not r['value'].startswith('ERR') else None
        check('the background page answers a status request for the local model', st is not None and st.get('stored') is not None, (r.get('value') or '')[:120])
        check('... with no download running and no model loaded yet (no host made before it is needed)', st is not None and st.get('job') is None and st.get('runtime') is None)

        if args.model:
            def ask_bg(msg):
                r = m.call('WebDriver:ExecuteAsyncScript', {'script': "const done = arguments[arguments.length - 1]; chrome.runtime.sendMessage(%s).then((r) => done(JSON.stringify(r)), (e) => done('ERR ' + e));" % json.dumps(msg), 'args': []})
                v = r.get('value') or ''
                return None if v.startswith('ERR') else json.loads(v), v
            button = m.call('WebDriver:FindElement', {'using': 'css selector', 'value': '#ai-models [data-model=kev] [data-act=download]'})
            m.call('WebDriver:ElementClick', {'id': list((button.get('value') or button).values())[0]})                 # a real click: Firefox wants one for the permission request
            end = time.time() + args.minutes * 60; last = 0; st = None
            while time.time() < end:
                st, raw = ask_bg({'type': 'kev-status'})
                job = (st or {}).get('job') or {}
                if time.time() - last > 20:
                    last = time.time(); print(f"      ... {job.get('phase')} {job.get('done', 0) // 1000000} of {job.get('total', 0) // 1000000} MB {job.get('error') or ''}", flush=True)
                if st and st['stored'] and st['stored']['complete'] and job.get('phase') in (None, 'idle'): break
                if job.get('phase') == 'error': break
                time.sleep(3)
            done = bool(st and st['stored'] and st['stored']['complete'])
            check('the local model is downloaded and every file checked against its pinned SHA-256', done, json.dumps(((st or {}).get('job') or {}).get('error')) if not done else f"{st['stored']['bytesHave'] // 1000000} MB")
            if done:
                t0 = time.time()
                a, raw = ask_bg({'type': 'ai-ask', 'kind': 'noul', 'question': 'Is this text a greeting?', 'text': 'Hello there, how are you today?'})
                check('a question is answered by the local model in the background page', a is not None and isinstance(a.get('p'), (int, float)), f"{raw[:140]}  in {time.time() - t0:.1f} s")
                b, raw2 = ask_bg({'type': 'ai-ask', 'kind': 'noul', 'question': 'Is this text a greeting?', 'text': 'The invoice is due on the fifteenth of March.'})
                check('and the answers differ with the text (a greeting is likelier than an invoice)', a and b and isinstance(a.get('p'), (int, float)) and isinstance(b.get('p'), (int, float)) and a['p'] > b['p'], f"{a and a.get('p')} vs {b and b.get('p')}")
                stt, _ = ask_bg({'type': 'kev-status'})
                check('the runtime reports how it runs (WebAssembly: Firefox on Linux has no WebGPU)', stt and (stt.get('runtime') or {}).get('device') in ('wasm', 'webgpu'), json.dumps((stt or {}).get('runtime'))[:140])
        # 4. the settings page has no script errors on load: look at its state
        errs = m.run("return document.body.firstChild && document.body.firstChild.nodeName === 'PRE' ? document.body.firstChild.textContent : null")
        check('the settings page started without an error', errs is None, errs or '')
    finally:
        fx.terminate()
        try: fx.wait(10)
        except Exception: fx.kill()
        srv.shutdown()
        shutil.rmtree(tmp, ignore_errors=True)
    return finish(results)


def finish(results):
    print(f'{sum(results)} of {len(results)} checks passed')
    return 0 if all(results) else 1


if __name__ == '__main__':
    sys.exit(main())
