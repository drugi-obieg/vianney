import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DownloadError, Meter, badContentRange, downloadFile, downloadSet, parseContentRange } from '../extension/src/ai/kev-download.js';

// ------------------------------------------------------------------------------------------------ a file in memory
class MemorySink {
  constructor(bytes = 0) { this.data = new Uint8Array(bytes); this.len = 0; this.flushes = 0; }
  size() { return this.len; }
  read(buf, at) { const n = Math.min(buf.length, this.len - at); if (n <= 0) return 0; buf.set(this.data.subarray(at, at + n)); return n; }
  write(data, at) {
    if (at + data.length > this.data.length) { const bigger = new Uint8Array(Math.max(this.data.length * 2, at + data.length)); bigger.set(this.data.subarray(0, this.len)); this.data = bigger; }
    this.data.set(data, at); this.len = Math.max(this.len, at + data.length); return data.length;
  }
  truncate(n) { this.len = n; }
  flush() { this.flushes++; }
  bytes() { return this.data.subarray(0, this.len); }
}

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const SMALL = randomBytes(300_000);
const BIG = randomBytes(3_000_000);
const FILES = {
  'small.json': { size: SMALL.length, sha256: sha(SMALL), data: SMALL },
  'onnx/big.onnx_data': { size: BIG.length, sha256: sha(BIG), data: BIG },
};
const pin = (path) => ({ path, size: FILES[path].size, sha256: FILES[path].sha256 });

// ------------------------------------------------------------------------------------------------ the real mirror, as a child process
let dir; let child; let base;
const fault = (body) => fetch(`${base}/__fault`, { method: 'POST', body: JSON.stringify(body) });
const clear = () => fetch(`${base}/__clear`, { method: 'POST' });
const requestLog = async () => (await fetch(`${base}/__log`)).json();

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'kev-mirror-'));
  for (const [path, f] of Object.entries(FILES)) { mkdirSync(join(dir, path, '..'), { recursive: true }); writeFileSync(join(dir, path), f.data); }
  const port = await new Promise((resolve) => { const s = createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [join(import.meta.dirname, '../tools/kev-mirror.mjs'), '--dir', dir, '--port', String(port)], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(`${base}/__log`); return; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  throw new Error('the mirror did not start');
});
after(() => { if (child) child.kill(); if (dir) rmSync(dir, { recursive: true, force: true }); });

const noWait = { sleep: async () => {}, retryDelayMs: 0 };
const run = (path, sink, extra = {}) => downloadFile({ file: pin(path), url: `${base}/${path}`, sink, ...noWait, ...extra });

// ------------------------------------------------------------------------------------------------ small pure pieces
test('Content-Range is read, and only an answer that continues exactly where we stand is accepted', () => {
  assert.deepEqual(parseContentRange('bytes 100-199/1000'), { start: 100, end: 199, total: 1000 });
  assert.deepEqual(parseContentRange('bytes */1000'), { start: null, end: null, total: 1000 });
  assert.equal(parseContentRange('items 1-2/3'), null);
  assert.equal(parseContentRange(null), null);
  assert.equal(badContentRange('bytes 100-999/1000', 100, 1000), null);
  assert.match(badContentRange('bytes 0-999/1000', 100, 1000), /starts at byte 0, not at 100/);
  assert.match(badContentRange('bytes 100-999/2000', 100, 1000), /the file has 2000 bytes, the pin says 1000/);
  assert.match(badContentRange('bytes 100-500/1000', 100, 1000), /ends at byte 500/);
  assert.match(badContentRange(null, 100, 1000), /no usable Content-Range/);
});

test('the speed meter averages over the last seconds', () => {
  let t = 0;
  const m = new Meter(() => t, 4000);
  assert.equal(m.speed(), 0);
  m.add(0); t = 1000; m.add(1_000_000); t = 2000; m.add(1_000_000);
  assert.equal(m.speed(), 1_000_000);
  t = 20000; m.add(100_000); t = 21000; m.add(100_000);
  assert.equal(m.speed(), 100_000, 'the old, fast part is forgotten');
});

// ------------------------------------------------------------------------------------------------ a file against the real mirror
test('a download from scratch follows the redirect, and the file equals the original', async () => {
  await clear();
  const sink = new MemorySink();
  const seen = [];
  const r = await run('onnx/big.onnx_data', sink, { onProgress: (p) => seen.push(p), progressEveryMs: 0 });
  assert.equal(r.bytes, BIG.length);
  assert.equal(r.sha256, FILES['onnx/big.onnx_data'].sha256);
  assert.equal(r.resumedFrom, 0);
  assert.equal(r.requests, 1);
  assert.ok(Buffer.from(sink.bytes()).equals(BIG));
  assert.equal(seen.at(-1).done, BIG.length);
  assert.ok(seen.every((p) => p.phase === 'downloading' && p.total === BIG.length));
  const log = await requestLog();
  assert.equal(log.length, 1);
  assert.equal(log[0].range, null, 'a fresh download asks for the whole file');
});

test('a connection that dies half way is resumed with a Range request from where the file stands', async () => {
  await clear();
  await fault({ path: 'onnx/big.onnx_data', cutAfter: 1_100_000, times: 1 });
  const sink = new MemorySink();
  const r = await run('onnx/big.onnx_data', sink);
  assert.ok(Buffer.from(sink.bytes()).equals(BIG), 'the pieces fit together');
  assert.equal(r.requests, 2);
  const log = await requestLog();
  assert.equal(log[0].aborted, true);
  assert.equal(log[1].status, 206);
  assert.match(log[1].range, /^bytes=\d+-$/);
  assert.equal(Number(/bytes=(\d+)-/.exec(log[1].range)[1]), log[0].sent, 'it asks for exactly the bytes that arrived');
});

test('what is on disk from an earlier run is kept: only the rest is requested', async () => {
  await clear();
  const sink = new MemorySink();
  sink.write(BIG.subarray(0, 1_234_567), 0);
  const phases = [];
  const r = await run('onnx/big.onnx_data', sink, { onProgress: (p) => phases.push(p.phase), progressEveryMs: 0 });
  assert.equal(r.resumedFrom, 1_234_567);
  assert.ok(Buffer.from(sink.bytes()).equals(BIG));
  assert.ok(phases.includes('checking'), 'the old part is read through the hasher first');
  const log = await requestLog();
  assert.equal(log[0].range, 'bytes=1234567-');
  assert.ok(log[0].sent === BIG.length - 1_234_567, 'only the missing part was sent');
});

test('a file that is already complete is checked and not requested again', async () => {
  await clear();
  const sink = new MemorySink();
  sink.write(SMALL, 0);
  const r = await run('small.json', sink);
  assert.equal(r.requests, 0);
  assert.equal((await requestLog()).length, 0);
});

test('one flipped byte: the SHA-256 refuses the file, it is emptied, and the error says so', async () => {
  await clear();
  await fault({ path: 'onnx/big.onnx_data', corrupt: { at: 2_000_000 } });
  const sink = new MemorySink();
  await assert.rejects(run('onnx/big.onnx_data', sink), (e) => e instanceof DownloadError && e.code === 'hash-mismatch' && /deleted/.test(e.message) && e.actual !== e.expected);
  assert.equal(sink.size(), 0, 'a file that does not match is not kept');
  await clear();
  assert.ok((await run('onnx/big.onnx_data', sink)).bytes === BIG.length, 'and a new try without the fault works');
});

test('a corrupted byte inside the part that was already on disk is found too', async () => {
  await clear();
  const sink = new MemorySink();
  sink.write(BIG.subarray(0, 1_000_000), 0);
  sink.data[500_000] ^= 1;
  await assert.rejects(run('onnx/big.onnx_data', sink), (e) => e.code === 'hash-mismatch');
  assert.equal(sink.size(), 0);
});

test('a short outage is survived (503 twice), a long one stops with the file kept', async () => {
  await clear();
  await fault({ path: 'small.json', status: 503, times: 2 });
  const sink = new MemorySink();
  const waits = [];
  const r = await run('small.json', sink, { sleep: async (ms) => { waits.push(ms); }, retryDelayMs: 100 });
  assert.equal(r.bytes, SMALL.length);
  assert.deepEqual(waits, [100, 200], 'it waits a little longer each time');

  await clear();
  await fault({ path: 'onnx/big.onnx_data', status: 503, times: 10 });
  await assert.rejects(run('onnx/big.onnx_data', new MemorySink(), { retries: 3 }), (e) => e.code === 'http' && e.status === 503);
});

test('a connection that keeps dying stops after the retries, and the next call resumes from what arrived', async () => {
  await clear();
  await fault({ path: 'onnx/big.onnx_data', cutAfter: 400_000, times: 100 });
  const sink = new MemorySink();
  // every attempt delivers 400,000 bytes, so each one makes progress and the limit for failures in a row is not reached until the file is complete
  const r = await run('onnx/big.onnx_data', sink, { retries: 1 });
  assert.ok(Buffer.from(sink.bytes()).equals(BIG));
  assert.ok(r.requests >= 8);
  await clear();
  await fault({ path: 'onnx/big.onnx_data', cutAfter: 0, times: 100 });
  const none = new MemorySink();
  await assert.rejects(run('onnx/big.onnx_data', none, { retries: 2 }), (e) => e.code === 'network');
  assert.equal(none.size(), 0);
  await clear();
  assert.equal((await run('onnx/big.onnx_data', none)).bytes, BIG.length, 'Retry works');
});

test('a missing file is an error at once, without retries', async () => {
  await clear();
  const calls = [];
  const file = { path: 'nope.bin', size: 10, sha256: 'x' };
  await assert.rejects(downloadFile({ file, url: `${base}/nope.bin`, sink: new MemorySink(), fetchFn: async (u, i) => { calls.push(u); return fetch(u, i); }, ...noWait }), (e) => e.code === 'http' && e.status === 404);
  assert.equal(calls.length, 1);
});

test('pausing: an abort stops the download, keeps the bytes, and the next call carries on', async () => {
  await clear();
  const sink = new MemorySink();
  const ctl = new AbortController();
  await assert.rejects(run('onnx/big.onnx_data', sink, { signal: ctl.signal, onProgress: (p) => { if (p.phase === 'downloading' && p.done > 700_000) ctl.abort(); }, progressEveryMs: 0 }), (e) => e.code === 'aborted');
  const kept = sink.size();
  assert.ok(kept > 700_000 && kept < BIG.length, `kept ${kept}`);
  assert.ok(Buffer.from(sink.bytes()).equals(BIG.subarray(0, kept)));
  const r = await run('onnx/big.onnx_data', sink);
  assert.equal(r.resumedFrom, kept);
  assert.ok(Buffer.from(sink.bytes()).equals(BIG));
  await assert.rejects(run('small.json', new MemorySink(), { signal: AbortSignal.abort() }), (e) => e.code === 'aborted');
});

test('a file on disk that is longer than the pin is thrown away, not trusted', async () => {
  await clear();
  const sink = new MemorySink();
  sink.write(Buffer.alloc(SMALL.length + 10, 1), 0);
  assert.equal((await run('small.json', sink)).bytes, SMALL.length);
  assert.ok(Buffer.from(sink.bytes()).equals(SMALL));
});

// ------------------------------------------------------------------------------------------------ answers that the real mirror does not give
const answer = (status, headers, data) => async () => new Response(data, { status, headers });

test('a server that ignores the Range header: the file starts again from byte 0', async () => {
  await clear();
  const sink = new MemorySink();
  sink.write(BIG.subarray(0, 900_000), 0);
  const r = await run('onnx/big.onnx_data', sink, { fetchFn: (u, i) => fetch(u, { ...i, headers: {} }) });
  assert.ok(Buffer.from(sink.bytes()).equals(BIG));
  assert.equal(r.resumedFrom, 900_000);
});

test('an answer that starts at the wrong byte, or names another size, is refused', async () => {
  const sink = new MemorySink();
  sink.write(SMALL.subarray(0, 100), 0);
  await assert.rejects(run('small.json', sink, { fetchFn: answer(206, { 'content-range': `bytes 0-${SMALL.length - 1}/${SMALL.length}` }, SMALL) }), (e) => e.code === 'bad-range' && /starts at byte 0, not at 100/.test(e.message));
  await assert.rejects(run('small.json', sink, { fetchFn: answer(206, { 'content-range': `bytes 100-${SMALL.length - 1}/${SMALL.length + 5}` }, SMALL.subarray(100)) }), (e) => e.code === 'bad-range');
  assert.equal(sink.size(), 100, 'nothing was written from the bad answers');
  await assert.rejects(run('small.json', new MemorySink(), { fetchFn: answer(200, { 'content-length': String(SMALL.length + 1) }, Buffer.concat([SMALL, Buffer.alloc(1)])) }), (e) => e.code === 'size');
});

test('more data than the pin is an error, and so is a body that ends early without an error (it is asked for again)', async () => {
  await assert.rejects(run('small.json', new MemorySink(), { fetchFn: answer(200, {}, Buffer.concat([SMALL, Buffer.alloc(50)])) }), (e) => e.code === 'too-large');
  let n = 0;
  const half = async (u, i) => (n++ === 0 ? new Response(SMALL.subarray(0, 1000), { status: 200 }) : fetch(u, i));
  const sink = new MemorySink();
  const r = await run('small.json', sink, { fetchFn: half });
  assert.equal(r.bytes, SMALL.length);
  assert.ok(Buffer.from(sink.bytes()).equals(SMALL));
});

test('the disk filling up is reported as a disk error, not as a network problem', async () => {
  const sink = new MemorySink();
  sink.write = () => { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e; };
  await assert.rejects(run('small.json', sink), (e) => e.code === 'disk' && /QuotaExceededError/.test(e.message));
});

test('the sink is flushed now and then, and at the end', async () => {
  await clear();
  const sink = new MemorySink();
  await run('onnx/big.onnx_data', sink, { flushEvery: 1_000_000 });
  assert.ok(sink.flushes >= 3, `${sink.flushes} flushes`);
});

// ------------------------------------------------------------------------------------------------ a set of files
test('a set: files in order, progress over all of them, recorded as verified, and a second run does nothing', async () => {
  await clear();
  const files = [pin('small.json'), pin('onnx/big.onnx_data')];
  const sinks = new Map();
  const verified = {};
  const opened = [];
  const closed = [];
  const progress = [];
  const options = {
    files, urlFor: (p) => `${base}/${p}`, verified, ...noWait, progressEveryMs: 0,
    openSink: (f) => { opened.push(f.path); if (!sinks.has(f.path)) sinks.set(f.path, new MemorySink()); return sinks.get(f.path); },
    closeSink: (f) => closed.push(f.path),
    markVerified: (f) => { verified[f.path] = { size: f.size, sha256: f.sha256 }; },
    onProgress: (p) => progress.push(p),
  };
  const first = await downloadSet(options);
  assert.deepEqual(first.downloaded, ['small.json', 'onnx/big.onnx_data']);
  assert.deepEqual(first.skipped, []);
  const total = SMALL.length + BIG.length;
  assert.ok(progress.every((p) => p.total === total && p.files === 2));
  assert.equal(progress.at(-1).done, total);
  assert.ok(progress.some((p) => p.fileIndex === 1 && p.done > SMALL.length), 'the second file counts after the first');
  assert.ok(progress.every((p, i) => i === 0 || p.done >= progress[i - 1].done - 0), 'the total never goes backwards');
  assert.deepEqual(closed, opened.slice(0, closed.length));
  const log1 = (await requestLog()).length;
  const second = await downloadSet(options);
  assert.deepEqual(second.skipped, ['small.json', 'onnx/big.onnx_data']);
  assert.deepEqual(second.downloaded, []);
  assert.equal((await requestLog()).length, log1, 'no request at all');
  // a recorded file whose size no longer matches is downloaded again
  sinks.get('small.json').truncate(10);
  const third = await downloadSet(options);
  assert.deepEqual(third.downloaded, ['small.json']);
});

test('a set that fails on its second file keeps the first one recorded', async () => {
  await clear();
  await fault({ path: 'onnx/big.onnx_data', corrupt: { at: 10 } });
  const verified = {};
  const sinks = {};
  await assert.rejects(downloadSet({
    files: [pin('small.json'), pin('onnx/big.onnx_data')], urlFor: (p) => `${base}/${p}`, verified, ...noWait,
    openSink: (f) => (sinks[f.path] ||= new MemorySink()), markVerified: (f) => { verified[f.path] = { size: f.size, sha256: f.sha256 }; },
  }), (e) => e.code === 'hash-mismatch');
  assert.deepEqual(Object.keys(verified), ['small.json']);
  assert.equal(sinks['onnx/big.onnx_data'].size(), 0);
});
