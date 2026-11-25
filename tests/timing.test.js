import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flagAtFor, uncertainFloor, isFlagged, levelLabel, wouldChange, PRESETS } from '../extension/src/core/sensitivity.js';
import { DEFAULTS, freshState, addPlayback, isDue, snooze, dismiss, dayKey, formatDuration } from '../extension/src/core/breaktimer.js';
import { parseJson3, buildSpans, findActive } from '../extension/src/core/captions.js';
import { parseRules } from '../extension/src/core/rules.js';

// ---------------------------------------------------------------- sensitivity
const { rules } = parseRules(`
rule a
  where: feed-card
  lexicon: x
  flag at: 0.7
rule b
  where: feed-card
  ask score: q
    levels: none, mild, heavy
  flag at: heavy
`);

test('the rule default is used until the user overrides it', () => {
  assert.equal(flagAtFor(rules[0], {}), 0.7);
  assert.equal(flagAtFor(rules[0], { sensitivity: { a: 0.9 } }), 0.9);
  assert.equal(flagAtFor(rules[0], { sensitivity: { a: '0.55' } }), 0.55);
  assert.equal(flagAtFor(rules[0], { sensitivity: { a: 7 } }), 1); // clamped
  assert.equal(flagAtFor(rules[0], { sensitivity: { a: 'junk' } }), 0.7);
});

test('rules with levels take a level name', () => {
  assert.equal(flagAtFor(rules[1], {}), 1);
  assert.equal(flagAtFor(rules[1], { sensitivity: { b: 'mild' } }), 0.5);
  assert.equal(levelLabel(rules[1], 0.5), 'mild');
  assert.equal(levelLabel(rules[0], 0.5), null);
});

test('the uncertain band sits a fixed offset below the threshold', () => {
  assert.ok(Math.abs(uncertainFloor(0.7) - 0.5) < 1e-9);
  assert.equal(uncertainFloor(0.1), 0);
  assert.ok(isFlagged(0.7, 0.7));
  assert.ok(isFlagged(0.9 - 1e-12, 0.9));
  assert.ok(!isFlagged(0.69, 0.7));
  assert.ok(PRESETS.strict > PRESETS.balanced && PRESETS.balanced > PRESETS.lenient);
});

test('wouldChange previews a slider move on logged probabilities', () => {
  const log = [{ ps: { a: 0.95 } }, { ps: { a: 0.6 } }, { ps: { a: 0.5 } }, { ps: { z: 1 } }];
  assert.deepEqual(wouldChange(log, 'a', 0.7, 0.55), { more: 1, fewer: 0, considered: 3 });
  assert.deepEqual(wouldChange(log, 'a', 0.7, 0.99), { more: 0, fewer: 1, considered: 3 });
});

// ---------------------------------------------------------------- break reminder
const T0 = new Date(2026, 10, 25, 20, 0, 0).getTime();
const MIN = 60 * 1000;
const cfg = { ...DEFAULTS, afterMinutes: 120, snoozeMinutes: 15, sessionGapMinutes: 30, period: 'session' };

test('a reminder becomes due after N minutes of playback and not before', () => {
  let s = freshState(T0, cfg);
  s = addPlayback(s, T0 + 60 * MIN, 60 * 60, cfg);
  assert.ok(!isDue(s, cfg));
  s = addPlayback(s, T0 + 120 * MIN, 60 * 60, cfg);
  assert.equal(s.accumSeconds, 7200);
  assert.ok(isDue(s, cfg));
});

test('snooze and dismiss postpone the next reminder by playback time', () => {
  let s = addPlayback(freshState(T0, cfg), T0 + 120 * MIN, 7200, cfg);
  assert.ok(isDue(s, cfg));
  const sn = snooze(s, cfg);
  assert.ok(!isDue(sn, cfg));
  assert.equal(sn.nextDueSeconds, 7200 + 15 * 60);
  const s2 = addPlayback(sn, T0 + 136 * MIN, 16 * 60, cfg);
  assert.ok(isDue(s2, cfg));
  const dm = dismiss(s2, cfg);
  assert.equal(dm.nextDueSeconds, s2.accumSeconds + 7200);
});

test('a long pause starts a new session', () => {
  let s = addPlayback(freshState(T0, cfg), T0 + 100 * MIN, 100 * 60, cfg);
  s = addPlayback(s, T0 + 100 * MIN + 31 * MIN + 10, 10, cfg);
  assert.equal(s.accumSeconds, 10);
  // a short pause does not
  let t = addPlayback(freshState(T0, cfg), T0 + 100 * MIN, 100 * 60, cfg);
  t = addPlayback(t, T0 + 100 * MIN + 20 * MIN + 10, 10, cfg);
  assert.equal(t.accumSeconds, 6010);
});

test('in day mode the total resets at local midnight', () => {
  const day = { ...cfg, period: 'day' };
  let s = addPlayback(freshState(T0, day), T0 + 10 * MIN, 600, day);
  assert.equal(s.periodKey, dayKey(T0));
  s = addPlayback(s, T0 + 5 * 60 * MIN, 600, day); // 01:00 next day
  assert.notEqual(s.periodKey, dayKey(T0));
  assert.equal(s.accumSeconds, 600);
});

test('disabled reminders are never due; durations read naturally', () => {
  const s = addPlayback(freshState(T0, cfg), T0 + 130 * MIN, 8000, cfg);
  assert.ok(!isDue(s, { ...cfg, enabled: false }));
  assert.equal(formatDuration(7200), '2 hours');
  assert.equal(formatDuration(5400), '1 hour 30 minutes');
  assert.equal(formatDuration(60), '1 minute');
});

// ---------------------------------------------------------------- captions
const ASR = {
  events: [
    { tStartMs: 1000, dDurationMs: 3000, segs: [{ utf8: 'this' }, { utf8: ' is', tOffsetMs: 400 }, { utf8: ' [ __ ]', tOffsetMs: 800 }, { utf8: ' great', tOffsetMs: 1500 }] },
    { tStartMs: 4000, dDurationMs: 1000, aAppend: 1, segs: [{ utf8: '\n' }] },
    { tStartMs: 5000, dDurationMs: 2000, segs: [{ utf8: 'oh my god it works' }] },
    { tStartMs: 9000, dDurationMs: 500 },
  ],
};

test('json3 with word offsets gives exact word times', () => {
  const { tokens, approx, events } = parseJson3(ASR);
  assert.equal(events, 2);
  const w = Object.fromEntries(tokens.slice(0, 4).map((t) => [t.t, t.start]));
  assert.equal(w.this, 1);
  assert.ok(Math.abs(w.is - 1.4) < 1e-9);
  assert.ok(Math.abs(w['<censored>'] - 1.8) < 1e-9);
  assert.ok(Math.abs(w.great - 2.5) < 1e-9);
  assert.ok(approx); // the second event had no offsets
});

test('words without offsets are spread over the event by length', () => {
  const { tokens } = parseJson3(ASR);
  const second = tokens.filter((t) => t.start >= 5);
  assert.deepEqual(second.map((t) => t.t), ['oh', 'my', 'god', 'it', 'works']);
  assert.equal(second[0].start, 5);
  assert.ok(second.every((t, i) => i === 0 || t.start > second[i - 1].start));
  assert.ok(second[4].end <= 7.01);
});

test('spans are padded, merged when they touch, and found by time', () => {
  const spans = buildSpans([
    { action: 'mute-word', start: 10, end: 10.4, ruleId: 'a', text: 'x' },
    { action: 'mute-word', start: 10.5, end: 10.8, ruleId: 'b', text: 'y' },
    { action: 'mute-word', start: 20, end: 20.3, ruleId: 'a', text: 'z' },
    { action: 'skip-segment', start: 30, end: 33, ruleId: 'c', text: 'gossip' },
    { action: 'mute-word', ruleId: 'a', text: 'no timing' },
  ], { pre: 0.1, post: 0.2 });
  assert.equal(spans.length, 3 + 0);
  const mute = spans.find((s) => s.start < 10);
  assert.ok(Math.abs(mute.start - 9.9) < 1e-9 && Math.abs(mute.end - 11.0) < 1e-9);
  assert.deepEqual(mute.rules.sort(), ['a', 'b']);
  assert.equal(findActive(spans, 9.95).action, 'mute-word');
  assert.equal(findActive(spans, 15), null);
  assert.equal(findActive(spans, 31).action, 'skip-segment');
  assert.equal(findActive(spans, 20.1).action, 'mute-word');
});
