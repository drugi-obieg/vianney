// Fetch the runtime that reads the local model (Kev-0.6B) into extension/vendor/, and refuse anything that does not match its pin.
//
//   node tools/vendor-kev.mjs            download what is missing or wrong, verify, write extension/vendor/README.md
//   node tools/vendor-kev.mjs --check    only verify the files that are there (no network)
//
// Why vendored: an extension may not run code that it loads from somewhere else (Manifest V3), so the model's runtime (Transformers.js and the
// ONNX Runtime WebAssembly files) ships inside the extension. Only the weights, which are data, are downloaded later, on the user's click.
// Every file is pinned twice: the npm tarball by the sha512 `integrity` that the registry publishes, and each extracted file by its SHA-256.
// Needs Node 20 or newer and network access; nothing is installed and no script of those packages is run.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '..');
export const VENDOR_DIR = resolve(root, 'extension/vendor');

export const PINS = {
  transformers: {
    name: '@huggingface/transformers', version: '4.3.2', licence: 'Apache-2.0',
    tarball: 'https://registry.npmjs.org/@huggingface/transformers/-/transformers-4.3.2.tgz',
    integrity: 'sha512-V3+dqf3iWlRYJ9I9GreM3zGQd0lAXnnoPeddmkOQYWAEE4l/+Fi6p7tx/qVUJlKQgLXGim2W76rTOzz+eC0i7g==',
    files: [
      { from: 'package/dist/transformers.min.js', to: 'transformers/transformers.min.js', size: 587917, sha256: '8b5a3171f8876bab2b1820a7d65eb87628e3d30bb5ea85b9dd398e76eb34decb' },
      { from: 'package/LICENSE', to: 'transformers/LICENSE', size: 11358, sha256: 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30' },
    ],
  },
  // Transformers.js 4.3.2 depends on exactly this development build of ONNX Runtime Web; the JavaScript inside its bundle and these WebAssembly files must come from the same build.
  ort: {
    name: 'onnxruntime-web', version: '1.31.0-dev.20260914-8d85527a0', licence: 'MIT',
    tarball: 'https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-1.31.0-dev.20260914-8d85527a0.tgz',
    integrity: 'sha512-Iy7rtadoBgxS/LLvDr3QW38DB1PNXRnr0GJMcL0TAt7c9qjgVQl83UlGCVyeAnK2InpmW8Uc3PL8XIuqtDeF6g==',
    files: [
      { from: 'package/dist/ort-wasm-simd-threaded.asyncify.mjs', to: 'ort/ort-wasm-simd-threaded.asyncify.mjs', size: 53057, sha256: '0966b6105cd936744498aa60df7a22cbd47af3374dbc64a9ab561c08a71e3611' },
      { from: 'package/dist/ort-wasm-simd-threaded.asyncify.wasm', to: 'ort/ort-wasm-simd-threaded.asyncify.wasm', size: 26861777, sha256: '49871f5a4409519797e127440868a6d1923339d9185907f301a5b2a1d90af082' },
      // the plain processor build: the WebGPU build above has no processor kernel for GatherBlockQuantized (measured: "Could not find an
      // implementation for GatherBlockQuantized(1)"), which the model's 4-bit embedding table needs, so the WebAssembly path uses this one
      { from: 'package/dist/ort-wasm-simd-threaded.mjs', to: 'ort/ort-wasm-simd-threaded.mjs', size: 24381, sha256: 'c57ca56328877353a575e51bbca6f18450027d6c9bf2307a2cb2c41363b4de9f' },
      { from: 'package/dist/ort-wasm-simd-threaded.wasm', to: 'ort/ort-wasm-simd-threaded.wasm', size: 14264838, sha256: '06ba057753da3847e4c24f02d91ab133455b0817c69a44993a9a53a2146df9e3' },
    ],
  },
  // The npm package of ONNX Runtime Web carries no licence file; this is the MIT text of the project repository at the tag nearest to that build
  // (identical in the tags v1.22.0, v1.30.0, v1.31.0 and v1.31.1; the development build's own commit cannot be addressed by its short hash).
  ortLicense: {
    url: 'https://cdn.jsdelivr.net/gh/microsoft/onnxruntime@v1.31.0/LICENSE', to: 'ort/LICENSE', size: 1073,
    sha256: '2f07c72751aed99790b8a4869cf2311df85a860b22ded05fa22803587a48922c',
  },
};

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const integrityOf = (buf) => 'sha512-' + createHash('sha512').update(buf).digest('base64');

/** Read the entries of a (decompressed) tar archive: [{name, data}]. Only regular files; names are taken as the archive gives them. */
export function readTar(tar) {
  const entries = [];
  let off = 0;
  let longName = null;
  while (off + 512 <= tar.length) {
    const header = tar.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const field = (a, n) => { const s = header.subarray(a, a + n); const z = s.indexOf(0); return Buffer.from(z < 0 ? s : s.subarray(0, z)).toString('utf8'); };
    const size = parseInt(field(124, 12).trim() || '0', 8);
    const type = field(156, 1) || '0';
    const prefix = field(345, 155);
    let name = (prefix ? prefix + '/' : '') + field(0, 100);
    off += 512;
    const data = tar.subarray(off, off + size);
    off += Math.ceil(size / 512) * 512;
    if (type === 'L') { longName = Buffer.from(data).toString('utf8').replace(/\0+$/, ''); continue; } // GNU long file name for the next entry
    if (longName) { name = longName; longName = null; }
    if (type === '0' || type === '\0') entries.push({ name, data });
  }
  return entries;
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function describe(file) { return `${file.to} (${file.size} bytes, sha256 ${file.sha256})`; }

/** The files of vendor/ that are missing or differ from their pin. */
export function problems() {
  const list = [...PINS.transformers.files, ...PINS.ort.files, PINS.ortLicense];
  const bad = [];
  for (const f of list) {
    const p = resolve(VENDOR_DIR, f.to);
    if (!existsSync(p)) { bad.push({ file: f, why: 'missing' }); continue; }
    const buf = readFileSync(p);
    if (buf.length !== f.size) bad.push({ file: f, why: `size ${buf.length}, expected ${f.size}` });
    else if (sha256(buf) !== f.sha256) bad.push({ file: f, why: 'sha256 differs from the pin' });
  }
  return bad;
}

function put(file, buf) {
  if (buf.length !== file.size) throw new Error(`${file.to}: ${buf.length} bytes, the pin says ${file.size}. Nothing was written.`);
  if (sha256(buf) !== file.sha256) throw new Error(`${file.to}: SHA-256 ${sha256(buf)} differs from the pin ${file.sha256}. Nothing was written.`);
  const p = resolve(VENDOR_DIR, file.to);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, buf);
}

async function fromTarball(pin, wanted) {
  console.log(`fetching ${pin.name}@${pin.version} (${pin.tarball})`);
  const tgz = await download(pin.tarball);
  if (integrityOf(tgz) !== pin.integrity) throw new Error(`${pin.name}@${pin.version}: the tarball's sha512 is ${integrityOf(tgz)}, the pin is ${pin.integrity}. Nothing was written.`);
  const entries = readTar(gunzipSync(tgz));
  const byName = new Map(entries.map((e) => [e.name, e.data]));
  for (const f of wanted) {
    if (!byName.has(f.from)) throw new Error(`${pin.name}@${pin.version}: no file ${f.from} in the tarball`);
    put(f, Buffer.from(byName.get(f.from)));
    console.log('  wrote ' + describe(f));
  }
}

export function readmeText() {
  const t = PINS.transformers;
  const o = PINS.ort;
  const lines = [
    '# vendor: the runtime of the local model (Kev-0.6B)',
    '',
    'Written by `node tools/vendor-kev.mjs`; do not edit by hand. `node tools/vendor-kev.mjs --check` verifies these files against the pins below (no network).',
    '',
    'These files are CODE that the extension runs, so they ship inside the extension and are never downloaded at run time (Manifest V3 forbids remotely hosted code).',
    'The model\'s weights are DATA and are downloaded on the user\'s click: see extension/src/ai/kev-manifest.js.',
    '',
    `## Transformers.js ${t.version} (${t.licence})`,
    '',
    `- source: ${t.tarball}`,
    `- the tarball's integrity as the npm registry publishes it: \`${t.integrity}\``,
    ...t.files.map((f) => `- \`${f.to}\`: ${f.size} bytes, SHA-256 \`${f.sha256}\` (from \`${f.from}\`)`),
    '- `transformers.min.js` is the self-contained browser bundle (an ES module with no imports). It contains ONNX Runtime Web (MIT) and the tokenizer code.',
    '- The bundle names a default location for the WebAssembly files on a content delivery network. The extension never uses it: it sets the two paths below before the first session is made, and its content security policy would refuse the other address anyway.',
    '',
    `## ONNX Runtime Web ${o.version} (${o.licence})`,
    '',
    `- source: ${o.tarball}`,
    `- the tarball's integrity as the npm registry publishes it: \`${o.integrity}\``,
    ...o.files.map((f) => `- \`${f.to}\`: ${f.size} bytes, SHA-256 \`${f.sha256}\` (from \`${f.from}\`)`),
    `- \`ort/LICENSE\`: the MIT text of the project repository (${PINS.ortLicense.url}), ${PINS.ortLicense.size} bytes, SHA-256 \`${PINS.ortLicense.sha256}\`. The npm package has no licence file.`,
    '- This is the exact development build that Transformers.js 4.3.2 depends on. The JavaScript inside `transformers.min.js` and these WebAssembly files must come from the same build, so they are updated together.',
    '- Two builds are vendored, because each does one job that the other cannot (measured in Chrome 158 on 2026-11-26):',
    '  - "asyncify" (`ort-wasm-simd-threaded.asyncify.*`): the WebGPU execution provider. It runs on one thread. Its processor kernels lack `GatherBlockQuantized`, which the model needs, so it cannot run the model on the processor.',
    '  - plain (`ort-wasm-simd-threaded.*`): the WebAssembly (processor) execution provider, without WebGPU. It has the kernel.',
    '',
    '## Size',
    '',
    `- ${(t.files.reduce((n, f) => n + f.size, 0) + o.files.reduce((n, f) => n + f.size, 0) + PINS.ortLicense.size)} bytes in total, of which the two WebAssembly binaries are ${o.files[1].size} (WebGPU) and ${o.files[3].size} (processor).`,
    '',
  ];
  return lines.join('\n');
}

async function main() {
  if (process.argv.includes('--check')) {
    const bad = problems();
    if (bad.length) {
      for (const b of bad) console.error(`${b.file.to}: ${b.why}`);
      process.exit(1);
    }
    console.log('extension/vendor/ matches its pins');
    return;
  }
  const bad = problems();
  const missing = (pin) => pin.files.filter((f) => bad.some((b) => b.file === f));
  if (missing(PINS.transformers).length) await fromTarball(PINS.transformers, PINS.transformers.files);
  if (missing(PINS.ort).length) await fromTarball(PINS.ort, PINS.ort.files);
  if (bad.some((b) => b.file === PINS.ortLicense)) {
    const lic = await download(PINS.ortLicense.url);
    put(PINS.ortLicense, lic);
    console.log('  wrote ' + describe(PINS.ortLicense));
  }
  writeFileSync(resolve(VENDOR_DIR, 'README.md'), readmeText());
  const left = problems();
  if (left.length) throw new Error('still wrong: ' + left.map((b) => `${b.file.to} (${b.why})`).join(', '));
  console.log('extension/vendor/ is complete and matches its pins');
}

if (import.meta.main) main().catch((e) => { console.error(String((e && e.message) || e)); process.exit(1); });
