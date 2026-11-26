// A smoke test of the local model Kev-0.6B on the rule author's own examples, in Node (no browser).
//
//   KEV_DEPS=<folder with node_modules that holds @huggingface/transformers 4.3.2 and onnxruntime-node>
//   KEV_MODEL=<folder that holds onnx-community/kev-0.6b-ONNX/{config.json,tokenizer.json,tokenizer_config.json,onnx/model_q4.onnx,onnx/model_q4.onnx_data}>
//   node tools/eval-kev.mjs [--dtype q4] [--variant question|statement|short] [--grid "shots:0,format:current;shots:2,format:after"]
//                           [--focus freemasonry,communism,modernism,spiritism] [--rules id,id] [--max-state 384] [--max-length 1024] [--out result.json] [--quiet]
//
// The repository has no dependencies and keeps none: install them in a scratch folder (`npm install @huggingface/transformers@4.3.2`), and
// point KEV_DEPS at its node_modules. The model files must be real files (hard links are fine; ONNX Runtime refuses symbolic links for the
// weights). The files must be the pinned ones of src/ai/kev-manifest.js: this tool checks the size of the graph and the data file.
//
// For every text rule that has a question it takes the lines `example:` (what the rule should catch) and `spared:` (what looks similar and
// must be left alone), builds the text as the engine does for a feed card (title and channel, joined by a line break; here the channel is empty),
// and reports per line:
//   - the lexicon alone: the word-list score `pLex` and whether the REAL engine flags the line without a model;
//   - the model alone: p(yes) of the rule's question, asked for every line (the engine asks only inside the uncertain band, and for `confirm: model` rules also after a strong hit);
//   - lexicon plus model: what the REAL engine decides with this model as its backend.
// Examples in the question (core/shots.js): the engine shows the model the nearest `example:` and `spared:` lines beside the question. Here a
// "config" is a number of such lines per side (`shots`) and a format of the block ("current" is what core/shots.js writes today); every line is judged with ITSELF
// left out of the examples (leave-one-out), so that the model is never shown its own answer. With --grid the same model run goes through several configs.
// These are the rule author's illustrations, not a labelled test set: they show whether the model separates what the author calls "caught" from what he
// calls "spared", nothing more.
import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseRules, splitLine } from '../extension/src/core/rules.js';
import { parseLexicon } from '../extension/src/core/lexicon.js';
import { Engine } from '../extension/src/core/engine.js';
import { nearest, withExamples, MAX_SHOTS } from '../extension/src/core/shots.js';
import { KEV, graphFile, dataFile } from '../extension/src/ai/kev-manifest.js';
import { prepareRun, decodeAnswers } from '../extension/src/ai/kev-core.js';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const DEPS = process.env.KEV_DEPS;
const MODEL = process.env.KEV_MODEL;
if (!DEPS || !MODEL) { console.error('set KEV_DEPS and KEV_MODEL (see the header of this file)'); process.exit(2); }
const dtype = arg('--dtype', 'q4');
const variant = arg('--variant', 'question');
const maxStateTokens = Number(arg('--max-state', KEV.maxStateTokens));
const maxLength = Number(arg('--max-length', KEV.maxLength));
const onlyRules = arg('--rules', '') ? arg('--rules').split(',') : null;
const FOCUS = arg('--focus', 'freemasonry,communism,modernism,spiritism').split(',');
const outFile = arg('--out', null);
const quiet = process.argv.includes('--quiet');

const EXT = resolve(import.meta.dirname, '../extension');
const text = ['vianney.en.rules', 'vianney.media.en.rules'].map((f) => readFileSync(join(EXT, 'rules', f), 'utf8')).join('\n\n');
const { rules } = parseRules(text);
const lexicons = {};
for (const f of readdirSync(join(EXT, 'lexicon'))) lexicons[f.replace(/\.txt$/, '')] = parseLexicon(readFileSync(join(EXT, 'lexicon', f), 'utf8'), f);

// ---- the model
const tf = await import(pathToFileURL(join(DEPS, '@huggingface/transformers/dist/transformers.node.mjs')).href);
const { env, AutoTokenizer, PreTrainedModel, Tensor } = tf;
env.allowLocalModels = true; env.allowRemoteModels = false; env.localModelPath = MODEL.endsWith('/') ? MODEL : MODEL + '/';
const setId = dtype === 'q4f16' ? 'q4f16' : 'q4';
for (const f of [graphFile(setId), dataFile(setId)]) {
  const p = join(MODEL, KEV.repo, f.path);
  if (statSync(p).size !== f.size) throw new Error(`${p}: ${statSync(p).size} bytes, the manifest says ${f.size}`);
}
const tokenizer = await AutoTokenizer.from_pretrained(KEV.repo);
const model = await PreTrainedModel.from_pretrained(KEV.repo, { dtype, device: 'cpu' });
const encode = (t) => Array.from(tokenizer(t, { add_special_tokens: false }).input_ids.data, Number);

const asked = new Map();       // question + text -> {p, tokens, truncated}
let modelCalls = 0;
async function ask(question, state) {
  const key = JSON.stringify([question, state]);
  if (asked.has(key)) return asked.get(key);
  const run = prepareRun({ encode, state, questions: [question], maxStateTokens, maxLength });
  const { logits } = await model({
    input_ids: new Tensor('int64', BigInt64Array.from(run.inputIds, BigInt), [1, run.inputIds.length]),
    attention_mask: new Tensor('int64', new BigInt64Array(run.inputIds.length).fill(1n), [1, run.inputIds.length]),
  });
  const [a] = decodeAnswers([question], run.groups, Array.from(logits.to('float32').data));
  modelCalls++;
  const r = { p: a.p, tokens: run.inputIds.length, truncated: run.stateTruncated };
  asked.set(key, r);
  return r;
}

// ---- the question as the rule writes it, or turned into a statement (only the common openings can be turned: the others stay as written)
const CONJ = (verb) => (/(s|x|z|ch|sh)$/.test(verb) ? verb + 'es' : /[^aeiou]y$/.test(verb) ? verb.slice(0, -1) + 'ies' : verb === 'have' ? 'has' : verb + 's');
export function asStatement(q) {
  const s = q.trim().replace(/\?$/, '');
  let m;
  if ((m = s.match(/^Is (this) (.*)$/))) return `This is ${m[2]}.`;
  if ((m = s.match(/^Does (this|the speaker) (\S+)(.*)$/))) return `${m[1][0].toUpperCase() + m[1].slice(1)} ${CONJ(m[2])}${m[3]}.`;
  return null;
}
// "short": the question without its exceptions (", and not in prayer ..." and ", rather than discuss them ..."): an extra variant, to see whether the exceptions hurt a small model.
export const withoutExceptions = (q) => q.replace(/,?\s+(and not|rather than|and does not)\b.*$/s, '?');
const phrase = (q) => (variant === 'statement' ? asStatement(q) || q : variant === 'short' ? withoutExceptions(q) : q);

// ---- formats of the block of examples beside the question. `current` is what core/shots.js writes now (the engine's own function is called, so that this tool also tests it);
// the others are written out here: `after` is what core/shots.js wrote before 2026-11-26 (the examples after the question), `before` is the format that replaced it.
const quote = (t) => `“${String(t).replace(/\s+/g, ' ').trim().slice(0, 140)}”`;
export const FORMATS = {
  // the examples after the question (the first format of core/shots.js)
  after: (q, yes, no) => `${q}\nFor example, yes: ${yes.map(quote).join('; ')}\nFor example, no: ${no.map(quote).join('; ')}`,
  // two bulleted lists with a plain heading each
  list: (q, yes, no) => `${q}\nTitles that count (yes):\n${yes.map((t) => `- ${quote(t)}`).join('\n')}\nTitles that do not count (no):\n${no.map((t) => `- ${quote(t)}`).join('\n')}`,
  // the examples alternate, each with its answer, like a few-shot prompt
  pairs: (q, yes, no) => `${q}\nExamples:\n${Array.from({ length: Math.max(yes.length, no.length) }, (_, i) => [yes[i] !== undefined ? `${quote(yes[i])} -> yes` : null, no[i] !== undefined ? `${quote(no[i])} -> no` : null].filter(Boolean).join('\n')).join('\n')}`,
  // the examples first, the question last
  before: (q, yes, no) => `Examples that count (yes): ${yes.map(quote).join('; ')}\nExamples that do not count (no): ${no.map(quote).join('; ')}\nQuestion: ${q}`,
};

/** The question as the model gets it for one text, in a format, with `leaveOut` not shown. */
function build(rule, plain, state, shots, format, leaveOut) {
  const n = Math.min(MAX_SHOTS, Math.max(0, Math.floor(shots)));
  if (!n) return plain;
  if (format === 'current') return withExamples(plain, rule, { shots: n, text: state, leaveOut });   // the real function
  const keep = (t) => t !== leaveOut;
  const yes = nearest(rule.examples.filter(keep), state, n);
  const no = nearest(rule.spared.filter(keep), state, n);
  if (!yes.length || !no.length) return plain;
  return FORMATS[format](plain, yes, no);
}

// ---- the lines
const textRules = rules.filter((r) => r.lexicon.length && r.asks.length && r.where.includes('feed-card') && (!onlyRules || onlyRules.includes(r.id)));
const byQuestion = new Map(textRules.flatMap((r) => r.asks.map((q) => [q.question, r])));

function auc(pos, neg) {
  if (!pos.length || !neg.length) return null;
  let wins = 0;
  for (const a of pos) for (const b of neg) wins += a > b ? 1 : a === b ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}

/** Run every line of every rule once for one config; the engine is the real one, its settings carry no shots (this tool puts them in itself, with the line left out). */
async function runConfig({ shots, format }) {
  const results = [];
  let current = { rule: null, title: null, state: null };
  const backend = {
    enabled: true, mediaEnabled: {},
    async askNoul(q, t) { const rule = byQuestion.get(q); const r = await ask({ type: 'noul', instructions: build(rule, phrase(q), t, shots, format, current.title) }, t); return { p: r.p }; },
    async askScore(q, levels, t) { const r = await ask({ type: 'score', instructions: phrase(q), levels }, t); return { p: r.p }; },
  };
  for (const rule of textRules) {
    const lines = [...rule.examples.map((t) => ({ title: t, kind: 'example' })), ...rule.spared.map((t) => ({ title: t, kind: 'spared' }))];
    const settings = { ruleEnabled: { [rule.id]: true }, ai: { shots: 0 } };
    const alone = new Engine({ rules, lexicons, settings, backend: null });
    const withModel = new Engine({ rules, lexicons, settings, backend });
    for (const line of lines) {
      const item = splitLine(line.title);
      const stateText = alone.textFor(item, 'feed-card');
      current = { rule, title: line.title, state: stateText };
      const stage = alone.lexiconStage(rule, stateText);
      const quick = alone.evaluateQuick(item, 'feed-card').results.find((r) => r.ruleId === rule.id);
      // the model alone, for every line: all the questions of the rule, the highest p wins (as the engine does)
      let pModel = null; let tokens = 0; let truncated = false;
      for (const q of rule.asks) {
        const r = await ask(q.type === 'score' ? { type: 'score', instructions: phrase(q.question), levels: q.levels } : { type: 'noul', instructions: build(rule, phrase(q.question), stateText, shots, format, line.title) }, stateText);
        pModel = pModel === null ? r.p : Math.max(pModel, r.p);
        tokens = Math.max(tokens, r.tokens); truncated = truncated || r.truncated;
      }
      const full = (await withModel.evaluate(item, 'feed-card')).results.find((r) => r.ruleId === rule.id);
      results.push({
        rule: rule.id, kind: line.kind, title: line.title, flagAt: rule.flagAt, confirm: rule.confirm === 'model',
        pLex: stage.pLex, asked: stage.needsModel || stage.needsConfirm, lexFlag: quick.flagged,
        pModel, tokens, truncated, p: full.p, via: full.via, vetoed: !!full.vetoed, bothFlag: full.flagged,
      });
    }
  }
  return results;
}

const cnt = (xs, f) => xs.filter(f).length;
const f2 = (x) => (x === null || x === undefined ? '  - ' : x.toFixed(2));

/** The numbers of a set of lines. */
function measure(rs) {
  const ex = rs.filter((r) => r.kind === 'example');
  const sp = rs.filter((r) => r.kind === 'spared');
  const exW = cnt(ex, (r) => r.lexFlag); const exE = cnt(ex, (r) => r.bothFlag);
  const spW = cnt(sp, (r) => r.lexFlag); const spE = cnt(sp, (r) => r.bothFlag);
  return {
    examples: ex.length, spared: sp.length, exW, exE, spW, spE,
    gained: cnt(ex, (r) => r.bothFlag && !r.lexFlag), lost: cnt(ex, (r) => !r.bothFlag && r.lexFlag),
    cleared: cnt(sp, (r) => !r.bothFlag && r.lexFlag), added: cnt(sp, (r) => r.bothFlag && !r.lexFlag),
    errorsWords: (ex.length - exW) + spW, errorsEngine: (ex.length - exE) + spE,   // lines the verdict gets wrong: missed examples plus flagged spared lines
    auc: auc(ex.map((r) => r.pModel), sp.map((r) => r.pModel)),
    asked: cnt(rs, (r) => r.asked), maxTokens: Math.max(0, ...rs.map((r) => r.tokens)),
  };
}

function summary(label, m) {
  return `${label.padEnd(26)} examples flagged ${String(m.exW).padStart(3)} -> ${String(m.exE).padStart(3)} of ${String(m.examples).padStart(3)}  spared flagged ${String(m.spW).padStart(3)} -> ${String(m.spE).padStart(3)} of ${String(m.spared).padStart(3)}  `
    + `errors ${String(m.errorsWords).padStart(3)} -> ${String(m.errorsEngine).padStart(3)}  (gained ${m.gained}, lost ${m.lost}, cleared ${m.cleared}, added ${m.added})  model-alone AUC ${f2(m.auc)}  asked ${m.asked}  longest ${m.maxTokens} tokens`;
}

const parseGrid = (s) => (s || 'shots:0,format:current').split(';').map((c) => Object.fromEntries(c.split(',').map((kv) => kv.split(':'))))
  .map((c) => ({ shots: Number(c.shots || 0), format: c.format || 'current' }));
const grid = parseGrid(arg('--grid', null));

const say = (s = '') => { if (!quiet || /^\n?(Kev|CONFIG|  )/.test(s)) console.log(s); };
say(`Kev-0.6B ${dtype} on CPU (onnxruntime-node), question variant "${variant}", maxStateTokens ${maxStateTokens}, maxLength ${maxLength}; ${textRules.length} rules; focus rules: ${FOCUS.join(', ')}`);
const all = [];
for (const config of grid) {
  const t0 = performance.now();
  const results = await runConfig(config);
  const seconds = ((performance.now() - t0) / 1000).toFixed(0);
  const focus = results.filter((r) => FOCUS.includes(r.rule));
  say(`\nCONFIG shots ${config.shots}, format ${config.format} (${seconds} s, ${modelCalls} model calls so far)`);
  say('  ' + summary('all rules', measure(results)));
  say('  ' + summary(`focus (${FOCUS.length} rules)`, measure(focus)));
  for (const id of FOCUS) say('  ' + summary(`  ${id}`, measure(results.filter((r) => r.rule === id))));
  const confirmRules = results.filter((r) => r.confirm);
  say('  ' + summary('rules with confirm: model', measure(confirmRules)));
  all.push({ config, results });
}

// the detail of the last config, as in the first version of this tool
if (!quiet) {
  const { results } = all[all.length - 1];
  for (const rule of textRules) {
    const rs = results.filter((r) => r.rule === rule.id);
    const m = measure(rs);
    say(`\n${rule.id} (flag at ${rule.flagAt}${rule.confirm === 'model' ? ', confirm: model' : ''}): examples ${m.exW}->${m.exE}/${m.examples}, spared ${m.spW}->${m.spE}/${m.spared}`);
    for (const r of rs) say(`   ${r.kind === 'example' ? 'EX' : 'SP'} pLex ${f2(r.pLex)} words ${r.lexFlag ? 'FLAG' : '    '} | model alone ${f2(r.pModel)} | engine ${f2(r.p)} via ${r.via.padEnd(13)} ${r.bothFlag ? 'FLAG' : '    '}${r.vetoed ? ' VETO' : ''} | ${r.title.slice(0, 70)}`);
  }
}
if (outFile) writeFileSync(outFile, JSON.stringify({ dtype, variant, maxStateTokens, maxLength, grid: all }, null, 1));
await model.dispose?.();
