import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEV, filesFor, totalBytes, graphFile, dataFile, chooseSet, megabytes, downloadUrl, storeDirFor, STORE_DIR } from '../extension/src/ai/kev-manifest.js';
import { PINS, problems, readTar, readmeText } from '../tools/vendor-kev.mjs';

test('the pinned commit and licence are the ones that were checked', () => {
  assert.match(KEV.commit, /^[0-9a-f]{40}$/);
  assert.equal(KEV.commit, '5a827091b3d58fe4fdfc02a5a5b2ce364047d678');
  assert.equal(KEV.license, 'Apache-2.0');
  assert.equal(KEV.language, 'en');
  assert.deepEqual(KEV.hostPermissions, ['https://huggingface.co/*', 'https://*.hf.co/*']);
});

test('every file has a size and a SHA-256, and the two sets add up to the sizes that the button shows', () => {
  for (const set of ['q4f16', 'q4']) {
    for (const f of filesFor(set)) {
      assert.ok(Number.isInteger(f.size) && f.size > 0, f.path);
      assert.match(f.sha256, /^[0-9a-f]{64}$/, f.path);
      assert.ok(!f.path.startsWith('/') && !f.path.includes('..'), `${f.path} is a plain relative path`);
    }
    assert.equal(new Set(filesFor(set).map((f) => f.path)).size, filesFor(set).length, 'no file twice');
  }
  assert.equal(totalBytes('q4f16'), 345740064);
  assert.equal(totalBytes('q4'), 383111829);
  assert.equal(megabytes(totalBytes('q4f16')), '346 MB');
  assert.equal(megabytes(totalBytes('q4')), '383 MB');
  assert.equal(graphFile('q4f16').path, 'onnx/model_q4f16.onnx');
  assert.equal(dataFile('q4f16').path, 'onnx/model_q4f16.onnx_data');
  assert.equal(dataFile('q4').size, 374822912);
  assert.throws(() => filesFor('fp32'), /no such Kev file set/);
});

test('the big file comes last, so the small files (tokenizer, graph) are checked first', () => {
  for (const set of ['q4f16', 'q4']) {
    const files = filesFor(set);
    assert.equal(files.at(-1), dataFile(set));
    assert.ok(files.slice(0, -1).every((f) => f.size < 10e6));
  }
});

test('the set follows the graphics adapter: half precision only on WebGPU with shader-f16', () => {
  assert.deepEqual(chooseSet({ webgpu: true, f16: true }), { set: 'q4f16', device: 'webgpu' });
  assert.deepEqual(chooseSet({ webgpu: true, f16: false }), { set: 'q4', device: 'webgpu' });
  assert.deepEqual(chooseSet({ webgpu: false, f16: true }), { set: 'q4', device: 'wasm' }, 'no adapter, no WebGPU');
  assert.deepEqual(chooseSet({}), { set: 'q4', device: 'wasm' });
  assert.deepEqual(chooseSet(null), { set: 'q4', device: 'wasm' });
});

test('an address names the pinned commit, and only an explicit base replaces the host', () => {
  assert.equal(downloadUrl('onnx/model_q4.onnx'), `https://huggingface.co/onnx-community/kev-0.6b-ONNX/resolve/${KEV.commit}/onnx/model_q4.onnx`);
  assert.equal(downloadUrl('config.json', 'http://127.0.0.1:8765/files/'), 'http://127.0.0.1:8765/files/config.json');
  assert.equal(storeDirFor(), `${STORE_DIR}-5a827091`);
});

test('the runtime files named by the manifest are the vendored ones', () => {
  const vendored = [...PINS.transformers.files, ...PINS.ort.files].map((f) => 'vendor/' + f.to);
  for (const p of Object.values(KEV.runtime)) assert.ok(vendored.includes(p), `${p} is pinned in tools/vendor-kev.mjs`);
});

test('extension/vendor/ holds exactly the pinned runtime (run `node tools/vendor-kev.mjs` when this fails)', () => {
  const bad = problems();
  assert.deepEqual(bad.map((b) => `${b.file.to}: ${b.why}`), []);
});

test('the vendor README is generated from the pins', () => {
  const text = readmeText();
  assert.match(text, /Transformers\.js 4\.3\.2/);
  assert.ok(text.includes(PINS.ort.files[1].sha256));
  assert.ok(text.includes(PINS.transformers.integrity));
});

// a minimal tar (ustar) archive, built by hand: two files and a directory
function tar(entries) {
  const blocks = [];
  for (const e of entries) {
    const header = Buffer.alloc(512);
    header.write(e.name, 0, 100, 'utf8');
    header.write((e.data ? e.data.length : 0).toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii');
    header.write(e.type || '0', 156, 1, 'ascii');
    header.write('ustar\0', 257, 6, 'ascii');
    blocks.push(header);
    if (e.data) { blocks.push(e.data); blocks.push(Buffer.alloc((512 - (e.data.length % 512)) % 512)); }
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}

test('the tar reader returns regular files by name and skips directories', () => {
  const archive = tar([
    { name: 'package/', type: '5' },
    { name: 'package/a.txt', data: Buffer.from('hello') },
    { name: 'package/dist/b.bin', data: Buffer.alloc(1000, 7) },
  ]);
  const entries = readTar(archive);
  assert.deepEqual(entries.map((e) => e.name), ['package/a.txt', 'package/dist/b.bin']);
  assert.equal(Buffer.from(entries[0].data).toString(), 'hello');
  assert.equal(entries[1].data.length, 1000);
  assert.deepEqual(readTar(Buffer.alloc(1024)), []);
});
