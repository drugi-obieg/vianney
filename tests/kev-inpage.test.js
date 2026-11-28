import { test } from 'node:test';
import assert from 'node:assert/strict';

// Firefox and Safari have no chrome.offscreen: the background page is an event page with a window and Workers, so kev-backend.js keeps the model's host in
// that page (see the comment at its top). Here `chrome` has no `offscreen`, as in those browsers, and Worker is a stand-in that the test controls.
const sent = [];
globalThis.chrome = {
  runtime: {
    id: 'vianney@example',
    getURL: (p = '') => 'moz-extension://11111111-2222-3333-4444-555555555555/' + p,
    sendMessage: async (m) => { sent.push(m); return { ok: true }; },
  },
};
Object.defineProperty(globalThis.navigator, 'storage', { configurable: true, value: {
  getDirectory: async () => ({ getDirectoryHandle: async () => { throw Object.assign(new Error('no folder'), { name: 'NotFoundError' }); }, entries: async function* () {}, removeEntry: async () => {} }),
  estimate: async () => ({ usage: 0, quota: 1e10 }),
  persist: async () => true,
} });
const workers = [];
globalThis.Worker = class {
  constructor(url, opts) { this.url = String(url); this.opts = opts; this.posted = []; this.terminated = false; workers.push(this); }
  postMessage(m) { this.posted.push(m); }
  terminate() { this.terminated = true; }
};

const kev = await import('../extension/src/ai/kev-backend.js');
const local = [];
kev.onLocalMessage((m) => local.push(m));

test('without an offscreen document there is no document until the host is made, and asking for the status does not make one', async () => {
  assert.equal(typeof chrome.offscreen, 'undefined');
  assert.equal(await kev.closeDocument(), false, 'nothing to close');
  const st = await kev.status();
  assert.deepEqual([st.stored.complete, st.stored.bytesHave, st.job, st.runtime], [false, 0, null, null], 'no host: the settings page sees a model that is not there, not an error');
  assert.equal(workers.length, 0);
});

test('a download makes the host in this page, starts the worker, and the announcements reach the service worker\'s own handler and the other pages', async () => {
  const r = await kev.download('q4', null);
  assert.equal(r.ok, true);
  assert.equal(workers.length, 1, 'the downloader worker');
  assert.match(workers[0].url, /kev-download-worker\.js$/);
  assert.deepEqual(workers[0].opts, { type: 'module' });
  assert.deepEqual(workers[0].posted, [{ op: 'start', set: 'q4', base: null }]);
  assert.ok(local.some((m) => m.type === 'kev-progress' && m.job.phase === 'checking'), 'the page does not hear what it sends: the handler is called directly');
  assert.ok(sent.some((m) => m.type === 'kev-progress'), 'and the settings page is told by message');
  // the worker reports progress
  workers[0].onmessage({ data: { type: 'progress', phase: 'downloading', done: 1000, total: 4000, bytesPerSecond: 500, file: 'model.onnx', fileIndex: 0, files: 3 } });
  const last = local.filter((m) => m.type === 'kev-progress').pop();
  assert.equal(last.job.phase, 'downloading');
  assert.equal(last.job.done, 1000);
  const st = await kev.status();
  assert.equal(st.job.phase, 'downloading', 'the status is the host\'s own');
  assert.equal(st.runtime.state !== undefined, true);
});

test('a finished download is announced as finished', async () => {
  workers[0].onmessage({ data: { type: 'done' } });
  assert.ok(local.some((m) => m.type === 'kev-progress' && m.job.finished === true && m.job.phase === 'idle'));
  assert.equal(workers[0].terminated, true, 'the worker is let go of');
});

test('closing the page host stops a running downloader and forgets the host; pausing with no host is not an error', async () => {
  await kev.download('q4f16', null);                 // a second run: a new worker
  assert.equal(workers.length, 2);
  assert.equal(await kev.closeDocument(), true);
  assert.equal(workers[1].terminated, true, 'the downloader is stopped with the host');
  assert.equal(await kev.closeDocument(), false, 'closed once');
  assert.equal(await kev.pause(), null, 'no host, so nothing to pause');
});

test('with nothing downloaded the model is not ready, so the service worker never asks it a question', async () => {
  const ready = await kev.readiness(true);
  assert.deepEqual([ready.ready, ready.state, ready.set], [false, 'not-downloaded', null]);
});
