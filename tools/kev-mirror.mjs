// A local stand-in for huggingface.co, for the tests of the model download: it serves the pinned Kev files from a folder, with
// Range requests, a redirect to a "signed" address like the real server's, and faults that the tests switch on.
//
//   node tools/kev-mirror.mjs --dir <folder that holds config.json, tokenizer.json, ..., onnx/model_q4.onnx, ...> [--port 8765] [--rate 40] [--no-redirect]
//
//   GET  /<path>            302 to /cdn/<n>/<path> (a new "signature" each time), or the file itself with --no-redirect
//   GET  /cdn/<n>/<path>    the file; `Range: bytes=a-b` is answered with 206 and Content-Range, CORS is open
//   POST /__fault           {"path", "cutAfter": bytes, "times": 1}   close the connection after that many body bytes, for the next `times` requests
//                           {"path", "corrupt": {"at": offset}}        flip the bits of one byte in every response that covers the offset (until cleared)
//                           {"path", "status": 503, "times": 2}        answer the next requests with that status
//   POST /__clear           remove all faults and reset the log
//   GET  /__log             [{n, path, range, status, sent, aborted}] one entry per request for a file
//   --rate <MB/s>           slow the file responses down, so that a test can click Pause while the download runs
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize, resolve } from 'node:path';
import { Transform } from 'node:stream';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const DIR = resolve(arg('--dir', '.'));
const PORT = Number(arg('--port', 8765));
const RATE = Number(arg('--rate', 0)) * 1e6;     // bytes per second; 0 = as fast as the disk
const REDIRECT = !process.argv.includes('--no-redirect');

const faults = [];                               // {path, kind, ...}
const log = [];
let signature = 0;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'range, content-type',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Expose-Headers': 'content-length, content-range, accept-ranges, etag',
};

function fileFor(path) {
  const clean = normalize(decodeURIComponent(path)).replace(/^([/\\])+/, '');
  if (clean.startsWith('..')) return null;
  const full = join(DIR, clean);
  return existsSync(full) && statSync(full).isFile() ? { full, size: statSync(full).size, clean } : null;
}

function takeFault(path, kind) {
  const i = faults.findIndex((f) => f.path === path && f.kind === kind && (f.times === undefined || f.times > 0));
  if (i < 0) return null;
  const f = faults[i];
  if (f.times !== undefined) f.times--;
  return f;
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const send = (status, body, headers = {}) => { res.writeHead(status, { ...CORS, 'Content-Type': 'application/json', ...headers }); res.end(body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)); };

  if (req.method === 'OPTIONS') return send(204);
  if (url.pathname === '/__log') return send(200, log);
  if (url.pathname === '/__clear' && req.method === 'POST') { faults.length = 0; log.length = 0; return send(200, { ok: true }); }
  if (url.pathname === '/__fault' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const f = JSON.parse(body || '{}');
      if (f.cutAfter !== undefined) faults.push({ path: f.path, kind: 'cut', cutAfter: f.cutAfter, times: f.times ?? 1 });
      if (f.corrupt) faults.push({ path: f.path, kind: 'corrupt', at: f.corrupt.at });
      if (f.status) faults.push({ path: f.path, kind: 'status', status: f.status, times: f.times ?? 1 });
      send(200, { ok: true, faults: faults.length });
    });
    return;
  }

  // a file: /<path> redirects, /cdn/<n>/<path> serves
  let path = url.pathname.replace(/^\//, '');
  const viaCdn = /^cdn\/\d+\//.test(path);
  if (viaCdn) path = path.replace(/^cdn\/\d+\//, '');
  const file = fileFor(path);
  if (!file) return send(404, { error: 'not found', path });
  if (REDIRECT && !viaCdn) return send(302, '', { Location: `/cdn/${++signature}/${path}` });

  const entry = { n: log.length + 1, path, range: req.headers.range || null, status: 200, sent: 0, aborted: false };
  log.push(entry);
  const st = takeFault(path, 'status');
  if (st) { entry.status = st.status; return send(st.status, { error: 'fault' }); }

  let start = 0;
  let end = file.size - 1;
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && (m[1] !== '' || m[2] !== '')) {
    if (m[1] === '') { start = Math.max(0, file.size - Number(m[2])); } else { start = Number(m[1]); if (m[2] !== '') end = Math.min(end, Number(m[2])); }
    if (start > end || start >= file.size) { entry.status = 416; return send(416, '', { 'Content-Range': `bytes */${file.size}` }); }
    entry.status = 206;
  }
  const headers = { ...CORS, 'Content-Type': 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1), ETag: `"${file.size}"` };
  if (entry.status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${file.size}`;
  res.writeHead(entry.status, headers);
  if (req.method === 'HEAD') return res.end();

  const cut = takeFault(path, 'cut');
  const corrupt = faults.find((f) => f.path === path && f.kind === 'corrupt');
  let offset = start;                                // absolute offset of the next byte that leaves the file
  const shaper = new Transform({
    transform(chunk, _enc, cb) {
      if (corrupt && corrupt.at >= offset && corrupt.at < offset + chunk.length) { chunk = Buffer.from(chunk); chunk[corrupt.at - offset] ^= 0xff; }
      offset += chunk.length;
      if (cut && entry.sent + chunk.length > cut.cutAfter) {
        const part = chunk.subarray(0, Math.max(0, cut.cutAfter - entry.sent));
        entry.sent += part.length;
        entry.aborted = true;
        this.push(part);
        setTimeout(() => req.socket.destroy(), 20);   // the connection dies with the body half sent
        return cb();
      }
      entry.sent += chunk.length;
      if (RATE > 0) setTimeout(() => cb(null, chunk), (chunk.length / RATE) * 1000); else cb(null, chunk);
    },
  });
  createReadStream(file.full, { start, end, highWaterMark: 256 * 1024 }).pipe(shaper).pipe(res);
  res.on('close', () => { if (!res.writableEnded) entry.aborted = true; });
});

server.listen(PORT, '127.0.0.1', () => console.log(`kev-mirror: http://127.0.0.1:${PORT}/ serves ${DIR}${RATE ? ` at ${RATE / 1e6} MB/s` : ''}${REDIRECT ? ', with redirects' : ''}`));
