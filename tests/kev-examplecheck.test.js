import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseRules } from '../extension/src/core/rules.js';
import { parseLexicon } from '../extension/src/core/lexicon.js';
import {
  checkableRules, countLines, surfaceOf, recordingBackend, checkRule, runCheck, summarizeRule, summarize, modelsSeen, describeLine, describeRule, describeTotals, describeChanges,
} from '../extension/src/core/examplecheck.js';

// A small pack: one rule that its word lists settle alone, one that needs the model, one that only reads subtitles, and one picture rule.
const RULES = `
rule coarse
  name: Coarse words
  where: feed-card
  lexicon: coarse
  ask noul: Is a vulgar word used crudely?
  flag at: 0.7
  example: What the fuck is this
  example: Total crap, honestly
  spared: Crap and crab recipes
  spared: A medical talk on the anus

rule lords
  name: God's name in vain
  where: feed-card, subtitles
  lexicon: names
  ask noul: Is the name of God used as an exclamation, and not in prayer?
  flag at: 0.8
  example: Oh my god, what was that
  example: Jesus Christ, what a mess
  spared: Jesus Christ is Lord: a homily
  spared: O God, hear my prayer

rule talk
  name: Talk only in subtitles
  where: subtitles
  ask noul: Is this a rant?
  example: He rants
  spared: He sings

rule pictures
  name: A picture rule
  where: thumbnail
  ask noul: Does this show a nude person?
  example: x
  spared: y
`;
const LEX = {
  coarse: parseLexicon('0.95 | fuck*\n0.5 | crap', 'coarse'),
  names: parseLexicon('0.95 | oh my god\n0.75 | jesus christ\n0.15 | god', 'names'),
};
const { rules, errors } = parseRules(RULES);

// a stand-in for the models of the service worker: Kev says yes to "oh my god"/"jesus christ ... mess" and to crap; Chrome's model is only asked when Kev is unsure
const KEV_SAYS = (text) => (/mess|crap|what was that/.test(text) ? 0.9 : /homily|prayer/.test(text) ? 0.1 : 0.5);
const ask = async ({ text }) => {
  const k = KEV_SAYS(text);
  if (k > 0.35 && k < 0.65) return { p: (k + 0.2) / 2, via: 'kev+prompt', steps: [{ model: 'kev', p: k, error: null }, { model: 'prompt', p: 0.2, error: null }] };
  return { p: k, via: 'kev', steps: [{ model: 'kev', p: k, error: null }] };
};

test('the test pack parses', () => assert.deepEqual(errors, []));

test('only text rules with a question are checked, on the surface that reads their lines', () => {
  assert.deepEqual(checkableRules(rules).map((r) => r.id), ['coarse', 'lords', 'talk']);
  assert.equal(surfaceOf(rules[0]), 'feed-card');
  assert.equal(surfaceOf(rules[2]), 'subtitles');
  assert.equal(surfaceOf(rules[3]), null);
  assert.equal(countLines(rules), 4 + 4 + 2);
});

test('the recording backend passes the answers on and remembers them, also when the model fails', async () => {
  const b = recordingBackend(async (m) => (m.text === 'boom' ? Promise.reject(new Error('worker is gone')) : { p: 0.4, via: 'kev' }));
  assert.equal((await b.askNoul('q', 'x')).p, 0.4);
  assert.equal((await b.askScore('q', ['a', 'b'], 'x')).p, 0.4);
  const bad = await b.askNoul('q', 'boom');
  assert.equal(bad.p, null);
  assert.match(bad.error, /worker is gone/);
  assert.deepEqual(b.calls.map((c) => [c.p, c.via]), [[0.4, 'kev'], [0.4, 'kev'], [null, null]]);
});

test('one rule: the words alone against the words with the models, line by line, through the real engine', async () => {
  const r = await checkRule({ rule: rules[1], rules, lexicons: LEX, ask });
  assert.equal(r.id, 'lords');
  assert.deepEqual(r.lines.map((l) => [l.kind, l.flaggedByWords, l.flagged, l.asked]), [
    ['example', true, true, false],      // "oh my god": 0.95 reaches the level on its own, the models are not asked
    ['example', false, true, true],      // "jesus christ ... mess": 0.75 is below 0.8, Kev says 0.9
    ['spared', false, false, true],      // "jesus christ is lord": 0.75, Kev says 0.1
    ['spared', false, false, false],     // "o god ...": only a weak cue (0.15), below the band, not asked
  ]);
  const second = r.lines[1];
  assert.equal(second.pWords, 0.75);
  assert.equal(second.p, 0.9);
  assert.equal(second.via, 'model');
  assert.equal(second.answers.length, 1);
  assert.equal(second.answers[0].via, 'kev');
  assert.equal(second.flagAt, 0.8);
});

test('a rule that is switched off can still be tried, and the sensitivity of the user counts', async () => {
  const off = await checkRule({ rule: rules[1], rules, lexicons: LEX, ask, settings: { ruleEnabled: { lords: false } } });
  assert.equal(off.lines.filter((l) => l.flagged).length, 2);
  const lenient = await checkRule({ rule: rules[1], rules, lexicons: LEX, ask: async () => ({ p: 0, via: 'kev', steps: [] }), settings: { sensitivity: { lords: 0.7 } } });
  assert.equal(lenient.lines[1].flaggedByWords, true, 'with the slider at 0.7 the cue weight 0.75 flags by itself');
  assert.equal(lenient.flagAt, 0.7);
});

test('a model that cannot answer is reported on the line, and the verdict stays with the words', async () => {
  const r = await checkRule({ rule: rules[1], rules, lexicons: LEX, ask: async () => ({ p: null, error: 'not downloaded', steps: [{ model: 'kev', p: null, error: 'not downloaded' }] }) });
  const l = r.lines[1];
  assert.equal(l.flagged, false);
  assert.equal(l.modelError, 'not downloaded');
  assert.equal(describeLine(l), '✗ Jesus Christ, what a mess: words 0.75 · models could not answer (Kev-0.6B: not downloaded) · not flagged');
});

test('the whole check: progress, counts per rule and in total, and which models answered', async () => {
  const seen = [];
  const { results, stopped } = await runCheck({ rules, lexicons: LEX, ask, onProgress: (p) => seen.push(p) });
  assert.equal(stopped, false);
  assert.deepEqual(results.map((r) => r.id), ['coarse', 'lords', 'talk']);
  assert.equal(seen.length, 10);
  assert.deepEqual(seen.at(-1), { done: 10, total: 10, rule: 'talk' });
  const s = summarize(results);
  const lords = s.rules.find((r) => r.id === 'lords');
  assert.deepEqual({ ex: lords.examples, sp: lords.spared, exW: lords.exFlaggedWords, ex1: lords.exFlagged, spW: lords.spFlaggedWords, sp1: lords.spFlagged, asked: lords.asked, gained: lords.gained, added: lords.added },
    { ex: 2, sp: 2, exW: 1, ex1: 2, spW: 0, sp1: 0, asked: 2, gained: 1, added: 0 });
  assert.deepEqual({ lost: lords.lost, cleared: lords.cleared }, { lost: 0, cleared: 0 });
  assert.equal(s.totals.examples, 5);
  assert.equal(s.totals.spared, 5);
  assert.equal(s.totals.exFlagged >= s.totals.exFlaggedWords, true, 'a model can only add flags');
  assert.deepEqual(modelsSeen(results), ['Kev-0.6B', 'Gemini Nano']);
  assert.equal(describeRule(lords), "God's name in vain: examples flagged 1 of 2 by words, 2 of 2 with the models; spared lines flagged 0 of 2 by words, 0 of 2 with the models. The models flagged 1 example that the words missed (good).");
  const lines = describeTotals(s.totals, ['Kev-0.6B']);
  assert.match(lines[0], /^Examples \(should be flagged\): \d+ of 5 flagged by the word lists alone, \d+ of 5 with Kev-0\.6B\.$/);
  assert.match(lines[2], /^Kev-0\.6B was asked about \d+ of 10 lines \(the word lists decide the rest\)\.$/);
  assert.match(lines[3], /^Kev-0\.6B flagged 2 examples that the words missed \(good\)\.$/);
  assert.match(describeTotals(s.totals, ['Kev-0.6B', 'Gemini Nano'])[2], /^Kev-0\.6B and Gemini Nano were asked about /);
  assert.equal(describeChanges({ gained: 0, lost: 0, cleared: 0, added: 0 }), 'The models changed nothing.');
});

test('a line reads as a plain sentence: what the words said, what the models said, and the verdict', async () => {
  const r = await checkRule({ rule: rules[1], rules, lexicons: LEX, ask });
  assert.equal(describeLine(r.lines[0]), '✓ Oh my god, what was that: words 0.95 (flags) · models not asked · flagged');
  assert.equal(describeLine(r.lines[1]), '✓ Jesus Christ, what a mess: words 0.75 · models 0.90 (Kev-0.6B 0.90) · flagged');
  const unsure = (await checkRule({ rule: rules[0], rules, lexicons: LEX, ask: async () => ({ p: 0.55, via: 'kev+prompt', steps: [{ model: 'kev', p: 0.5, error: null }, { model: 'prompt', p: 0.6, error: null }] }) })).lines[1];
  assert.match(describeLine(unsure), /models 0\.55 \(Kev-0\.6B 0\.50, Gemini Nano 0\.60\)/);
  const wrong = (await checkRule({ rule: rules[0], rules, lexicons: LEX, ask: async () => ({ p: 0, via: 'kev', steps: [] }) })).lines[1];
  assert.match(describeLine(wrong), /^✗ Total crap, honestly/, 'an example that is not flagged is marked as a miss');
});

test('Stop: the lines judged so far are kept', async () => {
  const ctl = new AbortController();
  let n = 0;
  const { results, stopped } = await runCheck({ rules, lexicons: LEX, ask, signal: ctl.signal, onProgress: () => { if (++n === 5) ctl.abort(); } });
  assert.equal(stopped, true);
  assert.equal(results.flatMap((r) => r.lines).length, 5);
});

test('only some rules can be asked for', async () => {
  const { results } = await runCheck({ rules, lexicons: LEX, ask, only: ['talk'] });
  assert.deepEqual(results.map((r) => r.id), ['talk']);
  const none = summarizeRule({ id: 'x', name: 'x', lines: [] });
  assert.equal(none.examples, 0);
});

// the shipped rules: every checkable rule has lines, and the check runs on all of them with a stand-in that always says "no"
const ROOT = new URL('../extension/', import.meta.url);
const shipped = parseRules(['vianney.en.rules', 'vianney.media.en.rules'].map((f) => readFileSync(new URL(`rules/${f}`, ROOT), 'utf8')).join('\n\n')).rules;
const shippedLex = {};
for (const f of readdirSync(new URL('lexicon/', ROOT))) shippedLex[f.replace(/\.txt$/, '')] = parseLexicon(readFileSync(new URL(`lexicon/${f}`, ROOT), 'utf8'), f);

test('on the shipped rules: a model that always says no never flags more than the words (and exactly the same for rules without `confirm: model`), one that always says yes never flags less', async () => {
  const no = await runCheck({ rules: shipped, lexicons: shippedLex, ask: async () => ({ p: 0, via: 'kev', steps: [{ model: 'kev', p: 0, error: null }] }) });
  const yes = await runCheck({ rules: shipped, lexicons: shippedLex, ask: async () => ({ p: 1, via: 'kev', steps: [{ model: 'kev', p: 1, error: null }] }) });
  const a = summarize(no.results);
  const b = summarize(yes.results);
  const confirms = new Set(shipped.filter((r) => r.confirm === 'model').map((r) => r.id));
  assert.ok(confirms.size >= 1, 'the shipped pack has rules whose word-list hits a model may overrule');
  assert.equal(a.totals.examples, countLines(shipped) - a.totals.spared);
  for (const r of a.rules) {
    assert.ok(r.exFlagged <= r.exFlaggedWords && r.spFlagged <= r.spFlaggedWords, `${r.id}: "no" flags nothing more than the words`);
    if (!confirms.has(r.id)) assert.ok(r.exFlagged === r.exFlaggedWords && r.spFlagged === r.spFlaggedWords && r.lost === 0 && r.cleared === 0, `${r.id}: and exactly the same, there being nothing to overrule`);
  }
  for (const r of b.rules) assert.ok(r.exFlagged >= r.exFlaggedWords && r.spFlagged >= r.spFlaggedWords && r.lost === 0 && r.cleared === 0, `${r.id}: "yes" flags nothing less than the words`);
  assert.ok(b.totals.asked > 0 && b.totals.asked <= b.totals.examples + b.totals.spared);
  assert.ok(a.totals.lost + a.totals.cleared > 0, 'a model that says no overrules some strong hits of the rules that ask for confirmation');
});

// ------------------------------------------------------------------------------------------------ a rule whose strong hits the model may overrule
const CONFIRM_RULES = `
rule masons
  name: Freemasonry
  where: feed-card
  lexicon: masons
  ask noul: Does this present Freemasonry as good, and not warn against it?
  confirm: model
  flag at: 0.8
  example: Why you should join the lodge: the benefits of Freemasonry
  example: Masonic lodge initiation: the first degree
  spared: A priest warns Catholics about Freemasonry
  spared: Freemasonry and the Church: the condemnations
  spared: Stone masonry: how to build a wall
`;
const confirmPack = parseRules(CONFIRM_RULES);
const MASONS = { masons: parseLexicon('0.95 | freemasonry\n0.95 | lodge\n0.3 | masonry', 'masons') };
const priestSays = async ({ text }) => (/priest|church|condemnations/i.test(text) ? { p: 0.1, via: 'kev', steps: [{ model: 'kev', p: 0.1, error: null }] } : { p: 0.9, via: 'kev', steps: [{ model: 'kev', p: 0.9, error: null }] });

test('`confirm: model`: a strong hit that is a Catholic warning is cleared by the model, and the report says so in both directions', async () => {
  assert.deepEqual(confirmPack.errors, []);
  const r = await checkRule({ rule: confirmPack.rules[0], rules: confirmPack.rules, lexicons: MASONS, ask: priestSays });
  assert.deepEqual(r.lines.map((l) => [l.kind, l.flaggedByWords, l.flagged, l.vetoed, l.via]), [
    ['example', true, true, false, 'lexicon+model'],      // the model confirms the hit
    ['example', true, true, false, 'lexicon+model'],
    ['spared', true, false, true, 'model'],               // "A priest warns ...": the words flag it (0.95), the model says 0.1: overruled
    ['spared', true, false, true, 'model'],
    ['spared', false, false, false, 'lexicon'],           // stone masonry: a weak cue only (0.3), below the band: not asked
  ]);
  const s = summarizeRule(r);
  assert.deepEqual({ gained: s.gained, lost: s.lost, cleared: s.cleared, added: s.added, spW: s.spFlaggedWords, sp: s.spFlagged }, { gained: 0, lost: 0, cleared: 2, added: 0, spW: 2, sp: 0 });
  assert.equal(describeRule(s), 'Freemasonry: examples flagged 2 of 2 by words, 2 of 2 with the models; spared lines flagged 2 of 3 by words, 0 of 3 with the models. The models cleared 2 spared lines that the words flagged (good).');
  assert.equal(describeLine(r.lines[2]), '✓ A priest warns Catholics about Freemasonry: words 0.95 (flags) · models 0.10 (Kev-0.6B 0.10) · not flagged · the models overruled the word lists');
  assert.equal(describeLine(r.lines[0]), '✓ Why you should join the lodge: the benefits of Freemasonry: words 0.95 (flags) · models 0.90 (Kev-0.6B 0.90) · flagged · the models confirmed the word lists');
});

test('a model that always says no overrules the examples too: that is counted as lost, and said to be bad', async () => {
  const r = await checkRule({ rule: confirmPack.rules[0], rules: confirmPack.rules, lexicons: MASONS, ask: async () => ({ p: 0, via: 'kev', steps: [{ model: 'kev', p: 0, error: null }] }) });
  const s = summarizeRule(r);
  assert.deepEqual({ lost: s.lost, cleared: s.cleared }, { lost: 2, cleared: 2 });
  assert.match(describeRule(s), /The models cleared 2 spared lines that the words flagged \(good\), cleared 2 examples that the words flagged \(bad\)\.$/);
  assert.match(describeLine(r.lines[0]), /^✗ /, 'a cleared example is a miss');
  // an answer that fails leaves the word list as it is: nothing is overruled by a model that did not answer
  const fails = summarizeRule(await checkRule({ rule: confirmPack.rules[0], rules: confirmPack.rules, lexicons: MASONS, ask: async () => ({ p: null, error: 'unavailable', steps: [] }) }));
  assert.deepEqual({ lost: fails.lost, cleared: fails.cleared, exFlagged: fails.exFlagged, spFlagged: fails.spFlagged }, { lost: 0, cleared: 0, exFlagged: 2, spFlagged: 2 });
});

test('the line under test is left out of the examples that the model is shown beside the question', async () => {
  const seen = [];
  const ask = async (m) => { seen.push({ question: m.question, text: m.text }); return { p: 0.5, via: 'kev', steps: [] }; };
  const settings = { ai: { shots: 3 } };
  await checkRule({ rule: confirmPack.rules[0], rules: confirmPack.rules, lexicons: MASONS, ask, settings });
  assert.equal(seen.length, 4, 'the two examples and the two Catholic warnings are asked about (stone masonry holds only a weak cue)');
  for (const q of seen) {
    assert.match(q.question, /Examples that count \(yes\): /);
    assert.match(q.question, /Examples that do not count \(no\): /);
    assert.match(q.question, /\nQuestion: Does this present Freemasonry/);
    assert.ok(!q.question.includes(q.text), `the question for "${q.text}" does not show that very line`);
  }
  const first = seen.find((q) => q.text.startsWith('Why you should join'));
  assert.ok(first.question.includes('Masonic lodge initiation'), 'the other example is shown');
  assert.ok(first.question.includes('A priest warns Catholics'), 'and the spared lines');
  // without shots the question is the plain one
  const plain = [];
  await checkRule({ rule: confirmPack.rules[0], rules: confirmPack.rules, lexicons: MASONS, ask: async (m) => { plain.push(m.question); return { p: 0.5, steps: [] }; }, settings: { ai: { shots: 0 } } });
  assert.ok(plain.every((q) => q === 'Does this present Freemasonry as good, and not warn against it?'));
  assert.ok(seen.every((q) => q.question.endsWith('Question: Does this present Freemasonry as good, and not warn against it?')), 'the plain question comes last');
});
