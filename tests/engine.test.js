import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRules } from '../extension/src/core/rules.js';
import { parseLexicon } from '../extension/src/core/lexicon.js';
import { Engine } from '../extension/src/core/engine.js';
import { tokenize } from '../extension/src/core/text.js';

const RULES = `
rule coarse
  where: feed-card, subtitles
  lexicon: coarse
  flag at: 0.7
  action: feed-card=hide, subtitles=mute-word

rule gossip
  where: feed-card
  lexicon: cues
  ask noul: Does this expose the private faults of a named person?
  flag at: 0.7
  action: feed-card=blank

rule lords
  where: subtitles
  lexicon: strong, bare
  ask noul: Is the name of God used as an exclamation and not in prayer?
  flag at: 0.8
  action: subtitles=mute-word
`;

const LEX = {
  coarse: parseLexicon('0.95 | fuck*\n0.5 | crap', 'coarse'),
  cues: parseLexicon('0.5 | exposed\n0.15 | drama', 'cues'),
  strong: parseLexicon('0.95 | oh my god\n0.75 | jesus christ', 'strong'),
  bare: parseLexicon('0.15 | god', 'bare'),
};

function engine(settings = {}, backend = null) {
  const { rules, errors } = parseRules(RULES);
  assert.deepEqual(errors, []);
  return new Engine({ rules, lexicons: LEX, settings, backend });
}

class FakeBackend {
  constructor(answer) { this.answer = answer; this.calls = []; }
  async askNoul(question, text) { this.calls.push({ question, text }); return typeof this.answer === 'function' ? this.answer(text) : this.answer; }
  async askScore() { return { p: 0 }; }
}

test('a strong lexicon hit flags without any model', async () => {
  const r = await engine().evaluate({ title: 'This is fucking great', channel: 'x' }, 'feed-card');
  assert.equal(r.flagged[0].ruleId, 'coarse');
  assert.equal(r.action, 'hide');
  assert.equal(r.ps.coarse, 0.95);
});

test('a weak cue does not flag at the default level, but does when the slider is lowered', async () => {
  const item = { title: 'Total crap', channel: 'x' };
  assert.equal((await engine().evaluate(item, 'feed-card')).flagged.length, 0);
  const lenient = engine({ sensitivity: { coarse: 0.5 } });
  assert.equal((await lenient.evaluate(item, 'feed-card')).flagged[0].ruleId, 'coarse');
  const strict = engine({ sensitivity: { coarse: 0.99 } });
  assert.equal((await strict.evaluate({ title: 'fuck', channel: '' }, 'feed-card')).flagged.length, 0);
});

test('the same input and settings always give the same verdict', async () => {
  const e = engine();
  const a = JSON.stringify(await e.evaluate({ title: 'fuck this crap' }, 'feed-card'));
  const b = JSON.stringify(await e.evaluate({ title: 'fuck this crap' }, 'feed-card'));
  assert.equal(a, b);
});

test('disabled rules are skipped and rules only run on their surfaces', async () => {
  const e = engine({ ruleEnabled: { coarse: false } });
  assert.equal((await e.evaluate({ title: 'fuck' }, 'feed-card')).results.length, 1); // only gossip left for feed-card
  assert.equal((await engine().evaluate({ title: 'oh my god' }, 'feed-card')).results.some((r) => r.ruleId === 'lords'), false);
});

test('the model is not asked when there is no cue, and not for cues below the uncertain band', async () => {
  const be = new FakeBackend({ p: 1 });
  const e = engine({}, be);
  await e.evaluate({ title: 'Gregorian chant for evening prayer' }, 'feed-card');
  await e.evaluate({ title: 'Reality drama' }, 'feed-card'); // 0.15 < band start (0.5)
  assert.equal(be.calls.length, 0);
});

test('inside the uncertain band the model decides, and its answer becomes p', async () => {
  const yes = new FakeBackend({ p: 1 });
  const r1 = await engine({}, yes).evaluate({ title: 'Celebrity exposed!' }, 'feed-card');
  assert.equal(yes.calls.length, 1);
  assert.equal(r1.flagged[0].ruleId, 'gossip');
  assert.equal(r1.flagged[0].via, 'model');
  assert.equal(r1.action, 'blank');

  const no = new FakeBackend({ p: 0 });
  const r2 = await engine({}, no).evaluate({ title: 'Celebrity exposed!' }, 'feed-card');
  assert.equal(r2.flagged.length, 0);
});

test('without a backend, or when the backend errors, the cue stays uncertain and nothing is flagged', async () => {
  const r0 = await engine().evaluate({ title: 'Celebrity exposed!' }, 'feed-card');
  assert.equal(r0.flagged.length, 0);
  assert.equal(r0.results.find((r) => r.ruleId === 'gossip').needsModel, true);
  assert.equal(r0.results.find((r) => r.ruleId === 'gossip').uncertain, true);

  const bad = new FakeBackend({ p: null, error: 'NotReadableError' });
  const r1 = await engine({}, bad).evaluate({ title: 'Celebrity exposed!' }, 'feed-card');
  assert.equal(r1.flagged.length, 0);
  assert.equal(r1.results.find((r) => r.ruleId === 'gossip').modelError, 'NotReadableError');
});

test('model answers are cached per rule and text', async () => {
  const be = new FakeBackend({ p: 0 });
  const e = engine({}, be);
  await e.evaluate({ title: 'Celebrity exposed!' }, 'feed-card');
  await e.evaluate({ title: 'Celebrity exposed!' }, 'feed-card');
  assert.equal(be.calls.length, 1);
});

function timed(words) {
  let t = 0;
  return words.split(' ').map((w) => { const tok = tokenize(w)[0]; const o = { ...tok, start: t, end: t + 0.4 }; t += 0.5; return o; });
}

test('subtitles: a strong hit becomes a timed decision', async () => {
  const toks = timed('well oh my god look at this');
  // tokens: "oh" "my" "god" were split into words above; rebuild as one run
  const d = await engine().evaluateSubtitles(toks);
  assert.equal(d.length, 1);
  assert.equal(d[0].ruleId, 'lords');
  assert.equal(d[0].action, 'mute-word');
  assert.equal(d[0].text, 'oh my god');
  assert.ok(Math.abs(d[0].start - 0.5) < 1e-9);
  assert.ok(Math.abs(d[0].end - 1.9) < 1e-9);
});

test('subtitles: a mid-weight phrase is verified by the model in context, and a prayer is spared', async () => {
  const toks = timed('we pray jesus christ our lord have mercy on us');
  const prayer = new FakeBackend({ p: 0 });
  const d1 = await engine({}, prayer).evaluateSubtitles(toks);
  assert.equal(prayer.calls.length, 1);
  assert.equal(d1.length, 0);

  const curse = new FakeBackend({ p: 1 });
  const d2 = await engine({}, curse).evaluateSubtitles(timed('jesus christ that hurt'));
  assert.equal(d2.length, 1);
  assert.equal(d2[0].via, 'model');
});

test('subtitles: the per-video model budget is respected', async () => {
  const be = new FakeBackend({ p: 0 });
  const toks = timed(Array.from({ length: 10 }, (_, i) => `jesus christ w${i}`).join(' '));
  await engine({}, be).evaluateSubtitles(toks, { maxModelCalls: 3 });
  assert.equal(be.calls.length, 3);
});
