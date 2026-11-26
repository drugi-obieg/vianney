"""Take the option blocks of the Features page of the website from the real settings page of the extension, as HTML.

Needs the test browser (tools/e2e-chrome.sh, port 9333). Run: python3 tools/make-feature-options.py [name ...]
Writes _data/options.json: for each block a description (the page gives it to screen readers) and its HTML. The HTML is the markup of the groups of the settings
page as the page itself has built it, with the state the page shows (switches on or off, the numbers, the entry a popup shows), and cleaned of what only works inside
the extension: ids, popovers, "?" buttons, handlers. It is real text, not a picture, so it stays the size of the text of the page at any width, can be searched,
and follows light and dark by itself. Its CSS comes from the settings page too: tools/make-options-css.mjs writes assets/options-view.css from options.css.
Nothing is made up: the rows, their names and their switches are what the extension shows with its shipped settings.
"""
import json
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
os.environ.setdefault('CDP_PORT', '9333')
import e2e  # noqa: E402  (the harness: Env, Session)
from e2e import Env, Session  # noqa: E402

DATA = os.path.join(ROOT, '_data', 'options.json')


def group(title):
    """JavaScript for the group of rules that has this heading in the list of rules (found by its title: the order of the groups can change)."""
    return f"document.querySelectorAll('#rule-list .rule-group')[0] && [...document.querySelectorAll('#rule-list .rule-group')].find((g) => g.querySelector('.group-title').textContent.trim() === {json.dumps(title)})"


# name, route in the settings page, JavaScript that returns the elements to take (their markup, one after the other, is the block), and, if there is one,
# JavaScript that prepares the page first (the Test rules page is filled in and run)
TARGETS = [
    ('scope', '#subtitles', "[document.querySelector('#subtitles .group')]"),
    ('belief', '#rules', f"[{group('Unbelief and other religions')}]"),
    ('anticatholic', '#rules', f"[{group('Anti-Catholicism')}]"),
    ('swearing', '#rules', f"[{group('Swearing and cursing')}]"),
    ('people', '#rules', f"[{group('Talk about other people')}]"),
    ('purity', '#rules', f"[{group('Lewdness and immodesty')}]"),
    ('leisure', '#rules', f"[{group('Games, shows and excess')}]"),
    ('sensitivity', '#rules/coarse_words', "[...document.querySelectorAll('#rule-detail .group-title')].slice(1, 3).concat([...document.querySelectorAll('#rule-detail > .group')].slice(1, 3))"),
    ('subtitles', '#subtitles', "[...document.querySelectorAll('#subtitles .group, #subtitles .group-title')].slice(1)"),
    ('cleanup', '#cleanup', "[...document.querySelectorAll('#cleanup .group, #cleanup .group-title')]"),
    ('break', '#break', "[...document.querySelectorAll('#break .group')]"),
    ('media', '#rules', f"[{group('Images (experimental)')}, {group('Audio (experimental)')}]"),
    # the first row of the pane only ("Use on-device AI"): the rows under it (which models, availability) are for the settings page, and the model rows are the next block
    ('private', '#ai', "[(() => { const g = document.querySelector('#ai .group').cloneNode(true); [...g.children].slice(1).forEach((r) => r.remove()); return g; })()]"),
    # the model rows of the On-device AI pane, as a computer shows them that has not downloaded a model yet: the page asks Chrome's Prompt API, so a stand-in that says
    # "downloadable" for text (and "unavailable" for pictures and sound, which are not the point here) is put in the page before the check is run. The Kev row says
    # "Not downloaded" by itself in a fresh profile. Only the rows that name a model for the rules' questions are taken.
    ('models', '#ai', "[...document.querySelectorAll('#ai-models article.model')].filter((a) => ['kev', 'text'].includes(a.dataset.model))",
     """(() => { globalThis.LanguageModel = { availability: async (o) => { const t = ((o && o.expectedInputs) || []).map((i) => i.type); return t.includes('audio') || t.includes('image') ? 'unavailable' : 'downloadable'; } }; document.getElementById('ai-check').click(); })()"""),
    ('test-result', '#test', "[document.querySelector('#test .row-bar'), document.getElementById('test-text'), document.getElementById('test-result')]",
     """(() => { document.getElementById('test-surface').value = 'feed-card'; const t = document.getElementById('test-text'); t.rows = 2; t.value = 'Witchcraft for beginners: love spells and a full moon ritual'; document.getElementById('test-run').click(); })()"""),
]

# Runs in the settings page. The markup of each element as a clone, with the state of the controls written into it (a clone carries attributes, not the
# state a control is in), the parts that only work inside the extension taken out, and every control made unreachable (it is a picture of the settings made
# of text, not the settings): no tab stop here, no clicks in the CSS.
TAKE_JS = """((finder) => {
  const els = finder.filter(Boolean).sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));   // the order of the page, whatever the order of the finder
  if (!els.length) return null;
  const DROP_ATTR = /^(id|for|name|role|title|tabindex|popover|popovertarget|autocomplete|spellcheck|data-.*|aria-.*|on.*)$/i;
  // the words of the markup in the order of the page, apart: what a screen reader is told, without the effects of the CSS (capital letters) or the parts taken out
  const textOf = (n) => { const out = []; const walk = (x) => { if (x.nodeType === 3) { const t = x.textContent.replace(/\\s+/g, ' ').trim(); if (t) out.push(t); } else for (const k of x.childNodes) walk(k); }; walk(n); return out.join(' '); };
  const clean = (src) => {
    const c = src.cloneNode(true);
    const controls = (root) => [root, ...root.querySelectorAll('input, select, textarea')].filter((n) => n.matches('input, select, textarea'));   // the element itself may be one
    const live = controls(src);
    const copy = controls(c);
    live.forEach((a, i) => {
      const b = copy[i];
      if (a.tagName === 'SELECT') [...b.options].forEach((o, j) => { if (a.options[j].selected) o.setAttribute('selected', ''); else o.remove(); });
      else if (a.tagName === 'TEXTAREA') b.textContent = a.value;
      else if (a.type === 'checkbox') b.toggleAttribute('checked', a.checked);
      else b.setAttribute('value', a.value);
    });
    for (const n of [...c.querySelectorAll('.help-wrap, .pill, .chev, .eg, [hidden]')]) n.remove();      // .eg: the examples line of a rule, which the list does not show
    for (const n of [c, ...c.querySelectorAll('*')]) for (const a of [...n.attributes]) if (DROP_ATTR.test(a.name)) n.removeAttribute(a.name);
    for (const n of [c, ...c.querySelectorAll('input, select, textarea, button')]) if (n.matches('input, select, textarea, button')) n.setAttribute('tabindex', '-1');
    return {html: c.outerHTML, text: textOf(c)};
  };
  const parts = els.map(clean);
  return {html: parts.map((p) => p.html).join(''), text: parts.map((p) => p.text).join(' ')};
})"""


def main():
    only = set(sys.argv[1:])
    env = Env()
    env.reset()
    env.settings(debug=False)
    out = json.load(open(DATA, encoding='utf-8')) if os.path.exists(DATA) else {}
    o = Session().__enter__()
    o.call('Emulation.setDeviceMetricsOverride', {'width': 1100, 'height': 1400, 'deviceScaleFactor': 1, 'mobile': False})
    o.call('Emulation.setLocaleOverride', {'locale': 'en-US'})      # numbers as 0.12, not as 0,12
    o.goto(f'chrome-extension://{env.ext}/src/options/options.html', wait=2.0)
    for name, route, finder, *rest in TARGETS:
        if only and name not in only:
            continue
        o.eval(f"location.hash = {json.dumps(route)}")
        time.sleep(0.9)
        if rest:
            o.eval(rest[0])
            time.sleep(1.6)
        info = o.eval(f"({TAKE_JS})({finder})")
        if not info:
            raise SystemExit(f'nothing to take for {name} ({route})')
        html = re.sub(r'>\s+<', '><', info['html']).strip()
        out[name] = {'alt': info['text'][:300], 'html': html}
        print(f'{name}: {len(html):,} characters of HTML')
    o.__exit__(None, None, None)
    env.close()
    json.dump(dict(sorted(out.items())), open(DATA, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
    open(DATA, 'a').write('\n')
    print('wrote', DATA)


if __name__ == '__main__':
    main()
