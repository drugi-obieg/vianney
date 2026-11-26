// Kev-0.6B: how a question about a text is laid out for the model, and how the answer is read back. Pure functions, no browser API,
// so they are tested in Node (tests/kev-core.test.js).
//
// The model is not a text generator. One text (the "state") and any number of typed questions are packed into ONE sequence of token ids:
//
//   <state> state-tokens  <q> question-tokens  <opt> option-1 </opt>  <opt> option-2 </opt>  <decide>   <q> ...
//
// A block-causal mask inside the graph lets each question see the state and itself only, so a question gets the same answer alone or
// packed with others. The graph returns one number per token ("logits"); the score of an option is the number at that option's `</opt>`
// token, and the probabilities of one question are the softmax of its options' scores. For a yes/no question the options are
// "no" and "yes" and the answer is p(yes).
// Source: the model card of onnx-community/kev-0.6b-ONNX (its "Usage with Transformers.js" recipe) and the `encodeKevSequence`,
// `escape` and `decodeAnswer` functions of the open-jev package 0.1.2 (MIT), which this file re-implements and is tested against.

import { KEV } from './kev-manifest.js';

/** Caller text can never produce a delimiter: `<|name|>` becomes `<¦name¦>` before it is tokenized (config.json: user_text_escape). */
export function escapeUserText(text) {
  return String(text).replace(/<\|([A-Za-z0-9_]+)\|>/g, '<¦$1¦>');
}

export const NOUL_OPTIONS = KEV.noulOptions;

/** The option texts of a question, as they are fed to the model. */
export function optionTexts(question) {
  if (question.type === 'noul') return [...NOUL_OPTIONS];
  if (question.type === 'score') return [...question.levels];
  if (question.type === 'choice') {
    const d = question.descriptions || {};
    return question.options.map((o) => (d[o] ? `${o}: ${d[o]}` : o));
  }
  throw new Error(`unknown question type: ${question && question.type}`);
}

/**
 * Lay out the token ids of one state and its questions.
 * @param {{state: number[], questions: {instructions: number[], options: number[][]}[], delimiters?: object, maxStateTokens?: number, maxLength?: number}} p
 *   `maxLength` limits the state plus its delimiter plus the longest question (instruction, options and delimiters).
 * @returns {{inputIds: number[], groups: number[][], stateTokens: number, stateTruncated: boolean}}
 *   `groups[i][j]` is the index, in the sequence, of the `</opt>` token of option j of question i.
 */
export function encodeSequence({ state, questions, delimiters = KEV.delimiters, maxStateTokens = KEV.maxStateTokens, maxLength = KEV.maxLength }) {
  const branches = questions.map((q) => {
    const branch = [delimiters.question, ...q.instructions];
    const ends = [];
    for (const option of q.options) {
      branch.push(delimiters.optionStart, ...option, delimiters.optionEnd);
      ends.push(branch.length - 1);
    }
    branch.push(delimiters.decide);
    return { branch, ends };
  });
  const longest = branches.length ? Math.max(...branches.map((b) => b.branch.length)) : 0;
  const budget = maxLength - 1 - longest; // the <state> delimiter counts against the budget
  if (budget < 0) throw new Error(`a question needs ${longest + 1} tokens, which is more than the ${maxLength} allowed`);
  const stateTokens = state.slice(0, Math.min(maxStateTokens, budget));
  const inputIds = [delimiters.state, ...stateTokens];
  const groups = [];
  for (const { branch, ends } of branches) {
    const base = inputIds.length;
    for (const id of branch) inputIds.push(id);
    groups.push(ends.map((e) => base + e));
  }
  return { inputIds, groups, stateTokens: stateTokens.length, stateTruncated: stateTokens.length < state.length };
}

/**
 * Tokenize and lay out in one step.
 * @param {{encode: (text: string) => number[], state: string, questions: object[], delimiters?: object, maxStateTokens?: number, maxLength?: number}} p
 *   `encode` turns (escaped) text into token ids WITHOUT special tokens added; questions are `{type: 'noul', instructions}`,
 *   `{type: 'score', instructions, levels}` or `{type: 'choice', instructions, options, descriptions?}`
 */
export function prepareRun({ encode, state, questions, ...limits }) {
  const tokenized = questions.map((q) => ({
    instructions: encode(escapeUserText(q.instructions)),
    options: optionTexts(q).map((o) => encode(escapeUserText(o))),
  }));
  return encodeSequence({ state: encode(escapeUserText(state)), questions: tokenized, ...limits });
}

/** Numerically stable softmax. */
export function softmax(xs, temperature = 1) {
  if (!xs.length) return [];
  const t = Math.max(1e-6, temperature);
  let max = -Infinity;
  for (const x of xs) if (x > max) max = x;
  const e = xs.map((x) => Math.exp((x - max) / t));
  let sum = 0;
  for (const v of e) sum += v;
  return e.map((v) => v / sum);
}

function argmax(xs) {
  let best = 0;
  for (let i = 1; i < xs.length; i++) if (xs[i] > xs[best]) best = i;
  return best;
}

/** Yes/no: the options are "no" and "yes", so the answer is the second probability. */
export function decodeNoul(scores, temperature = 1) {
  const probabilities = softmax(scores, temperature);
  const p = probabilities[NOUL_OPTIONS.indexOf('yes')];
  return { p, answer: p >= 0.5, confidence: Math.max(p, 1 - p) };
}

/** Ordered levels: `score` is the expected level index, `normalized` the same scaled to 0..1 (what the engine takes as p). */
export function decodeScore(levels, scores, temperature = 1) {
  const probabilities = softmax(scores, temperature);
  const expected = probabilities.reduce((s, p, i) => s + p * i, 0);
  const last = levels.length - 1;
  const best = argmax(probabilities);
  return {
    p: last > 0 ? expected / last : 0,
    score: expected,
    level: levels[Math.min(last, Math.max(0, Math.round(expected)))],
    confidence: probabilities[best],
    probabilities,
  };
}

export function decodeChoice(options, scores, temperature = 1) {
  const probabilities = softmax(scores, temperature);
  const best = argmax(probabilities);
  return { choice: options[best], confidence: probabilities[best], probabilities };
}

/**
 * Read the answers of every question from the graph's output.
 * @param {object[]} questions the same list that went into prepareRun
 * @param {number[][]} groups from prepareRun
 * @param {ArrayLike<number>} logits one number per token, float32
 * @returns {object[]} {p, ...details} per question; p is p(yes) for yes/no and the scaled expected level for levels; p is null when the model's numbers are not finite
 */
export function decodeAnswers(questions, groups, logits, temperature = 1) {
  return questions.map((q, i) => {
    const scores = groups[i].map((index) => Number(logits[index]));
    if (!scores.length || scores.some((x) => !Number.isFinite(x))) return { p: null, error: 'bad-logits' };
    if (q.type === 'noul') return decodeNoul(scores, temperature);
    if (q.type === 'score') return decodeScore(q.levels, scores, temperature);
    const c = decodeChoice(optionTexts(q), scores, temperature);
    return { p: c.confidence, ...c };
  });
}

/** What a backend answers to the engine for one question: {p} or {p: null, error}. */
export function backendAnswer(answer) {
  if (!answer || typeof answer.p !== 'number' || !Number.isFinite(answer.p)) return { p: null, error: (answer && answer.error) || 'bad-answer' };
  return { p: Math.min(1, Math.max(0, answer.p)) };
}
