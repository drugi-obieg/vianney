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
  for (const kind of Object.keys(mediaBase)) {
    const m = mediaBase[kind];
    mediaBase[kind] = null;
    if (m) m.then((s) => s.destroy && s.destroy()).catch(() => {});
  }
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


// ------------------------------------------------------------------ pictures and sound (experimental)
// Gemini Nano can take an image or an audio clip next to the text of a prompt. A session has to declare
// the kinds of input it will receive when it is created, so each kind gets its own base session.
// Documented prompt shape: session.prompt([{role: 'user', content: [{type: 'text', value}, {type: 'image', value: blob}]}]).
// Audio input needs a GPU, and either kind may report "unavailable" on a given machine: callers must ask first.

const MEDIA_IO = {
  image: { expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }], expectedOutputs: [{ type: 'text', languages: ['en'] }] },
  audio: { expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'audio' }], expectedOutputs: [{ type: 'text', languages: ['en'] }] },
};
const mediaBase = { image: null, audio: null };

/** 'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'available' | 'error:<name>' */
export async function getMediaAvailability(kind) {
  if (!isSupported() || !MEDIA_IO[kind]) return 'unsupported';
  try {
    return await LanguageModel.availability(MEDIA_IO[kind]);
  } catch (e) {
    return 'error:' + ((e && e.name) || 'unknown');
  }
}

async function createMediaBase(kind, monitor) {
  const common = { ...MEDIA_IO[kind], initialPrompts: [{ role: 'system', content: SYSTEM }] };
  if (monitor) common.monitor = monitor;
  try {
    return await LanguageModel.create({ ...common, topK: 1, temperature: 0 });
  } catch (e) {
    // only invalid sampling parameters justify a retry; NotSupportedError means this kind of input is not available
    if (e && (e.name === 'TypeError' || e.name === 'RangeError')) return LanguageModel.create(common);
    throw e;
  }
}

function mediaBaseFor(kind) {
  if (!mediaBase[kind]) mediaBase[kind] = createMediaBase(kind).catch((e) => { mediaBase[kind] = null; throw e; });
  return mediaBase[kind];
}

/** Download/prepare the model for a kind of input. Call from an extension page, in response to a click. */
export async function prepareMedia(kind, onProgress) {
  const session = await createMediaBase(kind, (m) => m.addEventListener('downloadprogress', (e) => onProgress && onProgress(e.loaded)));
  if (session.destroy) session.destroy();
  mediaBase[kind] = null;
  return getMediaAvailability(kind);
}

function mediaFrames(kind, question) {
  const what = kind === 'image' ? 'picture' : 'audio clip';
  return [
    `${question}\nAnswer with true or false.`,
    `Look at the ${what} carefully, then answer with true (yes) or false (no).\nQuestion: ${question}`,
    `About this ${what}: ${question}\nReply with only true or false.`,
  ];
}

async function runMediaOnce(kind, text, blob) {
  const root = await mediaBaseFor(kind);
  const session = await root.clone();
  try {
    return await session.prompt(
      [{ role: 'user', content: [{ type: 'text', value: text }, { type: kind, value: blob }] }],
      { responseConstraint: { type: 'boolean' } },
    );
  } finally {
    if (session.destroy) session.destroy();
  }
}

/**
 * Ask a yes/no question about a picture or a sound clip.
 * p is the share of the prompt wordings (1 to 3, the `votes` setting) that answer true.
 * A "NotReadableError" is the browser's "unsafe response" filter; it is returned as an error so the
 * caller can decide whether a refusal counts as a flag.
 * @param {'image'|'audio'} kind
 * @param {Blob} blob
 */
export function askMedia(kind, question, blob, { votes = 2 } = {}) {
  return serial(async () => {
    if (!isSupported()) return { p: null, error: 'unsupported' };
    if (!MEDIA_IO[kind]) return { p: null, error: 'bad-kind' };
    try {
      const prompts = mediaFrames(kind, question).slice(0, Math.min(3, Math.max(1, Math.round(votes) || 1)));
      let yes = 0;
      for (const prompt of prompts) {
        const out = await runMediaOnce(kind, prompt, blob);
        if (JSON.parse(out) === true) yes++;
      }
      return { p: yes / prompts.length, votes: yes, of: prompts.length };
    } catch (e) {
      return fail(e);
    }
  });
}
