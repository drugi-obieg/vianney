// Where the model files live, and what is known about them. The files are kept in the extension's private file system (OPFS), which every
// extension context can read (the settings page, the service worker, the offscreen document and its workers) and which no web page can.
//
// Layout: one folder per pinned commit, `kev-0.6b-<8 letters of the commit>/`, holding the files under flat names
// (`onnx/model_q4.onnx` is `onnx__model_q4.onnx`) and `state.json`, which records which files were verified against their SHA-256.
// A file counts as present only when state.json says it was verified AND its size is the pinned size. Partial files stay on disk (they are
// what a resumed download continues) but are never loaded.
import { KEV, STORE_DIR, filesFor, storeDirFor, totalBytes } from './kev-manifest.js';

export const STATE_FILE = 'state.json';
export const flatName = (path) => path.replace(/\//g, '__');

async function root() {
  return navigator.storage.getDirectory();
}

/** The folder of the pinned commit; `create` makes it. Returns null when it does not exist. */
export async function storeDir(create = false) {
  try {
    return await (await root()).getDirectoryHandle(storeDirFor(), { create });
  } catch (e) {
    if (e && e.name === 'NotFoundError') return null;
    throw e;
  }
}

/** @returns {Promise<{version: number, commit: string, set: string, verified: Record<string, {size: number, sha256: string}>}|null>} */
export async function readState(dir) {
  if (!dir) return null;
  try {
    const file = await (await dir.getFileHandle(STATE_FILE)).getFile();
    const state = JSON.parse(await file.text());
    return state && state.commit === KEV.commit ? state : null;
  } catch (e) {
    return null;
  }
}

export async function writeState(dir, state) {
  const handle = await dir.getFileHandle(STATE_FILE, { create: true });
  const w = await handle.createWritable();
  await w.write(JSON.stringify({ version: 1, commit: KEV.commit, ...state }));
  await w.close();
}

/** Size of a file in the folder, or -1 when it is not there. */
export async function sizeOf(dir, path) {
  try {
    return (await (await dir.getFileHandle(flatName(path))).getFile()).size;
  } catch (e) {
    return -1;
  }
}

/**
 * What is stored, for one set of files.
 * @returns {Promise<{set: string, files: {path: string, size: number, have: number, verified: boolean}[], complete: boolean, bytesHave: number, bytesTotal: number, partial: boolean}>}
 */
export async function inspect(setId) {
  const dir = await storeDir(false);
  const state = await readState(dir);
  const verified = (state && state.verified) || {};
  const files = [];
  for (const f of filesFor(setId)) {
    const have = dir ? await sizeOf(dir, f.path) : -1;
    const v = verified[f.path];
    files.push({ path: f.path, size: f.size, have: Math.max(0, have), verified: !!(v && v.sha256 === f.sha256 && v.size === f.size && have === f.size) });
  }
  const complete = files.every((f) => f.verified);
  const bytesHave = files.reduce((n, f) => n + (f.verified ? f.size : Math.min(f.have, f.size)), 0);
  return { set: setId, files, complete, bytesHave, bytesTotal: totalBytes(setId), partial: !complete && bytesHave > 0 };
}

/** Which set is complete on disk, if any. The half-precision set is preferred when both are there. */
export async function completeSet() {
  for (const id of ['q4f16', 'q4']) {
    const s = await inspect(id);
    if (s.complete) return s;
  }
  return null;
}

/** The set with the most bytes on disk (for showing a partial download), preferring `prefer` on a tie. */
export async function mostDownloaded(prefer = 'q4') {
  const a = await inspect('q4f16');
  const b = await inspect('q4');
  if (a.bytesHave === b.bytesHave) return prefer === 'q4f16' ? a : b;
  return a.bytesHave > b.bytesHave ? a : b;
}

/** Read one stored file as a File (for the runtime to read), or null. */
export async function openFile(path) {
  const dir = await storeDir(false);
  if (!dir) return null;
  try {
    return await (await dir.getFileHandle(flatName(path))).getFile();
  } catch (e) {
    return null;
  }
}

/** Delete everything of the model: this commit's folder and the folders of any other commit. Throws when a file is in use. */
export async function removeAll() {
  const r = await root();
  const names = [];
  for await (const [name] of r.entries()) if (name === STORE_DIR || name.startsWith(STORE_DIR + '-')) names.push(name);
  for (const name of names) await r.removeEntry(name, { recursive: true });
  return names.length;
}

/** What the browser says about storage: how much this extension uses, and how much it may. */
export async function usage() {
  try {
    const e = await navigator.storage.estimate();
    return { usage: e.usage, quota: e.quota };
  } catch (e) {
    return { usage: null, quota: null };
  }
}
