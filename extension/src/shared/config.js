// Settings and rule-pack loading shared by the content script, the service worker and the options page.
// Uses extension APIs, so it is not unit-tested in Node; the pure parts live in ../core.

import { parseRules } from '../core/rules.js';
import { parseLexicon } from '../core/lexicon.js';
import { DEFAULTS as BREAK_DEFAULTS } from '../core/breaktimer.js';

export const DEFAULT_PACK = 'rules/vianney.en.rules';

export const DEFAULT_SETTINGS = {
  enabled: true,
  rulesText: null,                 // null = the shipped pack
  sensitivity: {},                 // ruleId -> number (0..1) or level name
  ruleEnabled: {},                 // ruleId -> boolean
  surfaces: { feed: true, watchMeta: true, subtitles: true },
  subtitles: { autoCaptions: true, mutePre: 0.12, mutePost: 0.18, maskVisible: true },
  brk: { ...BREAK_DEFAULTS, message: '' },
  ai: { enabled: true },
  log: { enabled: true, max: 500 },
  debug: false,
};

function mergeInto(base, extra) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(extra || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object' && base[k] !== null && !Array.isArray(base[k])) out[k] = mergeInto(base[k], v);
    else out[k] = v;
  }
  return out;
}

export function mergeSettings(stored) {
  return mergeInto(DEFAULT_SETTINGS, stored || {});
}

export async function loadSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return mergeSettings(settings);
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}

async function fetchText(path) {
  const res = await fetch(chrome.runtime.getURL(path));
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.text();
}

export async function loadDefaultRulesText() {
  return fetchText(DEFAULT_PACK);
}

/** Parse the active rules and load the lexicons they name. */
export async function loadPack(settings) {
  const rulesText = settings.rulesText != null ? settings.rulesText : await loadDefaultRulesText();
  const parsed = parseRules(rulesText);
  const names = new Set(parsed.rules.flatMap((r) => r.lexicon));
  const lexicons = {};
  const problems = [...parsed.errors.map((e) => ({ where: 'rules', line: e.line, message: e.message }))];
  for (const name of names) {
    try {
      const lex = parseLexicon(await fetchText(`lexicon/${name}.txt`), name);
      lexicons[name] = lex;
      for (const e of lex.errors) problems.push({ where: `lexicon ${name}`, line: e.line, message: e.message });
    } catch (e) {
      lexicons[name] = { entries: [], errors: [] };
      problems.push({ where: `lexicon ${name}`, line: 0, message: 'file not found' });
    }
  }
  return { rulesText, parsed, lexicons, problems };
}
