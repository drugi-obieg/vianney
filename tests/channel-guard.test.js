import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseRules, splitLine } from '../extension/src/core/rules.js';
import { parseLexicon, makeMatcher } from '../extension/src/core/lexicon.js';
import { Engine } from '../extension/src/core/engine.js';
import { tokenize } from '../extension/src/core/text.js';
import { SPARE_DROP } from '../extension/src/core/sensitivity.js';

const root = new URL('../extension/', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

// The owner's reading (2026-11-26): a video about an error from a channel that is itself Catholic ("Apostolic", "apostolado", "Ascent of Mount Carmel") is most
// likely a warning against it. The channel name lowers a strong word-list hit into the band where a model decides; with no model nothing is flagged.
const RULES = `
rule spiritism
  name: Spiritism
  where: feed-card, related
  lexicon: cues
  spare channel: chans
  ask noul: Does this present spiritism as good?
  flag at: 0.8
  action: feed-card=blank

rule books
  name: Books
  where: feed-card
  lexicon: cues
  ask noul: Is this about these authors?
  flag at: 0.8
  action: feed-card=blank
`;
const LEX = { cues: parseLexicon('0.95 | ouija\n0.5 | seance', 'cues'), chans: parseLexicon('0.95 | catholic*\n0.95 | apostolic*\n0.95 | carmel', 'chans') };
class Model { constructor(p) { this.p = p; this.calls = 0; this.enabled = true; } async askNoul() { this.calls++; return { p: this.p }; } async askScore() { return { p: 0 }; } }
const engine = (backend = null) => { const { rules, errors } = parseRules(RULES); assert.deepEqual(errors, []); return new Engine({ rules, lexicons: LEX, settings: {}, backend }); };
const by = (v, id) => v.results.find((r) => r.ruleId === id);

test('a strong hit from a Catholic channel is lowered into the band, and without a model nothing is flagged', async () => {
  const item = { title: 'Ouija Boards', channel: 'Ascent of Mount Carmel' };
  const q = engine().evaluateQuick(item, 'feed-card');
  assert.equal(by(q, 'spiritism').flagged, false);
  assert.equal(by(q, 'spiritism').channelSpared, true);
  assert.ok(Math.abs(by(q, 'spiritism').p - (0.8 - SPARE_DROP)) < 1e-9, 'just under the flag level');
  assert.equal(by(q, 'spiritism').uncertain, true, 'in the band');
  assert.equal(by(await engine().evaluate(item, 'feed-card'), 'spiritism').flagged, false);
});

test('with a model the band decides: a yes flags it, a no does not', async () => {
  const item = { title: 'Ouija Boards', channel: 'Apostolic Majesty' };
  const yes = new Model(0.95);
  const v = await engine(yes).evaluate(item, 'feed-card');
  assert.equal(by(v, 'spiritism').flagged, true);
  assert.equal(by(v, 'spiritism').via, 'model');
  assert.ok(yes.calls >= 1);
  assert.equal(by(await engine(new Model(0.05)).evaluate(item, 'feed-card'), 'spiritism').flagged, false);
  assert.equal(engine(new Model(0)).evaluateQuick(item, 'feed-card').undecided, true, 'the quick path leaves it to the model');
});

test('the same title from another channel is flagged by the words, as before; a marker in the TITLE spares nothing', async () => {
  assert.equal(by(engine().evaluateQuick({ title: 'Ouija Boards', channel: 'Spooky Nights' }, 'feed-card'), 'spiritism').flagged, true);
  assert.equal(by(engine().evaluateQuick({ title: 'Ouija Boards', channel: '' }, 'feed-card'), 'spiritism').flagged, true);
  assert.equal(by(engine().evaluateQuick({ title: 'Ouija Boards: an Apostolic Pentecostal sermon', channel: 'Spooky Nights' }, 'feed-card'), 'spiritism').flagged, true);
});

test('a rule without `spare channel` ignores the channel, and a weak hit is not lowered further', async () => {
  const item = { title: 'Ouija Boards', channel: 'Ascent of Mount Carmel' };
  assert.equal(by(engine().evaluateQuick(item, 'feed-card'), 'books').flagged, true);
  assert.equal(by(engine().evaluateQuick(item, 'feed-card'), 'books').channelSpared, false);
  const weak = engine().evaluateQuick({ title: 'A seance at night', channel: 'Ascent of Mount Carmel' }, 'feed-card');
  assert.equal(by(weak, 'spiritism').p, 0.5);
  assert.equal(by(weak, 'spiritism').channelSpared, false);
});

test('a line of examples may name its channel after " @ ": the title and the channel come apart', () => {
  assert.deepEqual(splitLine('Ouija Boards @ Ascent of Mount Carmel'), { title: 'Ouija Boards', channel: 'Ascent of Mount Carmel' });
  assert.deepEqual(splitLine('Live @ the Garden @ Some Channel'), { title: 'Live @ the Garden', channel: 'Some Channel' });
  assert.deepEqual(splitLine('No channel here'), { title: 'No channel here', channel: '' });
  assert.deepEqual(splitLine('mail@example.com is not a channel'), { title: 'mail@example.com is not a channel', channel: '' });
  assert.deepEqual(splitLine('ends with @ '), { title: 'ends with @ ', channel: '' });
  assert.deepEqual(splitLine(`A @ ${'x'.repeat(90)}`), { title: `A @ ${'x'.repeat(90)}`, channel: '' }, 'a long tail is part of the title');
});

test('the key is checked when the rules are read: it names a word list and needs a lexicon', () => {
  assert.deepEqual(parseRules(RULES).errors, []);
  assert.equal(parseRules(RULES).rules[0].spareChannel, 'chans');
  assert.equal(parseRules(RULES).rules[1].spareChannel, '');
  assert.match(parseRules('rule r\n  where: feed-card\n  ask noul: Is it?\n  spare channel: chans\n').errors[0].message, /needs a lexicon/);
  assert.match(parseRules(RULES.replace('spare channel: chans', 'spare channel: Not A Name')).errors[0].message, /names a word list/);
});

// ------------------------------------------------------------------ the shipped list and rules
const shippedLex = {};
for (const f of readdirSync(new URL('lexicon/', root))) shippedLex[f.replace(/\.txt$/, '')] = parseLexicon(read(`lexicon/${f}`), f);
const shipped = parseRules(['vianney.en.rules', 'vianney.media.en.rules'].map((f) => read(`rules/${f}`)).join('\n\n')).rules;

test('the list of Catholic channel names hits the channels the owner named and not the look-alikes', () => {
  assert.deepEqual(shippedLex.catholic_channels.errors, []);
  const m = makeMatcher({ catholic_channels: shippedLex.catholic_channels });
  const hit = (name) => m.match(tokenize(name), ['catholic_channels']).length > 0;
  for (const name of ['Apostolic Majesty', 'Ascent of Mount Carmel', 'Apostolado Glórias de Maria', 'Catholic Answers', 'Pints With Aquinas', 'Remnant TV Latin Mass']) assert.ok(hit(name), name);
  for (const name of ['Annulment Proof', 'Grace Community Church', 'Judas Priest', 'Saint Seiya Fans', 'The Bard', 'Sword Art Online SAO', 'Fatima Beauty']) assert.ok(!hit(name), name);
});

test('the rules about an error spare Catholic channels, and the rules about books, speech, people and pictures do not', () => {
  for (const r of shipped) {
    const about = ['belief', 'anticatholic'].includes(r.group) && !r.id.startsWith('index_');
    assert.equal(r.spareChannel, about ? 'catholic_channels' : '', `${r.id} (${r.group})`);
    if (r.spareChannel) assert.ok(shippedLex[r.spareChannel], `${r.id}: the list exists`);
  }
  assert.equal(shipped.filter((r) => r.spareChannel).length, 16);
});

test('the real titles of the four channels the owner named: none is flagged by the word lists of the shipped rules, with every rule on', () => {
  const all = Object.fromEntries(shipped.map((r) => [r.id, true]));
  const e = new Engine({ rules: shipped, lexicons: shippedLex, settings: { ruleEnabled: all }, backend: null });
  const lines = shipped.flatMap((r) => r.spared.map((l) => ({ rule: r.id, line: l }))).filter((x) => / @ (Ascent of Mount Carmel|Apostolic Majesty|Apostolado Gl)/.test(x.line));
  assert.ok(lines.length >= 24, `${lines.length} lines of the owner's channels in the rules`);
  for (const { rule, line } of lines) {
    const v = e.evaluateQuick(splitLine(line), 'feed-card');
    assert.ok(!v.flagged.some((f) => f.ruleId === rule), `${rule}: "${line}" is not flagged by the words`);
  }
});

// ------------------------------------------------------------------ the life of an author is not his books
const LIFE_RULES = `
rule philosophers
  name: Philosophers
  where: feed-card
  lexicon: names
  spare words: life
  confirm: model
  ask noul: Is this video about the ideas or books of this philosopher, and not about his life?
  flag at: 0.8
  action: feed-card=blank
`;
const LIFE_LEX = { names: parseLexicon("0.95 | /\\bdavid hume(?:'s)?\\b/\n0.95 | immanuel kant", 'names'), life: parseLexicon('0.95 | biography\n0.95 | influence on\n0.95 | was born', 'life') };
const lifeEngine = (backend = null) => { const { rules, errors } = parseRules(LIFE_RULES); assert.deepEqual(errors, []); return new Engine({ rules, lexicons: LIFE_LEX, settings: {}, backend }); };

test('a title about the life of the author is lowered by `spare words`; a title about his ideas is flagged, as before', async () => {
  const life = lifeEngine().evaluateQuick({ title: "David Hume's Influence on John Henry Newman", channel: '' }, 'feed-card').results[0];
  assert.equal(life.flagged, false);
  assert.equal(life.wordsSpared, true);
  assert.ok(Math.abs(life.p - (0.8 - SPARE_DROP)) < 1e-9);
  assert.equal(lifeEngine().evaluateQuick({ title: 'David Hume on miracles: a lecture', channel: '' }, 'feed-card').results[0].flagged, true);
  assert.equal(lifeEngine().evaluateQuick({ title: 'The biography of Immanuel Kant', channel: '' }, 'feed-card').results[0].flagged, false);
});

test('with a model the band decides on the life; and a title about the person with no word of a life is overruled by a model that says it is not about the books', async () => {
  const yes = await lifeEngine(new Model(0.95)).evaluate({ title: 'David Hume was born in Edinburgh', channel: '' }, 'feed-card');
  assert.equal(yes.results[0].flagged, true, 'the model says it is about his ideas: flagged');
  const no = await lifeEngine(new Model(0.05)).evaluate({ title: 'David Hume: an Edinburgh man in Paris', channel: '' }, 'feed-card');
  assert.equal(no.results[0].flagged, false);
  assert.equal(no.results[0].vetoed, true, 'a strong hit that no word of a life lowers is still overruled by the model (confirm: model)');
});

test('the six rules on authors of the Index spare a title about a life, ask the model to confirm, and the other rules do not', () => {
  const books = shipped.filter((r) => r.id.startsWith('index_') && r.where.includes('feed-card') && r.group === 'anticatholic' && ['index_freethinkers', 'index_jesus_critics', 'index_modernists', 'index_philosophers', 'index_historians', 'index_novelists'].includes(r.id));
  assert.equal(books.length, 6);
  for (const r of books) { assert.equal(r.spareWords, 'life_words', r.id); assert.equal(r.confirm, 'model', r.id); assert.match(r.asks[0].question, /not about the life of (?:the |its )?(?:person|historian|author|writer)/, `${r.id}: the question says that a life is not what it asks for`); }
  assert.deepEqual(shipped.filter((r) => r.spareWords).map((r) => r.id).sort(), books.map((r) => r.id).sort());
});

test('the words of a life hit the titles of lives and never a title of a book on the Index lists', () => {
  assert.deepEqual(shippedLex.life_words.errors, []);
  const m = makeMatcher({ life_words: shippedLex.life_words });
  const hit = (t) => m.match(tokenize(t), ['life_words']).length > 0;
  for (const t of ["David Hume's Influence on John Henry Newman", 'The life of David Hume: a short biography', 'Victor Hugo in exile on Guernsey', 'Spinoza was born in Amsterdam', 'Alfred Loisy: his life and his excommunication']) assert.ok(hit(t), t);
  for (const t of ["Ernest Renan's Life of Jesus: a summary", 'Hume on miracles: a lecture', "Voltaire's Candide: summary and analysis", "Gibbon's Decline and Fall: the audiobook", 'Draper: History of the Conflict between Religion and Science']) assert.ok(!hit(t), t);
  // no plain entry (a name or the title of a book) of the six lists is hit: a book called "History of ..." or "Life of ..." must stay a strong cue
  for (const name of ['index_freethinkers', 'index_jesus_critics', 'index_modernists', 'index_philosophers', 'index_historians', 'index_novelists']) {
    for (const e of shippedLex[name].entries) {
      if (e.kind === 'regex' || String(e.raw).startsWith('/')) continue;
      assert.ok(!hit(String(e.raw).replace(/\*/g, '')), `${name}: "${e.raw}" is hit by life_words`);
    }
  }
});
