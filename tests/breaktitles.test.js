import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TITLES, CAPTIONS, pickTitle, pickCaption } from '../extension/src/core/breaktitles.js';
import { formatDuration } from '../extension/src/core/breaktimer.js';

// a small seeded generator, so that "random" choices can be repeated
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

// The longest time the sentence can hold in practice: 100 hours and 59 minutes of playback.
const LONGEST = 100 * 3600 + 59 * 60;

// Words that must never appear in a title: swearing, anything of the faith or of saints (the joke is clickbait itself), and insults to the viewer.
const BLACKLIST = ['damn', 'hell', 'crap', 'shit', 'fuck', 'ass', 'bitch', 'bastard', 'piss', 'sex', 'god', 'jesus', 'christ', 'lord', 'church', 'saint', 'saints', 'pray', 'prayer', 'bible', 'pope',
  'holy', 'heaven', 'devil', 'satan', 'vianney', 'catholic', 'stupid', 'idiot', 'lazy', 'addict', 'addicted', 'loser', 'dumb', 'fat', 'ugly', 'pathetic', 'worthless'];

test('there are at least 30 titles, none empty, none twice', () => {
  assert.ok(TITLES.length >= 30, `only ${TITLES.length}`);
  const seen = new Set();
  for (const t of TITLES) {
    assert.equal(typeof t, 'string');
    assert.ok(t.trim().length > 10, `too short: "${t}"`);
    assert.equal(t, t.trim(), `has spaces at an end: "${t}"`);
    const key = t.toLowerCase().replace(/\s+/g, ' ');
    assert.ok(!seen.has(key), `twice: "${t}"`);
    seen.add(key);
  }
});

test('every title is at most 100 characters, also with the longest watched time filled in', () => {
  for (const t of TITLES) {
    const filled = t.replace(/\{time\}/g, formatDuration(LONGEST));
    assert.ok(filled.length <= 100, `${filled.length} characters: "${filled}"`);
  }
});

test('the only placeholder is {time}', () => {
  for (const t of TITLES) {
    const rest = t.replace(/\{time\}/g, '');
    assert.ok(!/[{}]/.test(rest), `a stray brace in "${t}"`);
  }
  assert.ok(TITLES.some((t) => t.includes('{time}')), 'no title uses the watched time');
});

test('titles read as clickbait: a word in capitals in each, and the marks (! ? : brackets) in most', () => {
  for (const t of TITLES) assert.ok(/\b[A-Z]{3,}\b/.test(t.replace(/\{time\}/g, '')), `no word in capitals: "${t}"`);
  const marked = TITLES.filter((t) => /[!?:()]/.test(t));
  assert.ok(marked.length >= 0.8 * TITLES.length, `only ${marked.length} of ${TITLES.length} carry a mark`);   // the owner's own model "I stopped watching ... SHOCKING" has none
  assert.ok(TITLES.filter((t) => /!/.test(t)).length >= 5, 'too few titles with !');
  assert.ok(TITLES.filter((t) => /\(.*\)/.test(t)).length >= 5, 'too few titles with brackets');
});

test('no title holds a word from the blacklist (swearing, the faith, insults)', () => {
  for (const t of TITLES) {
    const words = t.toLowerCase().match(/[a-z']+/g) || [];
    for (const w of words) assert.ok(!BLACKLIST.includes(w), `"${w}" in "${t}"`);
  }
  for (const c of CAPTIONS) {
    const words = c.toLowerCase().match(/[a-z']+/g) || [];
    for (const w of words) assert.ok(!BLACKLIST.includes(w), `"${w}" in the caption "${c}"`);
  }
});

test('pickTitle fills {time} with the watched time in words', () => {
  const index = TITLES.findIndex((t) => t.includes('{time}'));
  assert.ok(index >= 0);
  const title = pickTitle(() => (index + 0.5) / TITLES.length, 4020);
  assert.ok(title.includes('1 hour 7 minutes'), title);
  assert.ok(!title.includes('{'), title);
  assert.equal(title, TITLES[index].replace('{time}', '1 hour 7 minutes'));
});

test('pickTitle never leaves a placeholder and never goes over the length limit, for any draw and any time', () => {
  for (const seconds of [0, 59, 3600, 4020, 7200, 86400, LONGEST]) {
    for (let i = 0; i < TITLES.length; i++) {
      const title = pickTitle(() => (i + 0.5) / TITLES.length, seconds);
      assert.ok(!/[{}]/.test(title), title);
      assert.ok(title.length <= 100, `${title.length}: ${title}`);
    }
  }
});

test('pickTitle reaches every title, and the edges of the draw are safe', () => {
  const got = new Set();
  for (let i = 0; i < TITLES.length; i++) got.add(pickTitle(() => (i + 0.5) / TITLES.length, 7200));
  assert.equal(got.size, TITLES.length);
  assert.doesNotThrow(() => pickTitle(() => 0, 100));
  assert.doesNotThrow(() => pickTitle(() => 0.9999999999, 100));
  assert.doesNotThrow(() => pickTitle(() => 1, 100));    // outside the contract of rand, but must not give "undefined"
  assert.equal(typeof pickTitle(() => 1, 100), 'string');
});

test('with the same seed the same titles come out, with another seed they differ', () => {
  const run = (seed) => { const r = seeded(seed); return Array.from({ length: 12 }, () => pickTitle(r, 4020)); };
  assert.deepEqual(run(7), run(7));
  assert.notDeepEqual(run(7), run(8));
});

test('the captions of the thumbnail are short, in capitals, and not twice', () => {
  assert.ok(CAPTIONS.length >= 8);
  assert.equal(new Set(CAPTIONS).size, CAPTIONS.length);
  for (const c of CAPTIONS) {
    assert.ok(c.length <= 12, c);
    assert.equal(c, c.toUpperCase(), c);
  }
  const r = seeded(3);
  for (let i = 0; i < 50; i++) assert.ok(CAPTIONS.includes(pickCaption(r)));
});
