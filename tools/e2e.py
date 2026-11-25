"""End-to-end test: the unpacked extension in a throwaway headless Chrome, against real YouTube pages.

Usage:
  1. start Chrome with:  --headless=new --remote-debugging-port=9333 --enable-unsafe-extension-debugging
                         --user-data-dir=<empty dir>   (see tools/e2e-chrome.sh)
  2. python3 tools/e2e.py [scenario ...]        scenarios: smoke feed slider break subtitles options ai live-captions (not run by default)

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
EXT_DIR = os.path.abspath(os.path.join(HERE, '..', 'extension'))
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


class Env:
    def __init__(self):
        self.ext = load_extension()
        self.ctrl = Session().__enter__()
        self.ctrl.goto(f'chrome-extension://{self.ext}/src/options/options.html', wait=1.5)

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


def scenario_slider(env):
    print('\n== slider: sensitivity changes the outcome without reloading')
    env.reset()
    p = env.open_page('https://www.youtube.com/results?search_query=omg+oh+my+god+reaction', SEARCH_READY)
    before = hidden_count(p)
    check('at the default level some cards are hidden', before >= 1, str(before))
    env.settings(sensitivity={'lords_name': 0.99})
    strict = hidden_count(p)
    check('a very strict setting (99%) un-hides the 95%-weight matches', strict < before, f'{before} -> {strict}')
    env.settings(sensitivity={'lords_name': 0.10})
    lenient = hidden_count(p)
    check('a lenient setting (10%) flags at least as many as the default', lenient >= before, f'{before} -> {lenient}')
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


SCENARIOS = {'smoke': scenario_smoke, 'feed': scenario_feed, 'slider': scenario_slider, 'break': scenario_break,
             'subtitles': scenario_subtitles, 'live-captions': scenario_live_captions, 'options': scenario_options, 'ai': scenario_ai}

if __name__ == '__main__':
    wanted = sys.argv[1:] or [n for n in SCENARIOS if n != 'live-captions']
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
