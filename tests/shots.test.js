import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SHOTS, nearest, withExamples } from '../extension/src/core/shots.js';

const RULE = {
  examples: ['Join the Freemasons: the benefits of being a Mason', 'Masonic lodge initiation: what happens in the first degree', 'Masonic charity: how the lodge helps your community'],
  spared: ['A priest warns Catholics about the dangers of Freemasonry', 'Why a Catholic cannot join the Masonic lodge: the 1983 declaration', 'Stone masonry: how to build a dry stone wall'],
};
const Q = 'Does this present Freemasonry as good?';

test('with no shots the question is the rule\'s own, and so it is when one side has no example', () => {
  assert.equal(withExamples(Q, RULE), Q);
  assert.equal(withExamples(Q, RULE, { shots: 0 }), Q);
  assert.equal(withExamples(Q, { examples: RULE.examples, spared: [] }, { shots: 3 }), Q);
  assert.equal(withExamples(Q, { examples: [], spared: RULE.spared }, { shots: 3 }), Q);
  assert.equal(withExamples(Q, {}, { shots: 3 }), Q);
});

test('the examples come before the question: what counts first, what does not after it, quoted, one line each, then the question', () => {
  const q = withExamples(Q, RULE, { shots: 2 });
  const lines = q.split('\n');
  assert.match(lines[0], /^Examples that count \(yes\): “[^”]+”; “[^”]+”$/);
  assert.match(lines[1], /^Examples that do not count \(no\): “[^”]+”; “[^”]+”$/);
  assert.equal(lines[2], `Question: ${Q}`);
  assert.equal(lines.length, 3);
});

test('the lines shown are the ones nearest to the text, so a warning meets the warnings', () => {
  const warning = withExamples(Q, RULE, { shots: 1, text: 'Why Catholics must never join the lodge: a warning from the Church' });
  assert.match(warning, /\(no\): “Why a Catholic cannot join the Masonic lodge/);
  const invitation = withExamples(Q, RULE, { shots: 1, text: 'Why you should join the Freemasons today' });
  assert.match(invitation, /\(yes\): “Join the Freemasons: the benefits of being a Mason”/);
  assert.match(invitation, /\(no\): “[^”]+”\n/);
});

test('without a text, or when nothing overlaps, the first lines of the rule are shown, always the same', () => {
  const a = withExamples(Q, RULE, { shots: 2 });
  assert.equal(a, withExamples(Q, RULE, { shots: 2, text: '' }));
  assert.equal(a, withExamples(Q, RULE, { shots: 2, text: 'zzz qqq' }));
  assert.match(a, /\(yes\): “Join the Freemasons[^”]*”; “Masonic lodge initiation/);
  assert.deepEqual(nearest(['a b c', 'd e f'], '', 1), ['a b c']);
});

test('a line that is left out is never shown, even when it is the nearest one (the check on a rule\'s own lines)', () => {
  const text = RULE.spared[0];
  assert.match(withExamples(Q, RULE, { shots: 1, text }), /A priest warns Catholics/, 'it is the nearest of all');
  const q = withExamples(Q, RULE, { shots: 3, text, leaveOut: RULE.spared[0] });
  assert.ok(!q.includes('A priest warns Catholics'));
  assert.match(q, /Why a Catholic cannot join/);
});

test('the number of examples is capped, a negative or odd number is none, a long line is cut', () => {
  const many = { examples: Array.from({ length: 12 }, (_, i) => `yes example number ${i}`), spared: Array.from({ length: 12 }, (_, i) => `no example number ${i}`) };
  const q = withExamples(Q, many, { shots: 99 });
  assert.equal(q.split('“').length - 1, 2 * MAX_SHOTS);
  assert.equal(withExamples(Q, many, { shots: -2 }), Q);
  assert.equal(withExamples(Q, many, { shots: 'x' }), Q);
  const long = withExamples(Q, { examples: ['a'.repeat(400)], spared: ['b'] }, { shots: 1 });
  assert.ok(long.length < Q.length + 400);
});
