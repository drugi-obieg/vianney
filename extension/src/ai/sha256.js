// SHA-256 that can be fed piece by piece, in plain JavaScript.
//
// Why: the model files are checked against pinned SHA-256 values while they are written to disk. WebCrypto's `digest` takes the whole input at
// once ("this API does not support streaming input"), which would mean reading a 335 MB file into memory again after the download.
// The constants are derived from the first 64 primes with exact integer arithmetic (the fractional parts of their cube roots and of the square
// roots of the first 8), so there is no table to mistype; tests/kev-sha256.test.js compares the result with Node's own implementation.

function primes(n) {
  const out = [];
  for (let k = 2; out.length < n; k++) if (out.every((p) => k % p)) out.push(k);
  return out;
}

/** floor of the k-th root of x (BigInt), by Newton's method */
function iroot(x, k) {
  if (x < 2n) return x;
  const K = BigInt(k);
  let r = 1n << BigInt(Math.ceil(x.toString(2).length / k));
  for (;;) {
    const next = ((K - 1n) * r + x / r ** (K - 1n)) / K;
    if (next >= r) return r;
    r = next;
  }
}

const P = primes(64);
const MASK = (1n << 32n) - 1n;
const K = new Uint32Array(P.map((p) => Number(iroot(BigInt(p) << 96n, 3) & MASK)));
const H0 = new Uint32Array(P.slice(0, 8).map((p) => Number(iroot(BigInt(p) << 64n, 2) & MASK)));

export class Sha256 {
  constructor() {
    this.h = new Uint32Array(H0);
    this.block = new Uint8Array(64);
    this.filled = 0;     // bytes waiting in `block`
    this.length = 0;     // bytes fed so far
    this.w = new Uint32Array(64);
    this.done = false;
  }

  /** @param {Uint8Array} data */
  update(data) {
    if (this.done) throw new Error('SHA-256: update after digest');
    let i = 0;
    const n = data.length;
    this.length += n;
    if (this.filled) {
      const take = Math.min(64 - this.filled, n);
      this.block.set(data.subarray(0, take), this.filled);
      this.filled += take;
      i = take;
      if (this.filled === 64) { this._compress(this.block, 0); this.filled = 0; }
    }
    for (; i + 64 <= n; i += 64) this._compress(data, i);
    if (i < n) { this.block.set(data.subarray(i), 0); this.filled = n - i; }
    return this;
  }

  _compress(buf, off) {
    const w = this.w;
    for (let t = 0; t < 16; t++, off += 4) w[t] = (buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3];
    for (let t = 16; t < 64; t++) {
      const x = w[t - 15];
      const y = w[t - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    const h = this.h;
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[t] + w[t]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }

  /** The digest as 64 lowercase hex characters. The hasher cannot be used afterwards. */
  hex() {
    if (!this.done) {
      const bits = this.length * 8;
      const pad = new Uint8Array(((this.filled < 56 ? 56 : 120) - this.filled) + 8);
      pad[0] = 0x80;
      const view = new DataView(pad.buffer);
      view.setUint32(pad.length - 8, Math.floor(bits / 0x100000000));
      view.setUint32(pad.length - 4, bits >>> 0);
      const length = this.length;
      this.update(pad);
      this.length = length;
      this.done = true;
    }
    return Array.from(this.h, (x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }
}

/** SHA-256 of one piece of data, as hex. */
export function sha256Hex(data) {
  return new Sha256().update(data).hex();
}
