// Check extension/src/ai/kev-manifest.js against Hugging Face: node tools/check-kev-manifest.mjs [--full]
//
// What it does (all read-only, nothing is written):
//  1. asks the API for the pinned commit (not `main`) and compares the size of every pinned file with the API's size, and the SHA-256 of
//     the large files with the API's `lfs.sha256`;
//  2. downloads the files that are not stored with Git LFS (the API gives a Git blob id only: it is checked, and the SHA-256 is computed here)
//     and compares size and SHA-256 with the manifest;
//  3. asks for the first 16 bytes of each file with a `Range` header, following the redirect, and expects `206` and a `Content-Range` with the
//     pinned total size (this is what a resumed download relies on);
//  4. with --full it also streams the large files and computes their SHA-256 (about 710 MB for both sets, nothing is kept).
// It also compares the delimiter ids and limits in the manifest with the `kev` section of the pinned config.json.
// Exit status 1 when anything differs.
import { createHash } from 'node:crypto';
import { KEV, filesFor, downloadUrl } from '../extension/src/ai/kev-manifest.js';

const FULL = process.argv.includes('--full');
let failures = 0;
const ok = (msg) => console.log('ok    ' + msg);
const bad = (msg) => { failures++; console.log('FAIL  ' + msg); };
const check = (cond, msg) => (cond ? ok(msg) : bad(msg));

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const gitBlobId = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

const api = `https://huggingface.co/api/models/${KEV.repo}`;
const info = await getJson(`${api}/revision/${KEV.commit}?blobs=true`);
check(info.sha === KEV.commit, `the API knows the pinned commit ${KEV.commit.slice(0, 8)}`);
check(info.cardData && info.cardData.license === 'apache-2.0', `licence apache-2.0 (API: ${info.cardData && info.cardData.license})`);
check(info.cardData && info.cardData.base_model === KEV.baseModel, `base model ${KEV.baseModel}`);
const tree = await getJson(`${api}/tree/${KEV.commit}?recursive=true`);
const byPath = new Map(tree.map((e) => [e.path, e]));
const siblings = new Map((info.siblings || []).map((s) => [s.rfilename, s]));

const everyFile = [...new Map(['q4f16', 'q4'].flatMap((s) => filesFor(s)).map((f) => [f.path, f])).values()];
for (const f of everyFile) {
  const t = byPath.get(f.path);
  const s = siblings.get(f.path);
  if (!t || !s) { bad(`${f.path}: not in the repository at the pinned commit`); continue; }
  check(t.size === f.size && s.size === f.size, `${f.path}: size ${f.size} (API ${t.size})`);
  if (s.lfs) check(s.lfs.sha256 === f.sha256, `${f.path}: SHA-256 equals the API's lfs.sha256`);
}

// the small files: download, compare, and check the Git blob id
for (const f of everyFile.filter((x) => !(siblings.get(x.path) || {}).lfs)) {
  const buf = Buffer.from(await (await fetch(downloadUrl(f.path))).arrayBuffer());
  check(buf.length === f.size, `${f.path}: downloaded ${buf.length} bytes`);
  check(sha256(buf) === f.sha256, `${f.path}: SHA-256 of the download equals the manifest`);
  check(gitBlobId(buf) === (byPath.get(f.path) || {}).oid, `${f.path}: Git blob id equals the API's`);
  if (f.path === 'config.json') {
    const k = JSON.parse(buf.toString('utf8')).kev;
    const ids = k.delimiter_ids;
    check(ids.state === KEV.delimiters.state && ids.question === KEV.delimiters.question && ids.option_start === KEV.delimiters.optionStart
      && ids.option_end === KEV.delimiters.optionEnd && ids.decide === KEV.delimiters.decide, 'config.json: delimiter ids equal the manifest');
    check(k.trained_max_state_tokens === KEV.maxStateTokens, `config.json: trained_max_state_tokens ${k.trained_max_state_tokens} equals maxStateTokens`);
    check(k.trained_max_branch_tokens === KEV.maxLength, `config.json: trained_max_branch_tokens ${k.trained_max_branch_tokens} equals maxLength`);
    check(k.max_state_tokens === KEV.graphMaxTokens, `config.json: max_state_tokens ${k.max_state_tokens} equals graphMaxTokens`);
    check(JSON.stringify(k.noul_options) === JSON.stringify(KEV.noulOptions), 'config.json: noul options are no, yes');
  }
}

// Range: the first 16 bytes of every file, through the redirect
for (const f of everyFile) {
  const res = await fetch(downloadUrl(f.path), { headers: { Range: 'bytes=0-15' }, redirect: 'follow' });
  const buf = Buffer.from(await res.arrayBuffer());
  const cr = res.headers.get('content-range') || '';
  check(res.status === 206 && buf.length === 16 && cr === `bytes 0-15/${f.size}`, `${f.path}: Range answered ${res.status} "${cr}" from ${new URL(res.url).host}`);
}

if (FULL) {
  for (const f of everyFile.filter((x) => (siblings.get(x.path) || {}).lfs)) {
    const res = await fetch(downloadUrl(f.path));
    const h = createHash('sha256');
    let n = 0;
    for await (const chunk of res.body) { h.update(chunk); n += chunk.length; }
    check(n === f.size && h.digest('hex') === f.sha256, `${f.path}: streamed ${n} bytes, SHA-256 equals the manifest`);
  }
} else {
  console.log('(the large files were not downloaded: add --full)');
}

console.log(failures ? `\n${failures} check(s) failed` : '\nthe manifest matches Hugging Face');
process.exit(failures ? 1 : 0);
