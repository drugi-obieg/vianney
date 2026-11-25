import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { parseRules } from '../extension/src/core/rules.js';

const SAMPLE = `
pack: test
version: 1
language: en
note: draft

rule lords_name        # comment after the id
  title: Taking the Lord's name in vain
  source: Sur le deuxieme Commandement
  where: subtitles, watch-meta
  lexicon: strong, bare
  ask noul: Is the name of God used as an exclamation, and not in prayer?
  flag at: 0.60   # default sensitivity
  action: subtitles=mute-word, watch-meta=warn-overlay
  enabled: true

rule gossip
  where: feed-card, subtitles
  ask score: How much of this talks about private faults of a named person?
    levels: none, mild, heavy
  flag at: heavy
  action: hide
`;

test('parses packs, rules, defaults and per-surface actions', () => {
  const { pack, rules, errors } = parseRules(SAMPLE);
  assert.deepEqual(errors, []);
  assert.equal(pack.id, 'test');
  assert.equal(rules.length, 2);
  const [a, b] = rules;
  assert.deepEqual(a.where, ['subtitles', 'watch-meta']);
  assert.deepEqual(a.lexicon, ['strong', 'bare']);
  assert.equal(a.gate, 'lexicon'); // default: lexicon listed
  assert.equal(a.flagAt, 0.6);
  assert.deepEqual(a.action, { subtitles: 'mute-word', 'watch-meta': 'warn-overlay' });
  assert.equal(b.gate, 'always'); // default: no lexicon
  assert.equal(b.flagAt, 1); // level "heavy" is the top of three levels
  assert.deepEqual(b.levels, ['none', 'mild', 'heavy']);
  // a bare action applies where valid and falls back to the surface default elsewhere
  assert.deepEqual(b.action, { 'feed-card': 'hide', subtitles: 'mute-word' });
});

test('score levels map to thresholds', () => {
  const { rules } = parseRules(SAMPLE.replace('flag at: heavy', 'flag at: mild'));
  assert.equal(rules[1].flagAt, 0.5);
});

test('reports errors with line numbers', () => {
  const bad = parseRules('rule Bad-Id\n\nrule a\n  where: nowhere\n  flag at: 3\n  frobnicate: x\n');
  const msgs = bad.errors.map((e) => e.message).join(' | ');
  assert.match(msgs, /lowercase letters/);
  assert.match(msgs, /unknown surface "nowhere"/);
  assert.match(msgs, /needs a lexicon or an "ask"/);
  assert.match(msgs, /unknown key "frobnicate"/);
  assert.match(msgs, /between 0 and 1/);
  assert.ok(bad.errors.every((e) => Number.isInteger(e.line) && e.line > 0));
});

test('rejects an action that is not valid for its surface', () => {
  const r = parseRules('rule a\n  where: feed-card\n  lexicon: x\n  action: feed-card=mute-word\n');
  assert.match(r.errors.map((e) => e.message).join(), /not valid for feed-card/);
});

test('duplicate ids and missing levels are errors', () => {
  const r = parseRules('rule a\n  where: feed-card\n  lexicon: x\nrule a\n  where: feed-card\n  ask score: q\n');
  const msgs = r.errors.map((e) => e.message).join(' | ');
  assert.match(msgs, /duplicate rule id/);
  assert.match(msgs, /needs "levels"/);
});

const ROOT = new URL('../extension/', import.meta.url);

test('the shipped rule pack parses cleanly and only references lexicons that exist', () => {
  const dir = new URL('rules/', ROOT);
  const files = readdirSync(dir).filter((f) => f.endsWith('.rules'));
  assert.ok(files.length >= 1, 'no .rules file shipped');
  for (const f of files) {
    const { rules, errors } = parseRules(readFileSync(new URL(f, dir), 'utf8'));
    assert.deepEqual(errors, [], `${f}: ${JSON.stringify(errors)}`);
    assert.ok(rules.length >= 4, `${f}: expected a real pack`);
    for (const r of rules) {
      for (const name of r.lexicon) {
        assert.ok(existsSync(new URL(`lexicon/${name}.txt`, ROOT)), `${f}: rule ${r.id} references missing lexicon ${name}`);
      }
    }
  }
});
