// Putting settings back to what the extension ships with: one section of the settings page at a time, or everything.
//
// Each section of the settings page owns some keys of the stored settings (config.js, DEFAULT_SETTINGS). A reset replaces those keys by a fresh copy of
// the shipped value and leaves the others alone. Things that are not settings stay too: the activity log, the remembered flagged videos, the watch time
// of the break reminder and the models that were downloaded.

import { DEFAULT_SETTINGS } from './config.js';

/** The keys that each section of the settings page owns (the id of the section is the id of its pane). */
export const SECTION_KEYS = {
  rules: ['ruleEnabled', 'sensitivity', 'actions', 'rulesText'],   // which rules are on, how sure each must be, what each does, and the rule text
  break: ['brk'],
  subtitles: ['surfaces', 'subtitles'],                           // the pane "Scope"
  cleanup: ['cleanup'],
  ai: ['ai'],
  media: ['media'],
  lists: ['lists'],                                               // the allow and block lists: the user's own entries
};

/** Settings that no section shows on its own: the master switch in the sidebar and the size of the log. Only "reset everything" puts them back. */
export const OTHER_KEYS = ['enabled', 'log'];

/** Not a setting of the user's: the switch for the end-to-end tests. A reset never touches it. */
export const NEVER_RESET = ['debug'];

/** Every key that "reset all settings" replaces. */
export const allKeys = () => Object.keys(DEFAULT_SETTINGS).filter((k) => !NEVER_RESET.includes(k));

const copy = (v) => JSON.parse(JSON.stringify(v));

/** The settings with `keys` back at their shipped values. Does not change its argument. */
export function resetKeys(settings, keys) {
  const out = { ...settings };
  for (const k of keys) {
    if (!(k in DEFAULT_SETTINGS)) throw new Error(`no such setting: ${k}`);
    out[k] = copy(DEFAULT_SETTINGS[k]);
  }
  return out;
}
