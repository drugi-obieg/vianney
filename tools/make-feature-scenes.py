"""Take the pictures of the Features page that show how the extension LOOKS on YouTube when a filter works.

Needs the test browser (tools/e2e-chrome.sh, port 9333), network access to youtube.com, and ImageMagick (`magick`, with WebP).
Run: python3 tools/make-feature-scenes.py [scene ...]        scenes: related comment break break-comment cleanup subtitles media
To try a scene without touching the site, point the output elsewhere:  FEATURES_OUT=<folder> FEATURES_DATA=<file.json> python3 tools/make-feature-scenes.py break break-comment
Writes assets/features/<picture>-light.webp and <picture>-dark.webp, and adds the picture to _data/shots.json (width, height, description).
The pictures: related-dim, comment-blur, break-card, break-comment, cleanup-sidebar, subtitles-mask, media-tiles (the options of the Features page are not pictures: tools/make-feature-options.py copies them as HTML).

Only the result of a filter is ever pictured, never what it filtered (no "before"), so that nothing flagged, blasphemous or indecent is on the site:
a flagged comment is blurred, a flagged caption is masked, a flagged picture is a black tile, the examples that are dimmed are mild.

What is real and what is swapped. The page is the real YouTube (English, signed out) and the extension is the real one, with its real rules: it
judges what is on the page and draws what you see (the dimmed card and its label, the blurred comment and its button, the masked caption, the
break reminder as a video and as a comment, the black tile). Only the CONTENT is replaced, in the page, before the extension looks at it, so that no real person, channel, video
or comment is on a public picture: titles, channel names, comment texts and numbers are our examples; thumbnails and avatars are plain
gradients (CSS `content`, the picture file itself is still the real one, which is what the picture check of the extension downloads).
The words of the examples are mild on purpose: the rules flag them all the same.
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
os.environ.setdefault('CDP_PORT', '9333')
import e2e  # noqa: E402,F401
from e2e import Env, Session, cmd, wait_for, sha_of_thumbnail  # noqa: E402

OUT = os.environ.get('FEATURES_OUT') or os.path.join(ROOT, 'assets', 'features')
DATA = os.environ.get('FEATURES_DATA') or os.path.join(ROOT, '_data', 'shots.json')
SURFACES = {'feed': True, 'related': True, 'comments': True, 'watchMeta': True, 'subtitles': True}

# ---------------------------------------------------------------------------------------------------- what the page is made to show
GRADIENTS_JS = r"""(() => {
  if (window.__neutral) return true;
  window.__neutral = true;
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const hash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  const svg = (hue, w, h) => 'url("data:image/svg+xml,' + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='" + w + "' height='" + h + "'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
    "<stop offset='0' stop-color='hsl(" + hue + "," + (dark ? 26 : 34) + "%," + (dark ? 36 : 72) + "%)'/>" +
    "<stop offset='1' stop-color='hsl(" + ((hue + 38) % 360) + "," + (dark ? 28 : 38) + "%," + (dark ? 22 : 54) + "%)'/></linearGradient></defs>" +
    "<rect width='" + w + "' height='" + h + "' fill='url(#g)'/></svg>") + '")';
  const run = () => {
    for (const img of document.querySelectorAll('img')) {
      const src = img.getAttribute('src') || '';
      if (/ytimg\.com\/(vi|an_)/.test(src)) img.style.setProperty('content', svg(hash(src.split('?')[0]) % 360, 320, 180), 'important');
      else if (/ggpht\.com|googleusercontent\.com|ytimg\.com\/(a|ytc)\//.test(src)) img.style.setProperty('content', svg(hash(src) % 360, 64, 64), 'important');
    }
  };
  run();
  setInterval(run, 350);
  return true;
})()"""

TITLES = ['Gregorian chant for Advent: Rorate caeli', 'How to bake sourdough bread at home', 'A winter walk through the Black Forest',
          'Restoring a 1920s church organ', 'The history of the Roman calendar', 'Vespers at a mountain abbey', 'Making a violin from one block of maple',
          'Sunday lunch for twelve: a slow cooking day']
CHANNELS = ['Abbey Choir', 'Kitchen Table', 'Trail Notes', 'Organ Workshop', 'Calendar Club', 'Mountain Abbey', 'Violin Bench', 'Slow Kitchen']
VIEWS = ['12K views', '84K views', '3.1K views', '420K views', '9.6K views', '51K views', '1.2K views', '230K views']
AGES = ['2w ago', '3y ago', '5d ago', '1y ago', '8mo ago', '4y ago', '2d ago', '6mo ago']

# A card of a list ("ytd-video-renderer": search results; "yt-lockup-view-model": the recommendations of a video page) gets our title.
RETITLE_JS = r"""((sel, ids, i, n, title, channel, views, age) => {
  const idOf = (c) => ((c.querySelector('a[href*="/watch?v="]') || {}).href || '').match(/[?&]v=([\w-]{11})/);
  const top = (c) => c.getBoundingClientRect().top;
  // a plain video: known to the extension as a card, with a duration, and neither a mix, nor live, nor an advertisement
  const plain = (c) => idOf(c) && ids.includes(idOf(c)[1]) && /\d:\d\d/.test(c.textContent) && !/\b\d+ videos\b|\bLIVE\b|\bSTATION\b|\bMix\b|\bPlaylist\b|Sponsored|Gesponsert|Anzeige/i.test(c.textContent);
  const drawn = [...document.querySelectorAll(sel)].filter((c) => c.getBoundingClientRect().height > 0 && top(c) >= 0 && top(c) < innerHeight - 100).sort((a, b) => top(a) - top(b));
  // the first n cards in a row that are all plain: nothing foreign (a real video, a channel, an advertisement) may stand between ours
  let start = -1;
  for (let k = 0; k + n <= drawn.length && start < 0; k++) if (drawn.slice(k, k + n).every(plain) && drawn[k].parentElement === drawn[k + n - 1].parentElement) start = k;
  if (start < 0) return false;
  const card = drawn[start + i];
  const set = (el, t) => { if (el) { el.textContent = t; } };
  const h3 = card.querySelector('h3');
  if (h3) { h3.title = title; const a = h3.querySelector('a'); if (a) { a.setAttribute('aria-label', title); set(a.querySelector('span') || a, title); } }
  const rows = card.querySelectorAll('.ytContentMetadataViewModelMetadataRow');
  if (rows[0]) set(rows[0].querySelector('.ytContentMetadataViewModelMetadataText'), channel);
  if (rows[1]) { const ss = rows[1].querySelectorAll('.ytContentMetadataViewModelMetadataText'); if (ss[0]) set(ss[0], views); if (ss[1]) set(ss[1], age); }
  card.setAttribute('data-scene', String(i));
  return true;
})"""

# true when every sibling between our first and our last card is ours (and they share one list)
CONTIGUOUS_JS = """(() => { const st = [...document.querySelectorAll('[data-scene]')].filter((c) => c.matches('yt-lockup-view-model')); if (!st.length) return false;
  const parent = st[0].parentElement; if (!st.every((c) => c.parentElement === parent)) return false;
  const kids = [...parent.children]; const ix = st.map((c) => kids.indexOf(c)); const lo = Math.min(...ix), hi = Math.max(...ix);
  return kids.slice(lo, hi + 1).every((c) => c.hasAttribute('data-scene')); })()"""

RECOMMENDED = "'#related yt-lockup-view-model'"
RESULTS = "'ytd-video-renderer'"

COMMENT_JS = r"""((i, author, text, age, likes) => {
  const el = [...document.querySelectorAll('ytd-comment-view-model')].filter((c) => c.getBoundingClientRect().height > 0)[i];
  if (!el) return false;
  const set = (node, t) => { if (node) node.textContent = t; };
  const a = el.querySelector('#author-text'); if (a) { const s = a.querySelector('span') || a; set(s, author); }
  const body = el.querySelector('#content-text'); if (body) set(body.querySelector('span') || body, text);
  set(el.querySelector('#published-time-text a, #published-time-text'), age);
  set(el.querySelector('#vote-count-middle'), likes);
  el.querySelectorAll('#more, tp-yt-paper-button#more').forEach((n) => { n.style.display = 'none'; });
  const thread = el.closest('ytd-comment-thread-renderer'); if (thread) thread.querySelectorAll('#replies').forEach((n) => { n.style.display = 'none'; });
  el.setAttribute('data-scene', String(i));
  return true;
})"""


# ---------------------------------------------------------------------------------------------------- the browser
def page(env, url, scheme, width, height, ready, wait=3.0):
    """A page of YouTube in English, signed out, in the given size and colours, with the gradients over the pictures."""
    s = Session().__enter__()
    s.call('Emulation.setDeviceMetricsOverride', {'width': width, 'height': height, 'deviceScaleFactor': 2, 'mobile': False})
    s.call('Emulation.setLocaleOverride', {'locale': 'en-US'})
    s.call('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-color-scheme', 'value': scheme}]})
    s.call('Network.enable')
    for name, value in (('PREF', 'hl=en&gl=US' + ('&f6=400' if scheme == 'dark' else '')), ('SOCS', 'CAI')):
        s.call('Network.setCookie', {'name': name, 'value': value, 'domain': '.youtube.com', 'path': '/'})
    s.goto(url, wait=2.0)
    wait_for(s, ready, 25)
    s.click_text([r'^(Alle ablehnen|Reject all)'])
    time.sleep(wait)
    s.eval(GRADIENTS_JS)
    return s


def clip_png(s, rect, tmp, name):
    """A screenshot of rect {x, y, w, h} (page pixels: where it is on the page, scroll included) at twice the size. The rectangle must be in the part
    of the page that is on the screen, and the page is not resized for it (captureBeyondViewport would make YouTube draw its lists again,
    and the swapped content would be gone)."""
    data = s.call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False,
                                             'clip': {'x': rect['x'], 'y': rect['y'], 'width': rect['w'], 'height': rect['h'], 'scale': 1}})['data']
    path = os.path.join(tmp, name + '.png')
    open(path, 'wb').write(base64.b64decode(data))
    return path


def union_js(selectors, pad=0):
    """JavaScript for the rectangle (page pixels) around the elements that these selector lists find."""
    return f"""(() => {{
      const els = ({selectors}).filter(Boolean);
      if (!els.length) return null;
      const rs = els.map((e) => e.getBoundingClientRect());
      const left = Math.min(...rs.map((r) => r.left)) - {pad}, top = Math.min(...rs.map((r) => r.top)) - {pad};
      const right = Math.max(...rs.map((r) => r.right)) + {pad}, bottom = Math.max(...rs.map((r) => r.bottom)) + {pad};
      return {{x: left + scrollX, y: top + scrollY, w: right - left, h: bottom - top}};
    }})()"""


def save(png, name, scheme, alt, shots):
    webp = os.path.join(OUT, f'{name}-{scheme}.webp')
    subprocess.run(['magick', png, '-quality', '88', '-define', 'webp:method=6', webp], check=True)
    size = subprocess.run(['magick', 'identify', '-format', '%w %h', png], capture_output=True, text=True, check=True).stdout.split()
    dims = {'width': round(int(size[0]) / 2), 'height': round(int(size[1]) / 2)}
    if scheme == 'light':
        shots[name] = {**dims, 'alt': alt}
    else:                                   # the page reserves the room of the dark picture too (it can differ: the lists are not the same twice)
        shots[name]['alt'] = alt
        shots[name].pop('dark', None)
        if dims != {'width': shots[name]['width'], 'height': shots[name]['height']}:
            shots[name]['dark'] = dims
    print(f'{name}-{scheme}: {dims["width"]} x {dims["height"]} px, {os.path.getsize(webp):,} bytes')


def staged_state(s, sel='[data-scene]'):
    return s.eval(f"[...document.querySelectorAll('{sel}')].map((e) => ({{i: e.dataset.scene, state: e.dataset.vianneyState || null, reason: e.dataset.vianneyReason || null}}))")


# ---------------------------------------------------------------------------------------------------- the scenes
def scene_comment(env, scheme, tmp, shots):
    """Three comments under a video; the one that takes God's name in vain is blurred, with its reason and a Show button."""
    env.reset()
    env.settings(debug=True, surfaces=dict(SURFACES), subtitles={'autoCaptions': False})
    s = page(env, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', scheme, 1280, 1000, "!!document.querySelector('video') && !!document.querySelector('#related yt-lockup-view-model')")
    s.eval("window.scrollTo(0, 900)"); time.sleep(2.5); s.eval("window.scrollTo(0, 1500)")
    wait_for(s, "document.querySelectorAll('ytd-comment-view-model').length >= 4", 25)
    texts = [('@abbeyfan', 'Beautiful singing, thank you for this.', '2 years ago', '48'),
             ('@viennaviewer', 'OMG this is insane, I can’t even', '3 weeks ago', '12'),
             ('@chantlover', 'Which hymn is this? I would like to learn it.', '1 year ago', '7')]
    for i, t in enumerate(texts):
        s.eval(f"({COMMENT_JS})({i}, {json.dumps(t[0])}, {json.dumps(t[1])}, {json.dumps(t[2])}, {json.dumps(t[3])})")
    wait_for(s, "[...document.querySelectorAll('[data-scene]')].some((e) => e.dataset.vianneyState === 'blur')", 10)
    time.sleep(0.8)
    s.eval("document.querySelector('[data-scene=\"0\"]').scrollIntoView({block: 'start'}); window.scrollBy(0, -70)")
    time.sleep(1.5)
    state = staged_state(s)
    rect = s.eval(union_js("[document.querySelector('[data-scene=\"0\"]'), document.querySelector('[data-scene=\"2\"]')]", 14))
    if not rect or not any(x['state'] == 'blur' for x in state):
        raise SystemExit(f'the comment scene did not come out: {state} {rect}')
    rect['w'] = min(rect['w'], 360)      # the avatar, the blurred text and its badge: a half of the Features page holds no more
    png = clip_png(s, rect, tmp, f'comment-{scheme}')
    s.__exit__(None, None, None)
    save(png, 'comment-blur', scheme, 'Three comments under a video. The second, which takes the name of God as an exclamation, is blurred, with the reason and a Show button over it.', shots)


def scene_related(env, scheme, tmp, shots):
    """The recommended videos next to a video: the flagged ones are dimmed and labelled with the rule (one action is chosen for the picture)."""
    env.reset()
    env.settings(debug=True, surfaces=dict(SURFACES), subtitles={'autoCaptions': False}, ruleEnabled={'divination': True},
                 actions={'occult': {'related': 'dim'}, 'divination': {'related': 'dim'}})
    s = page(env, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', scheme, 1280, 1500, "!!document.querySelector('video') && !!document.querySelector('#related yt-lockup-view-model')", wait=5.0)
    titles = list(TITLES)
    titles[1] = 'Witchcraft for beginners: love spells and a full moon ritual'      # what is dimmed is mild on purpose: topics, no blasphemy and no indecency. The word lists alone flag it, and one rule only (with two, the stronger action wins)
    titles[3] = 'Tarot reading for your week: pick a card'
    s.eval("window.scrollTo(0, 0)")
    n = 4

    def stage():
        ids = cmd(s, 'snapshot')['feed']['ids']
        for i in range(n):
            s.eval(f"({RETITLE_JS})({RECOMMENDED}, {json.dumps(ids)}, {i}, {n}, {json.dumps(titles[i])}, {json.dumps(CHANNELS[i])}, {json.dumps(VIEWS[i])}, {json.dumps(AGES[i])})")

    def ready():
        r = s.eval(f"""(() => {{ const cards = [...document.querySelectorAll('[data-scene]')]; const titles = {json.dumps(titles[:n])};
          const each = cards.map((c) => {{ const img = c.querySelector('img'); return {{i: c.dataset.scene, title: c.querySelector('h3').textContent.trim() === titles[+c.dataset.scene], loaded: img.complete, gradient: /svg/.test(img.getAttribute('style') || ''), src: (img.getAttribute('src') || '').slice(0, 30), style: (img.getAttribute('style') || '').slice(0, 40), n: c.querySelectorAll('img').length, top: Math.round(c.getBoundingClientRect().top), left: Math.round(c.getBoundingClientRect().left), vis: getComputedStyle(c).visibility, parent: c.parentElement.tagName.toLowerCase(), state: c.dataset.vianneyState || null}}; }});
          return {{n: cards.length, each, ok: cards.length >= {n} && each.every((e) => e.title && e.loaded && e.gradient) && each.filter((e) => e.state === 'dim').length >= 2}}; }})()""")
        r['contiguous'] = s.eval(CONTIGUOUS_JS)
        r['ok'] = r['ok'] and r['contiguous']
        ready.last = r
        return r['ok']

    end = time.time() + 40
    while time.time() < end and not ready():
        stage()
        time.sleep(1.2)
    if not ready():
        open(os.path.join(tempfile.gettempdir(), 'scene-related-failed.png'), 'wb').write(base64.b64decode(s.call('Page.captureScreenshot', {'format': 'png'})['data']))
        raise SystemExit(f'the related scene did not come out: {ready.last} (a picture of the page: {tempfile.gettempdir()}/scene-related-failed.png)')
    rect = s.eval(union_js("[document.querySelector('[data-scene=\"0\"]'), document.querySelector('[data-scene=\"3\"]')]", 3))
    png = clip_png(s, rect, tmp, f'related-{scheme}')
    s.__exit__(None, None, None)
    save(png, 'related-dim', scheme, 'The list of recommended videos next to a video. Two are dimmed and labelled with the rule that flagged them: "Occult and New Age" and "Fortune telling".', shots)



def scene_break(env, scheme, tmp, shots):
    """The break reminder as a video: the second of the recommended videos next to a video, between real ones. It is the real extension that puts it in (the place
    and the words are chosen through the debug hook, so that the picture is the same every time); only the portrait of Vianney tells it from the others."""
    env.reset()
    env.settings(debug=True, surfaces=dict(SURFACES), subtitles={'autoCaptions': False}, brk={'afterMinutes': 1, 'snoozeMinutes': 15})
    s = page(env, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', scheme, 1280, 1500, "!!document.querySelector('video') && !!document.querySelector('#related yt-lockup-view-model')", wait=5.0)
    s.eval("window.scrollTo(0, 0)")
    titles = list(TITLES)
    n = 3                                                                          # three real videos of ours: the reminder stands between the first and the second
    end = time.time() + 40
    ok = False
    while time.time() < end and not ok:                                            # 1. our three videos (the first three plain ones of the list, with our words and our gradients)
        ids = cmd(s, 'snapshot')['feed']['ids']
        for i in range(n):
            s.eval(f"({RETITLE_JS})({RECOMMENDED}, {json.dumps(ids)}, {i}, {n}, {json.dumps(titles[i])}, {json.dumps(CHANNELS[i])}, {json.dumps(VIEWS[i])}, {json.dumps(AGES[i])})")
        time.sleep(1.2)
        ok = s.eval(f"""(() => {{ const cards = [...document.querySelectorAll('[data-scene]')]; const titles = {json.dumps(titles[:n])};
          return cards.length >= {n} && cards.every((c) => c.querySelector('h3').textContent.trim() === titles[+c.dataset.scene] && c.querySelector('img').complete && /svg/.test(c.querySelector('img').getAttribute('style') || '')); }})()""") and s.eval(CONTIGUOUS_JS)
    if not ok:
        raise SystemExit('the break scene did not settle: our three videos are not staged')
    # 2. the reminder. The extension counts its own list of plain videos (a live stream or a mix is not in it), so the place that is "the second" is found by trying them in turn:
    #    the first index at which the reminder lands between our first and our second video. The first title ("You wouldn't BELIEVE ...") and the first caption ("BREAK?!") are asked for.
    env.storage_set(breakState={'periodKey': 'session', 'accumSeconds': 4000, 'lastPlayMs': int(time.time() * 1000), 'nextDueSeconds': 60})
    wait_for(s, "document.documentElement.hasAttribute('data-vianney-armed')", 5)
    between = """(() => { const b = document.querySelector('[data-vianney-ui="break-video"]'); const at = (i) => document.querySelector('[data-scene="' + i + '"]');
      return !!b && b.previousElementSibling === at(0) && b.nextElementSibling === at(1) && at(1).nextElementSibling === at(2); })()"""
    placed = False
    for index in range(1, 8):
        cmd(s, 'break', {'kind': 'video', 'index': index, 'title': 0, 'caption': 0})
        if s.eval(between):
            placed = True
            break
    if not placed:
        raise SystemExit('the break scene did not settle (the reminder cannot be put between our first and second video)')
    # the reminder has read the sizes of its neighbours; let it do so again now that they carry our words, and let the picture settle
    time.sleep(3.4)
    shown = s.eval("""(() => { const b = document.querySelector('[data-vianney-ui="break-video"]'); const r = b.shadowRoot; return {title: r.querySelector('.title').textContent, stats: r.querySelector('.stats').textContent, imgs: [...r.querySelectorAll('img')].every((i) => i.complete && i.naturalWidth > 0)}; })()""")
    if not shown['imgs'] or shown['title'] != "You wouldn't BELIEVE what happens if you take a BREAK NOW!" or not s.eval(between):
        raise SystemExit(f'the break video is not as expected: {shown}')
    s.call('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': 3, 'y': 3})       # no hover over anything
    time.sleep(0.5)
    rect = s.eval(union_js("[document.querySelector('[data-scene=\"0\"]'), document.querySelector('[data-scene=\"2\"]')]", 3))
    png = clip_png(s, rect, tmp, f'break-{scheme}')
    s.__exit__(None, None, None)
    save(png, 'break-card', scheme, 'The list of recommended videos next to a video. The second one is the break reminder, drawn as a video: the portrait of Saint Jean-Marie Vianney as picture and channel, a clickbait title that makes fun of clickbait, and "Watching for 1 hour 7 minutes" where the views would be.', shots)


def scene_break_comment(env, scheme, tmp, shots):
    """The break reminder as a comment: between two real comments under a video. The portrait is the only tell. Both real comments are our own examples (clean ones).
    The window is narrow (520 pixels), so that the comments are as wide as the picture of the Features page can show them and the whole sentence of the reminder fits."""
    env.reset()
    env.settings(debug=True, surfaces=dict(SURFACES), subtitles={'autoCaptions': False}, brk={'afterMinutes': 1, 'snoozeMinutes': 15})
    s = page(env, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', scheme, 520, 1000, "!!document.querySelector('video') && !!document.querySelector('ytd-comments')")   # 520: YouTube keeps its desktop layout down to about 500 pixels, and the comments are then 488 pixels wide
    end = time.time() + 30
    while time.time() < end and s.eval("document.querySelectorAll('ytd-comment-thread-renderer').length") < 5:      # the comments load when they come near the screen
        s.eval("(document.querySelector('ytd-comments') || document.body).scrollIntoView()")
        time.sleep(2.0)
        s.eval("window.scrollBy(0, 400)")
        time.sleep(1.5)
    if s.eval("document.querySelectorAll('ytd-comment-thread-renderer').length") < 5:
        raise SystemExit('the comments did not load')
    # the comments are as wide as a half of the Features page can show them without shrinking (360 px): the text wraps there, as it does in a narrow column
    s.eval("""(() => { const css = document.createElement('style'); css.textContent = 'ytd-comments#comments, ytd-comments { display: block !important; width: 332px !important; max-width: 332px !important; }'; document.head.append(css); })()""")
    time.sleep(1.0)
    env.storage_set(breakState={'periodKey': 'session', 'accumSeconds': 4000, 'lastPlayMs': int(time.time() * 1000), 'nextDueSeconds': 60})
    wait_for(s, "document.documentElement.hasAttribute('data-vianney-armed')", 5)
    cmd(s, 'break', {'kind': 'comment', 'index': 1})                              # before the second comment
    if not wait_for(s, "!!document.querySelector('[data-vianney-ui=\"break-comment\"]')", 15):
        raise SystemExit('no break comment')
    texts = [('@abbeyfan', 'Beautiful singing, thank you for sharing this with us.', '2 years ago', '48'),
             ('@chantlover', 'Which hymn is this? I would like to learn it.', '1 year ago', '7')]
    for i, t in enumerate(texts):
        s.eval(f"({COMMENT_JS})({i}, {json.dumps(t[0])}, {json.dumps(t[1])}, {json.dumps(t[2])}, {json.dumps(t[3])})")
    time.sleep(1.0)
    joined = s.eval("""(() => { const b = document.querySelector('[data-vianney-ui="break-comment"]'); const at = (i) => document.querySelector('[data-scene="' + i + '"]'); if (!b || !at(0) || !at(1)) return false;
      const t0 = at(0).closest('ytd-comment-thread-renderer'), t1 = at(1).closest('ytd-comment-thread-renderer'); return b.previousElementSibling === t0 && b.nextElementSibling === t1; })()""")
    if not joined:
        raise SystemExit('the break comment is not between our two comments')
    s.eval("document.querySelector('[data-scene=\"0\"]').scrollIntoView({block: 'start'}); window.scrollBy(0, -70)")
    time.sleep(2.2)                                                                 # the comment has read the sizes of its neighbours again
    shown = s.eval("""(() => { const r = document.querySelector('[data-vianney-ui="break-comment"]').shadowRoot; return {text: r.querySelector('.text').textContent, imgs: [...r.querySelectorAll('img')].every((i) => i.complete && i.naturalWidth > 0)}; })()""")
    if not shown['imgs'] or not shown['text'].startswith("You've been watching for 1 hour 7 minutes."):
        raise SystemExit(f'the break comment is not as expected: {shown}')
    s.call('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': 3, 'y': 3})
    time.sleep(0.4)
    rect = s.eval(union_js("[document.querySelector('[data-scene=\"0\"]').closest('ytd-comment-thread-renderer'), document.querySelector('[data-scene=\"1\"]').closest('ytd-comment-thread-renderer')]", 14))
    png = clip_png(s, rect, tmp, f'break-comment-{scheme}')
    s.__exit__(None, None, None)
    save(png, 'break-comment', scheme, 'Under a video, between two comments, a comment from "Vianney" with his portrait as the picture: how long you have been watching, and that this is a good moment to take a break.', shots)


def scene_subtitles(env, scheme, tmp, shots):
    """The caption on the video: the flagged words are masked. A caption is put into the player the way YouTube draws it, and the extension masks it."""
    env.reset()
    env.settings(debug=True, surfaces=dict(SURFACES), subtitles={'autoCaptions': False, 'maskVisible': True})
    s = page(env, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', scheme, 1000, 800, "!!document.querySelector('video') && !!document.querySelector('#movie_player')", wait=4.0)
    s.eval("""(() => { const v = document.querySelector('video'); v.pause(); v.muted = true;
      const css = document.createElement('style'); css.textContent = '#movie_player { background: #000 !important; } #movie_player video { visibility: hidden !important; } #movie_player .html5-video-container { background: linear-gradient(135deg, #3b4b5c, #151b22) !important; } #movie_player .ytp-chrome-top, #movie_player .ytp-gradient-top, #movie_player .ytp-watermark, #movie_player .ytp-title, #movie_player .ytp-ce-element, #movie_player .ytp-cards-teaser, #movie_player .ytp-pause-overlay, #movie_player .annotation, #movie_player .iv-branding, #movie_player .ytp-endscreen-content, #movie_player .ytp-videowall-still { display: none !important; }';
      document.head.append(css); })()""")
    caption = "OMG this is insane, I can’t even"
    injected = s.eval("""((text) => { const player = document.querySelector('#movie_player');
      const el = (tag, cls, css) => { const e = document.createElement(tag); if (cls) e.className = cls; if (css) e.style.cssText = css; return e; };
      const wrap = el('div', 'ytp-caption-window-container'); wrap.id = 'staged-captions';
      const win = el('div', 'caption-window ytp-caption-window-bottom', 'text-align:center;overflow:hidden;width:70%;left:15%;bottom:14%;position:absolute;');
      const box = el('span', 'captions-text', 'display:block;');
      const seg = el('span', 'ytp-caption-segment', 'display:inline-block;white-space:pre-wrap;background:rgba(8,8,8,.75);font-size:19px;color:#fff;font-family:Roboto,Arial,sans-serif;padding:2px 7px;');
      seg.textContent = text; box.append(seg); win.append(box); wrap.append(win); player.appendChild(wrap);
      return !!document.querySelector('#staged-captions .ytp-caption-segment'); })""" + f"({json.dumps(caption)})")
    done = wait_for(s, "(() => { const e = document.querySelector('#staged-captions .ytp-caption-segment'); return e && e.textContent.includes('▮') ? e.textContent : ''; })()", 10)
    if not done:
        raise SystemExit('the caption was not masked: ' + str([injected, s.eval("(() => { const e = document.querySelector('#staged-captions .ytp-caption-segment'); return e ? e.textContent : 'no caption node'; })()")]))
    print('   caption now:', done)
    box = s.eval(union_js("[document.querySelector('#movie_player')]", 0))
    s.call('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': box['x'] + box['w'] / 2, 'y': box['y'] + box['h'] / 2})   # the controls show while the pointer is over the player
    time.sleep(0.6)
    s.call('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': box['x'] + box['w'] / 2 + 5, 'y': box['y'] + box['h'] / 2 + 5})
    time.sleep(0.4)
    rect = s.eval(union_js("[document.querySelector('#movie_player')]", 0))
    rect['x'] = rect['x'] + (rect['w'] - 360) / 2      # the middle 360 px of the player: the caption and the controls under it
    rect['w'] = 360
    rect['y'] = rect['y'] + rect['h'] - 190
    rect['h'] = 190
    png = clip_png(s, rect, tmp, f'subtitles-{scheme}')
    s.__exit__(None, None, None)
    save(png, 'subtitles-mask', scheme, 'The bottom of a video with its caption. The words that a rule flagged are masked with blocks.', shots)


def scene_media(env, scheme, tmp, shots):
    """Pictures (experimental): the model judges a thumbnail and the card keeps its title. A black tile, and a blurred picture, each with the rule and a Show
    button. Chrome's model is replaced by the stand-in of the tests, which says yes to two chosen pictures (what the real model would answer is not shown)."""
    env.reset()
    env.install_fake()
    env.settings(debug=True, surfaces=dict(SURFACES), subtitles={'autoCaptions': False}, media={'enabled': False},
                 actions={'explicit_images': {'thumbnail': 'blackout'}, 'immodest_images': {'thumbnail': 'blur'}})
    s = page(env, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', scheme, 1280, 1500, "!!document.querySelector('video') && !!document.querySelector('#related yt-lockup-view-model')", wait=5.0)
    s.eval("window.scrollTo(0, 0)")
    titles = list(TITLES)
    n = 4

    def stage():
        ids = cmd(s, 'snapshot')['feed']['ids']
        for i in range(n):
            s.eval(f"({RETITLE_JS})({RECOMMENDED}, {json.dumps(ids)}, {i}, {n}, {json.dumps(titles[i])}, {json.dumps(CHANNELS[i])}, {json.dumps(VIEWS[i])}, {json.dumps(AGES[i])})")

    # 1. our four cards, in a row; their video ids are what the stand-in model is told to say yes to (the second and the fourth)
    staged = []
    end = time.time() + 40
    while time.time() < end and len(staged) < n:
        stage()
        time.sleep(1.0)
        staged = s.eval("""[...document.querySelectorAll('[data-scene]')].sort((a, b) => +a.dataset.scene - +b.dataset.scene).map((c) => ((c.querySelector('a[href*="/watch?v="]') || {}).href || '').match(/[?&]v=([\\w-]{11})/)[1])""")
        if len(staged) == n and not s.eval(CONTIGUOUS_JS):
            staged = []
    if len(staged) < n:
        raise SystemExit(f'the four cards were not staged: {staged}')
    black, blur = staged[1], staged[3]
    env.fake(f"__fake.imageYes = [{{hash: {json.dumps(sha_of_thumbnail(env, black))}, q: 'naked person'}}, {{hash: {json.dumps(sha_of_thumbnail(env, blur))}, q: 'underwear'}}]")
    env.settings(debug=True, media={'enabled': True, 'votes': 2, 'thumbnails': {'enabled': True, 'hold': True, 'holdSeconds': 40, 'maxPerPage': 60, 'nearViewOnly': False}, 'audio': {'enabled': False}})

    # 2. the extension judges the pictures; the cards are kept as they are
    end = time.time() + 70
    ok = False
    while time.time() < end and not ok:
        stage()
        time.sleep(1.5)
        ok = s.eval(CONTIGUOUS_JS) and s.eval("""(() => { const cards = [...document.querySelectorAll('[data-scene]')]; if (cards.length < 4) return false;
          const states = cards.map((c) => [c.dataset.scene, (c.querySelector('[data-vianney-thumb]') || c).dataset.vianneyThumb || null]);
          return states.some(([i, t]) => t === 'blackout') && states.some(([i, t]) => t === 'blur'); })()""")
    state = s.eval("[...document.querySelectorAll('[data-scene]')].map((c) => [c.dataset.scene, (c.querySelector('[data-vianney-thumb]') || c).dataset.vianneyThumb || null, !!c.querySelector('.vianney-thumb-badge')])")
    if not ok:
        raise SystemExit(f'the pictures were not judged: {state} (blackout {black}, blur {blur})')
    print('   pictures:', state)
    time.sleep(0.8)
    rect = s.eval(union_js("[document.querySelector('[data-scene=\"0\"]'), document.querySelector('[data-scene=\"3\"]')]", 3))
    png = clip_png(s, rect, tmp, f'media-{scheme}')
    s.__exit__(None, None, None)
    save(png, 'media-tiles', scheme, 'Recommended videos in which the picture was judged. One is a black tile and one is blurred, each with the rule that flagged it and a Show button. The titles stay.', shots)


def scene_cleanup(env, scheme, tmp, shots):
    """The sidebar of YouTube with Clean up on: no Shorts, no Explore, no More from YouTube. Only this result is pictured, never the sidebar as it was."""
    env.reset()
    env.settings(debug=True)
    s = page(env, 'https://www.youtube.com/?hl=en&gl=US', scheme, 1440, 1100, "!!document.querySelector('ytd-guide-renderer') && document.querySelectorAll('ytd-guide-entry-renderer').length > 3", wait=5.0)
    s.eval("""(() => { const b = [...document.querySelectorAll('ytd-guide-entry-renderer')].find((e) => /Show more/.test(e.textContent)); if (b) (b.querySelector('a, #endpoint, tp-yt-paper-item') || b).click(); })()""")
    time.sleep(1.5)
    gone = s.eval("""(() => { const t = [...document.querySelectorAll('ytd-guide-entry-renderer')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.textContent.replace(/\\s+/g, ' ').trim());
      return {shown: t, wrong: t.filter((x) => /^(Shorts|Gaming|Playables|Podcasts|Movies|YouTube Premium|YouTube Music|YouTube Kids)/.test(x))}; })()""")
    if gone['wrong']:
        raise SystemExit(f'Clean up did not remove: {gone["wrong"]}')
    rect = s.eval(union_js("[document.querySelector('ytd-guide-renderer #sections')]", 0))
    rect['x'] = 0
    rect['w'] = 240
    rect['h'] = min(rect['h'], 470)
    png = clip_png(s, rect, tmp, f'cleanup-{scheme}')
    s.__exit__(None, None, None)
    save(png, 'cleanup-sidebar', scheme, 'The sidebar of YouTube with Clean up on: Home, Subscriptions, You and History. Shorts, the Explore section and More from YouTube are gone.', shots)


SCENES = {'comment': scene_comment, 'related': scene_related, 'break': scene_break, 'break-comment': scene_break_comment, 'cleanup': scene_cleanup, 'subtitles': scene_subtitles, 'media': scene_media}


def main():
    wanted = sys.argv[1:] or list(SCENES)
    os.makedirs(OUT, exist_ok=True)
    shots = json.load(open(DATA)) if os.path.exists(DATA) else {}
    env = Env()
    try:
        with tempfile.TemporaryDirectory() as tmp:
            for name in wanted:
                for scheme in ('light', 'dark'):
                    for attempt in (1, 2, 3):          # YouTube draws another list now and then: a scene that does not settle is tried again on a fresh page
                        try:
                            SCENES[name](env, scheme, tmp, shots)
                            break
                        except SystemExit as e:
                            print(f'   {name} {scheme}, attempt {attempt}: {e}')
                            if attempt == 3:
                                raise
    finally:
        env.close()
    json.dump(dict(sorted(shots.items())), open(DATA, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
    open(DATA, 'a').write('\n')
    print('wrote', DATA)


if __name__ == '__main__':
    main()
