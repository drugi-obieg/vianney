"""End-to-end test: the unpacked extension in a throwaway headless Chrome, against real YouTube pages.

Usage:
  1. start Chrome with:  --headless=new --remote-debugging-port=9333 --enable-unsafe-extension-debugging
                         --user-data-dir=<empty dir>   (see tools/e2e-chrome.sh)
  2. python3 tools/e2e.py [scenario ...]        scenarios: smoke feed slider break subtitles options ai falsepos watchmeta media-options media-thumbnails media-audio
                                                also live-captions and positives (informational, not run by default)

The media scenarios put a FAKE on-device model into the extension's service worker (no real Gemini Nano is needed or used):
real thumbnails are fetched, real sound is captured from the playing video, and only the model's yes/no is scripted.
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
  const state = globalThis.__fake = { log: [], imageYes: [], audioYes: [], rmsMin: 0.005, availability: { text: 'available', image: 'available', audio: 'available' } };
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
    print('\n== break: the reminder card appears, can be snoozed, and goes away')
    env.reset()
    env.settings(debug=True, brk={'afterMinutes': 1, 'snoozeMinutes': 15})
    p = env.open_page('https://www.youtube.com/results?search_query=gregorian+chant', SEARCH_READY)
    snap = cmd(p, 'snapshot')
    check('no reminder before any watching', not snap['brk']['due'])
    env.storage_set(breakState={'periodKey': 'session', 'accumSeconds': 4000, 'lastPlayMs': int(time.time() * 1000), 'nextDueSeconds': 60})
    ok = wait_for(p, "!!document.querySelector('[data-vianney-ui=\"break-card\"]')", 10)
    check('the card is injected into the list', ok)
    if ok:
        info = p.eval("""(() => { const h = document.querySelector('[data-vianney-ui="break-card"]'); const r = h.getBoundingClientRect();
          const next = h.nextElementSibling; return {title: h.shadowRoot.querySelector('.title').textContent, label: h.shadowRoot.querySelector('.label').textContent,
          w: Math.round(r.width), h: Math.round(r.height), beforeCard: !!(next && next.querySelector('a[href*="/watch?v="]'))}})()""")
        check('it says how long the user has been watching', '1 hour 7 minutes' in info['title'], info['title'])
        check('it carries the extension label', 'Vianney' in info['label'])
        check('it sits directly before the first video card', info['beforeCard'])
        shot(p, 'break-card')
        p.eval("document.querySelector('[data-vianney-ui=\"break-card\"]').shadowRoot.querySelector('.later').click()")
        gone = wait_for(p, "!document.querySelector('[data-vianney-ui=\"break-card\"]')", 8)
        check('"Remind me later" removes the card', gone)
        st = env.ctrl.eval("chrome.storage.local.get('breakState').then(r => r.breakState)")
        check('and postpones the next reminder by the snooze time', abs(st['nextDueSeconds'] - (st['accumSeconds'] + 15 * 60)) < 1, json.dumps(st))
    p.__exit__(None, None, None)

    # watch-time accounting through the real message path
    env.reset()
    env.settings(debug=True, brk={'afterMinutes': 1})
    env.ctrl.eval("chrome.runtime.sendMessage({type: 'watch-tick', seconds: 90})")
    time.sleep(1.5)
    st = env.ctrl.eval("chrome.storage.local.get('breakState').then(r => r.breakState)")
    check('the service worker counts reported playback seconds', st and abs(st['accumSeconds'] - 90) < 1, json.dumps(st))


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
    print('\n== false positives: reverent and religious content is left alone at the default settings')
    env.reset()
    for q in CATHOLIC_QUERIES:
        p = env.open_page('https://www.youtube.com/results?search_query=' + q.replace(' ', '+'), SEARCH_READY)
        snap = cmd(p, 'snapshot')
        flagged = snap['feed']['states']
        check(f'nothing hidden for "{q}"', len(flagged) == 0, '; '.join(f"{s['reason']}: {s['title']}" for s in flagged[:4]))
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
    check('it covers the player and names the rule', bool(shown) and shown['w'] > 300 and 'name in vain' in shown['text'], json.dumps(shown))
    check('and the video is paused behind it', bool(shown) and shown['paused'] is True)
    shot(p, 'overlay')
    p.eval("document.querySelector('[data-vianney-ui=\"overlay\"]').shadowRoot.querySelector('.watch').click()")
    gone = wait_for(p, "!document.querySelector('[data-vianney-ui=\"overlay\"]')", 5)
    check('"Watch anyway" removes the overlay', gone)
    p.__exit__(None, None, None)


def scenario_options(env):
    print('\n== options: the settings page renders rules with a control each')
    env.reset()
    o = Session().__enter__()
    o.call('Emulation.setDeviceMetricsOverride', {'width': 1100, 'height': 1000, 'deviceScaleFactor': 1, 'mobile': False})
    o.goto(f'chrome-extension://{env.ext}/src/options/options.html', wait=2)
    n = o.eval("document.querySelectorAll('#rule-list .rule').length")
    check('every rule is listed', n >= 4, str(n))
    sliders = o.eval("document.querySelectorAll('#rule-list input[type=range], #rule-list select').length")
    check('each rule has a slider or a dropdown', sliders >= n, f'{sliders} controls for {n} rules')
    o.eval("(() => { const r = document.querySelector('#rule-list input[type=range]'); r.value = 55; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); })()")
    time.sleep(0.8)
    saved = env.ctrl.eval("chrome.storage.local.get('settings').then(r => r.settings && r.settings.sensitivity)")
    check('moving a slider stores the new sensitivity', saved and any(abs(v - 0.55) < 1e-9 for v in saved.values()), json.dumps(saved))
    o.eval("document.getElementById('test-text').value = 'oh my god, this is fucking great'; document.getElementById('test-surface').value = 'feed-card'; document.getElementById('test-run').click()")
    time.sleep(1.5)
    res = o.eval("document.getElementById('test-result').innerText")
    check('the test box shows which rules react', 'FLAGGED' in res, res[:200])
    check('the rule editor holds the shipped text', o.eval("document.getElementById('rules-text').value.includes('rule lords_name')"))
    shot(o, 'options')
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
    status = o.eval("document.getElementById('media-status').textContent")
    check('it reports the model status for pictures and for sound', 'Pictures:' in status and 'Sound:' in status, status)
    marked = o.eval("[...document.querySelectorAll('#rule-list .rule')].filter(r => r.querySelector('.tag')).map(r => r.querySelector('h3').textContent)")
    check('the picture and sound rules are listed and marked experimental', len(marked) == 6, str(marked))
    warned = o.eval("document.querySelectorAll('#rule-list .warnline').length")
    check('while the feature is off, those rules say that they do nothing', warned == 6, str(warned))
    reach = o.eval("[...document.querySelectorAll('#rule-list .rule')].find(r => /^Nudity/.test(r.querySelector('h3').textContent)).querySelector('.reach').textContent")
    check('a picture rule explains its slider in prompts that must say yes', 'prompts' in reach and 'say yes' in reach, reach)
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
    check('the test box asks for a file first', 'Choose a picture' in o.eval("document.getElementById('media-result').textContent"))
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

    # lists win over the model
    env.settings(debug=True, media={'enabled': True, 'votes': 2, 'thumbnails': {'enabled': True, 'hold': True, 'holdSeconds': 40, 'maxPerPage': 60, 'nearViewOnly': False}, 'audio': {'enabled': False}}, lists={'allowVideos': [bad], 'allowChannels': [], 'denyVideos': [good], 'denyChannels': []})
    time.sleep(2.5)
    c_bad, c_good = state_of(bad), state_of(good)
    check('an allowed video is no longer hidden', not c_bad or c_bad['thumb'] is None, json.dumps(c_bad))
    reasons = {x['title']: x['reason'] for x in cmd(p, 'snapshot')['feed']['states']}
    blocked = p.eval(f"""(() => {{ const a = document.querySelector('a[href*="{good}"]'); const c = a && a.closest('[data-vianney-state]'); return c ? c.dataset.vianneyReason : null; }})()""")
    check('a blocked video is hidden by the block list', blocked == 'On your block list', str(blocked))

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
    check('after a reload the verdict comes from the cache and the model is not asked again', c and c['thumb'] == 'hide' and after == before, f'asked before {before}, after {after}, state {json.dumps(c)}')

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
        check('it says that it was the sound, and where', 'sound of this video' in txt and ' to ' in txt, txt)
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
    check('a feed card of a video flagged by sound is hidden next time', bool(hidden) and hidden[0] == 'hide' and hidden[1].startswith('Sound:'), json.dumps(hidden))
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


SCENARIOS = {'smoke': scenario_smoke, 'feed': scenario_feed, 'slider': scenario_slider, 'break': scenario_break,
             'subtitles': scenario_subtitles, 'live-captions': scenario_live_captions, 'falsepos': scenario_falsepos, 'positives': scenario_positives, 'watchmeta': scenario_watchmeta, 'options': scenario_options, 'ai': scenario_ai,
             'media-options': scenario_media_options, 'media-thumbnails': scenario_media_thumbnails, 'media-audio': scenario_media_audio}

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
