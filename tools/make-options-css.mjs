// Writes assets/options-view.css: the CSS of the settings page of the extension (extension/src/options/options.css) for the parts of it that the Features
// page of the website shows as HTML (_data/options.json, made by tools/make-feature-options.py). Every rule is put under .xopt, so that it cannot touch the rest of
// the site, and only what those blocks use is kept: the classes and the elements they contain. The look is the look of the settings page because the rules are
// its own rules; nothing is written by hand here except what a static copy needs (no clicks, no hover, no space around the first and the last element).
// tests/site.test.js checks that the file is what this writes, and that every class the blocks use has a rule or is named in NO_STYLE.
// Run: node tools/make-options-css.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const SCOPE = '.xopt';
// classes of the settings page that carry state or meaning for the script only and have no rule of their own
export const NO_STYLE = new Set(['eg', 'on', 'off']);
// states of a live control: a copy that nobody can touch has none of them
const LIVE = /:(hover|focus|focus-visible|focus-within|active)\b/;

/** The class names and the element names that a piece of HTML uses. */
export function usage(html) {
  const classes = new Set();
  const tags = new Set();
  for (const m of html.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)((?:\s[^<>]*)?)>/g)) {
    tags.add(m[1].toLowerCase());
    const c = m[2].match(/\sclass="([^"]*)"/);
    if (c) for (const k of c[1].split(/\s+/).filter(Boolean)) classes.add(k);
  }
  return { classes, tags };
}

/** Splits CSS into top-level blocks {prelude, body}; comments are dropped, strings and brackets are respected. */
function blocks(css) {
  const out = [];
  let i = 0;
  const n = css.length;
  const skip = () => {
    while (i < n) {
      if (/\s/.test(css[i])) i++;
      else if (css.startsWith('/*', i)) { const e = css.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; }
      else break;
    }
  };
  const quoted = () => { const q = css[i++]; while (i < n && css[i] !== q) { if (css[i] === '\\') i++; i++; } i++; };
  for (skip(); i < n; skip()) {
    const start = i;
    let depth = 0;
    while (i < n && !(css[i] === '{' && depth === 0) && !(css[i] === ';' && depth === 0)) {
      if (css[i] === '"' || css[i] === "'") { quoted(); continue; }
      if (css.startsWith('/*', i)) { const e = css.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
      if (css[i] === '(' || css[i] === '[') depth++;
      if (css[i] === ')' || css[i] === ']') depth--;
      i++;
    }
    const prelude = css.slice(start, i).trim();
    if (css[i] === ';') { i++; continue; }              // an at-rule without a block: none are used here
    i++;                                                // {
    const from = i;
    let d = 1;
    while (i < n && d > 0) {
      if (css[i] === '"' || css[i] === "'") { quoted(); continue; }
      if (css.startsWith('/*', i)) { const e = css.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
      if (css[i] === '{') d++;
      if (css[i] === '}') d--;
      i++;
    }
    out.push({ prelude, body: css.slice(from, i - 1).trim() });
  }
  return out;
}

/** A comma list of selectors, split at the commas that are not inside brackets or strings. */
function splitList(list) {
  const out = [];
  let depth = 0;
  let cur = '';
  let q = null;
  for (const ch of list) {
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** The classes and the leading element names of a selector. */
function parts(selector) {
  const classes = [...selector.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]);
  const tags = selector.split(/[\s>+~]+/).map((c) => (c.match(/^([a-zA-Z][a-zA-Z0-9-]*)/) || [])[1]).filter(Boolean).map((t) => t.toLowerCase());
  return { classes, tags, ids: /#[A-Za-z]/.test(selector.replace(/\[[^\]]*\]/g, '')) };
}

const KEEP_FROM_BODY = /^\s*(color|font|font-synthesis|font-variant-ligatures|text-rendering|-webkit-font-smoothing)\s*:/;

/** One selector of the settings page, as a selector of the copy (null: not for the copy). */
function scopeSelector(sel, used) {
  if (sel === ':root') return SCOPE;
  if (sel === 'html' || sel === 'body' || sel === 'html, body') return null;
  if (LIVE.test(sel)) return null;
  const p = parts(sel);
  if (p.ids) return null;
  if (!p.classes.every((c) => used.classes.has(c))) return null;
  if (!p.tags.every((t) => used.tags.has(t))) return null;
  if (sel === '*') return `${SCOPE} *`;
  if (sel.startsWith('[hidden]')) return `${SCOPE} ${sel}`;
  return `${SCOPE} ${sel}`;
}

function convert(list, used) {
  const sels = splitList(list).map((s) => scopeSelector(s, used)).filter(Boolean);
  return sels.length ? sels.join(',\n') : null;
}

export function scopedCss(css, html) {
  const used = usage(html);
  const out = [];
  for (const { prelude, body } of blocks(css)) {
    if (prelude.startsWith('@font-face')) continue;                                   // the site has the face
    if (prelude.startsWith('@media')) {
      if (!/prefers-color-scheme:\s*dark/.test(prelude)) continue;                     // the layout of the page itself is not the copy's
      const inner = blocks(body).map((b) => { const s = convert(b.prelude, used); return s ? `  ${s} {\n    ${b.body}\n  }` : null; }).filter(Boolean);
      if (inner.length) out.push(`@media (prefers-color-scheme: dark) {\n${inner.join('\n')}\n}`);
      continue;
    }
    if (prelude.startsWith('@')) continue;
    if (prelude === 'body') {                                                          // the text of the page: the copy has it for itself
      const decls = body.split(/;\s*/).filter((d) => KEEP_FROM_BODY.test(d)).map((d) => `${d.trim()};`);
      out.push(`${SCOPE} { ${decls.join(' ')} }`);
      continue;
    }
    const sel = convert(prelude, used);
    if (!sel) continue;
    out.push(prelude === '*' ? `${SCOPE}, ${SCOPE} * {\n  ${body}\n}` : `${sel} {\n  ${body}\n}`);
  }
  return out.join('\n');
}

// what only a static copy needs
const STATIC = `
/* a copy that nobody can touch */
.xopt input, .xopt select, .xopt textarea, .xopt button, .xopt .rule-row { pointer-events: none; cursor: default; }
.xopt > :first-child { margin-top: 0; }
.xopt > :last-child { margin-bottom: 0; }
.xopt > .model + .model { margin-top: 8px; }                    /* the model rows of the On-device AI pane are a grid with a gap there */
/* the heading of the first group sits at the very top of its block, so the top of its box is one heading (--title-block) lower than the top of the block */
.xopt > .group-title:first-child, .xopt > .rule-group:first-child > .group-title:first-child { margin-top: 0; }
`;

/** The height of a group heading as the settings page sets it, without its top margin: its line (font size times the line height of the page) and the space under it, which is
 *  the larger of its bottom margin and the top margin of the box that follows (adjacent margins collapse). */
export function titleBlock(css) {
  const all = blocks(css);
  const title = all.find((b) => b.prelude === '.group-title');
  const body = all.find((b) => b.prelude === 'body');
  const size = Number(title.body.match(/font-size:\s*([\d.]+)px/)[1]);
  const bottom = Number(title.body.match(/margin:\s*[\d.]+px\s+[\d.]+px\s+([\d.]+)px/)[1]);
  const lineHeight = Number(body.body.match(/font:\s*[\d.]+px\/([\d.]+)/)[1]);
  const box = all.find((b) => b.prelude === '.group');
  const boxTop = Number(box.body.match(/margin:\s*([\d.]+)px/)[1]);
  return Math.round((size * lineHeight + Math.max(bottom, boxTop)) * 100) / 100;
}

export function optionsViewCss() {
  const css = readFileSync(new URL('extension/src/options/options.css', root), 'utf8');
  const options = JSON.parse(readFileSync(new URL('_data/options.json', root), 'utf8'));
  const html = Object.values(options).map((o) => o.html).join('\n');
  const head = '/* Generated by tools/make-options-css.mjs from extension/src/options/options.css and _data/options.json: do not edit by hand.\n'
    + '   The rules of the settings page for the blocks the Features page shows as HTML, each under .xopt. */\n';
  return head + scopedCss(css, html) + '\n:root { --title-block: ' + titleBlock(css) + 'px; }                      /* what stands beside a block that begins with a heading is lowered by this much */\n' + STATIC.trimStart();
}

if (import.meta.main) {
  const css = optionsViewCss();
  writeFileSync(new URL('assets/options-view.css', root), css);
  console.log(`assets/options-view.css: ${css.length.toLocaleString()} characters`);
}
