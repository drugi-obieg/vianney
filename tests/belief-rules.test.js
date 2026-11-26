import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseRules } from '../extension/src/core/rules.js';
import { parseLexicon } from '../extension/src/core/lexicon.js';
import { Engine } from '../extension/src/core/engine.js';

// The belief rules (the group "belief") and the rules that the rule author put in the group "anticatholic" (called "faith" until 2026-11-26, when he renamed it
// "Anti-Catholicism" and moved Freemasonry into it; the rules that he added to it the same day, part two, are pinned in tests/anticatholic-rules.test.js).
// They decide what a Catholic viewer sees, so the tests pin down what the rule author decided (where, how sure, what happens), the
// policy of the word lists (no names of persons, no derogatory names, the flat statement alone flags and a question or a Catholic reply does not),
// and that rules.md says the same as the pack.
const ROOT = new URL('../extension/', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const readRoot = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { rules } = parseRules(['vianney.en.rules', 'vianney.media.en.rules'].map((f) => read(`rules/${f}`)).join('\n\n'));
const lexicons = {};
for (const f of readdirSync(new URL('lexicon/', ROOT))) lexicons[f.replace(/\.txt$/, '')] = parseLexicon(read(`lexicon/${f}`), f);
const byId = Object.fromEntries(rules.map((r) => [r.id, r]));

const BELIEF = ['denial_of_god', 'naturalism', 'indifferentism', 'protestantism', 'islam', 'judaism', 'eastern_religions', 'sects'];
// freemasonry sits in the group "anticatholic" since 2026-11-26 (part two): an ideology and a society, not a religion. The older rules of the group, then the new ones.
const ANTICATHOLIC = ['mockery_of_faith', 'anti_catholic', 'divination', 'occult', 'freemasonry', 'communism', 'modernism', 'spiritism', 'index_freethinkers', 'index_jesus_critics',
  'index_modernists', 'index_philosophers', 'index_historians', 'index_novelists'];
const NEW_RULES = ['naturalism', 'indifferentism', 'protestantism', 'islam', 'judaism', 'eastern_religions', 'sects', 'freemasonry', 'anti_catholic', 'occult'];
const CHOICE = 'Choice of the rule author';
const textRules = rules.filter((r) => r.lexicon.length);

const engine = () => new Engine({ rules, lexicons, settings: {}, backend: null });
const flaggedBy = (title, ids) => engine().evaluateQuick({ title, channel: '' }, 'feed-card').flagged.filter((f) => ids.includes(f.ruleId)).map((f) => f.ruleId);

test('the settings page lists the groups in the order the rule author chose (lewdness, swearing, talk about others, then the religions, then games), and every rule belongs to one of them', () => {
  const js = readRoot('extension/src/options/options.js');
  const body = js.match(/const RULE_GROUPS = \[([\s\S]*?)\n\];/);
  assert.ok(body, 'RULE_GROUPS is in options.js');
  const ids = [...body[1].matchAll(/id: '([a-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['purity', 'speech', 'people', 'belief', 'anticatholic', 'leisure', 'pictures', 'sound']);
  assert.match(body[1], /id: 'belief', title: 'Unbelief and other religions'/);
  assert.match(body[1], /id: 'anticatholic', title: 'Anti-Catholicism'/);
  for (const r of rules) assert.ok(ids.includes(r.group), `${r.id}: group ${r.group}`);
});

test('the rules of the two groups come in the order the rule author gave (Freemasonry moved to the group "anticatholic" on 2026-11-26, part two)', () => {
  assert.deepEqual(rules.filter((r) => r.group === 'belief').map((r) => r.id), BELIEF);
  assert.deepEqual(rules.filter((r) => r.group === 'anticatholic').map((r) => r.id), ANTICATHOLIC);
});

test('the new rules have the settings the rule author decided on 2026-11-26', () => {
  for (const id of NEW_RULES) {
    const r = byId[id];
    assert.ok(r, id);
    assert.deepEqual(r.where, ['feed-card', 'related', 'watch-meta'], `${id}: where`);
    assert.equal(r.gate, 'lexicon', `${id}: gate`);
    assert.equal(r.flagAt, 0.8, `${id}: flag at`);
    assert.deepEqual(r.action, { 'feed-card': 'blank', related: 'blank', 'watch-meta': 'warn-overlay' }, `${id}: action`);
    assert.equal(r.enabled, true, `${id}: enabled`);
    assert.deepEqual(r.lexicon, [`${id}_cues`], `${id}: its own word list`);
    assert.equal(r.band, null, `${id}: the usual model band`);
    assert.ok(r.name !== r.title, `${id}: a plain name that differs from the title`);
    // Freemasonry has more: on 2026-11-26 (part two) the rule author asked for several examples of promotion and several Catholic warnings that are spared
    if (id === 'freemasonry') {
      assert.ok(r.examples.length >= 4 && r.examples.length <= 6, `${id}: 4 to 6 examples`);
      assert.ok(r.spared.length >= 4 && r.spared.length <= 12, `${id}: 4 to 12 spared titles (the owner added real titles of Catholic channels on 2026-11-26)`);
    } else {
      assert.ok(r.examples.length >= 2 && r.examples.length <= 3, `${id}: 2 to 3 examples`);
      assert.ok(r.spared.length >= 1 && r.spared.length <= 12, `${id}: 1 to 12 spared titles (the owner added real titles of Catholic channels on 2026-11-26)`);
    }
  }
  // atheism keeps its reach (comments and captions as well) and is now on
  const d = byId.denial_of_god;
  assert.deepEqual(d.where, ['feed-card', 'related', 'comment', 'watch-meta', 'subtitles']);
  assert.equal(d.enabled, true);
  assert.equal(d.name, 'Atheism');
  assert.equal(d.group, 'belief');
  assert.equal(d.action.subtitles, 'skip-segment');
  assert.equal(d.action['watch-meta'], 'warn-overlay');
  // the two older rules of the group "anticatholic" that are off stay off
  assert.equal(byId.mockery_of_faith.enabled, false);
  assert.equal(byId.divination.enabled, false);
  // Judaism and Freemasonry were added the same day, at the rule author's instruction: after Islam, and last (Freemasonry then moved to "anticatholic")
  assert.deepEqual([byId.judaism.name, byId.freemasonry.name], ['Judaism', 'Freemasonry']);
  assert.equal(byId.freemasonry.group, 'anticatholic');
  assert.deepEqual([byId.judaism.title, byId.freemasonry.title], ['Jewish religious teaching and worship', 'Freemasonry and secret societies']);
});

test('every new rule asks one yes/no question and names what the question must not catch', () => {
  for (const id of [...NEW_RULES, 'denial_of_god']) {
    const r = byId[id];
    assert.equal(r.asks.length, 1, id);
    assert.equal(r.asks[0].type, 'noul', id);
    const q = r.asks[0].question;
    assert.match(q, /\?$/, `${id}: ends with a question mark`);
    assert.ok(/\bnot\b|rather than/.test(q), `${id}: the question names an exclusion`);
    assert.ok(q.length >= 100 && q.length <= 400, `${id}: ${q.length} characters`);
  }
});

test('every text rule names a sermon of the Curé that rules.md quotes, or says that it is the choice of the rule author, or names the Church texts it rests on; and rules.md says so too', () => {
  const md = readRoot('rules.md');
  const section = (id) => { const m = md.match(new RegExp(`^### ${id}:[\\s\\S]*?(?=^### |^## )`, 'm')); assert.ok(m, `rules.md has a section for ${id}`); return m[0]; };
  // the rules that say only "Choice of the rule author": the nine of the first round, minus protestantism (a sermon) and freemasonry (which since part two names its documents)
  const ONLY_CHOICE = NEW_RULES.filter((id) => id !== 'protestantism' && id !== 'freemasonry');
  for (const r of textRules) {
    if (r.source === CHOICE) assert.ok(ONLY_CHOICE.includes(r.id), `${r.id}: only the eight new rules without a sermon and without a document say so`);
    else assert.ok(md.includes(r.source), `${r.id}: "${r.source}" is not a sermon title nor a source line in rules.md`);
  }
  assert.deepEqual(textRules.filter((r) => r.source === CHOICE).map((r) => r.id).sort(), [...ONLY_CHOICE].sort());
  assert.equal(byId.protestantism.source, 'Sur la colère');
  assert.equal(byId.denial_of_god.source, 'Sur la religion');
  for (const id of ONLY_CHOICE) {
    const s = section(id);
    assert.match(s, /choice of the rule author/i, `${id}: rules.md says plainly that the rule is the rule author's choice`);
    assert.match(s, /2026-11-26/, `${id}: and gives the date`);
    assert.match(s, /not traced to a sermon/i, `${id}: and that it is not traced to a sermon`);
  }
  // Freemasonry names canon 1399, 8 and two documents; the rule author's choice is to apply them to videos
  assert.match(byId.freemasonry.source, /Canon 1399, 8.*Humanum genus.*Declaration of 26 November 1983.*choice of the rule author/);
  assert.match(section('freemasonry'), /not traced to a sermon/i);
});

test('no word list of these rules names a person, and none uses a derogatory name for a religion or a group', () => {
  // Persons: reformers, preachers, writers against religion, founders. ("prophet muhammad" is a religious title that the rule author asked for;
  // the bare name is left out, and so is every other name below.)
  const PERSONS = ['luther', 'calvin', 'zwingli', 'knox', 'wesley', 'wycliffe', 'melanchthon', 'spurgeon', 'osteen', 'copeland', 'graham', 'hinn', 'jakes', 'hagee', 'swaggart', 'bakker',
    'macarthur', 'piper', 'robertson', 'dawkins', 'hitchens', 'dennett', 'darwin', 'nietzsche', 'voltaire', 'hubbard', 'brigham', 'mohammed', 'mohammad', 'dalai', 'tenzin', 'nanak',
    'maimonides', 'rashi', 'hillel', 'shammai', 'schneerson', 'pike', 'hiram', 'abiff', 'smith', 'russell'];
  const DEROGATORY = ['papist', 'papists', 'popery', 'mohammedan', 'mohammedans', 'mahometan', 'heathen', 'heathens', 'infidel', 'infidels', 'kafir', 'kuffar', 'moonies', 'cultist', 'cultists'];
  assert.deepEqual(lexicons.islam_cues.entries.filter((e) => /muhammad/.test(e.raw)).map((e) => e.raw), ['prophet muhammad'], 'only the religious title, never the bare name');
  const names = new Set([...BELIEF, ...NEW_RULES].flatMap((id) => byId[id].lexicon));
  assert.equal(names.size, 10 + 1, 'the ten new lists and the list of atheism');
  for (const name of names) {
    for (const e of lexicons[name].entries) {
      const words = e.raw.toLowerCase().replace(/\(\?[:!<=]+/g, ' ').match(/[a-z']+/g) || [];
      for (const w of words) {
        assert.ok(!PERSONS.includes(w), `${name}: "${e.raw}" names a person ("${w}")`);
        assert.ok(!DEROGATORY.includes(w), `${name}: "${e.raw}" uses a derogatory name ("${w}")`);
      }
    }
  }
});

// The cue itself, without the lookbehinds and lookaheads that guard it: a guard may name "Jesus the Jew", a cue may not name a people.
const withoutGuards = (raw) => {
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
const stage = (id, title) => { const e = engine(); return e.lexiconStage(byId[id], e.textFor({ title, channel: '' }, 'feed-card')); };

test('the lists on Judaism and Freemasonry hold no word for a people, a state, a conspiracy or an ethnicity, and "Jewish", "mason" and "masonry" are never cues by themselves', () => {
  const BANNED = ['jew', 'jews', 'jewry', 'israel', 'israeli', 'israelis', 'zion', 'zionism', 'zionist', 'zionists', 'holocaust', 'antisemitism', 'antisemitic', 'semite', 'semites', 'semitic',
    'illuminati', 'cabal', 'globalist', 'globalists', 'conspiracy', 'conspiracies', 'elite', 'elites', 'satanic', 'satan', 'lizard', 'puppet', 'puppets', 'hoax', 'race', 'racial', 'ethnic', 'ethnicity', 'blood', 'garbage'];
  for (const name of ['judaism_cues', 'freemasonry_cues']) {
    for (const e of lexicons[name].entries) {
      const words = withoutGuards(e.raw).toLowerCase().match(/[a-z']+/g) || [];
      for (const w of words) assert.ok(!BANNED.includes(w), `${name}: "${e.raw}" holds "${w}"`);
      assert.ok(!/new world order/.test(e.raw), `${name}: "${e.raw}"`);
    }
  }
  // (a spared title may say "Jesus the Jew": it is the Catholic phrase that the rule must leave alone)
  const texts = ['judaism', 'freemasonry'].flatMap((id) => [byId[id].title, byId[id].name, byId[id].plain, byId[id].asks[0].question, ...byId[id].examples]).join(' ').toLowerCase().match(/[a-z']+/g);
  for (const w of texts) assert.ok(!BANNED.includes(w), `the rule texts hold "${w}"`);
  // a title about a people, a country or a trade is not even handed to the model
  for (const t of ['Jewish history in Poland: a documentary', 'Jewish comedians: stand-up compilation', 'Israeli election news', 'Jews and the Holocaust: a lecture', 'A Jewish deli in New York: the best pastrami']) {
    assert.equal(stage('judaism', t).pLex, 0, `"${t}" holds a cue of the Judaism list`);
  }
  for (const t of ['Stone masonry: how to build a dry stone wall', 'Medieval masons and the great cathedrals', 'Mason jar crafts for the kitchen', 'Perry Mason: season one recap', 'Brick and masonry wall repair']) {
    assert.equal(stage('freemasonry', t).pLex, 0, `"${t}" holds a cue of the Freemasonry list`);
  }
});

test('a Catholic title falls from the flat 0.95 cue to 0.75 and waits for the model: the Old Testament, the Last Supper, the Mass, the Church', () => {
  for (const [id, title] of [
    ['judaism', 'A rabbi explains the Last Supper to a Catholic priest'],
    ['judaism', 'Torah portion and the Gospel: a Catholic homily on the Old Testament reading'],
    ['judaism', 'Talmud study and the New Testament: a Catholic scholar compares'],
    ['freemasonry', 'Why a Catholic cannot join the Masonic lodge: the 1983 declaration'],
    ['freemasonry', 'The Church and Masonic rituals: what the popes said'],
    ['freemasonry', 'A priest explains Freemasonry degrees to Catholics'],
  ]) {
    const s = stage(id, title);
    assert.equal(s.pLex, 0.75, `${id}: "${title}" must fall to 0.75 (got ${s.pLex})`);
    assert.equal(s.needsModel, true, `${id}: "${title}" is for the model`);
  }
  // and the same cue without that context flags by itself
  assert.equal(stage('judaism', 'Rabbi explains the meaning of Yom Kippur').pLex, 0.95);
  assert.equal(stage('freemasonry', 'Masonic lodge initiation: the first degree').pLex, 0.95);
});

test('"pastor" and "reverend" flag a title, except the Catholic styles and documents; "Rev." and "rev up" are no cues', () => {
  for (const t of ['Pastor John reacts to the news', "Pastor's Sunday message: five steps to your breakthrough", 'Senior pastors panel: leading a church', 'The Reverend speaks at the conference']) {
    assert.equal(stage('protestantism', t).pLex, 0.95, t);
  }
  for (const t of ['Pastor aeternus: the Church and papal primacy', 'Pastor bonus: the Roman Curia explained', "Our parish pastor's homily for Pentecost", 'The Catholic pastor of the year: a profile',
    'The Good Shepherd, pastor of souls: a homily', 'The Most Reverend Archbishop on the Eucharist', "Reverend Mother's life in the convent", 'Reverend Father John on the Mass', 'Very Reverend Fr. X: a homily',
    'Pastor Alemán: cómo entrenar a un cachorro', 'Pastoral letter on the family']) {
    assert.ok(stage('protestantism', t).pLex < 0.8, `"${t}" must not be flagged`);
  }
  // the abbreviation: every candidate pattern for "Rev. Name" also matches these, so none is a cue
  for (const t of ['Rev up your engine: how a car starts', 'Rev counter explained', 'Rev. Fr. Smith on the Mass', 'Revenue growth for investors', 'Rev. 21:4: a homily on the Book of Revelation']) {
    assert.equal(stage('protestantism', t).pLex, 0, `"${t}" holds a cue`);
  }
});

test('the Protestantism rule and its list name no person and use no word of contempt for the genre or for anyone', () => {
  const p = byId.protestantism;
  const text = [p.title, p.name, p.plain, p.asks[0].question, ...p.examples, ...p.spared, ...lexicons.protestantism_cues.entries.map((e) => e.raw)].join(' ').toLowerCase();
  assert.ok(!/\b(garbage|trash|junk|scam\w*|fake|grift\w*|charlatan\w*|heretic\w*|cult\w*|heathen\w*|fraud\w*)\b/.test(text), 'a word of contempt');
  assert.equal(p.plain, 'Flags Protestant and evangelical teaching, pastors and televangelists.');
  assert.match(p.asks[0].question, /pastor's sermon or message.*worship service.*prosperity or prophecy preaching.*evangelical teaching.*argument against Catholic doctrine.*not a Catholic talk about Protestants or neutral history\?$/);
});

test('the guards cost nothing on a very long description: they are looked at only where a cue has matched', () => {
  const words = 'the quick brown fox jumps over the lazy dog and sings about gardens bread music history travel science cooking weather sports news'.split(' ');
  const text = Array.from({ length: 20000 }, (_, i) => words[(i * 7 + (i >> 3)) % words.length]).join(' ');
  const e = engine();
  for (const id of ['judaism', 'freemasonry', 'protestantism']) {
    const t0 = performance.now();
    e.lexiconStage(byId[id], text);
    const ms = performance.now() - t0;
    assert.ok(ms < 1000, `${id}: a text of ${text.length} characters took ${Math.round(ms)} ms`);
  }
});

test('every new word list has 20 to 45 entries in the four tiers, with a flat statement or a practice at 0.95 so that the list alone can flag', () => {
  for (const id of NEW_RULES) {
    const lex = lexicons[`${id}_cues`];
    assert.deepEqual(lex.errors, [], id);
    assert.ok(lex.entries.length >= 20 && lex.entries.length <= 45, `${id}: ${lex.entries.length} entries`);
    const tiers = new Set(lex.entries.map((e) => e.weight));
    for (const t of tiers) assert.ok([0.95, 0.75, 0.5, 0.15].includes(t), `${id}: weight ${t} is not one of the four tiers`);
    for (const t of [0.95, 0.75, 0.5]) assert.ok(tiers.has(t), `${id}: no entry at ${t}`);
    assert.ok(lex.entries.filter((e) => e.weight === 0.95).length >= 3, `${id}: at least three entries flag by themselves`);
  }
  const d = lexicons.denial_of_god_cues.entries;
  assert.ok(d.length >= 20 && d.length <= 45, `denial_of_god_cues: ${d.length} entries`);
  assert.ok(d.some((e) => /atheist/.test(e.raw) && e.weight === 0.95) && d.some((e) => /new atheism/.test(e.raw)) && d.some((e) => /believe in/.test(e.raw)), 'the stance phrases were added');
});

// What a Catholic viewer must still see: sermons, replies, history and news. None of these may be flagged by a word list alone.
// (Some hold a 0.75 cue and wait for the on-device model; the questions exclude exactly these cases.)
const CATHOLIC_AND_NEUTRAL = [
  'Holy Mass in the Extraordinary Form: Sunday after Pentecost', 'St. John the Baptist: the Forerunner of the Lord', 'The Baptistery of Florence: a tour',
  'Pentecost Sunday homily: the gifts of the Holy Spirit', 'Does God exist? Five ways of St. Thomas Aquinas', 'Rosary meditation: the Joyful Mysteries',
  'Catholic exorcism: a priest explains the rite', 'The Council of Trent explained', "Why I became Catholic: a convert's story", 'Are Catholics Christians? A reply',
  'Do all religions lead to God? A Catholic answer', 'Are all religions the same? A Catholic answer', 'Not all religions are the same: why the Church sends missionaries',
  'Is the Catholic Church corrupt? A historian answers', 'Has science disproved God? A physicist answers', 'Does science disprove the soul? A philosopher answers',
  'Are miracles impossible? A Catholic physicist replies', 'Is Reiki compatible with the Catholic faith? A priest answers', 'Why the Church condemns the occult: a homily',
  'Evangelical counsels: poverty, chastity and obedience', 'The Counter-Reformation and the Jesuits', 'Why Protestants convert to Catholicism', 'Catholic Answers: Is sola scriptura biblical?',
  'The history of the Anglican Ordinariate', 'Islam and Christianity: a Catholic perspective', 'What the Church teaches about Muslims: Nostra Aetate', 'Pope visits the mosque in Istanbul',
  'The Hagia Sophia: from basilica to mosque', 'Zen 5 CPU review: benchmarks and temperatures', 'Karma: instant justice compilation', 'Yoga for back pain: 10 minute routine',
  "How to answer Jehovah's Witnesses at the door", 'Seven lies about the Catholic Church, answered', 'Vatican cover-up? The truth about the archives',
  'Anti-Catholic bigotry in America: a history', 'Why God is not a delusion: a reply to the new atheists', 'Atheist converts to Catholicism: his story',
  'I was an atheist for twenty years, then I read the Gospels', 'Catholic vs atheist debate: does God exist?', 'Amish life: a documentary', 'Salt Lake City travel guide',
  'The Book of Mormon musical: full review', 'D&D spellcasting for new players: a beginner\'s guide', 'Gregorian chant for evening prayer: Compline',
  // pastors and reverends: the Catholic and the neutral uses of the words
  'Pastor aeternus: the Church and papal primacy', 'Pastor bonus: the Roman Curia explained', 'Pastor angelicus: a documentary on Pius XII', 'The Good Shepherd, pastor of souls: a homily',
  "Our parish pastor's homily for Pentecost", 'The Catholic pastor of the year: a profile', 'Pastoral letter on the family', 'Pastor Alemán: cómo entrenar a un cachorro',
  'The Most Reverend Archbishop on the Eucharist', "Reverend Mother's life in the convent", 'Reverend Father John on the Mass', 'Very Reverend Fr. X: a homily',
  'Rev up your engine: how a car starts', 'Rev counter explained', 'Revenue growth for investors', 'Rev. 21:4: a homily on the Book of Revelation',
  'Eucharistic revival service: a parish mission', 'The prophetic word for the Church today', 'Prophetic word of Isaiah: a Catholic reading', 'Anointing of the sick: what the sacrament does',
  'Homily for the Third Sunday of Advent: Rejoice in the Lord always', 'St. John the Baptist, forerunner of the Lord: a homily',
  // Judaism: Catholic talks on the Old Testament, the Last Supper and the Jewish roots of the Mass, and ordinary titles
  'The Jewish roots of the Mass: the Last Supper and Passover', 'Jesus the Jew: what the Gospels tell us about his Jewish roots', 'Old Testament readings for Advent explained by a Catholic scholar',
  'A rabbi explains the Last Supper to a Catholic priest', 'Torah portion and the Gospel: a Catholic homily on the Old Testament reading', 'Holy Week and the Jewish Passover: how the Mass began',
  'Talmud study and the New Testament: a Catholic scholar compares', 'Shabbat service and the Christian Sunday: a Catholic reflection', 'The Hebrew Bible and the Old Testament canon: a Catholic perspective',
  'Synagogue of Rome: a tour', 'Hanukkah and the Maccabees: the books in the Catholic Bible', 'Purim: the story of Esther', 'The Last Supper was a Passover meal: a Catholic talk on the Old Testament',
  'Jewish history in Poland: a documentary', 'Jewish comedians: stand-up compilation', 'Israeli election news', 'Kosher food festival', 'Rabbit stew recipe',
  // Freemasonry: Catholic talks about it, stone masonry, and other uses of the words
  'Why a Catholic cannot join the Masonic lodge: the 1983 declaration', 'The Church and Masonic rituals: what the popes said', 'Pope Leo XIII on Freemasonry: Humanum genus',
  'A priest explains Freemasonry degrees to Catholics', 'Stone masonry: how to build a dry stone wall', 'Medieval masons and the great cathedrals', 'Brick and masonry wall repair',
  'Master mason restores the cathedral vault', "Scottish Rite Children's Hospital: a tour", 'Concert at the Masonic Temple in Detroit: live review', 'The Knights Templar: a medieval history',
  'Secret societies at Yale: a documentary', 'Mason jar crafts for the kitchen', 'Hunting lodge for sale in the Alps',
];

test('Catholic sermons, replies, history and news are not flagged by the word lists alone', () => {
  const ids = [...BELIEF, ...NEW_RULES];
  for (const t of CATHOLIC_AND_NEUTRAL) assert.deepEqual(flaggedBy(t, ids), [], `"${t}" must not be flagged by a word list`);
});

// What the lists must catch by themselves (the 0.95 tier): a flat statement, a recitation, a service, a practice offered.
const BY_WORDS = [
  ['denial_of_god', 'Why I Am an Atheist'], ['denial_of_god', "I'm an Atheist and I Love the Latin Mass"], ['denial_of_god', 'Why I don’t believe in God'], ['denial_of_god', 'God is a lie'],
  ['naturalism', 'Miracles are impossible'], ['naturalism', 'Science disproves God'], ['naturalism', 'There is no such thing as the supernatural'], ['naturalism', 'The soul is an illusion'],
  ['naturalism', 'Matter is all there is'], ['naturalism', 'Jesus never existed: the evidence'], ['naturalism', 'The resurrection is a myth'],
  ['indifferentism', 'All religions are the same'], ['indifferentism', 'All religions are equally true'], ['indifferentism', 'Every religion is valid: a talk'],
  ['indifferentism', 'No religion is better than another'], ['indifferentism', "It doesn't matter what you believe"], ['indifferentism', 'Any religion will do'],
  ['protestantism', 'Baptist sermon: the love of God'], ['protestantism', 'Pentecostal worship night live'], ['protestantism', 'Altar call'],
  ['protestantism', 'Accept Jesus as your personal Lord and Savior today'], ['protestantism', "Pastor's Sunday message: five steps to your breakthrough"], ['protestantism', 'Pastor explains the book of Romans'],
  ['protestantism', 'Youth pastor comedy skit'], ['protestantism', 'Reverend preaches on forgiveness'], ['protestantism', 'The Reverend speaks at the conference'], ['protestantism', 'Tent revival tonight'],
  ['protestantism', 'Healing crusade live from Texas'], ['protestantism', 'Miracle service: Sunday night'], ['protestantism', 'A prophetic word for 2026'], ['protestantism', 'Prosperity preaching: sow a seed'],
  ['protestantism', 'Megachurch worship experience'], ['protestantism', 'Worship night live: praise and worship with the whole church and the pastor'],
  ['islam', 'Quran recitation (full)'], ['islam', 'Recitation of the Holy Quran by a beautiful voice'], ['islam', 'Friday khutbah: patience'], ['islam', 'Islamic lecture: the signs of the hour'],
  ['islam', 'Ramadan reminder: day 1'], ['islam', 'Tafsir of Surah Al-Baqarah'], ['islam', 'How to convert to Islam'],
  ['judaism', 'Torah portion of the week: a short lecture'], ['judaism', 'Weekly Torah study with the community'], ['judaism', 'Talmud study for beginners'], ['judaism', "Daf Yomi: today's page"],
  ['judaism', 'Rabbi explains the meaning of Yom Kippur'], ['judaism', 'Shabbat service live'], ['judaism', 'Synagogue service: morning prayers'], ['judaism', 'Rosh Hashanah sermon: a new year'],
  ['judaism', 'Chabad lecture: the power of prayer'], ['judaism', 'Kabbalah course: the Tree of Life'], ['judaism', 'Parsha of the week with the rabbi'], ['judaism', 'Shiur on tractate Berachot'],
  ['eastern_religions', 'Om Mani Padme Hum 108 times'], ['eastern_religions', 'Vipassana: my ten day retreat'], ['eastern_religions', 'Buddhist meditation for beginners'],
  ['eastern_religions', 'Bhagavad Gita lecture: chapter 2'], ['eastern_religions', 'Chakra healing meditation'], ['eastern_religions', 'Kundalini yoga for beginners'], ['eastern_religions', 'Sikh kirtan: Waheguru'],
  ['sects', 'Kingdom Hall: what happens'], ['sects', 'Latter-day Saints general conference'], ['sects', "Jehovah's Witnesses convention"],
  ['freemasonry', 'Masonic lodge initiation: what happens in the first degree'], ['freemasonry', 'Masonic rituals revealed'], ['freemasonry', 'Freemasonry degrees explained'],
  ['freemasonry', 'Worshipful Master installation night'], ['freemasonry', 'York Rite explained'], ['freemasonry', 'Scottish Rite degrees: the ritual explained'],
  ['freemasonry', 'Entered Apprentice degree: the first night'], ['freemasonry', 'Third degree Mason: my story'], ['freemasonry', 'Master Mason degree ceremony'],
  ['anti_catholic', 'The pope is the antichrist'], ['anti_catholic', 'The Catholic Church is evil'], ['anti_catholic', 'Rome is the whore of Babylon'], ['anti_catholic', 'Papal lies exposed'],
  ['occult', 'Witchcraft spells for beginners'], ['occult', 'Love spells that work'], ['occult', 'Full moon ritual'], ['occult', 'Crystal healing for beginners'],
  ['occult', 'Reiki healing session'], ['occult', 'Astral projection tutorial'], ['occult', 'Starseed signs'],
];

// What waits for the on-device model: a topic word that Catholic replies, history and news also use.
const FOR_THE_MODEL = [
  ['denial_of_god', "I don't believe in God anymore"], ['denial_of_god', 'New Atheism: the best arguments'], ['denial_of_god', 'Atheist vs Christian debate'],
  ['naturalism', 'Scientism: science is the only source of truth'], ['naturalism', 'Secular humanism explained'], ['naturalism', 'Science vs religion: who wins?'],
  ['indifferentism', 'All paths lead to God'], ['indifferentism', 'Spiritual but not religious'], ['indifferentism', 'Religious pluralism and the future of the church'],
  ['protestantism', 'Calvinism vs Arminianism'], ['protestantism', 'Born again: what it means'], ['protestantism', 'The prosperity gospel exposed'], ['protestantism', 'Sola fide: justified by faith alone'],
  ['protestantism', 'Televangelist scandal: what happened'], ['protestantism', 'God told me to quit my job'], ['protestantism', 'Speaking in tongues: what the Bible says'],
  ['protestantism', 'Worship team practice'], ['protestantism', 'Street preacher confronts the crowd'], ['protestantism', 'A prophetic word from the Lord'], ['protestantism', 'Rev. Dr. Smith gives a lecture'],
  ['islam', 'Hadith of the day'], ['islam', 'Allahu Akbar: the call to prayer'], ['islam', 'Hajj 2026 live from Mecca'], ['islam', 'I converted to Islam: my story'],
  ['judaism', 'Judaism explained'], ['judaism', 'What is the Talmud?'], ['judaism', "A rabbi's story"], ['judaism', 'Hasidic music festival'], ['judaism', 'Passover seder: how to lead one'],
  ['judaism', 'Kabbalah explained'], ['judaism', 'Jewish prayer for beginners'], ['judaism', 'Learn to light the Hanukkah candles: blessings with a rabbi'],
  ['eastern_religions', 'Buddhism explained'], ['eastern_religions', 'Hinduism explained'], ['eastern_religions', 'Taoism and the Tao Te Ching'],
  ['sects', 'Mormon missionaries knocked on my door'], ['sects', 'Scientology: the secret'], ['sects', 'Seventh-day Adventist church service'],
  ['freemasonry', 'What is Freemasonry? A lodge member explains'], ['freemasonry', 'Grand Lodge of Scotland: a tour'], ['freemasonry', 'Blue Lodge: what is it?'], ['freemasonry', 'What do Masons believe? Masonic symbols'],
  ['anti_catholic', 'Why I left the Catholic Church'], ['anti_catholic', 'Exposing the Vatican'], ['anti_catholic', 'Catholics worship Mary: the proof'], ['anti_catholic', 'Vatican cover up'],
  ['occult', 'Reiki: how it works'], ['occult', 'Law of attraction: manifest your dream life'], ['occult', 'Satanic temple news'], ['occult', 'How to summon a demon'],
];

class Model {
  constructor(p) { this.p = p; this.enabled = true; this.mediaEnabled = {}; }
  async askNoul() { return { p: this.p }; }
  async askScore() { return { p: this.p }; }
}

test('a flat statement, a recitation, a service or a practice offered is flagged by the word list alone', () => {
  for (const [id, title] of BY_WORDS) assert.deepEqual(flaggedBy(title, [id]), [id], `${id}: "${title}"`);
});

test('a topic word waits for the model: not flagged by the words, flagged when the model says yes, left alone when it says no', async () => {
  for (const [id, title] of FOR_THE_MODEL) {
    const item = { title, channel: '' };
    const quick = new Engine({ rules, lexicons, settings: {}, backend: new Model(1) }).evaluateQuick(item, 'feed-card');
    assert.ok(!quick.flagged.some((f) => f.ruleId === id), `${id}: "${title}" must not be flagged by the words alone`);
    const yes = await new Engine({ rules, lexicons, settings: {}, backend: new Model(1) }).evaluate(item, 'feed-card');
    assert.ok(yes.flagged.some((f) => f.ruleId === id), `${id}: "${title}" must be flagged when the model says yes`);
    const no = await new Engine({ rules, lexicons, settings: {}, backend: new Model(0) }).evaluate(item, 'feed-card');
    assert.ok(!no.flagged.some((f) => f.ruleId === id), `${id}: "${title}" must be left alone when the model says no`);
  }
});

test('only atheism looks at comments and captions: a comment or a caption about Islam is not touched', () => {
  const e = engine();
  const comment = e.evaluateQuick({ text: 'There is no God, wake up' }, 'comment');
  assert.deepEqual(comment.flagged.map((f) => f.ruleId), ['denial_of_god']);
  const quran = e.evaluateQuick({ text: 'Quran recitation and a khutbah' }, 'comment');
  assert.deepEqual(quran.flagged, []);
  assert.deepEqual(e.rulesFor('subtitles').filter((r) => r.group === 'belief').map((r) => r.id), ['denial_of_god']);
});

test('rules.md says what the pack says: the counts, the enabled and disabled lists, a heading and a link for every rule', () => {
  const md = readRoot('rules.md');
  const text = textRules;
  const on = text.filter((r) => r.enabled).map((r) => r.id);
  const off = text.filter((r) => !r.enabled).map((r) => r.id);
  assert.match(md.match(/^description: .*$/m)[0], new RegExp(`The ${text.length} text rules`));
  assert.ok(md.includes(`(${text.length} text rules: ${on.length} enabled, ${off.length} disabled)`), 'the counts in "What this is"');
  assert.ok(md.includes(`(${Object.keys(lexicons).length} word lists:`), 'the number of word lists');
  const list = (label) => md.match(new RegExp(`^- ${label} by default \\((\\d+)\\): (.*)\\.$`, 'm'));
  const enabledLine = list('Enabled');
  const disabledLine = list('Disabled');
  assert.ok(enabledLine && disabledLine, 'the two lists exist');
  assert.equal(Number(enabledLine[1]), on.length);
  assert.equal(Number(disabledLine[1]), off.length);
  assert.deepEqual(enabledLine[2].split(', ').sort(), [...on].sort());
  assert.deepEqual(disabledLine[2].split(', ').sort(), [...off].sort());
  for (const r of text) {
    const state = r.enabled ? 'enabled' : 'disabled';
    assert.ok(md.includes(`\n### ${r.id}: ${r.title} (${state}) {#${r.id}}\n`), `${r.id}: heading with its title and "${state}"`);
    assert.ok(md.includes(`\n- [${r.id}](#${r.id}): ${r.title} (${state})\n`), `${r.id}: link in the list of rules`);
  }
  // the entry counts that rules.md states for the lists of these rules
  for (const id of BELIEF.concat(NEW_RULES).filter((x, i, a) => a.indexOf(x) === i)) {
    const name = byId[id].lexicon[0];
    assert.ok(md.includes(`- Lexicon: ${name} (${lexicons[name].entries.length} entries)`), `${id}: rules.md states ${lexicons[name].entries.length} entries for ${name}`);
  }
});
