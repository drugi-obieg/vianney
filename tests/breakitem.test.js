import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIN_ITEMS, MAX_CARD_INDEX, MAX_COMMENT_INDEX, pickIndex, pickKind, locationKey, clockText, watchingText, sentenceText, agoText } from '../extension/src/core/breakitem.js';
import { DEFAULTS } from '../extension/src/core/breaktimer.js';
import { mergeSettings, DEFAULT_SETTINGS } from '../extension/src/shared/config.js';

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- where the reminder goes
test('with fewer than three items on the page the reminder waits', () => {
  for (const n of [0, 1, 2, -1, NaN, undefined, null]) assert.equal(pickIndex(n, () => 0.5), null, String(n));
  assert.equal(MIN_ITEMS, 3);
  assert.notEqual(pickIndex(3, () => 0.5), null);
});

test('the index is never 0 (never first) and never past index 7 for cards', () => {
  const rand = seeded(11);
  for (const n of [3, 4, 5, 8, 9, 20, 200]) {
    for (let i = 0; i < 2000; i++) {
      const k = pickIndex(n, rand);
      assert.ok(Number.isInteger(k), `${n}: ${k}`);
      assert.ok(k >= 1, `${n}: ${k}`);
      assert.ok(k <= Math.min(MAX_CARD_INDEX, n - 1), `${n}: ${k}`);
    }
  }
  assert.equal(MAX_CARD_INDEX, 7);
});

test('every allowed index can come out, and nothing else', () => {
  const rand = seeded(5);
  for (const [n, max] of [[3, MAX_CARD_INDEX], [5, MAX_CARD_INDEX], [30, MAX_CARD_INDEX], [30, MAX_COMMENT_INDEX], [6, MAX_COMMENT_INDEX]]) {
    const seen = new Set();
    for (let i = 0; i < 4000; i++) seen.add(pickIndex(n, rand, max));
    const top = Math.min(max, n - 1);
    assert.deepEqual([...seen].sort((a, b) => a - b), Array.from({ length: top }, (_, i) => i + 1), `n=${n} max=${max}`);
  }
});

test('the edges of the draw give the lowest and the highest index; a draw outside [0, 1) does not break it', () => {
  assert.equal(pickIndex(20, () => 0), 1);
  assert.equal(pickIndex(20, () => 0.9999999999), MAX_CARD_INDEX);
  assert.equal(pickIndex(4, () => 0.9999999999), 3);
  assert.equal(pickIndex(20, () => 1), 1);          // outside the contract of rand: still a legal index
  assert.equal(pickIndex(20, () => -3), 1);
  assert.equal(pickIndex(20, () => NaN), 1);
});

test('with the same seed the same place is chosen', () => {
  const run = (seed) => { const r = seeded(seed); return Array.from({ length: 10 }, () => pickIndex(20, r)); };
  assert.deepEqual(run(1), run(1));
  assert.notDeepEqual(run(1), run(2));
});

test('a video page: both places are a coin toss, one place alone is taken, none gives nothing', () => {
  assert.equal(pickKind(() => 0.1, { video: true, comment: true }), 'video');
  assert.equal(pickKind(() => 0.9, { video: true, comment: true }), 'comment');
  assert.equal(pickKind(() => 0.9, { video: true, comment: false }), 'video');
  assert.equal(pickKind(() => 0.1, { video: false, comment: true }), 'comment');
  assert.equal(pickKind(() => 0.1, { video: false, comment: false }), null);
  const rand = seeded(9);
  let videos = 0;
  for (let i = 0; i < 4000; i++) if (pickKind(rand, { video: true, comment: true }) === 'video') videos++;
  assert.ok(videos > 1800 && videos < 2200, `${videos} of 4000 are videos`);
});

test('a new place on the site is a new pick; a time in the address of a video is not', () => {
  assert.equal(locationKey('/results', '?search_query=chant'), '/results?search_query=chant');
  assert.notEqual(locationKey('/results', '?search_query=chant'), locationKey('/results', '?search_query=bread'));
  assert.equal(locationKey('/', ''), '/');
  assert.equal(locationKey('/watch', '?v=dQw4w9WgXcQ'), '/watch?v=dQw4w9WgXcQ');
  assert.equal(locationKey('/watch', '?v=dQw4w9WgXcQ&t=120s&list=PL1&index=2'), '/watch?v=dQw4w9WgXcQ');
  assert.notEqual(locationKey('/watch', '?v=aaaaaaaaaaa'), locationKey('/watch', '?v=bbbbbbbbbbb'));
  assert.equal(locationKey('/watch', ''), '/watch');
});

// ---------------------------------------------------------------- the small texts
test('the length of the "video" is the watched time as YouTube writes a length', () => {
  assert.equal(clockText(4020), '1:07:00');
  assert.equal(clockText(4000), '1:07:00');   // rounded to whole minutes, like "1 hour 7 minutes" next to it
  assert.equal(clockText(420), '7:00');
  assert.equal(clockText(0), '0:00');
  assert.equal(clockText(7200), '2:00:00');
  assert.equal(clockText(3599), '1:00:00');
  assert.equal(clockText(36000 + 5 * 60), '10:05:00');
  assert.equal(clockText(-5), '0:00');
});

test('the line under the title, the sentence of the comment and its age', () => {
  assert.equal(watchingText(4020), 'Watching for 1 hour 7 minutes');
  assert.equal(sentenceText(4020, ''), "You've been watching for 1 hour 7 minutes. This is a good moment to take a break.");
  assert.equal(sentenceText(4020, undefined), "You've been watching for 1 hour 7 minutes. This is a good moment to take a break.");
  assert.equal(sentenceText(4020, '   '), "You've been watching for 1 hour 7 minutes. This is a good moment to take a break.");
  assert.equal(sentenceText(7200, '  Drink some water.  '), "You've been watching for 2 hours. Drink some water.");
  assert.equal(agoText(0), '1 minute ago');
  assert.equal(agoText(0.4), '1 minute ago');
  assert.equal(agoText(1), '1 minute ago');
  assert.equal(agoText(5.9), '5 minutes ago');
  assert.equal(agoText(59), '59 minutes ago');
  assert.equal(agoText(60), '1 hour ago');
  assert.equal(agoText(185), '3 hours ago');
});

// ---------------------------------------------------------------- the settings
test('the break defaults: no banner any more, a comment as well as a video', () => {
  assert.ok(!('showBanner' in DEFAULTS));
  assert.equal(DEFAULTS.showCard, true);
  assert.equal(DEFAULTS.showComment, true);
  assert.equal(DEFAULTS.afterMinutes, 120);
  assert.equal(DEFAULTS.snoozeMinutes, 15);
});

test('merging settings: the defaults fill in, the user\'s choices stay, the old banner switch is dropped', () => {
  const fresh = mergeSettings(undefined);
  assert.equal(fresh.brk.showCard, true);
  assert.equal(fresh.brk.showComment, true);
  assert.equal(fresh.brk.message, '');
  assert.ok(!('showBanner' in fresh.brk));
  assert.ok(!('showBanner' in DEFAULT_SETTINGS.brk));

  const old = mergeSettings({ brk: { afterMinutes: 90, showBanner: true, showCard: false, message: 'Go for a walk.' } });
  assert.equal(old.brk.afterMinutes, 90);
  assert.equal(old.brk.showCard, false);
  assert.equal(old.brk.showComment, true);          // new switch: on until the user turns it off
  assert.equal(old.brk.message, 'Go for a walk.');
  assert.ok(!('showBanner' in old.brk));
  assert.equal(old.brk.snoozeMinutes, 15);

  const off = mergeSettings({ brk: { showComment: false } });
  assert.equal(off.brk.showComment, false);
  assert.equal(off.brk.showCard, true);

  assert.equal(DEFAULT_SETTINGS.brk.showComment, true);   // merging must not change the defaults themselves
  assert.ok(!('showBanner' in mergeSettings({ brk: { showBanner: false } }).brk));
});
