import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addLines } from '../tools/add-lines.mjs';
import { parseRules } from '../extension/src/core/rules.js';

const TEXT = `# header
rule a
  name: A
  where: feed-card
  example: one
  spared: two
  ask noul: Is it?
  flag at: 0.8

rule b
  name: B
  where: feed-card
  lexicon: x
`;

test('lines are added after the last example or spared line of the rule, in the order given, once each', () => {
  const r = addLines(TEXT, 'a', 'spared', ['three', ' four ', 'two', 'three', '']);
  assert.deepEqual(r.added, ['three', 'four']);
  const lines = r.text.split('\n');
  const i = lines.indexOf('  spared: two');
  assert.deepEqual(lines.slice(i, i + 4), ['  spared: two', '  spared: three', '  spared: four', '  ask noul: Is it?']);
  assert.ok(r.text.includes('rule b\n  name: B'), 'the next rule is as it was');
  assert.deepEqual(parseRules(r.text).rules[0].spared, ['two', 'three', 'four']);
});

test('a rule without lines gets them under its name; an unknown rule is none; nothing new changes nothing', () => {
  const r = addLines(TEXT, 'b', 'example', ['x marks the spot']);
  assert.match(r.text, /rule b\n  name: B\n  example: x marks the spot\n/);
  assert.equal(addLines(TEXT, 'nope', 'spared', ['a']), null);
  const same = addLines(TEXT, 'a', 'example', ['one']);
  assert.deepEqual(same.added, []);
  assert.equal(same.text, TEXT);
});
