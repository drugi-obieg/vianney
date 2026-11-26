import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { censor, hasVulgar, STEMS } from '../extension/src/core/censor.js';
import { parseRules } from '../extension/src/core/rules.js';
import { parseLexicon } from '../extension/src/core/lexicon.js';

// The settings page shows the examples of the rules, and the activity log shows titles. Both come from real sentences, so a vulgar
// word must never be shown in full. These tests keep the mask and the word lists in step.
const ROOT = new URL('../extension/', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const { rules } = parseRules(['vianney.en.rules', 'vianney.media.en.rules'].map((f) => read(`rules/${f}`)).join('\n\n'));

test('the first letter stays and the rest of the vulgar part becomes stars', () => {
  assert.equal(censor('What the fuck is going on'), 'What the f*** is going on');
  assert.equal(censor('He is fucking right'), 'He is f***ing right');
  assert.equal(censor('Total bullshit'), 'Total b*******');
  assert.equal(censor('You piece of shit'), 'You piece of s***');
  assert.equal(censor('a bitch, a bastard and an asshole'), 'a b****, a b****** and an a******');
  assert.equal(censor('Motherfucker'), 'M*********er');
  assert.equal(censor('SHIT'), 'S***');
});

test('text without a vulgar word, and words that are already masked, come back as they were', () => {
  for (const t of ['Oh my God, look at this!', 'The Hell of Dante: a lecture', 'Don\'t talk crap about my cooking', 'F***ing unbelievable', 'Sex education for parents', 'class action', 'Assisi']) {
    assert.equal(censor(t), t);
  }
  assert.equal(censor(censor('fuck shit')), 'f*** s***', 'masking twice changes nothing more');
});

test('every vulgar entry of the word lists is covered by the mask', () => {
  // literal entries of coarse_words at 0.75 and above, plus the 0.50 ones that are vulgar and not just rude; "crap", "arse", "dick", "prick", "damn" and "hell" are mild and shown
  const lex = parseLexicon(read('lexicon/coarse_words.txt'), 'coarse_words');
  const mild = new Set(['crap', 'crappy', 'arse', 'dick', 'prick', 'what the hell', 'damn', 'damned', 'ass', 'hell', 'cock']);
  let checked = 0;
  for (const e of lex.entries) {
    if (e.weight < 0.5 || e.kind !== 'phrase') continue;
    const word = e.raw.replace(/\*$/, '');
    if (!word || mild.has(word) || word.includes('<')) continue;
    checked++;
    assert.notEqual(censor(word), word, `"${word}" (weight ${e.weight}) is in coarse_words but the mask does not cover it`);
  }
  assert.ok(checked >= 10, `checked ${checked} entries`);
  for (const stem of STEMS) assert.notEqual(censor(stem), stem, stem);
});

test('no example or spared title is shown with a vulgar word in full', () => {
  let n = 0;
  for (const r of rules) for (const t of [...r.examples, ...r.spared]) { n++; assert.ok(!hasVulgar(censor(t)), `${r.id}: "${t}" shows a vulgar word`); }
  assert.ok(n > 100, `looked at ${n} titles`);
});

test('the examples really use the words: the real text holds a vulgar word where the page shows stars', () => {
  const real = rules.flatMap((r) => r.examples).filter((t) => hasVulgar(t));
  assert.ok(real.length >= 6, `only ${real.length} examples hold a vulgar word`);
  for (const t of real) assert.ok(censor(t).includes('*'), t);
});
