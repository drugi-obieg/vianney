// The downloader, as a dedicated worker of the offscreen document. It exists because only a worker may open an OPFS file for in-place
// writing (`createSyncAccessHandle`), which is what makes a resumed download cheap: the bytes already on disk stay where they are.
// The logic is in kev-download.js (tested in Node); this file only connects it to OPFS and to the messages of the offscreen document.
//
// In:  {op: 'start', set, base?}   {op: 'pause'}   {op: 'cancel'}
// Out: {type: 'progress', ...}   {type: 'done', set, bytes}   {type: 'error', code, message, file}   {type: 'stopped', why: 'pause'|'cancel'}
import { filesFor, downloadUrl } from './kev-manifest.js';
import { downloadSet, DownloadError } from './kev-download.js';
import { flatName, storeDir, readState, writeState } from './kev-store.js';

let controller = null;
let stopReason = null;

async function run(setId, base) {
  const dir = await storeDir(true);
  const prior = (await readState(dir)) || {};
  const verified = { ...(prior.verified || {}) };
  const handles = new Map();
  stopReason = null;
  controller = new AbortController();
  try {
    const result = await downloadSet({
      files: filesFor(setId),
      urlFor: (path) => downloadUrl(path, base),
      verified,
      signal: controller.signal,
      async openSink(file) {
        const fh = await dir.getFileHandle(flatName(file.path), { create: true });
        const ah = await fh.createSyncAccessHandle();
        handles.set(file.path, ah);
        return {
          size: () => ah.getSize(),
          read: (buf, at) => ah.read(buf, { at }),
          write: (data, at) => { const n = ah.write(data, { at }); if (n !== data.length) throw Object.assign(new Error(`wrote ${n} of ${data.length} bytes`), { name: 'ShortWriteError' }); return n; },
          truncate: (n) => ah.truncate(n),
          flush: () => ah.flush(),
        };
      },
      closeSink(file) {
        const ah = handles.get(file.path);
        handles.delete(file.path);
        if (ah) { try { ah.flush(); ah.close(); } catch (e) { /* already closed */ } }
      },
      async markVerified(file) {
        verified[file.path] = { size: file.size, sha256: file.sha256 };
        await writeState(dir, { set: setId, verified });
      },
      onProgress: (p) => postMessage({ type: 'progress', ...p }),
    });
    await writeState(dir, { set: setId, verified });
    postMessage({ type: 'done', set: setId, downloaded: result.downloaded, skipped: result.skipped });
  } catch (e) {
    if (e instanceof DownloadError && e.code === 'aborted') postMessage({ type: 'stopped', why: stopReason || 'pause' });
    else postMessage({ type: 'error', code: (e && e.code) || 'unknown', message: String((e && e.message) || e), file: (e && e.file) || null });
  } finally {
    for (const ah of handles.values()) { try { ah.close(); } catch (e) { /* ignore */ } }
    controller = null;
  }
}

self.onmessage = async (e) => {
  const m = e.data || {};
  if (m.op === 'start') {
    if (controller) return;
    if (!filesFor(m.set)) return;
    await run(m.set, m.base || null);
  } else if (m.op === 'pause' || m.op === 'cancel') {
    stopReason = m.op;
    if (controller) controller.abort();
    else postMessage({ type: 'stopped', why: m.op });
  }
};

