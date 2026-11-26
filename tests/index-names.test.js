import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { parseLexicon } from '../extension/src/core/lexicon.js';
import { tokenize, normalizeWord } from '../extension/src/core/text.js';

// The word lists named index_*.txt hold names and titles of the Index of Forbidden Books. The rule author's condition (2026-11-26): every name and
// every title in them must be in the file docs/en/holy-office/forbidden.md ("Index of Forbidden Books", the 1948 edition and the decrees to 1961).
// This test checks that, and says plainly what "is in the file" means:
//
//  - Each group of entries in a list is introduced by a comment line "# @ <heading>", where <heading> is an author heading of the file exactly as printed
//    (the text between the ** of a line such as "**Voltaire, François-Marie Arouet**"), or "(without the author’s name)" for the works that the Index prints
//    without an author. The group's block is that heading and the title lines under it; a pseudonym in a title line ("as “Sand, George”") counts as a name
//    of the author. The entries of the group are checked against that block and no other: a name cannot be justified by another author's block.
//  - Words are compared as the extension compares them: lower case, accents removed, hyphens and punctuation are word breaks, an apostrophe inside a word is
//    kept. A trailing * (the lexicon's prefix mark, which also catches a possessive: "voltaire*" matches "Voltaire's") matches any word that begins so.
//  - Particles and glue words are ignored on both sides (de, du, des, di, da, del, della, dei, van, von, der, den, la, le, les, il, el, al, y, e, et, dos, das,
//    and by, the, a, an, of, and): "Honoré de Balzac" and "The history of the decline and fall" need not be spelled as the Index spells them.
//  - An entry passes if (1) its words that are in the heading (or in a pseudonym) include the author's surname (the part before the comma), or include at least
//    two words of the heading (the Index prints "Stendhal, Henri Beyle de": "henri beyle" is the author's name, "stendhal" is the surname); and (2) its remaining
//    words, if any, form one unbroken run of words of one title line of the same block. A pure title ("madame bovary") is the second part alone.
//  - A name at 0.95 is written as a guarded pattern, /\bvictor hugo(?:'s)?\b(?<!...)(?!...)/, so that "Hotel Victor Hugo" falls to the plain 0.75 line that
//    follows it. The test reads the name between \b and (?:'s)?\b and checks it as above; the guard itself is not checked. Any other kind of regex in an Index
//    list is refused, so that nothing escapes the check.
//  - What the test does not prove: that the author is "recognisable" or that the category is right. Both are choices of the rule author, said in rules.md.
//  - Titles are not translated: an English title that the Index does not print is not a cue.
//
// If the file is not on this machine the checks that need it are skipped, with the reason; the checks of the lists themselves still run.

const SRC = new URL(process.env.INDEX_SOURCE ? `file://${process.env.INDEX_SOURCE}` : '../../docs/en/holy-office/forbidden.md', import.meta.url);
const HAVE = existsSync(SRC);
const LEX = new URL('../extension/lexicon/', import.meta.url);
const WITHOUT_AUTHOR = '(without the author’s name)';
const PARTICLES = new Set(['de', 'du', 'des', 'di', 'da', 'del', 'della', 'dei', 'van', 'von', 'der', 'den', 'la', 'le', 'les', 'il', 'el', 'al', 'y', 'e', 'et', 'dos', 'das', 'by', 'the', 'a', 'an', 'of', 'and']);
const TIERS = [0.95, 0.75, 0.5, 0.15];
// the lists of the rules on Communism and Spiritism: names of a doctrine, judged by the model (the rule spares warnings); the other lists are book categories (the rule flags any video about the author)
const IDEOLOGY_LISTS = ['index_socialists', 'index_spiritists'];

const words = (s) => tokenize(s).map((t) => t.t);

// ---------------------------------------------------------------- the Index, as blocks
function readIndex() {
  const blocks = new Map();
  const anon = { heading: WITHOUT_AUTHOR, lines: [] };
  let section = '';
  let cur = null;
  for (const l of readFileSync(SRC, 'utf8').split('\n')) {
    if (l.startsWith('## ')) { section = l.slice(3).trim(); cur = null; continue; }
    const m = l.match(/^\*\*(.+)\*\*\s*$/);
    if (m) {
      if (m[1].startsWith('Without the author')) cur = anon;
      else { cur = blocks.get(m[1]) || { heading: m[1], lines: [] }; blocks.set(m[1], cur); }
      continue;
    }
    if (l.startsWith('- ')) {
      if (section === 'Works without an author’s name') anon.lines.push(l.slice(2));
      else if (cur) cur.lines.push(l.slice(2));
      continue;
    }
    if (!l.trim() && section !== 'Works without an author’s name') cur = null;
  }
  blocks.set(WITHOUT_AUTHOR, anon);
  return blocks;
}

function identity(block) {
  const ids = new Set();
  const surnames = new Set();
  if (block.heading === WITHOUT_AUTHOR) return { ids, surnames };
  block.heading.split(',').forEach((part, i) => words(part).forEach((w) => { ids.add(w); if (i === 0) surnames.add(w); }));
  for (const line of block.lines) {
    for (const m of line.matchAll(/as [“"]([^”"]+)[”"]/g)) m[1].split(',').forEach((part, i) => words(part).forEach((w) => { ids.add(w); if (i === 0) surnames.add(w); }));
  }
  return { ids, surnames };
}

const stem = (w) => w.replace(/\*$/, '').replace(/'s$/, '');
const same = (entryWord, token) => (entryWord.endsWith('*') ? token.startsWith(stem(entryWord)) : token === stem(entryWord));

/** @returns {string|null} null when the entry is in the block, otherwise the reason */
function inBlock(entryWords, block) {
  const ws = entryWords.filter((w) => !PARTICLES.has(stem(w)));
  const { ids, surnames } = identity(block);
  const names = ws.filter((w) => [...ids].some((t) => same(w, t)));
  const rest = ws.filter((w) => !names.includes(w));
  if (names.length && !(names.length >= 2 || names.some((w) => [...surnames].some((t) => same(w, t))))) return 'a single word that is not the surname of the heading';
  if (rest.length) {
    const ok = block.lines.some((line) => {
      const lt = words(line).filter((t) => !PARTICLES.has(t));
      for (let i = 0; i + rest.length <= lt.length; i++) if (rest.every((w, k) => same(w, lt[i + k]))) return true;
      return false;
    });
    if (!ok) return `"${rest.join(' ')}" is not an unbroken run of words of one title of this author's block`;
  }
  return null;
}

// ---------------------------------------------------------------- the lists
function readList(name) {
  const text = readFileSync(new URL(`${name}.txt`, LEX), 'utf8');
  const header = [];
  const groups = [];
  let cur = null;
  text.split(/\r?\n/).forEach((line, i) => {
    const l = line.trim();
    if (!l) return;
    const marker = l.match(/^#\s*@\s*(.+)$/);
    if (marker) { cur = { heading: marker[1].trim(), entries: [] }; groups.push(cur); return; }
    if (l.startsWith('#')) { if (!cur) header.push(l); return; }
    const m = l.match(/^(\d*\.?\d+)\s*\|\s*(.+)$/);
    assert.ok(m, `${name}.txt line ${i + 1}: cannot read it`);
    assert.ok(cur, `${name}.txt line ${i + 1}: an entry before the first "# @ heading" line`);
    cur.entries.push({ weight: Number(m[1]), raw: m[2].trim(), line: i + 1 });
  });
  return { name, header: header.join('\n'), groups, parsed: parseLexicon(text, name) };
}

const INDEX_LISTS = readdirSync(LEX).filter((f) => /^index_.*\.txt$/.test(f)).map((f) => f.replace(/\.txt$/, '')).sort();
const lists = INDEX_LISTS.map(readList);

/** The words of an entry for the check: a plain phrase, or the name inside a guarded pattern. */
function entryWords(raw) {
  if (!raw.startsWith('/')) return raw.split(/\s+/).map((w) => (w.endsWith('*') ? normalizeWord(w.slice(0, -1)) + '*' : normalizeWord(w)));
  const m = raw.match(/^\/\\b([a-z0-9' ]+?)\(\?:'s\)\?\\b\(\?<!\\b\(\?:[a-z|]+\) \1\(\?:'s\)\?\)\(\?!\(\?:'s\)\?\\s\(\?:[a-z|]+\)\\b\)\/$/);
  assert.ok(m, `a pattern in an Index list must be a guarded name, /\\bname(?:'s)?\\b(?<!...)(?!...)/; got ${raw.slice(0, 80)}`);
  return m[1].split(' ');
}

// ---------------------------------------------------------------- tests
test('the Index lists exist, say where they come from, and keep to the four tiers and a sensible size', () => {
  assert.deepEqual(INDEX_LISTS, ['index_freethinkers', 'index_historians', 'index_jesus_critics', 'index_modernists', 'index_novelists', 'index_philosophers', 'index_socialists', 'index_spiritists']);
  for (const l of lists) {
    assert.deepEqual(l.parsed.errors, [], l.name);
    assert.match(l.header, /Index of Forbidden Books/, `${l.name}: the header says the entries are from the Index`);
    assert.match(l.header, /docs\/en\/holy-office\/forbidden\.md/, `${l.name}: and from which file`);
    assert.match(l.header, /choice of the rule author/i, `${l.name}: and that the category is the rule author's choice`);
    assert.match(l.header, /canon 1399/i, `${l.name}: and which class of canon 1399 it rests on`);
    assert.ok(l.groups.length >= 1, l.name);
    const n = l.groups.reduce((a, g) => a + g.entries.length, 0);
    assert.ok(n >= 8 && n <= 150, `${l.name}: ${n} entries`);
    for (const g of l.groups) {
      assert.ok(g.entries.length >= 1, `${l.name}: group "${g.heading}" is empty`);
      for (const e of g.entries) assert.ok(TIERS.includes(e.weight), `${l.name}: weight ${e.weight} of "${e.raw.slice(0, 40)}" is not a tier`);
    }
    const all = l.groups.flatMap((g) => g.entries);
    if (IDEOLOGY_LISTS.includes(l.name)) assert.ok(all.every((e) => e.weight <= 0.75), `${l.name}: the names of a doctrine wait for the model (a Catholic refutation is not propaganda)`);
    else assert.ok(all.filter((e) => e.weight === 0.95).length >= 3, `${l.name}: at least three entries flag by themselves`);
  }
});

test('no entry of an Index list is a bare first name, a bare common word or a title that is also a cathedral, a country or an everyday word', () => {
  const FORBIDDEN_BARE = ['hugo', 'dumas', 'sand', 'sue', 'france', 'pamela', 'casanova', 'notre dame de paris', 'notre dame', 'moravia', 'gentile', 'croce', 'comte', 'hobbes', 'locke', 'berkeley',
    'fourier', 'bacon', 'pascal', 'descartes', 'strauss', 'mill', 'gibbon', 'smith', 'simon', 'richard simon'];
  for (const l of lists) {
    for (const g of l.groups) {
      for (const e of g.entries) {
        if (e.raw.startsWith('/')) continue;
        const phrase = e.raw.replace(/\*/g, '');
        // these are the bare words that the rule author's brief and the false-alarm notes in rules.md name as namesakes (a cathedral, a country, a month-old pet...):
        // only a fuller form (a full name, a title, a name next to a title) may be a cue
        if (FORBIDDEN_BARE.includes(phrase)) assert.ok(false, `${l.name}: "${e.raw}" is a bare ambiguous word`);
      }
    }
  }
});

test('every Index list is set against the Index: every group has its author heading, and every name and title is in that author\'s block', (t) => {
  if (!HAVE) return t.skip('docs/en/holy-office/forbidden.md is not on this machine (set INDEX_SOURCE to its absolute path)');
  const blocks = readIndex();
  assert.ok(blocks.size > 2000, `the file has ${blocks.size} author blocks`);
  const failures = [];
  for (const l of lists) {
    for (const g of l.groups) {
      const block = blocks.get(g.heading);
      if (!block) { failures.push(`${l.name}: no heading "${g.heading}" in the Index`); continue; }
      for (const e of g.entries) {
        const why = inBlock(entryWords(e.raw), block);
        if (why) failures.push(`${l.name} line ${e.line}: "${e.raw.slice(0, 60)}" under "${g.heading}": ${why}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('the check is not vacuous: it refuses a name that the Index does not print under that heading, and it accepts the real ones', (t) => {
  if (!HAVE) return t.skip('docs/en/holy-office/forbidden.md is not on this machine');
  const blocks = readIndex();
  const v = blocks.get('Voltaire, François-Marie Arouet');
  assert.ok(v);
  assert.equal(inBlock(['voltaire*'], v), null);
  assert.equal(inBlock(['voltaire*', 'candide'], v), null);
  assert.equal(inBlock(['candide', 'by', 'voltaire*'], v), null);
  assert.equal(inBlock(['francois', 'marie', 'arouet'], v), null);
  assert.ok(inBlock(['karl', 'marx'], v), 'Marx is not under Voltaire');
  assert.ok(inBlock(['voltaire*', 'madame', 'bovary'], v), 'a title of another author is not Voltaire\'s');
  assert.ok(inBlock(['arouet'], v), 'a bare first name or a bare part of the full name is not a surname');
  assert.ok(inBlock(['voltaire*', 'zadig'], v), 'a title that the Index does not print under Voltaire');
  // the introduction says that Marx, Darwin and Nietzsche are not named in the Index: there is no heading for them
  for (const name of ['Marx', 'Darwin, Charles', 'Nietzsche', 'Engels', 'Lenin']) {
    assert.ok(![...blocks.keys()].some((h) => h.startsWith(name + ',') || h === name), `the Index has a heading for ${name}`);
  }
  const intro = readFileSync(SRC, 'utf8');
  assert.match(intro, /Karl Marx, Charles Darwin and Friedrich Nietzsche are not named in it/);
});

test('the introduction of the Index names the twelve classes of canon 1399, and the quotations of the Index and of the catechism in rules.md and in the research file are in the files word for word', (t) => {
  if (!HAVE) return t.skip('docs/en/holy-office/forbidden.md is not on this machine');
  const src = readFileSync(SRC, 'utf8');
  const section = src.split('## The law that went with it')[1].split('\n## ')[0];
  const classes = section.split('\n').filter((l) => l.startsWith('- '));
  assert.equal(classes.length, 12, 'twelve classes of canon 1399');
  const flat = (x) => x.replace(/\s+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();
  // a quotation is written:  Quote (forbidden.md): “...”   or   Quote (catechism.md): “...”   (each quotation is marked, also when several stand in one line)
  const DOCS = { 'forbidden.md': SRC, 'catechism.md': new URL('../../docs/en/st-pius-x/catechism.md', import.meta.url) };
  const texts = {};
  let checked = 0;
  const bySource = { 'forbidden.md': 0, 'catechism.md': 0 };
  for (const file of ['rules.md', 'research/index-of-forbidden-books.md']) {
    const path = new URL(`../${file}`, import.meta.url);
    if (!existsSync(path)) continue;
    for (const m of readFileSync(path, 'utf8').matchAll(/Quote \((forbidden\.md|catechism\.md)\): ([“"])(.+?)([”"])(?=\s|$|\.|;|,)/g)) {
      const doc = DOCS[m[1]];
      if (!existsSync(doc)) continue;
      texts[m[1]] ??= flat(readFileSync(doc, 'utf8'));
      assert.ok(texts[m[1]].includes(flat(m[3])), `${file}: not in ${m[1]} word for word: ${m[3].slice(0, 90)}`);
      checked++;
      bySource[m[1]]++;
    }
  }
  assert.ok(bySource['forbidden.md'] >= 12, `${bySource['forbidden.md']} quotations of the Index were checked`);
  assert.ok(bySource['catechism.md'] >= 3, `${bySource['catechism.md']} quotations of the catechism were checked`);
});

test('no cue is in two Index lists, and none of them repeats a cue of the lists on Freemasonry, Communism, Modernism or Spiritism', () => {
  const seen = new Map();
  const others = ['freemasonry_cues', 'communism_cues', 'modernism_cues', 'spiritism_cues', 'occult_cues', 'divination_cues', 'anti_catholic_cues', 'bad_books_cues'];
  const otherEntries = new Map();
  for (const n of others) for (const e of parseLexicon(readFileSync(new URL(`${n}.txt`, LEX), 'utf8'), n).entries) otherEntries.set(e.raw.toLowerCase(), n);
  for (const l of lists) {
    for (const g of l.groups) {
      for (const e of g.entries) {
        const key = e.raw.toLowerCase();
        if (e.raw.startsWith('/')) continue;
        assert.ok(!seen.has(key), `"${e.raw}" is in ${seen.get(key)} and in ${l.name}`);
        seen.set(key, l.name);
        assert.ok(!otherEntries.has(key), `"${e.raw}" of ${l.name} is also in ${otherEntries.get(key)}`);
      }
    }
  }
});
