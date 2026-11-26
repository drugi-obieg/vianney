// "Check on the rule examples": does the on-device model work together with the word lists and the spared titles?
//
// Every text rule that has a question carries lines the rule's author wrote: `example:` (a title the rule should catch) and `spared:` (a title
// that looks similar and must be left alone). This module runs each line through the REAL engine twice, once with the word lists alone and
// once with the models behind the engine (in the settings page: the layered models of the service worker), and counts, per rule, how many
// examples are flagged and how many spared lines are flagged by mistake. The lines are the author's illustrations, not a labelled test set:
// the counts show whether the models help the rule on its own examples, nothing more.
//
// The models can change the verdict of the word lists in both directions: they can ADD a flag (a cue below the rule's level that the model confirms) and,
// for a rule with `confirm: model`, TAKE ONE AWAY (a clear "no" overrules a strong hit). So four things are counted apart: examples the models added (good),
// spared lines the models cleared (good), examples the models cleared (bad) and spared lines the models added (bad).
// Each line is judged with ITSELF left out of the examples that the engine shows the model beside its question (`leaveOut`): a model must not be handed its
// own answer.
//
// Pure: the models are reached through the `ask` function that the caller passes in, so the counting is tested in Node with a stand-in model.
import { Engine } from './engine.js';
import { splitLine } from './rules.js';

export const MODEL_NAMES = { kev: 'Kev-0.6B', prompt: 'Gemini Nano' };
const SURFACES = ['feed-card', 'related', 'watch-meta', 'comment', 'subtitles'];

/** The surface whose text the check builds from a line: a feed card (title and channel) wherever the rule reads cards. */
export function surfaceOf(rule) {
  return SURFACES.find((s) => rule.where.includes(s)) || null;
}

/** The rules that the check can run: text rules with a question. Rules for pictures and sound are not judged from a title. */
export function checkableRules(rules) {
  return rules.filter((r) => r.asks.length > 0 && surfaceOf(r) && !r.where.some((w) => w === 'thumbnail' || w === 'audio'));
}

export function countLines(rules) {
  return checkableRules(rules).reduce((n, r) => n + r.examples.length + r.spared.length, 0);
}

const label = (via) => String(via || '').split('+').map((v) => MODEL_NAMES[v] || v).join(' + ');
const pct = (p) => (typeof p === 'number' ? p.toFixed(2) : '-');

/** A backend for the engine that remembers what each model said, so that the result can show it. `ask({kind, question, levels, text})` -> {p, via?, steps?, error?} */
export function recordingBackend(ask) {
  const calls = [];
  const run = async (msg) => {
    let r;
    try { r = await ask(msg); } catch (e) { r = { p: null, error: String((e && e.message) || e) }; }
    calls.push({ question: msg.question, p: typeof (r && r.p) === 'number' ? r.p : null, via: (r && r.via) || null, steps: (r && r.steps) || [], error: (r && r.error) || null });
    return r;
  };
  return { enabled: true, mediaEnabled: {}, calls, askNoul: (question, text) => run({ kind: 'noul', question, text }), askScore: (question, levels, text) => run({ kind: 'score', question, levels, text }) };
}

/**
 * Judge every line of one rule.
 * @param {{rule: object, rules: object[], lexicons: object, settings?: object, ask: Function, onLine?: Function, signal?: AbortSignal}} o
 * @returns {Promise<{id: string, name: string, flagAt: number, lines: object[]}>}
 */
export async function checkRule({ rule, rules, lexicons, settings = {}, ask, onLine = () => {}, signal }) {
  const surface = surfaceOf(rule);
  const mine = { ...settings, ruleEnabled: { ...(settings.ruleEnabled || {}), [rule.id]: true } };   // a rule that is switched off can still be tried
  const alone = new Engine({ rules, lexicons, settings: mine, backend: null });
  const backend = recordingBackend(ask);
  const withModels = new Engine({ rules, lexicons, settings: mine, backend });
  const lines = [];
  for (const [kind, titles] of [['example', rule.examples], ['spared', rule.spared]]) {
    for (const title of titles) {
      if (signal && signal.aborted) throw Object.assign(new Error('stopped'), { name: 'AbortError', partial: { id: rule.id, name: rule.name, lines } });
      const item = { ...splitLine(title), description: '', keywords: '' };
      item.text = item.title;
      const w = alone.evaluateQuick(item, surface).results.find((r) => r.ruleId === rule.id);
      const before = backend.calls.length;
      const m = (await withModels.evaluate(item, surface, { leaveOut: title })).results.find((r) => r.ruleId === rule.id);
      const answers = backend.calls.slice(before);
      const ps = answers.map((a) => a.p).filter((x) => typeof x === 'number');
      const line = {
        rule: rule.id, kind, title, flagAt: m.flagAt,
        pWords: w.p, flaggedByWords: !!w.flagged,
        p: m.p, pModels: ps.length ? Math.max(...ps) : null, via: m.via, flagged: !!m.flagged, vetoed: !!m.vetoed, modelError: m.modelError || null,
        asked: answers.length > 0, answers,
      };
      lines.push(line);
      onLine(line);
    }
  }
  return { id: rule.id, name: rule.name, flagAt: lines.length ? lines[0].flagAt : rule.flagAt, lines };
}

/**
 * Run the check for every checkable rule, one after the other.
 * @param {{rules: object[], lexicons: object, settings?: object, ask: Function, onProgress?: (p: {done: number, total: number, rule: string}) => void, signal?: AbortSignal, only?: string[]}} o
 * @returns {Promise<{results: object[], stopped: boolean}>}
 */
export async function runCheck({ rules, lexicons, settings = {}, ask, onProgress = () => {}, signal, only }) {
  const todo = checkableRules(rules).filter((r) => !only || only.includes(r.id));
  const total = todo.reduce((n, r) => n + r.examples.length + r.spared.length, 0);
  const results = [];
  let done = 0;
  for (const rule of todo) {
    try {
      results.push(await checkRule({ rule, rules, lexicons, settings, ask, signal, onLine: () => onProgress({ done: ++done, total, rule: rule.id }) }));
    } catch (e) {
      if (e && e.name === 'AbortError') { if (e.partial && e.partial.lines.length) results.push(e.partial); return { results, stopped: true }; }
      throw e;
    }
  }
  return { results, stopped: false };
}

/**
 * Counts for one rule. What the models changed, in both directions:
 *   gained   examples the models flagged that the words did not (good)      cleared  spared lines the words flagged that the models cleared (good)
 *   lost     examples the words flagged that the models cleared (bad)       added    spared lines the models flagged that the words did not (bad)
 */
export function summarizeRule(r) {
  const ex = r.lines.filter((l) => l.kind === 'example');
  const sp = r.lines.filter((l) => l.kind === 'spared');
  const n = (xs, k) => xs.filter((l) => l[k]).length;
  return {
    id: r.id, name: r.name,
    examples: ex.length, spared: sp.length,
    exFlaggedWords: n(ex, 'flaggedByWords'), exFlagged: n(ex, 'flagged'),
    spFlaggedWords: n(sp, 'flaggedByWords'), spFlagged: n(sp, 'flagged'),
    asked: r.lines.filter((l) => l.asked).length,
    errors: r.lines.filter((l) => l.modelError).length,
    gained: ex.filter((l) => l.flagged && !l.flaggedByWords).length,
    lost: ex.filter((l) => !l.flagged && l.flaggedByWords).length,
    cleared: sp.filter((l) => !l.flagged && l.flaggedByWords).length,
    added: sp.filter((l) => l.flagged && !l.flaggedByWords).length,
  };
}

export function summarize(results) {
  const rules = results.map(summarizeRule);
  const sum = (k) => rules.reduce((n, r) => n + r[k], 0);
  const keys = ['examples', 'spared', 'exFlaggedWords', 'exFlagged', 'spFlaggedWords', 'spFlagged', 'asked', 'errors', 'gained', 'lost', 'cleared', 'added'];
  return { rules, totals: Object.fromEntries(keys.map((k) => [k, sum(k)])) };
}

/** Which models answered anywhere in the results, by name: ['Kev-0.6B', 'Gemini Nano']. */
export function modelsSeen(results) {
  const seen = new Set();
  for (const r of results) for (const l of r.lines) for (const a of l.answers) for (const s of a.steps || []) if (s.p !== null) seen.add(s.model);
  return [...seen].map((m) => MODEL_NAMES[m] || m);
}

/** One line of the report: what the words said, what the models said, and the verdict. */
export function describeLine(l) {
  const parts = [`words ${pct(l.pWords)}${l.flaggedByWords ? ' (flags)' : ''}`];
  const answered = l.asked && (l.via === 'model' || l.via === 'lexicon+model');
  if (answered) {
    const steps = l.answers.flatMap((a) => (a.steps || []).filter((s) => s.p !== null).map((s) => `${MODEL_NAMES[s.model] || s.model} ${pct(s.p)}`));
    parts.push(`models ${pct(l.pModels)}${steps.length ? ` (${steps.join(', ')})` : ''}`);
  } else if (l.asked || l.modelError) {                 // asked, and nobody could answer: the verdict stays with the words
    const failed = l.answers.flatMap((a) => (a.steps || []).filter((s) => s.p === null && s.error).map((s) => `${MODEL_NAMES[s.model] || s.model}: ${s.error}`));
    parts.push(`models could not answer (${failed.length ? failed.join('; ') : l.modelError || 'no answer'})`);
  } else parts.push('models not asked');
  parts.push(l.flagged ? 'flagged' : 'not flagged');
  if (l.vetoed) parts.push('the models overruled the word lists');
  else if (l.via === 'lexicon+model') parts.push('the models confirmed the word lists');
  const wrong = (l.kind === 'example' && !l.flagged) || (l.kind === 'spared' && l.flagged);
  return `${wrong ? '✗' : '✓'} ${l.title}: ${parts.join(' · ')}`;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** What the models changed for one rule (or all), in words; says so when they changed nothing. */
export function describeChanges(s) {
  const out = [];
  if (s.gained) out.push(`flagged ${plural(s.gained, 'example', 'examples')} that the words missed (good)`);
  if (s.cleared) out.push(`cleared ${plural(s.cleared, 'spared line', 'spared lines')} that the words flagged (good)`);
  if (s.lost) out.push(`cleared ${plural(s.lost, 'example', 'examples')} that the words flagged (bad)`);
  if (s.added) out.push(`flagged ${plural(s.added, 'spared line', 'spared lines')} that the words left alone (bad)`);
  return out.length ? `The models ${out.join(', ')}.` : 'The models changed nothing.';
}

/** The heading line of a rule: "God's name in vain: examples flagged 1 of 2 by words, 2 of 2 with the models; spared lines flagged 0 of 2 by words, 0 of 2 with the models. The models flagged 1 example that the words missed (good)." */
export function describeRule(s) {
  return `${s.name}: examples flagged ${s.exFlaggedWords} of ${s.examples} by words, ${s.exFlagged} of ${s.examples} with the models; spared lines flagged ${s.spFlaggedWords} of ${s.spared} by words, ${s.spFlagged} of ${s.spared} with the models. ${describeChanges(s)}`;
}

export function describeTotals(t, names = []) {
  const who = names.length ? names.join(' and ') : 'the models';
  const plur = names.length !== 1;                      // "Kev-0.6B was asked ... it added", but "the models were asked ... they added"
  const cap = who[0].toUpperCase() + who.slice(1);
  return [
    `Examples (should be flagged): ${t.exFlaggedWords} of ${t.examples} flagged by the word lists alone, ${t.exFlagged} of ${t.examples} with ${who}.`,
    `Spared lines (should be left alone): ${t.spFlaggedWords} of ${t.spared} flagged by the word lists alone, ${t.spFlagged} of ${t.spared} with ${who}.`,
    `${cap} ${plur ? 'were' : 'was'} asked about ${t.asked} of ${t.examples + t.spared} lines (the word lists decide the rest).`,
    describeChanges(t).replace(/^The models/, cap),
  ];
}
