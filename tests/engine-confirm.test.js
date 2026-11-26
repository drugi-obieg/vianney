import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRules } from '../extension/src/core/rules.js';
import { parseLexicon } from '../extension/src/core/lexicon.js';
import { Engine } from '../extension/src/core/engine.js';
import { VETO_BELOW } from '../extension/src/core/sensitivity.js';

// A rule that flags Freemasonry shown as good and must spare what warns against it: the words are the same on both sides, so a strong word-list hit is
// shown to the model too (`confirm: model`), and a clear "no" overrules it. Without a model the word list decides alone.
const RULES = `
rule masons
  name: Freemasonry
  where: feed-card, related
  lexicon: masons
  example: Join the Freemasons: the benefits of being a Mason
  example: Masonic lodge initiation: what happens in the first degree
  spared: A priest warns Catholics about the dangers of Freemasonry
  spared: Why a Catholic cannot join the Masonic lodge
  ask noul: Does this present Freemasonry as good, and not warn against it from a Catholic viewpoint?
  confirm: model
  flag at: 0.8
  action: feed-card=blank

rule plain
  where: feed-card
  lexicon: masons
  ask noul: Does this present Freemasonry as good?
  flag at: 0.8
  action: feed-card=blank
`;
const LEX = { masons: parseLexicon('0.95 | masonic lodge\n0.75 | freemasons', 'masons') };

class Model {
  constructor(p) { this.p = p; this.calls = []; this.enabled = true; }
  async askNoul(question, text) { this.calls.push({ question, text }); const p = typeof this.p === 'function' ? this.p(text) : this.p; return p instanceof Error ? { p: null, error: p.message } : { p }; }
  async askScore() { return { p: 0 }; }
}

function engine(backend, settings = {}) {
  const { rules, errors } = parseRules(RULES);
  assert.deepEqual(errors, []);
  return new Engine({ rules, lexicons: LEX, settings, backend });
}
const WARNING = { title: 'A priest explains why the Masonic lodge is forbidden to Catholics', channel: 'x' };
const INVITATION = { title: 'Masonic lodge: why you should join', channel: 'y' };
const rule = (v, id = 'masons') => v.results.find((r) => r.ruleId === id);

test('a strong hit of a confirm rule is overruled by a model that clearly says no', async () => {
  const e = engine(new Model(0.05));
  const v = await e.evaluate(WARNING, 'feed-card');
  assert.equal(rule(v).pLex, 0.95);
  assert.equal(rule(v).flagged, false);
  assert.equal(rule(v).vetoed, true);
  assert.equal(rule(v).via, 'model');
  assert.equal(rule(v).p, 0.05);
  assert.equal(v.flagged.some((r) => r.ruleId === 'masons'), false, 'the Catholic warning is not flagged');
});

test('a model that says yes, or is not sure, leaves the hit standing, and says so in `via`', async () => {
  for (const p of [0.95, 0.6, VETO_BELOW]) {
    const v = await engine(new Model(p)).evaluate(INVITATION, 'feed-card');
    assert.equal(rule(v).flagged, true, `p ${p}`);
    assert.equal(rule(v).vetoed, false);
    assert.equal(rule(v).via, 'lexicon+model');
    assert.equal(rule(v).p, 0.95, 'the word list\'s own p, not the model\'s');
  }
  const v = await engine(new Model(VETO_BELOW - 0.01)).evaluate(INVITATION, 'feed-card');
  assert.equal(rule(v).vetoed, true, 'just under the bound it is overruled');
});

test('the invitation is flagged and the warning is not, by the same words and the model\'s judgement', async () => {
  const e = engine(new Model((text) => (/priest|forbidden/.test(text) ? 0.04 : 0.93)));
  assert.equal((await e.evaluate(INVITATION, 'feed-card')).flagged.length > 0, true);
  assert.equal((await e.evaluate(WARNING, 'feed-card')).flagged.some((r) => r.ruleId === 'masons'), false);
});

test('without a model, or when it cannot answer, the word list decides alone', async () => {
  assert.equal(rule(await engine(null).evaluate(WARNING, 'feed-card')).flagged, true);
  assert.equal(rule(await engine(null).evaluate(WARNING, 'feed-card')).via, 'lexicon');
  const off = new Model(0); off.enabled = false;
  assert.equal(rule(await engine(off).evaluate(WARNING, 'feed-card')).flagged, true);
  const broken = new Model(new Error('out of memory'));
  const v = rule(await engine(broken).evaluate(WARNING, 'feed-card'));
  assert.equal(v.flagged, true);
  assert.equal(v.modelError, 'out of memory');
  assert.equal(v.vetoed, false);
});

test('a rule without confirm never asks the model about a strong hit, as before', async () => {
  const m = new Model(0);
  const v = await engine(m).evaluate(INVITATION, 'feed-card');
  assert.equal(rule(v, 'plain').flagged, true);
  assert.equal(rule(v, 'plain').via, 'lexicon');
  assert.equal(m.calls.length, 1, 'only the confirm rule asked');
});

test('the quick path flags a strong hit at once and says that a model could still overrule it', () => {
  const m = new Model(0);
  const v = engine(m).evaluateQuick(WARNING, 'feed-card');
  assert.equal(v.flagged.some((r) => r.ruleId === 'masons'), true, 'hidden while the model thinks');
  assert.equal(v.undecided, true);
  assert.equal(engine(null).evaluateQuick(WARNING, 'feed-card').undecided, false, 'no model: nothing is left to decide');
  const plainOnly = parseRules(RULES.replace('confirm: model\n', '')); // without confirm, a strong hit is final
  const e = new Engine({ rules: plainOnly.rules, lexicons: LEX, settings: {}, backend: m });
  assert.equal(e.evaluateQuick(WARNING, 'feed-card').undecided, false);
});

test('the model is asked once for a text, and the answer is remembered; the examples come with the question', async () => {
  const m = new Model(0.9);
  const e = engine(m, { ai: { shots: 2 } });
  await e.evaluate(INVITATION, 'feed-card');
  await e.evaluate(INVITATION, 'feed-card');
  assert.equal(m.calls.length, 1);
  const q = m.calls[0].question;
  assert.match(q, /^Examples that count \(yes\): “.*\nExamples that do not count \(no\): “.*\nQuestion: Does this present Freemasonry as good, and not warn against it from a Catholic viewpoint\?$/);
  const no = q.split('\n')[1];
  assert.match(no, /^Examples that do not count \(no\): “[^”]+”; “[^”]+”$/);
  assert.ok(no.includes('A priest warns Catholics about the dangers of Freemasonry') && no.includes('Why a Catholic cannot join the Masonic lodge'), 'the two lines of the rule that are spared');
});

test('a line left out is not shown, and the answer is not shared with a question that did show it; without shots the question is plain', async () => {
  const m = new Model(0.5);
  const e = engine(m, { ai: { shots: 3 } });
  const own = 'Why a Catholic cannot join the Masonic lodge';        // one of the rule's spared lines, and the word list hits it
  await e.evaluate({ title: own, channel: '' }, 'feed-card');
  await e.evaluate({ title: own, channel: '' }, 'feed-card', { leaveOut: own });
  assert.equal(m.calls.length, 2, 'a different question: asked again');
  assert.ok(m.calls[0].question.includes(own), 'shown as an example when it is not left out');
  assert.ok(!m.calls[1].question.includes(own), 'left out');
  const plain = new Model(0.5);
  await engine(plain, { ai: { shots: 0 } }).evaluate(INVITATION, 'feed-card');
  await engine(plain, {}).evaluate(INVITATION, 'feed-card');
  assert.deepEqual(plain.calls.map((c) => c.question), ['Does this present Freemasonry as good, and not warn against it from a Catholic viewpoint?', 'Does this present Freemasonry as good, and not warn against it from a Catholic viewpoint?']);
});

test('confirm is checked when the rules are read: only "model" or "none", and it needs a word list and a yes/no question', () => {
  assert.deepEqual(parseRules(RULES).errors, []);
  assert.equal(parseRules(RULES).rules[0].confirm, 'model');
  assert.equal(parseRules(RULES).rules[1].confirm, 'none');
  assert.match(parseRules(RULES.replace('confirm: model', 'confirm: yes')).errors[0].message, /confirm must be "model" or "none"/);
  assert.match(parseRules('rule r\n  where: feed-card\n  lexicon: masons\n  confirm: model\n  flag at: 0.8\n').errors[0].message, /needs an "ask noul" question/);
  assert.match(parseRules('rule r\n  where: feed-card\n  ask noul: Is it?\n  confirm: model\n  flag at: 0.8\n').errors[0].message, /needs a lexicon/);
});
