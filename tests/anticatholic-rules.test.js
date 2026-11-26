import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseRules, splitLine } from '../extension/src/core/rules.js';
import { parseLexicon } from '../extension/src/core/lexicon.js';
import { Engine } from '../extension/src/core/engine.js';

// The group "anticatholic" ("Anti-Catholicism"), part two of 2026-11-26: Freemasonry moved into it, and nine rules were added (Communism and socialism, Modernism,
// Spiritism, and six categories of the books of the Index of Forbidden Books). Two kinds of rule, as the rule author said:
//  - the ideologies (Freemasonry, Communism, Modernism, Spiritism) flag what PRESENTS, TEACHES, PROMOTES or DEFENDS the thing and spare what warns against it from the
//    Catholic side (a talk, an encyclical, a refutation, a history of the persecution);
//  - the book categories flag a video ABOUT those authors or their works ("videos discussing these kinds of banned book authors"), whatever it says of them;
//    they spare only namesakes: a street, a school, a hotel, a pet, a band.
// This file pins the settings, the interpretation and the false alarms that rules.md and research/index-of-forbidden-books.md describe.
const ROOT = new URL('../extension/', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const readRoot = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { rules, errors } = parseRules(['vianney.en.rules', 'vianney.media.en.rules'].map((f) => read(`rules/${f}`)).join('\n\n'));
const lexicons = {};
for (const f of readdirSync(new URL('lexicon/', ROOT))) lexicons[f.replace(/\.txt$/, '')] = parseLexicon(read(`lexicon/${f}`), f);
const byId = Object.fromEntries(rules.map((r) => [r.id, r]));

const IDEOLOGIES = ['freemasonry', 'communism', 'modernism', 'spiritism'];
const NEW_IDEOLOGIES = ['communism', 'modernism', 'spiritism'];
const BOOKS_ON = ['index_freethinkers', 'index_jesus_critics', 'index_modernists'];
const BOOKS_OFF = ['index_philosophers', 'index_historians', 'index_novelists'];
const BOOKS = [...BOOKS_ON, ...BOOKS_OFF];
const NEW_RULES = [...NEW_IDEOLOGIES, ...BOOKS];

// the three book rules that ship off are switched on here, so that their word lists are tried
const ALL_ON = { ruleEnabled: Object.fromEntries(rules.map((r) => [r.id, true])) };
const engine = (settings = ALL_ON, backend = null) => new Engine({ rules, lexicons, settings, backend });
const stage = (id, line) => { const e = engine(); const item = splitLine(line); return e.lexiconStage(byId[id], e.textFor(item, 'feed-card'), item.channel); };
const flaggedBy = (title, ids, surface = 'feed-card') => engine().evaluateQuick(surface === 'comment' ? { text: title } : { title, channel: '' }, surface).flagged.filter((f) => ids.includes(f.ruleId)).map((f) => f.ruleId);
class Model {
  constructor(p) { this.p = p; this.enabled = true; this.mediaEnabled = {}; }
  async askNoul() { return { p: this.p }; }
  async askScore() { return { p: this.p }; }
}

test('the pack parses cleanly: 55 rules, 49 with a word list, 27 of them on', () => {
  assert.deepEqual(errors, []);
  assert.equal(rules.length, 55);
  const text = rules.filter((r) => r.lexicon.length);
  assert.equal(text.length, 49);
  assert.equal(text.filter((r) => r.enabled).length, 27);
  assert.equal(Object.keys(lexicons).length, 54);      // 52 word lists for the rules, catholic_channels (the channel names that spare a card) and life_words (the words of a life, which spare a book rule)
});

test('the rules of the group "anticatholic" come in the order that rules.md documents, and Freemasonry has left the group "belief"', () => {
  assert.deepEqual(rules.filter((r) => r.group === 'anticatholic').map((r) => r.id), ['mockery_of_faith', 'anti_catholic', 'divination', 'occult', 'freemasonry', 'communism', 'modernism',
    'spiritism', 'index_freethinkers', 'index_jesus_critics', 'index_modernists', 'index_philosophers', 'index_historians', 'index_novelists']);
  assert.ok(!rules.filter((r) => r.group === 'belief').some((r) => r.id === 'freemasonry'));
  assert.equal(byId.freemasonry.group, 'anticatholic');
});

test('the ideology rules look at lists, recommended videos, comments and the video page; the book rules do not look at comments; Freemasonry keeps its three surfaces', () => {
  for (const id of NEW_IDEOLOGIES) {
    const r = byId[id];
    assert.deepEqual(r.where, ['feed-card', 'related', 'comment', 'watch-meta'], `${id}: where`);
    assert.deepEqual(r.action, { 'feed-card': 'blank', related: 'blank', comment: 'blur', 'watch-meta': 'warn-overlay' }, `${id}: action (a comment is blurred, the default)`);
    assert.equal(r.enabled, true, `${id}: on`);
  }
  assert.deepEqual(byId.freemasonry.where, ['feed-card', 'related', 'watch-meta']);
  for (const id of BOOKS) assert.deepEqual(byId[id].where, ['feed-card', 'related', 'watch-meta'], `${id}: where`);
  for (const id of BOOKS_ON) { assert.equal(byId[id].enabled, true, id); assert.deepEqual(byId[id].action, { 'feed-card': 'blank', related: 'blank', 'watch-meta': 'warn-overlay' }, id); }
  for (const id of BOOKS_OFF) { assert.equal(byId[id].enabled, false, id); assert.deepEqual(byId[id].action, { 'feed-card': 'dim', related: 'dim', 'watch-meta': 'label' }, id); }
  for (const id of [...NEW_RULES, 'freemasonry']) {
    assert.equal(byId[id].gate, 'lexicon', id);
    assert.equal(byId[id].flagAt, 0.8, id);
    assert.equal(byId[id].band, null, id);
    assert.equal(byId[id].group, 'anticatholic', id);
  }
});

test('every new rule has a plain name, a sentence, 2 to 6 examples, 1 to 12 spared titles (the owner added real titles of Catholic channels on 2026-11-26), one yes/no question and a source line that says what it rests on and that applying it is a choice', () => {
  for (const id of [...NEW_RULES, 'freemasonry']) {
    const r = byId[id];
    assert.ok(r.name && r.name !== r.title, `${id}: a plain name that differs from the title`);
    assert.ok(r.plain.length > 20 && r.plain.length < 160, `${id}: plain is ${r.plain.length} characters`);
    assert.ok(!/feed-card|watch-meta|lexicon|gate|\bflag\b/i.test(r.name + ' ' + r.plain), `${id}: plain words`);
    assert.ok(r.examples.length >= 2 && r.examples.length <= 6, `${id}: ${r.examples.length} examples`);
    assert.ok(r.spared.length >= 1 && r.spared.length <= 12, `${id}: ${r.spared.length} spared titles`);
    assert.equal(r.asks.length, 1, id);
    assert.equal(r.asks[0].type, 'noul', id);
    const q = r.asks[0].question;
    assert.match(q, /\?$/, id);
    assert.ok(q.length >= 100 && q.length <= 400, `${id}: question of ${q.length} characters`);
    assert.match(r.source, /choice of the rule author/i, `${id}: the source line says that applying it is the rule author's choice`);
    assert.ok(!/^Choice of the rule author$/.test(r.source), `${id}: and says more: which text, which canon`);
  }
  for (const id of IDEOLOGIES) assert.match(byId[id].asks[0].question, /\bnot warn against\b|not explain or warn against\b/, `${id}: the question spares a Catholic warning`);
  for (const id of BOOKS) assert.match(byId[id].asks[0].question, /^Is this video about\b.*\band not about\b/, `${id}: "Is this video about <the authors or works>, and not about <a namesake>?"`);
  for (const id of BOOKS) assert.ok(!/warn against|Catholic viewpoint/.test(byId[id].asks[0].question), `${id}: a book rule does not spare a Catholic critique of an author: it still discusses him`);
});

test('the sources that the rules name are the ones that rules.md quotes', () => {
  assert.match(byId.communism.source, /Holy Office decree of 1 July 1949 \(AAS 41, p\. 334\).*Syllabus of Errors, section IV.*Quod apostolici muneris.*Divini Redemptoris 58.*Catechism 2425/);
  assert.match(byId.modernism.source, /Pascendi dominici gregis \(1907\).*canon 1399, 6/);
  assert.match(byId.spiritism.source, /De spiritismo, 24 April 1917 \(AAS 9, p\. 268\).*Catechism of St\. Pius X.*canon 1399, 7/);
  for (const id of BOOKS) assert.match(byId[id].source, /^Index of Forbidden Books \(1948 and the decrees to 1961\), canon 1399, [\d, and]+\. The categories are a choice of the rule author$/, id);
  const md = readRoot('rules.md');
  for (const id of [...NEW_RULES, 'freemasonry']) assert.ok(md.includes(byId[id].source), `${id}: rules.md holds the source line`);
});

// ---------------------------------------------------------------- the ideologies: what presents is flagged, what warns is spared
const PROMOTION = [
  ['freemasonry', 'Masonic lodge initiation: what happens in the first degree'], ['freemasonry', 'Why you should join the Freemasons: the benefits of being a Mason'],
  ['freemasonry', 'Join the Freemasons today'], ['freemasonry', 'Why I joined the Freemasons'], ['freemasonry', 'I am a Freemason and proud: AMA'], ['freemasonry', 'Masonic charity: how the lodge helps your community'],
  ['freemasonry', 'Freemasonry is not a religion: setting the record straight'], ['freemasonry', 'Masonic rituals revealed'], ['freemasonry', 'Scottish Rite degrees: the ritual explained'],
  ['communism', 'Why communism works: the case for a classless society'], ['communism', 'Workers of the world, unite! Join the Communist Party'], ['communism', 'Why I am a communist'],
  ['communism', 'Long live socialism!'], ['communism', 'Socialism is the answer'], ['communism', 'Seize the means of production: a leftist primer'],
  ['modernism', 'Dogma evolves: why the Church must change with the times'], ['modernism', 'The Church must change its teaching on contraception'], ['modernism', 'Doctrine evolves, and that is good'],
  ['spiritism', 'Spiritist center in Sao Paulo: a visit'], ['spiritism', 'Spiritualist church service live'], ['spiritism', 'How to communicate with the dead: a mediumship class'],
];
// titles that hold the same cue and a Catholic marker or a word of warning: they fall under the flag-at level and wait for the model
const WARNING = [
  ['freemasonry', 'Why a Catholic cannot join the Masonic lodge: the 1983 declaration'], ['freemasonry', 'Beware the Masonic lodge: initiation rites'], ['freemasonry', 'A priest warns Catholics about the dangers of Freemasonry'],
  ['freemasonry', 'Freemasonry and the Church: a history of the condemnations'], ['freemasonry', 'Masonic lodge initiation exposed by a former Catholic'], ['freemasonry', 'Pope Leo XIII on Freemasonry: Humanum genus'],
  ['freemasonry', 'Why the Church forbids you to join the Freemasons'], ['freemasonry', 'The Masonic lodge: a warning'],
  ['communism', 'Why communism works (a Catholic reply)'], ['communism', 'Communism works? Tell that to the victims'], ['communism', 'Fatima and the errors of Russia: a Catholic talk'],
  ['communism', 'Divini Redemptoris: the Church on atheistic communism'], ['communism', 'Priests and nuns who suffered under communism: a documentary'], ['communism', 'Why a Catholic cannot be a socialist: Quadragesimo anno'],
  ['communism', 'The Cold War explained: the Soviet Union from 1945 to 1991'], ['communism', 'The Black Book of Communism: crimes of the regime'],
  ['modernism', 'Modernists say dogma evolves: why they are wrong'], ['modernism', 'Pascendi dominici gregis: Pius X on the errors of Modernism'], ['modernism', 'Newman and the development of doctrine: a Catholic lecture'],
  ['modernism', 'Does doctrine evolve? A priest explains'], ['modernism', 'Faith is not a feeling: a homily'],
  ['spiritism', 'Is Spiritism compatible with the Catholic faith? A priest answers'], ['spiritism', 'A priest warns: the dangers of the Spiritist center'], ['spiritism', 'Praying for the dead: the Catholic doctrine on purgatory'],
  ['spiritism', 'The haunted house: a ghost story (horror film)'],
];

test('an invitation, a praise, a slogan or a flat statement of the doctrine is flagged by the word list alone', () => {
  for (const [id, title] of PROMOTION) assert.deepEqual(flaggedBy(title, [id]), [id], `${id}: "${title}"`);
});

test('a Catholic warning, a refutation, a history or a documentary is never flagged by the word list alone, and is left alone when the model says no', async () => {
  for (const [id, title] of WARNING) {
    assert.deepEqual(flaggedBy(title, IDEOLOGIES), [], `"${title}" must not be flagged by a word list`);
    const no = await engine({}, new Model(0)).evaluate({ title, channel: '' }, 'feed-card');
    assert.ok(!no.flagged.some((f) => f.ruleId === id), `${id}: "${title}" must be left alone when the model says no`);
  }
});

test('the same cue with a Catholic marker or a word of warning added falls from 0.95 to the model band (Freemasonry, Communism, Modernism, Spiritism)', () => {
  const PAIRS = [
    ['freemasonry', 'Join the Freemasons today', 'Join the Freemasons today? A Catholic answers'],
    ['freemasonry', 'Masonic lodge initiation: what happens', 'Beware: Masonic lodge initiation: what happens'],
    ['freemasonry', 'Masonic charity: how the lodge helps your community', 'Masonic charity: the Church condemns it'],
    ['communism', 'Why communism works', 'Why communism works: a warning'],
    ['communism', 'Workers of the world, unite!', 'Workers of the world, unite! How the Church answered'],
    ['modernism', 'Doctrine evolves, and that is good', 'Doctrine evolves, and that is a heresy'],
    ['modernism', 'The Church must change with the times', 'The Church must change with the times: Pius X on the error'],
    ['spiritism', 'Spiritist center in Sao Paulo: a visit', 'Spiritist center in Sao Paulo: a Catholic priest visits'],
    ['spiritism', 'How to communicate with the dead', 'How to communicate with the dead: why the Church warns against it'],
  ];
  for (const [id, flat, held] of PAIRS) {
    assert.equal(stage(id, flat).pLex, 0.95, `${id}: "${flat}"`);
    const s = stage(id, held);
    assert.equal(s.pLex, 0.75, `${id}: "${held}" falls to 0.75 (got ${s.pLex})`);
    assert.equal(s.needsModel, true, `${id}: "${held}" is for the model`);
  }
});

test('a question is not the flat statement: "Does doctrine evolve?", "Can the Church change its teaching?" and "Is faith a feeling?" are not matched at 0.95', () => {
  for (const t of ['Does doctrine evolve? A priest explains', 'Can the Church change its teaching? A Catholic answer', 'Does dogma evolve? Newman and Vincent of Lerins', 'How doctrine evolves: Newman on development']) {
    assert.ok(stage('modernism', t).pLex < 0.8, t);
  }
});

test('Freemasonry: stone masonry, masons of the trade and a mason jar are not cues, and "become a mason" waits for the model', () => {
  for (const t of ['Stone masonry: how to build a dry stone wall', 'Medieval masons and the great cathedrals', 'Mason jar crafts for the kitchen', 'Perry Mason: season one recap', 'Brick and masonry wall repair']) {
    assert.equal(stage('freemasonry', t).pLex, 0, t);
  }
  const s = stage('freemasonry', 'How to become a mason: a bricklayer career');
  assert.equal(s.pLex, 0.75);
  assert.equal(s.needsModel, true);
});

test('every example and every spared title of the new rules is run again here, with the model saying yes and no', async () => {
  for (const id of [...NEW_RULES, 'freemasonry']) {
    const r = byId[id];
    const on = { ruleEnabled: { [id]: true } };
    for (const title of r.examples) {
      const yes = await engine(on, new Model(1)).evaluate(splitLine(title), 'feed-card');
      assert.ok(yes.flagged.some((f) => f.ruleId === id), `${id}: example "${title}" is flagged when the model says yes`);
    }
    for (const title of r.spared) {
      const yes = await engine(on, new Model(1)).evaluate(splitLine(title), 'feed-card');
      const quick = engine(on).evaluateQuick(splitLine(title), 'feed-card');
      assert.ok(!quick.flagged.some((f) => f.ruleId === id), `${id}: spared "${title}" is not flagged by the words`);
      if (stage(id, title).needsModel === false) assert.ok(!yes.flagged.some((f) => f.ruleId === id), `${id}: spared "${title}" holds no cue in the model band, so even a yes is not asked`);
    }
  }
});

test('the three new ideology rules also look at comments: a flat statement in a comment is flagged and blurred, a Catholic comment is not', () => {
  const e = engine();
  const hit = e.evaluateQuick({ text: 'Why communism works: workers of the world, unite!' }, 'comment');
  assert.deepEqual(hit.flagged.map((f) => f.ruleId), ['communism']);
  assert.equal(hit.action, 'blur');
  assert.deepEqual(flaggedBy('The Church must change with the times. Dogma evolves!', ['modernism'], 'comment'), ['modernism']);
  assert.deepEqual(flaggedBy('How to communicate with the dead: join our spiritist center', ['spiritism'], 'comment'), ['spiritism']);
  assert.deepEqual(flaggedBy('Communism is intrinsically wrong, says Pius XI, and the Church said so at Fatima', IDEOLOGIES, 'comment'), []);
  assert.deepEqual(flaggedBy('Voltaire, Rousseau and Diderot were all on the Index', BOOKS, 'comment'), []);
  assert.deepEqual(engine({}).rulesFor('comment').filter((r) => r.group === 'anticatholic').map((r) => r.id), ['communism', 'modernism', 'spiritism']);
  assert.deepEqual(e.rulesFor('comment').filter((r) => r.group === 'anticatholic').map((r) => r.id), ['mockery_of_faith', 'communism', 'modernism', 'spiritism']);
});

// ---------------------------------------------------------------- the books: a video about the author is flagged; a namesake is not
const ABOUT = [
  ['index_freethinkers', "Voltaire's Candide: summary and analysis"], ['index_freethinkers', "Baron d'Holbach and the System of Nature: a lecture"], ['index_freethinkers', 'Jules Michelet on the priest and the Jesuits: a reading'],
  ['index_freethinkers', 'Why a Catholic should read Candide by Voltaire'], ['index_freethinkers', 'Draper: History of the Conflict between Religion and Science'], ['index_freethinkers', 'Jean Meslier: the atheist priest'],
  ['index_jesus_critics', "Ernest Renan's Life of Jesus: a summary"], ['index_jesus_critics', 'David Friedrich Strauss and the myth of the Gospels'], ['index_jesus_critics', 'Steinmann: La Vie de Jésus'],
  ['index_jesus_critics', 'Louis Jacolliot: La Bible dans l\'Inde'], ['index_jesus_critics', 'Charles Guignebert and the historical Jesus'],
  ['index_modernists', 'Alfred Loisy and the Gospel and the Church: a modernist priest'], ['index_modernists', "Fogazzaro's The Saint: the novel the Church forbade"], ['index_modernists', 'George Tyrrell and the modernist crisis: a life'],
  ['index_modernists', 'Ernesto Buonaiuti: an excommunicated priest'],
  ['index_philosophers', 'Immanuel Kant explained in ten minutes'], ['index_philosophers', "Spinoza's Ethics: a beginner's guide"], ['index_philosophers', 'David Hume: the problem of induction'],
  ['index_philosophers', 'Jean-Jacques Rousseau and the general will'], ['index_philosophers', 'Jean-Paul Sartre and existentialism'], ['index_philosophers', 'Simone de Beauvoir: The Second Sex'],
  ['index_philosophers', 'John Stuart Mill: On Liberty'], ['index_philosophers', 'Thomas Hobbes: Leviathan summary'], ['index_philosophers', 'Giordano Bruno: burned at the stake'],
  ['index_historians', 'Edward Gibbon and the fall of Rome: a lecture'], ['index_historians', "Gibbon's Decline and Fall: the audiobook"], ['index_historians', 'Leopold von Ranke and the history of the popes'],
  ['index_novelists', 'Les Misérables (2012): One Day More'], ['index_novelists', 'Madame Bovary: summary and analysis'], ['index_novelists', "Victor Hugo's poems"], ['index_novelists', 'Alexandre Dumas: The Count of Monte Cristo summary'],
  ['index_novelists', 'Honoré de Balzac and the human comedy'], ['index_novelists', 'Emile Zola: J\'accuse and the Dreyfus affair'], ['index_novelists', 'George Sand and Chopin: a love story'], ['index_novelists', 'Pamela, or Virtue Rewarded by Samuel Richardson'],
];
// a namesake: a street, a school, a hotel, a pet, a band, a cathedral, another person. None may be flagged by the words; those with a bare surname wait for the model.
const NAMESAKE = [
  'Hotel Victor Hugo Paris review', 'Victor Hugo metro station, Paris', 'Rue Alexandre Dumas: a walk', "Victor Hugo's house in Guernsey", 'Notre-Dame de Paris: the fire and the rebuilding of the cathedral',
  'Notre-Dame de Paris, the musical', 'George Sanders: the actor\'s best roles', 'Sand dunes of the Sahara', 'Zola Budd: the runner\'s story', 'Stendhal syndrome: why art makes people faint', 'Casanova: the 2005 movie with Heath Ledger',
  'Pamela Anderson: new documentary', 'Heine ketchup commercial', 'Dumas, Texas: a small town', 'Calvin and Hobbes: the best strips of the year', 'Locke & Key: season one recap', 'Berkeley campus tour',
  'Hume Highway road trip: Sydney to Melbourne', 'John Locke from Lost: character analysis', 'Henri Rousseau: the painter', 'Diderot: Paris Diderot University admissions', 'Croce and the aesthetics of Italy',
  'Voltaire the French bulldog: our puppy\'s first week', 'Rue Voltaire: a walk through the 11th arrondissement of Paris', 'Voltaire Network: news', 'Renan vs Neymar: football highlights of the week',
  'Renan Santos interview', 'Strauss: Also sprach Zarathustra with the Vienna Philharmonic', 'Gibbons at the zoo: how the apes swing', 'The decline and fall of the Roman Empire: a documentary',
  'The Murri people of Queensland: history and culture', 'Loisy: the village in Meurthe-et-Moselle', 'Kazantzakis airport, Heraklion: arrivals', 'The Last Temptation of Christ (1988) film review',
  'Gentile bar mitzvah guests: etiquette', 'Comte cheese: the best cuts', 'Mill Valley travel guide', 'Simon Cowell: the best auditions',
];

test('a video about a banned author or his work is flagged by the word list alone when it names him in full or names the work (unless it carries a word of a life: see tests/channel-guard.test.js)', () => {
  for (const [id, title] of ABOUT) {
    const hit = flaggedBy(title, BOOKS);
    assert.ok(hit.includes(id), `${id}: "${title}" is flagged (got ${hit.join(',') || 'nothing'})`);
  }
});

test('a namesake is never flagged by the word list alone: a street, a hotel, a cathedral, a pet, a school, another person', () => {
  for (const t of NAMESAKE) assert.deepEqual(flaggedBy(t, BOOKS), [], `"${t}" must not be flagged by a word list`);
});

test('a namesake that holds a bare surname waits for the model, and is left alone when it says no', async () => {
  const WAITS = [['index_freethinkers', 'Voltaire the French bulldog: our puppy\'s first week'], ['index_freethinkers', 'Rue Voltaire: a walk through the 11th arrondissement of Paris'],
    ['index_novelists', 'Hotel Victor Hugo Paris review'], ['index_novelists', 'Zola Budd: the runner\'s story'], ['index_philosophers', 'Hume Highway road trip: Sydney to Melbourne'],
    ['index_jesus_critics', 'Renan Santos interview'], ['index_modernists', 'Loisy: the village in Meurthe-et-Moselle']];
  for (const [id, title] of WAITS) {
    const s = stage(id, title);
    assert.equal(s.pLex, 0.75, `${id}: "${title}"`);
    assert.equal(s.needsModel, true, `${id}: "${title}" is for the model`);
    const no = await engine({ ruleEnabled: { [id]: true } }, new Model(0)).evaluate({ title, channel: '' }, 'feed-card');
    assert.ok(!no.flagged.some((f) => f.ruleId === id), `${id}: left alone when the model says no`);
    const yes = await engine({ ruleEnabled: { [id]: true } }, new Model(1)).evaluate({ title, channel: '' }, 'feed-card');
    assert.ok(yes.flagged.some((f) => f.ruleId === id), `${id}: flagged when the model says yes`);
  }
});

test('the Index lists are used by the rules that rules.md says: each book rule has its own list, Communism and Spiritism take the names of their doctrine, Modernism has a rule for the authors', () => {
  for (const id of BOOKS) assert.deepEqual(byId[id].lexicon, [id], id);
  assert.deepEqual(byId.communism.lexicon, ['communism_cues', 'index_socialists']);
  assert.deepEqual(byId.spiritism.lexicon, ['spiritism_cues', 'index_spiritists']);
  assert.deepEqual(byId.modernism.lexicon, ['modernism_cues']);
  assert.deepEqual(byId.freemasonry.lexicon, ['freemasonry_cues']);
  const used = new Set(rules.flatMap((r) => [...r.lexicon, ...(r.spareChannel ? [r.spareChannel] : []), ...(r.spareWords ? [r.spareWords] : [])]));
  for (const name of Object.keys(lexicons)) assert.ok(used.has(name), `${name} is used by a rule`);
});

// ---------------------------------------------------------------- the lists
const entriesOf = (name) => lexicons[name].entries;
const guardless = (raw) => {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    if (/^\(\?(<!|!|<=|=)/.test(raw.slice(i))) {
      let depth = 0;
      for (; i < raw.length; i++) {
        if (raw[i] === '\\') { i++; continue; }
        if (raw[i] === '(') depth++;
        if (raw[i] === ')' && --depth === 0) break;
      }
      continue;
    }
    out += raw[i];
  }
  return out;
};

test('the cue lists of the ideologies keep to the four tiers and a size that can be read; the flat statements are at 0.95 and guarded, and every guard stands behind the cue', () => {
  const SIZES = { freemasonry_cues: [25, 45], communism_cues: [40, 60], modernism_cues: [20, 40], spiritism_cues: [15, 35] };
  for (const [name, [lo, hi]] of Object.entries(SIZES)) {
    const lex = lexicons[name];
    assert.deepEqual(lex.errors, [], name);
    assert.ok(lex.entries.length >= lo && lex.entries.length <= hi, `${name}: ${lex.entries.length} entries`);
    for (const e of lex.entries) assert.ok([0.95, 0.75, 0.5, 0.15].includes(e.weight), `${name}: weight ${e.weight}`);
    const flat = lex.entries.filter((e) => e.weight === 0.95);
    assert.ok(flat.length >= 3, `${name}: at least three entries flag by themselves`);
    for (const e of flat) {
      assert.equal(e.kind, 'regex', `${name}: a 0.95 cue is a pattern with a guard`);
      assert.match(e.raw, /\\b\(\?<!\\b\(\?:/, `${name}: "${e.raw.slice(0, 60)}" carries a guard`);
      assert.ok(!/^\/(\(\?<!|\(\?<=)/.test(e.raw) || /^\/\(\?<!\\b\(\?:[a-z|]+\) \)\\b/.test(e.raw), `${name}: a lookbehind in front of a cue is only the short fixed list of question words`);
    }
  }
});

test('no cue list of these rules names a private person, uses a word of contempt, or holds a conspiracy word; only Marx and Engels are named, and they are authors of the doctrine', () => {
  const PERSONS = ['stalin', 'lenin', 'trotsky', 'mao', 'hitler', 'castro', 'guevara', 'putin', 'pike', 'hiram', 'abiff', 'newman', 'pius', 'francis', 'benedict'];
  const CONTEMPT = ['commie', 'commies', 'reds', 'leftard', 'libtard', 'papist', 'papists', 'heathen', 'heathens', 'infidel', 'infidels', 'cultist', 'cultists', 'kike', 'garbage', 'trash', 'scum', 'filth'];
  const CONSPIRACY = ['illuminati', 'cabal', 'globalist', 'globalists', 'conspiracy', 'conspiracies', 'elite', 'elites', 'puppet', 'puppets', 'hoax', 'lizard', 'new world order', 'deep state'];
  for (const name of ['freemasonry_cues', 'communism_cues', 'modernism_cues', 'spiritism_cues']) {
    for (const e of entriesOf(name)) {
      const body = e.kind === 'regex' ? guardless(e.raw) : e.raw;
      const ws = body.toLowerCase().match(/[a-z0-9']+/g) || [];
      for (const w of ws) {
        const w2 = w.replace(/\*$/, '');
        assert.ok(!CONTEMPT.includes(w2), `${name}: "${e.raw.slice(0, 60)}" holds the word of contempt "${w}"`);
        assert.ok(!CONSPIRACY.includes(w2), `${name}: "${e.raw.slice(0, 60)}" holds the conspiracy word "${w}"`);
        assert.ok(!PERSONS.includes(w2), `${name}: "${e.raw.slice(0, 60)}" names a person ("${w}")`);
      }
    }
  }
  const named = entriesOf('communism_cues').filter((e) => /\b(karl marx|friedrich engels)\b/.test(e.raw)).map((e) => e.raw);
  assert.deepEqual(named.sort(), ['friedrich engels', 'karl marx']);
});

test('the cues of the lists on Communism and Spiritism that the rule author said must wait: history, documentaries, martyrs and séances are not at 0.95; seance, ouija and psychics stay in the list on divination', () => {
  for (const t of ['The Cold War explained', 'The fall of the Berlin Wall: documentary', 'Priests who died in the gulag', 'Soviet space program history', 'Karl Marx explained in five minutes', 'The Communist Manifesto audiobook']) {
    assert.ok(stage('communism', t).pLex < 0.8, t);
  }
  const spiritism = new Set([...entriesOf('spiritism_cues'), ...entriesOf('index_spiritists')].map((e) => e.raw));
  const divination = ['seance*', 'ouija', 'spirit medium*', 'psychic*', 'channeling', 'channelling'];
  for (const d of divination) assert.ok(!spiritism.has(d), `${d} stays in divination_cues`);
  assert.ok(entriesOf('divination_cues').some((e) => e.raw === 'seance*') && entriesOf('divination_cues').some((e) => e.raw === 'ouija'));
});

test('no plain cue of the twelve lists of part two is also in another list of the pack (the cues of divination, occult, sects, naturalism, protestantism and the others are not repeated)', () => {
  const mine = ['freemasonry_cues', 'communism_cues', 'modernism_cues', 'spiritism_cues', ...Object.keys(lexicons).filter((n) => n.startsWith('index_'))];
  const seen = new Map();
  for (const [name, lex] of Object.entries(lexicons)) {
    for (const e of lex.entries) {
      if (e.kind !== 'phrase') continue;
      const key = e.raw.toLowerCase();
      if (!seen.has(key)) seen.set(key, new Set());
      seen.get(key).add(name);
    }
  }
  for (const [key, names] of seen) {
    if ([...names].some((n) => mine.includes(n))) assert.equal(names.size, 1, `"${key}" is in ${[...names].join(' and ')}`);
  }
});

test('a very long description costs nothing: the guards and the namesake patterns are looked at only where a cue has matched', () => {
  const words = 'the quick brown fox jumps over the lazy dog and sings about gardens bread music history travel science cooking weather sports news hotel street school'.split(' ');
  const text = Array.from({ length: 20000 }, (_, i) => words[(i * 7 + (i >> 3)) % words.length]).join(' ');
  const e = engine();
  for (const id of [...NEW_RULES, 'freemasonry']) {
    const t0 = performance.now();
    e.lexiconStage(byId[id], text);
    const ms = performance.now() - t0;
    assert.ok(ms < 1000, `${id}: a text of ${text.length} characters took ${Math.round(ms)} ms`);
  }
  // and where cues do occur, over and over, with a guard word far away
  const dense = ('why communism works workers of the world unite masonic lodge initiation victor hugo voltaire candide dogma evolves ' + text.slice(0, 200) + ' ').repeat(40);
  const t1 = performance.now();
  for (const id of [...NEW_RULES, 'freemasonry']) e.lexiconStage(byId[id], dense);
  assert.ok(performance.now() - t1 < 1500, `a dense text of ${dense.length} characters (forty times every cue) took ${Math.round(performance.now() - t1)} ms`);
});

// ---------------------------------------------------------------- rules.md
test('rules.md says what the pack says about the new rules: a heading, a link, the entry counts of their lists, the group, the order and the interpretation', () => {
  const md = readRoot('rules.md');
  const section = (id) => { const m = md.match(new RegExp(`^### ${id}:[\\s\\S]*?(?=^### |^## )`, 'm')); assert.ok(m, `rules.md has a section for ${id}`); return m[0]; };
  for (const id of [...NEW_RULES, 'freemasonry']) {
    const r = byId[id];
    const state = r.enabled ? 'enabled' : 'disabled';
    assert.ok(md.includes(`\n### ${r.id}: ${r.title} (${state}) {#${r.id}}\n`), `${id}: heading`);
    assert.ok(md.includes(`\n- [${r.id}](#${r.id}): ${r.title} (${state})\n`), `${id}: link`);
    const s = section(id);
    for (const name of r.lexicon) {
      assert.ok(s.includes(`- Lexicon: ${name} (${lexicons[name].entries.length} entries)`) || s.includes(`  - ${name} (${lexicons[name].entries.length} entries)`), `${id}: rules.md states ${lexicons[name].entries.length} entries for ${name}`);
    }
    assert.match(s, /Default: (Enabled|Disabled)/, `${id}: says its default`);
    assert.ok(s.includes(`Question: ${r.asks[0].question}`), `${id}: the section holds the question as shipped`);
  }
  const order = 'mockery_of_faith, anti_catholic, divination, occult, freemasonry, communism, modernism, spiritism, index_freethinkers, index_jesus_critics, index_modernists, index_philosophers, index_historians, index_novelists';
  assert.ok(md.includes(order), 'rules.md names the order of the group');
  assert.match(md, /videos discussing these kinds of banned book authors/, 'and the rule author\'s words on the book categories');
  assert.match(md, /Anti-Catholicism/);
  for (const line of md.split('\n').filter((l) => l.includes('Faith and superstition'))) assert.ok(line.includes('Anti-Catholicism'), `the old group name stands only beside the new one: ${line.slice(0, 80)}`);
});
