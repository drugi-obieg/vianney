import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseRules, splitLine } from '../extension/src/core/rules.js';
import { parseLexicon } from '../extension/src/core/lexicon.js';
import { Engine } from '../extension/src/core/engine.js';
import { uncertainFloor } from '../extension/src/core/sensitivity.js';

// The settings page shows, for every rule, titles it catches ("example") and titles that look similar but are left alone
// ("spared"). People read them as promises, so they are tested against the real rules and word lists:
//  - a rule whose word lists can reach its "flag at" level on their own must flag every example from the words alone, and
//    must not flag a spared title;
//  - a rule that needs the on-device model (its word lists only reach below "flag at") must not flag an example from the
//    words alone, must hand it to the model (the example holds a cue word), and must flag it when the model says yes;
//    a spared title must not be flagged when the model says no.
const ROOT = new URL('../extension/', import.meta.url);
const text = ['vianney.en.rules', 'vianney.media.en.rules'].map((f) => readFileSync(new URL(`rules/${f}`, ROOT), 'utf8')).join('\n\n');
const { rules } = parseRules(text);
const lexicons = {};
for (const f of readdirSync(new URL('lexicon/', ROOT))) lexicons[f.replace(/\.txt$/, '')] = parseLexicon(readFileSync(new URL(`lexicon/${f}`, ROOT), 'utf8'), f);

const GROUPS = ['belief', 'anticatholic', 'speech', 'people', 'purity', 'leisure', 'pictures', 'sound'];
const textRules = rules.filter((r) => r.lexicon.length);

class Model {
  constructor(p) { this.p = p; this.enabled = true; this.mediaEnabled = {}; this.calls = 0; }
  async askNoul() { this.calls++; return { p: this.p }; }
  async askScore() { this.calls++; return { p: this.p }; }
}

const engine = (rule, backend = null) => new Engine({ rules, lexicons, settings: { ruleEnabled: { [rule.id]: true } }, backend });

test('every rule has a plain name, a one-line description and a known group', () => {
  assert.equal(rules.length, 55);
  for (const r of rules) {
    assert.ok(r.name && r.name !== r.title, `${r.id}: a plain name that differs from the traditional title`);
    assert.ok(r.plain.length > 20 && r.plain.length < 160, `${r.id}: one sentence (${r.plain.length} characters)`);
    assert.ok(GROUPS.includes(r.group), `${r.id}: group ${r.group}`);
    assert.ok(r.examples.length >= 1 && r.spared.length >= 1, `${r.id}: at least one example and one spared title`);
    assert.ok(!/feed-card|watch-meta|lexicon|gate|\bflag\b/i.test(r.name + ' ' + r.plain), `${r.id}: plain words, no jargon`);
  }
});

test('picture and sound rules are in the picture and sound groups, text rules are not', () => {
  for (const r of rules) {
    const media = r.where.every((w) => w === 'thumbnail' || w === 'frame' || w === 'audio');
    assert.equal(media, r.group === 'pictures' || r.group === 'sound', r.id);
  }
});

test('every text rule that is on by default can fire at its default setting: by its word lists alone, or by asking the model', () => {
  for (const r of textRules.filter((x) => x.enabled)) {
    const weights = r.lexicon.flatMap((n) => lexicons[n].entries.map((e) => e.weight));
    const floor = uncertainFloor(r.flagAt, r.band === null ? undefined : r.band);
    const alone = weights.some((w) => w >= r.flagAt - 1e-9);
    const asks = r.asks.length > 0 && weights.some((w) => w >= floor - 1e-9);
    assert.ok(alone || asks, `${r.id} is on by default but can never fire: no cue reaches its flag-at level (${r.flagAt}) or the model band (from ${floor.toFixed(2)})`);
  }
});

for (const rule of textRules) {
  test(`${rule.id}: the examples are caught and the spared titles are left alone, as the page promises`, async () => {
    const hit = (v) => v.flagged.some((r) => r.ruleId === rule.id);
    for (const title of rule.examples) {
      const item = splitLine(title);
      const stage = engine(rule).lexiconStage(rule, engine(rule).textFor(item, 'feed-card'), item.channel);
      if (stage.pLex >= stage.flagAt - 1e-9) {
        assert.ok(hit(engine(rule).evaluateQuick(item, 'feed-card')), `"${title}" must be flagged by the word lists alone`);
      } else {
        assert.ok(!hit(engine(rule).evaluateQuick(item, 'feed-card')), `"${title}": below the flag-at level, so the words alone must not decide`);
        const yes = new Model(1);
        assert.equal(engine(rule, yes).evaluateQuick(item, 'feed-card').undecided, true, `"${title}" must hold a cue inside the model band, so that the model is asked`);
        assert.ok(hit(await engine(rule, yes).evaluate(item, 'feed-card')), `"${title}" must be flagged when the model says yes`);
        assert.ok(yes.calls >= 1);
      }
    }
    for (const title of rule.spared) {
      const item = splitLine(title);
      assert.ok(!hit(engine(rule).evaluateQuick(item, 'feed-card')), `"${title}" must not be flagged by the word lists`);
      assert.ok(!hit(await engine(rule, new Model(0)).evaluate(item, 'feed-card')), `"${title}" must not be flagged when the model says no`);
    }
  });
}
