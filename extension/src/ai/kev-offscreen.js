// The hidden page that holds the local model: it runs Kev-0.6B (kev-runtime.js) and hosts the downloader worker (kev-download-worker.js).
// Why an offscreen document: the service worker is stopped after 30 seconds without work and cannot load the runtime's module files, and a
// settings page lives only while it is open. This page lives as long as the extension needs it and is closed (by the service worker) after
// the model has been idle for a few minutes.
//
// Messages, all through chrome.runtime. Everything that changes anything is accepted from the extension's own service worker only, so that
// neither a web page nor a content script can start, stop or delete a download or ask this page anything directly:
//   {target: 'kev-offscreen', op: 'ask', kind, question, levels, text}   -> {p} | {p: null, error}
//   {target: 'kev-offscreen', op: 'download', set, base?} | 'pause' | 'cancel' | 'prepare-delete' | 'unload'
//   {target: 'kev-offscreen', op: 'status'}                                -> {job, runtime}     (any extension page may ask)
// Sent by this page to whoever listens (the service worker and an open settings page):
//   {type: 'kev-progress', job, runtime}   {type: 'kev-idle'}
import { KevRuntime } from './kev-runtime.js';
import { removeAll } from './kev-store.js';

const SW_URL = chrome.runtime.getURL('src/background/service-worker.js');
const EXT_BASE = chrome.runtime.getURL('');
const IDLE_MS = 5 * 60 * 1000;     // CHOICE: the model leaves memory after five minutes without a question

let job = { phase: 'idle' };       // idle | checking | downloading | paused | error
let worker = null;
let stopping = null;               // 'pause' | 'cancel' while the worker is being stopped
let stopWaiters = [];              // resolved when the worker has reported that it stopped (its file handles are closed by then)
let persisted = null;              // what navigator.storage.persist() answered (null: not asked yet)

const send = (msg) => { try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch (e) { /* the extension was reloaded */ } };

const runtime = new KevRuntime({
  idleMs: IDLE_MS,
  onIdle: () => { if (job.phase === 'idle') send({ type: 'kev-idle' }); },
  onState: () => announce(),
});

function announce() {
  send({ type: 'kev-progress', job, runtime: runtime.snapshot() });
}

function setJob(next) {
  job = next;
  announce();
}

function stopWorker() {
  if (worker) { worker.terminate(); worker = null; }
  for (const done of stopWaiters.splice(0)) done();
}

/** Ask the worker to stop and wait (at most a few seconds) until it did: a file that it still holds open cannot be deleted. */
function stopAndWait(why) {
  if (!worker) return Promise.resolve();
  stopping = why;
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 5000);
    stopWaiters.push(() => { clearTimeout(timer); resolve(); });
    worker.postMessage({ op: why });
  });
}

async function startDownload(set, base) {
  if (job.phase === 'downloading' || job.phase === 'checking') return { ok: true, already: true };
  // ask the browser not to evict the files: the `unlimitedStorage` permission already exempts the extension, and some profiles answer "no" all the same (measured: headless Chrome)
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then((ok) => { persisted = !!ok; }, () => { persisted = false; });
  await runtime.unload();                              // never keep the model in memory while its files are being written
  stopWorker();
  stopping = null;
  setJob({ phase: 'checking', set, done: 0, total: 0, bytesPerSecond: 0, file: null });
  worker = new Worker(new URL('./kev-download-worker.js', import.meta.url), { type: 'module' });
  worker.onerror = (e) => { stopWorker(); setJob({ phase: 'error', set, error: { code: 'worker', message: String(e.message || 'the downloader stopped') } }); };
  worker.onmessage = async (e) => {
    const m = e.data || {};
    if (m.type === 'progress') {
      job = { ...job, phase: m.phase === 'checking' ? 'checking' : 'downloading', done: m.done, total: m.total, bytesPerSecond: m.bytesPerSecond || 0, file: m.file, fileIndex: m.fileIndex, files: m.files, fileDone: m.fileDone, fileTotal: m.fileTotal };
      announce();
    } else if (m.type === 'done') {
      stopWorker();
      setJob({ phase: 'idle', set, finished: true });
    } else if (m.type === 'stopped') {
      stopWorker();
      if (stopping === 'cancel' || m.why === 'cancel') { await removeAll().catch(() => {}); setJob({ phase: 'idle' }); } else setJob({ ...job, phase: 'paused', bytesPerSecond: 0 });
      stopping = null;
    } else if (m.type === 'error') {
      stopWorker();
      setJob({ phase: 'error', set, done: job.done, total: job.total, error: { code: m.code, message: m.message, file: m.file } });
    }
  };
  worker.postMessage({ op: 'start', set, base: base || null });
  return { ok: true };
}

function stopDownload(why) {
  if (!worker) { if (why === 'cancel') return removeAll().then(() => { setJob({ phase: 'idle' }); return { ok: true }; }); setJob({ ...job, phase: 'paused' }); return { ok: true }; }
  stopping = why;
  worker.postMessage({ op: why });
  return { ok: true };
}

async function handle(msg) {
  switch (msg.op) {
    case 'ask':
      if (job.phase === 'downloading' || job.phase === 'checking') return { p: null, error: 'downloading' };
      return runtime.ask(msg);
    case 'download':
      return startDownload(msg.set, msg.base);
    case 'pause':
      return stopDownload('pause');
    case 'cancel':
      return stopDownload('cancel');
    case 'prepare-delete':
      await stopAndWait('cancel');
      stopWorker();
      await runtime.unload();
      setJob({ phase: 'idle' });
      return { ok: true };
    case 'unload':
      await runtime.unload();
      return { ok: true };
    case 'status':
      return { job, runtime: runtime.snapshot(), persisted };
    default:
      return { error: 'unknown op' };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== 'kev-offscreen') return false;            // not for this page
  const fromExtension = sender && sender.id === chrome.runtime.id && typeof sender.url === 'string' && sender.url.startsWith(EXT_BASE);
  const fromWorker = fromExtension && sender.url === SW_URL;
  if (msg.op === 'status' ? !fromExtension : !fromWorker) { sendResponse({ error: 'refused' }); return false; }
  handle(msg).then(sendResponse, (e) => sendResponse({ p: null, error: String((e && e.message) || e) }));
  return true;
});

announce();
