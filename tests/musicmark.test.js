import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isMusic, ARTIST_ICON } from '../extension/src/core/musicmark.js';
import { CLEANUP_DEFAULTS } from '../extension/src/core/cleanup.js';
import { DEFAULT_SETTINGS } from '../extension/src/shared/config.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// signals as they were read from real search results and recommendations on 2026-11-26 (signed out, English)
test('a note in front of the length is music; a plain length, a playlist or a Mix is not', () => {
  assert.equal(isMusic({ badges: [{ text: '3:59', hasIcon: true }] }), true, 'Taylor Swift - The Fate of Ophelia (Official Music Video)');
  assert.equal(isMusic({ badges: [{ text: '1:03:26', hasIcon: true }] }), true, 'Solemn Vespers (chant)');
  assert.equal(isMusic({ badges: [{ text: ' 0:16 ', hasIcon: true }] }), true);
  assert.equal(isMusic({ badges: [{ text: '1:32', hasIcon: false }] }), false, 'How To Cook The Perfect Pasta');
  assert.equal(isMusic({ badges: [{ text: '19:29', hasIcon: false }] }), false);
  assert.equal(isMusic({ badges: [{ text: '51 videos', hasIcon: true }] }), false, 'a playlist has an icon, but no length');
  assert.equal(isMusic({ badges: [{ text: 'Mix', hasIcon: true }] }), false);
  assert.equal(isMusic({ badges: [{ text: 'Sponsored', hasIcon: false }] }), false);
  assert.equal(isMusic({ badges: [{ text: 'LIVE', hasIcon: true }] }), false);
  assert.equal(isMusic({}), false);
  assert.equal(isMusic(), false);
});

test('the official artist badge makes a card music, also with no length (a live stream), by its label or by its shape when the label is translated', () => {
  assert.equal(isMusic({ labels: ['Official Artist Channel'] }), true, 'lofi hip hop radio (live)');
  assert.equal(isMusic({ labels: [' official artist channel '] }), true);
  assert.equal(isMusic({ labels: ['Offizieller Künstlerkanal'], paths: [`${ARTIST_ICON}.4 4.2 0 003 7.2`] }), true, 'translated label, the shape is the same');
  assert.equal(isMusic({ labels: ['Verified'], paths: ['M4.516 1.121a2.1 2.1 0 012.97 0l.378.38H8.4c1.16 0 2.1.94 2.'] }), false, 'the check mark of a verified channel is not the artist badge');
  assert.equal(isMusic({ labels: [''], paths: [] }), false);
});

test('the option: off until switched on, a switch of its own in Clean up, hidden by the feed filter with its own reason, and logged as a mark', () => {
  assert.equal(CLEANUP_DEFAULTS.music, false);
  assert.equal(DEFAULT_SETTINGS.cleanup.music, false);
  for (const k of ['shorts', 'games', 'movies', 'explore', 'more', 'banners', 'shortsAsVideos']) assert.equal(CLEANUP_DEFAULTS[k], true, k);
  const html = read('extension/src/options/options.html');
  const cleanup = html.slice(html.indexOf('id="cleanup"'), html.indexOf('id="ai"'));
  assert.match(cleanup, /<div class="label">Music videos <span data-help="[^"]*note[^"]*official artist[^"]*"><\/span><\/div><div class="control"><label class="switch"><input type="checkbox" id="cl-music">/);
  const js = read('extension/src/options/options.js');
  assert.match(js, /'banners', 'music'\]/, 'bound with the others');
  assert.match(js, /key === 'music' \? settings\.cleanup\.music === true : settings\.cleanup\[key\] !== false/, 'the one that is off by default');
  assert.match(js, /mark: "YouTube's music mark"/, 'the Activity page says what a mark is');
  const feed = read('extension/src/content/feed.js');
  assert.match(feed, /if \(s\.cleanup && s\.cleanup\.music === true && meta\.music\) return \{ action: 'hide', reason: 'Music video', via: 'mark' \};/);
  assert.ok(feed.indexOf("listed === 'allow'") < feed.indexOf('s.cleanup.music'), 'a video or channel on the allow list is never hidden for being music');
  assert.match(feed, /\+ \(meta\.music \? '\|music' : ''\)/, 'the badges can be drawn after the title: the card is looked at again');
  const discover = read('extension/src/content/discover.js');
  assert.match(discover, /music: isMusic\(musicSignals\(el\)\)/);
});
