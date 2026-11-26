"""Write one Markdown file with the UI code of the project: what to paste into another model for a critique of the wording and the design.

Run: python3 tools/dump-ui.py [ui|site] [output]
  ui    (default)  dist/ui-dump.md    the extension's own UI: settings page, popup, what is drawn into YouTube, and the rule texts
  site             dist/site-dump.md  the website: layout, navigation, pages (also the long ones), stylesheet and script
dist/ is ignored by git.

Only code that draws something a person reads or clicks. The engine, the tests and the word lists are left out on purpose.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CONTEXT_UI = """\
# Vianney Content Blocker: the extension's UI code

Vianney is a Chrome extension (plain JavaScript, no build step) that hides YouTube content its user decided against, with word lists
and an optional on-device model. Its name and idea come from St. Jean-Marie Vianney, the Curé of Ars. The text on screen is English.
The user of the extension is one person who writes their own rules; there is no account and no server.

What this file holds is only the code that draws something the user reads or clicks. The settings page is meant to look and read like
macOS System Settings (a window of at most 800 px, a sidebar of icon tiles, grouped rows with switches and popup buttons, short labels,
details in (?) popovers), set in Calmet UI, a typeface traced from a print of 1732. Light and dark follow the system.

Where the words are:
- settings page: `options.html` holds the fixed text; `options.js` builds the rest (rule list, one page per rule, model check, activity, test);
  `core/modelcheck.js` holds the sentences of the model-check panel
- rule names, one-sentence descriptions and examples: the last section, taken from the rule files (the examples are real sentences;
  `core/censor.js` masks the vulgar words when the page shows them)
- the pages drawn into YouTube: break card, labels on hidden cards, the warning over a video, the audio label
"""

CONTEXT_SITE = """\
# Vianney Content Blocker: the website

The website of a Chrome extension that hides YouTube content its user decided against (word lists, and an optional on-device model). It is a
Jekyll site, served from Cloudflare Pages. Its name and idea come from St. Jean-Marie Vianney, the Curé of Ars. The text is English. The readers are people who might
install a test build, and people interested in the project.

Three pages, as little text as possible on each:
- Idea: one sentence about the extension, one quotation about guarding the eyes and ears, and one line for each thing the extension does (a verb phrase
  under "What it does"); each line leads to its place on the Features page. On a phone this is also the first page, with the icon and the name on top.
- Features: for each thing it does, how it looks on YouTube AFTER a filter has worked (never what it filtered: nothing flagged is pictured), and the piece of
  the settings page where it is set (a group of rows with switches, as HTML: its text keeps the size it has on the settings page at any width), so that it explains itself; `_data/shots.json` says
  what each picture shows. The Rules feature shows one real rule in its own format (`_data/rules.json`) instead of example sentences.
- Install: a download button, a "Copy SHA-256" button, five steps

The site is drawn like macOS System Settings: one window of at most 800 px that keeps still while the page inside it scrolls, a sidebar of icon tiles
for the pages, grouped rows, light and dark following the system, set in Calmet UI (a typeface traced from a print of 1732). The painting behind the window
is the plate of the current month of the Très Riches Heures du duc de Berry (?month=3 shows another). On a phone the sidebar is the list and the page
slides in over it, as in iOS Settings. The settings page of the extension has the same look.

Where the words are:
- `_data/nav.yml`: the sidebar entries and, for each page, its heading and the line under it
- `_data/features.yml`: the eight things it does: title and line on the Features page, the short line on the home page
- `_data/shots.json`: what each picture of the Features page shows; `_data/rules.json`: the number of rules and the rule shown
- `index.html`, `features.html`, `install.html`: the pages
- `_includes/credits.html`: the two credits at the bottom of the home page
- `_layouts/default.html`: the frame and the toolbar
"""

FILES_UI = [
    ('The settings page', [
        'extension/src/options/options.html',
        'extension/src/options/options.js',
        'extension/src/options/options.css',
        'extension/src/core/modelcheck.js',
    ]),
    ('The toolbar popup', [
        'extension/src/popup/popup.html',
        'extension/src/popup/popup.js',
        'extension/src/popup/popup.css',
    ]),
    ('UI drawn into YouTube', [
        'extension/src/content/breakcard.js',
        'extension/src/content/actions.js',
        ('extension/src/content/watch.js', 'function createOverlay', 'export class WatchGuard', 'the warning shown over a video (the rest of the file is caption logic)'),
        ('extension/src/content/audio.js', 'function showTag', 'export class AudioGuard', 'the small label over the player (the rest of the file is audio logic)'),
    ]),
]

FILES_SITE = [
    ('Navigation and frame', [
        '_data/nav.yml',
        '_layouts/default.html',
        '_includes/credits.html',
    ]),
    ('Pages written for the site', [
        'index.html',
        'features.html',
        '_data/features.yml',
        '_data/shots.json',
        '_data/rules.json',
        'install.html',
    ]),
    ('Style and script', [
        'assets/site.css',
        'assets/site.js',
    ]),
]

LANG = {'.html': 'html', '.js': 'js', '.css': 'css', '.yml': 'yaml', '.json': 'json', '.md': 'markdown'}


def fence_for(text):
    longest = max([len(m) for m in re.findall(r'`+', text)] or [0])
    return '`' * max(4, longest + 1)      # markdown files hold ``` fences of their own


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def block(rel, body, note=''):
    lang = LANG.get(os.path.splitext(rel)[1], '')
    fence = fence_for(body)
    lines = body.count('\n') + 1
    head = f'### `{rel}`' + (f' ({note})' if note else '') + f': {lines} lines, {len(body.split()):,} words'
    return f'{head}\n\n{fence}{lang}\n{body.rstrip()}\n{fence}\n'


def rule_texts():
    """name, plain sentence, group, examples and spared titles of every rule, as the settings page lists them (examples as stored, i.e. before masking)."""
    out = []
    for fn in ('vianney.en.rules', 'vianney.media.en.rules'):
        text = read(f'extension/rules/{fn}')
        for part in re.split(r'\n(?=rule )', text):
            if not part.startswith('rule '):
                continue
            rid = part.split('\n')[0].split()[1]
            get = lambda key: re.findall(r'^\s+' + key + r':\s*(.*?)\s*$', part, re.M)
            name = (get('name') or [rid])[0]
            group = (get('group') or ['?'])[0]
            enabled = (get('enabled') or ['true'])[0]
            lines = [f'- **{name}** (`{rid}`, group {group}, {"on" if enabled == "true" else "off"} by default)']
            plain = get('plain')
            if plain:
                lines.append(f'  - one sentence: {plain[0]}')
            for e in get('example'):
                lines.append(f'  - flagged: {e}')
            for e in get('spared'):
                lines.append(f'  - not flagged: {e}')
            out.append('\n'.join(lines))
    return '\n'.join(out) + '\n'


def main():
    args = [a for a in sys.argv[1:]]
    profile = 'ui'
    if args and args[0] in ('ui', 'site'):
        profile = args.pop(0)
    out_path = args[0] if args else os.path.join(ROOT, 'dist', f'{profile}-dump.md')
    context, files = (CONTEXT_UI, FILES_UI) if profile == 'ui' else (CONTEXT_SITE, FILES_SITE)

    index = ['## Files\n']
    bodies = []
    for section, items in files:
        bodies.append(f'## {section}\n')
        for item in items:
            if isinstance(item, tuple):
                rel, start, stop, note = item
                full = read(rel)
                body = full[full.index(start):full.index(stop)]
                index.append(f'- `{rel}`, excerpt: {note}')
                bodies.append(block(rel, body, 'excerpt: ' + note))
            else:
                body = read(item)
                index.append(f'- `{item}`: {len(body.split()):,} words')
                bodies.append(block(item, body))
    if profile == 'ui':
        index.append('- the rule texts, from `extension/rules/*.rules`')
        bodies.append('## The rule texts\n\nAs the settings page lists them: the name, the one sentence, and the examples it shows under each rule '
                      '(what the rule flags, and what it leaves alone). The examples are stored as real sentences; the page masks the vulgar words. '
                      'Word lists and the prompts for the model are not included.\n\n' + rule_texts())
    text = '\n'.join([context, '\n'.join(index) + '\n'] + bodies)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f'{out_path}: {len(text):,} characters, {text.count(chr(10)) + 1:,} lines, {len(text.split()):,} words')


if __name__ == '__main__':
    main()
