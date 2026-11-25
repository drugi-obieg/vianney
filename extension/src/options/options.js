// Settings page: rules with a sensitivity control each, break reminder, subtitles, on-device AI, log, test box.

import { loadSettings, saveSettings, loadPack, loadDefaultRulesText, mergeSettings } from '../shared/config.js';
import { Engine } from '../core/engine.js';
import { parseRules } from '../core/rules.js';
import { flagAtFor, wouldChange, PRESETS } from '../core/sensitivity.js';
import { formatDuration } from '../core/breaktimer.js';
import { addToList, parseListText, videoIdFrom } from '../core/lists.js';
import { encodeWav } from '../core/audio.js';
import { decodeToMono16k } from '../shared/decode.js';
import * as ai from '../ai/prompt-backend.js';

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

// ------------------------------------------------------------------ rules
/** Highest weight any word-list entry of the rule has: the most a lexicon alone can ever reach. */
function lexiconReach(rule) {
  let reach = 0;
  for (const name of rule.lexicon) for (const e of (pack.lexicons[name] && pack.lexicons[name].entries) || []) reach = Math.max(reach, e.weight);
  return reach;
}

const MEDIA_SURFACES = ['thumbnail', 'audio'];
const isMediaRule = (rule) => rule.where.length > 0 && rule.where.every((w) => MEDIA_SURFACES.includes(w));

function sensitivityControl(rule, card) {
  const preview = h('div', { class: 'preview' });
  const reachNote = h('div', { class: 'preview reach' });
  const showReach = (candidate) => {
    if (isMediaRule(rule)) {
      // the model gives no probability: a score is the share of prompt wordings that said yes
      const v = Math.min(3, Math.max(1, Number(settings.media.votes) || 2));
      const needed = Array.from({ length: v }, (_, i) => i + 1).find((k) => k / v >= candidate - 1e-9);
      reachNote.textContent = needed
        ? `With ${v} prompt${v > 1 ? 's' : ''} per question this flags when ${needed} of ${v} say yes. A rule can only flag while pictures and sound are switched on below and the model is available.`
        : 'At this setting the rule never flags.';
      return;
    }
    const reach = lexiconReach(rule);
    if (!rule.lexicon.length) { reachNote.textContent = 'This rule has no word list: it only works with the on-device AI.'; return; }
    reachNote.textContent = reach < candidate - 1e-9
      ? `At this setting the word lists alone never flag this rule (they reach ${pct(reach)}). It needs the on-device AI, or a lower setting.`
      : '';
  };
  const wrap = h('div', { class: 'sens' });
  const saved = () => flagAtFor(rule, settings);
  const showPreview = (candidate) => {
    const w = wouldChange(log, rule.id, saved(), candidate);
    if (!w.considered) { preview.textContent = 'No logged items for this rule yet, so there is nothing to preview.'; return; }
    preview.textContent = `Of the last ${w.considered} logged items this rule reacted to: ${w.more} more and ${w.fewer} fewer would be flagged at this setting.`;
  };

  if (rule.levels) {
    const sel = h('select', {}, rule.levels.map((l) => h('option', { value: l }, `flag at "${l}" or above`)));
    sel.value = rule.levels[Math.round(saved() * (rule.levels.length - 1))];
    sel.addEventListener('change', async () => { showPreview(rule.levels.indexOf(sel.value) / (rule.levels.length - 1)); showReach(rule.levels.indexOf(sel.value) / (rule.levels.length - 1)); await update((s) => { s.sensitivity[rule.id] = sel.value; }); });
    sel.addEventListener('input', () => { showPreview(rule.levels.indexOf(sel.value) / (rule.levels.length - 1)); showReach(rule.levels.indexOf(sel.value) / (rule.levels.length - 1)); });
    wrap.append(sel);
  } else {
    const range = h('input', { type: 'range', min: 0, max: 100, step: 5 });
    range.value = Math.round(saved() * 100);
    const out = h('output', {});
    const label = () => { out.textContent = `Flags when at least ${range.value}% sure`; };
    label();
    range.addEventListener('input', () => { label(); showPreview(Number(range.value) / 100); showReach(Number(range.value) / 100); });
    range.addEventListener('change', async () => { await update((s) => { s.sensitivity[rule.id] = Number(range.value) / 100; }); showPreview(saved()); });
    const preset = (name) => h('button', {
      class: 'small', title: `${name}: ${pct(PRESETS[name])} (unmeasured)`,
      onclick: async () => { range.value = Math.round(PRESETS[name] * 100); label(); await update((s) => { s.sensitivity[rule.id] = PRESETS[name]; }); showPreview(saved()); },
    }, name);
    wrap.append(range, out, preset('strict'), preset('balanced'), preset('lenient'));
  }
  const reset = h('button', {
    class: 'small',
    onclick: async () => { await update((s) => { delete s.sensitivity[rule.id]; }); renderRules(); },
  }, `default (${rule.levels ? rule.flagAtLabel : pct(rule.flagAt)})`);
  wrap.append(reset);
  card.append(wrap, preview, reachNote);
  showPreview(saved());
  showReach(saved());
}

function renderRules() {
  const list = $('rule-list');
  list.textContent = '';
  for (const rule of pack.parsed.rules) {
    const enabled = settings.ruleEnabled[rule.id] !== undefined ? settings.ruleEnabled[rule.id] : rule.enabled;
    const toggle = h('input', { type: 'checkbox', checked: enabled });
    const card = h('article', { class: 'rule' + (enabled ? '' : ' off') });
    toggle.addEventListener('change', async () => { card.classList.toggle('off', !toggle.checked); await update((s) => { s.ruleEnabled[rule.id] = toggle.checked; }); });
    const media = isMediaRule(rule);
    card.append(
      h('label', {}, toggle, h('h3', {}, rule.title), media ? h('span', { class: 'tag' }, 'Experimental') : null),
      h('div', { class: 'meta' }, [
        rule.source ? `Source: ${rule.source}. ` : '',
        `Looks at: ${rule.where.join(', ')}. `,
        rule.lexicon.length ? `Word lists: ${rule.lexicon.join(', ')}. ` : '',
        `Action: ${rule.where.map((w) => `${w} = ${rule.action[w]}`).join(', ')}.`,
        media && rule.refusal === 'flag' ? ' A refusal by the browser\'s safety filter counts as a flag.' : '',
      ].join('')),
      media && !settings.media.enabled ? h('div', { class: 'meta warnline' }, 'Does nothing until "Experimental: pictures and sound" is switched on below.') : null,
      ...rule.asks.map((a) => h('div', { class: 'ask' }, `${a.type === 'noul' ? 'Question' : 'Scale'} for the on-device AI: ${a.question}`)),
    );
    sensitivityControl(rule, card);
    list.append(card);
  }
}

function renderProblems() {
  const box = $('problems');
  if (!pack.problems.length) { box.hidden = true; return; }
  box.hidden = false;
  box.textContent = '';
  box.append(h('strong', {}, 'Some rule or word-list files have problems:'), h('ul', {}, pack.problems.map((p) => h('li', {}, `${p.where}${p.line ? ' line ' + p.line : ''}: ${p.message}`))));
}

function renderLexicons() {
  const parts = Object.entries(pack.lexicons).map(([n, l]) => `${n} (${l.entries.length} entries)`);
  $('lexicons').textContent = parts.length ? `Word lists in use: ${parts.join(', ')}. Edit the files in the extension's lexicon folder and reload the extension to change them.` : '';
}

function bindEditor() {
  const ta = $('rules-text');
  const msg = $('rules-messages');
  ta.value = pack.rulesText;
  const say = (cls, text) => { msg.textContent = ''; msg.append(h('div', { class: cls }, text)); };
  const check = () => {
    const r = parseRules(ta.value);
    if (r.errors.length) { msg.textContent = ''; r.errors.forEach((e) => msg.append(h('div', { class: 'err' }, `line ${e.line}: ${e.message}`))); return false; }
    say('ok', `OK: ${r.rules.length} rules.`);
    return true;
  };
  $('rules-validate').addEventListener('click', check);
  $('rules-save').addEventListener('click', async () => {
    if (!check()) return;
    await update((s) => { s.rulesText = ta.value === defaultRulesText ? null : ta.value; });
    pack = await loadPack(settings);
    renderRules(); renderProblems(); renderLexicons();
    say('ok', 'Saved. Open YouTube pages pick the new rules up at once.');
  });
  $('rules-reset').addEventListener('click', async () => {
    await update((s) => { s.rulesText = null; });
    pack = await loadPack(settings);
    ta.value = pack.rulesText;
    renderRules(); renderProblems(); renderLexicons();
    say('ok', 'Back to the shipped rules.');
  });
}

// ------------------------------------------------------------------ general, break, subtitles
function bindGeneral() {
  const en = $('enabled');
  en.checked = settings.enabled;
  en.addEventListener('change', () => update((s) => { s.enabled = en.checked; }));
}

function bindBreak() {
  const map = [
    ['brk-enabled', 'enabled', 'checkbox'], ['brk-after', 'afterMinutes', 'number'], ['brk-snooze', 'snoozeMinutes', 'number'],
    ['brk-period', 'period', 'select'], ['brk-gap', 'sessionGapMinutes', 'number'], ['brk-card', 'showCard', 'checkbox'],
    ['brk-banner', 'showBanner', 'checkbox'], ['brk-message', 'message', 'text'],
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
  if (!breakState) { el.textContent = 'No watch time recorded yet.'; return; }
  el.textContent = `Counted so far in this ${settings.brk.period === 'day' ? 'day' : 'session'}: ${formatDuration(breakState.accumSeconds)}. Next reminder at ${formatDuration(breakState.nextDueSeconds)}.`;
}

const CAPTION_TEXT = {
  requested: 'captions were switched on and the player was asked for them; waiting for the text.',
  loaded: 'captions were read from the player.',
  empty: 'the player\'s caption request came back empty. YouTube sometimes answers without text to a request it does not trust, so there was nothing to filter.',
  unreadable: 'the caption text could not be read.',
  unavailable: 'this video offers no captions to turn on, so subtitles cannot be filtered.',
};

async function renderCaptionDiag() {
  const { captionDiag } = await chrome.storage.local.get('captionDiag');
  const el = $('sub-diag');
  if (!captionDiag) { el.textContent = 'Last video: no caption activity recorded yet.'; return; }
  const when = new Date(captionDiag.t).toLocaleTimeString();
  const what = captionDiag.status === 'loaded'
    ? `${CAPTION_TEXT.loaded} ${captionDiag.words} words${captionDiag.lang ? ' (' + captionDiag.lang + (captionDiag.kind ? ', ' + captionDiag.kind : '') + ')' : ''}, ${captionDiag.flagged} flagged.`
    : CAPTION_TEXT[captionDiag.status] || captionDiag.status;
  el.textContent = `Last video (${when}${captionDiag.title ? ', "' + captionDiag.title.slice(0, 60) + '"' : ''}): ${what}`;
}

function bindSubtitles() {
  renderCaptionDiag();
  const checks = [['sub-feed', ['surfaces', 'feed']], ['sub-meta', ['surfaces', 'watchMeta']], ['sub-subs', ['surfaces', 'subtitles']], ['sub-auto', ['subtitles', 'autoCaptions']], ['sub-mask', ['subtitles', 'maskVisible']]];
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

// ------------------------------------------------------------------ on-device AI
const AI_TEXT = {
  unsupported: 'This browser does not offer Chrome\'s built-in Prompt API. The rules still work from their word lists.',
  unavailable: 'The built-in model cannot be used on this machine or in this profile (for example not enough free disk space, or it was switched off). The rules still work from their word lists.',
  downloadable: 'The model is not on this machine yet.',
  downloading: 'The model is downloading.',
  available: 'The model is ready.',
};

async function refreshAi() {
  const a = await ai.getAvailability();
  $('ai-status').textContent = `Status: ${a}. ${AI_TEXT[a] || ''}`;
  $('ai-download').hidden = a !== 'downloadable';
  return a;
}

function bindAi() {
  const en = $('ai-enabled');
  en.checked = settings.ai.enabled;
  en.addEventListener('change', () => update((s) => { s.ai.enabled = en.checked; }));
  $('ai-download').addEventListener('click', async () => {
    if (!confirm('This downloads Chrome\'s on-device model, about 4 GB. Chrome removes it again if free disk space falls below 10 GB. Continue?')) return;
    const bar = $('ai-progress');
    bar.hidden = false;
    try {
      await ai.downloadAndPrepare((f) => { bar.value = f; });
    } catch (e) {
      $('ai-status').textContent = `The download failed: ${(e && e.name) || e}.`;
    }
    bar.hidden = true;
    chrome.runtime.sendMessage({ type: 'ai-status', force: true });
    refreshAi();
  });
  refreshAi();
}


// ------------------------------------------------------------------ experimental: pictures and sound
const MEDIA_TEXT = {
  unsupported: 'this browser has no Prompt API',
  unavailable: 'Chrome says it cannot judge this kind of input on this machine or in this profile (the model, a supported graphics card or enough free disk space may be missing)',
  downloadable: 'the model for this input is not on this machine yet',
  downloading: 'the model is downloading',
  available: 'ready',
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
  const line = (name, a) => `${name}: ${a}${MEDIA_TEXT[a] ? ' (' + MEDIA_TEXT[a] + ')' : ''}.`;
  $('media-status').textContent = `${line('Pictures', r.image)} ${line('Sound', r.audio)}`;
  $('media-download-image').hidden = r.image !== 'downloadable';
  $('media-download-audio').hidden = r.audio !== 'downloadable';
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
  for (const kind of ['image', 'audio']) {
    $('media-download-' + kind).addEventListener('click', async () => {
      if (!confirm('This downloads or prepares Chrome\'s on-device model for ' + (kind === 'image' ? 'pictures' : 'sound') + '. It can be several gigabytes. Chrome removes it again if free disk space falls below 10 GB. Continue?')) return;
      const bar = $('media-progress');
      bar.hidden = false;
      try { await ai.prepareMedia(kind, (f) => { bar.value = f; }); } catch (e) { $('media-status').textContent = `The download failed: ${(e && e.name) || e}.`; }
      bar.hidden = true;
      await renderMediaStatus();
    });
  }
  $('media-clear').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'media-clear' });
    $('media-clear').textContent = 'Forgotten';
    setTimeout(() => { $('media-clear').textContent = 'Forget remembered verdicts and videos'; }, 2000);
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
      if (dropped.length) msg.append(h('div', { class: 'err' }, `Not a video id or YouTube address, so left out: ${dropped.join(', ')}`));
      else msg.append(h('div', { class: 'ok' }, 'Saved.'));
    });
  }

  // test box
  $('media-run').addEventListener('click', async () => {
    const out = $('media-result');
    out.textContent = '';
    const file = $('media-file').files[0];
    if (!file) { out.textContent = 'Choose a picture or an audio file first.'; return; }
    const audio = file.type.startsWith('audio/');
    const kind = audio ? 'audio' : 'image';
    const avail = await ai.getMediaAvailability(kind);
    if (avail !== 'available') { out.append(h('div', { class: 'r' }, `The model cannot judge ${audio ? 'sound' : 'pictures'} yet: status "${avail}". ${MEDIA_TEXT[avail] || ''}`)); return; }
    out.textContent = 'Judging ...';
    try {
      let media = file;
      if (audio) media = new Blob([encodeWav(await decodeToMono16k(file, settings.media.audio.windowSeconds))], { type: 'audio/wav' });
      const backend = { mediaEnabled: { image: !audio, audio }, askMedia: (k, q, blob, o) => ai.askMedia(k, q, blob, o) };
      const engine = new Engine({ rules: pack.parsed.rules, lexicons: pack.lexicons, settings, backend });
      const verdict = await engine.evaluateMedia(audio ? 'audio' : 'thumbnail', { id: 'test', window: 0, media });
      out.textContent = '';
      if (!verdict.results.length) { out.append(h('div', { class: 'r' }, `No ${audio ? 'sound' : 'picture'} rule is switched on.`)); return; }
      for (const r of [...verdict.results].sort((a, b) => b.p - a.p)) {
        out.append(h('div', { class: 'r' + (r.flagged ? ' f' : '') },
          h('strong', {}, r.title), ` — ${pct(r.p)} (flags at ${pct(r.flagAt)}): `,
          r.flagged ? `FLAGGED → ${r.action}` : 'not flagged',
          r.via !== 'none' ? ` · via ${r.via}` : '',
          r.modelError ? ` · model error: ${r.modelError}` : '',
        ));
      }
    } catch (e) {
      out.textContent = `Could not judge this file: ${(e && e.message) || e}`;
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
      ev.target.textContent = 'Added to the list';
      ev.target.disabled = true;
      renderLists();
    },
  }, label));
  if (flagged) {
    add('Not a problem: never flag this video', 'allowVideos', e.id);
    if (e.channel) add('Never flag this channel', 'allowChannels', e.channel);
  } else {
    add('Always hide this video', 'denyVideos', e.id);
    if (e.channel) add('Always hide this channel', 'denyChannels', e.channel);
  }
  return row;
}

function renderLog() {
  const only = $('log-flagged').checked;
  const list = $('log-list');
  list.textContent = '';
  const items = [...log].reverse().filter((e) => !only || (e.flagged && e.flagged.length)).slice(0, 150);
  if (!items.length) list.append(h('li', {}, only ? 'Nothing flagged yet.' : 'Nothing logged yet. Open YouTube and browse.'));
  for (const e of items) {
    const ps = Object.entries(e.ps || {}).map(([r, p]) => `${r} ${pct(p)}`).join(', ');
    list.append(h('li', {},
      h('div', { class: 't' }, `${new Date(e.t).toLocaleTimeString()} · ${e.surface}${e.via ? ' · via ' + e.via : ''}`),
      h('div', {}, [e.title || '(no title)', e.channel ? ` (${e.channel})` : '']),
      h('div', {}, [
        e.flagged && e.flagged.length ? h('span', { class: 'flag' }, `flagged: ${e.flagged.join(', ')}${e.action ? ' → ' + e.action : ''}  `) : '',
        e.uncertain && e.uncertain.length ? h('span', { class: 'unc' }, `uncertain: ${e.uncertain.join(', ')}  `) : '',
        ps ? `(${ps})` : '',
      ]),
      e.hits && e.hits.length ? h('div', { class: 't' }, e.hits.map((x) => `${x.rule}: ${x.hits.join(', ')}`).join(' · ')) : null,
      e.error ? h('div', { class: 't' }, `model error: ${e.error}`) : null,
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

// ------------------------------------------------------------------ test box
function bindTest() {
  $('test-run').addEventListener('click', async () => {
    const text = $('test-text').value;
    const surface = $('test-surface').value;
    const out = $('test-result');
    out.textContent = '';
    if (!text.trim()) { out.textContent = 'Paste some text first.'; return; }
    const avail = await ai.getAvailability();
    const backend = { enabled: avail === 'available' && settings.ai.enabled, askNoul: ai.askNoul, askScore: ai.askScore };
    const engine = new Engine({ rules: pack.parsed.rules, lexicons: pack.lexicons, settings, backend });
    const verdict = await engine.evaluate({ title: text, channel: '', description: '', text }, surface);
    const shown = verdict.results.filter((r) => r.p > 0 || r.needsModel || r.modelError);
    if (!shown.length) { out.append(h('div', { class: 'r' }, 'No rule reacted to this text.')); return; }
    for (const r of shown.sort((a, b) => b.p - a.p)) {
      out.append(h('div', { class: 'r' + (r.flagged ? ' f' : '') },
        h('strong', {}, r.title), ` — ${pct(r.p)} (flags at ${pct(r.flagAt)}): `,
        r.flagged ? `FLAGGED → ${r.action}` : r.uncertain ? 'uncertain, shown' : 'below the threshold, shown',
        r.via !== 'none' ? ` · via ${r.via}` : '',
        r.needsModel ? ' · a question for the on-device AI is waiting, but the model is not available' : '',
        r.modelError ? ` · model error: ${r.modelError}` : '',
        r.hits.length ? h('div', { class: 'hits' }, 'Word list hits: ' + r.hits.map((x) => `"${x.text}" (${pct(x.weight)})`).join(', ')) : null,
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

async function init() {
  settings = await loadSettings();
  pack = await loadPack(settings);
  defaultRulesText = await loadDefaultRulesText();
  ({ log = [] } = await chrome.storage.local.get('log'));
  bindGeneral(); renderRules(); renderProblems(); renderLexicons(); bindEditor();
  bindBreak(); bindSubtitles(); bindAi(); bindMedia(); bindLog(); bindTest();
  chrome.storage.onChanged.addListener(onStorage);
}

init().catch((e) => { document.body.prepend(h('pre', {}, 'Could not start the settings page: ' + e)); });
