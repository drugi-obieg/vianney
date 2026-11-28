import { test } from 'node:test';
import assert from 'node:assert/strict';

// The service worker, with a stand-in for the `chrome` object: it checks who may control the local model, and what the status messages answer.
// (The real thing, in a real browser, is the `kev` scenario of tools/e2e.py.)
const BASE = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/';
const calls = [];
const store = {};
let listener = null;
let external = null;
globalThis.chrome = {
  runtime: {
    id: 'abcdefghijklmnopabcdefghijklmnop',
    getURL: (p = '') => BASE + p,
    onMessage: { addListener: (fn) => { listener = fn; } },
    onMessageExternal: { addListener: (fn) => { external = fn; } },
    getManifest: () => ({ version: '9.9.9' }),
    onInstalled: { addListener() {} },
    openOptionsPage() { calls.push('openOptionsPage'); },
    getContexts: async () => { calls.push('getContexts'); return []; },
    sendMessage: async (m) => { calls.push(['sendMessage', m]); return { ok: true }; },
  },
  storage: { local: {
    get: async (k) => (typeof k === 'string' ? { [k]: store[k] } : {}),
    set: async (o) => { calls.push(['storage.set', Object.keys(o)]); Object.assign(store, o); },
    remove: async () => {},
  } },
  offscreen: { createDocument: async () => { calls.push('createDocument'); }, closeDocument: async () => { calls.push('closeDocument'); } },
  action: { setBadgeText: async () => {} },
  tabs: { create: async (o) => { calls.push(['tabs.create', o.url]); return { id: 1 }; }, query: async () => [] },
};
// no private file system here: reading the model's folder finds nothing, as on a computer where nothing was downloaded
Object.defineProperty(globalThis.navigator, 'storage', { configurable: true, value: {
  getDirectory: async () => ({ getDirectoryHandle: async () => { throw Object.assign(new Error('no folder'), { name: 'NotFoundError' }); }, entries: async function* () {}, removeEntry: async () => {} }),
  estimate: async () => ({ usage: 0, quota: 1e10 }),
} });

await import('../extension/src/background/service-worker.js');
const send = (msg, sender) => new Promise((resolve) => listener(msg, sender, resolve));
const PAGE = { id: 'abcdefghijklmnopabcdefghijklmnop', origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop', url: BASE + 'src/options/options.html', tab: { id: 7 } };
const CONTENT = { id: 'abcdefghijklmnopabcdefghijklmnop', origin: 'https://www.youtube.com', url: 'https://www.youtube.com/watch?v=abc', tab: { id: 9 } };

test('the worker is listening', () => assert.equal(typeof listener, 'function'));

test('a content script on a web page may not look at, start, stop or delete the local model', async () => {
  for (const type of ['kev-status', 'kev-download', 'kev-pause', 'kev-cancel', 'kev-delete', 'kev-progress', 'kev-idle']) {
    calls.length = 0;
    const r = await send({ type, set: 'q4f16', job: { finished: true } }, CONTENT);
    assert.deepEqual(r, { ok: false, error: 'not allowed' }, type);
    assert.deepEqual(calls, [], `${type}: nothing was done (no document, no storage, no message): ${JSON.stringify(calls)}`);
  }
  assert.deepEqual(await send({ type: 'kev-delete' }, undefined), { ok: false, error: 'not allowed' }, 'no sender at all');
  assert.deepEqual(await send({ type: 'kev-delete' }, { id: 'someoneelse', origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop' }), { ok: false, error: 'not allowed' }, 'another extension');
});

test('a page of the extension may ask for the status', async () => {
  const r = await send({ type: 'kev-status' }, PAGE);
  assert.equal(r.stored.complete, false);
  assert.equal(r.stored.set, 'q4');
  assert.equal(r.stored.bytesHave, 0);
  assert.deepEqual(r.job, null);
  assert.equal(r.usage.quota, 1e10);
});

test('the status of the models for a tab: nothing downloaded, no Chrome model here: nothing can answer, and the key says so', async () => {
  const r = await send({ type: 'ai-status' }, CONTENT);
  assert.equal(r.availability, 'unsupported', 'what Chrome\'s model says (no Prompt API in Node) is passed on');
  assert.equal(r.key, 'kev:0,prompt:0');
  assert.equal(r.layers[0].name, 'kev');
  assert.equal(r.layers[0].state, 'not-downloaded');
  assert.equal(r.loading, false);
  assert.equal(r.backend, 'auto');
  const ask = await send({ type: 'ai-ask', kind: 'noul', question: 'Is this a greeting?', text: 'Hello' }, CONTENT);
  assert.deepEqual([ask.p, ask.error], [null, 'unavailable'], 'a question with nobody to ask is an answer without a probability');
});

test('a download that a test asks for names a local server only when the debug switch is on and the address is local', async () => {
  calls.length = 0;
  await send({ type: 'kev-download', set: 'q4', base: 'http://127.0.0.1:8765/' }, PAGE);
  const withoutDebug = calls.find((c) => Array.isArray(c) && c[0] === 'sendMessage');
  assert.equal(withoutDebug[1].base, null, 'debug is off: the address is ignored');
  store.settings = { debug: true };
  calls.length = 0;
  await send({ type: 'kev-download', set: 'q4', base: 'http://127.0.0.1:8765/' }, PAGE);
  assert.equal(calls.find((c) => Array.isArray(c) && c[0] === 'sendMessage')[1].base, 'http://127.0.0.1:8765/');
  calls.length = 0;
  await send({ type: 'kev-download', set: 'q4', base: 'https://evil.example/' }, PAGE);
  assert.equal(calls.find((c) => Array.isArray(c) && c[0] === 'sendMessage')[1].base, null, 'only 127.0.0.1 and localhost');
  const bad = await send({ type: 'kev-download', set: 'fp32' }, PAGE);
  assert.equal(bad.ok, false, 'only the two pinned sets can be asked for');
  delete store.settings;
});

test('the end of a download is announced to the tabs once, through the storage', async () => {
  calls.length = 0;
  await send({ type: 'kev-progress', job: { phase: 'idle', finished: true } }, PAGE);
  await send({ type: 'kev-progress', job: { phase: 'idle', finished: true } }, PAGE);
  assert.equal(calls.filter((c) => Array.isArray(c) && c[0] === 'storage.set' && c[1].includes('kevEpoch')).length, 1);
});

// ---- the website may ask the extension to open a page of Chrome (a web page cannot), and for the facts of the extension
const sendSite = (msg, sender) => new Promise((resolve) => external(msg, sender, resolve));
const SITE = { id: 'abcdefghijklmnopabcdefghijklmnop', origin: 'https://vianney.cc', url: 'https://vianney.cc/nano.html' };

test('the worker listens for messages of the website, and says who it is', async () => {
  assert.equal(typeof external, 'function');
  assert.deepEqual(await sendSite({ type: 'hello' }, SITE), { ok: true, id: 'abcdefghijklmnopabcdefghijklmnop', version: '9.9.9' });
  assert.equal((await sendSite({ type: 'hello' }, { ...SITE, origin: 'https://www.vianney.cc' })).ok, true, 'with www too');
});

test('only the website is answered: another site, another origin spelling, or no sender at all gets "not allowed" and nothing happens', async () => {
  for (const sender of [undefined, {}, { origin: 'https://evil.example' }, { origin: 'https://vianney.cc.evil.example' }, { origin: 'http://vianney.cc' }, { origin: 'https://www.youtube.com' }, { origin: 'https://sub.vianney.cc' }]) {
    calls.length = 0;
    for (const msg of [{ type: 'hello' }, { type: 'open', url: 'chrome://on-device-internals' }, { type: 'nano-facts' }]) {
      assert.deepEqual(await sendSite(msg, sender), { ok: false, error: 'not allowed' }, `${msg.type} from ${JSON.stringify(sender)}`);
    }
    assert.deepEqual(calls, [], 'no tab was opened');
  }
});

test('the website can have the pages of the guide opened, and no other page', async () => {
  for (const url of ['chrome://on-device-internals', 'chrome://chrome-urls', 'chrome://settings/ai', 'chrome://flags/#prompt-api', 'chrome://components', 'chrome://management/policy']) {
    calls.length = 0;
    assert.deepEqual(await sendSite({ type: 'open', url }, SITE), { ok: true }, url);
    assert.deepEqual(calls, [['tabs.create', url]]);
  }
  for (const url of ['chrome://settings/passwords', 'chrome://flags/#not-in-the-list', 'chrome://quit', 'chrome://crash', 'file:///etc/passwd', 'javascript:alert(1)', 'https://example.com', '', undefined]) {
    calls.length = 0;
    assert.deepEqual(await sendSite({ type: 'open', url }, SITE), { ok: false, error: 'not allowed' }, String(url));
    assert.deepEqual(calls, [], `${url}: no tab`);
  }
  assert.deepEqual(await sendSite({ type: 'format-the-disk' }, SITE), { ok: false, error: 'unknown message' });
});

test('the website gets the facts that only an extension sees: the free space of the profile, measured from the storage quota', async () => {
  const r = await sendSite({ type: 'nano-facts' }, SITE);
  assert.equal(r.ok, true);
  assert.equal(r.facts.where, 'extension');
  assert.equal(r.facts.freeBytes, 1e10, 'quota minus usage (the stand-in above says 1e10 and 0)');
  assert.equal(r.facts.hasApi, false, 'no Prompt API in Node');
});

test('a browser without the event for messages of a website still starts the worker (Safari): the listener is added only where the event exists', async () => {
  const text = (await import('node:fs')).readFileSync(new URL('../extension/src/background/service-worker.js', import.meta.url), 'utf8');
  assert.match(text, /if \(chrome\.runtime\.onMessageExternal\) \{\s+chrome\.runtime\.onMessageExternal\.addListener/);
  // every other event that the file listens for at load time is one that every browser has
  const events = [...text.matchAll(/^chrome\.([a-zA-Z.]+)\.addListener/gm)].map((m) => m[1]);
  assert.deepEqual(events.sort(), ['runtime.onInstalled', 'runtime.onMessage']);
});
