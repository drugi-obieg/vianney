import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { Sha256, sha256Hex } from '../extension/src/ai/sha256.js';

const reference = (buf) => createHash('sha256').update(buf).digest('hex');

test('the published test vectors', () => {
  assert.equal(sha256Hex(new Uint8Array(0)), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex(new TextEncoder().encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(
    sha256Hex(new TextEncoder().encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  );
  assert.equal(sha256Hex(new Uint8Array(1000000).fill(0x61)), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0', 'one million times "a"');
});

test('every length around the block borders gives the same digest as Node', () => {
  for (const n of [...Array(300).keys(), 511, 512, 513, 1023, 1024, 4095, 4096, 4097]) {
    const data = randomBytes(n);
    assert.equal(sha256Hex(data), reference(data), `${n} bytes`);
  }
});

test('feeding the data in pieces of any size changes nothing', () => {
  const data = randomBytes(100000);
  const want = reference(data);
  for (const step of [1, 3, 55, 56, 63, 64, 65, 100, 4096, 65536, 99999]) {
    const h = new Sha256();
    for (let i = 0; i < data.length; i += step) h.update(data.subarray(i, i + step));
    assert.equal(h.hex(), want, `pieces of ${step}`);
  }
  // pieces of random sizes, including empty ones
  const h = new Sha256();
  let i = 0;
  let seed = 7;
  while (i < data.length) { seed = (seed * 1103515245 + 12345) % 2147483648; const n = seed % 2000; h.update(data.subarray(i, i + n)); i += n; }
  assert.equal(h.hex(), want);
});

test('the digest can be read again, and a finished hasher refuses more data', () => {
  const h = new Sha256().update(new TextEncoder().encode('abc'));
  const first = h.hex();
  assert.equal(h.hex(), first);
  assert.throws(() => h.update(new Uint8Array(1)), /after digest/);
});

test('a few megabytes, and how fast it is (printed, not asserted)', () => {
  const data = randomBytes(8 * 1024 * 1024);
  const t0 = performance.now();
  const mine = sha256Hex(data);
  const ms = performance.now() - t0;
  assert.equal(mine, reference(data));
  console.log(`# sha256.js: ${(data.length / 1e6 / (ms / 1000)).toFixed(0)} MB/s in Node ${process.version}`);
});
