// Kev-0.6B as seen from the service worker: the same surface as prompt-backend.js (availability, askNoul, askScore, reset), plus what the
// settings page needs (status, download, pause, cancel, delete). The model itself lives in the offscreen document (kev-offscreen.js); this
// file creates that document when it is needed, forwards the messages, and keeps nothing that matters in memory: the service worker may be
// stopped at any moment, so everything is read again from the files (OPFS) or asked of the offscreen document.
import { completeSet, mostDownloaded, removeAll, usage } from './kev-store.js';

const OFFSCREEN_URL = chrome.runtime.getURL('src/ai/kev-offscreen.html');
const ASK_TIMEOUT_MS = 90000;       // a first question also loads the model (a few seconds), a slow processor needs more than a fast graphics chip

let creating = null;
let readyCache = { at: 0, value: null };
const READY_TTL_MS = 5000;

export function forget() {
  readyCache = { at: 0, value: null };
}

async function hasDocument() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [OFFSCREEN_URL] });
  return contexts.length > 0;
}

export async function ensureDocument() {
  if (await hasDocument()) return;
  if (!creating) {
    creating = chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['WORKERS'],
      justification: 'Holds the on-device model that answers the rules\' questions, and the worker that downloads its files. Nothing is sent anywhere.',
    }).finally(() => { creating = null; });
  }
  await creating;
}

export async function closeDocument() {
  if (!(await hasDocument())) return false;
  try { await chrome.offscreen.closeDocument(); } catch (e) { return false; }
  forget();
  return true;
}

/** Send to the offscreen document; right after it was created its listener may not be there yet, so try again for a few seconds. */
async function sendToDocument(msg, { timeoutMs = 15000 } = {}) {
  const end = Date.now() + timeoutMs;
  let lastError = null;
  for (;;) {
    try {
      return await chrome.runtime.sendMessage({ target: 'kev-offscreen', ...msg });
    } catch (e) {
      lastError = e;
      if (Date.now() > end) throw lastError;
      await new Promise((r) => setTimeout(r, 150));
    }
  }
}

async function callDocument(op, extra = {}, { create = true, timeoutMs } = {}) {
  if (create) await ensureDocument();
  else if (!(await hasDocument())) return null;
  return sendToDocument({ op, ...extra }, { timeoutMs });
}

/** What the offscreen document says about the job and the runtime, or null when there is no such document. */
async function documentStatus() {
  try {
    return await callDocument('status', {}, { create: false, timeoutMs: 1500 });
  } catch (e) {
    return null;
  }
}

/**
 * Is the model there and able to answer? Cheap: the files are looked at (cached for a few seconds), and the document is asked only if it exists.
 * @returns {Promise<{ready: boolean, state: 'not-downloaded'|'downloading'|'loading'|'ready'|'error', set: string|null, device: string|null, error: object|null}>}
 */
export async function readiness(force = false) {
  if (!force && Date.now() - readyCache.at < READY_TTL_MS && readyCache.value) return readyCache.value;
  const stored = await completeSet();
  const doc = await documentStatus();
  const job = doc && doc.job;
  const rt = doc && doc.runtime;
  let state;
  if (job && (job.phase === 'downloading' || job.phase === 'checking')) state = 'downloading';
  else if (!stored) state = 'not-downloaded';
  else if (rt && rt.state === 'loading') state = 'loading';
  else if (rt && rt.state === 'error') state = 'error';
  else state = 'ready';
  const value = { ready: !!stored && state !== 'downloading' && state !== 'error', state, set: stored ? stored.set : null, device: rt ? rt.device : null, error: rt && rt.error ? rt.error : null };
  readyCache = { at: Date.now(), value };
  return value;
}

/** The first line of defence against a stuck question: a time limit. */
function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve({ p: null, error: 'timeout' }), ms))]);
}

export async function askNoul(question, text) {
  try {
    return await withTimeout(callDocument('ask', { kind: 'noul', question, text }), ASK_TIMEOUT_MS);
  } catch (e) {
    return { p: null, error: String((e && e.message) || e).slice(0, 200) };
  }
}

export async function askScore(question, levels, text) {
  try {
    return await withTimeout(callDocument('ask', { kind: 'score', question, levels, text }), ASK_TIMEOUT_MS);
  } catch (e) {
    return { p: null, error: String((e && e.message) || e).slice(0, 200) };
  }
}

/** Let go of the model (memory) without deleting its files. */
export async function resetSession() {
  try { await callDocument('unload', {}, { create: false, timeoutMs: 1500 }); } catch (e) { /* no document, nothing to do */ }
  forget();
}

// ------------------------------------------------------------------ for the settings page

/**
 * Everything the settings page shows about the model.
 * @returns {Promise<{stored: object|null, job: object|null, runtime: object|null, usage: object}>}
 */
export async function status(preferSet = 'q4') {
  const stored = (await completeSet()) || (await mostDownloaded(preferSet));
  const doc = await documentStatus();
  return { stored, job: doc ? doc.job : null, runtime: doc ? doc.runtime : null, usage: await usage() };
}

export async function download(set, base) {
  if (set !== 'q4f16' && set !== 'q4') return { ok: false, error: 'unknown set' };
  forget();
  return callDocument('download', { set, base: base || null });
}

export async function pause() {
  forget();
  return callDocument('pause', {}, { create: false });
}

export async function cancel() {
  forget();
  const r = await callDocument('cancel', {}, { create: false });
  if (r === null) { await removeAll(); return { ok: true }; }
  return r;
}

/** Delete every file of the model: stop the download, let go of the model, close the document, remove the folder. */
export async function remove() {
  forget();
  try { await callDocument('prepare-delete', {}, { create: false, timeoutMs: 5000 }); } catch (e) { /* the document is gone: nothing holds a file */ }
  await closeDocument();
  const removed = await removeAll();
  forget();
  return { ok: true, removed };
}

