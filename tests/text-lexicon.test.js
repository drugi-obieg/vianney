import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { tokenize, normalizeWord, maskTokens, hashText } from '../extension/src/core/text.js';
import { parseLexicon, makeMatcher, maxWeight } from '../extension/src/core/lexicon.js';

const LEX_DIR = new URL('../extension/lexicon/', import.meta.url);

test('tokenize strips accents, lower-cases and keeps original offsets', () => {
  const toks = tokenize("Café déjà vu, Don't!");
  assert.deepEqual(toks.map((t) => t.t), ['cafe', 'deja', 'vu', "don't"]);
  assert.equal("Café déjà vu, Don't!".slice(toks[1].s, toks[1].e), 'déjà');
});

test('tokenize recognises the auto-caption censor marker, also with non-breaking spaces', () => {
  assert.deepEqual(tokenize('what the [ __ ] is that').map((t) => t.t), ['what', 'the', '<censored>', 'is', 'that']);
  assert.deepEqual(tokenize('a [ __ ] b').map((t) => t.t), ['a', '<censored>', 'b']);
});

test('masked words stay one token and a lone asterisk is dropped', () => {
  assert.deepEqual(tokenize('f*** you *** ok').map((t) => t.t), ['f***', 'you', 'ok']);
});

test('curly apostrophes are unified', () => {
  assert.equal(normalizeWord('God’s'), "god's");
});

test('maskTokens replaces token ranges in the original string', () => {
  const text = 'well, damn it all';
  const toks = tokenize(text);
  assert.equal(maskTokens(text, toks, [{ from: 1, to: 2 }], '###'), 'well, ### all');
});

test('hashText is stable and differs for different text', () => {
  assert.equal(hashText('abc'), hashText('abc'));
  assert.notEqual(hashText('abc'), hashText('abd'));
});

test('parseLexicon reports unreadable lines and bad weights', () => {
  const { entries, errors } = parseLexicon('0.9 | ok\nnonsense\n1.5 | too heavy\n# comment\n\n0.5 | /(/', 'x');
  assert.equal(entries.length, 1);
  assert.equal(errors.length, 3);
  assert.deepEqual(errors.map((e) => e.line), [2, 3, 6]);
});

function matcherFor(text) {
  return makeMatcher({ t: parseLexicon(text, 't') });
}

test('phrases match consecutive tokens, case- and accent-insensitively', () => {
  const m = matcherFor('0.95 | oh my god');
  const { hits } = m.matchText('Oh, MY God! that was close', ['t']);
  assert.equal(hits.length, 1);
  assert.deepEqual([hits[0].from, hits[0].to, hits[0].weight], [0, 2, 0.95]);
  assert.equal(m.matchText('oh my goodness', ['t']).hits.length, 0);
});

test('a trailing * is a prefix match on that word only', () => {
  const m = matcherFor('0.9 | fuck*\n0.5 | what the hell');
  assert.equal(m.matchText('this fucking thing', ['t']).hits.length, 1);
  assert.equal(m.matchText('a fuchsia dress', ['t']).hits.length, 0);
  assert.equal(m.matchText('what the Hell', ['t']).hits.length, 1);
});

test('regex entries match on normalised text and map back to token spans', () => {
  const m = matcherFor('0.95 | /\\b\\w*fuck\\w*\\b/');
  const { hits, tokens } = m.matchText('what a clusterfuck today', ['t']);
  assert.equal(hits.length, 1);
  assert.equal(tokens[hits[0].from].t, 'clusterfuck');
});

test('<censored> matches the bleep marker', () => {
  const m = matcherFor('0.9 | <censored>');
  assert.equal(m.matchText('you [ __ ] idiot', ['t']).hits.length, 1);
});

test('the heaviest hit wins for an identical token span', () => {
  const m = matcherFor('0.5 | damn\n0.9 | damn');
  const { hits } = m.matchText('damn', ['t']);
  assert.equal(hits.length, 1);
  assert.equal(maxWeight(hits), 0.9);
});

test('whole-word matching: no hit inside a longer word', () => {
  const m = matcherFor('0.9 | ass');
  assert.equal(m.matchText('a classic assassin', ['t']).hits.length, 0);
});

test('every shipped lexicon file parses without errors', () => {
  const files = readdirSync(LEX_DIR).filter((f) => f.endsWith('.txt'));
  assert.ok(files.length >= 5, 'expected the shipped lexicons');
  for (const f of files) {
    const { errors, entries } = parseLexicon(readFileSync(new URL(f, LEX_DIR), 'utf8'), f);
    assert.deepEqual(errors, [], `${f} has errors`);
    assert.ok(entries.length > 0, `${f} is empty`);
  }
});

test('shipped coarse-word and Lord-name lexicons catch the intended forms and spare reverent speech', () => {
  const read = (f) => parseLexicon(readFileSync(new URL(f, LEX_DIR), 'utf8'), f);
  const m = makeMatcher({ coarse: read('coarse_words.txt'), strong: read('lords_name_strong.txt'), bare: read('lords_name_bare.txt') });
  const w = (text, names) => maxWeight(m.matchText(text, names).hits);
  assert.ok(w('this is fucking great', ['coarse']) >= 0.9);
  assert.ok(w('what the [ __ ] was that', ['coarse']) >= 0.9);
  assert.ok(w('oh my god that is awful', ['strong']) >= 0.9);
  assert.ok(w('I swear to God I did not', ['strong']) >= 0.75);
  assert.equal(w('We pray to God for mercy and thank Jesus Christ our Lord', ['strong']), 0.75); // "jesus christ" stays a context question
  assert.equal(w('Praise the Lord', ['strong']), 0);
  assert.equal(w('the lord is my shepherd', ['bare']), 0.15);
  assert.equal(w('Gregorian chant for evening prayer', ['coarse', 'strong', 'bare']), 0);
});
