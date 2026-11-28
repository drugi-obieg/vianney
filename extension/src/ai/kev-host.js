// The local model and its downloader, as one object that does not care where it lives. Two places host it (kev-backend.js chooses):
//  - a hidden offscreen document, in Chrome, whose page (kev-offscreen.js) wraps this object in a message listener: the service worker is stopped after 30
//    seconds without work and cannot load the runtime's module files, so the model needs a page of its own there;
//  - the background page itself, in Firefox and Safari: their background is an event page with a window, a DOM and Workers, and they have no offscreen
//    documents. A page does not hear the messages that it sends itself, so there the progress goes to the service worker's own code directly (`send`).
// `send` takes what the host announces: {type: 'kev-progress', job, runtime} and {type: 'kev-idle'}.
// The operations (handle): ask, download, pause, cancel, prepare-delete, unload, status. Who may call them is the business of whoever holds the host.
import { KevRuntime } from './kev-runtime.js';
import { removeAll } from './kev-store.js';

export function createHost({ send }) {
  const IDLE_MS = 5 * 60 * 1000;     // CHOICE: the model leaves memory after five minutes without a question

  let job = { phase: 'idle' };       // idle | checking | downloading | paused | error
  let worker = null;
  let stopping = null;               // 'pause' | 'cancel' while the worker is being stopped
  let stopWaiters = [];              // resolved when the worker has reported that it stopped (its file handles are closed by then)
  let persisted = null;              // what navigator.storage.persist() answered (null: not asked yet)

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

  /** Let go of everything: the downloader, and the model in memory. The files stay. */
  async function destroy() {
    stopWorker();
    stopping = null;
    await runtime.unload();
  }

  return { handle, announce, destroy };
}
