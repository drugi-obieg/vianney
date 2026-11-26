import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEV } from '../extension/src/ai/kev-manifest.js';
import {
  escapeUserText, optionTexts, encodeSequence, prepareRun, softmax, decodeNoul, decodeScore, decodeChoice, decodeAnswers, backendAnswer,
} from '../extension/src/ai/kev-core.js';

const D = KEV.delimiters;
const SPECIAL = new Map(Object.entries(KEV.delimiterTokens).map(([k, name]) => [name, D[k]]));

// A stand-in tokenizer: known delimiter strings are ONE token with the id of the real model, everything else is split into words and
// punctuation marks with a made-up id. (The real tokenizer is checked against the model in tools/eval-kev.mjs.)
function codeOf(piece) {
  let h = 7;
  for (const ch of piece) h = (h * 31 + ch.codePointAt(0)) % 100000;
  return 1000 + h; // never in the range of the delimiter ids (151648 and up)
}
const encode = (text) => Array.from(String(text).matchAll(/<\|[A-Za-z0-9_]+\|>|<[^\s<>]*>|\w+|[^\w\s]/g), (m) => (SPECIAL.has(m[0]) ? SPECIAL.get(m[0]) : codeOf(m[0])));

// ---------------------------------------------------------------------------------------------------------------------------
// Reference 1: the recipe of the model card, transcribed as it stands there (onnx-community/kev-0.6b-ONNX, "Usage with Transformers.js").
function cardRecipe(enc, state, questions) {
  const { state: STATE, question: Q, optionStart: OPT, optionEnd: END, decide: DECIDE } = D;
  const tokens = [STATE, ...enc(state)];
  const groups = questions.map((q) => {
    const spans = q.options.map((o) => [OPT, ...enc(o), END]);
    const branch = [Q, ...enc(q.instr), ...spans.flat(), DECIDE];
    const base = tokens.length;
    let cursor = 1 + enc(q.instr).length;
    const ends = spans.map((s) => { cursor += s.length; return base + cursor - 1; });
    tokens.push(...branch);
    return ends;
  });
  return { tokens, groups };
}

// Reference 2: encodeKevSequence of open-jev 0.1.2 (MIT, https://github.com/nico-martin/open-jev, src/encoding.ts), TypeScript types removed.
function openJevEncodeKev({ state, questions, delimiters, maxStateTokens, maxLength }) {
  const branches = questions.map((question) => {
    const branch = [delimiters.question, ...question.instructions];
    const ends = [];
    for (const option of question.options) {
      branch.push(delimiters.optionStart, ...option, delimiters.optionEnd);
      ends.push(branch.length - 1);
    }
    branch.push(delimiters.decide);
    return { branch, ends };
  });
  const longestBranch = Math.max(...branches.map((b) => b.branch.length));
  const budget = maxLength - 1 - longestBranch;
  if (budget < 0) throw new Error('too long');
  const stateLimit = Math.min(maxStateTokens, budget);
  const stateTokens = state.slice(0, stateLimit);
  const inputIds = [delimiters.state, ...stateTokens];
  const groups = [];
  for (const { branch, ends } of branches) {
    const base = inputIds.length;
    inputIds.push(...branch);
    groups.push(ends.map((end) => base + end));
  }
  return { inputIds, groups, stateTokens: stateTokens.length, stateTruncated: stateTokens.length < state.length };
}

// ---------------------------------------------------------------------------------------------------------------------------
test('the manifest agrees with the facts of config.json that the layout depends on', () => {
  assert.deepEqual(KEV.delimiters, { state: 151659, question: 151660, optionStart: 151648, optionEnd: 151649, decide: 151661 });
  assert.equal(KEV.delimiterTokens.state, '<|fim_prefix|>');
  assert.equal(KEV.delimiterTokens.decide, '<|fim_suffix|>');
  assert.equal(KEV.maxStateTokens, 384, 'trained_max_state_tokens: not the 8,192 that the graph accepts');
  assert.ok(KEV.maxLength <= 1024 && KEV.maxLength < KEV.graphMaxTokens);
  assert.deepEqual(KEV.noulOptions, ['no', 'yes']);
});

test('caller text can never forge a delimiter: <|name|> becomes <¦name¦>', () => {
  assert.equal(escapeUserText('hello <|fim_prefix|> world'), 'hello <¦fim_prefix¦> world');
  assert.equal(escapeUserText('<|a|><|b_2|>'), '<¦a¦><¦b_2¦>');
  assert.equal(escapeUserText('1 < 2 | 3 > 2 <|not closed'), '1 < 2 | 3 > 2 <|not closed', 'only the whole pattern is touched');
  assert.equal(escapeUserText(' no delimiters '), ' no delimiters ');
  assert.equal(escapeUserText(12), '12');
  // after escaping, the (stand-in) tokenizer no longer produces the delimiter id
  assert.ok(encode('x <|fim_prefix|> y').includes(D.state));
  assert.ok(!encode(escapeUserText('x <|fim_prefix|> y')).includes(D.state));
});

test('the option texts: yes/no, levels, and choices with descriptions', () => {
  assert.deepEqual(optionTexts({ type: 'noul', instructions: 'q' }), ['no', 'yes']);
  assert.deepEqual(optionTexts({ type: 'score', instructions: 'q', levels: ['none', 'mild', 'heavy'] }), ['none', 'mild', 'heavy']);
  assert.deepEqual(optionTexts({ type: 'choice', instructions: 'q', options: ['a', 'b'], descriptions: { a: 'first' } }), ['a: first', 'b']);
  assert.throws(() => optionTexts({ type: 'poem' }), /unknown question type/);
});

test('the layout of the model card: state, then one branch per question, and the index of every </opt>', () => {
  const state = 'I was charged twice for the same order and nobody answers my emails.';
  const cardQuestions = [
    { instr: 'Which team should handle this ticket?', options: ['billing: Charges, refunds, invoices', 'technical support: Bugs, outages', 'sales', 'account management'] },
    { instr: 'Is the customer asking for a refund?', options: ['no', 'yes'] },
    { instr: 'How positive is the sentiment of this message?', options: ['very negative', 'negative', 'neutral', 'positive', 'very positive'] },
  ];
  const ref = cardRecipe(encode, state, cardQuestions);
  const mine = encodeSequence({
    state: encode(state),
    questions: cardQuestions.map((q) => ({ instructions: encode(q.instr), options: q.options.map((o) => encode(o)) })),
    maxStateTokens: 100000, maxLength: 100000,
  });
  assert.deepEqual(mine.inputIds, ref.tokens);
  assert.deepEqual(mine.groups, ref.groups);
  assert.equal(mine.stateTruncated, false);
  for (const g of mine.groups) for (const i of g) assert.equal(mine.inputIds[i], D.optionEnd, 'every index points at a </opt>');
  assert.equal(mine.inputIds[0], D.state);
  assert.equal(mine.inputIds.at(-1), D.decide);
  assert.deepEqual(mine.groups.map((g) => g.length), [4, 2, 5]);
});

test('a yes/no question about a title: the exact sequence', () => {
  // state "a b", question "c d?" -> <state> a b <q> c d ? <opt> no </opt> <opt> yes </opt> <decide>
  const enc = (t) => ({ a: [11], b: [12], 'c d ?': [13, 14, 15], no: [21], yes: [22] })[t];
  const r = encodeSequence({ state: [11, 12], questions: [{ instructions: enc('c d ?'), options: [enc('no'), enc('yes')] }] });
  assert.deepEqual(r.inputIds, [D.state, 11, 12, D.question, 13, 14, 15, D.optionStart, 21, D.optionEnd, D.optionStart, 22, D.optionEnd, D.decide]);
  assert.deepEqual(r.groups, [[9, 12]]);
  assert.equal(r.inputIds[9], D.optionEnd);
  assert.equal(r.inputIds[12], D.optionEnd);
});

test('the same layout as open-jev on many random cases, truncation included', () => {
  let seed = 12345;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const ids = (n) => Array.from({ length: n }, () => 1000 + rnd(50000));
  for (let c = 0; c < 300; c++) {
    const questions = Array.from({ length: 1 + rnd(3) }, () => ({ instructions: ids(1 + rnd(60)), options: Array.from({ length: 2 + rnd(4) }, () => ids(1 + rnd(4))) }));
    const params = { state: ids(rnd(900)), questions, delimiters: D, maxStateTokens: 1 + rnd(500), maxLength: 80 + rnd(1000) };
    let expected;
    try { expected = openJevEncodeKev(params); } catch (e) { assert.throws(() => encodeSequence(params), /allowed/); continue; }
    assert.deepEqual(encodeSequence(params), expected, `case ${c}`);
  }
});

test('a long state is cut to 384 tokens, and to less when the question needs the room', () => {
  const state = Array.from({ length: 1000 }, (_, i) => 2000 + i);
  const q = { instructions: [3000, 3001, 3002], options: [[3003], [3004]] };
  const r = encodeSequence({ state, questions: [q] });
  assert.equal(r.stateTokens, 384);
  assert.equal(r.stateTruncated, true);
  assert.deepEqual(r.inputIds.slice(1, 385), state.slice(0, 384), 'the beginning is kept');
  const tight = encodeSequence({ state, questions: [q], maxLength: 30 });
  assert.equal(tight.inputIds.length <= 30 + 0, true);
  assert.equal(tight.stateTokens, 30 - 1 - (1 + 3 + 3 + 3 + 1));
  const short = encodeSequence({ state: state.slice(0, 5), questions: [q] });
  assert.equal(short.stateTruncated, false);
  assert.equal(short.stateTokens, 5);
  assert.throws(() => encodeSequence({ state, questions: [q], maxLength: 8 }), /more than the 8 allowed/);
});

test('prepareRun escapes, tokenizes and lays out: a title and a rule question', () => {
  const question = { type: 'noul', instructions: 'Is the name of God used here as a curse?' };
  const r = prepareRun({ encode, state: 'Oh my <|fim_prefix|> God\nSome Channel', questions: [question] });
  assert.equal(r.inputIds.filter((x) => x === D.state).length, 1, 'only the real <state> delimiter is in the sequence');
  assert.equal(r.groups[0].length, 2);
  assert.equal(r.inputIds[r.groups[0][0]], D.optionEnd);
  const noOption = r.inputIds.slice(r.groups[0][0] - 2, r.groups[0][0]);
  assert.deepEqual(noOption, [D.optionStart, encode('no')[0]], 'the first option is "no"');
  const two = prepareRun({ encode, state: 'x', questions: [question, { type: 'score', instructions: 'How much?', levels: ['none', 'some', 'lots'] }] });
  assert.deepEqual(two.groups.map((g) => g.length), [2, 3]);
});

test('softmax is stable, sums to one, and follows the temperature', () => {
  const p = softmax([1, 2, 3]);
  assert.ok(Math.abs(p.reduce((a, b) => a + b) - 1) < 1e-12);
  assert.ok(p[2] > p[1] && p[1] > p[0]);
  const big = softmax([1000, 1001]);
  assert.ok(Number.isFinite(big[0]) && Math.abs(big[0] + big[1] - 1) < 1e-12, 'no overflow');
  assert.deepEqual(softmax([]), []);
  assert.ok(Math.abs(softmax([0, 0])[0] - 0.5) < 1e-15);
  assert.ok(softmax([0, 1], 2)[1] < softmax([0, 1], 1)[1], 'a higher temperature flattens');
  assert.ok(Math.abs(softmax([3, 1, 2], 1).reduce((a, b) => a + b) - 1) < 1e-12);
});

test('yes/no: p is the probability of "yes", the second option', () => {
  assert.equal(decodeNoul([0, 0]).p, 0.5);
  const yes = decodeNoul([-2, 2]);
  assert.ok(Math.abs(yes.p - 1 / (1 + Math.exp(-4))) < 1e-12);
  assert.equal(yes.answer, true);
  assert.ok(Math.abs(yes.confidence - yes.p) < 1e-15);
  const no = decodeNoul([3, 0]);
  assert.ok(no.p < 0.05 && no.answer === false);
  assert.ok(Math.abs(no.confidence - (1 - no.p)) < 1e-15);
});

test('levels: p is the expected level index scaled to 0..1', () => {
  const levels = ['none', 'mild', 'heavy'];
  assert.ok(Math.abs(decodeScore(levels, [0, 0, 0]).p - 0.5) < 1e-12, 'even odds: the middle');
  const lots = decodeScore(levels, [-9, -9, 9]);
  assert.ok(lots.p > 0.999 && lots.level === 'heavy');
  const none = decodeScore(levels, [9, -9, -9]);
  assert.ok(none.p < 0.001 && none.level === 'none');
  const p = softmax([1, 2, 0]);
  assert.ok(Math.abs(decodeScore(levels, [1, 2, 0]).p - (p[1] * 1 + p[2] * 2) / 2) < 1e-12);
  assert.equal(decodeScore(['only'], [3]).p, 0, 'a single level has nothing to scale');
  const c = decodeChoice(['a', 'b', 'c'], [0, 5, 1]);
  assert.equal(c.choice, 'b');
});

test('decodeAnswers reads the number at each </opt> and softmaxes within the question', () => {
  const questions = [{ type: 'noul', instructions: 'q1' }, { type: 'score', instructions: 'q2', levels: ['low', 'high'] }];
  const run = prepareRun({ encode, state: 'text', questions });
  const logits = new Float32Array(run.inputIds.length).fill(-50);        // every other token has a big negative number: it must not matter
  logits[run.groups[0][0]] = 0; logits[run.groups[0][1]] = 2;             // no=0, yes=2
  logits[run.groups[1][0]] = 1; logits[run.groups[1][1]] = 1;             // low=high
  const [a, b] = decodeAnswers(questions, run.groups, logits);
  assert.ok(Math.abs(a.p - 1 / (1 + Math.exp(-2))) < 1e-6);
  assert.ok(Math.abs(b.p - 0.5) < 1e-6);
  const bad = decodeAnswers(questions, run.groups, new Float32Array(run.inputIds.length).fill(NaN));
  assert.deepEqual(bad.map((x) => x.p), [null, null]);
  assert.equal(bad[0].error, 'bad-logits');
});

test('what a backend says to the engine: {p} within 0..1, or {p: null, error}', () => {
  assert.deepEqual(backendAnswer({ p: 0.25 }), { p: 0.25 });
  assert.deepEqual(backendAnswer({ p: 1.2 }), { p: 1 });
  assert.deepEqual(backendAnswer({ p: -3 }), { p: 0 });
  assert.deepEqual(backendAnswer({ p: NaN }), { p: null, error: 'bad-answer' });
  assert.deepEqual(backendAnswer({ p: null, error: 'bad-logits' }), { p: null, error: 'bad-logits' });
  assert.deepEqual(backendAnswer(undefined), { p: null, error: 'bad-answer' });
});
