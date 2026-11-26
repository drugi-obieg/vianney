// Settings and rule-pack loading shared by the content script, the service worker and the options page.
// Uses extension APIs, so it is not unit-tested in Node; the pure parts live in ../core.

import { parseRules } from '../core/rules.js';
import { parseLexicon } from '../core/lexicon.js';
import { DEFAULTS as BREAK_DEFAULTS } from '../core/breaktimer.js';
import { CLEANUP_DEFAULTS } from '../core/cleanup.js';

// The shipped rules come in two files: the text rules, and the experimental picture and sound rules.
// The second file has no header, so the two can be joined into one text.
export const DEFAULT_PACKS = ['rules/vianney.en.rules', 'rules/vianney.media.en.rules'];

export const DEFAULT_SETTINGS = {
  enabled: true,
  rulesText: null,                 // null = the shipped pack
  sensitivity: {},                 // ruleId -> number (0..1) or level name
  actions: {},                     // ruleId -> {surface: action}: what to do instead of what the rule says
  ruleEnabled: {},                 // ruleId -> boolean
  surfaces: { feed: true, related: true, comments: true, watchMeta: true, subtitles: true },   // feed: lists and search; related: recommended videos on a video page
  cleanup: { ...CLEANUP_DEFAULTS, shelfTitles: [...CLEANUP_DEFAULTS.shelfTitles] },   // hide Shorts, Games, Movies & TV and other extras
  subtitles: { autoCaptions: true, mutePre: 0.12, mutePost: 0.18, maskVisible: true },
  brk: { ...BREAK_DEFAULTS, message: '' },
  // backend: 'auto' = the local model Kev-0.6B first and Chrome's own model as a second look, 'kev' = Kev only, 'prompt' = Chrome's model only.
  // shots: how many of a rule's examples and spared lines (each side) go to the model beside its question (core/shots.js); 0 = none [choice: 2 of each side, examples
  // first, was the best of 11 configurations of Kev-0.6B on the rule author's own lines, 3 and 5 were worse: research/kev-accuracy-smoke.md]
  ai: { enabled: true, backend: 'auto', shots: 2 },
  // Experimental: judge thumbnails and sound with Chrome's on-device model (Gemini Nano). Off until switched on.
  media: {
    enabled: false,
    votes: 2,                 // 1 = fast, 3 = careful: how many prompt wordings must agree
    refusalIsFlag: true,      // the model's "unsafe response" counts as a flag for rules that say `refusal: flag`
    rememberFlagged: true,    // remember videos a sound check flagged, so that feeds can hide them next time
    rememberedAction: 'hide', // what a feed card of such a video gets: hide | dim | label
    // hold: keep a thumbnail invisible until it was checked; after holdSeconds it is shown anyway (0 = never show unchecked)
    thumbnails: { enabled: true, hold: true, holdSeconds: 6, maxPerPage: 60, nearViewOnly: true },
    audio: { enabled: true, windowSeconds: 8, startAfterSeconds: 3, onlyWithoutCaptions: true, maxWindowsPerVideo: 150 },
  },
  // Allow and block lists. They always win over a classifier; allow wins over block.
  lists: { allowVideos: [], allowChannels: [], denyVideos: [], denyChannels: [] },
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
  const merged = mergeInto(DEFAULT_SETTINGS, stored || {});
  delete merged.brk.showBanner;   // the banner is gone (the reminder is a video or a comment now); an old stored setting would only linger
  return merged;
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
  const parts = [];
  for (const path of DEFAULT_PACKS) {
    try { parts.push(await fetchText(path)); } catch (e) { /* an optional file may be missing */ }
  }
  return parts.join('\n\n');
}

/** Parse the active rules and load the lexicons they name. */
export async function loadPack(settings) {
  const rulesText = settings.rulesText != null ? settings.rulesText : await loadDefaultRulesText();
  const parsed = parseRules(rulesText);
  const names = new Set(parsed.rules.flatMap((r) => [...r.lexicon, ...(r.spareChannel ? [r.spareChannel] : []), ...(r.spareWords ? [r.spareWords] : [])]));
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
