import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { ICON_NAMES } from '../extension/src/options/icons.js';
import { extensionId } from '../tools/extension-id.mjs';
import { siteRules } from '../tools/make-site-data.mjs';
import { optionsViewCss, titleBlock, usage, NO_STYLE } from '../tools/make-options-css.mjs';
import { parseRules } from '../extension/src/core/rules.js';

// The settings page and the website are drawn the same way (a window with a sidebar of coloured icon tiles, Calmet UI type, Lucide icons).
// Neither has a build step, so a misspelt icon or colour would only show as a missing picture. These tests read the sources.
const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const has = (p) => existsSync(new URL(p, root));

const optionsHtml = read('extension/src/options/options.html');
const optionsJs = read('extension/src/options/options.js');
const optionsCss = read('extension/src/options/options.css');
const siteCss = read('assets/site.css');
const siteJs = read('assets/site.js');
const layout = read('_layouts/default.html');
const iconInclude = read('_includes/icon.html');
const creditsInclude = read('_includes/credits.html');
const index = read('index.html');
const featuresPage = read('features.html');
const install = read('install.html');
const manifestText = read('extension/manifest.json');
const manifest = JSON.parse(manifestText);

// The files in _data are flat lists of "- key: value" items; this reads just that shape ("[a, b]" values become arrays)
function readList(path, first) {
  return read(path).split(new RegExp(`\\n(?=- ${first}:)`)).filter((b) => b.startsWith(`- ${first}:`)).map((block) => {
    const item = {};
    for (const line of block.split('\n')) {
      const m = line.replace(/^- /, '  ').match(/^\s+([a-z]+):\s*(.*)$/);
      if (!m) continue;
      const v = m[2].trim().replace(/^"(.*)"$/, '$1');
      item[m[1]] = /^\[.*\]$/.test(v) ? v.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean) : v;
    }
    return item;
  });
}
const nav = readList('_data/nav.yml', 'url');
const features = readList('_data/features.yml', 'id');
const shots = JSON.parse(read('_data/shots.json'));
const options = JSON.parse(read('_data/options.json'));   // the option blocks of the Features page: HTML of the real settings page (tools/make-feature-options.py)
const rulesData = JSON.parse(read('_data/rules.json'));
const extension = Object.fromEntries(read('_data/extension.yml').split('\n').filter((l) => /^[a-z]+:/.test(l)).map((l) => [l.split(':')[0], l.slice(l.indexOf(':') + 1).trim()]));

const siteIcons = [...iconInclude.matchAll(/\{%- when "([a-z0-9-]+)" -%\}/g)].map((m) => m[1]);
const cssColours = (css) => new Set([...css.matchAll(/\.c-([a-z]+)\s*\{/g)].map((m) => m[1]));
const phoneCss = () => siteCss.slice(siteCss.indexOf('@media (max-width: 640px)'), siteCss.indexOf('@media (prefers-reduced-motion: reduce)'));
const visibleWords = (html) => html.replace(/---[\s\S]*?---/, '').replace(/\{%[\s\S]*?%\}/g, ' ').replace(/\{\{[\s\S]*?\}\}/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').split(/\s+/).filter((w) => /\w/.test(w)).length;
const words = (s) => s.split(/\s+/).filter(Boolean).length;

test('the settings page only names icons and colours that exist', () => {
  const names = new Set([
    ...[...optionsHtml.matchAll(/data-icon="([a-z0-9-]+)"/g)].map((m) => m[1]),
    ...[...optionsJs.matchAll(/icon: '([a-z0-9-]+)'/g)].map((m) => m[1]),
    ...[...optionsJs.matchAll(/icon\('([a-z0-9-]+)'/g)].map((m) => m[1]),
  ]);
  assert.ok(names.size >= 12, `found ${names.size} icon names`);
  for (const n of names) assert.ok(ICON_NAMES.includes(n), `options icon "${n}" is not in icons.js`);
  const colours = cssColours(optionsCss);
  const used = new Set([...optionsHtml.matchAll(/data-color="([a-z]+)"/g), ...optionsJs.matchAll(/color: '([a-z]+)'/g)].map((m) => m[1]));
  assert.ok(used.size >= 6, `found ${used.size} colours`);
  for (const c of used) assert.ok(colours.has(c), `options colour "${c}" has no .c-${c} in options.css`);
});

test('the website only names icons and colours that exist', () => {
  assert.ok(nav.length >= 4 && features.length >= 6, `nav items: ${nav.length}, features: ${features.length}`);
  const used = new Set([...nav.map((n) => n.icon), ...features.map((f) => f.icon),
    ...[layout, index, featuresPage, install].flatMap((t) => [...t.matchAll(/include icon\.html name="([a-z0-9-]+)"/g)].map((m) => m[1]))]);
  for (const n of used) assert.ok(siteIcons.includes(n), `site icon "${n}" is not in _includes/icon.html`);
  const colours = cssColours(siteCss);
  for (const c of new Set([...nav.map((n) => n.color), ...features.map((f) => f.color), ...[...(index + install).matchAll(/ c-([a-z]+)/g)].map((m) => m[1])])) assert.ok(colours.has(c), `site colour "${c}" has no .c-${c} in site.css`);
  for (const n of siteIcons) assert.ok(ICON_NAMES.includes(n) || /^(code-xml|file-text|sliders-horizontal|lock)$/.test(n), `unexpected site-only icon ${n}`);
});

test('the sidebar is Idea, Features, Install and Source: nothing about rules, sermons or the plan', () => {
  assert.deepEqual(nav.map((n) => n.title), ['Idea', 'Features', 'Install', 'Source']);
  assert.deepEqual(nav.map((n) => n.url), ['/', '/features.html', '/install.html', 'https://github.com/drugi-obieg/vianney']);
  for (const item of nav) {
    assert.ok(item.title && item.icon && item.color, `${item.url}: title, icon and colour`);
    if (item.external === 'true') continue;
    const file = item.url === '/' ? 'index.html' : item.url.replace(/^\//, '');
    assert.ok(has(file), `${item.url}: no page ${file}`);
    if (item.url !== '/') assert.ok(item.heading, `${item.url} needs a heading (the page header shows it)`);
  }
  const config = read('_config.yml');
  for (const f of ['sermons.md', 'plan.md', 'rules.md']) assert.ok(config.includes(`- ${f}`), `${f} is not published`);
  for (const f of ['sermons', 'rules', 'plan']) assert.ok(!(index + install + featuresPage + layout + read('_data/nav.yml')).includes(`${f}.html`), `no link to ${f}.html`);
});

test('the type, the icons and the pictures the pages refer to are in the repository', () => {
  for (const f of ['CalmetUI-Regular.ttf', 'CalmetUI-Italic.ttf']) {
    assert.ok(has(`assets/fonts/${f}`), f);
    assert.equal(readFileSync(new URL(`assets/fonts/${f}`, root)).compare(readFileSync(new URL(`extension/src/options/fonts/${f}`, root))), 0, `${f}: the site and the extension carry the same file`);
    assert.ok(siteCss.includes(`fonts/${f}`) && optionsCss.includes(`fonts/${f}`), `${f} is declared in both stylesheets`);
  }
  // the font is the traced face only (version 0.2): dedicated to the public domain, with nothing of Source Serif 4 in it. The CC0 text travels with every copy.
  for (const dir of ['assets/fonts', 'extension/src/options/fonts']) {
    assert.match(read(`${dir}/CC0-1.0.txt`), /CC0 1\.0 Universal/, `${dir}: the CC0 text`);
    assert.match(read(`${dir}/LICENSE-font.txt`), /CC0 1\.0 Universal[\s\S]*CC0-1\.0\.txt/, `${dir}: says the font is CC0 and where the text is`);
    assert.ok(!has(`${dir}/SourceSerif4-OFL.txt`), `${dir}: no OFL file: nothing of Source Serif is in the font`);
    for (const f of ['CalmetUI-Regular.ttf', 'CalmetUI-Italic.ttf']) {
      const bytes = readFileSync(new URL(`${dir}/${f}`, root));
      const has16 = (s) => bytes.includes(Buffer.from(s, 'utf16le').swap16()) || bytes.includes(Buffer.from(s, 'latin1'));   // name records are UTF-16BE (Windows) or ASCII (Mac)
      assert.ok(has16('CC0 1.0 Universal') && has16('Version 0.2'), `${f}: the name table says CC0 and version 0.2`);
      assert.ok(!has16('Source Serif') && !has16('SIL OFL'), `${f}: the name table names no other font`);
    }
  }
  // the traced face has no accents, so the stylesheets must not count on them: the stack carries a font for the characters it lacks
  assert.match(siteCss, /--font: "Calmet UI", "Iowan Old Style"/);
  for (const f of ['icon-512.png', 'favicon-32.png', 'apple-touch-icon.png']) assert.ok(has(`assets/${f}`) && layout.includes(f), f);
  for (const f of ['icon16.png', 'icon32.png', 'icon48.png', 'icon128.png']) assert.ok(has(`extension/icons/${f}`), f);
  assert.ok(optionsHtml.includes('../../icons/icon128.png'), 'the settings page shows the app icon');
  assert.ok(has('assets/site.js') && layout.includes('assets/site.js'));
});

test('both stylesheets keep the window at 800 px', () => {
  assert.match(siteCss, /\.app\s*\{[^}]*width:\s*min\(800px/);
  assert.match(optionsCss, /\.app\s*\{[^}]*width:\s*min\(800px/);
});

test('on a desktop the window keeps still and its page scrolls, not the document', () => {
  assert.match(siteCss, /body\s*\{[^}]*height:\s*100dvh;[^}]*padding-block:\s*26px/, 'the body is as high as the screen');
  assert.match(siteCss, /\.app\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*\d+px/, 'the window fills it');
  assert.match(siteCss, /\.content\s*\{[^}]*overflow-y:\s*auto/, 'the page scrolls inside the window');
  assert.match(siteCss, /\.sidebar-inner\s*\{[^}]*overflow-y:\s*auto/, 'and so does the sidebar');
  assert.match(siteCss, /\.toolbar\s*\{[^}]*position:\s*sticky/, 'the toolbar stays on top of the page');
  // a phone has no window: the page is the screen and scrolls itself, and printing has no frame
  const phone = siteCss.slice(siteCss.indexOf('@media (max-width: 640px)'), siteCss.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(phone, /body\s*\{[^}]*height:\s*auto/);
  assert.match(phone, /\.sidebar-inner,\s*\.content\s*\{[^}]*overflow:\s*visible/);
  assert.match(siteCss.slice(siteCss.indexOf('@media print')), /\.content\s*\{\s*overflow:\s*visible/);
});

test('the install page says little: a download, a checksum button, five steps, and nothing about how the build is made', () => {
  assert.ok(visibleWords(install) <= 90, `install.html has ${visibleWords(install)} words`);
  assert.equal((install.match(/site\.data\.release\.sha256/g) || []).length, 1, 'the checksum is only in the Copy button, not on the page');
  assert.match(install, /<button[^>]*data-copy="\{\{ site\.data\.release\.sha256 \}\}"[^>]*>Copy SHA-256<\/button>/);
  for (const w of ['First things', 'browser store', 'for testing', 'Known limits', 'Good to know', 'shasum', 'Could not unzip', 'Brave:', 'Edge:', 'affiliated']) assert.ok(!install.includes(w), w);
  assert.ok(!/brave:\/\/|edge:\/\//.test(install), 'only chrome:// is named: the other browsers take it over');
  const steps = [...install.matchAll(/<span class="num">(\d)<\/span><div class="label"><span class="title">(.*?)<\/span>/g)].map((m) => [m[1], m[2].replace(/<[^>]+>/g, '').trim()]);
  assert.deepEqual(steps.map((s) => s[0]), ['1', '2', '3', '4', '5']);
  assert.equal(steps[0][1], 'Open chrome://extensions');
  assert.equal(steps[1][1], 'Switch on Developer mode', 'Developer mode is a step of its own');
  assert.equal(steps[2][1], 'Drop the zip onto the page');
  assert.equal(steps[3][1], 'Check Activity after a day or so');
  assert.equal(steps[4][1], 'Tweak settings and report issues');
  assert.match(install, /<a href="chrome:\/\/extensions" data-copy="chrome:\/\/extensions">chrome:\/\/extensions<\/a>/, 'a link, which copies the address where a browser will not open it');
  assert.match(install, /href="https:\/\/github\.com\/drugi-obieg\/vianney\/issues"/);
  assert.match(install, /To update, remove the old version first\./);
});

test('the links into the extension use its pinned ID, and only the real site may open its settings page', () => {
  assert.equal(extension.id, extensionId(manifestText), '_data/extension.yml and the key in manifest.json agree (node tools/extension-id.mjs)');
  assert.match(extension.id, /^[a-p]{32}$/);
  assert.ok(has(`extension/${extension.settings}`), `extension/${extension.settings} exists`);
  assert.ok(manifest.options_page === extension.settings || manifest.options_page.endsWith(extension.settings));
  assert.match(install, /chrome-extension:\/\/\{\{ site\.data\.extension\.id \}\}\/\{\{ site\.data\.extension\.settings \}\}#log"/, 'Activity opens the log');
  assert.match(optionsHtml, /<section class="pane" id="log"/, 'and #log is a page of the settings');
  const open = manifest.web_accessible_resources.filter((r) => r.resources.includes('src/options/options.html'));
  assert.equal(open.length, 1);
  assert.deepEqual(open[0].resources, ['src/options/options.html'], 'only the settings page is open to web pages');
  assert.deepEqual(open[0].matches, ['https://vianney.cc/*'], 'and only to the real site');
});

test('the Features page: the options of every feature are HTML of the real settings page, the preview is a picture of YouTube (or HTML of the settings page), or a rule in its own format', () => {
  assert.equal(new Set(features.map((f) => f.id)).size, features.length, 'ids are unique');
  assert.deepEqual(features.map((f) => f.id), ['hide', 'rules', 'sensitivity', 'subtitles', 'clean-up', 'break-reminder', 'images-audio', 'on-device-ai']);
  const pictures = new Set();
  const blocks = new Set();
  for (const f of features) {
    assert.match(f.id, /^[a-z][a-z-]*$/, 'an id is a clean anchor');
    for (const k of ['title', 'sub', 'home', 'icon', 'color']) assert.ok(f[k], `${f.id}: ${k}`);
    assert.ok(words(f.sub.replace('%n', '44')) <= 9 && words(f.home.replace('%n', '44')) <= 6, `${f.id}: short texts`);
    assert.ok((f.opts || []).length >= 1, `${f.id}: options on the left`);
    assert.ok((f.view || []).length >= 1 || f.rule === 'true', `${f.id}: a preview on the right (or the rule)`);
    for (const slug of f.opts || []) { blocks.add(slug); assert.ok(options[slug] && options[slug].html && options[slug].alt.length > 10, `${slug}: HTML and a description in _data/options.json`); }
    for (const slug of f.view || []) {
      if (options[slug]) { blocks.add(slug); continue; }                  // a piece of the settings page, such as the answer of the Test rules page
      pictures.add(slug);
      for (const scheme of ['light', 'dark']) assert.ok(has(`assets/features/${slug}-${scheme}.webp`), `${slug}-${scheme}.webp`);
      const sh = shots[slug];
      assert.ok(sh && sh.width >= 200 && sh.height >= 60 && sh.alt && sh.alt.length > 10, `${slug}: size and description in _data/shots.json`);
    }
  }
  assert.ok(features.some((f) => f.experimental === 'true' && f.id === 'images-audio'));
  const files = readdirSync(new URL('assets/features/', root)).filter((n) => n.endsWith('.webp'));
  assert.deepEqual(files.sort(), [...pictures].flatMap((p) => [`${p}-dark.webp`, `${p}-light.webp`]).sort(), 'no picture without a feature, none missing: only YouTube is a picture');
  assert.deepEqual(Object.keys(shots).sort(), [...pictures].sort());
  assert.deepEqual(Object.keys(options).sort(), [...blocks].sort(), 'no block without a feature');
  assert.ok(files.reduce((n, f) => n + statSync(new URL(`assets/features/${f}`, root)).size, 0) <= 1500 * 1024, 'the pictures stay modest');
  assert.ok(Buffer.byteLength(read('_data/options.json')) <= 160 * 1024, 'and so do the blocks');
  // the page: one section per feature; the options one under the other on the left, the first picture on the right, the others under the options
  assert.match(featuresPage, /options_css: true/, 'the page asks for the CSS of the blocks');
  assert.match(layout, /\{%- if page\.options_css %\}\s*<link rel="stylesheet" href="\{\{ '\/assets\/options-view\.css' \| relative_url \}\}">/);
  assert.match(featuresPage, /<section class="feature" id="\{\{ f\.id \}\}">/);
  assert.ok(featuresPage.indexOf('{%- if f.rule %}') < featuresPage.indexOf('for slug in f.opts') && featuresPage.indexOf('for slug in f.opts') < featuresPage.indexOf('for slug in f.view'), 'the rule first (it is the first of the waterfall), then the options, then the preview');
  assert.match(featuresPage, /<div class="feature-body\{% if f\.waterfall %\} waterfall\{% endif %\}">/, 'a feature can be a waterfall');
  assert.match(featuresPage, /\{%- for slug in f\.opts %\}\s*\{% include feature-item\.html slug=slug side="left" %\}/);
  assert.match(featuresPage, /\{%- if forloop\.first %\}\s*\{% include feature-item\.html slug=slug side="right" span=left drop=drop %\}\s*\{%- else %\}\s*\{% include feature-item\.html slug=slug side="left" %\}/, 'the first picture on the right, the others on the left under the options');
  assert.match(featuresPage, /\{%- if head contains 'class="group-title"' %\}\{% assign drop = ' drop' %\}\{% endif %\}/, 'what stands beside a block that begins with a heading is lowered by the heading');
  assert.match(featuresPage, /\{%- if nview > 1 %\}\{% assign extra = nview \| minus: 1 %\}\{% assign left = left \| plus: extra %\}\{% endif %\}/, 'the preview spans the rows of the left column');
  const item = read('_includes/feature-item.html');
  assert.match(item, /<figure class="xopt \{\{ include\.side \}\}\{\{ include\.drop \}\}"[^>]*role="img" aria-label="\{\{ o\.alt \| escape \}\}">\{\{ o\.html \}\}<\/figure>/, 'a block is text in a figure that has a description');
  assert.match(item, /<source media="\(prefers-color-scheme: dark\)" srcset="[^"]*-dark\.webp[^>]*width="\{\{ shot\.dark\.width \| default: shot\.width \}\}" height="\{\{ shot\.dark\.height \| default: shot\.height \}\}"/, 'a picture has its dark one and the room of both');
  assert.match(item, /width="\{\{ shot\.width \}\}" height="\{\{ shot\.height \}\}"[^>]*alt="\{\{ shot\.alt \| escape \}\}"/);
  assert.match(siteCss, /\.feature-body \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/, 'two columns');
  assert.match(siteCss, /\.feature-body \.left \{ grid-column: 1; \}\s*\.feature-body \.right \{ grid-column: 2; grid-row: 1 \/ span var\(--span, 1\); \}/);
  assert.ok(!/\.feature-body \.opts|display: contents|position: sticky/.test(siteCss.slice(siteCss.indexOf('.feature-body {'), siteCss.indexOf('figure.rule-card pre'))), 'no pictures flowing in two columns any more, nothing sticky');
  assert.match(siteCss, /\.feature-body \.drop \{ margin-top: var\(--title-block, 23px\); \}/, 'the lowering is the height of a heading');
  assert.match(siteCss, /\.feature-body\.waterfall \{ display: block; columns: 2; column-gap: 14px; \}\s*\.feature-body\.waterfall > figure \{ break-inside: avoid; margin: 0 0 14px; display: flow-root; \}\s*\.feature-body\.waterfall > figure\.rule-card \{ column-span: all; \}/, 'the waterfall is two CSS columns of whole figures, under the rule, which is as wide as the block');
  assert.ok(!/grid-lanes|masonry/.test(siteCss.replace(/\/\*[\s\S]*?\*\//g, '')), 'no CSS that no browser here could test');
  assert.match(phoneCss(), /\.feature-body \{ grid-template-columns: 1fr; \}\s*\.feature-body \.left, \.feature-body \.right \{ grid-column: 1; grid-row: auto; \}\s*\.feature-body figure\.scene \{ order: -1; \}\s*\.feature-body \.drop \{ margin-top: 0; \}\s*\.feature-body\.waterfall \{ columns: 1; \}/, 'on a phone they stack, the pictures first, and nothing is lowered');
  assert.ok(!/<h1|<pre>[^<]*[a-z]+_[a-z]+/.test(featuresPage), 'the heading is in the page header; the rule on the page is data, not text');
  assert.match(layout, /<article class="pane">/, 'no prose styling on the pages of the site');
});

test('the option blocks hold only what the settings page itself shows: no ids, no scripts, no links, no "?" buttons, controls out of the tab order', () => {
  for (const [slug, o] of Object.entries(options)) {
    assert.ok(!/\sid="|\sfor="|<script|\son[a-z]+=|popover|<a[\s>]|href=|\sdata-|\saria-|\srole=|<img/.test(o.html), `${slug}: nothing that only works inside the extension`);
    assert.ok(!/class="(help|pill|chev)[ "]|hidden/.test(o.html), `${slug}: no help buttons, labels or arrows`);
    for (const m of o.html.matchAll(/<(input|select|textarea|button)\b[^>]*>/g)) assert.match(m[0], /tabindex="-1"/, `${slug}: ${m[1]} is out of the tab order`);
    assert.ok(!/>\s+</.test(o.html), `${slug}: no space between tags`);
    assert.ok(o.alt.length <= 300 && !/<|>/.test(o.alt), `${slug}: the description is text`);
  }
  // the state it shows is a real one: a switch that is on has `checked`, a popup shows one entry
  assert.equal((options.scope.html.match(/<input type="checkbox" checked=""/g) || []).length, 5, 'Scope: five switches, all on in the shipped settings');
  assert.ok(!/<option[^>]*>[^<]*<\/option><option/.test(options.sensitivity.html), 'a popup shows its one entry');
  assert.match(options.subtitles.html, /class="narrow"[^>]*value="0\.12"[\s\S]*class="narrow"[^>]*value="0\.18"/, 'the two fields for seconds are the narrow ones, with the shipped values');
  assert.match(options.sensitivity.html, /Reset to defaults/, 'the Actions block has its button');
  assert.ok(!/Default \(/.test(options.sensitivity.html), 'and no "Default" entry');
});

test('assets/options-view.css is what `node tools/make-options-css.mjs` writes from the CSS of the settings page and the blocks, and every class the blocks use has a rule', () => {
  const css = read('assets/options-view.css');
  assert.equal(css, optionsViewCss(), 'run: node tools/make-options-css.mjs');
  const { classes } = usage(Object.values(options).map((o) => o.html).join('\n'));
  assert.ok(classes.size >= 20, `${classes.size} classes`);
  for (const c of classes) assert.ok(NO_STYLE.has(c) || new RegExp(`\\.${c}\\b`).test(css), `class "${c}" is used by a block and has no rule in options.css`);
  // every rule is under .xopt (nothing leaks into the site), none is a state of a live control, and the font and the page are not redefined
  const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{[^{}]*\}/g, '{}').split(/[{}]/).map((x) => x.trim()).filter((x) => x && !x.startsWith('@media'));
  for (const sel of selectors.flatMap((x) => x.split(','))) assert.ok(sel.trim().startsWith('.xopt') || sel.trim() === ':root', `${sel.trim()} is under .xopt (or is :root, which holds the height of a heading)`);
  assert.equal(Number(css.match(/:root \{ --title-block: ([\d.]+)px/)[1]), titleBlock(optionsCss), 'the height of a heading is the settings page\'s own: its line and its bottom margin');
  assert.match(css, /\.xopt > \.group-title:first-child, \.xopt > \.rule-group:first-child > \.group-title:first-child \{ margin-top: 0; \}/, 'a heading at the top of a block has no space above it');
  assert.ok(!/:hover|:focus|:active|@font-face|body|html/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'no hover, no focus, no face, no page');
  assert.match(css, /\.xopt input, \.xopt select, \.xopt textarea, \.xopt button, \.xopt \.rule-row \{ pointer-events: none;/, 'a copy that nobody can touch');
});

test('the Rules feature shows one rule in the real format: its slug, its word list, a title it must not flag, its sensitivity and its action', () => {
  const rules = features.find((f) => f.id === 'rules');
  assert.equal(rules.rule, 'true');
  assert.ok(!rules.view, 'the rule is its own preview; no sentences of examples on the page');
  assert.deepEqual(rulesData, siteRules(), '_data/rules.json is what `node tools/make-site-data.mjs` writes from the rule files');
  assert.deepEqual(rulesData.card.lines.map((l) => l[0]), ['lexicon', 'spared', 'flag at', 'action']);
  assert.match(rulesData.card.id, /^[a-z_]+$/);
  assert.ok(has(`extension/lexicon/${rulesData.card.lines[0][1]}.txt`), 'the word list it names exists');
  assert.ok(!/\b(fuck|shit|bitch|bullshit)\b/i.test(JSON.stringify(rulesData)));
  assert.equal(rules.waterfall, 'true', 'the groups fall into two columns, under the rule');
  assert.match(featuresPage, /<figure class="xopt rule-card"><div class="rule-group"><div class="group-title">One rule, as written<\/div><pre><code><span class="head"><span class="k">rule<\/span> <span class="id">\{\{ site\.data\.rules\.card\.id \}\}<\/span><\/span>/, 'the rule has a heading like a group, so that the tops of the boxes are level');
  assert.match(featuresPage, /<span class="k">\{\{ line\[0\] \}\}:<\/span><span class="v">\{\{ line\[1\] \}\}<\/span>/, 'a key and its value, each in its own cell: a long value wraps under itself');
  assert.match(siteCss, /figure\.rule-card pre \{/);
  assert.match(siteCss, /figure\.rule-card code \{ font: inherit; display: grid; grid-template-columns: max-content minmax\(0, 1fr\);/);
  assert.match(siteCss, /figure\.rule-card \.v \{ white-space: pre-wrap; overflow-wrap: anywhere; \}/, 'a long value wraps');
});

test('the numbers on the site are the rules of the extension: the count comes from the rule files, and every rule is in exactly one block, switched as the shipped settings have it', () => {
  const real = siteRules();
  assert.equal(rulesData.count, real.count);
  for (const f of features) for (const text of [f.sub, f.home]) assert.ok(!/\b\d+\b/.test(text), `${f.id}: a number on the site is written as %n`);
  assert.ok(features.find((f) => f.id === 'rules').sub.includes('%n'), 'the Features page names the number of rules');
  assert.equal(features.find((f) => f.id === 'rules').home, 'Applies text-based configurable rules', 'the home page does not name it');
  assert.match(index, /f\.home \| replace: '%n', site\.data\.rules\.count/);
  assert.match(featuresPage, /f\.sub \| replace: '%n', site\.data\.rules\.count/);
  const group = { belief: ['belief'], anticatholic: ['anticatholic'], swearing: ['speech'], people: ['people'], purity: ['purity'], leisure: ['leisure'], media: ['pictures', 'sound'] };
  const parsed = parseRules(['vianney.en.rules', 'vianney.media.en.rules'].map((f) => read(`extension/rules/${f}`)).join('\n\n'));
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.rules.length, real.count);
  const plain = (html) => html.replace(/<[^>]+>/g, '\n').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/[‘’]/g, "'").split('\n').map((x) => x.trim()).filter(Boolean);
  for (const [slug, groups] of Object.entries(group)) {
    const rows = [...options[slug].html.matchAll(/<div class="row rule-row[^"]*"[^>]*>[\s\S]*?<\/div><div class="control">[\s\S]*?<\/div><\/div>/g)].map((m) => m[0]);
    const mine = parsed.rules.filter((r) => groups.includes(r.group));
    assert.equal(rows.length, mine.length, `${slug}: a row for each of its ${mine.length} rules`);
    mine.forEach((r, i) => {
      assert.deepEqual(plain(rows[i]), [r.name.replace(/[‘’]/g, "'")], `${slug}: row ${i + 1} is "${r.name}"`);
      assert.equal(/<input type="checkbox" checked=""/.test(rows[i]), r.enabled, `${slug}: "${r.name}" is switched ${r.enabled ? 'on' : 'off'} as the rule file has it`);
    });
  }
});

test('the home page is short: a sentence about the extension, one quotation, one line for each feature, each leading to its place on the Features page', () => {
  assert.ok(visibleWords(index) <= 80, `index.html has ${visibleWords(index)} words`);
  assert.ok(!/<pre|<img|class="cta"|class="hero"/.test(index));
  const intro = (index.match(/<p class="intro">([\s\S]*?)<\/p>/) || [])[1] || '';
  for (const w of ['free browser extension', 'non-Catholic', '<em>local</em> AI model', 'Kev-0.6B', 'YouTube']) assert.ok(intro.includes(w), `the sentence says "${w}"`);
  assert.ok(!/<h2|group-title">Why/.test(index), 'no heading over the sentence and the quotation');
  assert.equal((index.match(/<figure class="quote">/g) || []).length, 1, 'one memorable quotation');
  assert.ok(!/Bernard/.test(index));
  assert.match(index, /look at nothing out of curiosity,<br>nor at the various things/, 'the quotation breaks its line after "curiosity,"');
  for (const q of index.matchAll(/<blockquote>(.*?)<\/blockquote>/g)) assert.ok(words(q[1]) <= 40, 'a quotation, not a sermon');
  assert.ok(!/lang="fr"|Sermon|sermon|\bFrench\b|« /.test(index), 'English only');
  assert.match(index, /St\. Jean-Marie Vianney/);
  assert.match(index, /<div class="group-title">What it does<\/div>/);
  assert.match(index, /href="\{\{ '\/features\.html' \| relative_url \}\}#\{\{ f\.id \}\}"/, 'every row leads to its feature');
  assert.match(index, /\{\{ f\.home \| replace: /);
  // the rows sit under "What it does": each is a verb phrase that finishes "It ..." (Hides ..., Applies ..., Lets you ...)
  for (const f of features) assert.match(f.home, /^[A-Z][a-z]+s\b/, `${f.id}: "${f.home}" must start with a verb that follows "It"`);
  assert.ok(features.some((f) => /Removes Shorts/.test(f.home)));
  for (const w of ['Pictures and sound', 'Try it', 'Where it looks', 'Rules', 'Plan']) assert.ok(!(index + install).includes(w), w);
  // the name and the icon are in the sidebar of a desktop, so the block with them is there for a phone only (and for readers without the layout)
  assert.match(layout, /<header class="pane-head hero">\s*<img class="app-icon"[^>]*>\s*<h1>\{\{ site\.title \}\}<\/h1>\s*<\/header>/, 'the hero is the icon and the name: no line under it');
  assert.match(siteCss, /\.pane-head\.hero \{ position: absolute; width: 1px;/, 'hidden on a desktop');
  const phone = siteCss.slice(siteCss.indexOf('@media (max-width: 640px)'), siteCss.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(phone, /\.pane-head\.hero \{ position: static;/, 'shown on a phone');
  assert.ok(!/<footer/.test(layout), 'no footer in the layout');
});

test('a phone opens the home page on the Idea page, with the list one step back, and the painting shows through, blurred', () => {
  assert.match(layout, /data-screen', home && location\.hash === '#menu' \? 'list' : 'page'/, 'the list is the entry #menu: the page is the default');
  assert.match(siteJs, /home && mobile\.matches && !location\.hash/);
  assert.match(siteJs, /history\.replaceState\(null, '', location\.pathname \+ location\.search \+ '#menu'\)/);
  assert.match(siteJs, /history\.pushState\(\{ screen: 'page' \}, '', location\.pathname \+ location\.search \+ '#open'\)/);
  const phone = siteCss.slice(siteCss.indexOf('@media (max-width: 640px)'), siteCss.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.ok(!/body::before, body::after \{ display: none; \}/.test(phone), 'the painting is not switched off on a phone');
  assert.match(phone, /body::before \{ filter: blur\(\d+px\)/, 'it is blurred');
  assert.match(phone, /\.app \{[^}]*background: color-mix\(in srgb, var\(--window\) \d+%, transparent\)/, 'and the page is only partly opaque');
  assert.match(phone, /\.group, \.status-card, figure\.quote, figure\.rule-card pre, html\[data-screen\] #nav \{ background: color-mix\(in srgb, var\(--card\) \d+%, transparent\)/);
});

test('the characters of the painting stand in front of the window only on a tablet and a desktop, in the months the owner chose', () => {
  const lift = (read('_data/wallpaper.yml').match(/^lift_months: \[([0-9, ]*)\]$/m) || [])[1];
  assert.equal(lift, '1, 2, 6, 7, 9, 10', 'January, February, June, July, September and October');
  assert.match(siteJs, /if \(!lift \|\| lift === 'none' \|\| mobile\.matches \|\| stage \|\| stageLoading\) return;/, 'never on a phone');
  assert.match(siteJs, /mobile\.addEventListener\('change', function \(\) \{ if \(mobile\.matches\) stopStage\(\); else startStage\(\); \}\)/, 'and not after the screen turns into one');
  assert.match(siteJs, /stage\.destroy\(\)/);
});

test('the quotations have no coloured edge', () => {
  assert.ok(!/--gold|border-left:\s*\d+px solid/.test(siteCss));
  assert.match(siteCss, /figure\.quote\s*\{[^}]*border:\s*1px solid var\(--line\)/);
});

test('only the background and the icons are credited, at the bottom of the window of the home page', () => {
  assert.match(index, /^credits: true$/m);
  assert.match(layout, /\{%- if page\.credits %\}\s*\{% include credits\.html %\}/);
  assert.ok(layout.indexOf('</article>') < layout.indexOf('include credits.html'), 'after the page, inside the window');
  assert.match(creditsInclude, /Background: <a href="https:\/\/de\.wikipedia\.org\/wiki\/Tr%C3%A8s_Riches_Heures">Très Riches Heures du duc de Berry<\/a> \(public domain\)/);
  assert.match(creditsInclude, /Icons: <a href="https:\/\/lucide\.dev">Lucide<\/a> \(ISC\)/);
  assert.equal((creditsInclude.match(/[A-Z][a-z]+:/g) || []).length, 2, 'two credits and nothing else');
  assert.ok(!/affiliated|Calmet|portrait|independent project|\bMIT\b/i.test(creditsInclude + index + install), 'no notice about affiliation, the portrait, the licence or the type');
  assert.match(siteCss, /\.credits\s*\{[^}]*flex:\s*none/);
});

test('the desktop behind the window is the painting of the month: twelve pictures, twelve rules, set by the layout, and ?month= chooses', () => {
  for (let m = 1; m <= 12; m++) {
    const n = String(m).padStart(2, '0');
    assert.ok(siteCss.includes(`html[data-month="${n}"] { --wallpaper: url("months/${n}.avif"); }`), `rule for month ${n}`);
    assert.ok(has(`assets/months/${n}.avif`), `assets/months/${n}.avif`);
  }
  assert.match(layout, /setAttribute\('data-month'/);
  assert.match(layout, /get\('month'\)/, '?month=3 or ?month=mar');
  for (const name of ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']) assert.match(layout, new RegExp(`\\b${name}: \\d`), `?month=${name}`);
  assert.match(siteJs, /\['month', 'lift'\]/, '?month= and ?lift= stay in the links, so that the painting can be looked at page by page');
  assert.match(read('_data/wallpaper.yml'), /^lift_months: \[[0-9, ]*\]$/m, 'the months with characters in front of the window are listed here');
  assert.match(layout, /site\.data\.wallpaper\.lift_months/);
  const credits = JSON.parse(read('assets/months/credits.json'));
  assert.equal(credits.length, 12);
  assert.ok(credits.every((c) => c.licence === 'Public domain' && /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(c.commons_file_page)), 'every plate names its Commons page and a public-domain licence');
  // the cut-out characters, for lifting some of them in front of the window: every file in the manifest is there, every month has its plate
  const layers = JSON.parse(read('assets/months/layers.json'));
  assert.equal(layers.months.length, 12);
  const lifted = [1, 2, 6, 7, 9, 10];
  for (const m of layers.months) {
    assert.ok(has(`assets/months/${m.background.file}`), m.background.file);
    if (lifted.includes(m.month)) assert.ok(m.layers.length >= 1, `month ${m.month} is one of the months with characters in front of the window, so it has cut-outs`);
    for (const l of m.layers) assert.ok(has(`assets/months/${l.file}`), l.file);
  }
  const listed = new Set(layers.months.flatMap((m) => m.layers.map((l) => l.file.replace(/^layers\//, ''))));
  assert.deepEqual(readdirSync(new URL('assets/months/layers/', root)).sort(), [...listed].sort(), 'no cut-out file that the manifest does not list');
  assert.match(read('_config.yml'), /assets\/months\/stage-test\.html/, 'the test page of the stage is not published');
});

test('on a phone the sidebar is the list and the page slides over it', () => {
  assert.match(layout, /setAttribute\('data-screen'/);
  assert.match(layout, /setAttribute\('data-home'/);
  assert.match(siteCss, /html\[data-screen="list"\] \.content \{ display: none; \}/);
  assert.match(siteCss, /html\[data-screen="page"\] \.sidebar \{ display: none; \}/);
  assert.match(siteCss, /@view-transition \{ navigation: auto; \}/);
  for (const k of ['slide-in-right', 'slide-out-left', 'slide-in-left', 'slide-out-right']) assert.ok(siteCss.includes(`@keyframes ${k}`), k);
  assert.match(siteCss, /prefers-reduced-motion/);
  for (const k of ['startViewTransition', 'pagereveal', 'popstate', 'data-copy']) assert.ok(siteJs.includes(k), k);
});
