// The page "Gemini Nano": runs the checks of nanocheck.js in this page, and, where the extension is installed in the same browser, asks it for what only an
// extension sees (the free disk space) and to open the pages of Chrome, which a web page cannot open (a link, window.open and location are all refused).
// Without the extension the addresses are copied, and a note says where to paste them. Nothing is sent anywhere.
import { checklist, reportText } from './nanocheck.js';
import { collectFacts } from './nanoprobe.js';

const $ = (id) => document.getElementById(id);
const box = $('nano');
if (box) start();

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}

const MARK = { ok: '✓', fail: '✕', warn: '!', todo: '→', busy: '…', info: 'i', unknown: '?' };
const WORD = { ok: 'Done', fail: 'Problem', warn: 'Check', todo: 'To do', busy: 'Wait', info: 'For your information', unknown: 'Not known' };
const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
const KEY = MAC ? '⌘L' : 'Ctrl+L';

function start() {
  const EXT = box.dataset.extId;
  let bridge = null;       // {id, version} when the extension answers
  let facts = null;

  /** A message to the extension; null where there is none (it is not installed, or this is not Chrome). */
  const ask = (msg) => new Promise((resolve) => {
    try {
      if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) return resolve(null);
      chrome.runtime.sendMessage(EXT, msg, (r) => { void chrome.runtime.lastError; resolve(r || null); });
    } catch (e) { resolve(null); }
  });

  const say = (text) => { $('nano-note').textContent = text; };

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* the old way */ }
    const field = h('textarea', { readonly: '' });
    field.value = text;
    field.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.append(field);
    field.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { /* nothing more to try */ }
    field.remove();
    return ok;
  }

  /** Open a page of Chrome: through the extension where there is one, else copy the address and say where to paste it. */
  async function open(url) {
    if (bridge) {
      const r = await ask({ type: 'open', url });
      if (r && r.ok) { say(''); return true; }
    }
    const copied = await copy(url);
    say(`Chrome does not let a website open its own pages. ${copied ? 'The address is copied' : 'Enter ' + url}: open a new tab, press ${KEY}, paste it and press Enter.`);
    return false;
  }

  function link(l) {
    if (l.kind === 'web') return h('a', { class: 'btn small', href: l.url, target: '_blank', rel: 'noopener' }, l.label);
    const b = h('button', { type: 'button', class: l.primary ? 'btn small primary' : 'btn small', title: l.url }, l.label);
    b.addEventListener('click', () => open(l.url));
    return l.note ? h('span', { class: 'flag', title: l.why || '' }, b, h('span', { class: 'muted' }, `set to “${l.note}”`)) : b;
  }

  function row(s, next) {
    const lines = s.lines && h('details', {}, h('summary', {}, 'What to read there'),
      h('dl', {}, s.lines.flatMap((x) => [h('dt', {}, x.line), h('dd', {}, `Should be ${x.want}. ${x.otherwise}`)])));
    return h('li', { class: `check s-${s.status}${next ? ' next' : ''}`, 'data-step': s.id, 'data-status': s.status },
      h('span', { class: 'mark', role: 'img', 'aria-label': WORD[s.status] || '', title: WORD[s.status] || '' }, MARK[s.status] || '?'),
      h('div', { class: 'body' },
        h('div', { class: 't' }, s.title, next ? h('span', { class: 'pill' }, 'Start here') : null),
        h('div', { class: 'd' }, s.detail),
        s.links.length ? h('div', { class: 'acts' }, s.links.map(link)) : null,
        lines));
  }

  function paint(result) {
    const v = $('nano-verdict');
    v.className = `nano-verdict tone-${result.verdict.tone}`;
    v.replaceChildren(h('strong', {}, result.verdict.title), h('span', {}, result.verdict.text));
    $('nano-steps').replaceChildren(...result.steps.map((s) => row(s, s.id === result.next)));
  }

  async function run() {
    say('Checking…');
    const hello = await ask({ type: 'hello' });
    bridge = hello && hello.ok ? hello : null;
    const fromExtension = bridge ? await ask({ type: 'nano-facts' }) : null;
    try { facts = fromExtension && fromExtension.ok && fromExtension.facts ? fromExtension.facts : await collectFacts({ where: 'page' }); } catch (e) { facts = { where: 'page' }; }
    paint(checklist(facts));
    say(bridge ? `Vianney ${bridge.version} is installed in this browser: the buttons open Chrome's pages, and the free disk space was measured.` : '');
  }

  // a link to a page of Chrome further down this page: opened by the extension where there is one (the script of the site copies the address otherwise)
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[data-copy^="chrome://"]');
    if (!a || !bridge) return;
    e.preventDefault();
    e.stopPropagation();
    open(a.getAttribute('data-copy'));
  }, true);

  $('nano-run').hidden = false;
  $('nano-copy').hidden = false;
  $('nano-run').addEventListener('click', run);
  $('nano-copy').addEventListener('click', async () => {
    if (!facts) await run();
    say((await copy(reportText(facts))) ? 'Copied: paste it into a bug report.' : 'Could not copy.');
  });
  run();
}
