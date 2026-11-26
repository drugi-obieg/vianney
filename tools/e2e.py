"""End-to-end test: the unpacked extension in a throwaway headless Chrome, against real YouTube pages.

Usage:
  1. start Chrome with:  --headless=new --remote-debugging-port=9333 --enable-unsafe-extension-debugging
                         --user-data-dir=<empty dir>   (see tools/e2e-chrome.sh)
  2. python3 tools/e2e.py [scenario ...]        scenarios: smoke feed slider break subtitles options ai falsepos watchmeta searchflow hoverpreview modelcheck media-options media-thumbnails media-audio cleanup popup comments site
                                                also live-captions and positives (informational, not run by default)

The media scenarios put a FAKE on-device model into the extension's service worker (no real Gemini Nano is needed or used):
real thumbnails are fetched, real sound is captured from the playing video, and only the model's yes/no is scripted.
To test another copy of the extension (E2E_EXT_DIR), restart Chrome first: tools/e2e-chrome.sh. Loaded extensions stay for the browser's lifetime,
and two copies would both act on the same YouTube page and give confusing failures.
media-audio needs Chrome started with  E2E_EXTRA_FLAGS="--autoplay-policy=no-user-gesture-required"  (sound stays muted by --mute-audio).

It loads the extension with the DevTools method Extensions.loadUnpacked (Chrome 137+ removed
--load-extension from branded builds), drives pages through CDP, and prints PASS/FAIL per check.
Needs network access to youtube.com; it never signs in.
"""
import base64, json, os, sys, time, urllib.request

os.environ.setdefault('CDP_PORT', '9333')
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.environ.get('E2E_HELPERS', HERE))
from cdpsession import Session          # noqa: E402  (copied next to this script or given via E2E_HELPERS)
from cdpext import Raw                  # noqa: E402

PORT = os.environ['CDP_PORT']
EXT_DIR = os.path.abspath(os.environ.get('E2E_EXT_DIR') or os.path.join(HERE, '..', 'extension'))
SHOTS = os.environ.get('E2E_SHOTS', os.path.join(HERE, '..', 'e2e-shots'))
os.makedirs(SHOTS, exist_ok=True)

results = []


def rule_count(which='all'):
    """How many rules the rule files hold ('all'), or how many TEXT rules are on by default ('enabled': the picture and sound rules do nothing while that check is off)."""
    import re
    n = 0
    for f in ('vianney.en.rules', 'vianney.media.en.rules'):
        for part in re.split(r'\n(?=rule )', open(os.path.join(EXT_DIR, 'rules', f), encoding='utf-8').read()):
            if part.startswith('rule '):
                media = re.search(r'^\s+where:\s*(thumbnail|audio)', part, re.M)
                n += 1 if which == 'all' or (not media and not re.search(r'^\s+enabled:\s*false', part, re.M)) else 0
    return n


def rule_names(*groups):
    """The plain names of the rules of these groups in the rule files (the reason a card is hidden for is the plain name of the rule)."""
    import re
    names = set()
    for f in ('vianney.en.rules', 'vianney.media.en.rules'):
        for part in re.split(r'\n(?=rule )', open(os.path.join(EXT_DIR, 'rules', f), encoding='utf-8').read()):
            g = re.search(r'^\s+group:\s*(\S+)', part, re.M)
            n = re.search(r'^\s+name:\s*(.+?)\s*$', part, re.M)
            if part.startswith('rule ') and g and n and g.group(1) in groups:
                names.add(n.group(1))
    return names


def check(name, ok, detail=''):
    results.append((name, bool(ok)))
    print(('PASS  ' if ok else 'FAIL  ') + name + (f'   [{detail}]' if detail and not ok else (f'   ({detail})' if detail else '')))
    return ok


def load_extension():
    ver = json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json/version'))
    with Raw(ver['webSocketDebuggerUrl']) as b:
        return b.call('Extensions.loadUnpacked', {'path': EXT_DIR})['id']


def shot(page, name):
    data = page.call('Page.captureScreenshot', {'format': 'png'})['data']
    path = os.path.join(SHOTS, name + '.png')
    open(path, 'wb').write(base64.b64decode(data))
    return path


def cmd(page, name, args=None, timeout=10):
    cid = str(time.time())
    payload = json.dumps({'id': cid, 'cmd': name, 'args': args or {}})
    page.eval(f"document.documentElement.setAttribute('data-vianney-cmd', {json.dumps(payload)})")
    for _ in range(int(timeout * 10)):
        r = page.eval("document.documentElement.getAttribute('data-vianney-reply')")
        if r:
            obj = json.loads(r)
            page.eval("document.documentElement.removeAttribute('data-vianney-reply')")
            if obj.get('id') == cid or 'error' in obj:
                return obj
        time.sleep(0.1)
    raise TimeoutError('no reply from the content script for ' + name)


def wait_for(page, js, timeout=20, every=0.5):
    end = time.time() + timeout
    last = None
    while time.time() < end:
        last = page.eval(js)
        if last:
            return last
        time.sleep(every)
    return last


# A stand-in for Chrome's Prompt API, installed in the service worker. It records every prompt it gets and answers
# "true" only where the test said so: for pictures by the SHA-256 of the image and a pattern in the question,
# for sound by the loudness of the clip and a pattern in the question.
FAKE_MODEL_JS = r"""
(() => {
  const state = globalThis.__fake = { log: [], imageYes: [], audioYes: [], rmsMin: 0.005, delayMs: 0, availability: { text: 'available', image: 'available', audio: 'available' } };
  const hex = async (blob) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map((b) => b.toString(16).padStart(2, '0')).join('');
  async function wavRms(blob) {
    const v = new DataView(await blob.arrayBuffer());
    let sum = 0, n = 0;
    for (let o = 44; o + 1 < v.byteLength; o += 2) { const x = v.getInt16(o, true) / 32768; sum += x * x; n++; }
    return n ? Math.sqrt(sum / n) : 0;
  }
  class Session {
    constructor(o) { this.o = o; }
    async clone() { return new Session(this.o); }
    async prompt(input) {
      if (state.delayMs) await new Promise((r) => setTimeout(r, state.delayMs));   // a model that takes its time
      const rec = {};
      if (typeof input === 'string') { rec.kind = 'text'; state.log.push(rec); return 'false'; }
      const [q, m] = input[0].content;
      rec.kind = m.type; rec.q = q.value.slice(0, 140); rec.bytes = m.value.size; rec.mime = m.value.type;
      let yes = false;
      if (m.type === 'image') { rec.hash = await hex(m.value); yes = state.imageYes.some((r) => r.hash === rec.hash && new RegExp(r.q, 'i').test(q.value)); }
      else { rec.rms = await wavRms(m.value); yes = rec.rms > state.rmsMin && state.audioYes.some((re) => new RegExp(re, 'i').test(q.value)); }
      rec.yes = yes;
      state.log.push(rec);
      return yes ? 'true' : 'false';
    }
    destroy() {}
  }
  globalThis.LanguageModel = {
    availability: async (o) => { const t = ((o && o.expectedInputs) || []).map((i) => i.type); return state.availability[t.includes('audio') ? 'audio' : t.includes('image') ? 'image' : 'text']; },
    create: async () => new Session({}),
  };
  return 'installed';
})()
"""



FAKE_PAGE_MODEL_JS = r"""
(() => {
  const st = window.__fakePage = { avail: { text: 'downloadable', image: 'downloadable', audio: 'available' }, failDownload: false, created: [], prompts: [],
                                   latency: { text: 300, audio: 500, image: { 160: 100, 320: 200, 640: 400 } } };
  const kind = (o) => { const t = ((o && o.expectedInputs) || []).map((i) => i.type); return t.includes('audio') ? 'audio' : t.includes('image') ? 'image' : 'text'; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  class Session {
    constructor(k) { this.k = k; }
    async clone() { return new Session(this.k); }
    async prompt(input) {
      let ms = st.latency.text;
      if (Array.isArray(input)) {
        const part = input[0].content[1];
        if (part.type === 'audio') ms = st.latency.audio;
        else { const bmp = await createImageBitmap(part.value); ms = st.latency.image[bmp.width] || 200; }
      }
      st.prompts.push({ k: this.k, ms });
      await sleep(ms);
      return 'false';
    }
    destroy() {}
  }
  window.LanguageModel = {
    availability: async (o) => st.avail[kind(o)],
    create: async (o) => {
      const k = kind(o);
      if (st.avail[k] === 'downloadable') {
        if (st.failDownload) { const e = new Error('needs a user gesture'); e.name = 'NotAllowedError'; throw e; }
        if (o.monitor) { const m = new EventTarget(); o.monitor(m); for (const f of [0.25, 0.5, 1]) { await sleep(60); const ev = new Event('downloadprogress'); ev.loaded = f; m.dispatchEvent(ev); } }
        st.avail[k] = 'available';
      }
      st.created.push(k);
      return new Session(k);
    },
  };
})()
"""


class Env:
    def __init__(self):
        self.ext = load_extension()
        self.ctrl = Session().__enter__()
        self.ctrl.goto(f'chrome-extension://{self.ext}/src/options/options.html', wait=1.5)
        self.sw = None

    # ---- the fake model in the service worker
    def install_fake(self):
        self.ctrl.eval("chrome.runtime.sendMessage({type: 'ai-status'})")   # wake the worker so that it has a target
        target = None
        for _ in range(20):
            for t in json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json/list')):
                if t.get('type') == 'service_worker' and self.ext in t.get('url', ''):
                    target = t
            if target:
                break
            time.sleep(0.5)
        if not target:
            raise RuntimeError('no service worker target found')
        if self.sw:
            self.sw.__exit__()
        self.sw = Raw(target['webSocketDebuggerUrl']).__enter__()      # an attached debugger also keeps the worker alive
        self.sw.eval(FAKE_MODEL_JS)
        # sessions made under an earlier stand-in (maybe a slow one) live on in the worker: start again
        self.ctrl.eval("chrome.runtime.sendMessage({type: 'debug-reset-ai'})")
        return self.media_status(force=True)

    def fake(self, js):
        return self.sw.eval(js)

    def fake_log(self, kind=None):
        log = json.loads(self.sw.eval('JSON.stringify(globalThis.__fake.log)'))
        return [r for r in log if kind is None or r.get('kind') == kind]

    def media_status(self, force=False):
        return self.ctrl.eval(f"chrome.runtime.sendMessage({{type: 'media-status', force: {str(force).lower()}}})")

    def storage_set(self, **kv):
        self.ctrl.eval(f'chrome.storage.local.set({json.dumps(kv)})')

    def settings(self, **patch):
        cur = self.ctrl.eval("chrome.storage.local.get('settings').then(r => r.settings || {})")
        merged = {**cur, **patch}
        self.ctrl.eval(f"chrome.storage.local.set({{settings: {json.dumps(merged)}}})")
        return merged

    def reset(self):
        self.ctrl.eval("chrome.storage.local.clear()")
        self.settings(debug=True)

    def open_page(self, url, ready_js, timeout=25):
        s = Session().__enter__()
        s.call('Emulation.setDeviceMetricsOverride', {'width': 1300, 'height': 900, 'deviceScaleFactor': 1, 'mobile': False})
        s.goto(url, wait=2)
        wait_for(s, ready_js, timeout)
        s.click_text([r'^(Alle ablehnen|Reject all)'])   # YouTube's consent dialog in a fresh profile
        time.sleep(2.5)  # let the extension scan
        return s

    def close(self):
        if self.sw:
            self.sw.__exit__()
        self.ctrl.__exit__(None, None, None)


SEARCH_READY = "document.querySelectorAll('a[href*=\"/watch?v=\"]').length > 8"
WATCH_READY = "!!document.querySelector('video') && document.querySelectorAll('a[href*=\"/watch?v=\"]').length > 3"


def scenario_smoke(env):
    print('\n== smoke: the extension is alive on a YouTube page')
    p = env.open_page('https://www.youtube.com/results?search_query=gregorian+chant', SEARCH_READY)
    snap = cmd(p, 'snapshot')
    check('content script answers the debug command', 'feed' in snap)
    check('rule pack loaded without problems', not snap.get('problems'), json.dumps(snap.get('problems'))[:200])
    check('rules present', len(snap.get('rules', [])) >= 4, str(snap.get('rules')))
    check('the page style was injected', p.eval("!!document.getElementById('vianney-style')"))
    check('video cards were found', snap['feed']['cards'] >= 8, str(snap['feed']['cards']))
    check('finding the cards on a full page is fast', snap['feed']['findMs'] < 150, f"findCards {snap['feed']['findMs']} ms, last scan {snap['feed']['lastScanMs']} ms")
    shot(p, 'smoke-search')
    p.__exit__(None, None, None)


def scenario_feed(env):
    print('\n== feed: a rule hides matching cards and spares the rest')
    env.reset()
    p = env.open_page('https://www.youtube.com/results?search_query=omg+oh+my+god+reaction', SEARCH_READY)
    snap = cmd(p, 'snapshot')
    hidden = [s for s in snap['feed']['states'] if s['state'] == 'hide']
    check('some cards matching the Lord\'s-name rule are hidden', len(hidden) >= 1, f"{len(hidden)} hidden of {snap['feed']['cards']} cards")
    leftover = p.eval("""[...document.querySelectorAll('a[href*="/watch?v="]')].filter(a => !a.closest('[data-vianney-state="hide"]') && /\\b(omg|oh my god)\\b/i.test(a.getAttribute('title')||'')).length""")
    check('no visible card still carries a strong exclamation in its title', leftover == 0, f'{leftover} left')
    log = env.ctrl.eval("chrome.storage.local.get('log').then(r => (r.log||[]).filter(e => e.flagged && e.flagged.length).length)")
    check('flagged items were written to the log', log >= 1, str(log))
    shot(p, 'feed-filtered')
    p.__exit__(None, None, None)

    p = env.open_page('https://www.youtube.com/results?search_query=gregorian+chant+vespers', SEARCH_READY)
    snap = cmd(p, 'snapshot')
    flagged = [s for s in snap['feed']['states']]
    check('a clean search is left alone (no false alarm)', len(flagged) == 0, json.dumps(flagged)[:200])
    p.__exit__(None, None, None)


def hidden_count(p, settle=1.0, timeout=20):
    """Hidden-card count once it has stopped changing (YouTube keeps re-rendering lists)."""
    last, same, end = None, 0, time.time() + timeout
    while time.time() < end:
        n = len([x for x in cmd(p, 'snapshot')['feed']['states'] if x['state'] == 'hide'])
        same = same + 1 if n == last else 0
        last = n
        if same >= 2:
            return n
        time.sleep(settle)
    return last


def hidden_ids(p):
    """Ids of the hidden cards once the list has settled (YouTube loads more results while cards are hidden, so counts drift)."""
    hidden_count(p)
    return {x['id'] for x in cmd(p, 'snapshot')['feed']['states'] if x['state'] == 'hide' and x.get('id')}


def scenario_slider(env):
    print('\n== slider: sensitivity changes the outcome without reloading')
    env.reset()
    p = env.open_page('https://www.youtube.com/results?search_query=omg+oh+my+god+reaction', SEARCH_READY)
    weak = {'surface': 'feed-card', 'item': {'title': 'thank god it is friday', 'channel': ''}}   # only the bare word "god": a 15% cue
    flagged = lambda: [r['rule'] for r in cmd(p, 'evaluate', weak)['flagged']]
    check('at the default level a bare "god" is not flagged', 'lords_name' not in flagged(), str(flagged()))
    before = hidden_ids(p)
    check('at the default level some cards are hidden', len(before) >= 1, str(len(before)))
    env.settings(sensitivity={'lords_name': 0.99})
    strict = hidden_ids(p)
    check('a very strict setting (99%) un-hides the 95%-weight matches', len(strict) < len(before), f'{len(before)} -> {len(strict)}')
    env.settings(sensitivity={'lords_name': 0.10})
    lenient = hidden_ids(p)
    # YouTube re-renders its lists while cards are hidden (it loads more results, and shelves of Shorts come and go), so two
    # looks at the page never show the same cards; the exact direction is decided by the engine check below
    check('a lenient setting (10%) does not make the page un-hide cards (within the churn of the list)', len(lenient) >= 0.8 * len(before), f'{len(before)} -> {len(lenient)}')
    check('and flags the weak cue that the default let through (decided by the engine, not the page)', 'lords_name' in flagged(), str(flagged()))
    p.__exit__(None, None, None)


def scenario_break(env):
    """The break reminder is drawn as the real thing: a video among the videos of a list (home, search, channel, the recommendations next to a video) or a
    comment among the comments, at a random place, never first, one at a time. It is made of nothing but numbers read from the real neighbours, so the checks
    below put the two side by side on the real page. The owner's four messages (2026-11-26) are the specification."""
    import re, subprocess
    print('\n== break: the reminder is a video in a list or a comment, among the real ones, and the three dots snooze it')
    HOST = '[data-vianney-ui^="break-"]'
    TITLES = json.loads(subprocess.run(['node', '--input-type=module', '-e', f"import {{TITLES}} from {json.dumps('file://' + os.path.join(EXT_DIR, 'src', 'core', 'breaktitles.js'))}; console.log(JSON.stringify(TITLES))"],
                                       capture_output=True, text=True, check=True).stdout)
    known_title = lambda t: any(re.fullmatch(re.escape(x).replace(re.escape('{time}'), '.+'), t) for x in TITLES)
    due = lambda seconds=4000, next_due=60: env.storage_set(breakState={'periodKey': 'session', 'accumSeconds': seconds, 'lastPlayMs': int(time.time() * 1000), 'nextDueSeconds': next_due})
    break_state = lambda: env.ctrl.eval("chrome.storage.local.get('breakState').then(r => r.breakState)")

    def answered(before, timeout=6):
        """The state of the watch time after the service worker has answered a click (it does so a moment after the item is gone)."""
        end = time.time() + timeout
        st = break_state()
        while time.time() < end and st and st['nextDueSeconds'] == before['nextDueSeconds']:
            time.sleep(0.2)
            st = break_state()
        return st
    in_host = lambda body: f"(() => {{ const h = document.querySelector('{HOST}'); if (!h) return null; const r = h.shadowRoot; {body} }})()"
    gone = lambda p, t=8: wait_for(p, f"!document.querySelector('{HOST}')", t, 0.3)

    def page(url, ready, scheme='light', scroll=None):
        s = Session().__enter__()
        s.call('Emulation.setDeviceMetricsOverride', {'width': 1300, 'height': 900, 'deviceScaleFactor': 1, 'mobile': False})
        s.call('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-color-scheme', 'value': scheme}]})
        s.call('Network.enable')
        for name, value in (('PREF', 'hl=en&gl=US' + ('&f6=400' if scheme == 'dark' else '')), ('SOCS', 'CAI')):
            s.call('Network.setCookie', {'name': name, 'value': value, 'domain': '.youtube.com', 'path': '/'})
        s.goto(url, wait=2)
        wait_for(s, ready, 30)
        s.click_text([r'^(Alle ablehnen|Reject all)'])
        time.sleep(2.5)
        for _ in range(2):   # YouTube now and then answers a fresh profile in the light theme although the dark one is asked for: ask again
            if scheme != 'dark' or s.eval("document.documentElement.hasAttribute('dark')"):
                break
            s.call('Network.setCookie', {'name': 'PREF', 'value': 'hl=en&gl=US&f6=400', 'domain': '.youtube.com', 'path': '/'})
            s.goto(url, wait=3)
            wait_for(s, ready, 30)
            time.sleep(2.5)
        if scroll:   # comments only load when the user scrolls down to them
            s.eval("window.scrollTo(0, 900)")
            time.sleep(2.5)
            s.eval("window.scrollTo(0, 1700)")
            wait_for(s, "document.querySelectorAll('ytd-comment-thread-renderer').length >= 5", 25)
            time.sleep(1)
        return s

    def look(p):
        """Everything the checks need to know about the item in the page, in one go (None while there is none)."""
        return p.eval(in_host("""
          const kids = [...h.parentElement.children]; const i = kids.indexOf(h);
          const real = (e) => e.tagName === 'YTD-COMMENT-THREAD-RENDERER' || !!e.querySelector('a[href*="/watch?v="]');
          const text = (sel) => { const e = r.querySelector(sel); return e ? e.textContent.trim() : null; };
          const fixed = [h, ...r.querySelectorAll('*')].filter((e) => getComputedStyle(e).position === 'fixed').length;
          const imgs = [...r.querySelectorAll('img')].map((e) => e.complete && e.naturalWidth > 0);
          return {n: document.querySelectorAll('%s').length, ui: h.dataset.vianneyUi, layout: r.querySelector('.vc').dataset.layout, before: kids.slice(0, i).filter(real).length, after: kids.slice(i + 1).filter(real).length,
                  title: text('.title'), stats: text('.stats'), badge: text('.badge'), text: text('.text'), ago: text('.ago'), handle: text('.handle'), caption: text('.cap'), channel: text('.channel'),
                  aria: h.getAttribute('aria-label'), imgs, fixed, shadowText: r.querySelector('.vc').textContent.replace(/\\s+/g, ' '), borders: [...r.querySelectorAll('.vc, .vc *')].filter((e) => ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(getComputedStyle(e)['border' + s + 'Width']) > 0)).length, links: h.querySelectorAll('a').length + r.querySelectorAll('a').length,
                  seen: h.hasAttribute('data-vianney-seen'), state: h.dataset.vianneyState || null, parent: h.parentElement.tagName.toLowerCase() + (h.parentElement.id ? '#' + h.parentElement.id : ''), width: Math.round(h.getBoundingClientRect().width)};
        """ % HOST.replace("'", "\\'")))

    def mark(p):
        """Put a mark on the item and on the element before it: if the item is rebuilt or moved, the marks are gone."""
        p.eval(in_host("h.__probe = 'mine'; if (h.previousElementSibling) h.previousElementSibling.__probe = 'before'; return true;"))

    def still(p):
        return p.eval(in_host("return h.__probe === 'mine' && !!h.previousElementSibling && h.previousElementSibling.__probe === 'before';"))

    def box(p, sel):
        """Where an element inside the item is, in the window (the item is brought to the middle first)."""
        return p.eval(in_host(f"h.scrollIntoView({{block: 'center'}}); const e = r.querySelector('{sel}'); if (!e) return null; const b = e.getBoundingClientRect(); return {{x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height}};"))

    def click(p, sel):
        b = box(p, sel)
        if not b:
            return False
        p.call('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': b['x'], 'y': b['y']})
        time.sleep(0.25)
        for t in ('mousePressed', 'mouseReleased'):
            p.call('Input.dispatchMouseEvent', {'type': t, 'x': b['x'], 'y': b['y'], 'button': 'left', 'clickCount': 1})
        return True

    def hover(p, sel):
        """Put the pointer over an element of the item (YouTube may move the page a little when it adds an advertisement or a prompt: look again until the pointer really is over it)."""
        for _ in range(5):
            b = box(p, sel)
            p.call('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': 3, 'y': 3})
            time.sleep(0.2)
            p.call('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': b['x'], 'y': b['y']})
            time.sleep(0.7)
            if p.eval(in_host(f"return document.elementFromPoint({b['x']}, {b['y']}) === h;")) is True:
                return

    def still_shot(p, name):
        """A picture of the page with the item in the middle of the window and the pointer away from it."""
        box(p, '.vc')
        p.call('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': 3, 'y': 3})
        time.sleep(0.8)
        return shot(p, name)

    def appear(p, force=None, timeout=14):
        due()
        if force:
            wait_for(p, "document.documentElement.hasAttribute('data-vianney-armed')", 5)
            cmd(p, 'break', force)
        return wait_for(p, f"!!document.querySelector('{HOST}')", timeout, 0.3)

    # the real neighbour of the item, measured the way the checks can do it without the extension's help: its picture, the text of its title and of its metadata
    SIDE_BY_SIDE = r"""((layout) => { const h = document.querySelector('%s'); const r = h.shadowRoot;
      const real = h.nextElementSibling; if (!real) return null;
      const pick = {row: {thumb: 'a#thumbnail', title: 'a#video-title yt-formatted-string', meta: '#metadata-line .inline-metadata-item'},
                    column: {thumb: 'a#thumbnail', title: 'yt-formatted-string#video-title', meta: '#metadata-line .inline-metadata-item'},
                    compact: {thumb: 'yt-thumbnail-view-model', title: 'a.ytLockupMetadataViewModelTitle span', meta: '.ytContentMetadataViewModelMetadataText'}}[layout];
      const rect = (e) => { const b = e.getBoundingClientRect(); return {w: b.width, h: b.height}; };
      const font = (e) => { const c = getComputedStyle(e); return {size: parseFloat(c.fontSize), weight: c.fontWeight, color: c.color}; };
      const rt = real.querySelector(pick.thumb), rti = real.querySelector(pick.title), rm = real.querySelector(pick.meta);
      if (!rt || !rti || !rm) return {missing: [!rt && 'thumb', !rti && 'title', !rm && 'meta'].filter(Boolean)};
      const ft = r.querySelector('.thumb'), fti = r.querySelector('.title'), fm = r.querySelector('.stats');
      return {real: {thumb: rect(rt), title: font(rti), meta: font(rm), radius: getComputedStyle(rt).borderRadius}, fake: {thumb: rect(ft), title: font(fti), meta: font(fm), radius: getComputedStyle(ft).borderRadius}};
    })""" % HOST

    def side_by_side(p, layout, what):
        d = p.eval(f"({SIDE_BY_SIDE})({json.dumps(layout)})")
        if not d or d.get('missing'):
            check(f'{what}: the real neighbour can be measured', False, json.dumps(d))
            return
        rt, ft = d['real']['thumb'], d['fake']['thumb']
        ratio_r, ratio_f = rt['w'] / rt['h'], ft['w'] / ft['h']
        print(f"   {what}: thumbnail real {rt['w']:.1f} x {rt['h']:.1f} (ratio {ratio_r:.3f}, radius {d['real']['radius']}) | fake {ft['w']:.1f} x {ft['h']:.1f} (ratio {ratio_f:.3f}, radius {d['fake']['radius']});"
              f" title real {d['real']['title']['size']}px/{d['real']['title']['weight']} fake {d['fake']['title']['size']}px/{d['fake']['title']['weight']};"
              f" metadata real {d['real']['meta']['size']}px fake {d['fake']['meta']['size']}px")
        check(f'{what}: the thumbnail has the width and the height of the real one, to less than a pixel (and so the same ratio)', abs(rt['w'] - ft['w']) < 1 and abs(rt['h'] - ft['h']) < 1 and abs(ratio_r - ratio_f) < 0.02, f"{rt} vs {ft}")
        check(f'{what}: the corners of the thumbnail are as round as the real one', d['real']['radius'] == d['fake']['radius'], f"{d['real']['radius']} vs {d['fake']['radius']}")
        check(f'{what}: the title has the font size and the weight of the real one', abs(d['real']['title']['size'] - d['fake']['title']['size']) < 1 and d['real']['title']['weight'] == d['fake']['title']['weight'], json.dumps([d['real']['title'], d['fake']['title']]))
        check(f'{what}: the metadata line has the font size of the real one', abs(d['real']['meta']['size'] - d['fake']['meta']['size']) < 1, json.dumps([d['real']['meta'], d['fake']['meta']]))
        check(f'{what}: and the text colours are the real ones', d['real']['title']['color'] == d['fake']['title']['color'] and d['real']['meta']['color'] == d['fake']['meta']['color'], json.dumps([d['real'], d['fake']]))

    def contrast(p):
        return p.eval(in_host("""
          const lum = (c) => { const [R, G, B] = c.match(/[\\d.]+/g).slice(0, 3).map((v) => { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * R + 0.7152 * G + 0.0722 * B; };
          const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
          const bg = getComputedStyle(document.documentElement).backgroundColor;
          const sel = r.querySelector('.title') ? ['.title', '.stats'] : ['.handle', '.text', '.ago'];
          const out = {bg, dark: document.documentElement.hasAttribute('dark')};
          for (const s of sel) { const e = r.querySelector(s); const c = getComputedStyle(e).color; out[s] = {color: c, ratio: Math.round(ratio(c, bg) * 10) / 10}; }
          return out; """))

    # watch-time accounting through the real message path (first of all: a video page that plays would report seconds of its own)
    env.reset()
    env.settings(debug=True, brk={'afterMinutes': 1, 'snoozeMinutes': 15}, subtitles={'autoCaptions': False})
    env.ctrl.eval("chrome.runtime.sendMessage({type: 'watch-tick', seconds: 90})")
    time.sleep(1.5)
    st = break_state()
    check('the service worker counts reported playback seconds', st and abs(st['accumSeconds'] - 90) < 1, json.dumps(st))
    env.storage_set(breakState=None)

    # ------------------------------------------------------------------------------------------------------------ 1. a list: the results of a search
    p = page('https://www.youtube.com/results?search_query=gregorian+chant', SEARCH_READY)
    snap = cmd(p, 'snapshot')
    check('no reminder before any watching: nothing is due and nothing is in the page', not snap['brk']['due'] and p.eval(f"!document.querySelector('{HOST}')"))
    ok = appear(p)
    check('a list page: the reminder appears in the list once it is due', ok)
    if ok:
        time.sleep(1)
        d = look(p)
        mark(p)
        check('it is a video, in the shape of a search result (a row)', d['ui'] == 'break-video' and d['layout'] == 'row', json.dumps(d)[:300])
        check('it is not the first: real videos stand before it, and after it', d['before'] >= 1 and d['after'] >= 1, f"{d['before']} before, {d['after']} after")
        check('it is the only one', d['n'] == 1)
        check('its title is one of the satirised ones, with the watched time filled in where the title asks for it', known_title(d['title'] or ''), d['title'])
        check('the title is at most 100 characters (YouTube\'s own limit)', len(d['title'] or '') <= 100, str(len(d['title'] or '')))
        check('the line under it says how long the user has been watching', d['stats'] == 'Watching for 1 hour 7 minutes', d['stats'])
        check('the length of the video is the watched time as a clock', d['badge'] == '1:07:00', d['badge'])
        check('the channel is called Vianney, as a channel row with its round picture', d['channel'] == 'Vianney')
        check('nothing visible says "reminder" or "extension", and nothing has a border: the portrait is the only tell', not re.search(r'reminder|extension', d['shadowText'], re.I) and d['borders'] == 0, f"{d['shadowText'][:200]} / borders {d['borders']}")
        check('for a screen reader it is labelled as the reminder it is', (d['aria'] or '').startswith('Break reminder from Vianney: ') and d['title'] in d['aria'], d['aria'])
        check('the portrait has loaded, in the thumbnail and in the round channel picture', len(d['imgs']) >= 2 and all(d['imgs']), json.dumps(d['imgs']))
        check('nothing of it is position: fixed', d['fixed'] == 0, str(d['fixed']))
        check('it has no link in it, and the card filter has not taken it for a card', d['links'] == 0 and not d['seen'] and d['state'] is None)
        snap = cmd(p, 'snapshot')
        check('the debug view of the filter does not list it among the cards it holds back, and the reminder sits at the place that the debug view says', not any((s.get('title') or '').startswith(d['title'][:20]) for s in snap['feed']['states']) and snap['brk']['ui']['shown'] and snap['brk']['ui']['kind'] == 'video' and snap['brk']['ui']['title'] == d['title'], json.dumps(snap['brk']['ui']))
        side_by_side(p, 'row', 'search result')
        hover(p, '.thumb')
        check('the two small buttons of a thumbnail show when the pointer is over it, as YouTube\'s do', p.eval(in_host("return getComputedStyle(r.querySelector('.quick')).opacity")) == '1')
        shot(p, 'break-list-hover-light')
        still_shot(p, 'break-list-light')
        c = contrast(p)
        check('light page: the text is dark on the light page', c and not c['dark'] and c['.title']['ratio'] >= 7 and c['.stats']['ratio'] >= 4.5, json.dumps(c))

        # it stays where it is, and is not rebuilt, for as long as the page is open: the loop of the extension runs every 1.5 s
        time.sleep(7)
        check('it stays: the same element, in the same place, with the same title, after seven seconds (four ticks of the loop)', still(p) and look(p)['title'] == d['title'] and look(p)['before'] == d['before'])
        # YouTube draws its lists again now and then and takes foreign elements out: the loop puts the item back where it was, and it has the same words
        p.eval(in_host("window.__next = h.nextElementSibling; window.__title = r.querySelector('.title').textContent; h.remove(); return true;"))
        back = wait_for(p, f"!!document.querySelector('{HOST}')", 6, 0.3)
        again = look(p)
        same_place = p.eval(in_host("return h.nextElementSibling === window.__next && r.querySelector('.title').textContent === window.__title;"))
        check('when YouTube takes the item out, the loop puts it back within two ticks: in the same place, with the same title', back and again and again['n'] == 1 and same_place is True, json.dumps(again)[:200] if again else 'gone')
        mark(p)
        # the watched time is rewritten in place
        due(7500)
        changed = wait_for(p, in_host("return r.querySelector('.stats').textContent === 'Watching for 2 hours 5 minutes' ? 'yes' : '';"), 8, 0.3)
        d2 = look(p)
        check('when the watch time changes the time is rewritten: the line, the clock and the sentence of the description', changed and d2['badge'] == '2:05:00' and 'You\'ve been watching for 2 hours 5 minutes.' in p.eval(in_host("return r.querySelector('.desc').textContent")), json.dumps([d2['stats'], d2['badge']]))
        check('... in place: no new element, no move, and the same title', still(p) and d2['title'] == d['title'] and d2['before'] == d['before'] and d2['n'] == 1)

        # a new place on the site is a new choice: the item is made again
        p.eval("history.pushState(null, '', '/results?search_query=bread'); window.dispatchEvent(new Event('yt-navigate-finish'))")
        time.sleep(3.5)
        d3 = look(p)
        check('a new place on the site (another address, yt-navigate-finish) makes a new choice: another element is put in the page, still just one', d3 is not None and not still(p) and d3['n'] == 1, json.dumps(d3)[:200] if d3 else 'nothing')
        p.eval("history.pushState(null, '', '/results?search_query=gregorian+chant')")

    # ------------------------------------------------------------------------------------------------------------ 2. the three dots, the thumbnail, the title
    due(4000)
    time.sleep(0.5)
    ok = wait_for(p, f"!!document.querySelector('{HOST}')", 10, 0.3)
    check('the reminder is there for the checks of the menu', ok)
    if ok:
        click(p, '.more')
        time.sleep(0.5)
        items = p.eval(in_host("const m = r.querySelector('.menu'); return {open: !m.hidden, items: [...m.querySelectorAll('.item')].map((e) => e.textContent.trim()), expanded: r.querySelector('.more').getAttribute('aria-expanded')};"))
        check('the three dots open a small menu with "Remind me later" and "Dismiss" and nothing else', items and items['open'] and items['items'] == ['Remind me later', 'Dismiss'] and items['expanded'] == 'true', json.dumps(items))
        top = p.eval(in_host("const m = r.querySelector('.menu'); const b = m.getBoundingClientRect(); const e = document.elementFromPoint(b.left + b.width / 2, b.top + 10); return {hit: e === h, z: h.style.zIndex};"))
        check('the menu is on top of the cards that follow (a click on it reaches it)', top and top['hit'], json.dumps(top))
        shot(p, 'break-menu-light')
        p.call('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': 'Escape', 'code': 'Escape', 'windowsVirtualKeyCode': 27})
        p.call('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': 'Escape', 'code': 'Escape', 'windowsVirtualKeyCode': 27})
        time.sleep(0.4)
        check('Escape closes the menu, and the item stays', p.eval(in_host("return r.querySelector('.menu').hidden")) is True)
        click(p, '.more')
        time.sleep(0.4)
        p.call('Input.dispatchMouseEvent', {'type': 'mousePressed', 'x': 30, 'y': 600, 'button': 'left', 'clickCount': 1})   # empty ground left of the page
        p.call('Input.dispatchMouseEvent', {'type': 'mouseReleased', 'x': 30, 'y': 600, 'button': 'left', 'clickCount': 1})
        time.sleep(0.4)
        check('a click anywhere else closes it too', p.eval(in_host("return r.querySelector('.menu').hidden")) is True)

        before = break_state()
        click(p, '.more'); time.sleep(0.4)
        click(p, '.item[data-act="later"]')
        check('"Remind me later" takes the item away at once', gone(p))
        after = answered(before)
        check('and moves the next reminder out by the snooze time (15 minutes of watching)', abs((after['nextDueSeconds'] - after['accumSeconds']) - 15 * 60) < 1 and after['nextDueSeconds'] > before['nextDueSeconds'], json.dumps([before, after]))
        time.sleep(4)
        check('it does not come back while no reminder is due', p.eval(f"!document.querySelector('{HOST}')"))

        due(4000)
        wait_for(p, f"!!document.querySelector('{HOST}')", 10, 0.3)
        before = break_state()
        click(p, '.more'); time.sleep(0.4)
        click(p, '.item[data-act="dismiss"]')
        check('"Dismiss" takes the item away at once', gone(p))
        after = answered(before)
        check('and moves the next reminder out by the full time between reminders (1 minute here)', abs((after['nextDueSeconds'] - after['accumSeconds']) - 1 * 60) < 1 and after['nextDueSeconds'] > before['nextDueSeconds'], json.dumps([before, after]))

        for what, sel in (('the thumbnail', '.thumb'), ('the title', '.title')):
            due(4000)
            wait_for(p, f"!!document.querySelector('{HOST}')", 10, 0.3)
            href = p.eval("location.href")
            before = break_state()
            click(p, sel)
            check(f'a click on {what} does what "Remind me later" does: the item goes', gone(p))
            after = answered(before)
            check(f'... the next reminder is {15} minutes of watching away, and nothing was opened (the address is the same)', abs((after['nextDueSeconds'] - after['accumSeconds']) - 15 * 60) < 1 and p.eval("location.href") == href, json.dumps([before, after]))

    # ------------------------------------------------------------------------------------------------------------ 3. the switches
    env.settings(brk={'afterMinutes': 1, 'snoozeMinutes': 15, 'showCard': False, 'showComment': False})
    due(4000)
    time.sleep(5)
    check('with "In video lists" and "In comments" off nothing appears on a list page', p.eval(f"!document.querySelector('{HOST}')"))
    env.settings(brk={'afterMinutes': 1, 'snoozeMinutes': 15, 'showCard': False, 'showComment': True})
    time.sleep(5)
    check('"In comments" alone puts nothing into a list (a list has no comments)', p.eval(f"!document.querySelector('{HOST}')"))
    env.settings(brk={'afterMinutes': 1, 'snoozeMinutes': 15, 'showCard': True, 'showComment': True})
    check('and "In video lists" on again brings it back', wait_for(p, f"!!document.querySelector('{HOST}')", 12, 0.3))
    env.settings(brk={'afterMinutes': 1, 'snoozeMinutes': 15, 'showCard': False, 'showComment': True})
    check('turning "In video lists" off takes a shown video away', gone(p, 6))
    env.settings(brk={'afterMinutes': 1, 'snoozeMinutes': 15})
    p.__exit__(None, None, None)

    # ------------------------------------------------------------------------------------------------------------ 4. a video page: the video among the recommendations, or the comment among the comments
    env.storage_set(breakState=None)
    p = page('https://www.youtube.com/watch?v=dQw4w9WgXcQ', "!!document.querySelector('video') && document.querySelectorAll('#related yt-lockup-view-model').length > 3", scroll=True)
    check('the comments of the video have loaded', p.eval("document.querySelectorAll('ytd-comment-thread-renderer').length") >= 5)
    seen_kinds = {}
    for kind in ('video', 'comment'):
        ok = appear(p, {'kind': kind, 'index': 2})
        check(f'a video page can show the {kind}', ok)
        if not ok:
            continue
        time.sleep(1)
        d = look(p)
        seen_kinds[kind] = d
        mark(p)
        if kind == 'video':
            check('the video stands among the recommendations next to the video, in their compact shape, and not first', d['ui'] == 'break-video' and d['layout'] == 'compact' and d['before'] >= 1 and d['after'] >= 1 and d['parent'].startswith('div#contents'), json.dumps(d)[:300])
            check('it is not the first of the list and the only item', d['n'] == 1)
            check('the portrait of the thumbnail has loaded', bool(d['imgs']) and all(d['imgs']), json.dumps(d['imgs']))
            side_by_side(p, 'compact', 'recommendation')
            check('a recommendation has no description and no channel row, so neither has the item', p.eval(in_host("return !r.querySelector('.desc') && !r.querySelector('.chrow')")))
            hover(p, '.vc')
            check('the three dots show when the pointer is over a recommendation, as on YouTube\'s', p.eval(in_host("return getComputedStyle(r.querySelector('.more')).opacity")) == '1')
            shot(p, 'break-related-hover-light')
            still_shot(p, 'break-related-light')
        else:
            check('the comment stands among the comments, and not first', d['ui'] == 'break-comment' and d['layout'] == 'comment' and d['before'] >= 1 and d['after'] >= 1 and d['parent'].startswith('div#contents'), json.dumps(d)[:300])
            check('it is the only one', d['n'] == 1)
            check('the handle is @Vianney and the age is "1 minute ago"', d['handle'] == '@Vianney' and d['ago'] == '1 minute ago', json.dumps([d['handle'], d['ago']]))
            check('the text says how long the user has been watching, and the standard sentence (no message of the user\'s own)', d['text'] == "You've been watching for 1 hour 7 minutes. This is a good moment to take a break.", d['text'])
            check('the comment has the round picture, a like and a dislike button and Reply, and nothing that names the extension', p.eval(in_host("return r.querySelectorAll('.ic').length === 2 && r.querySelector('.reply').textContent === 'Reply' && r.querySelector('.avatar img').naturalWidth > 0")) is True)
            check('for a screen reader it is labelled as the reminder it is', (d['aria'] or '').startswith('Break reminder from Vianney: '), d['aria'])
            check('nothing visible says "reminder" or "extension"; nothing is position: fixed; no link', not re.search(r'reminder|extension', d['shadowText'], re.I) and d['fixed'] == 0 and d['links'] == 0 and not d['seen'] and d['state'] is None, d['shadowText'][:200])
            # the real comment next to it: avatar, name, text, buttons in the same places
            m = p.eval(in_host("""
              const real = h.nextElementSibling.querySelector('ytd-comment-view-model');
              const num = (e, p) => parseFloat(getComputedStyle(e)[p]);
              const R = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left * 10) / 10, Math.round(b.width * 10) / 10]; };
              return {fakeAvatar: R(r.querySelector('.avatar')), realAvatar: R(real.querySelector('#author-thumbnail')), fakeHandle: num(r.querySelector('.handle'), 'fontSize'), realHandle: num(real.querySelector('#author-text'), 'fontSize'),
                      fakeHandleW: getComputedStyle(r.querySelector('.handle')).fontWeight, realHandleW: getComputedStyle(real.querySelector('#author-text')).fontWeight, fakeText: num(r.querySelector('.text'), 'fontSize'), realText: num(real.querySelector('#content-text'), 'fontSize'),
                      fakeAge: num(r.querySelector('.ago'), 'fontSize'), realAge: num(real.querySelector('#published-time-text'), 'fontSize'),
                      fakeMain: Math.round(r.querySelector('.main').getBoundingClientRect().left * 10) / 10, realMain: Math.round(real.querySelector('#main').getBoundingClientRect().left * 10) / 10,
                      fakeH: Math.round(r.querySelector('.vc').getBoundingClientRect().height), realH: Math.round(real.querySelector('#body').getBoundingClientRect().height)}; """))
            print(f"   comment: avatar real {m['realAvatar']} fake {m['fakeAvatar']}; handle {m['realHandle']}px/{m['realHandleW']} vs {m['fakeHandle']}px/{m['fakeHandleW']}; age {m['realAge']} vs {m['fakeAge']}px; text {m['realText']} vs {m['fakeText']}px; text column x {m['realMain']} vs {m['fakeMain']}")
            check('the comment has the avatar, the handle, the age and the text of the real one in the same sizes and the same places', m['fakeAvatar'] == m['realAvatar'] and m['fakeHandle'] == m['realHandle'] and m['fakeHandleW'] == m['realHandleW'] and m['fakeText'] == m['realText'] and m['fakeAge'] == m['realAge'] and m['fakeMain'] == m['realMain'], json.dumps(m))
            still_shot(p, 'break-comment-light')
        check(f'the {kind} stays where it is for seven seconds (the same element, before the same element)', (time.sleep(7) or True) and still(p) and look(p)['title'] == d['title'])
        if kind == 'comment':
            p.eval("history.replaceState(null, '', location.href + '&t=30s')")    # YouTube writes a time into the address when you jump to a chapter
            time.sleep(3.3)
            check('a time in the address of the video is no new place: the comment is not moved', still(p))
    check('both forms have been seen on a video page (the video in the list, and the comment)', set(seen_kinds) == {'video', 'comment'})

    # one at a time: forcing the other kind takes the first away
    appear(p, {'kind': 'video', 'index': 3})
    time.sleep(2)
    d = look(p)
    check('only one item at a time: when the video is chosen the comment is gone', d is not None and d['n'] == 1 and d['ui'] == 'break-video', json.dumps(d)[:200])
    env.settings(debug=False)
    time.sleep(1.5)
    try:
        cmd(p, 'break', {'kind': 'comment'}, timeout=2)
        answered = True
    except TimeoutError:
        answered = False
    check('the choice of the end-to-end test is heard only while debugging is on: with settings.debug off the debug interface does not answer', not answered)
    p.eval("document.documentElement.removeAttribute('data-vianney-cmd')")
    env.settings(debug=True)
    time.sleep(1.5)
    # the switches on a video page
    env.settings(brk={'afterMinutes': 1, 'snoozeMinutes': 15, 'showCard': True, 'showComment': False})
    time.sleep(1.5)
    cmd(p, 'break', {'kind': 'comment'})
    time.sleep(4)
    check('with "In comments" off a comment is never shown, even when the choice asks for it', p.eval(f"!document.querySelector('[data-vianney-ui=\"break-comment\"]')"))
    env.settings(brk={'afterMinutes': 1, 'snoozeMinutes': 15, 'showCard': False, 'showComment': True})
    time.sleep(1.5)
    cmd(p, 'break', {'kind': 'video'})
    time.sleep(4)
    check('with "In video lists" off a video is never shown, even when the choice asks for it', p.eval(f"!document.querySelector('[data-vianney-ui=\"break-video\"]')"))
    env.settings(brk={'afterMinutes': 1, 'snoozeMinutes': 15})
    cmd(p, 'break', {'kind': 'video', 'index': 3})
    time.sleep(2)
    mark(p)
    first = p.eval("location.search")
    p.eval("document.querySelector('#related yt-lockup-view-model a[href*=\"/watch?v=\"]').click()")        # a click on a recommended video: YouTube's own router goes there
    moved = wait_for(p, f"location.search !== {json.dumps(first)} ? 'yes' : ''", 20, 0.3)
    check('a click on a recommended video takes the page to another video (the site\'s own navigation, not a reload)', moved)
    key = lambda: '/watch' + p.eval("location.search").split('&')[0]
    end = time.time() + 30
    ui, d = None, None
    while time.time() < end:                    # the loop puts the item in where the new video's recommendations are: another element, once the page has changed
        ui = cmd(p, 'snapshot')['brk']['ui']
        d = look(p)
        if d and not still(p) and ui['loc'] == key() and ui['shown']:
            break
        time.sleep(1)
    time.sleep(3.2)                             # and it stays there
    d2 = look(p)
    check('on the next video the reminder is put in again as another element among the recommendations of that video (a new place is a new choice), and then stays', bool(d and d2) and d['n'] == 1 and d2['n'] == 1 and not still(p) and ui['loc'] == key() and d2['title'] == d['title'], json.dumps([d, d2, ui, key()])[:700])
    cmd(p, 'break', {})
    p.__exit__(None, None, None)
    env.storage_set(breakState=None)

    # ------------------------------------------------------------------------------------------------------------ 5. the grid of a hashtag page (the same grid as the home page, with the round channel pictures)
    p = page('https://www.youtube.com/hashtag/gregorianchant', "document.querySelectorAll('ytd-rich-item-renderer').length > 8")
    ok = appear(p)
    check('a grid of videos (the shape of the home page): the item appears', ok)
    if ok:
        time.sleep(1)
        d = look(p)
        check('it is a card of the grid, with the round channel picture, not first', d['layout'] == 'column' and d['before'] >= 1 and d['after'] >= 1 and d['parent'].startswith('div#contents'), json.dumps(d)[:250])
        mark(p)
        side_by_side(p, 'column', 'grid card')
        check('it has the width of its neighbours, so the rows of the grid are not broken', p.eval(in_host("return Math.abs(h.nextElementSibling.getBoundingClientRect().width - h.getBoundingClientRect().width) < 1;")) is True)
        still_shot(p, 'break-grid-light')
    p.__exit__(None, None, None)
    env.storage_set(breakState=None)

    # ------------------------------------------------------------------------------------------------------------ 6. the dark page
    for name, url, ready, layout, scroll in (('list', 'https://www.youtube.com/results?search_query=gregorian+chant', SEARCH_READY, 'row', False),
                                              ('related', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', "!!document.querySelector('video') && document.querySelectorAll('#related yt-lockup-view-model').length > 3", 'compact', False),
                                              ('comment', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', "!!document.querySelector('video')", 'comment', True)):
        p = page(url, ready, 'dark', scroll)
        ok = appear(p, {'kind': 'comment' if name == 'comment' else 'video', 'index': 2} if name != 'list' else None)
        check(f'dark page, {name}: the item appears', ok)
        if ok:
            time.sleep(3.2)      # two ticks of the loop: whatever was not drawn yet when the item was put in is read again
            c = contrast(p)
            check(f'dark page, {name}: the text is light on the dark page (contrast against the page, measured in the real page)', c and c['dark'] and all(v['ratio'] >= 4.5 for k, v in c.items() if k.startswith('.')), json.dumps(c))
            if layout != 'comment':
                side_by_side(p, layout, f'dark {name}')
            still_shot(p, f'break-{name}-dark')
        p.__exit__(None, None, None)
        env.storage_set(breakState=None)

    # ------------------------------------------------------------------------------------------------------------ 7. the switches on the settings page
    env.reset()
    env.settings(debug=True)
    o = Session().__enter__()
    o.call('Emulation.setDeviceMetricsOverride', {'width': 1100, 'height': 900, 'deviceScaleFactor': 1, 'mobile': False})
    o.goto(f'chrome-extension://{env.ext}/src/options/options.html#break', wait=1.6)
    labels = o.eval("[...document.querySelectorAll('#break .group')[1].querySelectorAll('.row .label')].map((l) => l.firstChild.textContent.trim())")
    check('the break reminder pane has "In video lists", "In comments" and "Message in the comment", and no banner any more', labels == ['In video lists', 'In comments', 'Message in the comment'] and o.eval("!document.getElementById('brk-banner')") is True, json.dumps(labels))
    state = lambda: env.ctrl.eval("chrome.storage.local.get('settings').then((r) => (r.settings || {}).brk || {})")
    check('both switches start on', o.eval("document.getElementById('brk-card').checked && document.getElementById('brk-comment').checked") is True)
    o.eval("document.getElementById('brk-comment').click()")
    time.sleep(0.8)
    saved = state()
    check('a click on "In comments" is saved as brk.showComment off, and "In video lists" is left on', saved.get('showComment') is False and saved.get('showCard') is not False, json.dumps(saved))
    o.eval("document.getElementById('brk-comment').click()")
    time.sleep(0.8)
    check('and on again', state().get('showComment') is True)
    o.eval("document.getElementById('brk-message').value = 'Go for a walk.'; document.getElementById('brk-message').dispatchEvent(new Event('change', {bubbles: true}))")
    time.sleep(0.8)
    check('the message is saved (it is the sentence in the comment)', state().get('message') == 'Go for a walk.', json.dumps(state()))
    o.__exit__(None, None, None)
    env.reset()


FAKE_CAPTIONS = {
    'events': [
        {'tStartMs': 1000, 'dDurationMs': 3000, 'segs': [{'utf8': 'well'}, {'utf8': ' this', 'tOffsetMs': 400}, {'utf8': ' is', 'tOffsetMs': 800}, {'utf8': ' [ __ ]', 'tOffsetMs': 1200}, {'utf8': ' great', 'tOffsetMs': 1800}]},
        {'tStartMs': 10000, 'dDurationMs': 3000, 'segs': [{'utf8': 'oh', 'tOffsetMs': 0}, {'utf8': ' my', 'tOffsetMs': 500}, {'utf8': ' god', 'tOffsetMs': 1000}, {'utf8': ' look', 'tOffsetMs': 1700}]},
    ]
}


def scenario_subtitles(env):
    print('\n== subtitles: captions from the player are parsed, planned and played')
    env.reset()
    env.settings(debug=True, subtitles={'autoCaptions': False})
    p = env.open_page('https://www.youtube.com/watch?v=dQw4w9WgXcQ', WATCH_READY)
    recognised = False
    for _ in range(40):
        snap = cmd(p, 'snapshot')
        if snap['watch']['videoId'] == 'dQw4w9WgXcQ':
            recognised = True
            break
        time.sleep(0.5)
    check('watch page recognised', recognised, json.dumps(snap['watch'])[:160])
    body = json.dumps(FAKE_CAPTIONS)
    p.eval(f"window.postMessage({{source: 'vianney-main', type: 'captions', info: {{v: 'dQw4w9WgXcQ', lang: 'en', kind: 'asr', fmt: 'json3'}}, body: {json.dumps(body)}}}, location.origin)")
    time.sleep(1.2)
    w = cmd(p, 'snapshot')['watch']
    check('captions accepted', w['captionStatus'] == 'loaded' and w['words'] >= 8, json.dumps(w)[:200])
    texts = sorted(d['text'].lower() for d in w['decisions'])
    check('the bleeped word and the exclamation were flagged', any('[ __ ]' in t for t in texts) and any('oh my god' in t for t in texts), str(texts))
    spans = w['spans']
    check('mute spans were planned with padding', len(spans) == 2 and all(s['action'] == 'mute-word' for s in spans), json.dumps(spans))
    # play: put the playhead inside and outside a span and look at the muted flag
    p.eval("(() => { const v = document.querySelector('video'); v.muted = false; v.pause(); window.__v = v; })()")
    start = spans[1]['start']
    p.eval(f"window.__v.currentTime = {start + 0.3}")
    inside = wait_for(p, "window.__v.muted === true", 4, 0.1)
    if inside is not True:                               # the player may have ignored the seek: once more
        p.eval(f"window.__v.currentTime = {start + 0.4}")
        inside = wait_for(p, "window.__v.muted === true", 5, 0.1)
    p.eval("window.__v.currentTime = 6")
    outside = wait_for(p, "window.__v.muted === false", 4, 0.1)
    check('the video is muted inside a span', inside is True)
    check('and unmuted again outside it', outside is True)
    # visible caption masking
    p.eval("""(() => { const c = document.createElement('div'); c.className = 'ytp-caption-window-container';
      const s = document.createElement('span'); s.className = 'ytp-caption-segment'; s.textContent = 'oh my god that was fucking close'; c.appendChild(s); document.body.appendChild(c); })()""")
    time.sleep(0.8)
    masked = p.eval("document.querySelector('.ytp-caption-segment').textContent")
    check('visible caption text is masked', 'fucking' not in masked and 'oh my god' not in masked.lower(), masked)
    # the video page warning
    cmd(p, 'snapshot')
    p.__exit__(None, None, None)


def scenario_live_captions(env):
    print('\n== live captions (informational): does the real player request reach the hook with a body?')
    env.reset()
    env.settings(debug=True, subtitles={'autoCaptions': True})
    p = env.open_page('https://www.youtube.com/watch?v=dQw4w9WgXcQ', WATCH_READY)
    w = {}
    for _ in range(50):
        w = cmd(p, 'snapshot')['watch']
        if w['captionStatus'] in ('loaded', 'empty', 'unreadable', 'unavailable'):
            break
        time.sleep(0.5)
    print('   caption status after the player was asked for captions:', w['captionStatus'], json.dumps(w.get('captionInfo')), 'words:', w['words'])
    check('the captions path reached a conclusion (loaded, or a named reason)', w['captionStatus'] != 'none', w['captionStatus'])
    p.__exit__(None, None, None)


CATHOLIC_QUERIES = [
    'catholic mass homily', 'rosary meditation', 'saint john vianney curé d\'ars', 'fulton sheen on prayer',
    'gregorian chant', 'catholic apologetics eucharist', 'divine mercy chaplet', 'jesus christ our lord sermon',
]


def scenario_falsepos(env):
    print('\n== false positives: reverent and religious content is left alone at the default settings (the faith rules are meant to catch non-Catholic preaching: a Protestant pastor\'s sermon may be hidden)')
    env.reset()
    faith = rule_names('belief', 'anticatholic')      # chosen on purpose by the owner: they catch what is not Catholic, so a result they hide is not a false alarm of the swearing rules
    for q in CATHOLIC_QUERIES:
        p = env.open_page('https://www.youtube.com/results?search_query=' + q.replace(' ', '+'), SEARCH_READY)
        snap = cmd(p, 'snapshot')
        flagged = [x for x in snap['feed']['states'] if x['reason'] not in faith]
        caught = [x for x in snap['feed']['states'] if x['reason'] in faith]
        check(f'nothing hidden for "{q}" by a rule that is not about faith ({len(caught)} hidden by the faith rules)', len(flagged) == 0, '; '.join(f"{s['reason']}: {s['title']}" for s in flagged[:4]))
        p.__exit__(None, None, None)
    # a Catholic channel that warns about the topic of an "against" rule (the owner named four): the channel name (word list catholic_channels, loaded by the real extension)
    # lowers a strong hit into the band, so that the words alone do not flag it; the same title from another channel is flagged as before
    env.settings(ruleEnabled={'divination': True, 'index_philosophers': True})
    p = env.open_page('https://www.youtube.com/results?search_query=gregorian+chant', SEARCH_READY)
    def verdict(title, channel):
        return {r['rule'] for r in cmd(p, 'evaluate', {'item': {'title': title, 'channel': channel}, 'surface': 'feed-card'}, timeout=30)['flagged']}
    check('the real extension: "Ouija Boards" from a stranger\'s channel is flagged by the words (divination)', 'divination' in verdict('Ouija Boards', 'Spooky Nights'))
    check('...and from Ascent of Mount Carmel it is not: a Catholic channel on the topic of the rule is most likely a warning', 'divination' not in verdict('Ouija Boards', 'Ascent of Mount Carmel') and 'divination' not in verdict('Ouija Boards', 'Apostolado Glórias de Maria'))
    check('a rule about books does not spare the channel: a Catholic channel that discusses the ideas of a philosopher of the Index is flagged (by the owner\'s definition)', 'index_philosophers' in verdict('David Hume on miracles: a lecture', 'Ascent of Mount Carmel') or 'index_philosophers' in verdict('David Hume: the problem of induction explained', 'Ascent of Mount Carmel'))
    check('...but a title about his life or his influence on others is not flagged by the words (the owner: "its about the life of the person David Hume (historical), not his works")', 'index_philosophers' not in verdict("David Hume's Influence on John Henry Newman", 'Ascent of Mount Carmel') and 'index_philosophers' not in verdict('The life of David Hume: a short biography', 'Spooky Nights'))
    check('a title with a Catholic word but a stranger\'s channel spares nothing', 'divination' in verdict('Ouija Boards: a Catholic girl tries it', 'Spooky Nights'))
    p.__exit__(None, None, None)


POSITIVE_QUERIES = ['omg oh my god reaction', 'celebrity drama exposed', 'bikini try on haul', 'fucking funny fails', 'casino slots big win']


def scenario_positives(env):
    print('\n== what is caught at the default settings (informational)')
    env.reset()
    for q in POSITIVE_QUERIES:
        p = env.open_page('https://www.youtube.com/results?search_query=' + q.replace(' ', '+'), SEARCH_READY)
        snap = cmd(p, 'snapshot')
        by = {}
        for s in snap['feed']['states']:
            by[s['reason']] = by.get(s['reason'], 0) + 1
        print(f'   "{q}": {len(snap["feed"]["states"])} hidden/marked of about {snap["feed"]["cards"] + len(snap["feed"]["states"])} cards  {by}')
        p.__exit__(None, None, None)


def scenario_watchmeta(env):
    print('\n== video page: a flagged title or description pauses the video behind a warning')
    env.reset()
    env.settings(debug=True, subtitles={'autoCaptions': False})
    p = env.open_page('https://www.youtube.com/watch?v=dQw4w9WgXcQ', WATCH_READY)
    clean = cmd(p, 'video', {'video': {'id': 'dQw4w9WgXcQ', 'title': 'A calm evening of chant', 'author': 'Choir', 'description': 'Vespers for Sunday.', 'keywords': ''}})
    check('a clean video gets no overlay', clean['watch']['overlay'] is False)
    flagged = cmd(p, 'video', {'video': {'id': 'dQw4w9WgXcQ', 'title': 'OMG oh my god you will not believe this', 'author': 'x', 'description': '', 'keywords': ''}})
    check('a strongly flagged title opens the warning overlay', flagged['watch']['overlay'] is True)
    shown = p.eval("(() => { const h = document.querySelector('[data-vianney-ui=\"overlay\"]'); if (!h) return null; const r = h.getBoundingClientRect(); return {w: Math.round(r.width), h: Math.round(r.height), text: h.shadowRoot.querySelector('h2').textContent, paused: document.querySelector('video').paused}; })()")
    check('it covers the player and names the rule', bool(shown) and shown['w'] > 300 and "God's name" in shown['text'], json.dumps(shown))
    check('and the video is paused behind it', bool(shown) and shown['paused'] is True)
    shot(p, 'overlay')
    p.eval("document.querySelector('[data-vianney-ui=\"overlay\"]').shadowRoot.querySelector('.watch').click()")
    gone = wait_for(p, "!document.querySelector('[data-vianney-ui=\"overlay\"]')", 5)
    check('"Watch anyway" removes the overlay', gone)
    p.__exit__(None, None, None)


SURFACES_ALL = {'feed': True, 'related': True, 'comments': True, 'watchMeta': True, 'subtitles': True}
STAGE_COMMENT_JS = "((n, text) => { const el = document.querySelectorAll('ytd-comment-view-model')[n]; const t = el.querySelector('#content-text'); (t.querySelector('span') || t).textContent = text; return true; })"
# a recommended video that is drawn and that the card finder knows (ids: the cards it found), marked data-staged; its title is replaced
STAGE_RELATED_JS = r'''((ids, text) => { const id = (l) => ((l.querySelector('a[href*="/watch?v="]') || {}).href || '').match(/[?&]v=([\w-]{11})/); const l = [...document.querySelectorAll('#related yt-lockup-view-model')].filter((x) => x.getBoundingClientRect().height > 0 && id(x) && ids.includes(id(x)[1]))[1]; l.setAttribute('data-staged', ''); const h = l.querySelector('h3'); h.title = text; const a = h.querySelector('a'); a.setAttribute('aria-label', text); (a.querySelector('span') || a).textContent = text; return id(l)[1]; })'''


def scenario_comments(env):
    """A real video page. The comments and the recommended videos on it are real; to be sure that a flagged one is there, the TEXT of one comment and
    of one recommended video is replaced in the page (the way YouTube itself fills it in), and the extension's real code judges it."""
    print('\n== video page: comments and recommended videos have a switch and an action of their own')
    env.reset()
    env.settings(debug=True, subtitles={'autoCaptions': False}, surfaces=dict(SURFACES_ALL))
    p = env.open_page('https://www.youtube.com/watch?v=dQw4w9WgXcQ', "!!document.querySelector('video') && !!document.querySelector('#related yt-lockup-view-model')")
    time.sleep(3)
    counts = p.eval("({drawn: [...document.querySelectorAll('#related yt-lockup-view-model')].filter((l) => l.getBoundingClientRect().height > 0).length, known: [...document.querySelectorAll('#related yt-lockup-view-model')].filter((l) => l.hasAttribute('data-vianney-seen')).length})")
    check('every recommended video next to the video is a card for the filter, the first ones too (the player holds copies of their links)', counts['drawn'] >= 8 and counts['known'] == counts['drawn'], json.dumps(counts))
    p.eval("window.scrollTo(0, 900)")
    time.sleep(2.5)
    p.eval("window.scrollTo(0, 1700)")
    n = wait_for(p, "document.querySelectorAll('ytd-comment-view-model').length >= 3 ? document.querySelectorAll('ytd-comment-view-model').length : 0", 25)
    check('the comments of the video load', bool(n) and n >= 3, str(n))
    snap = cmd(p, 'snapshot')
    check('the comment filter is armed and sees the comments', snap['comments']['armed'] and snap['comments']['count'] >= 3, json.dumps(snap['comments'])[:160])
    state = lambda i: p.eval(f"(() => {{ const el = document.querySelectorAll('ytd-comment-view-model')[{i}]; return {{state: el.dataset.vianneyState || null, reason: el.dataset.vianneyReason || null, kind: el.dataset.vianneyKind || null, badge: !!el.querySelector(':scope > .vianney-badge'), button: (el.querySelector(':scope > .vianney-badge button') || {{}}).textContent || null, body: getComputedStyle(el.querySelector('#body')).filter}}; }})()")

    # 1. a flagged comment is blurred, with a button
    p.eval(f"({STAGE_COMMENT_JS})(1, 'OMG oh my god this is insane')")
    p.eval(f"({STAGE_COMMENT_JS})(2, 'A calm evening of chant, thank you')")
    wait_for(p, "document.querySelectorAll('ytd-comment-view-model')[1].dataset.vianneyState || ''", 6)
    time.sleep(0.4)
    a, b = state(1), state(2)
    check('a comment that takes the name of God as an exclamation is blurred (the default action for comments)', a['state'] == 'blur' and a['kind'] == 'comment' and a['reason'] == "God's name in vain", json.dumps(a))
    check('the blur really is on the comment and the badge offers "Show"', 'blur' in (a['body'] or '') and a['badge'] and a['button'] == 'Show', json.dumps(a))
    check('a clean comment next to it is left alone', b['state'] is None and not b['badge'], json.dumps(b))
    shot(p, 'comment-blur')
    p.eval("document.querySelectorAll('ytd-comment-view-model')[1].querySelector(':scope > .vianney-badge button').click()")
    time.sleep(0.3)
    shown = state(1)
    check('"Show" brings the comment back, and the button says "Hide"', shown['state'] == 'revealed' and shown['button'] == 'Hide' and 'blur' not in (shown['body'] or ''), json.dumps(shown))
    p.eval("document.querySelectorAll('ytd-comment-view-model')[1].querySelector(':scope > .vianney-badge button').click()")
    time.sleep(0.3)
    check('and "Hide" blurs it again', state(1)['state'] == 'blur')
    logged = env.ctrl.eval("chrome.storage.local.get('log').then((r) => (r.log || []).filter((e) => e.surface === 'comment').map((e) => ({title: e.title, flagged: e.flagged, action: e.action, id: e.id})))")
    mine = [e for e in logged if 'oh my god' in (e.get('title') or '')]
    check('Activity logs it as a comment, with the rule and the action, and with no video to allow or block', bool(mine) and 'lords_name' in mine[0]['flagged'] and mine[0]['action'] == 'blur' and mine[0]['id'].startswith('comment:'), json.dumps(mine[:1]))

    # 2. another action: hide takes the whole thread
    env.settings(actions={'lords_name': {'comment': 'hide'}})
    wait_for(p, "document.querySelectorAll('ytd-comment-view-model')[1].closest('ytd-comment-thread-renderer').dataset.vianneyState === 'hide'", 6)
    gone = p.eval("(() => { const t = document.querySelectorAll('ytd-comment-view-model')[1].closest('ytd-comment-thread-renderer'); return {state: t.dataset.vianneyState, display: getComputedStyle(t).display}; })()")
    check('with the action "Hide" the whole thread of that comment is gone', gone['state'] == 'hide' and gone['display'] == 'none', json.dumps(gone))
    env.settings(actions={})

    # 3. the switch
    env.settings(surfaces={**SURFACES_ALL, 'comments': False})
    time.sleep(1.0)
    off = p.eval("({marked: document.querySelectorAll('[data-vianney-kind=comment]').length, armed: document.documentElement.hasAttribute('data-vianney-armed-comments')})")
    check('with the Comments switch off nothing is marked and nothing is held back', off['marked'] == 0 and not off['armed'], json.dumps(off))
    env.settings(surfaces=dict(SURFACES_ALL))
    wait_for(p, "document.querySelectorAll('ytd-comment-view-model')[1].dataset.vianneyState || ''", 6)
    check('and switched on again it is blurred again', state(1)['state'] == 'blur')

    # 4. recommended videos
    p.eval("window.scrollTo(0, 0)")
    time.sleep(1.5)
    ids = cmd(p, 'snapshot')['feed']['ids']
    staged = p.eval(f"({STAGE_RELATED_JS})({json.dumps(ids)}, 'OMG oh my god you will not believe this')")
    wait_for(p, "document.querySelector('[data-staged]').closest('[data-vianney-state]') ? 'x' : ''", 8)
    rel = lambda: p.eval("(() => { const l = document.querySelector('[data-staged]'); const c = l.closest('[data-vianney-state]'); return c ? {state: c.dataset.vianneyState, reason: c.dataset.vianneyReason, display: getComputedStyle(c).display} : null; })()")
    r = rel()
    why = p.eval("({staged: !!document.querySelector('[data-staged]'), lockups: document.querySelectorAll('#related yt-lockup-view-model').length, drawn: [...document.querySelectorAll('#related yt-lockup-view-model')].filter((l) => l.getBoundingClientRect().height > 0).length, title: (document.querySelector('[data-staged] h3') || {}).title, path: location.pathname})")
    why['settings'] = env.ctrl.eval("chrome.storage.local.get('settings').then((r) => r.settings.surfaces)")
    why['states'] = [x['state'] for x in cmd(p, 'snapshot')['feed']['states']][:5]
    check('a recommended video with a flagged title is hidden, by the action of the rule for cards', bool(r) and r['state'] == 'hide' and r['display'] == 'none' and r['reason'] == "God's name in vain", json.dumps([r, why]))
    logged = env.ctrl.eval("chrome.storage.local.get('log').then((r) => (r.log || []).filter((e) => /oh my god you will not/.test(e.title || '')).map((e) => e.surface))")
    check('Activity says "related": a recommendation, not a list', 'related' in logged, json.dumps(logged))
    env.settings(surfaces={**SURFACES_ALL, 'related': False})
    time.sleep(1.2)
    check('with the Recommended videos switch off it is shown again', rel() is None, json.dumps(rel()))
    env.settings(surfaces={**SURFACES_ALL, 'feed': False})
    wait_for(p, "document.querySelector('[data-staged]').closest('[data-vianney-state]') ? 'x' : ''", 6)
    r = rel()
    check('and the switch for lists and search results does not touch it', bool(r) and r['state'] == 'hide', json.dumps(r))
    env.settings(surfaces=dict(SURFACES_ALL))
    p.__exit__(None, None, None)

    # 5. the switches in the settings, and in the popup
    o = Session().__enter__()
    o.call('Emulation.setDeviceMetricsOverride', {'width': 1100, 'height': 900, 'deviceScaleFactor': 1, 'mobile': False})
    o.goto(f'chrome-extension://{env.ext}/src/options/options.html#subtitles', wait=1.6)
    rows = o.eval("[...document.querySelectorAll('#subtitles .group')[0].querySelectorAll('.row .label')].map((l) => l.firstChild.textContent.trim())")
    check('Scope lists lists, recommended videos, video page, comments and subtitles', rows == ['Lists and search results', 'Recommended videos', 'Video page', 'Comments', 'Subtitles'], json.dumps(rows))
    o.eval("document.getElementById('sub-comments').click()")
    time.sleep(0.6)
    saved = env.ctrl.eval("chrome.storage.local.get('settings').then((r) => r.settings.surfaces)")
    check('a click on the Comments switch is saved', saved.get('comments') is False and saved.get('related') is not False, json.dumps(saved))
    o.eval("document.getElementById('sub-comments').click()")
    time.sleep(0.4)
    o.eval("location.hash = '#rules/lords_name'")
    time.sleep(0.8)
    lines = o.eval("[...document.querySelectorAll('#rule-detail .acts-row .line:not(.reset)')].map((l) => l.querySelector('span').textContent + ': ' + l.querySelector('select').selectedOptions[0].textContent)")
    check('a rule page has an action for each surface it applies to, comments and recommended videos among them, each popup showing the action in force', 'Comments: Blur' in lines and 'Recommended videos: Hide' in lines, json.dumps(lines))
    o.__exit__(None, None, None)


def goto_hash(o, h, wait=0.6):
    o.eval(f"location.hash = {json.dumps(h)}")
    time.sleep(wait)


def scenario_options(env):
    print('\n== options: a compact list of rules in plain words; each rule opens on a page of its own')
    env.reset()
    o = Session().__enter__()
    o.call('Emulation.setDeviceMetricsOverride', {'width': 1180, 'height': 1000, 'deviceScaleFactor': 1, 'mobile': False})
    o.goto(f'chrome-extension://{env.ext}/src/options/options.html', wait=2)
    n = o.eval("document.querySelectorAll('#rule-list .rule-row').length")
    check('every rule is listed', n == rule_count(), f'{n} listed, {rule_count()} in the rule files')
    # the window: centred, at most 800 px wide, in the Calmet face, with the app icon
    box = o.eval("(() => { const r = document.querySelector('.app').getBoundingClientRect(); return {w: Math.round(r.width), left: Math.round(r.left), right: Math.round(innerWidth - r.right)}; })()")
    check('the settings are one window, 800 px wide and centred', box['w'] == 800 and abs(box['left'] - box['right']) <= 1, json.dumps(box))
    face = o.eval("(async () => { await document.fonts.load('italic 15px \"Calmet UI\"'); await document.fonts.ready; return {family: getComputedStyle(document.body).fontFamily.split(',')[0], loaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.style)}; })()")
    check('the type is Calmet UI, regular and italic, loaded from the extension', face['family'] == '"Calmet UI"' and sorted(set(face['loaded'])) == ['Calmet UI italic', 'Calmet UI normal'], json.dumps(face))
    icon = o.eval("(() => { const i = document.querySelector('.app-icon'); return {w: i.naturalWidth, ok: i.complete}; })()")
    check('the status card shows the app icon (the bust, 128 px)', icon['ok'] and icon['w'] == 128, json.dumps(icon))
    o.call('Emulation.setDeviceMetricsOverride', {'width': 420, 'height': 900, 'deviceScaleFactor': 1, 'mobile': False})
    time.sleep(0.4)
    narrow = o.eval("({over: document.documentElement.scrollWidth - document.documentElement.clientWidth, side: Math.round(document.querySelector('.sidebar').getBoundingClientRect().bottom) <= Math.round(document.querySelector('.content').getBoundingClientRect().top) + 1})")
    check('in a narrow window nothing scrolls sideways and the sidebar sits on top', narrow['over'] <= 0 and narrow['side'], json.dumps(narrow))
    o.call('Emulation.setDeviceMetricsOverride', {'width': 1180, 'height': 1000, 'deviceScaleFactor': 1, 'mobile': False})
    time.sleep(0.3)
    # choosing a section starts at the top of the window (the browser itself scrolls to the section that the address names)
    for sec in ('media', 'rules'):
        o.eval(f"location.hash = '#{sec}'")
        time.sleep(0.5)
    check('choosing a section leaves the page scrolled to the top', o.eval("scrollY") == 0, str(o.eval("scrollY")))
    height = o.eval("Math.round(document.querySelector('#rule-list .rule-row').getBoundingClientRect().height)")
    check('a rule takes one compact row (under 50 px high)', height < 50, f'{height} px')
    listed = o.eval("document.getElementById('rule-list').textContent")
    jargon = [w for w in ('feed-card', 'watch-meta', 'lexicon', 'Looks at:', 'flag at', 'subtitles =') if w in listed]
    check('the list is in plain words (no feed-card, watch-meta, lexicon, flag at)', not jargon, str(jargon))
    check('a row is the name and its switch, with no sentence under it', o.eval("document.querySelectorAll('#rule-list .rule-row .sub').length === 0 && [...document.querySelectorAll('#rule-list .rule-row')].every(r => r.querySelector('.title') && r.querySelector('.switch'))") is True)
    names = o.eval("[...document.querySelectorAll('#rule-list .rule-row .title')].map((t) => t.textContent.trim())")
    check('rows carry the plain name, not the traditional one', "God's name in vain" in names and "Taking the Lord's name in vain" not in names, str(names[:4]))
    groups = o.eval("[...document.querySelectorAll('#rule-list .rule-group .group-title')].map((t) => t.textContent.trim())")
    check('the sections come in the order the rule author chose: lewdness, swearing, talk about others, the religions (belief, anti-Catholicism), then games and excess', groups[:6] == ['Lewdness and immodesty', 'Swearing and cursing', 'Talk about other people', 'Unbelief and other religions', 'Anti-Catholicism', 'Games, shows and excess'], json.dumps(groups[:7]))
    o.eval("document.querySelector('#rule-view [data-view=examples]').click()")
    time.sleep(0.4)
    egs = o.eval("[...document.querySelectorAll('#rule-list .rule-row .eg')].filter(e => getComputedStyle(e).display !== 'none').length")
    check('"With examples" shows an example under every rule', egs == rule_count(), str(egs))
    o.eval("document.querySelector('#rule-view [data-view=compact]').click()")
    # opening a rule
    o.eval("[...document.querySelectorAll('#rule-list .rule-row')].find((r) => r.querySelector('.title').textContent.trim() === \"God's name in vain\").click()")
    time.sleep(0.7)
    check('clicking a rule opens it on a page of its own', o.eval("location.hash") == '#rules/lords_name' and o.eval("!document.getElementById('rule-detail').hidden && document.getElementById('rules').hidden") is True)
    check('it has a slider', o.eval("!!document.querySelector('#rule-detail input[type=range]')"))
    caught = o.eval("document.querySelectorAll('#rule-detail .eg-list .row.ok').length")
    spared = o.eval("document.querySelectorAll('#rule-detail .eg-list .row.skip').length")
    import re
    n_ex = len(re.findall(r'^\s+example:', re.search(r'^rule lords_name\n(.*?)(?=^rule |\Z)', open(os.path.join(EXT_DIR, 'rules', 'vianney.en.rules'), encoding='utf-8').read(), re.S | re.M).group(1), re.M))
    n_sp = len(re.findall(r'^\s+spared:', re.search(r'^rule lords_name\n(.*?)(?=^rule |\Z)', open(os.path.join(EXT_DIR, 'rules', 'vianney.en.rules'), encoding='utf-8').read(), re.S | re.M).group(1), re.M))
    check('it shows what it flags and what it leaves alone (the rule\'s own example and spared lines, one row each)', caught == n_ex and spared == n_sp and n_ex >= 3 and n_sp >= 3, f'{caught} flagged, {spared} left alone; the rule has {n_ex} and {n_sp}')
    tags = o.eval("[...document.querySelectorAll('#rule-detail .eg-list .row.ok .tag')].map(t => t.textContent)")
    check('and says for each example whether the word list does it alone (the second needs the AI)', tags == ['Word list', 'Needs AI', 'Word list'], str(tags))
    o.eval("(() => { const r = document.querySelector('#rule-detail input[type=range]'); r.value = 55; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); })()")
    time.sleep(0.8)
    saved = env.ctrl.eval("chrome.storage.local.get('settings').then(r => r.settings && r.settings.sensitivity)")
    check('moving the slider stores the new sensitivity', saved and any(abs(v - 0.55) < 1e-9 for v in saved.values()), json.dumps(saved))
    shot(o, 'options-rule')
    o.eval("document.querySelector('#rule-detail .back-link').click()")
    time.sleep(0.5)
    check('"Rules" leads back to the list', o.eval("document.getElementById('rule-detail').hidden && !document.getElementById('rules').hidden") is True)
    # the switch of a row changes the rule without opening it
    before = o.eval("document.querySelector('#rule-list .rule-row[data-rule=insults] input').checked")
    o.eval("document.querySelector('#rule-list .rule-row[data-rule=insults] input').click()")
    time.sleep(0.6)
    stored = env.ctrl.eval("chrome.storage.local.get('settings').then(r => r.settings.ruleEnabled)")
    check('the switch in a row turns a rule on or off without opening it', stored.get('insults') is (not before) and o.eval("location.hash") != '#rules/insults', json.dumps(stored))
    # search
    o.eval("(() => { const s = document.getElementById('search'); s.value = 'gamble'; s.dispatchEvent(new Event('input')); })()")
    time.sleep(0.5)
    rows = o.eval("[...document.querySelectorAll('#rule-list .rule-row')].map(r => r.dataset.rule)")
    check('searching narrows the list to what matches (by name, description or example)', rows == ['gambling'], str(rows))
    o.eval("(() => { const s = document.getElementById('search'); s.value = 'zzzz nothing'; s.dispatchEvent(new Event('input')); })()")
    time.sleep(0.4)
    check('and says so when nothing matches', 'No rule matches' in o.eval("document.getElementById('rule-list').textContent"))
    o.eval("(() => { const s = document.getElementById('search'); s.value = ''; s.dispatchEvent(new Event('input')); })()")
    time.sleep(0.4)
    # the sidebar
    items = o.eval("[...document.querySelectorAll('#nav .nav-item span:nth-child(2)')].map(e => e.textContent)")
    check('the sidebar lists the sections', items == ['Rules', 'Break reminder', 'Scope', 'Clean up', 'On-device AI', 'Images & Audio', 'Allow & Block', 'Activity', 'Test rules'], str(items))
    tiles = o.eval("[...document.querySelectorAll('#nav .tile svg')].length")
    check('each section has an icon', tiles == 9, str(tiles))
    o.eval("document.querySelector('#nav [data-pane=break]').click()")
    time.sleep(0.5)
    check('choosing a section shows it and marks it', o.eval("!document.getElementById('break').hidden && document.querySelector('#nav [data-pane=break]').getAttribute('aria-current') === 'page'") is True)
    # the test box
    o.eval("location.hash = '#test'")
    time.sleep(0.4)
    o.eval("document.getElementById('test-text').value = 'oh my god, this is fucking great'; document.getElementById('test-surface').value = 'feed-card'; document.getElementById('test-run').click()")
    time.sleep(1.5)
    res = o.eval("document.getElementById('test-result').textContent")
    check('the rule test shows which rules flag the text, by their plain names', 'Flagged' in res and "God's name in vain" in res, res[:200])
    check('the rule editor holds the shipped text', o.eval("document.getElementById('rules-text').value.includes('rule lords_name')"))
    shot(o, 'options')
    o.__exit__(None, None, None)


def scenario_resets(env):
    print('\n== reset to defaults: the actions and the sensitivity of a rule, each section, everything')
    env.reset()
    o = Session().__enter__()
    o.call('Emulation.setDeviceMetricsOverride', {'width': 1100, 'height': 1000, 'deviceScaleFactor': 1, 'mobile': False})
    stored = lambda key: env.ctrl.eval(f"chrome.storage.local.get('settings').then((r) => (r.settings || {{}})[{json.dumps(key)}])")

    loads = [0]

    def go(hash_, wait=1.3):
        # a new query makes it a new page: a change of the #address alone would keep the settings the old page read, and it would write them back
        loads[0] += 1
        o.goto(f'chrome-extension://{env.ext}/src/options/options.html?load={loads[0]}{hash_}', wait=wait)

    def pick(label, value):
        o.eval(f"""(() => {{ const l = [...document.querySelectorAll('#rule-detail .acts-row .line:not(.reset)')].find((x) => x.querySelector('span').textContent === {json.dumps(label)}); const s = l.querySelector('select'); s.value = {json.dumps(value)}; s.dispatchEvent(new Event('change')); }})()""")
        time.sleep(0.6)

    def shown(label):
        return o.eval(f"""(() => {{ const l = [...document.querySelectorAll('#rule-detail .acts-row .line:not(.reset)')].find((x) => x.querySelector('span').textContent === {json.dumps(label)}); return l.querySelector('select').selectedOptions[0].textContent; }})()""")

    def click(sel):
        o.eval(f"document.querySelector({json.dumps(sel)}).click()")

    def after_reload():
        time.sleep(0.8)
        wait_for(o, "document.readyState === 'complete' && !!document.querySelector('#nav .nav-item')", 8)
        time.sleep(0.5)

    # ---- one rule: the popups show what is in force, there is no "Default" entry, and a button in the block puts it back
    go('#rules/lords_name')
    popups = o.eval("[...document.querySelectorAll('#rule-detail .acts-row select')].map((s) => [...s.options].map((x) => x.value))")
    check('the Actions popups have no empty "Default" entry', bool(popups) and all('' not in p and len(p) >= 2 for p in popups), json.dumps(popups))
    check('each shows the action the rule says', shown('Comments') == 'Blur' and shown('Recommended videos') == 'Hide', f"{shown('Comments')}, {shown('Recommended videos')}")
    btn = "document.querySelector('#rule-detail .acts-row .line.reset button')"
    check('the block has a "Reset to defaults" button, and it is off while nothing was changed', o.eval(f"{btn}.textContent") == 'Reset to defaults' and o.eval(f"{btn}.disabled") is True)
    pick('Comments', 'hide')
    check('a choice is stored for that rule and surface only, and the button is on', stored('actions') == {'lords_name': {'comment': 'hide'}} and o.eval(f"{btn}.disabled") is False, json.dumps(stored('actions')))
    click('#rule-detail .acts-row .line.reset button')
    time.sleep(0.6)
    check('the button puts the popups and the stored choice back', stored('actions') == {} and shown('Comments') == 'Blur' and o.eval(f"{btn}.disabled") is True, f"{json.dumps(stored('actions'))}, {shown('Comments')}")
    pick('Comments', 'dim')
    pick('Comments', 'blur')
    check('choosing the action the rule says is no choice at all', stored('actions') == {} and o.eval(f"{btn}.disabled") is True, json.dumps(stored('actions')))
    # the sensitivity block says the same
    o.eval("""(() => { const r = document.querySelector('#rule-detail input[type=range]'); r.value = 30; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); })()""")
    time.sleep(0.6)
    labels = o.eval("[...document.querySelectorAll('#rule-detail .presets button')].map((b) => b.textContent)")
    sbtn = "[...document.querySelectorAll('#rule-detail .presets button')].find((b) => b.textContent === 'Reset to defaults')"
    check('the sensitivity block offers "Reset to defaults" and no "Default (...)"', 'Reset to defaults' in labels and not any(x.startswith('Default') for x in labels), json.dumps(labels))
    check('a changed sensitivity is stored and the button is on', stored('sensitivity') == {'lords_name': 0.3} and o.eval(f"{sbtn}.disabled") is False, json.dumps(stored('sensitivity')))
    o.eval(f"{sbtn}.click()")
    time.sleep(0.8)
    check('the button removes it again', stored('sensitivity') == {}, json.dumps(stored('sensitivity')))
    shot(o, 'options-rule-reset')

    # ---- a section: the break reminder (no question asked), and nothing of another section changes
    env.settings(surfaces={'feed': True, 'related': True, 'comments': False, 'watchMeta': True, 'subtitles': True}, brk={'afterMinutes': 45, 'message': 'Rest a little'}, cleanup={'shorts': False})
    go('#break')
    check('before: the break pane shows the user\'s 45 minutes', o.eval("document.getElementById('brk-after').value") == '45')
    check('the pane ends with a "Reset to defaults" button', o.eval("document.querySelector('#break .reset-row button').textContent") == 'Reset to defaults')
    click('#break .reset-row button')
    after_reload()
    brk = stored('brk')
    check('the break reminder is back at 120 minutes with no message, in the store and on the page', brk['afterMinutes'] == 120 and brk.get('message') == '' and o.eval("document.getElementById('brk-after').value") == '120', json.dumps(brk))
    check('another section is not touched', stored('surfaces')['comments'] is False and stored('cleanup')['shorts'] is False, json.dumps([stored('surfaces'), stored('cleanup')['shorts']]))
    check('the toolbar says what happened', 'break reminder' in o.eval("document.getElementById('toolbar-note').textContent").lower(), o.eval("document.getElementById('toolbar-note').textContent"))
    # Scope and Clean up
    go('#subtitles')
    click('#subtitles .reset-row button')
    after_reload()
    check('Scope: every switch is on again, and the page shows it', all(v is True for v in stored('surfaces').values()) and o.eval("document.getElementById('sub-comments').checked") is True, json.dumps(stored('surfaces')))
    go('#cleanup')
    click('#cleanup .reset-row button')
    after_reload()
    check('Clean up: the Shorts switch is back on', stored('cleanup')['shorts'] is True and o.eval("document.getElementById('cl-shorts').checked") is True)

    # ---- what would lose the user's own work asks first: the rules and the lists
    env.settings(ruleEnabled={'lords_name': False}, sensitivity={'lords_name': 0.3}, actions={'lords_name': {'comment': 'hide'}}, lists={'allowVideos': [], 'allowChannels': ['Good Channel'], 'denyVideos': [], 'denyChannels': ['Bad Channel']})
    go('#rules')
    click('#rules .reset-row button')
    time.sleep(0.4)
    ask = o.eval("(() => { const r = document.querySelector('#rules .reset-row'); return {text: r.querySelector('p') && r.querySelector('p').textContent, buttons: [...r.querySelectorAll('button')].map((b) => b.textContent)}; })()")
    check('the Rules reset asks first, with Reset and Cancel, and has changed nothing yet', ask['buttons'] == ['Reset', 'Cancel'] and 'rule' in (ask['text'] or '') and stored('ruleEnabled') == {'lords_name': False}, json.dumps(ask))
    o.eval("[...document.querySelectorAll('#rules .reset-row button')].find((b) => b.textContent === 'Cancel').click()")
    time.sleep(0.3)
    check('Cancel leaves everything as it was and the button is back', o.eval("document.querySelector('#rules .reset-row button').textContent") == 'Reset to defaults' and stored('sensitivity') == {'lords_name': 0.3})
    click('#rules .reset-row button')
    time.sleep(0.3)
    o.eval("[...document.querySelectorAll('#rules .reset-row button')].find((b) => b.textContent === 'Reset').click()")
    after_reload()
    check('Reset: the switches, the sensitivities, the actions and the rule text are the shipped ones', stored('ruleEnabled') == {} and stored('sensitivity') == {} and stored('actions') == {} and stored('rulesText') is None, json.dumps([stored('ruleEnabled'), stored('sensitivity'), stored('actions'), stored('rulesText')]))
    check('and the lists, which are another section, are still the user\'s', stored('lists')['denyChannels'] == ['Bad Channel'])
    go('#lists')
    click('#lists .reset-row button')
    time.sleep(0.3)
    check('the lists ask too, and say what goes', 'allow and block lists' in o.eval("document.querySelector('#lists .reset-row p').textContent"))
    o.eval("[...document.querySelectorAll('#lists .reset-row button')].find((b) => b.textContent === 'Reset').click()")
    after_reload()
    check('the lists are empty', stored('lists') == {'allowVideos': [], 'allowChannels': [], 'denyVideos': [], 'denyChannels': []}, json.dumps(stored('lists')))

    # ---- everything, from the foot of the sidebar: settings go, the log, the watch time and the test switch stay
    env.settings(enabled=False, brk={'afterMinutes': 5}, ai={'enabled': False}, media={'enabled': True}, ruleEnabled={'lords_name': False}, lists={'allowVideos': [], 'allowChannels': [], 'denyVideos': [], 'denyChannels': ['Bad Channel']}, debug=True)
    env.ctrl.eval("chrome.storage.local.set({log: [{t: 1, id: 'x', surface: 'feed-card', title: 'kept', flagged: false}], breakState: {periodKey: 'session', accumSeconds: 77, lastPlayMs: 1, nextDueSeconds: 99}})")
    go('#rules')
    check('the foot of the sidebar has a button for everything', o.eval("document.querySelector('.sidebar-foot .reset-row button').textContent") == 'Reset all settings')
    click('.sidebar-foot .reset-row button')
    time.sleep(0.3)
    check('it asks first and says what stays', o.eval("document.querySelector('.sidebar-foot .reset-row p').textContent").count('log') == 1 and stored('enabled') is False)
    o.eval("[...document.querySelectorAll('.sidebar-foot .reset-row button')].find((b) => b.textContent === 'Reset').click()")
    after_reload()
    s = env.ctrl.eval("chrome.storage.local.get(['settings', 'log', 'breakState']).then((r) => r)")
    st = s['settings']
    check('every setting is the shipped one again', st['enabled'] is True and st['brk']['afterMinutes'] == 120 and st['ai']['enabled'] is True and st['media']['enabled'] is False and st['ruleEnabled'] == {} and st['lists']['denyChannels'] == [], json.dumps({k: st[k] for k in ('enabled', 'ai', 'ruleEnabled')}))
    check('the test switch was not touched', st.get('debug') is True)
    check('the activity log and the watch time are still there', len(s['log']) == 1 and s['log'][0]['title'] == 'kept' and s['breakState']['accumSeconds'] == 77, json.dumps([s['log'], s['breakState']]))
    check('the sidebar switch shows it', o.eval("document.getElementById('enabled').checked") is True)
    o.__exit__(None, None, None)


MUSIC_IDS_JS = """(() => { const out = []; for (const c of document.querySelectorAll('ytd-video-renderer, yt-lockup-view-model')) { const a = c.querySelector('a[href*="/watch?v="]'); const id = a && (a.getAttribute('href').match(/v=([\\w-]{11})/) || [])[1];
  if (!id) continue; const note = [...c.querySelectorAll('badge-shape')].some((b) => b.querySelector('svg') && /^\\s*(\\d+:)?\\d{1,2}:\\d\\d\\s*$/.test(b.textContent));
  out.push({id, music: note || !!c.querySelector('[aria-label="Official Artist Channel"]'), plain: [...c.querySelectorAll('badge-shape')].some((b) => !b.querySelector('svg') && /^\\s*(\\d+:)?\\d{1,2}:\\d\\d\\s*$/.test(b.textContent))}); } return out; })()"""


def scenario_music(env):
    print('\n== music: YouTube marks music itself (a note on the length, the badge of an official artist channel); the option in Clean up hides it')
    env.reset()
    env.settings(debug=True, cleanup={'music': True})
    p = env.open_page('https://www.youtube.com/results?search_query=taylor+swift+official+music+video', SEARCH_READY)
    time.sleep(2.0)
    marks = p.eval(MUSIC_IDS_JS)
    snap = cmd(p, 'snapshot')
    hidden = {x['id'] for x in snap['feed']['states'] if x['state'] == 'hide' and x['reason'] == 'Music video'}
    music = {m['id'] for m in marks if m['music']}
    check('the search shows music videos, marked by YouTube', len(music) >= 8, f'{len(music)} of {len(marks)} cards')
    check('every card with YouTube\'s music mark is hidden, with the reason "Music video"', bool(music) and music <= hidden, f'marked {len(music)}, hidden {len(hidden)}, not hidden: {sorted(music - hidden)[:3]}')
    check('and nothing that has no mark is hidden for being music', hidden <= music, f'hidden without a mark: {sorted(hidden - music)[:3]}')
    log = env.ctrl.eval("chrome.storage.local.get('log').then(r => (r.log || []).filter((e) => e.via === 'mark').length)")
    check('the Activity log says that it was a mark, not a rule', log >= 1, str(log))
    shot(p, 'music-hidden')
    # an allowed video is not hidden for being music
    keep = sorted(music)[0]
    env.settings(debug=True, cleanup={'music': True}, lists={'allowVideos': [keep], 'allowChannels': [], 'denyVideos': [], 'denyChannels': []})
    time.sleep(2.5)
    state = p.eval(f"(() => {{ const a = [...document.querySelectorAll('a[href*=\"{keep}\"]')][0]; const c = a && a.closest('[data-vianney-state]'); return c ? c.dataset.vianneyState : 'none'; }})()")
    check('a video on the allow list stays, music or not', state in ('none', None) or state != 'hide', str(state))
    p.__exit__(None, None, None)

    # off: nothing is hidden for being music
    env.settings(debug=True, cleanup={'music': False}, lists={'allowVideos': [], 'allowChannels': [], 'denyVideos': [], 'denyChannels': []})
    p = env.open_page('https://www.youtube.com/results?search_query=taylor+swift+official+music+video', SEARCH_READY)
    time.sleep(2.0)
    snap = cmd(p, 'snapshot')
    check('with the option off no card is hidden for being music (the default)', not [x for x in snap['feed']['states'] if x['reason'] == 'Music video'], json.dumps(snap['feed']['states'])[:200])
    p.__exit__(None, None, None)

    # not music: left alone, with the option on
    env.settings(debug=True, cleanup={'music': True})
    p = env.open_page('https://www.youtube.com/results?search_query=how+to+cook+pasta+tutorial', SEARCH_READY)
    time.sleep(2.0)
    snap = cmd(p, 'snapshot')
    check('a search for cooking has no music mark and nothing is hidden', not [x for x in snap['feed']['states'] if x['reason'] == 'Music video'], json.dumps(snap['feed']['states'])[:200])
    p.__exit__(None, None, None)

    # the recommendations of a music video
    p = env.open_page('https://www.youtube.com/watch?v=dQw4w9WgXcQ', WATCH_READY)
    p.eval('window.scrollBy(0, 300)')
    time.sleep(3.0)
    marks = p.eval(MUSIC_IDS_JS)
    snap = cmd(p, 'snapshot')
    hidden = {x['id'] for x in snap['feed']['states'] if x['state'] == 'hide' and x['reason'] == 'Music video'}
    music = {m['id'] for m in marks if m['music']}
    check('next to a music video the recommended music videos are hidden too', len(music) >= 4 and len(hidden & music) >= max(3, len(music) - 2) and hidden <= music, f'marked {len(music)}, hidden {len(hidden)}')
    p.__exit__(None, None, None)

    # the settings page: a switch in Clean up, off, and it is saved
    o = Session().__enter__()
    o.call('Emulation.setDeviceMetricsOverride', {'width': 1100, 'height': 1000, 'deviceScaleFactor': 1, 'mobile': False})
    env.reset()
    o.goto(f'chrome-extension://{env.ext}/src/options/options.html#cleanup', wait=1.6)
    check('Clean up has a switch for music videos, and it is off', o.eval("document.getElementById('cl-music') && document.getElementById('cl-music').checked === false") is True)
    o.eval("document.getElementById('cl-music').click()")
    time.sleep(0.6)
    saved = env.ctrl.eval("chrome.storage.local.get('settings').then((r) => r.settings.cleanup.music)")
    check('a click saves it', saved is True, str(saved))
    o.eval("document.querySelector('#cleanup .reset-row button').click()")
    time.sleep(1.4)
    saved = env.ctrl.eval("chrome.storage.local.get('settings').then((r) => r.settings.cleanup.music)")
    check('and the reset of the Clean up section puts it back to off', saved is False, str(saved))
    o.__exit__(None, None, None)


def scenario_ai(env):
    print('\n== ai: where does the Prompt API exist, and what does it say here?')
    o = Session().__enter__()
    o.goto(f'chrome-extension://{env.ext}/src/options/options.html', wait=1.5)
    info = o.eval("""(async () => { const out = {page: typeof LanguageModel};
      if (typeof LanguageModel !== 'undefined') { try { out.availability = await LanguageModel.availability({expectedInputs:[{type:'text',languages:['en']}], expectedOutputs:[{type:'text',languages:['en']}]}); } catch (e) { out.err = String(e); } }
      const r = await chrome.runtime.sendMessage({type: 'ai-status', force: true}); out.sw = r; return out; })()""")
    print('   options page:', json.dumps(info))
    check('the service worker answers the AI status request', info.get('sw') is not None)
    o.__exit__(None, None, None)



THUMB_ID_JS = """(() => { const out = []; for (const i of document.querySelectorAll('img')) {
  const m = (i.getAttribute('src') || '').match(/ytimg\\.com\\/vi(?:_webp|_lc)?\\/([\\w-]{11})\\//); if (m && !out.includes(m[1])) out.push(m[1]); } return out; })()"""


def sha_of_thumbnail(env, vid):
    """SHA-256 of the same picture the service worker fetches (the control page may read it: the image server allows any origin)."""
    return env.ctrl.eval(f"(async () => {{ const r = await fetch('https://i.ytimg.com/vi/{vid}/mqdefault.jpg'); "
                         "const d = await crypto.subtle.digest('SHA-256', await r.arrayBuffer()); "
                         "return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join(''); })()")


def scenario_media_options(env):
    print('\n== media options: the experimental section renders, saves and explains itself')
    env.reset()
    o = Session().__enter__()
    o.call('Emulation.setDeviceMetricsOverride', {'width': 1100, 'height': 1000, 'deviceScaleFactor': 1, 'mobile': False})
    o.goto(f'chrome-extension://{env.ext}/src/options/options.html', wait=2)
    check('the section exists and is off by default', o.eval("!!document.getElementById('media-enabled') && !document.getElementById('media-enabled').checked"))
    status = wait_for(o, "(() => { const t = document.getElementById('media-status').textContent; return t.includes('Images:') && t.includes('Audio:') ? t : ''; })()", 20) or o.eval("document.getElementById('media-status').textContent")
    check('it reports the model status for images and for audio', 'Images:' in status and 'Audio:' in status, status)
    marked = o.eval("[...document.querySelectorAll('#rule-list .rule-row')].filter(r => r.querySelector('.pill.exp')).map(r => r.querySelector('.title').textContent)")
    check('the image and audio rules are listed and marked experimental', len(marked) == 6, str(marked))
    summary = o.eval("document.getElementById('rules-summary').textContent")
    enabled = rule_count('enabled')
    check('while the feature is off, the rule count says that those rules are inactive', f'{enabled} of {rule_count()} on' in summary and 'inactive until Images & Audio is on' in summary, summary)
    goto_hash(o, '#rules/explicit_images')
    reach = o.eval("document.querySelector('#rule-detail .reach').textContent")
    check('an image rule explains its slider in prompts that must say yes', 'prompts' in reach and 'say yes' in reach, reach)
    o.eval("document.getElementById('media-enabled').click()")
    time.sleep(0.8)
    m = env.ctrl.eval("chrome.storage.local.get('settings').then(r => r.settings.media)")
    check('the master switch is stored', bool(m) and m.get('enabled') is True, json.dumps(m))
    o.eval("(() => { const e = document.getElementById('au-window'); e.value = 99; e.dispatchEvent(new Event('change')); })()")
    time.sleep(0.6)
    m = env.ctrl.eval("chrome.storage.local.get('settings').then(r => r.settings.media)")
    check('a number is clamped to its range before it is stored', m['audio']['windowSeconds'] == 20, json.dumps(m['audio']))
    o.eval("(() => { const t = document.getElementById('list-denyVideos'); t.value = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5\\nnot a video\\nhttps://youtu.be/aaaaaaaaaaa'; t.dispatchEvent(new Event('change')); })()")
    time.sleep(0.6)
    lists = env.ctrl.eval("chrome.storage.local.get('settings').then(r => r.settings.lists)")
    check('a video list takes addresses and keeps only the ids', lists['denyVideos'] == ['dQw4w9WgXcQ', 'aaaaaaaaaaa'], json.dumps(lists))
    note = o.eval("document.getElementById('list-messages').textContent")
    check('and says which line it left out', 'not a video' in note, note)
    o.eval("(() => { const t = document.getElementById('list-allowChannels'); t.value = 'Some Channel\\n# a comment\\n'; t.dispatchEvent(new Event('change')); })()")
    time.sleep(0.5)
    lists = env.ctrl.eval("chrome.storage.local.get('settings').then(r => r.settings.lists)")
    check('a channel list keeps names and skips comments', lists['allowChannels'] == ['Some Channel'], json.dumps(lists))
    o.eval("document.getElementById('media-run').click()")
    time.sleep(0.5)
    check('the file test asks for a file first', 'Choose a file' in o.eval("document.getElementById('media-result').textContent"))
    goto_hash(o, '#rules/immodest_images')
    opts = o.eval("""(() => { const s = document.querySelector('#rule-detail .acts-row select'); return s ? [...s.options].map(x => x.value) : null; })()""")
    check('a picture rule offers a choice of what to do, with "blackout" among them, and no empty "Default" entry', bool(opts) and 'blackout' in opts and '' not in opts, str(opts))
    o.eval("""(() => { const s = document.querySelector('#rule-detail .acts-row select'); s.value = 'blackout'; s.dispatchEvent(new Event('change')); })()""")
    time.sleep(0.6)
    acts = env.ctrl.eval("chrome.storage.local.get('settings').then(r => r.settings.actions)")
    check('the choice is stored for that rule and surface only', acts == {'immodest_images': {'thumbnail': 'blackout'}}, json.dumps(acts))
    o.eval("""(() => { const s = document.querySelector('#rule-detail .acts-row select'); s.value = 'blur'; s.dispatchEvent(new Event('change')); })()""")
    time.sleep(0.6)
    acts = env.ctrl.eval("chrome.storage.local.get('settings').then(r => r.settings.actions)")
    check('choosing what the rule itself says (blur) is not a choice of the user\'s, so it removes the entry again', acts == {}, json.dumps(acts))
    goto_hash(o, '#rules/lords_name')
    text_opts = o.eval("""[...document.querySelectorAll('#rule-detail .acts-row select')].map(s => [...s.options].map(x => x.value).join(','))""")
    check('text rules get one choice per surface (lists, recommended videos, comments, the video page, subtitles), each with that surface\'s own actions', bool(text_opts) and len(text_opts) == 5 and 'blackout' not in ','.join(text_opts), str(text_opts))
    shot(o, 'options-media')
    o.__exit__(None, None, None)


def scenario_media_thumbnails(env):
    print('\n== media thumbnails: real thumbnails, a fake model; hold, hide, lists, cache, fail-open')
    env.reset()
    print('   fake model:', env.install_fake())
    env.settings(debug=True, media={'enabled': False})
    p = env.open_page('https://www.youtube.com/results?search_query=gregorian+chant+vespers', SEARCH_READY)
    ids = []
    for _ in range(20):
        ids = p.eval(THUMB_ID_JS)
        if len(ids) >= 5:
            break
        p.eval('window.scrollBy(0, 600)')   # YouTube loads thumbnails lazily, a few screens at a time
        time.sleep(0.6)
    p.eval('window.scrollTo(0, 0)')
    check('the page shows several thumbnails', len(ids) >= 4, str(ids))
    card_ids = cmd(p, 'snapshot')['feed']['ids']
    both = [i for i in ids if i in card_ids]          # thumbnails that sit in a video card the feed filter recognises
    check('most of them sit in recognised video cards', len(both) >= 4, f'{len(both)} of {len(ids)}: cards {len(card_ids)}')
    if len(both) < 4:
        p.__exit__(None, None, None)
        return
    bad, good = both[0], both[1]
    h_bad = sha_of_thumbnail(env, bad)
    env.fake(f"__fake.imageYes = [{{hash: {json.dumps(h_bad)}, q: 'naked'}}]")
    snap = cmd(p, 'snapshot')
    check('with the feature off nothing is held or judged', snap['thumbs']['active'] is False and snap['thumbs']['hold'] is False and not env.fake_log('image'))

    # switch it on
    env.settings(debug=True, media={'enabled': True, 'votes': 2, 'thumbnails': {'enabled': True, 'hold': True, 'holdSeconds': 40, 'maxPerPage': 60, 'nearViewOnly': False}, 'audio': {'enabled': False}})

    def state_of(vid):
        for c in cmd(p, 'snapshot')['thumbs']['cards']:
            if c['id'] == vid:
                return c
        return None

    ok = wait_for(p, "document.documentElement.hasAttribute('data-vianney-hold')", 10)
    check('while the check is active, unchecked thumbnails are held back', ok is True)
    done = None
    end = time.time() + 40
    while time.time() < end:
        c = state_of(bad)
        if c and c['state'] == 'done':
            done = c
            break
        time.sleep(0.7)
    check('the flagged picture was judged', done is not None, json.dumps(state_of(bad)))
    if done:
        check('and its card is hidden by the "nudity" rule (action hide)', done['thumb'] == 'hide', json.dumps(done))
        check('with the full score from both prompt wordings', done['ps'] and abs(done['ps'].get('explicit_images', 0) - 1) < 1e-9, json.dumps(done['ps']))
    g = None
    end = time.time() + 30
    while time.time() < end:
        g = state_of(good)
        if g and g['state'] == 'done':
            break
        time.sleep(0.7)
    check('another thumbnail was judged and left alone', bool(g) and g['state'] == 'done' and g['thumb'] is None, json.dumps(g))
    shown = p.eval(f"""(() => {{ const i = [...document.querySelectorAll('img')].find(x => (x.getAttribute('src')||'').includes('/{good}/')); return i ? getComputedStyle(i).visibility : null; }})()""")
    check('a judged, clean thumbnail is visible again', shown == 'visible', str(shown))

    log = env.fake_log('image')
    check('the model received real pictures, not placeholders', len(log) >= 4 and all(r['bytes'] > 1500 and r['mime'].startswith('image/') for r in log), json.dumps(log[:2]))
    questions = {r['q'] for r in log}
    check('the questions of the picture rules reached the model', any('naked person' in q for q in questions) and any('underwear' in q for q in questions), '; '.join(sorted(questions))[:300])
    check('hidden cards are counted for the badge', cmd(p, 'snapshot')['feed']['hidden'] >= 1)
    stored = env.ctrl.eval("chrome.storage.local.get('mediaCache').then(r => Object.keys(r.mediaCache || {}).length)")
    check('verdicts are remembered by the service worker', stored >= 4, str(stored))
    logged = env.ctrl.eval("chrome.storage.local.get('log').then(r => (r.log||[]).filter(e => e.surface === 'thumbnail' && e.flagged.length).map(e => e.id))")
    check('the flagged thumbnail is in the log', bad in logged, str(logged))
    shot(p, 'media-thumbnails')

    # "blackout": the picture is replaced by pure black, the card and its title stay
    media_on = {'enabled': True, 'votes': 2, 'thumbnails': {'enabled': True, 'hold': True, 'holdSeconds': 40, 'maxPerPage': 60, 'nearViewOnly': False}, 'audio': {'enabled': False}}

    def thumb_look(vid):
        return p.eval(f"""(() => {{ const img = [...document.querySelectorAll('img')].find(i => (i.getAttribute('src') || '').includes('/{vid}/'));
          if (!img) return null; img.scrollIntoView({{block: 'center'}}); const r = img.getBoundingClientRect(); const c = img.closest('[data-vianney-thumb], [data-vianney-state]');
          return {{x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, filter: getComputedStyle(img).filter, shown: !c || getComputedStyle(c).display !== 'none', thumb: c ? c.dataset.vianneyThumb || null : null}}; }})()""")

    def pixels(look):
        # the middle of the picture: the corners carry overlays (the duration, our own badge)
        png = p.call('Page.captureScreenshot', {'format': 'png', 'clip': {'x': look['x'] + look['w'] * 0.2, 'y': look['y'] + look['h'] * 0.3, 'width': look['w'] * 0.6, 'height': look['h'] * 0.4, 'scale': 1}})['data']
        return p.eval(f"""new Promise((res) => {{ const i = new Image(); i.onerror = () => res(null); i.onload = () => {{ const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
          const g = c.getContext('2d'); g.drawImage(i, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let sum = 0, top = 0;
          for (let k = 0; k < d.length; k += 4) {{ const v = (d[k] + d[k + 1] + d[k + 2]) / 3; sum += v; if (v > top) top = v; }} res({{mean: sum / (d.length / 4), max: top}}); }}; i.src = 'data:image/png;base64,{png}'; }})""")

    env.settings(debug=True, media=media_on, actions={'explicit_images': {'thumbnail': 'blackout'}})
    c = None
    end = time.time() + 20
    while time.time() < end:
        c = state_of(bad)
        if c and c['thumb'] == 'blackout':
            break
        time.sleep(0.7)
    check('choosing "blackout" for the rule turns the hidden card into a black picture with the card still there', bool(c) and c['thumb'] == 'blackout', json.dumps(c))
    look = thumb_look(bad)
    check('the picture is drawn with brightness 0 and its card is visible', bool(look) and look['filter'] == 'brightness(0)' and look['shown'], json.dumps(look))
    time.sleep(0.5)
    px = pixels(look) if look else None
    clean = thumb_look(good)
    clean_px = pixels(clean) if clean else None
    check('and a screenshot of its middle is black (brightest pixel at most 8 of 255), while a clean thumbnail is not', bool(px) and px['max'] <= 8 and bool(clean_px) and clean_px['mean'] > 15, f'blacked-out {json.dumps(px)}, clean {json.dumps(clean_px)}')
    shot(p, 'media-blackout')
    p.eval("document.querySelector('[data-vianney-thumb=\"blackout\"] .vianney-thumb-badge button').click()")
    time.sleep(0.6)
    look = thumb_look(bad)
    check('"Show" reveals the picture again', bool(look) and look['thumb'] == 'revealed' and look['filter'] == 'none', json.dumps(look))
    p.eval('window.scrollBy(0, 1)')            # any page change makes the feed filter scan again; the reveal must survive that
    time.sleep(2.0)
    look = thumb_look(bad)
    check('and it stays revealed when the feed is scanned again (the guard remembers the click)', bool(look) and look['thumb'] == 'revealed', json.dumps(look))
    px = pixels(look) if look else None
    check('a screenshot of the revealed picture is not black', bool(px) and px['mean'] > 15, json.dumps(px))
    p.eval("document.querySelector('[data-vianney-thumb=\"revealed\"] .vianney-thumb-badge button').click()")
    time.sleep(0.6)
    look = thumb_look(bad)
    check('and "Hide" blacks it out again', bool(look) and look['thumb'] == 'blackout' and look['filter'] == 'brightness(0)', json.dumps(look))
    env.settings(debug=True, media=media_on, actions={})
    c = None
    end = time.time() + 20
    while time.time() < end:
        c = state_of(bad)
        if c and c['thumb'] == 'hide':
            break
        time.sleep(0.7)
    check('without the choice the rule\'s own action (hide) applies again', bool(c) and c['thumb'] == 'hide', json.dumps(c))

    # lists win over the model
    env.settings(debug=True, media={'enabled': True, 'votes': 2, 'thumbnails': {'enabled': True, 'hold': True, 'holdSeconds': 40, 'maxPerPage': 60, 'nearViewOnly': False}, 'audio': {'enabled': False}}, lists={'allowVideos': [bad], 'allowChannels': [], 'denyVideos': [good], 'denyChannels': []})
    time.sleep(2.5)
    c_bad, c_good = state_of(bad), state_of(good)
    check('an allowed video is no longer hidden', not c_bad or c_bad['thumb'] is None, json.dumps(c_bad))
    reasons = {x['title']: x['reason'] for x in cmd(p, 'snapshot')['feed']['states']}
    blocked = p.eval(f"""(() => {{ const a = document.querySelector('a[href*="{good}"]'); const c = a && a.closest('[data-vianney-state]'); return c ? c.dataset.vianneyReason : null; }})()""")
    check('a blocked video is hidden by the block list', blocked == 'Blocked', str(blocked))

    # the service worker's own cache: after a reload the same pictures are not shown to the model again
    env.settings(debug=True, media={'enabled': True, 'votes': 2, 'thumbnails': {'enabled': True, 'hold': True, 'holdSeconds': 40, 'maxPerPage': 60, 'nearViewOnly': False}, 'audio': {'enabled': False}}, lists={'allowVideos': [], 'allowChannels': [], 'denyVideos': [], 'denyChannels': []})
    c = None
    end = time.time() + 20
    while time.time() < end:
        c = state_of(bad)
        if c and c['thumb'] == 'hide':
            break
        time.sleep(0.7)
    check('taking a video off the allow list judges it again (from what the engine remembers)', bool(c) and c['thumb'] == 'hide', json.dumps(c))
    before = len([r for r in env.fake_log('image') if r['hash'] == h_bad])
    p.eval('location.reload()')
    time.sleep(6)
    wait_for(p, SEARCH_READY, 25)
    end = time.time() + 30
    c = None
    while time.time() < end:
        c = state_of(bad)
        if c and c['state'] == 'done':
            break
        time.sleep(0.7)
    after = len([r for r in env.fake_log('image') if r['hash'] == h_bad])
    cards_now = [x['id'] for x in cmd(p, 'snapshot')['thumbs']['cards']]
    on_page = bad in p.eval(THUMB_ID_JS)
    # YouTube does not serve the same results after a reload every time: when the flagged video is not on the page any more there is nothing to hide, and what is left to check is that nobody asked the model again
    check('after a reload the verdict comes from the cache and the model is not asked again (and the flagged video, when the page shows it again, is hidden)', after == before and ((c and c['thumb'] == 'hide') or not on_page), f'asked before {before}, after {after}, state {json.dumps(c)}; on the page again: {on_page}; the thumbnail check tracks {cards_now}')

    # fail open: the model goes away
    env.fake("__fake.availability.image = 'unavailable'")
    env.media_status(force=True)
    time.sleep(0.5)
    env.settings(debug=True, media={'enabled': True, 'votes': 2, 'thumbnails': {'enabled': True, 'hold': True, 'holdSeconds': 40, 'maxPerPage': 60, 'nearViewOnly': False}, 'audio': {'enabled': False}, 'rememberFlagged': True})
    time.sleep(2.5)
    t = cmd(p, 'snapshot')['thumbs']
    held = p.eval("document.documentElement.hasAttribute('data-vianney-hold')")
    marked = p.eval("document.querySelectorAll('[data-vianney-thumb]').length")
    check('when the model is unavailable the check switches itself off and nothing stays hidden', t['active'] is False and held is False and marked == 0, f"active {t['active']} hold {held} marked {marked}")

    # and the master switch off
    env.fake("__fake.availability.image = 'available'")
    env.media_status(force=True)
    env.settings(debug=True, media={'enabled': False})
    time.sleep(2)
    t = cmd(p, 'snapshot')['thumbs']
    check('the master switch turns everything off again', t['active'] is False and p.eval("document.querySelectorAll('[data-vianney-thumb]').length") == 0)
    p.__exit__(None, None, None)


def scenario_media_audio(env):
    print('\n== media audio: real sound captured from a playing video, a fake model')
    env.reset()
    print('   fake model:', env.install_fake())
    env.fake("__fake.audioYes = ['vulgar']; __fake.rmsMin = 0.003")
    media = {'enabled': True, 'votes': 1, 'rememberFlagged': True,
             'thumbnails': {'enabled': False},
             'audio': {'enabled': True, 'windowSeconds': 4, 'startAfterSeconds': 1, 'onlyWithoutCaptions': False, 'maxWindowsPerVideo': 40}}
    env.settings(debug=True, subtitles={'autoCaptions': False}, media=media)
    p = env.open_page('https://www.youtube.com/watch?v=dQw4w9WgXcQ', WATCH_READY)
    started = p.eval("(() => { const v = document.querySelector('video'); v.muted = false; return v.play().then(() => true, (e) => String(e)); })()")
    check('the video plays (needs --autoplay-policy=no-user-gesture-required)', started is True, str(started))
    if started is not True:
        p.__exit__(None, None, None)
        return

    def audio():
        return cmd(p, 'snapshot')['audio']

    judged = None
    end = time.time() + 70
    while time.time() < end:
        a = audio()
        if a['counts']['judged'] >= 1:
            judged = a
            break
        time.sleep(1)
    print('   audio state:', json.dumps(audio())[:300])
    check('a window of real sound was recorded, decoded and judged', judged is not None, json.dumps(audio())[:300])
    log = env.fake_log('audio')
    check('the model received a WAV clip with sound in it', bool(log) and log[0]['bytes'] > 20000 and log[0]['rms'] > 0.003, json.dumps(log[:1]))
    check('the clip is about one window long (16 kHz, 16 bit, mono)', bool(log) and 3.2 * 32000 < log[0]['bytes'] < 6.5 * 32000, str(log[0]['bytes'] if log else None))
    qs = {r['q'] for r in log}
    check('every enabled sound rule asked its question', any('vulgar' in q for q in qs) and any('sexual' in q for q in qs), '; '.join(sorted(qs))[:300])
    muted = wait_for(p, "document.querySelector('video').muted === true", 25, 0.5)
    check('"mute-next": the coarse-language rule muted the video after a flagged window', muted is True and audio()['muted'] is True, json.dumps(audio()))
    check('the player kept playing while muted', p.eval("!document.querySelector('video').paused") is True)
    env.fake("__fake.audioYes = []")
    clean = wait_for(p, "document.querySelector('video').muted === false", 30, 0.5)
    check('a clean window lets the sound back', clean is True, json.dumps(audio()))

    env.fake("__fake.audioYes = ['sexual']")
    shown = wait_for(p, "!!document.querySelector('[data-vianney-ui=\"overlay\"]')", 40, 0.5)
    check('"pause-overlay": the explicit-sound rule pauses the video behind a warning', shown is True and p.eval("document.querySelector('video').paused") is True)
    if shown:
        txt = p.eval("document.querySelector('[data-vianney-ui=\"overlay\"]').shadowRoot.querySelector('.why').textContent")
        check('it says that it was the audio, and where', 'Audio flagged by' in txt and ' to ' in txt, txt)
        shot(p, 'media-audio-overlay')
        p.eval("document.querySelector('[data-vianney-ui=\"overlay\"]').shadowRoot.querySelector('.watch').click()")
        gone = wait_for(p, "!document.querySelector('[data-vianney-ui=\"overlay\"]')", 5)
        check('"Watch anyway" removes the overlay and the video plays on', gone is True and wait_for(p, "!document.querySelector('video').paused", 6) is True)
        time.sleep(11)
        again = p.eval("!!document.querySelector('[data-vianney-ui=\"overlay\"]')")
        check('and the same rule does not ask again for this video', again is False and 'audio_explicit' in audio()['ignored'], json.dumps(audio()))

    mem = env.ctrl.eval("chrome.storage.local.get('flaggedVideos').then(r => r.flaggedVideos || {})")
    check('the video was remembered as flagged by sound', 'dQw4w9WgXcQ' in mem and mem['dQw4w9WgXcQ']['by'], json.dumps(mem)[:200])
    p.__exit__(None, None, None)

    # a feed hides a video that an earlier sound check flagged (any card of the page will do for this check)
    q = env.open_page('https://www.youtube.com/results?search_query=gregorian+chant+vespers', SEARCH_READY)
    target = cmd(q, 'snapshot')['feed']['ids'][2]
    probe = f"""(() => {{ const a = document.querySelector('a[href*="{target}"]'); const c = a && a.closest('[data-vianney-state]'); return c ? [c.dataset.vianneyState, c.dataset.vianneyReason] : null; }})()"""

    def remember(score):
        env.ctrl.eval("chrome.storage.local.set({flaggedVideos: {%s: {t: Date.now(), kind: 'audio', by: [{rule: 'audio_coarse', p: %s}]}}})" % (json.dumps(target), score))

    remember(1)
    hidden = wait_for(q, probe, 10)
    check('a feed card of a video flagged by sound is hidden next time', bool(hidden) and hidden[0] == 'hide' and hidden[1].startswith('Audio:'), json.dumps(hidden))
    remember(0.5)
    time.sleep(2.5)
    check('a weaker stored score (50%) is below the rule\'s 60% and the card comes back', q.eval(probe) is None)
    env.settings(debug=True, subtitles={'autoCaptions': False}, media=media, sensitivity={'audio_coarse': 0.4})
    hidden = wait_for(q, probe, 10)
    check('moving the slider to 40% hides it again: the verdict is made again from the stored score', bool(hidden) and hidden[0] == 'hide', json.dumps(hidden))
    env.settings(debug=True, subtitles={'autoCaptions': False}, media=dict(media, rememberedAction='label'), sensitivity={'audio_coarse': 0.4})
    time.sleep(2.5)
    check('the setting for remembered videos can show a label instead of hiding', (q.eval(probe) or [None])[0] == 'label', json.dumps(q.eval(probe)))
    q.__exit__(None, None, None)




def scenario_modelcheck(env):
    print('\n== model check: what this computer can do, download buttons, timings')
    env.reset()
    # ---- 1. the real Chrome of this machine, no stand-in
    o = Session().__enter__()
    o.call('Emulation.setDeviceMetricsOverride', {'width': 1100, 'height': 1000, 'deviceScaleFactor': 1, 'mobile': False})
    o.goto(f'chrome-extension://{env.ext}/src/options/options.html#ai', wait=2)
    rows = wait_for(o, "document.querySelectorAll('#ai-models .model').length === 4 ? [...document.querySelectorAll('#ai-models .model')].map(r => r.dataset.model + ':' + r.querySelector('.pill-state').textContent + ':' + !!r.querySelector('button.primary')) : null", 20)
    print('   rows on this machine:', rows)
    check('the panel has a row for the local model Kev-0.6B (first), one for Chrome\'s model (Gemini Nano), and one each for images and audio', bool(rows) and [r.split(':')[0] for r in rows] == ['kev', 'text', 'image', 'audio'], str(rows))
    titles = o.eval("[...document.querySelectorAll('#ai-models .model')].map((x) => x.querySelector('strong').textContent + ' | ' + x.querySelector('.lede').textContent)")
    check('every row names its model: Kev-0.6B, Gemini Nano (built into Chrome), and Gemini Nano under the picture and sound titles', bool(titles) and titles[0].startswith('Kev-0.6B | Runs on this computer in any browser.') and titles[1].startswith('Gemini Nano (built into Chrome) | ') and titles[2].startswith('Images (experimental) | Gemini Nano') and titles[3].startswith('Audio (experimental) | Gemini Nano'), str(titles))
    check('a Chrome row offers "Download" only where Chrome says the model can be downloaded', bool(rows) and all((r.split(':')[2] == 'true') == (r.split(':')[1] == 'Download required') for r in rows if not r.startswith('kev:')), str(rows))
    check('the Kev-0.6B row offers its own download', bool(rows) and rows[0].split(':')[1] == 'Not downloaded' and rows[0].split(':')[2] == 'true', str(rows))
    machine = o.eval("[...document.querySelectorAll('#ai-machine dt')].map(d => d.textContent)")
    check('it lists what the computer reports (browser, threads, memory, graphics, disk)', machine == ['Browser', 'Processor threads', 'Memory', 'Graphics', 'Disk'], str(machine))
    disk = o.eval("[...document.querySelectorAll('#ai-machine dt')].find(d => d.textContent === 'Disk').nextElementSibling.textContent")
    check('and says plainly that free disk space cannot be read by a page', 'Not readable' in disk and '22 GB' in disk, disk)
    advice = o.eval("document.getElementById('ai-advice').innerText")
    check('there is a plain recommendation, and it starts with the local model', len(advice) > 40 and 'Kev-0.6B' in advice, advice[:200])
    o.eval("document.getElementById('ai-bench').click()")
    # textContent, not innerText: the output sits inside a <details>, whose closed content has no innerText
    bench = wait_for(o, "document.getElementById('ai-bench-out').textContent", 15) or ''
    if any(r.split(':')[1] == 'Ready' for r in (rows or []) if not r.startswith('kev:')):
        check('timing runs when a model is ready', 'prompt' in bench, bench[:200])
    else:
        check('with no model ready, "Run benchmark" says that no model is ready', 'No model is ready' in bench, bench[:200])
    whole = o.eval("document.querySelector('main').textContent")
    stray = o.eval("(document.querySelector('main').textContent.match(/\\bnull\\b|\\bundefined\\b|\\[object /g) || [])")
    check('no stray "null", "undefined" or "[object" anywhere on the settings page', not stray, str(stray) + ' ... ' + whole[whole.find('null') - 40: whole.find('null') + 40].replace('\n', ' ') if 'null' in whole else str(stray))
    shot(o, 'options-modelcheck')
    o.__exit__(None, None, None)

    # ---- 2. a stand-in model inside the settings page: download flow and timing arithmetic
    o = Session().__enter__()
    o.call('Emulation.setDeviceMetricsOverride', {'width': 1100, 'height': 1000, 'deviceScaleFactor': 1, 'mobile': False})
    o.call('Page.addScriptToEvaluateOnNewDocument', {'source': FAKE_PAGE_MODEL_JS})
    o.goto(f'chrome-extension://{env.ext}/src/options/options.html#ai', wait=2)
    row = lambda k: o.eval(f"(() => {{ const r = document.querySelector('[data-model=\"{k}\"]'); return r ? {{pill: r.querySelector('.pill-state').textContent, button: !!r.querySelector('button.primary'), cls: r.className}} : null; }})()")
    wait_for(o, "document.querySelectorAll('#ai-models .model').length === 4", 15)
    check('stand-in: text and images need a download, audio is ready', row('text')['pill'] == 'Download required' and row('image')['pill'] == 'Download required' and row('audio')['pill'] == 'Ready', json.dumps([row('text'), row('image'), row('audio')]))
    adv = o.eval("document.getElementById('ai-advice').textContent")   # textContent: the second and later pieces of advice sit in a popover
    check('and the advice says to start with the text model (after the line about Kev-0.6B)', 'Download the text model first' in adv and 'Download Kev-0.6B first' in adv, adv)
    o.eval("document.querySelector('[data-model=\"text\"] button.primary').click()")
    saw_bar = wait_for(o, "(() => { const b = document.querySelector('[data-model=\"text\"] progress'); return b && !b.hidden && b.value > 0; })()", 5, 0.05)
    check('clicking "Download" shows the progress that Chrome reports', saw_bar is True)
    done = wait_for(o, "document.querySelector('[data-model=\"text\"] .pill-state').textContent === 'Ready'", 10)
    check('when the download is finished the row says Ready and the button is gone', done is True and not row('text')['button'], json.dumps(row('text')))
    adv = o.eval("document.getElementById('ai-advice').textContent")
    check('the advice moves on (rule questions are ready)', 'Rule questions are ready' in adv, adv)
    o.eval("window.__fakePage.failDownload = true")
    o.eval("document.querySelector('[data-model=\"image\"] button.primary').click()")
    time.sleep(1.5)
    note = o.eval("document.querySelector('[data-model=\"image\"] .note:last-child').textContent")
    check('a refused download says why, instead of failing silently', 'NotAllowedError' in note and 'Try again' in note, note)
    o.eval("window.__fakePage.failDownload = false; document.querySelector('[data-model=\"image\"] button.primary').click()")
    check('and can be tried again, after which images are ready', wait_for(o, "document.querySelector('[data-model=\"image\"] .pill-state').textContent === 'Ready'", 10) is True)

    # timing: scripted latencies 100/200/400 ms by size, 500 ms for a clip, 300 ms per text prompt
    o.eval("document.getElementById('ai-bench').click()")
    out = wait_for(o, "(() => { const t = [...document.querySelectorAll('#ai-bench-out .r')].map(x => x.textContent).join('\\n'); return t.includes('Measured with synthetic test data') ? t : ''; })()", 60)
    print('   timing output:'); print('   ' + (out or '').replace('\n', '\n   ')[:1800])
    check('every kind was timed', bool(out) and all(x in out for x in ['Preview frame (160×90): 0.1 s', 'Thumbnail (320×180): 0.2 s', 'Large image (640×360): 0.4 s', 'Audio clip: 0.5 s', 'Text question']), (out or '')[:300])
    check('the first prompt is reported apart, because it also loads the model', 'includes loading the model' in (out or ''))
    check('thumbnails: 30 cards x 2 image rules x 2 prompts = 120 prompts at 0.2 s = 24 s', '120 prompts per page' in (out or '') and 'about 24 s on first load' in (out or ''), (out or '')[:600])
    import re as _re
    check('a 3.5-minute video: 432 prompts at about 0.1 s = 43 to 46 s, faster than the video, so it could stay ahead', bool(_re.search(r'432 prompts, about (4[3-6]) s\. Faster than playback', out or '')), (out or '')[400:700])
    check('audio: 2 rules x 2 prompts x 0.5 s = 2.0 s for an 8 s clip, so it keeps up', 'take about 2.0 s per 8 s clip. Keeps up with playback' in (out or ''))
    used = o.eval("window.__fakePage.prompts.length")
    check('the timing sent prompts to the model, and a bounded number of them', 8 <= used <= 30, str(used))
    shot(o, 'options-modelcheck-bench')
    o.__exit__(None, None, None)



# ---------------------------------------------------------------------------------------------------------------- clean up and popup
CLEAN_KEYS = ['shorts', 'shortsAsVideos', 'games', 'movies', 'explore', 'more', 'banners']


def clean(**on):
    """A cleanup setting with only the named switches on."""
    return {**{k: False for k in CLEAN_KEYS}, **on, 'shelfTitles': on.get('shelfTitles', [])}


def german_page(url, width=1440, wait=6, scrolls=0):
    """A YouTube page in German, the way it looks for the person who asked for Clean up: nothing may depend on English words."""
    s = Session().__enter__()
    s.call('Emulation.setDeviceMetricsOverride', {'width': width, 'height': 900, 'deviceScaleFactor': 1, 'mobile': False})
    s.call('Network.enable')
    s.call('Emulation.setUserAgentOverride', {'userAgent': (s.eval('navigator.userAgent') or '').replace('HeadlessChrome', 'Chrome'), 'acceptLanguage': 'de-DE,de;q=0.9'})
    s.goto(url, wait=4)
    s.click_text([r'^(Alle ablehnen|Reject all)'])
    time.sleep(wait)
    for _ in range(scrolls):
        s.eval('window.scrollBy(0, 900)')
        time.sleep(1.1)
    return s


SHOWN_JS = "(sel) => [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().height > 0 && getComputedStyle(e).display !== 'none').length"


def shown(s, selector):
    return s.eval(f"({SHOWN_JS})({json.dumps(selector)})")


def present(s, selector):
    return s.eval(f"document.querySelectorAll({json.dumps(selector)}).length")


def scenario_cleanup(env):
    print('\n== clean up: Shorts, Games, Movies & TV, the Explore part of the sidebar, banners and shelves by title (German interface)')
    env.reset()
    ENTRY = lambda inner: f'ytd-guide-entry-renderer:has({inner})'
    entries = {'shorts': ENTRY('a[title="Shorts"]'), 'gaming': ENTRY('a[href="/gaming"]'), 'playables': ENTRY('a[href="/playables"]'),
               'movies': ENTRY('a[href^="/feed/storefront"]'), 'music': ENTRY('a[href="/channel/UC-9-kyTW8ZkZNDHQJ6FgpwQ"]'),
               'podcasts': ENTRY('a[href="/podcasts"]'), 'premium': ENTRY('a[href="/premium"]')}
    env.settings(cleanup=clean())
    p = german_page('https://www.youtube.com/?hl=de&gl=DE')
    p.eval("""(() => { const b = [...document.querySelectorAll('ytd-guide-entry-renderer')].find((e) => /Mehr anzeigen|Show more/.test(e.textContent)); if (b) (b.querySelector('a, #endpoint, tp-yt-paper-item') || b).click(); })()""")
    time.sleep(1.5)
    visible = lambda: {k: shown(p, sel) for k, sel in entries.items()}
    off = visible()
    check('with every switch off, the sidebar shows all the entries', all(v >= 1 for v in off.values()), json.dumps(off))

    def only(name, **on):
        env.settings(cleanup=clean(**on))
        time.sleep(1.2)
        return visible()

    v = only('shorts', shorts=True)
    check('"Shorts" hides the Shorts entry and nothing else of the sidebar', v['shorts'] == 0 and all(v[k] >= 1 for k in v if k != 'shorts'), json.dumps(v))
    v = only('games', games=True)
    check('"Games" hides Gaming and Playables', v['gaming'] == 0 and v['playables'] == 0 and v['shorts'] >= 1 and v['movies'] >= 1 and v['music'] >= 1, json.dumps(v))
    v = only('movies', movies=True)
    check('"Movies & TV" hides its entry', v['movies'] == 0 and v['gaming'] >= 1 and v['music'] >= 1, json.dumps(v))
    v = only('explore', explore=True)
    check('"Explore section" hides the whole section (Music, Movies, Live, Gaming, Podcasts, Playables)', all(v[k] == 0 for k in ('music', 'movies', 'gaming', 'playables', 'podcasts')) and v['shorts'] >= 1 and v['premium'] >= 1, json.dumps(v))
    v = only('more', more=True)
    check('"More from YouTube" hides Premium and its section', v['premium'] == 0 and v['music'] >= 1 and v['shorts'] >= 1, json.dumps(v))
    env.settings(cleanup=clean(shorts=True, games=True, movies=True, explore=True, more=True, banners=True))
    time.sleep(1.2)
    v = visible()
    check('with everything on, none of them shows', all(x == 0 for x in v.values()), json.dumps(v))
    env.settings(enabled=False)
    time.sleep(1.2)
    v = visible()
    check('the master switch off shows them all again', all(x >= 1 for x in v.values()), json.dumps(v))
    env.settings(enabled=True)
    shot(p, 'cleanup-sidebar')
    p.__exit__(None, None, None)

    # the shelves and rows inside pages
    def around(url, selector, label, scrolls=2, **on):
        env.settings(cleanup=clean())
        q = german_page(url, scrolls=scrolls)
        before = shown(q, selector)
        if not before:
            print(f'   (no {label} on this page today: not checked)')
            q.__exit__(None, None, None)
            return None
        env.settings(cleanup=clean(**on))
        time.sleep(1.5)
        after = shown(q, selector)
        env.settings(cleanup=clean())
        time.sleep(1.2)
        back = shown(q, selector)
        shot(q, 'cleanup-' + label.replace(' ', '-'))
        q.__exit__(None, None, None)
        check(f'{label}: shown with the switch off, hidden with it on, back after', before >= 1 and after == 0 and back >= 1, f'{before} -> {after} -> {back}')
        return True

    around('https://www.youtube.com/results?search_query=lustig+katze&hl=de&gl=DE', 'grid-shelf-view-model:has(ytm-shorts-lockup-view-model)', 'the Shorts shelf of a search', shorts=True)
    around('https://www.youtube.com/watch?v=dQw4w9WgXcQ&hl=de&gl=DE', 'ytd-reel-shelf-renderer', 'the Shorts shelf beside a video', scrolls=3, shorts=True)
    around('https://www.youtube.com/results?search_query=avengers+film&hl=de&gl=DE', 'ytd-shelf-renderer:has(ytd-grid-movie-renderer), ytd-movie-renderer', 'the movie shelf of a search', movies=True)
    around('https://www.youtube.com/watch?v=dQw4w9WgXcQ&hl=de&gl=DE', 'ytd-feed-nudge-renderer', 'the "recommendations not right?" banner', scrolls=3, banners=True)

    # a Shorts address opens in the normal player
    env.settings(cleanup=clean())
    q = german_page('https://www.youtube.com/results?search_query=lustig+katze&hl=de&gl=DE', scrolls=1)
    short_id = q.eval("(() => { const a = document.querySelector('a[href^=\"/shorts/\"]'); const m = a && a.getAttribute('href').match(/\\/shorts\\/([\\w-]{11})/); return m ? m[1] : null; })()")
    q.__exit__(None, None, None)
    if short_id:
        env.settings(cleanup=clean(shortsAsVideos=True))
        q = german_page(f'https://www.youtube.com/shorts/{short_id}?hl=de&gl=DE', wait=5)
        where = wait_for(q, "location.pathname + location.search", 10)
        check('"Open Shorts as videos": a /shorts/ address ends up in the normal player', '/watch' in (where or '') and short_id in (where or ''), str(where))
        q.__exit__(None, None, None)
        env.settings(cleanup=clean())
        q = german_page(f'https://www.youtube.com/shorts/{short_id}?hl=de&gl=DE', wait=5)
        check('and stays a Short with the switch off', q.eval("location.pathname.startsWith('/shorts/')") is True, str(q.eval('location.pathname')))
        q.__exit__(None, None, None)
    else:
        print('   (no Shorts link on the search page today: the redirect was not checked)')

    # shelves by title: take the title of a real shelf, whatever language it is in
    env.settings(cleanup=clean())
    q = german_page('https://www.youtube.com/podcasts?hl=de&gl=DE', scrolls=2)
    titles = q.eval("[...document.querySelectorAll('ytd-rich-shelf-renderer')].map((e) => { const t = e.querySelector('#title, h2'); return t ? t.textContent.replace(/\\s+/g, ' ').trim() : ''; }).filter(Boolean)")
    if titles and len(titles) >= 3:
        pick = titles[2]
        count = lambda: q.eval("document.querySelectorAll('[data-vianney-shelf=\"hidden\"]').length")
        check('no shelf is hidden before a title is named', count() == 0, str(count()))
        env.settings(cleanup=clean(shelfTitles=[pick.upper()]))
        time.sleep(1.8)
        hidden_titles = q.eval("[...document.querySelectorAll('[data-vianney-shelf=\"hidden\"]')].map((e) => { const t = e.querySelector('#title, h2'); return t ? t.textContent.replace(/\\s+/g, ' ').trim() : ''; })")
        check('a shelf whose title is named (in capitals) is hidden, and only that one', hidden_titles and all(pick.lower() in t.lower() for t in hidden_titles) and shown(q, 'ytd-rich-shelf-renderer') < len(titles), f'{pick!r}: {hidden_titles}')
        env.settings(cleanup=clean(shelfTitles=[]))
        time.sleep(1.8)
        check('and it comes back when the title is taken off the list', count() == 0, str(count()))
        shot(q, 'cleanup-shelf-title')
    else:
        print('   (the podcasts page had fewer than 3 shelves today: shelves by title were not checked)')
    q.__exit__(None, None, None)

    # the settings page
    o = Session().__enter__()
    o.call('Emulation.setDeviceMetricsOverride', {'width': 1100, 'height': 1000, 'deviceScaleFactor': 1, 'mobile': False})
    env.settings(cleanup={**clean(shorts=True), 'shelfTitles': ['Von YouTube empfohlen']})
    o.goto(f'chrome-extension://{env.ext}/src/options/options.html#cleanup', wait=2)
    check('the settings have a Clean up section with a switch for each extra', o.eval("['cl-shorts','cl-shortsAsVideos','cl-games','cl-movies','cl-explore','cl-more','cl-banners'].every((id) => !!document.getElementById(id))") is True)
    check('it shows what is on', o.eval("document.getElementById('cl-shorts').checked && !document.getElementById('cl-games').checked") is True)
    check('and the shelf titles, one to a line', o.eval("document.getElementById('cl-titles').value") == 'Von YouTube empfohlen', str(o.eval("document.getElementById('cl-titles').value")))
    o.eval("document.getElementById('cl-games').click()")
    time.sleep(0.6)
    st = env.ctrl.eval("chrome.storage.local.get('settings').then((r) => r.settings.cleanup)")
    check('a switch is stored', st and st.get('games') is True and st.get('shorts') is True, json.dumps(st))
    o.eval("(() => { const t = document.getElementById('cl-titles'); t.value = '  Recommended by YouTube \\n\\nrecommended by youtube\\nFoo'; t.dispatchEvent(new Event('change')); })()")
    time.sleep(0.6)
    st = env.ctrl.eval("chrome.storage.local.get('settings').then((r) => r.settings.cleanup)")
    check('shelf titles are stored trimmed, in lower case and without repeats', st and st.get('shelfTitles') == ['recommended by youtube', 'foo'], json.dumps(st))
    shot(o, 'options-cleanup')
    o.__exit__(None, None, None)


def scenario_popup(env):
    print('\n== popup: quick settings and the activity, without the full settings page')
    env.reset()
    now = int(time.time() * 1000)
    env.ctrl.eval("chrome.storage.local.set({log: %s, breakState: {accumSeconds: 4800, nextDueSeconds: 7200}})" % json.dumps([
        {'t': now - 60000, 'surface': 'feed-card', 'id': 'dQw4w9WgXcQ', 'title': 'What the fuck is going on with this game', 'channel': 'Some Channel', 'ps': {'coarse_words': 0.95}, 'flagged': ['coarse_words'], 'action': 'hide', 'via': 'lexicon'},
        {'t': now - 30000, 'surface': 'feed-card', 'id': 'aaaaaaaaaaa', 'title': 'A quiet walk in the woods', 'channel': 'Nature', 'ps': {}, 'flagged': [], 'via': 'lexicon'},
    ]))
    o = Session().__enter__()
    o.call('Emulation.setDeviceMetricsOverride', {'width': 400, 'height': 800, 'deviceScaleFactor': 2, 'mobile': False})
    o.goto(f'chrome-extension://{env.ext}/src/popup/popup.html', wait=2)
    check('the popup has the master switch and a Settings and an Activity tab', o.eval("!!document.getElementById('enabled') && document.querySelectorAll('#tabs button').length === 2") is True)
    labels = o.eval("[...document.querySelectorAll('#settings .row .label')].map((e) => e.textContent)")
    check('the Settings tab lists the switches in three groups', labels == ['Shorts', 'Games', 'Movies & TV', 'Explore section', 'More from YouTube', 'Suggestions & banners', 'Lists and search results', 'Recommended videos', 'Video page', 'Comments', 'Subtitles', 'Reminders', 'Remind after'], str(labels))
    check('the popup fits a toolbar popup (360 px wide)', o.eval("Math.round(document.body.getBoundingClientRect().width)") == 360)
    check('it says how many were flagged today', o.eval("document.getElementById('status').textContent") == '1 flagged today', str(o.eval("document.getElementById('status').textContent")))
    o.eval("[...document.querySelectorAll('#settings .row')].find((r) => r.textContent.startsWith('Shorts')).querySelector('input').click()")
    time.sleep(0.6)
    st = env.ctrl.eval("chrome.storage.local.get('settings').then((r) => r.settings)")
    check('a switch is stored at once', st['cleanup']['shorts'] is False, json.dumps(st.get('cleanup')))
    o.eval("[...document.querySelectorAll('#settings .row')].find((r) => r.textContent.startsWith('Remind after')).querySelectorAll('.stepper button')[1].click()")
    time.sleep(0.6)
    st = env.ctrl.eval("chrome.storage.local.get('settings').then((r) => r.settings)")
    check('the stepper moves the break time by 15 minutes', st['brk']['afterMinutes'] == 135, str(st['brk']))
    o.eval("document.getElementById('enabled').click()")
    time.sleep(0.6)
    st = env.ctrl.eval("chrome.storage.local.get('settings').then((r) => r.settings)")
    check('the master switch turns Vianney off, and the rest is dimmed', st['enabled'] is False and o.eval("document.getElementById('settings').classList.contains('off')") is True)
    o.eval("document.getElementById('enabled').click()")
    time.sleep(0.4)
    shot(o, 'popup-settings')
    o.eval("document.querySelector('#tabs [data-tab=activity]').click()")
    time.sleep(0.5)
    text = o.eval("document.getElementById('activity').innerText")
    check('the Activity tab shows the flagged title with the vulgar word masked', 'What the f*** is going on' in text and 'fuck' not in text.lower(), text[:240])
    check('and the name of the rule that flagged it', 'Vulgar language' in text, text[:240])
    check('only flagged items are listed at first', 'quiet walk' not in text)
    o.eval("document.querySelector('#activity .entry button.pill').click()")
    time.sleep(0.6)
    st = env.ctrl.eval("chrome.storage.local.get('settings').then((r) => r.settings)")
    check('"Allow" puts the video on the allow list', 'dQw4w9WgXcQ' in st['lists']['allowVideos'], json.dumps(st['lists']))
    shot(o, 'popup-activity')
    check('there is a way to the full settings and to Activity', o.eval("!!document.getElementById('open') && [...document.querySelectorAll('#activity button')].some((b) => b.textContent === 'Open Activity')") is True)
    o.__exit__(None, None, None)


def scenario_site(env):
    """The website on a phone and on a desktop. Needs the built site: jekyll build, then e.g. `python3 -m http.server 4000 -d <output>`, then
    SITE_URL=http://127.0.0.1:4000/ python3 tools/e2e.py site   (skipped when SITE_URL is not set).
    The links into the extension (Activity, Tweak settings) open only from the sites that manifest.json names. The manifest names the real site, so for a
    local site run the browser with a copy of the extension whose manifest also names http://127.0.0.1/* (E2E_EXT_DIR=<that copy>): those clicks are
    checked when the manifest allows the origin of SITE_URL, and skipped otherwise."""
    import re
    from urllib.parse import urlparse
    base = os.environ.get('SITE_URL')
    print('\n== website: the window, the pages, the links into the extension, the month, the phone layout')
    if not base:
        print('   (SITE_URL is not set: skipped)')
        return
    base = base.rstrip('/') + '/'

    def phone(width=390, height=844, scheme='light'):
        s = Session().__enter__()
        s.call('Emulation.setDeviceMetricsOverride', {'width': width, 'height': height, 'deviceScaleFactor': 2, 'mobile': True})
        s.call('Emulation.setTouchEmulationEnabled', {'enabled': True, 'maxTouchPoints': 5})
        s.call('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-color-scheme', 'value': scheme}]})
        return s

    def desktop(width=1280, height=800, scheme='light'):
        s = Session().__enter__()
        s.call('Emulation.setDeviceMetricsOverride', {'width': width, 'height': height, 'deviceScaleFactor': 1, 'mobile': False})
        s.call('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-color-scheme', 'value': scheme}]})
        return s

    def tap(s, finder):
        c = s.eval(f"(() => {{ const e = ({finder}); if (!e) return null; e.scrollIntoView({{block: 'center'}}); const r = e.getBoundingClientRect(); return {{x: r.left + r.width / 2, y: r.top + r.height / 2}}; }})()")
        assert c and '__error__' not in c, 'nothing to tap: ' + finder
        s.call('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': c['x'], 'y': c['y']}]})
        s.call('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        time.sleep(0.9)

    state = lambda s: s.eval("""({screen: document.documentElement.dataset.screen, path: location.pathname, hash: location.hash, nav: document.documentElement.dataset.nav || null, arrived: document.documentElement.dataset.arrived || null,
        side: getComputedStyle(document.querySelector('.sidebar')).display !== 'none' && document.querySelector('.sidebar').getBoundingClientRect().height > 0,
        content: getComputedStyle(document.querySelector('.content')).display !== 'none' && document.querySelector('.content').getBoundingClientRect().height > 0,
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth})""")
    item = lambda name: f"[...document.querySelectorAll('#nav a.nav-item')].find((a) => a.textContent.trim() === {json.dumps(name)})"
    PAGES = ['Idea', 'Features', 'Install', 'Source']

    for scheme in ('light', 'dark'):
        s = phone(scheme=scheme)
        s.goto(base + '?month=7', wait=1.6)     # July is one of the months with characters in front of the window, but not on a phone
        st = state(s)
        check(f'{scheme}: the home page opens on the Idea page, not on the list, with the list one step back', st['screen'] == 'page' and st['content'] and not st['side'] and st['hash'] == '#open' and st['over'] <= 0 and s.eval("history.state && history.state.screen") == 'page', json.dumps(st))
        hero = s.eval("""(() => { const h = document.querySelector('.hero'); const r = h.getBoundingClientRect(); const i = h.querySelector('img');
          return {h: Math.round(r.height), title: h.querySelector('h1').textContent.trim(), icon: i.naturalWidth, line: !!h.querySelector('p'), intro: !!document.querySelector('.intro')}; })()""")
        check(f'{scheme}: it starts with the icon and the name (the sidebar is not there to carry them), no line under them, then the sentence', hero['h'] > 60 and hero['title'] == 'Vianney Content Blocker' and hero['icon'] > 0 and not hero['line'] and hero['intro'], json.dumps(hero))
        veil = s.eval("""(() => { const b = getComputedStyle(document.body, '::before'), a = getComputedStyle(document.querySelector('.app')), g = getComputedStyle(document.querySelector('.group'));
          return {picture: b.backgroundImage.includes('months/07.avif'), blur: b.filter.includes('blur'), shown: b.display !== 'none', app: a.backgroundColor, group: g.backgroundColor}; })()""")
        partly = lambda c: bool(re.search(r'/ 0\.\d+\)$|rgba\([^)]*, 0\.\d+\)$', c))
        check(f'{scheme}: the painting of the month shows through, blurred: the page and its cards are only partly opaque', veil['picture'] and veil['blur'] and veil['shown'] and partly(veil['app']) and partly(veil['group']), json.dumps(veil))
        check(f'{scheme}: no characters in front of the page on a phone, in a month that has them on a desktop', s.eval("!document.documentElement.dataset.stage && !document.querySelector('.ms-stage')") is True)
        shot(s, f'site-phone-{scheme}-home')
        tap(s, "document.getElementById('back')")
        st = state(s)
        check(f'{scheme}: Back goes to the list, and only the list shows', st['screen'] == 'list' and st['side'] and not st['content'] and st['hash'] == '#menu' and st['over'] <= 0, json.dumps(st))
        check(f'{scheme}: the list has the pages as rows', s.eval("[...document.querySelectorAll('#nav a.nav-item')].filter((a) => a.getBoundingClientRect().height > 30).map((a) => a.textContent.trim())") == PAGES)
        s.eval("window.__vt = 0; const o = document.startViewTransition ? document.startViewTransition.bind(document) : null; if (o) document.startViewTransition = (cb) => { window.__vt++; return o(cb); };")
        tap(s, item('Idea'))
        st = state(s)
        check(f'{scheme}: a tap on Idea slides the page in (a view transition), and the address says so', st['screen'] == 'page' and st['content'] and not st['side'] and st['hash'] == '#open' and s.eval('window.__vt') >= 1, json.dumps(st))
        check(f'{scheme}: the toolbar has a Back button that names the list', s.eval("(() => { const b = document.getElementById('back'); return !b.disabled && b.textContent.trim() === 'Vianney' && b.getBoundingClientRect().height < 40; })()") is True)
        check(f'{scheme}: the page is the page of a phone: no window around it, the document scrolls, one quotation', s.eval("""(() => { const a = document.querySelector('.app').getBoundingClientRect();
            return a.left === 0 && a.width === innerWidth && getComputedStyle(document.querySelector('.content')).overflowY === 'visible' && document.querySelectorAll('.pane figure.quote').length === 1; })()""") is True)
        shot(s, f'site-phone-{scheme}-page')
        tap(s, "document.getElementById('back')")
        st = state(s)
        check(f'{scheme}: Back slides it out, and the list is there again', st['screen'] == 'list' and st['side'] and not st['content'] and st['hash'] == '#menu', json.dumps(st))
        shot(s, f'site-phone-{scheme}-list')
        tap(s, item('Install'))
        time.sleep(1.0)
        st = state(s)
        check(f'{scheme}: a tap on Install opens that page as a page, by a view transition moving forward', st['path'].endswith('/install.html') and st['screen'] == 'page' and st['content'] and st['arrived'] == 'transition' and st['nav'] == 'forward', json.dumps(st))
        check(f'{scheme}: it fits the phone, has a Copy button and shows no checksum', st['over'] <= 0 and s.eval("!!document.querySelector('[data-copy]') && !/[0-9a-f]{64}/.test(document.body.innerText)") is True)
        tap(s, "document.getElementById('back')")
        st = state(s)
        check(f'{scheme}: Back on a page shows the list, with that page marked', st['screen'] == 'list' and s.eval("document.querySelector('#nav a[aria-current=page]').textContent.trim()") == 'Install', json.dumps(st))
        tap(s, item('Features'))
        time.sleep(1.0)
        st = state(s)
        check(f'{scheme}: and from the list another page opens', st['path'].endswith('/features.html') and st['screen'] == 'page' and st['content'], json.dumps(st))
        s.__exit__(None, None, None)
        s = phone(scheme=scheme)
        s.goto(base + 'features.html', wait=1.6)
        st = state(s)
        check(f'{scheme}: a page opened by its address shows the page, not the list', st['screen'] == 'page' and st['content'] and not st['side'] and st['over'] <= 0, json.dumps(st))
        s.__exit__(None, None, None)

    for width in (320, 375, 430):
        s = phone(width=width, height=740)
        over = []
        for page in ('', 'install.html', 'features.html'):
            s.goto(base + page + ('#open' if page else ''), wait=1.2)
            over.append(state(s)['over'])
        check(f'{width} px wide: no page scrolls sideways', all(o <= 0 for o in over), str(over))
        s.__exit__(None, None, None)

    # ---- a desktop: the window keeps still and its page scrolls, the sidebar and the page show together, the wallpaper of the month
    s = desktop()
    s.goto(base + 'install.html', wait=1.8)
    st = state(s)
    check('desktop: the sidebar and the page show together', st['side'] and st['content'])
    month = time.strftime('%m')
    wall = s.eval("getComputedStyle(document.body, '::before').backgroundImage")
    check('desktop: the desktop behind the window is the painting of the current month', f'months/{month}.avif' in (wall or ''), str(wall))
    loaded = s.eval("new Promise((res) => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res(null); i.src = getComputedStyle(document.body, '::before').backgroundImage.slice(5, -2); })")
    check('and that picture loads', bool(loaded) and loaded[0] > 1000, str(loaded))
    steps = s.eval("[...document.querySelectorAll('.row .num')].map((n) => n.nextElementSibling.textContent.replace(/\\s+/g, ' ').trim())")
    check('install: five steps, Developer mode on its own', steps[1:] == ['Switch on Developer mode', 'Drop the zip onto the page', 'Check Activity after a day or so', 'Tweak settings and report issues'] and steps[0].startswith('Open chrome://extensions'), json.dumps(steps))
    check('install: no addresses for other browsers (they take chrome:// over), nothing about affiliation', s.eval("!/brave:|edge:|affiliated|licen[cs]e/i.test(document.querySelector('.pane').innerText)") is True)
    s.eval("window.__copied = null; navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }")
    s.eval("document.querySelector('button[data-copy]').click()")
    time.sleep(0.5)
    want = s.eval("document.querySelector('button[data-copy]').getAttribute('data-copy')")
    check('the Copy button puts the SHA-256 on the clipboard and says "Copied"', s.eval('window.__copied') == want and len(want or '') == 64 and s.eval("document.querySelector('button[data-copy]').textContent") == 'Copied', str(s.eval('window.__copied')))
    s.eval("window.__copied = null")
    here = s.eval('location.href')
    s.eval("document.querySelector('a[data-copy]').click()")
    time.sleep(0.5)
    check('the chrome://extensions link is a link, but a click copies the address (a page cannot open chrome://) and says so', s.eval('window.__copied') == 'chrome://extensions' and s.eval('location.href') == here
          and s.eval("document.querySelector('a[data-copy]').getAttribute('href')") == 'chrome://extensions' and 'paste' in s.eval("document.querySelector('a[data-copy]').textContent"), str(s.eval('window.__copied')))
    shot(s, 'site-desktop-install')
    s.__exit__(None, None, None)

    for scheme in ('light', 'dark'):
        s = desktop(scheme=scheme)
        s.goto(base, wait=1.6)
        info = s.eval("""(() => { const q = (x) => document.querySelector(x); const f = q('figure.quote'); const hr = q('.hero').getBoundingClientRect();
          return {doc: document.documentElement.scrollHeight - innerHeight, hero: [Math.round(hr.width), Math.round(hr.height)], title: q('h1').textContent.trim(), quotes: document.querySelectorAll('figure.quote').length,
            edge: f && [getComputedStyle(f).borderLeftWidth, getComputedStyle(f).borderLeftColor === getComputedStyle(f).borderTopColor],
            rows: [...document.querySelectorAll('.pane a.row')].map((a) => new URL(a.href).hash), top: Math.round(q('.intro').getBoundingClientRect().top - q('.toolbar').getBoundingClientRect().bottom),
            side: q('.status-text').innerText.replace(/\\s+/g, ' ').trim(), french: /[«»]|\\blang="fr"/.test(q('.pane').innerHTML), intro: q('.intro').innerText, first: q('.pane').firstElementChild.className}; })()""")
        check(f'{scheme} desktop: the name and the icon are in the sidebar; the block with them is there for readers without it, but not drawn (1 px); no French',
              info['doc'] <= 0 and info['hero'][0] <= 2 and info['hero'][1] <= 2 and info['title'] == 'Vianney Content Blocker' and not info['french'] and info['side'].startswith('Vianney Content Blocker'), json.dumps(info))
        check(f'{scheme} desktop: the page starts with one sentence about the extension, then one quotation in a plain card (no coloured edge)', info['intro'].startswith('Vianney Content Blocker is a free browser extension for YouTube.') and 'Kev-0.6B' in info['intro'] and info['quotes'] == 1 and info['edge'] == ['1px', True] and 0 < info['top'] < 40, json.dumps(info))
        check(f'{scheme} desktop: eight rows, each to its place on the Features page', info['rows'] == ['#hide', '#rules', '#sensitivity', '#subtitles', '#clean-up', '#break-reminder', '#images-audio', '#on-device-ai'], json.dumps(info['rows']))
        # the window keeps still: the document does not scroll, the content does, and the credits are the last thing in it
        s.eval("document.querySelector('.content').scrollTop = 99999")
        time.sleep(0.3)
        more = s.eval("""(() => { const c = document.querySelector('.content'), k = document.querySelector('.credits').getBoundingClientRect(), a = document.querySelector('.content').getBoundingClientRect();
          return {doc: document.documentElement.scrollHeight - innerHeight, win: scrollY, creditsInside: k.bottom <= a.bottom + 1 && k.top >= a.top, text: document.querySelector('.credits').innerText.replace(/\\s+/g, ' ').trim()}; })()""")
        check(f'{scheme} desktop: scrolled to the end, only the content moved; the credits (background and icons, nothing else) are the last line', more['doc'] <= 0 and more['win'] == 0 and more['creditsInside']
              and more['text'] == 'Background: Très Riches Heures du duc de Berry (public domain). Icons: Lucide (ISC).', json.dumps(more))
        if scheme == 'light':
            shot(s, 'site-desktop-home')
        s.__exit__(None, None, None)

    s = desktop(1280, 1000)
    s.goto(base, wait=1.6)
    gap = s.eval("document.querySelector('.content').getBoundingClientRect().bottom - document.querySelector('.credits').getBoundingClientRect().bottom")
    check('desktop, a tall window: the credits sit at the bottom of the window, not under the last row', 0 <= gap <= 40, str(gap))
    s.__exit__(None, None, None)

    # ---- the Features page: the window's content scrolls under the toolbar, a link lands under it, the pictures come in light and dark
    for scheme in ('light', 'dark'):
        s = desktop(scheme=scheme)
        s.goto(base + 'features.html', wait=1.6)
        before = s.eval("(() => { const r = document.querySelector('.toolbar').getBoundingClientRect(); return {top: Math.round(r.top), doc: document.documentElement.scrollHeight - innerHeight, can: document.querySelector('.content').scrollHeight - document.querySelector('.content').clientHeight}; })()")
        s.eval("document.querySelector('.content').scrollTop = 900")
        time.sleep(0.4)
        after = s.eval("(() => { const r = document.querySelector('.toolbar').getBoundingClientRect(); return {top: Math.round(r.top), win: scrollY, at: document.querySelector('.content').scrollTop}; })()")
        check(f'{scheme} desktop: Features: the content scrolls inside the window, the toolbar stays on top and the document does not move', before['doc'] <= 0 and before['can'] > 1500 and after['at'] == 900 and after['win'] == 0 and after['top'] == before['top'], json.dumps([before, after]))
        # every picture comes in as it is scrolled to (they load lazily), the right one for the colour scheme
        s.eval("""window.__done = (async () => { const c = document.querySelector('.content'); for (let y = 0; y <= c.scrollHeight; y += 500) { c.scrollTop = y; await new Promise((r) => setTimeout(r, 120)); } return true; })()""")
        time.sleep(0.5)
        s.eval('window.__done')
        time.sleep(1.2)
        pics = s.eval("[...document.querySelectorAll('figure.shot img')].map((i) => [i.naturalWidth, Math.round(i.getBoundingClientRect().width), i.currentSrc.split('/').pop()])")
        check(f'{scheme} desktop: Features: {len(pics)} pictures of YouTube, all loaded, all of the {scheme} kind', len(pics) >= 6 and all(p[0] > 0 and p[1] > 150 and p[2].endswith(f'-{scheme}.webp') for p in pics), json.dumps(pics)[:300])
        # the options are text of the settings page, not pictures: real size, in one column, selectable
        text = s.eval("""(() => { const blocks = [...document.querySelectorAll('figure.xopt')]; const title = document.querySelector('.xopt .rule-row .title'); const cs = getComputedStyle(title);
            return {blocks: blocks.length, pictures: document.querySelectorAll('figure.xopt img').length, size: parseFloat(cs.fontSize), family: cs.fontFamily.split(',')[0], scale: getComputedStyle(blocks[0]).transform, rows: document.querySelectorAll('figure.xopt .rule-row').length,
                   dark: getComputedStyle(document.querySelector('.xopt .group')).backgroundColor, over: document.documentElement.scrollWidth - document.documentElement.clientWidth, inert: [...document.querySelectorAll('figure.xopt input, figure.xopt select, figure.xopt button, figure.xopt textarea')].every((e) => e.tabIndex === -1)}; })()""")
        check(f'{scheme} desktop: Features: the options are real text at the size of the settings page (13.5 px, Calmet UI), no pictures among them, out of the tab order', text['blocks'] >= 13 and text['pictures'] == 0 and text['size'] == 13.5 and text['family'] == '"Calmet UI"' and text['scale'] == 'none' and text['rows'] >= 40 and text['inert'] and text['over'] <= 0, json.dumps(text))
        check(f'{scheme} desktop: Features: the options follow the colour scheme by themselves ({text["dark"]})', (text['dark'] == 'rgb(44, 44, 46)') == (scheme == 'dark') and (text['dark'] == 'rgb(255, 255, 255)') == (scheme == 'light'), text['dark'])
        # the layout of a block: options on the left, one under the other; the second picture right under them; the first picture on the right; no room wasted
        lay = s.eval("""(() => { const box = (e) => { const r = e.getBoundingClientRect(); return {l: Math.round(r.left), r: Math.round(r.right), t: +r.top.toFixed(1), b: Math.round(r.bottom)}; };
            const hide = document.querySelector('#hide .feature-body'); const left = [...hide.querySelectorAll('figure.left')]; const right = hide.querySelector('figure.right');
            const rules = document.querySelector('#rules .feature-body');
            const figs = [...rules.querySelectorAll(':scope > figure')].map((f) => ({...box(f), box: box(f.querySelector('.group, pre')).t, card: f.classList.contains('rule-card'), name: f.textContent.trim().slice(0, 18)}));
            const levels = [...document.querySelectorAll('.feature')].filter((x) => x.querySelector('.feature-body > figure.right')).map((x) => { const body = x.querySelector('.feature-body'); const l = body.querySelector('figure.left .group, figure.left pre'); const r = body.querySelector('figure.right');
              const first = r.querySelector('img, .group, article, .row-bar, pre') || r; return {id: x.id, left: +l.getBoundingClientRect().top.toFixed(1), right: +first.getBoundingClientRect().top.toFixed(1)}; });
            return {hide: {left: left.map(box), right: box(right)}, columns: getComputedStyle(rules).columnCount, figs, levels}; })()""")
        h = lay['hide']
        check(f'{scheme} desktop: Features, Hide: the second picture is right under the options (no gap over 20 px), the first picture is on the right, and the columns end within 80 px of each other', len(h['left']) == 2 and 0 <= h['left'][1]['t'] - h['left'][0]['b'] <= 20 and h['right']['l'] > h['left'][0]['r'] and abs(h['left'][1]['b'] - h['right']['b']) <= 80 and h['right']['t'] <= h['left'][0]['t'] + 2, json.dumps(h))
        figs = lay['figs']
        groups = [f for f in figs if not f['card']]
        cols = sorted({f['l'] for f in groups})
        firsts = {c: min(f['box'] for f in groups if f['l'] == c) for c in cols}
        ends = {c: max(f['b'] for f in groups if f['l'] == c) for c in cols}
        check(f'{scheme} desktop: Features, Rules: the rule comes first and is as wide as the block, the six groups fall into two columns under it, whole groups, none over another', lay['columns'] == '2' and len(cols) == 2 and figs[0]['card'] and figs[0]['r'] - figs[0]['l'] > 1.8 * (figs[1]['r'] - figs[1]['l']) and len(figs) == 7 and all(f['t'] >= figs[0]['b'] for f in figs[1:]) and all(figs[i]['b'] <= figs[j]['t'] or figs[j]['b'] <= figs[i]['t'] or figs[i]['l'] != figs[j]['l'] for i in range(1, 7) for j in range(i + 1, 7)), json.dumps([[f['name'], f['l'], f['t']] for f in figs]))
        check(f'{scheme} desktop: Features, Rules: the tops of the boxes of the two columns are level (within 1.5 px), and the columns end within 25% of each other', len(cols) == 2 and abs(firsts[cols[0]] - firsts[cols[1]]) <= 1.5 and abs(ends[cols[0]] - ends[cols[1]]) <= 0.25 * (max(ends.values()) - min(f['t'] for f in groups)), json.dumps([firsts, ends]))
        check(f'{scheme} desktop: Features: in every block the top of the first box on the left is level with the top of what stands on the right (within 1.5 px)', len(lay['levels']) >= 6 and all(abs(x['left'] - x['right']) <= 1.5 for x in lay['levels']), json.dumps(lay['levels']))
        if scheme == 'light':
            s.eval("document.querySelector('.content').scrollTop = 0")
            time.sleep(0.3)
            shot(s, 'site-desktop-features')
        s.__exit__(None, None, None)
    s = desktop()
    s.goto(base, wait=1.4)
    rows = s.eval("[...document.querySelectorAll('.pane a.row')].map((a) => a.getAttribute('href'))")
    s.__exit__(None, None, None)
    bad = []
    for href in rows:
        s = desktop()
        s.goto(base.rstrip('/') + '/' + href.split('/')[-1] if not href.startswith('http') else href, wait=1.0)
        time.sleep(0.4)
        r = s.eval("""(() => { const id = location.hash.slice(1), e = document.getElementById(id); if (!e) return null; const t = document.querySelector('.toolbar').getBoundingClientRect().bottom, top = e.getBoundingClientRect().top;
            const c = document.querySelector('.content'); return {top: Math.round(top - t), end: c.scrollTop + c.clientHeight >= c.scrollHeight - 2}; })()""")
        if not r or not (0 <= r['top'] <= 40 or r['end']):
            bad.append([href, r])
        s.__exit__(None, None, None)
    check('desktop: every row of the home page leads to its feature, which stands right under the toolbar (or at the end of the page)', not bad, json.dumps(bad))

    # ---- ?month= chooses the painting, and stays in the links; ?lift= puts the characters in front of the window
    s = desktop()
    got = {}
    for q in ('?month=3', '?month=03', '?month=mar', '?month=March', '?month=mär', '?month=oct', '?month=12', '?month=13', '?month=x', ''):
        s.goto(base + q, wait=0.6)
        got[q] = s.eval("document.documentElement.dataset.month")
    exp = {'?month=3': '03', '?month=03': '03', '?month=mar': '03', '?month=March': '03', '?month=mär': '03', '?month=oct': '10', '?month=12': '12', '?month=13': month, '?month=x': month, '': month}
    check('?month=3, 03, mar, March and mär show March; oct shows October; nothing, 13 and x show the current month', got == exp, json.dumps(got))
    s.goto(base + '?month=7', wait=0.8)
    pic = s.eval("getComputedStyle(document.body, '::before').backgroundImage")
    links = s.eval("[...document.querySelectorAll('#nav a.nav-item, .pane a.row')].filter((a) => a.hostname === location.hostname).map((a) => new URL(a.href).searchParams.get('month'))")
    check('?month=7: the painting of July, and every link of the site carries it, so the months can be looked at page by page', 'months/07.avif' in pic and links and all(m == '7' for m in links), json.dumps([pic[-30:], links]))
    check('the download is not touched by it', s.eval("[...document.querySelectorAll('a[href$=\".zip\"]')].every((a) => !a.search)") is True)
    s.goto(base + '?month=3', wait=0.8)
    check('in a month the owner did not choose (March) the characters stay behind the window', s.eval("!document.documentElement.dataset.stage && !document.querySelector('.ms-stage')") is True)
    s.goto(base + '?month=3&lift=overlap', wait=2.0)
    got = wait_for(s, "!!document.querySelector('.ms-stage')", timeout=8)
    check('?lift=overlap loads the stage with the characters that reach into the window', bool(got) and s.eval("document.documentElement.dataset.stage") == 'overlap')
    for m in (1, 2, 6, 7, 9, 10):
        s.goto(base + f'?month={m}', wait=1.6)
        got = wait_for(s, "!!document.querySelector('.ms-stage')", timeout=8)
        check(f'month {m} has the characters in front of the window by default', bool(got) and s.eval("document.documentElement.dataset.stage") == 'overlap')
    shot(s, 'site-desktop-lift')
    # the same page shrinks to a phone: the characters go; it grows again: they come back
    s.call('Emulation.setDeviceMetricsOverride', {'width': 390, 'height': 844, 'deviceScaleFactor': 1, 'mobile': False})
    time.sleep(1.0)
    check('when the window becomes as narrow as a phone the characters step back behind it', s.eval("!document.documentElement.dataset.stage && !document.querySelector('.ms-stage')") is True)
    s.call('Emulation.setDeviceMetricsOverride', {'width': 1280, 'height': 800, 'deviceScaleFactor': 1, 'mobile': False})
    got = wait_for(s, "!!document.querySelector('.ms-stage')", timeout=8)
    check('and when it is wide again they come back', bool(got))
    s.__exit__(None, None, None)
    t = phone(width=820, height=1180)          # a tablet
    t.goto(base + '?month=6', wait=1.8)
    got = wait_for(t, "!!document.querySelector('.ms-stage')", timeout=8)
    check('a tablet (820 px wide) has the characters in front of the window in June', bool(got) and t.eval("getComputedStyle(document.querySelector('.app')).width") != '')
    t.__exit__(None, None, None)
    t = phone()
    t.goto(base + '?month=6&lift=overlap', wait=2.0)
    check('a phone has none, not even when ?lift=overlap asks for them', t.eval("!document.documentElement.dataset.stage && !document.querySelector('.ms-stage')") is True)
    t.__exit__(None, None, None)

    # ---- the links into the extension: the ID is the one the browser really gave it (the key in manifest.json pins it), and a click opens Activity
    ids = {}
    s = desktop()
    s.goto(base + 'install.html', wait=1.4)
    hrefs = s.eval("[...document.querySelectorAll('.row a')].map((a) => a.getAttribute('href'))")
    s.__exit__(None, None, None)
    ext_links = [h for h in hrefs if h.startswith('chrome-extension://')]
    check('install: two links into the extension, with the ID the browser gave the extension', len(ext_links) == 2 and all(h.startswith(f'chrome-extension://{env.ext}/src/options/options.html') for h in ext_links), json.dumps([env.ext, ext_links]))
    check('install: Activity opens the log, "report issues" goes to the issues of the project', any(h.endswith('#log') for h in ext_links) and 'https://github.com/drugi-obieg/vianney/issues' in hrefs, json.dumps(hrefs))
    mf = json.load(open(os.path.join(EXT_DIR, 'manifest.json')))
    pats = [m for r in mf.get('web_accessible_resources', []) if 'src/options/options.html' in r['resources'] for m in r['matches']]
    u = urlparse(base)
    if f'{u.scheme}://{u.hostname}/*' in pats:
        s = desktop()
        s.goto(base + 'install.html', wait=1.4)
        s.eval("[...document.querySelectorAll('.row a')].find((a) => a.getAttribute('href').endsWith('#log')).click()")
        got = wait_for(s, "location.protocol === 'chrome-extension:' && location.hash === '#log' && document.querySelector('#log') && getComputedStyle(document.querySelector('#log')).display !== 'none' ? 'ok' : ''", timeout=8)
        check('a click on Activity, from the site, opens the settings of the extension on the log', got == 'ok', str(s.eval('location.href')))
        shot(s, 'site-deeplink-log')
        s.goto(base + 'install.html', wait=1.2)
        s.eval("[...document.querySelectorAll('.row a')].find((a) => /options\\.html$/.test(a.getAttribute('href'))).click()")
        got = wait_for(s, "location.protocol === 'chrome-extension:' && /options\\.html$/.test(location.href) ? 'ok' : ''", timeout=8)
        check('and "Tweak settings" opens the settings', got == 'ok', str(s.eval('location.href')))
        s.__exit__(None, None, None)
    else:
        print(f'   (the manifest of {EXT_DIR} does not name {u.scheme}://{u.hostname}/*: the clicks on the links into the extension are skipped; see the docstring)')


# Counts the frames in which a card with the searched words was really painted: it samples in a timeout that runs right after
# each frame (so after every requestAnimationFrame callback, ours included, and after the paint).
FLASH_RECORDER_JS = """(() => {
  const RE = /\\b(omg|oh my god)\\b/i;
  const rec = window.__rec = { frames: 0, bad: 0, maxStreak: 0, streak: 0, firstBad: null, lastBad: null, t0: performance.now(), samples: [] };
  const sample = () => {
    rec.frames++;
    let visible = 0;
    for (const a of document.querySelectorAll('a[href*="/watch?v="][title]')) {
      if (!RE.test(a.getAttribute('title') || '')) continue;
      if (a.closest('[data-vianney-state="hide"], [data-vianney-state="blank"], [data-vianney-thumb="hide"]')) continue;
      const r = a.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight) continue;   // not drawn, or off the screen
      const cs = getComputedStyle(a);
      if (cs.visibility === 'hidden' || cs.opacity === '0') continue;                         // laid out but not painted
      visible++;
    }
    const now = Math.round(performance.now() - rec.t0);
    if (visible) { rec.bad++; rec.streak++; rec.maxStreak = Math.max(rec.maxStreak, rec.streak); if (rec.firstBad === null) rec.firstBad = now; rec.lastBad = now; if (rec.samples.length < 12) rec.samples.push([now, visible]); }
    else rec.streak = 0;
  };
  const frame = () => { requestAnimationFrame(frame); setTimeout(sample, 0); };
  requestAnimationFrame(frame);
})()"""


def search_like_a_person(env, query, cpu_rate=1.0, record_seconds=8):
    """Home page, type into YouTube's own search box, press Enter; returns the page session and what the recorder saw."""
    p = Session().__enter__()
    p.call('Emulation.setDeviceMetricsOverride', {'width': 1440, 'height': 900, 'deviceScaleFactor': 1, 'mobile': False})
    if cpu_rate > 1:
        p.call('Emulation.setCPUThrottlingRate', {'rate': cpu_rate})
    p.goto('https://www.youtube.com/', wait=3)
    p.click_text([r'^(Alle ablehnen|Reject all)'])
    time.sleep(3)
    p.eval("""(() => { const i = document.querySelector('input[name="search_query"]') || document.querySelector('input#search'); i.focus(); i.value = ''; })()""")
    p.call('Input.insertText', {'text': query})
    time.sleep(0.8)
    p.eval(FLASH_RECORDER_JS)           # from here on, every painted frame is looked at
    for kind in ('keyDown', 'keyUp'):
        p.call('Input.dispatchKeyEvent', {'type': kind, 'key': 'Enter', 'code': 'Enter', 'windowsVirtualKeyCode': 13, 'text': '\r' if kind == 'keyDown' else ''})
    time.sleep(record_seconds)
    return p, p.eval('window.__rec')


def scenario_searchflow(env):
    print('\n== search flow: searching from the YouTube box like a person; painted frames, slow CPU, hover')
    env.reset()
    for rate in (1, 4):
        p, rec = search_like_a_person(env, 'omg oh my god reaction', cpu_rate=rate)
        path = p.eval('location.pathname')
        print(f'   cpu x{rate}: {json.dumps(rec)[:400]}')
        check(f'cpu x{rate}: the search happened inside the page (no reload) and results are showing', path == '/results' and cmd(p, 'snapshot')['feed']['cards'] + len(cmd(p, 'snapshot')['feed']['states']) > 10, path)
        check(f'cpu x{rate}: cards whose title has the searched words are hidden', len([x for x in cmd(p, 'snapshot')['feed']['states'] if x['state'] == 'hide']) >= 5)
        limit = 1 if rate == 1 else 4
        check(f'cpu x{rate}: at most {limit} painted frames of {rec["frames"]} showed a matching card (before this fix: seconds of them)', rec['bad'] <= limit, f"{rec['bad']} frames, first at {rec['firstBad']} ms, last at {rec['lastBad']} ms, longest run {rec['maxStreak']}")
        # nothing that was hidden comes back when the mouse moves over the page
        before = len([x for x in cmd(p, 'snapshot')['feed']['states'] if x['state'] == 'hide'])
        target = p.eval("""(() => { const a = [...document.querySelectorAll('a[href*="/watch?v="] img, img[src*="ytimg.com/vi"]')].find(i => { const r = i.getBoundingClientRect(); return r.width > 150 && r.top > 80 && r.bottom < innerHeight; }); if (!a) return null; const r = a.getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + r.height / 2}; })()""")
        if target:
            for dx in range(0, 30, 6):
                p.call('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': target['x'] + dx, 'y': target['y'], 'buttons': 0})
                time.sleep(0.15)
            time.sleep(2.5)
        leftover = p.eval("""[...document.querySelectorAll('a[href*="/watch?v="][title]')].filter(a => { if (!/\\b(omg|oh my god)\\b/i.test(a.getAttribute('title') || '')) return false; if (a.closest('[data-vianney-state="hide"]')) return false; const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length""")
        after = len([x for x in cmd(p, 'snapshot')['feed']['states'] if x['state'] == 'hide'])
        check(f'cpu x{rate}: hovering over results changes nothing (no matching card appears, none is hidden only now)', leftover == 0 and after >= before - 3, f'visible matching {leftover}, hidden {before} -> {after}')
        # and results that load while scrolling are filtered without any hover
        p.eval('window.scrollTo(0, document.documentElement.scrollHeight)')
        time.sleep(4)
        p.eval('window.scrollTo(0, document.documentElement.scrollHeight)')
        time.sleep(4)
        late = p.eval("""[...document.querySelectorAll('a[href*="/watch?v="][title]')].filter(a => { if (!/\\b(omg|oh my god)\\b/i.test(a.getAttribute('title') || '')) return false; if (a.closest('[data-vianney-state="hide"]')) return false; const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length""")
        check(f'cpu x{rate}: results that arrive while scrolling are filtered too', late == 0, str(late))
        p.__exit__(None, None, None)


def scenario_hoverpreview(env):
    print('\n== hover preview: the video that plays when the mouse rests on a thumbnail follows the card')
    env.reset()
    print('   fake model:', env.install_fake())
    env.settings(debug=True, media={'enabled': False})
    p = env.open_page('https://www.youtube.com/results?search_query=gregorian+chant+vespers', SEARCH_READY)
    for _ in range(12):
        ids = cmd(p, 'snapshot')['feed']['ids']
        both = [i for i in p.eval(THUMB_ID_JS) if i in ids]
        if len(both) >= 5:
            break
        p.eval('window.scrollBy(0, 600)')               # YouTube loads thumbnails lazily
        time.sleep(0.6)
    p.eval('window.scrollTo(0, 0)')
    check('there are thumbnails in recognised cards to try', len(both) >= 3, str(both))
    bad = both[1]
    env.fake(f"__fake.imageYes = [{{hash: {json.dumps(sha_of_thumbnail(env, bad))}, q: 'naked'}}]")
    media_on = {'enabled': True, 'votes': 2, 'thumbnails': {'enabled': True, 'hold': True, 'holdSeconds': 40, 'maxPerPage': 60, 'nearViewOnly': False}, 'audio': {'enabled': False}}

    def hover_and_look(vid, settle=3.0, need_playing=False):
        pos = p.eval(f"""(() => {{ const img = [...document.querySelectorAll('img')].find(i => (i.getAttribute('src') || '').includes('/{vid}/')); if (!img) return null; img.scrollIntoView({{block: 'center'}}); const r = img.getBoundingClientRect(); return {{x: r.left + r.width / 2, y: r.top + r.height / 2}}; }})()""")
        if not pos:
            return None
        p.call('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': 3, 'y': 300, 'buttons': 0})
        time.sleep(0.8)
        for dx in range(0, 24, 6):
            p.call('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': pos['x'] + dx, 'y': pos['y'], 'buttons': 0})
            time.sleep(0.15)
        time.sleep(settle)
        if need_playing:   # an unfiltered preview must really be showing frames before its pixels mean anything
            wait_for(p, "(() => { const v = document.querySelector('ytd-video-preview video'); return !!v && !v.paused && v.readyState >= 3 && v.currentTime > 0.3; })()", 12, 0.3)
        info = p.eval("""(() => { const pv = document.querySelector('ytd-video-preview'); if (!pv) return null; const r = pv.getBoundingClientRect(); const v = pv.querySelector('video'); return {x: r.left, y: r.top + scrollY, w: r.width, h: r.height, attr: pv.dataset.vianneyPreview || null, filter: getComputedStyle(pv).filter, opacity: getComputedStyle(pv).opacity, playing: !!v && !v.paused && v.readyState >= 3}; })()""")
        if info and info['w'] > 40:
            png = p.call('Page.captureScreenshot', {'format': 'png', 'clip': {'x': info['x'] + info['w'] * 0.2, 'y': info['y'] + info['h'] * 0.3, 'width': info['w'] * 0.6, 'height': info['h'] * 0.4, 'scale': 1}})['data']
            info['px'] = p.eval(f"""new Promise((res) => {{ const i = new Image(); i.onerror = () => res(null); i.onload = () => {{ const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let s = 0, m = 0, q = 0; const n = d.length / 4; for (let k = 0; k < d.length; k += 4) {{ const x = (d[k] + d[k + 1] + d[k + 2]) / 3; s += x; q += x * x; if (x > m) m = x; }} const mean = s / n; res({{mean: Math.round(mean), max: Math.round(m), std: Math.round(Math.sqrt(Math.max(0, q / n - mean * mean)) * 10) / 10}}); }}; i.src = 'data:image/png;base64,{png}'; }})""")
        p.call('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': 3, 'y': 300, 'buttons': 0})
        return info

    # a clean card whose hover preview really starts: ordinary video results do, Shorts shelves show none here
    ordinary = p.eval("""[...document.querySelectorAll('ytd-video-renderer img[src*="ytimg.com/vi"]')].map(i => (i.getAttribute('src').match(/\\/vi(?:_webp|_lc)?\\/([\\w-]{11})\\//) || [])[1]).filter(Boolean)""")
    clean = ordinary[0] if ordinary else both[2]
    check('there is an ordinary video result to use as the clean example', bool(ordinary), str(ordinary[:3]))
    # 1. blackout: the preview is black
    env.settings(debug=True, media=media_on, actions={'explicit_images': {'thumbnail': 'blackout'}})
    wait_for(p, f"document.querySelector('[data-vianney-thumb=\"blackout\"]') ? 1 : 0", 30)
    info = hover_and_look(bad)
    check('a blacked-out result: the hover preview is black too (it used to show the real video)', bool(info) and info.get('attr') == 'black' and info.get('px') and info['px']['max'] <= 8, json.dumps(info))
    # 2. blur
    env.settings(debug=True, media=media_on, actions={'explicit_images': {'thumbnail': 'blur'}})
    wait_for(p, "document.querySelector('[data-vianney-thumb=\"blur\"]') ? 1 : 0", 20)
    info = hover_and_look(bad)
    check('a blurred result: the hover preview is blurred (the preview element carries the blur)', bool(info) and info.get('attr') == 'blur' and 'blur(28px)' in info['filter'], json.dumps(info))
    # 3. a clean result is left alone
    info = hover_and_look(clean, need_playing=True)
    for _ in range(2):                 # the shared preview is moved by YouTube after the mouse has arrived; under load it can still sit over the card that was hovered before: look again
        if info and info.get('attr') is None:
            break
        info = hover_and_look(clean, need_playing=True)
    check('a clean result: the hover preview is untouched', bool(info) and info.get('attr') is None and info['filter'] == 'none' and info.get('px') and info['px']['std'] > 10, json.dumps(info))
    # 4. revealed by the user: the preview is shown
    env.settings(debug=True, media=media_on, actions={'explicit_images': {'thumbnail': 'blackout'}})
    wait_for(p, "document.querySelector('[data-vianney-thumb=\"blackout\"]') ? 1 : 0", 20)
    p.eval("document.querySelector('[data-vianney-thumb=\"blackout\"] .vianney-thumb-badge button').click()")
    time.sleep(0.6)
    info = hover_and_look(bad, need_playing=True)
    check('after "Show" the user sees the preview', bool(info) and info.get('attr') is None and info.get('px') and info['px']['std'] > 10, json.dumps(info))
    p.eval("document.querySelector('[data-vianney-thumb=\"revealed\"] .vianney-thumb-badge button').click()")
    time.sleep(0.6)
    # 5. still unchecked (a model that takes long): the preview is black as well as the thumbnail
    env.fake("__fake.delayMs = 60000")
    env.ctrl.eval("chrome.storage.local.remove('mediaCache')")
    env.settings(debug=True, media=dict(media_on, thumbnails=dict(media_on['thumbnails'], holdSeconds=0)), actions={})
    time.sleep(1.0)
    p.eval('location.reload()')
    time.sleep(7)
    wait_for(p, SEARCH_READY, 25)
    time.sleep(2)
    ids2 = cmd(p, 'snapshot')['feed']['ids']
    both2 = [i for i in p.eval(THUMB_ID_JS) if i in ids2]
    pending = p.eval("document.querySelectorAll('[data-vianney-pending]').length")
    info = hover_and_look(both2[0]) if both2 else None
    # the held thumbnail behind it is invisible and a paused preview has no frame, so what is left is a plain area: no picture, no video
    check('a result that has not been judged yet is marked, and its hover preview shows no picture (uniform area, nothing of the video)', pending >= 1 and bool(info) and info.get('attr') == 'black' and info.get('px') and info['px']['std'] < 3, f'pending {pending}, {json.dumps(info)}')
    # 6. a dimmed card (a title rule): the preview is dimmed
    env.settings(debug=True, media={'enabled': False}, ruleEnabled={'oaths': True}, sensitivity={'oaths': 0.5})
    p.eval('location.href = "https://www.youtube.com/results?search_query=i+swear+to+god"')
    time.sleep(6)
    wait_for(p, SEARCH_READY, 25)
    time.sleep(2)
    snap = cmd(p, 'snapshot')
    dim = [x for x in snap['feed']['states'] if x['state'] == 'dim']
    if dim:
        info = hover_and_look(dim[0]['id'])
        check('a dimmed card: the hover preview is dimmed', bool(info) and info.get('attr') == 'dim', json.dumps(info))
    else:
        check('a dimmed card exists for this search', False, json.dumps(snap['feed']['states'])[:200])
    env.fake("__fake.delayMs = 0")
    p.__exit__(None, None, None)


# ---------------------------------------------------------------------------------------------------------------- the local model (Kev-0.6B)
def scenario_kev(env):
    """The local model, for real: the pinned files are downloaded into the browser's private file system, the download is cut half way and resumed,
    a corrupted byte is refused by the SHA-256, the model answers a question about a real YouTube title through the content script, the service worker
    and the offscreen document, and everything is deleted again.

    Needs the weights on disk and a copy of the extension that may talk to the test server:
      python3 tools/kev-test-ext.py <folder>                          (a copy of the extension that also names http://127.0.0.1/*)
      KEV_FILES=<folder holding config.json, tokenizer.json, ..., onnx/model_q4f16.onnx, ...>  E2E_EXT_DIR=<folder>  python3 tools/e2e.py kev
    Restart Chrome first (tools/e2e-chrome.sh); keep the display awake (caffeinate -d), a headless Chrome stops answering on a sleeping Mac.
    With --disable-gpu (the default of tools/e2e-chrome.sh) Chrome has no WebGPU and the 383 MB WebAssembly files are used; with E2E_GPU_FLAG=" " the
    346 MB WebGPU files are. KEV_REAL=1 (and `tools/kev-test-ext.py <folder> --hf`) downloads from huggingface.co instead of the test server: no cut, no
    corrupted byte. KEV_SKIP_CHECK=1 leaves out the run over all rule examples (it takes minutes on the processor)."""
    import re, socket, subprocess, urllib.request
    print('\n== kev: the local model Kev-0.6B: download, resume, hash check, answer, delete')
    real = os.environ.get('KEV_REAL') == '1'
    files = os.environ.get('KEV_FILES')
    manifest = json.load(open(os.path.join(EXT_DIR, 'manifest.json'), encoding='utf-8'))
    hosts = ' '.join(manifest.get('host_permissions', []))
    if real and 'huggingface.co' not in hosts:
        print('   (KEV_REAL=1 needs a copy of the extension from tools/kev-test-ext.py --hf: skipped)'); return
    if not real and not (files and os.path.isdir(files) and '127.0.0.1' in hosts):
        print('   (KEV_FILES and a copy of the extension from tools/kev-test-ext.py are needed: skipped)'); return

    def click(s, selector):
        c = s.eval(f"(() => {{ const e = document.querySelector({json.dumps(selector)}); if (!e) return null; e.scrollIntoView({{block: 'center'}}); const r = e.getBoundingClientRect(); return {{x: r.left + r.width / 2, y: r.top + r.height / 2}}; }})()")
        if not c or '__error__' in c:
            return False
        time.sleep(0.2)
        for t in ('mouseMoved', 'mousePressed', 'mouseReleased'):
            s.call('Input.dispatchMouseEvent', {'type': t, 'x': c['x'], 'y': c['y'], 'button': 'left', 'buttons': 1 if t == 'mousePressed' else 0, 'clickCount': 1})
        return True

    row = lambda s: s.eval("""(() => { const r = document.querySelector('[data-model="kev"]'); if (!r) return null;
        const t = (sel) => { const e = r.querySelector(sel); return e ? e.textContent : ''; };
        return {state: r.dataset.state, pill: t('.pill-state'), title: t('strong'), lede: t('.lede'), facts: t('.facts'), progress: t('.progress-text'), note: t('.note:last-child'),
                buttons: [...r.querySelectorAll('button[data-act]')].map((b) => [b.dataset.act, b.textContent]), index: [...r.parentElement.children].indexOf(r)}; })()""")
    wait_row = lambda s, state, timeout=120: wait_for(s, f"(() => {{ const r = document.querySelector('[data-model=\"kev\"]'); return r && r.dataset.state === {json.dumps(state)} ? r.dataset.state : ''; }})()", timeout, 0.4)
    opfs = lambda s: s.eval("""(async () => { const root = await navigator.storage.getDirectory(); const out = {};
        for await (const [name, h] of root.entries()) { if (h.kind !== 'directory') continue; out[name] = {}; for await (const [n, f] of h.entries()) out[name][n] = f.kind === 'file' ? (await f.getFile()).size : 'dir'; } return out; })()""")
    ask = lambda s, q, text: s.eval(f"chrome.runtime.sendMessage({{type: 'ai-ask', kind: 'noul', question: {json.dumps(q)}, text: {json.dumps(text)}}})")
    mirror = {'port': None, 'proc': None}

    def mirror_call(path, body=None):
        req = urllib.request.Request(f"http://127.0.0.1:{mirror['port']}{path}", data=json.dumps(body).encode() if body is not None else None, method='POST' if body is not None else 'GET')   # /__clear and /__fault are POSTs: pass {}
        return json.load(urllib.request.urlopen(req, timeout=10))

    def start_mirror(rate):
        with socket.socket() as sk:
            sk.bind(('127.0.0.1', 0)); mirror['port'] = sk.getsockname()[1]
        mirror['proc'] = subprocess.Popen(['node', os.path.join(HERE, 'kev-mirror.mjs'), '--dir', files, '--port', str(mirror['port']), '--rate', str(rate)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(40):
            try:
                mirror_call('/__log'); return
            except Exception:
                time.sleep(0.15)
        raise RuntimeError('the test server did not start')

    o = None
    try:
        env.reset()
        if not real:
            start_mirror(40)
            env.settings(kevMirror=f"http://127.0.0.1:{mirror['port']}/", ai={'enabled': True, 'backend': 'auto'})
        o = Session().__enter__()
        o.call('Emulation.setDeviceMetricsOverride', {'width': 1100, 'height': 1200, 'deviceScaleFactor': 1, 'mobile': False})
        o.goto(f'chrome-extension://{env.ext}/src/options/options.html#ai', wait=2)
        o.eval("chrome.runtime.sendMessage({type: 'kev-delete'})")        # a clean start: nothing from an earlier run
        o.eval('location.reload()'); time.sleep(2)
        wait_row(o, 'not-downloaded', 30)

        # ---- 1. the row, before anything is downloaded
        r = row(o)
        check('the row of the local model is the first one in the panel and carries its name', bool(r) and r['index'] == 0 and r['title'] == 'Kev-0.6B', json.dumps(r))
        m = re.match(r'Download Kev-0\.6B \((346|383) MB\)$', (r['buttons'][0][1] if r and r['buttons'] else ''))
        check('it offers one button, named, with the size of the files this computer needs', bool(m) and r['pill'] == 'Not downloaded', json.dumps(r))
        size = int(m.group(1)) if m else 346
        wasm = size == 383
        print(f"   this Chrome: {'no WebGPU, the WebAssembly files (383 MB)' if wasm else 'WebGPU with half precision (346 MB)'}")
        check('a plain line under the title, and the licence and privacy facts', r['lede'].startswith('Runs on this computer in any browser.') and 'Apache-2.0, English only' in r['facts'] and 'nothing is sent anywhere' in r['facts'], json.dumps(r))
        names = o.eval("[...document.querySelectorAll('#ai-models .model')].map((x) => x.dataset.model + ':' + x.querySelector('strong').textContent)")
        check('the panel lists Kev-0.6B first, then Gemini Nano, then the picture and sound rows', names[:2] == ['kev:Kev-0.6B', 'text:Gemini Nano (built into Chrome)'] and [n.split(':')[0] for n in names] == ['kev', 'text', 'image', 'audio'], str(names))
        if not real:
            check('nothing is stored yet', not (opfs(o) or {}), json.dumps(opfs(o)))

        # ---- 2. a corrupted byte in the tokenizer: the SHA-256 refuses the file, it is deleted, the error says which one
        if not real:
            mirror_call('/__fault', {'path': 'tokenizer.json', 'corrupt': {'at': 5000}})
            check('(the download button is clicked like a person would: with the mouse)', click(o, '[data-model="kev"] button[data-act="download"]'))
            failed = wait_row(o, 'error', 90)
            r = row(o)
            check('a flipped byte: the row says Failed, names the file, and says the SHA-256 refused it and the file was deleted', failed == 'error' and 'tokenizer.json' in r['note'] and 'SHA-256' in r['note'] and 'deleted' in r['note'], json.dumps(r))
            check('and offers Retry and Delete', [b[0] for b in r['buttons']] == ['retry', 'delete'], json.dumps(r['buttons']))
            have = opfs(o)
            folder = next(iter(have.values()), {})
            check('the files before it are kept and checked, the refused file is empty', folder.get('config.json') == 2267 and folder.get('tokenizer_config.json') == 9678 and folder.get('tokenizer.json') in (None, 0), json.dumps(folder))
            mirror_call('/__clear', {})

        # ---- 3. pause, then resume, with the connection cut half way
        data_name = 'onnx/model_q4.onnx_data' if wasm else 'onnx/model_q4f16.onnx_data'
        data_flat = data_name.replace('/', '__')
        ok_click = click(o, '[data-model="kev"] button[data-act="retry"]') if not real else click(o, '[data-model="kev"] button[data-act="download"]')
        check('Retry / Download starts the download', ok_click)
        started = wait_for(o, "(() => { const r = document.querySelector('[data-model=\"kev\"]'); return r && r.dataset.state === 'downloading' && r.querySelector('progress') && r.querySelector('progress').value > 0.08 ? r.dataset.state : ''; })()", 90, 0.3)
        r = row(o)
        check('while it runs: a bar, "N of M MB", the speed, and Pause and Cancel', started == 'downloading' and re.search(r'\d+ of %d MB' % size, r['progress']) and 'MB/s' in r['progress'] and [b[0] for b in r['buttons']] == ['pause', 'cancel'], json.dumps(r))
        click(o, '[data-model="kev"] button[data-act="pause"]')
        paused = wait_row(o, 'paused', 30)
        r = row(o)
        have = list((opfs(o) or {}).values())
        folder = have[0] if have else {}
        part = folder.get(data_flat, 0)
        check('Pause: the row says Paused, with what is on disk, and Resume', paused == 'paused' and re.search(r'\d+ of %d MB downloaded' % size, r['progress']) and [b[0] for b in r['buttons']][0] == 'download', json.dumps(r))
        check('a part of the big file is kept on disk', 0 < part < 400e6, str(part))
        pre_log = []
        if not real:
            pre_log = mirror_call('/__log')
            mirror_call('/__clear', {})
            mirror_call('/__fault', {'path': data_name, 'cutAfter': 45_000_000, 'times': 1})   # the next request for the data file dies after 45 MB
        click(o, '[data-model="kev"] button[data-act="download"]')                          # "Resume"
        done = wait_row(o, 'ready', 300 if real else 150)
        r = row(o)
        check('Resume carries on and finishes: the row says Ready', done == 'ready' and r['pill'] == 'Ready', json.dumps(r))
        if not real:
            log = pre_log + mirror_call('/__log')
            big = [x for x in log if x['path'] == data_name]
            ranges = [x['range'] for x in big]
            starts = [int(re.match(r'bytes=(\d+)-', x).group(1)) for x in ranges if x]
            print('   requests for the big file:', [(x['range'], x['status'], x['sent'], 'cut' if x['aborted'] else '') for x in big])
            check('the first request was stopped by Pause, the next ones asked for the rest with a Range header from where the file stood', len(big) >= 3 and starts and starts[0] > 0, str(ranges))
            check('the connection that was cut after 45 MB was resumed from exactly the byte where it died', any(x['aborted'] and x['sent'] == 45_000_000 for x in big) and any(starts[i] > starts[0] for i in range(1, len(starts))), json.dumps([(x['range'], x['sent'], x['aborted']) for x in big]))
            check('every request went to the pinned address, through the redirect', all(x['path'] in [f for f in [data_name, 'config.json', 'tokenizer.json', 'tokenizer_config.json', data_name.replace('_data', '')]] for x in log), json.dumps(sorted({x['path'] for x in log})))

        # ---- 4. what is on disk, and what the service worker says
        have = opfs(o)
        folder = next(iter(have.values()), {})
        wanted = {'config.json': 2267, 'tokenizer_config.json': 9678, 'tokenizer.json': 7031645, data_name.replace('/', '__').replace('_data', ''): 1245327 if wasm else 3338522, data_flat: 374822912 if wasm else 335357952, 'state.json': None}
        sizes_ok = all(k in folder and (v is None or folder[k] == v) for k, v in wanted.items())
        check('all pinned files are on disk with their exact sizes, and a record that they were verified', sizes_ok, json.dumps(folder))
        st = o.eval("chrome.runtime.sendMessage({type: 'ai-status', force: true})")
        check('the service worker lists Kev-0.6B as an available layer, first', st and st['availability'] == 'available' and st['layers'][0]['name'] == 'kev' and st['layers'][0]['available'] is True and st['key'].startswith('kev:1'), json.dumps(st))

        # ---- 5. a question, through the service worker and the offscreen document
        rules_text = open(os.path.join(EXT_DIR, 'rules', 'vianney.en.rules'), encoding='utf-8').read()
        q = re.search(r'rule lords_name\b.*?^\s*ask noul:\s*([^\n]+)', rules_text, re.S | re.M).group(1).strip()
        t0 = time.time()
        a1 = ask(o, q, 'Jesus Christ, what the fuck was that')
        first_s = time.time() - t0
        a2 = ask(o, q, 'Jesus Christ is Lord: a homily for Sunday')
        print(f'   first answer (loads the model) {first_s:.1f} s; answers: {json.dumps(a1)[:160]} / {json.dumps(a2)[:120]}')
        check('the first question loads the model from the files and is answered by Kev', isinstance(a1, dict) and isinstance(a1.get('p'), (int, float)) and a1.get('via') == 'kev' and a1['steps'][0]['model'] == 'kev', json.dumps(a1)[:300])
        check('a curse and a homily get different answers (no constant)', isinstance(a2.get('p'), (int, float)) and isinstance(a1.get('p'), (int, float)) and abs(a1['p'] - a2['p']) > 0.02, f"{a1.get('p')} {a2.get('p')}")
        again = ask(o, q, 'Jesus Christ, what the fuck was that')
        check('the same question again gives the same p (deterministic)', isinstance(again.get('p'), (int, float)) and isinstance(a1.get('p'), (int, float)) and abs(again['p'] - a1['p']) < 1e-9, f"{a1.get('p')} {again.get('p')}")
        ks = o.eval("chrome.runtime.sendMessage({type: 'kev-status'})")
        rt = ks.get('runtime') or {}
        print('   runtime:', json.dumps(rt))
        check('the offscreen document reports how it runs: WebGPU on a computer that has it, else WebAssembly', rt.get('state') == 'ready' and rt.get('device') == ('wasm' if wasm else 'webgpu') and rt.get('set') == ('q4' if wasm else 'q4f16'), json.dumps(rt))
        o.eval('location.reload()'); time.sleep(2.5)
        wait_row(o, 'ready', 30)
        r = row(o)
        check('after a reload of the settings page the row still says Ready and how it runs', r['pill'] == 'Ready' and ('WebAssembly, q4: slow' if wasm else 'WebGPU, q4f16') in r['facts'], json.dumps(r))

        # ---- 6. the same on a real YouTube page: content script -> service worker -> offscreen document
        p = env.open_page('https://www.youtube.com/results?search_query=Jesus+Christ+Superstar', SEARCH_READY)
        title = p.eval("(() => { const t = [...document.querySelectorAll('a[title], #video-title')].map((a) => (a.getAttribute('title') || a.textContent || '').trim()); return t.find((x) => /jesus christ/i.test(x)) || ''; })()") or 'Jesus Christ Superstar (1973) full movie'
        print('   a real title:', title)
        v = cmd(p, 'evaluate', {'item': {'title': title, 'channel': ''}, 'surface': 'feed-card'}, timeout=90)
        # what the engine sends for this title: the rule's question with its nearest examples (core/shots.js), asked here by the same modules
        direct_q = o.eval("(async () => { const { parseRules } = await import('/src/core/rules.js'); const { withExamples } = await import('/src/core/shots.js'); "
                          "const rule = parseRules(await (await fetch('/rules/vianney.en.rules')).text()).rules.find((r) => r.id === 'lords_name'); "
                          f"return withExamples(rule.asks[0].question, rule, {{ shots: 2, text: {json.dumps(title)} }}); }})()")
        check('the question that goes to the model carries examples, first, and the question last', isinstance(direct_q, str) and direct_q.startswith('Examples that count (yes): ') and '\nQuestion: ' in direct_q, str(direct_q)[:200])
        direct = ask(o, direct_q, title)
        pl = (v.get('ps') or {}).get('lords_name')
        check('the content script asks through the service worker and gets Kev\'s answer for a real title', isinstance(pl, (int, float)) and isinstance(direct.get('p'), (int, float)) and abs(pl - 0.75) > 1e-6 and abs(pl - direct['p']) < 1e-9, f'content script {pl}, direct {direct.get("p")}, reply {json.dumps(v)[:200]}')
        snap = cmd(p, 'snapshot')
        check('the page knows the model can answer', snap.get('aiEnabled') is True, str(snap.get('aiEnabled')))

        # ---- 7. a content script on a web page may not look at, start, stop or delete the model
        ctx = None
        p.call('Runtime.disable')                      # so that enabling it again reports the worlds that exist
        p._id += 1
        p._send(json.dumps({'id': p._id, 'method': 'Runtime.enable'}))
        end = time.time() + 4
        p.s.settimeout(1.0)
        while time.time() < end:
            try:
                msg = json.loads(p._recv())
            except Exception:
                break
            c = (msg.get('params') or {}).get('context') if msg.get('method') == 'Runtime.executionContextCreated' else None
            if c and c.get('origin') == f'chrome-extension://{env.ext}':
                ctx = c['id']
        p.s.settimeout(120)
        if ctx is None:
            check('(the world of the content script was found)', False, 'no execution context of the extension')
        else:
            def from_content(js):
                r = p.call('Runtime.evaluate', {'contextId': ctx, 'expression': js, 'awaitPromise': True, 'returnByValue': True})
                return (r.get('result') or {}).get('value')
            check('the content script is really in the extension world (it has chrome.runtime)', from_content('typeof chrome.runtime.id') == 'string')
            refused = {t: from_content(f"chrome.runtime.sendMessage({{type: '{t}'}})") for t in ('kev-delete', 'kev-cancel', 'kev-pause', 'kev-download', 'kev-status')}
            check('from a content script: kev-delete, -cancel, -pause, -download and -status are all refused', all(isinstance(x, dict) and x.get('ok') is False and x.get('error') == 'not allowed' for x in refused.values()), json.dumps(refused))
            direct_to_doc = from_content("chrome.runtime.sendMessage({target: 'kev-offscreen', op: 'prepare-delete'})")
            check('and a message addressed to the offscreen document does nothing (the worker answers first with an error, and the document itself refuses what does not come from the worker)', isinstance(direct_to_doc, dict) and direct_to_doc.get('ok') is not True and bool(direct_to_doc.get('error')), json.dumps(direct_to_doc))
            check('the files are all still there', (next(iter((opfs(o) or {}).values()), {}) or {}).get(data_flat) == (374822912 if wasm else 335357952))
            ok_ask = from_content(f"chrome.runtime.sendMessage({{type: 'ai-ask', kind: 'noul', question: {json.dumps(q)}, text: 'Oh my god'}})")
            check('while asking a question is allowed for it (that is what the page does)', isinstance(ok_ask, dict) and isinstance(ok_ask.get('p'), (int, float)), json.dumps(ok_ask))
        p.__exit__(None, None, None)

        # ---- 8. the model leaves memory when idle (here: when the service worker is told so) and comes back from the files
        o.eval("chrome.runtime.sendMessage({type: 'kev-idle'})")
        time.sleep(1.5)
        gone = o.eval("chrome.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT']}).then((c) => c.length)")
        check('after "idle" the offscreen document is closed (the memory is free again)', gone == 0, str(gone))
        t0 = time.time()
        back = ask(o, q, 'Jesus Christ, what the fuck was that')
        print(f'   after the document was closed, a question loads it again: {time.time() - t0:.1f} s')
        check('the next question opens it again, loads the model from the files and answers the same', isinstance(back.get('p'), (int, float)) and isinstance(a1.get('p'), (int, float)) and abs(back['p'] - a1['p']) < 1e-9, f"{a1.get('p')} {back.get('p')}")

        # ---- 9. the same questions over all the rule examples (the panel "Check on the rule examples")
        if os.environ.get('KEV_SKIP_CHECK') != '1':
            o.eval('location.reload()'); time.sleep(2.5)
            wait_row(o, 'ready', 30)
            click(o, 'details.examples summary')
            time.sleep(0.4)
            check('the panel exists and has a run button', click(o, '#ai-examples-run'))
            res = wait_for(o, "(() => { const t = document.getElementById('ai-examples-out').textContent; return t.includes('Models that answered') ? t : ''; })()", 900 if wasm else 240, 1.0)
            check('the check ran over the rule examples and names the model that answered', bool(res) and 'Models that answered: Kev-0.6B' in res, (res or '')[:300])
            summary = o.eval("[...document.querySelectorAll('#ai-examples-out .r')].slice(0, 3).map((x) => x.textContent)")
            print('   check on the rule examples:', ' | '.join(summary)[:700])
            m1 = re.search(r'Examples \(should be flagged\): (\d+) of (\d+) flagged by the word lists alone, (\d+) of (\d+) with Kev-0\.6B', res or '')
            m2 = re.search(r'Spared lines \(should be left alone\): (\d+) of (\d+) flagged by the word lists alone, (\d+) of (\d+) with Kev-0\.6B', res or '')
            check('it counts examples and spared lines, the word lists alone against the word lists plus the model', bool(m1 and m2) and int(m1.group(2)) > 100 and int(m2.group(2)) > 50, f'{m1 and m1.group(0)} / {m2 and m2.group(0)}')
            check('and says what the model changed, in both directions (flagged what the words missed, cleared what the words flagged)', bool(re.search(r'Kev-0\.6B (flagged|cleared|changed nothing)', res or '')), (res or '')[:400])
            n_rules = o.eval("document.querySelectorAll('#ai-examples-out details.r').length")
            check('every rule with a question is listed with its lines', n_rules >= 40, str(n_rules))
            shot(o, 'kev-examples')

        # ---- 10. delete: two clicks, and everything is gone
        shot(o, 'kev-ready')
        click(o, '[data-model="kev"] button[data-act="delete"]')
        time.sleep(0.5)
        r = row(o)
        check('Delete asks again, with the size, and offers Keep', [b[0] for b in r['buttons']] == ['delete-yes', 'delete-no'] and re.match(r'Delete \d+ MB', r['buttons'][0][1]), json.dumps(r['buttons']))
        click(o, '[data-model="kev"] button[data-act="delete-no"]')
        time.sleep(0.4)
        check('Keep leaves everything as it was', row(o)['state'] == 'ready')
        click(o, '[data-model="kev"] button[data-act="delete"]'); time.sleep(0.4)
        click(o, '[data-model="kev"] button[data-act="delete-yes"]')
        gone = wait_row(o, 'not-downloaded', 60)
        left = opfs(o)
        check('after the second click the row says Not downloaded and no file is left', gone == 'not-downloaded' and not any(left.values()), json.dumps(left))
        st = o.eval("chrome.runtime.sendMessage({type: 'ai-status', force: true})")
        check('the service worker no longer counts Kev-0.6B', st['layers'][0]['available'] is False and st['key'].startswith('kev:0'), json.dumps(st))
        o.eval('location.reload()'); time.sleep(2)
        check('and after a reload it is still not downloaded', wait_row(o, 'not-downloaded', 20) == 'not-downloaded')

        # ---- 11. cancel, in the middle of a download, removes what was downloaded
        click(o, '[data-model="kev"] button[data-act="download"]')
        wait_for(o, "(() => { const r = document.querySelector('[data-model=\"kev\"]'); return r && r.dataset.state === 'downloading' && r.querySelector('progress') && r.querySelector('progress').value > 0.03 ? 'x' : ''; })()", 90, 0.3)
        click(o, '[data-model="kev"] button[data-act="cancel"]')
        wait_row(o, 'not-downloaded', 30)
        time.sleep(1.0)
        left = opfs(o)
        check('Cancel: the row is back to Not downloaded and the partial files are removed', row(o)['state'] == 'not-downloaded' and not any(left.values()), json.dumps(left))
    finally:
        try:
            if o:
                o.eval("chrome.runtime.sendMessage({type: 'kev-delete'})")
                o.__exit__(None, None, None)
        except Exception:
            pass
        if mirror['proc']:
            mirror['proc'].terminate()
        env.settings(kevMirror=None)


SCENARIOS = {'smoke': scenario_smoke, 'feed': scenario_feed, 'slider': scenario_slider, 'break': scenario_break,
             'subtitles': scenario_subtitles, 'live-captions': scenario_live_captions, 'falsepos': scenario_falsepos, 'positives': scenario_positives, 'watchmeta': scenario_watchmeta, 'options': scenario_options, 'ai': scenario_ai,
             'searchflow': scenario_searchflow, 'hoverpreview': scenario_hoverpreview, 'modelcheck': scenario_modelcheck, 'media-options': scenario_media_options, 'media-thumbnails': scenario_media_thumbnails, 'media-audio': scenario_media_audio,
             'cleanup': scenario_cleanup, 'popup': scenario_popup, 'comments': scenario_comments, 'site': scenario_site, 'resets': scenario_resets, 'kev': scenario_kev, 'music': scenario_music}

if __name__ == '__main__':
    wanted = sys.argv[1:] or [n for n in SCENARIOS if n not in ('live-captions', 'positives')]
    env = Env()
    print('extension id:', env.ext)
    env.reset()
    try:
        for name in wanted:
            SCENARIOS[name](env)
    finally:
        env.close()
    bad = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(bad)} passed, {len(bad)} failed")
    sys.exit(1 if bad else 0)
