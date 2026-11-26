// Downloading the model files: resumable, checked against pinned SHA-256 values while they are written, and kept off the main memory.
//
// Pure logic with everything that touches the world handed in, so that it runs the same in a Worker (where the sink is an OPFS
// synchronous access handle) and in Node (where the tests give it a file in memory and a real local server):
//   fetchFn  a `fetch`;   sink  {size(), read(buffer, at), write(data, at), truncate(size), flush()};   sleep, now  clocks.
//
// How a file is fetched
//  - The address is the pinned `resolve` address. It answers with a redirect to a signed address that stops working after about an hour
//    (measured on huggingface.co: `Expires` is 3,599 s after the response), so every attempt starts from the pinned address again and never
//    keeps the signed one.
//  - What is already on disk is kept. It is read again through the hasher (a few seconds for 335 MB), and the missing part is asked for with
//    `Range: bytes=<size>-`. The answer must be 206 with a `Content-Range` that starts exactly there and ends at the pinned size.
//  - A connection that dies is tried again from where the file stands, a few times, without the user (CHOICE: 3 failures in a row, 1.5 s apart);
//    after that the download stops with an error, keeping what it has, and the "Retry" button resumes it.
//  - At the end the SHA-256 must equal the pin. If it does not, the file is emptied and the download fails: a file that does not match is never kept.

import { Sha256 } from './sha256.js';

export class DownloadError extends Error {
  /** @param {'aborted'|'network'|'http'|'bad-range'|'too-large'|'size'|'hash-mismatch'|'disk'} code */
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'DownloadError';
    this.code = code;
    Object.assign(this, extra);
  }
}

// "bytes 100-199/1000" -> {start: 100, end: 199, total: 1000}; "bytes star/1000" (an unsatisfied range) -> {start: null, end: null, total: 1000}; anything else -> null
export function parseContentRange(value) {
  const m = /^\s*bytes\s+(?:(\d+)-(\d+)|\*)\/(\d+|\*)\s*$/i.exec(String(value || ''));
  if (!m) return null;
  return { start: m[1] === undefined ? null : Number(m[1]), end: m[2] === undefined ? null : Number(m[2]), total: m[3] === '*' ? null : Number(m[3]) };
}

/** Does this 206 answer continue the file exactly where it stands, up to the pinned size? Returns an error text, or null when it does. */
export function badContentRange(value, have, size) {
  const r = parseContentRange(value);
  if (!r || r.start === null) return `no usable Content-Range (${value || 'missing'})`;
  if (r.start !== have) return `the answer starts at byte ${r.start}, not at ${have}`;
  if (r.total !== size) return `the answer says the file has ${r.total} bytes, the pin says ${size}`;
  if (r.end !== size - 1) return `the answer ends at byte ${r.end}, not at ${size - 1}`;
  return null;
}

/** Bytes per second over a sliding window of the last few seconds. */
export class Meter {
  constructor(now = () => Date.now(), windowMs = 4000) {
    this.now = now;
    this.windowMs = windowMs;
    this.points = [];
  }

  add(bytes) {
    const t = this.now();
    this.points.push({ t, bytes });
    while (this.points.length > 2 && t - this.points[0].t > this.windowMs) this.points.shift();
  }

  /** @returns {number} bytes per second, 0 when there is not enough to tell */
  speed() {
    if (this.points.length < 2) return 0;
    const first = this.points[0];
    const last = this.points[this.points.length - 1];
    const seconds = (last.t - first.t) / 1000;
    if (seconds <= 0) return 0;
    let bytes = 0;
    for (let i = 1; i < this.points.length; i++) bytes += this.points[i].bytes;
    return bytes / seconds;
  }
}

const sleepFor = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Download one file to the sink, resuming what is there, and verify it.
 * @param {{file: {path: string, size: number, sha256: string}, url: string, sink: object, fetchFn?: Function, signal?: AbortSignal,
 *   onProgress?: (p: {file: string, phase: 'checking'|'downloading', done: number, total: number, bytesPerSecond: number}) => void,
 *   retries?: number, retryDelayMs?: number, sleep?: (ms: number) => Promise<void>, now?: () => number, progressEveryMs?: number, readChunk?: number, flushEvery?: number}} o
 * @returns {Promise<{bytes: number, sha256: string, resumedFrom: number, requests: number}>}
 */
export async function downloadFile({ file, url, sink, fetchFn = fetch, signal, onProgress = () => {}, retries = 3, retryDelayMs = 1500, sleep = sleepFor, now = () => Date.now(), progressEveryMs = 250, readChunk = 4 * 1024 * 1024, flushEvery = 16 * 1024 * 1024 }) {
  const meter = new Meter(now);
  let lastReport = 0;
  const report = (phase, done, force = false) => {
    const t = now();
    if (!force && t - lastReport < progressEveryMs) return;
    lastReport = t;
    onProgress({ file: file.path, phase, done, total: file.size, bytesPerSecond: phase === 'downloading' ? meter.speed() : 0 });
  };
  const aborted = () => new DownloadError('aborted', 'stopped');
  if (signal && signal.aborted) throw aborted();

  // what is on disk already goes through the hasher
  let have = sink.size();
  if (have > file.size) { sink.truncate(0); have = 0; }
  let hasher = new Sha256();
  const rehash = () => {
    hasher = new Sha256();
    const buf = new Uint8Array(Math.min(readChunk, Math.max(1, have)));
    let at = 0;
    while (at < have) {
      if (signal && signal.aborted) throw aborted();
      const n = sink.read(buf.subarray(0, Math.min(buf.length, have - at)), at);
      if (!n) throw new DownloadError('disk', `the file ends at byte ${at}, but ${have} were expected`);
      hasher.update(buf.subarray(0, n));
      at += n;
      report('checking', at);
    }
  };
  rehash();
  const resumedFrom = have;
  let requests = 0;
  let unflushed = 0;
  let failures = 0;                     // failed attempts in a row, without any progress in between

  while (have < file.size) {
    if (signal && signal.aborted) throw aborted();
    requests++;
    const startedAt = have;
    let res;
    try {
      res = await fetchFn(url, { headers: have > 0 ? { Range: `bytes=${have}-` } : {}, signal, credentials: 'omit', cache: 'no-store' });
    } catch (e) {
      if (signal && signal.aborted) throw aborted();
      if (++failures > retries) throw new DownloadError('network', `no connection (${(e && e.message) || e})`, { cause: e });
      await sleep(retryDelayMs * failures);
      continue;
    }
    if (res.status >= 500 || res.status === 429) {
      try { await res.body?.cancel(); } catch { /* the body is not needed */ }
      if (++failures > retries) throw new DownloadError('http', `the server answered ${res.status}`, { status: res.status });
      await sleep(retryDelayMs * failures);
      continue;
    }
    if (res.status === 416 && have > 0) {         // the file on the server no longer fits what we have: start again
      try { await res.body?.cancel(); } catch { /* ignore */ }
      sink.truncate(0); have = 0; rehash();
      if (++failures > retries) throw new DownloadError('http', 'the server refuses the range', { status: 416 });
      continue;
    }
    if (res.status !== 200 && res.status !== 206) {
      try { await res.body?.cancel(); } catch { /* ignore */ }
      throw new DownloadError('http', `the server answered ${res.status}`, { status: res.status });
    }
    if (res.status === 200) {
      // a full answer: either we asked for everything, or the server ignored the Range header; in both cases it starts at byte 0
      const length = Number(res.headers.get('content-length'));
      if (Number.isFinite(length) && length > 0 && length !== file.size) {
        try { await res.body?.cancel(); } catch { /* ignore */ }
        throw new DownloadError('size', `the server says the file has ${length} bytes, the pin says ${file.size}`);
      }
      if (have > 0) { sink.truncate(0); have = 0; rehash(); }
    } else {
      const bad = badContentRange(res.headers.get('content-range'), have, file.size);
      if (bad) { try { await res.body?.cancel(); } catch { /* ignore */ } throw new DownloadError('bad-range', bad); }
    }
    if (!res.body) throw new DownloadError('network', 'the answer has no body');

    const reader = res.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (have + value.length > file.size) throw new DownloadError('too-large', `more data than the pinned ${file.size} bytes`);
        try {
          sink.write(value, have);
        } catch (e) {
          throw new DownloadError('disk', `could not write to disk (${(e && e.name) || ''} ${(e && e.message) || e})`.replace('  ', ' '), { cause: e });
        }
        hasher.update(value);
        have += value.length;
        meter.add(value.length);
        if ((unflushed += value.length) >= flushEvery) { sink.flush(); unflushed = 0; }   // what a crash could lose stays small
        report('downloading', have);
      }
    } catch (e) {
      try { await reader.cancel(); } catch { /* ignore */ }
      if (e instanceof DownloadError) throw e;
      if (signal && signal.aborted) throw aborted();
      if (have > startedAt) failures = 0;           // it got somewhere: this failure does not count against the limit
      if (++failures > retries) throw new DownloadError('network', `the connection was lost (${(e && e.message) || e})`, { cause: e });
      await sleep(retryDelayMs * failures);
      continue;
    }
    if (have > startedAt) failures = 0;
    if (have < file.size) {                           // the answer ended early without an error: ask again from where we are
      if (++failures > retries) throw new DownloadError('network', `the answer ended at byte ${have} of ${file.size}`);
      await sleep(retryDelayMs * failures);
    }
  }

  sink.flush();
  report('downloading', have, true);
  const digest = hasher.hex();
  if (digest !== file.sha256) {
    sink.truncate(0);
    sink.flush();
    throw new DownloadError('hash-mismatch', `${file.path}: the SHA-256 is ${digest}, not the pinned ${file.sha256}. The file was deleted.`, { expected: file.sha256, actual: digest });
  }
  return { bytes: have, sha256: digest, resumedFrom, requests };
}

/**
 * Download a set of files one after the other. Files that are recorded as verified are skipped (their size must still match).
 * @param {{files: {path: string, size: number, sha256: string}[], urlFor: (path: string) => string, openSink: (file: object) => Promise<object>|object,
 *   closeSink?: (file: object, sink: object) => void, verified: Record<string, {size: number, sha256: string}>, markVerified: (file: object) => Promise<void>|void,
 *   onProgress?: Function, signal?: AbortSignal} & object} o   other options go to downloadFile
 * @returns {Promise<{downloaded: string[], skipped: string[]}>}
 */
export async function downloadSet({ files, urlFor, openSink, closeSink = () => {}, verified = {}, markVerified = () => {}, onProgress = () => {}, ...rest }) {
  const total = files.reduce((n, f) => n + f.size, 0);
  const skipped = [];
  const downloaded = [];
  let before = 0;                                     // bytes of the files that are finished
  for (const file of files) {
    const known = verified[file.path];
    if (known && known.size === file.size && known.sha256 === file.sha256) {
      const sink = await openSink(file);
      const ok = sink.size() === file.size;           // the record is trusted only while the file is still the right size
      closeSink(file, sink);
      if (ok) { skipped.push(file.path); before += file.size; onProgress({ file: file.path, fileIndex: files.indexOf(file), files: files.length, phase: 'downloading', done: before, total, bytesPerSecond: 0 }); continue; }
    }
    const sink = await openSink(file);
    try {
      await downloadFile({
        ...rest, file, url: urlFor(file.path), sink,
        onProgress: (p) => onProgress({ ...p, fileIndex: files.indexOf(file), files: files.length, done: before + p.done, total, fileDone: p.done, fileTotal: p.total }),
      });
    } catch (e) {
      if (e instanceof DownloadError && !e.file) e.file = file.path;     // the caller shows which file went wrong
      throw e;
    } finally {
      closeSink(file, sink);
    }
    await markVerified(file);
    downloaded.push(file.path);
    before += file.size;
  }
  return { downloaded, skipped };
}
