// The toolbar popup: quick settings (switches and one stepper) and the recent activity, without opening the full settings page.
// Every change is saved at once; open YouTube pages follow it, as they do for the settings page.

import { loadSettings, saveSettings, mergeSettings, loadDefaultRulesText } from '../shared/config.js';
import { parseRules } from '../core/rules.js';
import { formatDuration, isDue } from '../core/breaktimer.js';
import { addToList } from '../core/lists.js';
import { censor } from '../core/censor.js';

const $ = (id) => document.getElementById(id);

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'checked' || k === 'disabled' || k === 'hidden') el[k] = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}

// What the Settings tab offers: [label, path in the settings]
const HIDE = [['Shorts', ['cleanup', 'shorts']], ['Games', ['cleanup', 'games']], ['Movies & TV', ['cleanup', 'movies']], ['Explore section', ['cleanup', 'explore']], ['More from YouTube', ['cleanup', 'more']], ['Suggestions & banners', ['cleanup', 'banners']]];
const CHECK = [['Lists and search results', ['surfaces', 'feed']], ['Recommended videos', ['surfaces', 'related']], ['Video page', ['surfaces', 'watchMeta']], ['Comments', ['surfaces', 'comments']], ['Subtitles', ['surfaces', 'subtitles']]];

let settings;
let log = [];
let breakState = null;
let names = {};
let flaggedOnly = true;

const read = (path) => path.reduce((o, k) => (o == null ? o : o[k]), settings);
async function write(path, value) {
  settings = mergeSettings(settings);
  let o = settings;
  for (const k of path.slice(0, -1)) o = o[k];
  o[path[path.length - 1]] = value;
  await saveSettings(settings);
}

function switchRow(label, path) {
  const input = h('input', { type: 'checkbox', checked: read(path) !== false });
  input.addEventListener('change', () => write(path, input.checked));
  return h('div', { class: 'row' }, h('span', { class: 'label' }, label), h('label', { class: 'switch' }, input, h('span', { class: 'knob' })));
}

function stepperRow(label, path, unit, { min, max, step }) {
  const value = h('span', { class: 'value' });
  const show = () => { value.textContent = `${read(path)} ${unit}`; };
  const move = async (d) => { await write(path, Math.min(max, Math.max(min, Number(read(path)) + d * step))); show(); };
  show();
  return h('div', { class: 'row' }, h('span', { class: 'label' }, label), value,
    h('div', { class: 'stepper' }, h('button', { type: 'button', 'aria-label': `Less: ${label}`, onclick: () => move(-1) }, '−'), h('button', { type: 'button', 'aria-label': `More: ${label}`, onclick: () => move(1) }, '+')));
}

const group = (title, rows) => [h('div', { class: 'group-title' }, title), h('div', { class: 'group' }, rows)];

function renderSettings() {
  const box = $('settings');
  box.textContent = '';
  box.classList.toggle('off', !settings.enabled);
  if (isDue(breakState, settings.brk)) box.append(h('div', { class: 'callout' }, 'Time for a break.'));
  box.append(
    ...group('Hide', HIDE.map(([l, p]) => switchRow(l, p))),
    ...group('Check', CHECK.map(([l, p]) => switchRow(l, p))),
    ...group('Break reminder', [switchRow('Reminders', ['brk', 'enabled']), stepperRow('Remind after', ['brk', 'afterMinutes'], 'min', { min: 15, max: 480, step: 15 })]),
  );
}

const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const flaggedToday = () => log.filter((e) => e.t >= today() && e.flagged && e.flagged.length).length;

function renderStatus() {
  $('status').textContent = settings.enabled ? `${flaggedToday()} flagged today` : 'Off';
  $('enabled').checked = settings.enabled;
}

function renderActivity() {
  const box = $('activity');
  box.textContent = '';
  box.append(...group('Today', [
    h('div', { class: 'row' }, h('span', { class: 'label' }, 'Flagged'), h('span', { class: 'value' }, String(flaggedToday()))),
    h('div', { class: 'row' }, h('span', { class: 'label' }, 'Watch time'), h('span', { class: 'value' }, breakState ? formatDuration(breakState.accumSeconds) : '–')),
  ]));
  const only = h('input', { type: 'checkbox', checked: flaggedOnly });
  only.addEventListener('change', () => { flaggedOnly = only.checked; renderActivity(); });
  box.append(...group('Recent', [h('div', { class: 'row' }, h('span', { class: 'label' }, 'Flagged only'), h('label', { class: 'switch' }, only, h('span', { class: 'knob' })))]));
  const items = [...log].reverse().filter((e) => !flaggedOnly || (e.flagged && e.flagged.length)).slice(0, 8);
  const list = h('div', { class: 'group' });
  if (!items.length) list.append(h('div', { class: 'empty' }, flaggedOnly ? 'Nothing flagged yet.' : 'No activity yet.'));
  for (const e of items) {
    const flagged = e.flagged && e.flagged.length;
    const time = new Date(e.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const entry = h('div', { class: 'entry' },
      h('div', { class: 'title' }, censor(e.title || '(no title)')),
      h('div', { class: 'meta' }, `${time}${flagged ? ' · ' + e.flagged.map((id) => names[id] || id).join(', ') : ''}`));
    if (/^[\w-]{11}$/.test(e.id || '')) {
      const btn = h('button', { class: 'pill', type: 'button' }, flagged ? 'Allow' : 'Block');
      btn.addEventListener('click', async () => {
        settings = mergeSettings(settings);
        settings.lists = addToList(settings.lists, flagged ? 'allowVideos' : 'denyVideos', e.id);
        await saveSettings(settings);
        btn.textContent = 'Added';
        btn.disabled = true;
      });
      entry.append(h('div', { class: 'acts' }, btn));
    }
    list.append(entry);
  }
  box.append(list);
  box.append(h('div', { class: 'group-title' }, ''), h('div', { class: 'group' }, h('div', { class: 'row' }, h('button', { class: 'pill', type: 'button', onclick: () => openOptions('#log') }, 'Open Activity'))));
}

function openOptions(hash) {
  if (hash) chrome.tabs.create({ url: chrome.runtime.getURL('src/options/options.html' + hash) });
  else chrome.runtime.openOptionsPage();
  window.close();
}

function showTab(name) {
  for (const b of document.querySelectorAll('#tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === name));
  $('settings').hidden = name !== 'settings';
  $('activity').hidden = name !== 'activity';
  if (name === 'activity') renderActivity();
}

async function init() {
  settings = await loadSettings();
  ({ log = [], breakState = null } = await chrome.storage.local.get(['log', 'breakState']));
  try { names = Object.fromEntries(parseRules(settings.rulesText != null ? settings.rulesText : await loadDefaultRulesText()).rules.map((r) => [r.id, r.name])); } catch (e) { names = {}; }

  $('enabled').addEventListener('change', async () => { await write(['enabled'], $('enabled').checked); renderStatus(); renderSettings(); });
  for (const b of document.querySelectorAll('#tabs button')) b.addEventListener('click', () => showTab(b.dataset.tab));
  $('open').addEventListener('click', () => openOptions());
  renderStatus();
  renderSettings();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.log) { log = changes.log.newValue || []; renderStatus(); if (!$('activity').hidden) renderActivity(); }
    if (changes.breakState) { breakState = changes.breakState.newValue || null; renderSettings(); if (!$('activity').hidden) renderActivity(); }
    if (changes.settings) { settings = mergeSettings(changes.settings.newValue); renderStatus(); renderSettings(); }
  });
}

init();
