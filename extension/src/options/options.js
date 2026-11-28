// Settings page: rules with a sensitivity control each, break reminder, scope, on-device AI, images & audio, allow & block, activity, test rules.

import { loadSettings, saveSettings, loadPack, loadDefaultRulesText, mergeSettings } from '../shared/config.js';
import { SECTION_KEYS, resetKeys, allKeys } from '../shared/reset.js';
import { Engine } from '../core/engine.js';
import { parseRules, splitLine, ACTIONS } from '../core/rules.js';
import { flagAtFor, wouldChange, uncertainFloor, PRESETS } from '../core/sensitivity.js';
import { formatDuration } from '../core/breaktimer.js';
import { addToList, parseListText, videoIdFrom } from '../core/lists.js';
import { encodeWav } from '../core/audio.js';
import { CAPABILITIES, statusInfo, recommend, machineRows, median, duration, estimates, kevStatusInfo } from '../core/modelcheck.js';
import { KEV, chooseSet } from '../ai/kev-manifest.js';
import { probeGpu } from '../ai/kev-gpu.js';
import { MODEL_NAMES, countLines, runCheck, summarize, modelsSeen, describeLine, describeRule, describeTotals } from '../core/examplecheck.js';
import { censor } from '../core/censor.js';
import { normalizeTitles } from '../core/cleanup.js';
import { decodeToMono16k } from '../shared/decode.js';
import { icon } from './icons.js';
import * as ai from '../ai/prompt-backend.js';
import { checklist, reportText } from '../core/nanocheck.js';
import { collectFacts } from '../shared/nanoprobe.js';
import { TARGET } from '../shared/target.js';

const $ = (id) => document.getElementById(id);

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden') el[k] = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}

// A small (?) button that opens a popover with the explanation. Explanations live here instead of in paragraphs on the page.
let helpCount = 0;
function help(content, label = 'More information') {
  const id = 'help-' + (++helpCount);
  const body = typeof content === 'string' ? h('p', {}, content) : content;
  const pop = h('div', { id, class: 'popover', popover: 'auto' }, body);
  const btn = h('button', { class: 'help', type: 'button', 'aria-label': label, popovertarget: id }, '?');
  pop.addEventListener('beforetoggle', (e) => { if (e.newState === 'open') pop.style.visibility = 'hidden'; });
  pop.addEventListener('toggle', (e) => {
    if (e.newState !== 'open') return;
    const r = btn.getBoundingClientRect();
    const w = pop.offsetWidth;
    const hgt = pop.offsetHeight;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
    const below = r.bottom + 6 + hgt <= window.innerHeight - 8;
    pop.style.left = left + 'px';
    pop.style.top = (below ? r.bottom + 6 : Math.max(8, r.top - hgt - 6)) + 'px';
    pop.style.visibility = 'visible';
  });
  return h('span', { class: 'help-wrap' }, btn, pop);
}

let settings;
let pack;
let defaultRulesText = '';
let log = [];

async function update(mutator) {
  settings = mergeSettings(settings);
  mutator(settings);
  await saveSettings(settings);
}

const pct = (x) => Math.round(x * 100) + '%';
// How a verdict was reached (the engine's `via`).
const VIA_LABEL = { mark: "YouTube's music mark", lexicon: 'word list', 'lexicon+model': 'word list, confirmed by on-device AI', model: 'on-device AI', refusal: 'browser refusal', list: 'your list', remembered: 'remembered audio' };

// ------------------------------------------------------------------ plain words and the shape of the page
const SURFACE_NAME = {
  'feed-card': 'Lists and search results', related: 'Recommended videos', 'watch-meta': 'Video page', comment: 'Comments', subtitles: 'Subtitles',
  thumbnail: 'Thumbnails', frame: 'Video frames', audio: 'Audio',
};
// What happens when a rule flags, per surface. A popup shows what is in force: the choice of the user, or else what the rule text says.
const ACTION_LABEL = {
  hide: 'Hide', blank: 'Blank', dim: 'Dim & label', label: 'Label', blur: 'Blur', blackout: 'Black out', 'warn-overlay': 'Pause & warn',
  'mute-word': 'Mute word', 'skip-segment': 'Skip segment', 'censor-caption': 'Mask caption', 'pause-overlay': 'Pause & warn', 'mute-next': 'Mute',
};
// The order is the order on the page, as the rule author chose it (2026-11-26): lewdness and immodesty, swearing, talk about others, the religions (the most
// important part, but in the middle), and last the games and excess (gambling). The pictures and sound come after.
const RULE_GROUPS = [
  { id: 'purity', title: 'Lewdness and immodesty', icon: 'eye-off', color: 'pink' },
  { id: 'speech', title: 'Swearing and cursing', icon: 'message-square-warning', color: 'red' },
  { id: 'people', title: 'Talk about other people', icon: 'users', color: 'orange' },
  { id: 'belief', title: 'Unbelief and other religions', icon: 'book-open', color: 'blue' },
  { id: 'anticatholic', title: 'Anti-Catholicism', icon: 'church', color: 'purple' },
  { id: 'leisure', title: 'Games, shows and excess', icon: 'dices', color: 'indigo' },
  { id: 'pictures', title: 'Images (experimental)', icon: 'image', color: 'teal' },
  { id: 'sound', title: 'Audio (experimental)', icon: 'volume-2', color: 'green' },
];
const groupOf = (rule) => RULE_GROUPS.find((g) => g.id === rule.group) || { id: 'other', title: 'Other', icon: 'shield-check', color: 'grey' };

const tile = (iconName, color, cls = '') => { const t = h('span', { class: `tile ${cls} c-${color}` }); t.append(icon(iconName, cls === 'big' ? 24 : 15)); return t; };
const isEnabled = (rule) => (settings.ruleEnabled[rule.id] !== undefined ? settings.ruleEnabled[rule.id] : rule.enabled);

/** A switch (the macOS look) around a checkbox. */
function toggleSwitch(checked, onChange) {
  const input = h('input', { type: 'checkbox', checked: !!checked });
  input.addEventListener('change', () => onChange(input.checked));
  const label = h('label', { class: 'switch' }, input, h('span', { class: 'knob' }));
  label.addEventListener('click', (e) => e.stopPropagation()); // a switch inside a row that opens something
  return label;
}

// ------------------------------------------------------------------ rules
/** Highest weight any word-list entry of the rule has: the most a lexicon alone can ever reach. */
function lexiconReach(rule) {
  let reach = 0;
  for (const name of rule.lexicon) for (const e of (pack.lexicons[name] && pack.lexicons[name].entries) || []) reach = Math.max(reach, e.weight);
  return reach;
}

const MEDIA_SURFACES = ['thumbnail', 'frame', 'audio'];
const isMediaRule = (rule) => rule.where.length > 0 && rule.where.every((w) => MEDIA_SURFACES.includes(w));

/** How a rule decides at the current setting: by its word list alone, with the model, or not at all. */
function ruleMode(rule) {
  if (isMediaRule(rule)) return { id: 'exp', label: 'Experimental', text: 'Analyzes thumbnails or audio with the on-device model. Inactive until Images & Audio is on.' };
  const weights = rule.lexicon.flatMap((n) => ((pack.lexicons[n] && pack.lexicons[n].entries) || []).map((e) => e.weight));
  const flagAt = flagAtFor(rule, settings);
  const floor = uncertainFloor(flagAt, rule.band === null ? undefined : rule.band);
  if (weights.some((w) => w >= flagAt - 1e-9)) return { id: 'words', label: 'Word list', text: 'Flags from its word list alone.' };
  if (rule.asks.length && weights.some((w) => w >= floor - 1e-9)) return { id: 'ai', label: 'Needs AI', text: 'The word list raises suspicion and the on-device AI decides. Without it, nothing is flagged unless sensitivity is lowered.' };
  return { id: 'no', label: 'Never flags', text: 'Cannot flag at this sensitivity. Lower it.' };
}

const modePill = (m) => (m.id === 'words' ? null : h('span', { class: `pill ${m.id === 'exp' ? 'exp' : m.id === 'ai' ? 'ai' : 'no'}`, title: m.text }, m.label));

let ruleView = 'compact';
let searchQuery = '';

const ruleText = (r) => [r.name, r.title, r.plain, groupOf(r).title, ...r.examples].join(' ').toLowerCase();
/** The words of a search, each cut by one letter when it is long, so that "gamble" finds "gambling" and "dances" finds "dance". */
const searchTerms = (q) => q.toLowerCase().split(/\s+/).filter(Boolean).map((w) => (w.length >= 5 ? w.slice(0, -1) : w));
const ruleMatches = (r, q) => !q || searchTerms(q).every((w) => ruleText(r).includes(w));

/** Put a <mark> around the searched words. */
function hl(text) {
  const words = searchTerms(searchQuery).filter((w) => w.length > 1);
  if (!words.length) return text;
  const re = new RegExp('(' + words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig');
  return text.split(re).map((part, i) => (i % 2 ? h('mark', {}, part) : part));
}

function ruleRow(rule) {
  const g = groupOf(rule);
  const on = isEnabled(rule);
  const mode = ruleMode(rule);
  const sw = toggleSwitch(on, async (checked) => {
    await update((s) => { s.ruleEnabled[rule.id] = checked; });
    row.classList.toggle('off', !checked);
    updateStatus();
  });
  const chev = h('span', { class: 'chev' }); chev.append(icon('chevron-right', 16));
  const row = h('div', { class: 'row rule-row' + (on ? '' : ' off'), 'data-rule': rule.id, role: 'link', tabindex: '0', title: rule.title },
    tile(g.icon, g.color),
    h('div', { class: 'label' },
      h('div', { class: 'title' }, hl(rule.name), modePill(mode)),
      rule.examples.length ? h('div', { class: 'eg' }, `Example: “${censor(rule.examples[0])}”`) : null),
    h('div', { class: 'control' }, sw, chev));
  const open = () => { location.hash = '#rules/' + rule.id; };
  row.addEventListener('click', open);
  row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  return row;
}

function renderRules() {
  const list = $('rule-list');
  list.textContent = '';
  list.classList.toggle('show-examples', ruleView === 'examples');
  let shown = 0;
  const known = new Set(RULE_GROUPS.map((g) => g.id));
  const buckets = [...RULE_GROUPS, { id: 'other', title: 'Other', icon: 'shield-check', color: 'grey' }];
  for (const g of buckets) {
    const rules = pack.parsed.rules.filter((r) => (known.has(r.group) ? r.group : 'other') === g.id && ruleMatches(r, searchQuery));
    if (!rules.length) continue;
    shown += rules.length;
    list.append(h('div', { class: 'rule-group' }, h('div', { class: 'group-title' }, g.title), h('div', { class: 'group' }, rules.map(ruleRow))));
  }
  if (!shown) list.append(h('div', { class: 'no-match' }, searchQuery ? `No rule matches “${searchQuery}”.` : 'There are no rules.'));
  updateStatus();
}

function updateStatus() {
  const total = pack.parsed.rules.length;
  // a picture or sound rule only does something while the experimental check is on
  const on = pack.parsed.rules.filter((r) => isEnabled(r) && (!isMediaRule(r) || settings.media.enabled)).length;
  const waiting = pack.parsed.rules.filter((r) => isEnabled(r) && isMediaRule(r) && !settings.media.enabled).length;
  const count = document.querySelector('#nav [data-pane="rules"] .count');
  if (count) count.textContent = String(on);
  const sum = $('rules-summary');
  sum.textContent = `${on} of ${total} on`;
  if (waiting) sum.append(help(`${waiting} image or audio rule${waiting > 1 ? 's are' : ' is'} enabled but inactive until Images & Audio is on.`, 'About inactive rules'));
  document.getElementById('nav').classList.toggle('is-off', !settings.enabled);
}

function actionControls(rule) {
  const wrap = h('div', { class: 'acts-row' });
  const own = () => (settings.actions && settings.actions[rule.id]) || {};
  const picks = [];
  for (const surface of rule.where) {
    if (!ACTIONS[surface]) continue;
    const fallback = rule.action[surface];     // what the rule text says; a popup that says nothing else shows it
    const choices = ACTIONS[surface].includes(fallback) ? ACTIONS[surface] : [fallback, ...ACTIONS[surface]];
    const sel = h('select', { 'aria-label': `Action: ${SURFACE_NAME[surface]}` }, choices.map((a) => h('option', { value: a }, ACTION_LABEL[a] || a)));
    sel.value = own()[surface] || fallback;
    sel.addEventListener('change', async () => {
      await update((s) => {
        s.actions = s.actions || {};
        const mine = { ...(s.actions[rule.id] || {}) };
        if (sel.value === fallback) delete mine[surface]; else mine[surface] = sel.value;   // the rule's own action is not a choice of the user's
        if (Object.keys(mine).length) s.actions[rule.id] = mine; else delete s.actions[rule.id];
      });
      refresh();
    });
    picks.push([sel, fallback]);
    wrap.append(h('div', { class: 'line' }, h('span', {}, SURFACE_NAME[surface]), sel));
  }
  const reset = h('button', {
    type: 'button', class: 'small', title: 'Put what this rule does back to what the rule says',
    onclick: async () => {
      await update((s) => { if (s.actions) delete s.actions[rule.id]; });
      for (const [sel, fallback] of picks) sel.value = fallback;
      refresh();
    },
  }, 'Reset to defaults');
  const refresh = () => { reset.disabled = !Object.keys(own()).length; };
  refresh();
  wrap.append(h('div', { class: 'line reset' }, reset));
  return wrap;
}

function sensitivityControl(rule, card, onReset) {
  const preview = h('p', { class: 'preview' });
  const reachNote = h('p', { class: 'reach' });
  const blocked = h('span', { class: 'pill no', hidden: true }, 'Never flags');
  const showReach = (candidate) => {
    let text = '';
    if (isMediaRule(rule)) {
      // the model gives no probability: a score is the share of prompt wordings that said yes
      const v = Math.min(3, Math.max(1, Number(settings.media.votes) || 2));
      const needed = Array.from({ length: v }, (_, i) => i + 1).find((k) => k / v >= candidate - 1e-9);
      text = needed
        ? `Flags when ${needed} of ${v} prompt${v > 1 ? 's' : ''} say yes. Needs Images & Audio to be on.`
        : 'Never flags at this sensitivity.';
      reachNote.textContent = text;
      blocked.hidden = !!needed;
      return;
    }
    const reach = lexiconReach(rule);
    if (!rule.lexicon.length) text = 'No word list: needs the on-device AI.';
    else if (reach < candidate - 1e-9) text = `The word list reaches ${pct(reach)}. Lower the sensitivity or use the on-device AI.`;
    reachNote.textContent = text;
    blocked.hidden = !(rule.lexicon.length && reach < candidate - 1e-9 && !rule.asks.length);
  };
  const wrap = h('div', { class: 'sens' });
  const presets = h('div', { class: 'presets' });
  const saved = () => flagAtFor(rule, settings);
  let resetBtn = null;
  const refreshReset = () => { if (resetBtn) resetBtn.disabled = settings.sensitivity[rule.id] === undefined; };
  const showPreview = (candidate) => {
    const w = wouldChange(log, rule.id, saved(), candidate);
    preview.textContent = !w.considered
      ? 'No activity for this rule yet.'
      : `Of ${w.considered} logged items for this rule, ${w.more} more and ${w.fewer} fewer would be flagged.`;
  };
  const info = help(h('div', {}, h('p', {}, 'Minimum confidence needed to flag. Lower values flag more, including wrong matches.'), reachNote, preview), 'About this setting');

  if (rule.levels) {
    const sel = h('select', {}, rule.levels.map((l) => h('option', { value: l }, `${l[0].toUpperCase()}${l.slice(1)} or above`)));
    sel.value = rule.levels[Math.round(saved() * (rule.levels.length - 1))];
    const at = () => rule.levels.indexOf(sel.value) / (rule.levels.length - 1);
    sel.addEventListener('change', async () => { showPreview(at()); showReach(at()); await update((s) => { s.sensitivity[rule.id] = sel.value; }); refreshReset(); });
    sel.addEventListener('input', () => { showPreview(at()); showReach(at()); });
    wrap.append(sel, info, blocked);
  } else {
    const range = h('input', { type: 'range', min: 0, max: 100, step: 5, 'aria-label': 'Sensitivity' });
    range.value = Math.round(saved() * 100);
    const out = h('output', {});
    const label = () => { out.textContent = `${range.value}%`; };
    label();
    range.addEventListener('input', () => { label(); showPreview(Number(range.value) / 100); showReach(Number(range.value) / 100); });
    range.addEventListener('change', async () => { await update((s) => { s.sensitivity[rule.id] = Number(range.value) / 100; }); showPreview(saved()); refreshReset(); });
    const preset = (name, text) => h('button', {
      class: 'small', title: `${text}: ${pct(PRESETS[name])}`,
      onclick: async () => { range.value = Math.round(PRESETS[name] * 100); label(); await update((s) => { s.sensitivity[rule.id] = PRESETS[name]; }); showPreview(saved()); showReach(saved()); refreshReset(); },
    }, text);
    wrap.append(range, out, info, blocked);
    presets.append(preset('strict', 'Strict'), preset('balanced', 'Balanced'), preset('lenient', 'Lenient'));
  }
  resetBtn = h('button', {
    type: 'button', class: 'small', title: `Default: ${rule.levels ? rule.flagAtLabel : pct(rule.flagAt)}`,
    onclick: async () => { await update((s) => { delete s.sensitivity[rule.id]; }); if (onReset) onReset(); },
  }, 'Reset to defaults');
  refreshReset();
  presets.append(resetBtn);
  wrap.append(presets);
  card.append(wrap);
  showPreview(saved());
  showReach(saved());
}

/** One rule on a page of its own: what it does, examples, sensitivity, actions. */
function renderRuleDetail(id) {
  const box = $('rule-detail');
  box.textContent = '';
  const rule = pack.parsed.rules.find((r) => r.id === id);
  if (!rule) { box.append(h('p', { class: 'muted' }, 'Rule not found.'), h('a', { href: '#rules' }, 'Rules')); return; }
  const g = groupOf(rule);
  const mode = ruleMode(rule);
  const again = () => renderRuleDetail(id);
  const sw = toggleSwitch(isEnabled(rule), async (checked) => { await update((s) => { s.ruleEnabled[rule.id] = checked; }); updateStatus(); });
  const back = h('a', { class: 'back-link', href: '#rules' }); back.append(icon('chevron-left', 16), 'Rules');
  const about = h('dl', {},
    h('dt', {}, 'Applies to'), h('dd', {}, rule.where.map((w) => SURFACE_NAME[w]).join(', ')),
    h('dt', {}, 'Method'), h('dd', {}, mode.text),
    rule.title !== rule.name ? [h('dt', {}, 'Original title'), h('dd', {}, rule.title)] : null,
    rule.source ? [h('dt', {}, 'Source'), h('dd', {}, rule.source)] : null);
  box.append(back, h('div', { class: 'detail-head' }, tile(g.icon, g.color, 'big'),
    h('div', {}, h('h2', {}, rule.name, modePill(mode), help(about, 'About this rule')), h('div', { class: 'sub' }, rule.plain)), sw));

  // examples: for text rules they are run through the real rules, so the tag says what would flag them at this sensitivity
  box.append(h('div', { class: 'group-title' }, 'Examples', help(isMediaRule(rule)
    ? 'These describe an image or an audio clip.'
    : 'Titles marked ✓ are flagged. The others look similar but are not.')));
  const engine = new Engine({ rules: pack.parsed.rules, lexicons: pack.lexicons, settings, backend: null });
  const lineText = (line) => { const { title, channel } = splitLine(line); return channel ? `“${censor(title)}” on ${channel}` : `“${censor(title)}”`; };
  const tagFor = (line) => {
    if (isMediaRule(rule)) return null;
    const item = splitLine(line);
    const stage = engine.lexiconStage(rule, engine.textFor(item, 'feed-card'), item.channel);
    if (stage.pLex >= stage.flagAt - 1e-9) return h('span', { class: 'pill tag' }, 'Word list');
    if (stage.needsModel) return h('span', { class: 'pill ai tag', title: 'The word list finds a cue and the on-device AI decides.' }, 'Needs AI');
    return h('span', { class: 'pill no tag', title: 'The word list does not reach the current sensitivity.' }, 'Below sensitivity');
  };
  const eg = h('div', { class: 'group eg-list' });
  for (const t of rule.examples) eg.append(h('div', { class: 'row ok' }, h('span', { class: 'mark' }, '✓'), h('span', { class: 'text' }, lineText(t)), tagFor(t)));
  for (const t of rule.spared) eg.append(h('div', { class: 'row skip' }, h('span', { class: 'mark' }, '–'), h('span', { class: 'text' }, lineText(t)), h('span', { class: 'pill tag' }, 'Not flagged')));
  box.append(eg);

  box.append(h('div', { class: 'group-title' }, 'Sensitivity (confidence)'));
  const sens = h('div', { class: 'row stack' });
  sensitivityControl(rule, sens, again);
  box.append(h('div', { class: 'group' }, sens));

  box.append(h('div', { class: 'group-title' }, 'Actions'));
  box.append(h('div', { class: 'group' }, h('div', { class: 'row stack' }, actionControls(rule))));

  const det = h('details', { class: 'advanced' }, h('summary', {}, 'Technical details'));
  const kv = h('dl', { class: 'kv' });
  const add = (k, v) => { if (v) kv.append(h('dt', {}, k), h('dd', {}, v)); };
  add('Word lists', rule.lexicon.join(', '));
  add('Rule ID', rule.id);
  if (rule.spareChannel) add('Catholic channels', 'A card from a channel with a Catholic name (Apostolic, Carmel, ...) is not flagged by the word list alone: the on-device AI decides.');
  if (rule.confirm === 'model') add('Model confirms', 'A strong word-list hit is checked by the on-device AI when there is one; a clear no overrules it (it is for what must not flag a warning against the same thing).');
  rule.asks.forEach((a) => add(a.type === 'noul' ? 'Model question' : 'Model scale', a.question + (a.levels ? ` (${a.levels.join(', ')})` : '')));
  if (isMediaRule(rule) && rule.refusal === 'flag') add('Refusals', 'A browser safety refusal counts as a flag.');
  det.append(kv);
  box.append(det);
}

function renderProblems() {
  const box = $('problems');
  if (!pack.problems.length) { box.hidden = true; return; }
  box.hidden = false;
  box.textContent = '';
  box.append(h('strong', {}, 'Problems in rule or word-list files:'), h('ul', {}, pack.problems.map((p) => h('li', {}, `${p.where}${p.line ? ' line ' + p.line : ''}: ${p.message}`))));
}

function renderLexicons() {
  const parts = Object.entries(pack.lexicons).map(([n, l]) => `${n} (${l.entries.length} entries)`);
  $('lexicons').textContent = parts.length ? `Word lists: ${parts.join(', ')}` : '';
}

function bindEditor() {
  const ta = $('rules-text');
  const msg = $('rules-messages');
  ta.value = pack.rulesText;
  const say = (cls, text) => { msg.textContent = ''; msg.append(h('div', { class: cls }, text)); };
  const check = () => {
    const r = parseRules(ta.value);
    if (r.errors.length) { msg.textContent = ''; r.errors.forEach((e) => msg.append(h('div', { class: 'err' }, `line ${e.line}: ${e.message}`))); return false; }
    say('ok', `Valid: ${r.rules.length} rules.`);
    return true;
  };
  $('rules-validate').addEventListener('click', check);
  $('rules-save').addEventListener('click', async () => {
    if (!check()) return;
    await update((s) => { s.rulesText = ta.value === defaultRulesText ? null : ta.value; });
    pack = await loadPack(settings);
    renderRules(); renderProblems(); renderLexicons();
    say('ok', 'Saved.');
  });
  $('rules-reset').addEventListener('click', async () => {
    await update((s) => { s.rulesText = null; });
    pack = await loadPack(settings);
    ta.value = pack.rulesText;
    renderRules(); renderProblems(); renderLexicons();
    say('ok', 'Reset to defaults.');
  });
}

// ------------------------------------------------------------------ reset to defaults
// Per section, at the end of its pane, and for everything, at the foot of the sidebar. Where a reset would lose something the user typed, a first click asks
// (in the page: a dialog would not do, the page is also driven by tests) and a second one does it. The page is loaded again afterwards, so that every
// control shows what is stored; the note on the toolbar says that it happened.
const NOTE_KEY = 'vianney-settings-note';

function resetControl({ keys, warn = '', label = 'Reset to defaults', note = 'Reset to defaults.', small = false }) {
  const box = h('div', { class: 'reset-row' });
  const run = async () => {
    await update((s) => { Object.assign(s, resetKeys(s, keys)); });
    try { sessionStorage.setItem(NOTE_KEY, note); } catch (e) { /* the note is a nicety */ }
    location.reload();
  };
  const button = (text, onclick, cls = '') => h('button', { type: 'button', class: [small ? 'small' : '', cls].filter(Boolean).join(' '), onclick }, text);
  const idle = () => { box.textContent = ''; box.append(button(label, warn ? ask : run)); };
  const ask = () => { box.textContent = ''; box.append(h('p', {}, warn), button('Reset', run, 'danger'), button('Cancel', idle)); };
  idle();
  return box;
}

// what each section says it puts back, and whether it asks first
const PANE_RESETS = {
  rules: { keys: SECTION_KEYS.rules, note: 'The rules are back to their defaults.', warn: 'Every rule goes back to what it was at installation: which are on, how sure each must be, what each does, and the rule text.' },
  break: { keys: SECTION_KEYS.break, note: 'The break reminder is back to its defaults.' },
  subtitles: { keys: SECTION_KEYS.subtitles, note: 'Scope is back to its defaults.' },
  cleanup: { keys: SECTION_KEYS.cleanup, note: 'Clean up is back to its defaults.' },
  ai: { keys: SECTION_KEYS.ai, note: 'On-device AI is back to its defaults.' },
  media: { keys: SECTION_KEYS.media, note: 'Images & Audio is back to its defaults.' },
  lists: { keys: SECTION_KEYS.lists, note: 'The lists are empty again.', warn: 'This empties the allow and block lists.' },
};

function buildResets() {
  for (const [id, spec] of Object.entries(PANE_RESETS)) $(id).append(resetControl(spec));
  $('nav').after(h('div', { class: 'sidebar-foot' }, resetControl({
    keys: allKeys(), small: true, label: 'Reset all settings', note: 'All settings are back to their defaults.',
    warn: 'Every setting goes back to what it was at installation: the switches, the rules, the lists. The activity log and downloaded models stay.',
  })));
  try {
    const note = sessionStorage.getItem(NOTE_KEY);
    if (note) {
      sessionStorage.removeItem(NOTE_KEY);
      const el = $('toolbar-note');
      el.textContent = note;
      setTimeout(() => { el.textContent = ''; }, 6000);
    }
  } catch (e) { /* no session storage: no note */ }
}

// ------------------------------------------------------------------ general, break, subtitles
function bindGeneral() {
  const en = $('enabled');
  en.checked = settings.enabled;
  en.addEventListener('change', async () => { await update((s) => { s.enabled = en.checked; }); updateStatus(); });
}

function bindBreak() {
  const map = [
    ['brk-enabled', 'enabled', 'checkbox'], ['brk-after', 'afterMinutes', 'number'], ['brk-snooze', 'snoozeMinutes', 'number'],
    ['brk-period', 'period', 'select'], ['brk-gap', 'sessionGapMinutes', 'number'], ['brk-card', 'showCard', 'checkbox'],
    ['brk-comment', 'showComment', 'checkbox'], ['brk-message', 'message', 'text'],
  ];
  for (const [id, key, kind] of map) {
    const el = $(id);
    if (kind === 'checkbox') el.checked = !!settings.brk[key]; else el.value = settings.brk[key];
    el.addEventListener('change', () => {
      let v = kind === 'checkbox' ? el.checked : el.value;
      if (kind === 'number') { v = Math.max(1, Number(v) || 1); el.value = v; }
      return update((s) => { s.brk[key] = v; });
    });
  }
  $('brk-test').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'break-test' }));
  $('brk-reset').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'break-reset' }));
  renderBreakStatus();
}

async function renderBreakStatus() {
  const { breakState } = await chrome.storage.local.get('breakState');
  const el = $('brk-status');
  if (!breakState) { el.textContent = 'No watch time yet.'; return; }
  el.textContent = `Watch time this ${settings.brk.period === 'day' ? 'day' : 'session'}: ${formatDuration(breakState.accumSeconds)} · next reminder at ${formatDuration(breakState.nextDueSeconds)}`;
}

const CAPTION_TEXT = {
  requested: 'captions requested, waiting for text.',
  loaded: 'captions loaded.',
  empty: 'the caption request returned no text, so nothing was filtered.',
  unreadable: 'the caption text could not be read.',
  unavailable: 'no captions available.',
};

async function renderCaptionDiag() {
  const { captionDiag } = await chrome.storage.local.get('captionDiag');
  const el = $('sub-diag');
  if (!captionDiag) { el.textContent = 'No caption activity yet.'; return; }
  const when = new Date(captionDiag.t).toLocaleTimeString();
  const what = captionDiag.status === 'loaded'
    ? `${CAPTION_TEXT.loaded} ${captionDiag.words} words${captionDiag.lang ? ' (' + captionDiag.lang + (captionDiag.kind ? ', ' + captionDiag.kind : '') + ')' : ''}, ${captionDiag.flagged} flagged.`
    : CAPTION_TEXT[captionDiag.status] || captionDiag.status;
  el.textContent = `Last video (${when}${captionDiag.title ? ', “' + captionDiag.title.slice(0, 60) + '”' : ''}): ${what}`;
}

function bindSubtitles() {
  renderCaptionDiag();
  const checks = [['sub-feed', ['surfaces', 'feed']], ['sub-related', ['surfaces', 'related']], ['sub-meta', ['surfaces', 'watchMeta']], ['sub-comments', ['surfaces', 'comments']], ['sub-subs', ['surfaces', 'subtitles']], ['sub-auto', ['subtitles', 'autoCaptions']], ['sub-mask', ['subtitles', 'maskVisible']]];
  for (const [id, [a, b]] of checks) {
    const el = $(id);
    el.checked = settings[a][b] !== false;
    el.addEventListener('change', () => update((s) => { s[a][b] = el.checked; }));
  }
  for (const [id, key] of [['sub-pre', 'mutePre'], ['sub-post', 'mutePost']]) {
    const el = $(id);
    el.value = settings.subtitles[key];
    el.addEventListener('change', () => update((s) => { s.subtitles[key] = Math.min(1, Math.max(0, Number(el.value) || 0)); }));
  }
}

// ------------------------------------------------------------------ clean up
function bindCleanup() {
  for (const key of ['shorts', 'shortsAsVideos', 'games', 'movies', 'explore', 'more', 'banners', 'music']) {
    const el = $('cl-' + key);
    el.checked = key === 'music' ? settings.cleanup.music === true : settings.cleanup[key] !== false;     // music is the one that is off until it is switched on
    el.addEventListener('change', () => update((s) => { s.cleanup[key] = el.checked; }));
  }
  const ta = $('cl-titles');
  ta.value = (settings.cleanup.shelfTitles || []).join('\n');
  ta.addEventListener('change', async () => {
    const titles = normalizeTitles(ta.value);
    await update((s) => { s.cleanup.shelfTitles = titles; });
    ta.value = titles.join('\n');
  });
}

// ------------------------------------------------------------------ on-device AI: model check, downloads, timings
let modelStatus = {};
const modelNotes = {}; // a message per row (a failed download): rows are drawn again after every check, so it is kept here

async function collectMachine() {
  const f = { userAgent: navigator.userAgent, cores: navigator.hardwareConcurrency, memoryGB: navigator.deviceMemory, gpu: null };
  try {
    if (navigator.gpu) {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        const info = adapter.info || (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : null);
        f.gpu = { ...(info ? { vendor: info.vendor, architecture: info.architecture, description: info.description } : {}), f16: adapter.features.has('shader-f16') };
      }
    }
  } catch (e) { /* no graphics adapter for pages */ }
  try { const est = await navigator.storage.estimate(); f.quotaBytes = est.quota; f.usageBytes = est.usage; } catch (e) { /* ignore */ }
  return f;
}

// ---- the model rows: Kev-0.6B first (the local model), then Chrome's own model, one row per kind of input
const kevUi = { gpu: null, stored: null, job: null, runtime: null, unsupported: false, confirmDelete: false, note: '', view: null, poll: null };

/** What the Kev row shows now, from what is known about the model. */
const kevInfo = () => kevStatusInfo({ gpu: kevUi.gpu, stored: kevUi.stored, job: kevUi.job, runtime: kevUi.runtime, unsupported: kevUi.unsupported, confirmDelete: kevUi.confirmDelete, note: kevUi.note });

/** Ask the service worker (and, through it, the offscreen document) what is stored and what is running. */
async function kevFetch() {
  kevUi.gpu = await probeGpu();
  try {
    const r = await chrome.runtime.sendMessage({ type: 'kev-status', preferSet: chooseSet(kevUi.gpu).set });
    if (r && r.stored !== undefined) { kevUi.stored = r.stored; kevUi.job = r.job; kevUi.runtime = r.runtime; kevUi.unsupported = !!r.unsupported; }
  } catch (e) { /* the worker is asleep or reloading: the next check asks again */ }
  clearTimeout(kevUi.poll);
  const phase = kevUi.job && kevUi.job.phase;
  if (phase === 'downloading' || phase === 'checking') kevUi.poll = setTimeout(() => kevRefresh(), 5000);   // a safety net: the progress itself arrives by message
}

async function kevRefresh() {
  await kevFetch();
  paintKev();
  renderAdvice();
}

const kevSend = (type, extra = {}) => chrome.runtime.sendMessage({ type, ...extra }).catch((e) => ({ ok: false, error: String((e && e.message) || e) }));

async function kevDownload() {
  // Chrome grants a permission only in answer to a click: this request is the first thing that happens, before anything is awaited.
  // (A test build with the debug switch on may download from a local server instead: it asks for that server's address, which the test copy of the manifest names.)
  const mirror = settings.debug && settings.kevMirror ? String(settings.kevMirror) : null;
  const origins = mirror ? [`${new URL(mirror).origin}/*`] : KEV.hostPermissions;
  const asked = chrome.permissions.request({ origins });
  kevUi.note = '';
  let granted = false;
  try { granted = await asked; } catch (e) {
    // an address that the manifest already grants as a required one is not "optional": the request is refused as such, the permission is there all the same
    try { granted = await chrome.permissions.contains({ origins }); } catch (e2) { /* keep the first reason */ }
    if (!granted) kevUi.note = `Could not ask for permission: ${(e && e.message) || e}`;
  }
  if (!granted) {
    kevUi.note = kevUi.note || 'Kev-0.6B is downloaded from huggingface.co. Without that permission nothing was downloaded.';
    paintKev();
    return;
  }
  const set = kevInfo().set;
  const r = await kevSend('kev-download', { set, base: mirror });
  if (!r || r.ok === false || r.error) kevUi.note = `The download could not start: ${(r && r.error) || 'no answer'}`;
  await kevRefresh();
}

async function kevAct(id) {
  if (id === 'download' || id === 'retry') return kevDownload();
  if (id === 'pause') await kevSend('kev-pause');
  else if (id === 'cancel') await kevSend('kev-cancel');
  else if (id === 'delete') { kevUi.confirmDelete = true; return paintKev(true); }
  else if (id === 'delete-no') { kevUi.confirmDelete = false; return paintKev(true); }
  else if (id === 'delete-yes') { kevUi.confirmDelete = false; const r = await kevSend('kev-delete'); if (r && r.error) kevUi.note = `Could not delete: ${r.error}`; kevUi.job = null; kevUi.runtime = null; }
  await kevRefresh();
}

function kevButtons(info) {
  return info.buttons.map((b) => {
    const el = h('button', { class: b.primary ? 'primary' : '', type: 'button', 'data-act': b.id }, b.text);
    el.addEventListener('click', () => kevAct(b.id));
    return el;
  });
}

/** The row of the local model. It is drawn once per state; while a download runs only its bar and its numbers change, so that a click never lands on a button that was just replaced. */
function paintKev(force = false) {
  const box = $('ai-models');
  if (!box) return;
  const info = kevInfo();
  const key = JSON.stringify([info.id, info.tone, info.buttons, info.title, info.label, info.detail, info.note, !!info.progress]);
  const v = kevUi.view;
  if (!force && v && v.key === key && box.contains(v.article)) {
    v.bar.value = info.progress ? info.progress.fraction : 0;
    v.progressText.textContent = info.progress ? info.progress.text : '';
    return;
  }
  const bar = h('progress', { max: 1, value: info.progress ? info.progress.fraction : 0, hidden: !info.progress });
  const progressText = h('span', { class: 'progress-text' }, info.progress ? info.progress.text : '');
  const article = h('article', { class: `model tone-${info.tone}`, 'data-model': 'kev', 'data-state': info.id },
    h('div', { class: 'head' }, h('strong', {}, info.title), h('span', { class: 'pill-state' }, info.label), help(info.explain, `About ${info.title}`)),
    h('p', { class: 'lede' }, info.lede),
    h('p', { class: 'facts' }, info.detail ? `${info.facts} Runs as: ${info.detail}.` : info.facts),
    h('div', { class: 'btn-row' }, ...kevButtons(info), info.progress ? bar : null, info.progress ? progressText : null),
    h('p', { class: 'note' }, info.note),
  );
  if (v && box.contains(v.article)) v.article.replaceWith(article); else box.prepend(article);
  kevUi.view = { key, article, bar, progressText };
}

function onKevMessage(m) {
  if (!m || m.type !== 'kev-progress') return;       // other messages are not for this listener, and it answers none of them
  kevUi.job = m.job;
  kevUi.runtime = m.runtime;
  const phase = m.job && m.job.phase;
  if (m.job && (m.job.finished || phase === 'idle' || phase === 'paused' || phase === 'error')) { kevRefresh(); return; }   // the files on disk changed
  paintKev();
}

function renderModels() {
  const box = $('ai-models');
  box.textContent = '';
  kevUi.view = null;
  paintKev(true);
  for (const cap of TARGET.nano ? CAPABILITIES : []) {     // Chrome's own model: only Google Chrome has it
    const info = statusInfo(modelStatus[cap.id], cap.id);
    const bar = h('progress', { max: 1, value: 0, hidden: true });
    const note = h('p', { class: 'note' }, modelNotes[cap.id] || '');
    const button = info.canDownload ? h('button', { class: 'primary' }, cap.download) : null;
    if (button) {
      // No confirm() dialog first: Chrome lets a download start only while the click's user activation is fresh, and a dialog
      // that the user reads for a few seconds can use it up. The size and the disk requirement are in the (?) beside the status.
      button.addEventListener('click', async () => {
        button.disabled = true;
        bar.hidden = false;
        delete modelNotes[cap.id];
        note.textContent = '';
        try {
          if (cap.id === 'text') await ai.downloadAndPrepare((f) => { bar.value = f; });
          else await ai.prepareMedia(cap.id, (f) => { bar.value = f; });
        } catch (e) {
          modelNotes[cap.id] = `Download failed: ${(e && e.name) || e}${e && e.message ? ' (' + e.message + ')' : ''}. Try again.`;
        }
        bar.hidden = true;
        chrome.runtime.sendMessage({ type: 'ai-status', force: true }).catch(() => {});
        chrome.runtime.sendMessage({ type: 'media-status', force: true }).catch(() => {});
        await runModelCheck();
      });
    }
    box.append(h('article', { class: `model tone-${info.tone}`, 'data-model': cap.id },
      h('div', { class: 'head' }, h('strong', {}, cap.title), h('span', { class: 'pill-state' }, info.label), help(`${cap.used} ${info.explain}`, `About ${cap.title}`)),
      h('p', { class: 'lede' }, cap.lede),
      h('div', { class: 'btn-row' }, button, bar),
      note,
    ));
  }
}

function renderAdvice() {
  const box = $('ai-advice');
  box.textContent = '';
  const items = recommend({ ...modelStatus, kev: kevInfo().id });
  if (!items.length) return;
  const first = h('p', { class: `tone-${items[0].tone}` }, items[0].text);
  if (items.length > 1) first.append(help(h('div', {}, items.map((r) => h('p', {}, r.text))), 'More advice'));
  box.append(first);
}

async function renderMachine() {
  const dl = $('ai-machine');
  dl.textContent = '';
  for (const row of machineRows(await collectMachine())) {
    dl.append(h('dt', {}, row.label), h('dd', {}, row.value, h('span', { class: 'note' }, row.note)));
  }
}

async function runModelCheck() {
  $('ai-status').textContent = 'Checking…';
  const [text, image, audio] = await Promise.all([ai.getAvailability(), ai.getMediaAvailability('image'), ai.getMediaAvailability('audio'), kevFetch()]);
  modelStatus = { text, image, audio };
  renderModels();
  renderAdvice();
  await renderMachine();
  await runNanoCheck();
  $('ai-status').textContent = '';
}

// ------------------------------------------------------------------ set up Gemini Nano: a checklist (core/nanocheck.js)
// The checks run here, in the extension: what the browser is, what Chrome's model interface answers, the reason that Chrome itself gives when the model cannot
// be started, the free disk space of the profile. What a page cannot read is not guessed: the step names the page of Chrome and the line on it, and a button
// opens it. (A page of the website cannot open chrome:// addresses; an extension can.)
const NANO_MARK = { ok: '✓', fail: '✕', warn: '!', todo: '→', busy: '…', info: 'i', unknown: '?' };
const NANO_WORD = { ok: 'Done', fail: 'Problem', warn: 'Check', todo: 'To do', busy: 'Wait', info: 'For your information', unknown: 'Not known' };
let nanoFacts = null;
let nanoShown = false;     // the section is opened by the first result, and then left as the reader keeps it

/** Open a page of Chrome in a new tab. Where the browser refuses, the address is copied: it can still be pasted into the address bar. */
async function openChromePage(url) {
  const note = $('nano-note');
  try {
    await chrome.tabs.create({ url });
    note.textContent = '';
  } catch (e) {
    try { await navigator.clipboard.writeText(url); note.textContent = `This browser would not open it. The address is copied: paste it into the address bar.`; }
    catch (e2) { note.textContent = `This browser would not open it. Enter ${url} in the address bar.`; }
  }
}

function nanoLink(l) {
  if (l.kind === 'web') return h('a', { class: 'btn-link', href: l.url, target: '_blank', rel: 'noopener' }, l.label);
  const button = h('button', { type: 'button', class: l.primary ? 'small primary' : 'small', title: l.url }, l.label);
  button.addEventListener('click', () => openChromePage(l.url));
  return l.note ? h('span', { class: 'flag', title: l.why || '' }, button, h('span', { class: 'muted' }, `set to “${l.note}”`)) : button;
}

function nanoRow(s, next) {
  const lines = s.lines && h('details', {}, h('summary', {}, 'What to read there'),
    h('dl', {}, s.lines.flatMap((x) => [h('dt', {}, x.line), h('dd', {}, `Should be ${x.want}. ${x.otherwise}`)])));
  return h('li', { class: `check s-${s.status}${next ? ' next' : ''}`, 'data-step': s.id, 'data-status': s.status },
    h('span', { class: 'mark', title: NANO_WORD[s.status] || '', role: 'img', 'aria-label': NANO_WORD[s.status] || '' }, NANO_MARK[s.status] || '?'),
    h('div', { class: 'body' },
      h('div', { class: 't' }, s.title, next ? h('span', { class: 'pill start' }, 'Start here') : null),
      h('div', { class: 'd' }, s.detail),
      s.links.length ? h('div', { class: 'acts' }, s.links.map(nanoLink)) : null,
      lines));
}

function paintNano(result) {
  const v = $('nano-verdict');
  v.className = `nano-verdict tone-${result.verdict.tone}`;
  v.replaceChildren(h('strong', {}, result.verdict.title), h('span', {}, result.verdict.text));
  $('nano-steps').replaceChildren(...result.steps.map((s) => nanoRow(s, s.id === result.next)));
  if (!nanoShown) { nanoShown = true; $('nano').open = result.verdict.tone !== 'ok'; }
}

async function runNanoCheck() {
  if (!TARGET.nano) return;
  $('nano-note').textContent = 'Checking…';
  try { nanoFacts = await collectFacts({ where: 'extension' }); } catch (e) { nanoFacts = { where: 'extension' }; }
  paintNano(checklist(nanoFacts));
  $('nano-note').textContent = '';
}

function bindNano() {
  if (!TARGET.nano) { $('nano').hidden = true; return; }      // a browser that cannot have Chrome's model has nothing to set up
  $('nano-run').addEventListener('click', runNanoCheck);
  $('nano-copy').addEventListener('click', async () => {
    const note = $('nano-note');
    if (!nanoFacts) await runNanoCheck();
    try { await navigator.clipboard.writeText(reportText(nanoFacts)); note.textContent = 'Copied: paste it into a bug report.'; }
    catch (e) { note.textContent = 'Could not copy.'; }
    setTimeout(() => { if (note.textContent.startsWith('Copied') || note.textContent.startsWith('Could not copy')) note.textContent = ''; }, 3500);
  });
}

// ------------------------------------------------------------------ check on the rule examples
let examplesCtl = null; // the AbortController of a check that is running

/** The question goes the way a tab's goes: to the service worker, which asks Kev-0.6B and, when it is unsure, Chrome's model. */
const askModels = (msg) => chrome.runtime.sendMessage({ type: 'ai-ask', kind: msg.kind, question: msg.question, levels: msg.levels, text: msg.text });

function renderExamples(out, results, stopped, seconds, names) {
  out.textContent = '';
  const { rules, totals } = summarize(results);
  const say = (text, cls) => out.append(h('div', { class: 'r' + (cls ? ' ' + cls : '') }, text));
  say(`${results.length} rule${results.length === 1 ? '' : 's'} checked${stopped ? ' (stopped early)' : ''}, ${totals.examples + totals.spared} lines, ${duration(seconds)}. Models that answered: ${names.length ? names.join(', ') : 'none'}.`);
  if (!names.length) say('No model answered, so the result is the word lists alone. Download Kev-0.6B above, or turn on Chrome\'s model, and run the check again.', 'note');
  const box = h('div', { class: 'r' });
  box.append(h('strong', {}, 'All rules together'));
  const list = h('ul', { class: 'lines' });
  for (const line of describeTotals(totals, names)) list.append(h('li', {}, line));
  box.append(list);
  out.append(box);
  say('These lines are the rule author\'s own illustrations, not a labelled test set: the counts say whether the models help each rule on its own examples, not how often they are right on real videos.', 'note');
  results.forEach((r, i) => {
    const s = rules[i];
    const changed = s.gained > 0 || s.added > 0 || s.cleared > 0 || s.lost > 0;   // the models changed the verdict of the word lists, in either direction
    const details = h('details', { class: 'r' + (changed ? ' f' : '') });
    details.append(h('summary', {}, describeRule(s)));
    const ul = h('ul', { class: 'lines' });
    for (const line of r.lines) ul.append(h('li', {}, describeLine(line)));
    details.append(ul);
    out.append(details);
  });
}

async function runExamplesCheck() {
  const out = $('ai-examples-out');
  const bar = $('ai-examples-progress');
  const run = $('ai-examples-run');
  const stop = $('ai-examples-stop');
  const count = $('ai-examples-count');
  out.textContent = '';
  const status = await chrome.runtime.sendMessage({ type: 'ai-status', force: true }).catch(() => null);
  if (!settings.ai.enabled) { out.append(h('div', { class: 'r' }, 'Use on-device AI is switched off above. Switch it on and run the check again.')); return; }
  const lines = countLines(pack.parsed.rules);
  if (!lines) { out.append(h('div', { class: 'r' }, 'No rule with a question and examples was found.')); return; }
  const layers = status && status.layers ? status.layers.filter((l) => l.available).map((l) => MODEL_NAMES[l.name] || l.name) : [];
  examplesCtl = new AbortController();
  run.disabled = true;
  stop.hidden = false;
  bar.hidden = false;
  bar.value = 0;
  count.textContent = layers.length ? `Asking ${layers.join(' and ')}…` : 'No model is ready: the word lists alone…';
  const t0 = performance.now();
  try {
    const { results, stopped } = await runCheck({
      rules: pack.parsed.rules, lexicons: pack.lexicons, settings, ask: askModels, signal: examplesCtl.signal,
      onProgress: (p) => { bar.value = p.done / p.total; count.textContent = `${p.done} of ${p.total} lines · ${p.rule}`; },
    });
    renderExamples(out, results, stopped, (performance.now() - t0) / 1000, modelsSeen(results));
  } catch (e) {
    out.append(h('div', { class: 'r' }, `The check failed: ${(e && e.name) || e}${e && e.message ? ' (' + e.message + ')' : ''}`));
  } finally {
    examplesCtl = null;
    run.disabled = false;
    stop.hidden = true;
    bar.hidden = true;
    count.textContent = '';
  }
}

// ---- timings
async function makePicture(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#3a6ea5'); grad.addColorStop(1, '#e8c07d');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { // some shapes, so that the picture is not trivial
    g.fillStyle = `hsla(${(i * 47) % 360}, 60%, 50%, .5)`;
    g.beginPath(); g.arc((i * 97) % w, (i * 53) % h, 6 + ((i * 7) % 24) * (h / 180), 0, 6.3); g.fill();
  }
  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.85));
}

function makeClip(seconds) {
  const rate = 16000;
  const x = new Float32Array(rate * seconds);
  for (let i = 0; i < x.length; i++) x[i] = 0.25 * Math.sin((2 * Math.PI * 220 * i) / rate) + 0.1 * Math.sin((2 * Math.PI * 660 * i) / rate) + 0.02 * (((i * 7919) % 200) / 100 - 1);
  return new Blob([encodeWav(x, rate)], { type: 'audio/wav' });
}

async function timeOnce(fn) {
  const t = performance.now();
  await fn();
  return performance.now() - t;
}

function enabledRules(surface) {
  return pack.parsed.rules.filter((r) => r.where.includes(surface) && (settings.ruleEnabled[r.id] !== undefined ? settings.ruleEnabled[r.id] : r.enabled));
}

async function runBenchmark() {
  const out = $('ai-bench-out');
  const bar = $('ai-bench-progress');
  const button = $('ai-bench');
  out.textContent = '';
  const line = (text, cls) => out.append(h('div', { class: 'r' + (cls ? ' ' + cls : '') }, text));
  const status = { text: await ai.getAvailability(), image: await ai.getMediaAvailability('image'), audio: await ai.getMediaAvailability('audio') };
  if (!Object.values(status).includes('available')) {
    line('No model is ready. Download one above first.');
    return;
  }
  button.disabled = true;
  bar.hidden = false;
  bar.value = 0;
  const per = {};
  const N = 3;
  const total = (status.image === 'available' ? 3 * (N + 1) : 0) + (status.audio === 'available' ? N + 1 : 0) + (status.text === 'available' ? 2 : 0);
  let done = 0;
  const tick = () => { bar.value = ++done / total; };
  try {
    if (status.image === 'available') {
      const q = (enabledRules('thumbnail')[0] || { asks: [{ question: 'Does this picture show a naked person?' }] }).asks[0].question;
      let first = true;
      for (const [w, hgt, label, key] of [[160, 90, 'Preview frame (160×90)', 'frame'], [320, 180, 'Thumbnail (320×180)', 'image'], [640, 360, 'Large image (640×360)', null]]) {
        const blob = await makePicture(w, hgt);
        const times = [];
        if (first) { // the first prompt of all also loads the model: report it apart
          const cold = await timeOnce(() => ai.askMedia('image', q, blob, { votes: 1 }));
          line(`First image prompt (includes loading the model): ${duration(cold / 1000)}`);
          first = false;
        } else await ai.askMedia('image', q, blob, { votes: 1 });
        tick();
        for (let i = 0; i < N; i++) { times.push(await timeOnce(() => ai.askMedia('image', q, blob, { votes: 1 }))); tick(); }
        const m = median(times);
        line(`${label}: ${duration(m / 1000)} per prompt (median of ${N})`);
        if (key) per[key] = m;
      }
    }
    if (status.audio === 'available') {
      const q = (enabledRules('audio')[0] || { asks: [{ question: 'Does a speaker use vulgar words?' }] }).asks[0].question;
      const clip = makeClip(Math.min(20, Math.max(3, Number(settings.media.audio.windowSeconds) || 8)));
      await ai.askMedia('audio', q, clip, { votes: 1 }); tick();
      const times = [];
      for (let i = 0; i < N; i++) { times.push(await timeOnce(() => ai.askMedia('audio', q, clip, { votes: 1 }))); tick(); }
      per.audio = median(times);
      line(`Audio clip: ${duration(per.audio / 1000)} per prompt (median of ${N})`);
    }
    if (status.text === 'available') {
      const ms = await timeOnce(() => ai.askNoul('Is this a greeting?', 'Hello there, how are you today?'));
      tick();
      per.text = ms / 3; // askNoul asks three wordings
      line(`Text question (three prompts): ${duration(ms / 1000)}`);
      tick();
    }
    out.append(h('div', { class: 'r' }, h('strong', {}, 'Estimates for your settings')));
    const plan = { votes: Number(settings.media.votes) || 2, pictureRules: enabledRules('thumbnail').length, soundRules: enabledRules('audio').length, windowSeconds: Number(settings.media.audio.windowSeconds) || 8 };
    const sentences = estimates(per, plan);
    if (!sentences.length) line('No image or audio rules are enabled.');
    for (const sentence of sentences) line(sentence);
    line('Measured with synthetic test data; real results can differ. Thumbnail results are cached, so only the first load is slow.', 'note');
  } catch (e) {
    line(`Benchmark failed: ${(e && e.name) || e}${e && e.message ? ' (' + e.message + ')' : ''}`);
  } finally {
    bar.hidden = true;
    button.disabled = false;
  }
}

function bindAi() {
  const en = $('ai-enabled');
  en.checked = settings.ai.enabled;
  en.addEventListener('change', () => update((s) => { s.ai.enabled = en.checked; }));
  $('ai-check').addEventListener('click', () => runModelCheck());
  const backendSelect = $('ai-backend');
  backendSelect.value = settings.ai.backend || 'auto';
  backendSelect.addEventListener('change', () => update((s) => { s.ai.backend = backendSelect.value; }));
  chrome.runtime.onMessage.addListener(onKevMessage);
  $('ai-examples-run').addEventListener('click', runExamplesCheck);
  $('ai-examples-stop').addEventListener('click', () => { if (examplesCtl) examplesCtl.abort(); });
  $('ai-bench').addEventListener('click', runBenchmark);
  bindNano();
  runModelCheck();
}

// ------------------------------------------------------------------ experimental: images & audio
const MEDIA_TEXT = {
  unsupported: 'This browser has no built-in model API.',
  unavailable: 'Chrome cannot run it on this computer.',
  downloadable: 'The model is not downloaded yet.',
  downloading: 'The model is downloading.',
  available: 'Ready.',
};

async function mediaAvailability() {
  // ask the service worker, which is where the checks really run; fall back to this page's own answer
  try {
    const r = await chrome.runtime.sendMessage({ type: 'media-status', force: true });
    if (r && r.image) return r;
  } catch (e) { /* the worker is asleep or reloading */ }
  return { image: await ai.getMediaAvailability('image'), audio: await ai.getMediaAvailability('audio') };
}

async function renderMediaStatus() {
  const r = await mediaAvailability();
  const label = (a, id) => statusInfo(a, id).label;
  $('media-status').textContent = `Images: ${label(r.image, 'image')} · Audio: ${label(r.audio, 'audio')}`;
  $('media-help').replaceChildren(help(h('div', {},
    h('p', {}, `Images: ${statusInfo(r.image, 'image').explain}`),
    h('p', {}, `Audio: ${statusInfo(r.audio, 'audio').explain}`),
    h('p', {}, h('a', { href: '#ai' }, 'Models and benchmark'))), 'About compatibility'));
  return r;
}

function renderLists() {
  for (const key of ['allowVideos', 'allowChannels', 'denyVideos', 'denyChannels']) {
    const ta = $('list-' + key);
    if (document.activeElement !== ta) ta.value = (settings.lists[key] || []).join('\n');
  }
}

function bindMedia() {
  const m = () => settings.media;
  const checks = [
    ['media-enabled', (s) => s.media, 'enabled'], ['media-refusal', (s) => s.media, 'refusalIsFlag'], ['media-remember', (s) => s.media, 'rememberFlagged'],
    ['th-enabled', (s) => s.media.thumbnails, 'enabled'], ['th-near', (s) => s.media.thumbnails, 'nearViewOnly'], ['th-hold', (s) => s.media.thumbnails, 'hold'],
    ['au-enabled', (s) => s.media.audio, 'enabled'], ['au-nocap', (s) => s.media.audio, 'onlyWithoutCaptions'],
  ];
  for (const [id, where, key] of checks) {
    const el = $(id);
    el.checked = where(settings)[key] !== false && !!where(settings)[key];
    el.addEventListener('change', async () => {
      await update((s) => { where(s)[key] = el.checked; });
      if (id === 'media-enabled') renderRules();
    });
  }
  const numbers = [
    ['th-hold-s', (s) => s.media.thumbnails, 'holdSeconds', 0, 60], ['th-max', (s) => s.media.thumbnails, 'maxPerPage', 1, 500],
    ['au-window', (s) => s.media.audio, 'windowSeconds', 3, 20], ['au-start', (s) => s.media.audio, 'startAfterSeconds', 0, 120], ['au-max', (s) => s.media.audio, 'maxWindowsPerVideo', 1, 1000],
  ];
  for (const [id, where, key, lo, hi] of numbers) {
    const el = $(id);
    el.value = where(settings)[key];
    el.addEventListener('change', async () => {
      const v = Math.min(hi, Math.max(lo, Math.round(Number(el.value)) || lo));
      el.value = v;
      await update((s) => { where(s)[key] = v; });
    });
  }
  const votes = $('media-votes');
  votes.value = String(m().votes);
  votes.addEventListener('change', async () => { await update((s) => { s.media.votes = Number(votes.value); }); renderRules(); });
  const acted = $('media-remembered-action');
  acted.value = m().rememberedAction;
  acted.addEventListener('change', () => update((s) => { s.media.rememberedAction = acted.value; }));

  $('media-recheck').addEventListener('click', renderMediaStatus);
  $('media-clear').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'media-clear' });
    $('media-clear').textContent = 'Cleared';
    setTimeout(() => { $('media-clear').textContent = 'Clear media cache'; }, 2000);
  });

  // lists
  renderLists();
  for (const key of ['allowVideos', 'allowChannels', 'denyVideos', 'denyChannels']) {
    const ta = $('list-' + key);
    ta.addEventListener('change', async () => {
      const lines = parseListText(ta.value);
      let kept = lines;
      const dropped = [];
      if (key.endsWith('Videos')) {
        kept = [];
        for (const l of lines) { const id = videoIdFrom(l); if (id) kept.push(id); else dropped.push(l); }
      }
      kept = [...new Set(kept)];
      await update((s) => { s.lists[key] = kept; });
      ta.value = kept.join('\n');
      const msg = $('list-messages');
      msg.textContent = '';
      if (dropped.length) msg.append(h('div', { class: 'err' }, `Skipped (not a video ID or URL): ${dropped.join(', ')}`));
      else msg.append(h('div', { class: 'ok' }, 'Saved.'));
    });
  }

  // test a file
  $('media-run').addEventListener('click', async () => {
    const out = $('media-result');
    out.textContent = '';
    const file = $('media-file').files[0];
    if (!file) { out.textContent = 'Choose a file first.'; return; }
    const audio = file.type.startsWith('audio/');
    const kind = audio ? 'audio' : 'image';
    const avail = await ai.getMediaAvailability(kind);
    if (avail !== 'available') { out.append(h('div', { class: 'r' }, `${audio ? 'Audio' : 'Image'} analysis is unavailable. ${MEDIA_TEXT[avail] || ''}`.trim())); return; }
    out.textContent = 'Analyzing…';
    try {
      let media = file;
      if (audio) media = new Blob([encodeWav(await decodeToMono16k(file, settings.media.audio.windowSeconds))], { type: 'audio/wav' });
      const backend = { mediaEnabled: { image: !audio, audio }, askMedia: (k, q, blob, o) => ai.askMedia(k, q, blob, o) };
      const engine = new Engine({ rules: pack.parsed.rules, lexicons: pack.lexicons, settings, backend });
      const verdict = await engine.evaluateMedia(audio ? 'audio' : 'thumbnail', { id: 'test', window: 0, media });
      out.textContent = '';
      if (!verdict.results.length) { out.append(h('div', { class: 'r' }, `No ${audio ? 'audio' : 'image'} rules are enabled.`)); return; }
      for (const r of [...verdict.results].sort((a, b) => b.p - a.p)) {
        out.append(h('div', { class: 'r' + (r.flagged ? ' f' : '') },
          h('strong', {}, r.title), `: ${pct(r.p)} (threshold ${pct(r.flagAt)}) · `,
          r.flagged ? `Flagged → ${ACTION_LABEL[r.action] || r.action}` : 'Not flagged',
          r.via !== 'none' ? ` · ${VIA_LABEL[r.via] || r.via}` : '',
          r.modelError ? ` · Model error: ${r.modelError}` : '',
        ));
      }
    } catch (e) {
      out.textContent = `Analysis failed: ${(e && e.message) || e}`;
    }
  });

  renderMediaStatus();
}

// ------------------------------------------------------------------ log
function logActions(e) {
  if (!/^[\w-]{11}$/.test(e.id || '')) return null;
  const flagged = e.flagged && e.flagged.length;
  const row = h('div', { class: 'acts' });
  const add = (label, key, value) => row.append(h('button', {
    class: 'small',
    onclick: async (ev) => {
      await update((s) => { s.lists = addToList(s.lists, key, value); });
      ev.target.textContent = 'Added';
      ev.target.disabled = true;
      renderLists();
    },
  }, label));
  if (flagged) {
    add('Allow this video', 'allowVideos', e.id);
    if (e.channel) add('Allow this channel', 'allowChannels', e.channel);
  } else {
    add('Block this video', 'denyVideos', e.id);
    if (e.channel) add('Block this channel', 'denyChannels', e.channel);
  }
  return row;
}

function renderLog() {
  const only = $('log-flagged').checked;
  const list = $('log-list');
  list.textContent = '';
  const items = [...log].reverse().filter((e) => !only || (e.flagged && e.flagged.length)).slice(0, 150);
  if (!items.length) list.append(h('li', {}, only ? 'Nothing flagged yet.' : 'No activity yet.'));
  const nameOf = (id) => { const r = pack.parsed.rules.find((x) => x.id === id); return r ? r.name : id; };
  for (const e of items) {
    const ps = Object.entries(e.ps || {}).map(([r, p]) => `${nameOf(r)} ${pct(p)}`).join(', ');
    list.append(h('li', {},
      h('div', { class: 't' }, `${new Date(e.t).toLocaleTimeString()} · ${SURFACE_NAME[e.surface] || e.surface}${e.n > 1 ? ` · seen ${e.n}×` : ''}${e.via ? ' · ' + (VIA_LABEL[e.via] || e.via) : ''}`),
      h('div', {}, [censor(e.title || '(no title)'), e.channel ? ` (${e.channel})` : '']),
      h('div', {}, [
        e.flagged && e.flagged.length ? h('span', { class: 'flag' }, `Flagged: ${e.flagged.map(nameOf).join(', ')}${e.action ? ' → ' + e.action.split(',').map((a) => ACTION_LABEL[a] || a).join(', ') : ''}  `) : '',
        e.uncertain && e.uncertain.length ? h('span', { class: 'unc' }, `Uncertain: ${e.uncertain.map(nameOf).join(', ')}  `) : '',
        ps ? `(${ps})` : '',
      ]),
      e.hits && e.hits.length ? h('div', { class: 't' }, e.hits.map((x) => `${nameOf(x.rule)}: ${censor(x.hits.join(', '))}`).join(' · ')) : null,
      e.error ? h('div', { class: 't' }, `Model error: ${e.error}`) : null,
      logActions(e),
    ));
  }
}

function bindLog() {
  $('log-flagged').addEventListener('change', renderLog);
  $('log-clear').addEventListener('click', async () => { await chrome.storage.local.set({ log: [] }); });
  $('log-export').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' }));
    const a = h('a', { href: url, download: 'vianney-log.json' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
  renderLog();
}

// ------------------------------------------------------------------ test rules
function bindTest() {
  $('test-run').addEventListener('click', async () => {
    const text = $('test-text').value;
    const surface = $('test-surface').value;
    const out = $('test-result');
    out.textContent = '';
    if (!text.trim()) { out.textContent = 'Enter some text first.'; return; }
    const avail = await ai.getAvailability();
    const backend = { enabled: avail === 'available' && settings.ai.enabled, askNoul: ai.askNoul, askScore: ai.askScore };
    const engine = new Engine({ rules: pack.parsed.rules, lexicons: pack.lexicons, settings, backend });
    const verdict = await engine.evaluate({ title: text, channel: '', description: '', text }, surface);
    const shown = verdict.results.filter((r) => r.p > 0 || r.needsModel || r.modelError);
    if (!shown.length) { out.append(h('div', { class: 'r' }, 'No rules flagged this text.')); return; }
    for (const r of shown.sort((a, b) => b.p - a.p)) {
      out.append(h('div', { class: 'r' + (r.flagged ? ' f' : '') },
        h('strong', {}, r.title), `: ${pct(r.p)} (threshold ${pct(r.flagAt)}) · `,
        r.flagged ? `Flagged → ${ACTION_LABEL[r.action] || r.action}` : r.uncertain ? 'Uncertain' : 'Not flagged',
        r.via !== 'none' ? ` · ${VIA_LABEL[r.via] || r.via}` : '',
        r.needsModel ? ' · Needs the on-device AI, which is unavailable' : '',
        r.modelError ? ` · Model error: ${r.modelError}` : '',
        r.hits.length ? h('div', { class: 'hits' }, 'Matches: ' + r.hits.map((x) => `“${censor(x.text)}” (${pct(x.weight)})`).join(', ')) : null,
      ));
    }
  });
}

// ------------------------------------------------------------------ storage changes
function onStorage(changes, area) {
  if (area !== 'local') return;
  if (changes.log) { log = changes.log.newValue || []; renderLog(); }
  if (changes.breakState) renderBreakStatus();
  if (changes.captionDiag) renderCaptionDiag();
}

// ------------------------------------------------------------------ sidebar, headers, routing, search
function buildChrome() {
  for (const el of document.querySelectorAll('[data-icon]:not(section)')) el.append(icon(el.dataset.icon, Number(el.dataset.size) || 16)); // sections carry data-icon for their header
  for (const el of document.querySelectorAll('[data-help]:not(section)')) el.replaceWith(help(el.dataset.help));
  const nav = $('nav');
  for (const sec of document.querySelectorAll('section.pane[data-title]')) {
    const title = h('h2', {}, sec.dataset.title, sec.dataset.help ? help(sec.dataset.help, `About ${sec.dataset.title}`) : null);
    sec.prepend(h('header', { class: 'pane-head' }, tile(sec.dataset.icon, sec.dataset.color, 'big'), h('div', {}, title, sec.dataset.about ? h('p', {}, sec.dataset.about) : null)));
    nav.append(h('a', { class: 'nav-item', href: '#' + sec.id, 'data-pane': sec.id }, tile(sec.dataset.icon, sec.dataset.color, 'sm'), h('span', {}, sec.dataset.title), h('span', { class: 'count' })));
  }
  $('status-sub').textContent = `Version ${chrome.runtime.getManifest().version}`;
}

function showPane(id, arg) {
  const panes = [...document.querySelectorAll('section.pane')];
  const target = id === 'rules' && arg ? 'rule-detail' : panes.some((p) => p.id === id) ? id : 'rules';
  for (const p of panes) p.hidden = p.id !== target;
  if (target === 'rule-detail') renderRuleDetail(arg);
  const navId = target === 'rule-detail' ? 'rules' : target;
  for (const a of document.querySelectorAll('#nav .nav-item')) {
    if (a.dataset.pane === navId) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  const sec = $(target);
  const rule = target === 'rule-detail' ? pack.parsed.rules.find((r) => r.id === arg) : null;
  $('toolbar-title').textContent = rule ? rule.name : (sec.dataset.title || '');
  window.scrollTo(0, 0); // the window is part of the page now, and the browser has just scrolled to the section the address names
  syncHistoryButtons();
}

function route() {
  const [id, arg] = location.hash.replace(/^#/, '').split('/');
  showPane(id || 'rules', arg);
}

function syncHistoryButtons() {
  const nav = window.navigation;
  $('back').disabled = nav ? !nav.canGoBack : false;
  $('forward').disabled = nav ? !nav.canGoForward : false;
}

function bindChrome() {
  window.addEventListener('hashchange', route);
  $('back').addEventListener('click', () => history.back());
  $('forward').addEventListener('click', () => history.forward());
  if (window.navigation) window.navigation.addEventListener('navigatesuccess', syncHistoryButtons);

  for (const b of document.querySelectorAll('#rule-view button')) {
    b.addEventListener('click', () => {
      ruleView = b.dataset.view;
      for (const x of document.querySelectorAll('#rule-view button')) x.setAttribute('aria-selected', String(x === b));
      renderRules();
    });
  }

  $('search').addEventListener('input', () => {
    searchQuery = $('search').value;
    const q = searchQuery.trim().toLowerCase();
    if (q && !location.hash.startsWith('#rules') ) location.hash = '#rules'; // rules are what there is to search
    else if (q && location.hash.startsWith('#rules/')) location.hash = '#rules';
    renderRules();
    // like System Settings: sections with nothing that matches fade out
    for (const a of document.querySelectorAll('#nav .nav-item')) {
      const sec = $(a.dataset.pane);
      const hit = !q || a.textContent.toLowerCase().includes(q) || (a.dataset.pane === 'rules' ? pack.parsed.rules.some((r) => ruleMatches(r, q)) : sec.textContent.toLowerCase().includes(q));
      a.classList.toggle('dim', !hit);
    }
  });
}

async function init() {
  settings = await loadSettings();
  pack = await loadPack(settings);
  defaultRulesText = await loadDefaultRulesText();
  ({ log = [] } = await chrome.storage.local.get('log'));
  buildChrome();
  buildResets();
  bindGeneral(); renderRules(); renderProblems(); renderLexicons(); bindEditor();
  bindBreak(); bindSubtitles(); bindCleanup(); bindAi(); bindMedia(); bindLog(); bindTest();
  bindChrome();
  route();
  chrome.storage.onChanged.addListener(onStorage);
}

init().catch((e) => { document.body.prepend(h('pre', {}, 'Could not start the settings page: ' + e)); });
