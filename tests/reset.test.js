import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_SETTINGS, mergeSettings } from '../extension/src/shared/config.js';
import { SECTION_KEYS, OTHER_KEYS, NEVER_RESET, allKeys, resetKeys } from '../extension/src/shared/reset.js';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

test('every setting belongs to one section of the settings page, or is one that only "reset all" puts back, or is never reset', () => {
  const owned = Object.values(SECTION_KEYS).flat();
  assert.equal(new Set(owned).size, owned.length, 'no key is owned by two sections');
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const where = [owned.includes(key), OTHER_KEYS.includes(key), NEVER_RESET.includes(key)].filter(Boolean).length;
    assert.equal(where, 1, `${key} is in exactly one place`);
  }
  for (const key of [...owned, ...OTHER_KEYS, ...NEVER_RESET]) assert.ok(key in DEFAULT_SETTINGS, `${key} is a setting`);
});

test('a reset puts the named keys back to the shipped values and leaves the rest and the argument alone', () => {
  const mine = mergeSettings({ brk: { afterMinutes: 45, message: 'Rest' }, ruleEnabled: { lords_name: false }, sensitivity: { lords_name: 0.3 }, actions: { lords_name: { comment: 'hide' } }, lists: { denyChannels: ['x'] }, debug: true });
  const before = JSON.stringify(mine);
  const out = resetKeys(mine, SECTION_KEYS.break);
  assert.deepEqual(out.brk, DEFAULT_SETTINGS.brk);
  assert.deepEqual(out.ruleEnabled, { lords_name: false }, 'another section is not touched');
  assert.deepEqual(out.lists.denyChannels, ['x']);
  assert.equal(JSON.stringify(mine), before, 'the argument is not changed');
  const rules = resetKeys(mine, SECTION_KEYS.rules);
  assert.deepEqual([rules.ruleEnabled, rules.sensitivity, rules.actions, rules.rulesText], [{}, {}, {}, null]);
  assert.equal(rules.brk.afterMinutes, 45);
  const lists = resetKeys(mine, SECTION_KEYS.lists);
  assert.deepEqual(lists.lists, { allowVideos: [], allowChannels: [], denyVideos: [], denyChannels: [] });
});

test('the result is a copy: changing it later never changes the shipped defaults', () => {
  const out = resetKeys({}, ['lists', 'brk', 'cleanup']);
  out.lists.denyVideos.push('abc');
  out.brk.afterMinutes = 1;
  out.cleanup.shelfTitles.push('x');
  assert.deepEqual(DEFAULT_SETTINGS.lists.denyVideos, []);
  assert.equal(DEFAULT_SETTINGS.brk.afterMinutes, 120);
  assert.ok(!DEFAULT_SETTINGS.cleanup.shelfTitles.includes('x'));
});

test('"reset all" puts back every setting but the test switch', () => {
  assert.ok(!allKeys().includes('debug'));
  const mine = mergeSettings({ enabled: false, brk: { afterMinutes: 5 }, ai: { enabled: false }, media: { enabled: true }, log: { enabled: false, max: 5 }, surfaces: { comments: false }, debug: true });
  const out = resetKeys(mine, allKeys());
  assert.deepEqual({ ...out, debug: undefined }, { ...DEFAULT_SETTINGS, debug: undefined });
  assert.equal(out.debug, true, 'the debug switch is not the user\'s to reset');
  assert.throws(() => resetKeys({}, ['nonsense']), /no such setting/);
});

test('the settings page: a button per section that has settings, one for everything, none called "Default" in a popup', () => {
  const js = read('extension/src/options/options.js');
  const html = read('extension/src/options/options.html');
  for (const id of Object.keys(SECTION_KEYS)) {
    assert.match(html, new RegExp(`<section class="pane" id="${id}"`), `${id} is a pane of the page`);
    assert.match(js, new RegExp(`\\n  ${id}: \\{ keys: SECTION_KEYS\\.${id === 'break' ? 'break' : id},`), `${id} has a reset in PANE_RESETS`);
  }
  assert.match(js, /keys: allKeys\(\), small: true, label: 'Reset all settings'/, 'one button for everything');
  assert.ok(!/Default \(/.test(js), 'no popup option and no button reads "Default (…)"');
  assert.match(js, /'Reset to defaults'\);\s*\n\s*const refresh = /, 'the Actions block has its button');
  // what would be lost asks first
  for (const id of ['rules', 'lists']) assert.match(js, new RegExp(`\\n  ${id}: \\{[^\\n]*warn:`), `${id} asks before it resets`);
  assert.match(js, /keys: allKeys\(\)[^]*?warn:/, 'resetting everything asks first');
  assert.match(html, /id="toolbar-note"/, 'the note that a reset happened');
});

test('the two fields for seconds in the Scope pane are narrower than the minute fields', () => {
  const html = read('extension/src/options/options.html');
  const css = read('extension/src/options/options.css');
  assert.match(html, /<input type="number" class="narrow" id="sub-pre"/);
  assert.match(html, /<input type="number" class="narrow" id="sub-post"/);
  const wide = Number(css.match(/input\[type="number"\] \{ width: ([\d.]+)em/)[1]);
  const narrow = Number(css.match(/input\[type="number"\]\.narrow \{ width: ([\d.]+)em/)[1]);
  assert.ok(narrow < wide && narrow >= 3, `${narrow}em < ${wide}em`);
});
