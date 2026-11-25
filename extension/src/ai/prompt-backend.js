// Chrome's built-in Prompt API (Gemini Nano) as an optional decision backend.
//
// Written to the documented behaviour (see plan.md section 3.3). Facts that shape this file:
//  - the API has no probabilities, so p is the fraction of differently worded prompts that agree;
//  - extensions may set topK and temperature, but only together; we use topK 1, temperature 0;
//  - structured output: responseConstraint takes a JSON Schema ({type:'boolean'}) or a RegExp;
//  - creating a session needs a user gesture only while the model still has to be downloaded;
//  - every call can fail (unavailable, unsafe-response filter, quota) and callers must cope.
// Nothing here is cached across service-worker restarts.

const IO = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };
const SYSTEM = 'You are a careful content classifier. You answer only with the requested value. When you are unsure, answer false.';
const MAX_TEXT = 1400;

export function isSupported() {
  return typeof LanguageModel !== 'undefined';
}

/** 'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'available' | 'error:<name>' */
export async function getAvailability() {
  if (!isSupported()) return 'unsupported';
  try {
    return await LanguageModel.availability(IO);
  } catch (e) {
    return 'error:' + ((e && e.name) || 'unknown');
  }
}

let basePromise = null;
let queue = Promise.resolve();

export function resetSession() {
  const p = basePromise;
  basePromise = null;
  if (p) p.then((s) => s.destroy && s.destroy()).catch(() => {});
}

async function createBase(monitor) {
  const common = { ...IO, initialPrompts: [{ role: 'system', content: SYSTEM }] };
  if (monitor) common.monitor = monitor;
  try {
    return await LanguageModel.create({ ...common, topK: 1, temperature: 0 });
  } catch (e) {
    // some builds reject the legacy parameters: fall back to the defaults rather than failing
    if (e && (e.name === 'TypeError' || e.name === 'RangeError' || e.name === 'NotSupportedError')) return LanguageModel.create(common);
    throw e;
  }
}

async function base() {
  if (!basePromise) {
    basePromise = createBase().catch((e) => { basePromise = null; throw e; });
  }
  return basePromise;
}

/**
 * Download and prepare the model. Must be called from an extension page in response to a click.
 * @param {(fraction:number)=>void} onProgress
 */
export async function downloadAndPrepare(onProgress) {
  const session = await createBase((m) => m.addEventListener('downloadprogress', (e) => onProgress && onProgress(e.loaded)));
  if (session.destroy) session.destroy();
  resetSession();
  return getAvailability();
}

function frames(question, text) {
  const t = text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text;
  return [
    `${question}\n\nText:\n"""${t}"""\n\nAnswer with true or false.`,
    `Read the text and answer the question with true (yes) or false (no).\nQuestion: ${question}\nText: <<<${t}>>>`,
    `Text: ${t}\n\nIs this the case? ${question}\nReply with only true or false.`,
  ];
}

async function runOnce(prompt, constraint) {
  const root = await base();
  const session = await root.clone();
  try {
    return await session.prompt(prompt, { responseConstraint: constraint });
  } finally {
    if (session.destroy) session.destroy();
  }
}

function serial(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

function fail(e) {
  return { p: null, error: (e && e.name) || String(e) };
}

/** Yes/no: p is the share of three prompt wordings that answer true. */
export function askNoul(question, text) {
  return serial(async () => {
    if (!isSupported()) return { p: null, error: 'unsupported' };
    try {
      let yes = 0;
      const prompts = frames(question, text);
      for (const prompt of prompts) {
        const out = await runOnce(prompt, { type: 'boolean' });
        if (JSON.parse(out) === true) yes++;
      }
      return { p: yes / prompts.length, votes: yes, of: prompts.length };
    } catch (e) {
      return fail(e);
    }
  });
}

/** Ordinal answer: p is the mean level index over three wordings, scaled to 0..1. */
export function askScore(question, levels, text) {
  return serial(async () => {
    if (!isSupported()) return { p: null, error: 'unsupported' };
    try {
      const constraint = new RegExp('^(' + levels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')$');
      const ask = `${question}\nChoose exactly one of: ${levels.join(', ')}.`;
      let sum = 0;
      const prompts = frames(ask, text).map((f) => f.replace('Answer with true or false.', 'Answer with one level name.').replace('Reply with only true or false.', 'Reply with only one level name.'));
      for (const prompt of prompts) {
        const out = (await runOnce(prompt, constraint)).trim();
        const i = levels.indexOf(out);
        if (i < 0) return { p: null, error: 'bad-answer' };
        sum += i / (levels.length - 1);
      }
      return { p: sum / prompts.length };
    } catch (e) {
      return fail(e);
    }
  });
}
