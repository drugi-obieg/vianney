import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rms, mixToMono, encodeWav, bytesToBase64, clock, WindowPlanner, SAMPLE_RATE } from '../extension/src/core/audio.js';

test('rms of silence is 0 and of a full-scale square wave is 1', () => {
  assert.equal(rms(new Float32Array(100)), 0);
  assert.equal(rms(new Float32Array(0)), 0);
  assert.ok(Math.abs(rms(Float32Array.from({ length: 100 }, (_, i) => (i % 2 ? 1 : -1))) - 1) < 1e-6);
});

test('stereo is averaged to mono, mono is passed through', () => {
  const l = Float32Array.from([1, 0, -1]);
  const r = Float32Array.from([0, 1, -1]);
  assert.deepEqual([...mixToMono([l, r])], [0.5, 0.5, -1]);
  assert.equal(mixToMono([l]), l);
});

test('the WAV file has a correct 16-bit mono PCM header and clipped samples', () => {
  const wav = encodeWav(Float32Array.from([0, 1, -1, 2, -2, 0.5]), SAMPLE_RATE);
  const v = new DataView(wav.buffer);
  const tag = (o) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  assert.equal(wav.length, 44 + 12);
  assert.equal(tag(0), 'RIFF');
  assert.equal(tag(8), 'WAVE');
  assert.equal(tag(12), 'fmt ');
  assert.equal(v.getUint32(4, true), 36 + 12);
  assert.equal(v.getUint16(20, true), 1);          // PCM
  assert.equal(v.getUint16(22, true), 1);          // mono
  assert.equal(v.getUint32(24, true), 16000);      // rate
  assert.equal(v.getUint32(28, true), 32000);      // bytes per second
  assert.equal(v.getUint16(34, true), 16);         // bits
  assert.equal(tag(36), 'data');
  assert.equal(v.getUint32(40, true), 12);
  const s = [...Array(6)].map((_, i) => v.getInt16(44 + i * 2, true));
  assert.deepEqual(s, [0, 32767, -32768, 32767, -32768, 16384]);
});

test('base64 round-trips a clip that is longer than one chunk', () => {
  const bytes = Uint8Array.from({ length: 70000 }, (_, i) => (i * 31) & 255);
  const back = Uint8Array.from(Buffer.from(bytesToBase64(bytes), 'base64'));
  assert.equal(back.length, bytes.length);
  assert.ok(back.every((b, i) => b === bytes[i]));
});

test('clock formats minutes and seconds', () => {
  assert.equal(clock(0), '0:00');
  assert.equal(clock(83.4), '1:23');
  assert.equal(clock(3600), '60:00');
  assert.equal(clock(-5), '0:00');
});

// ---------------------------------------------------------------- the window planner
const tick = (p, over) => p.step({ now: 0, playing: true, eligible: true, mediaTime: 10, rate: 1, ...over });

test('it waits until playback has passed the start offset, then starts a window', () => {
  const p = new WindowPlanner({ windowSeconds: 8, startAfter: 3 });
  assert.equal(tick(p, { mediaTime: 1 }), null);
  assert.equal(tick(p, { mediaTime: 3.2, now: 1000 }), 'start');
  assert.equal(p.recording, true);
});

test('a window finishes once enough sound was recorded, and the next one starts at once', () => {
  const p = new WindowPlanner({ windowSeconds: 8 });
  assert.equal(tick(p, { now: 0, mediaTime: 10 }), 'start');
  assert.equal(tick(p, { now: 4000, mediaTime: 14 }), null);
  assert.equal(tick(p, { now: 8000, mediaTime: 18 }), 'finish');
  assert.equal(p.finished, 1);
  assert.equal(tick(p, { now: 8400, mediaTime: 18.4 }), 'start');
});

test('a pause after a few seconds still judges the partial window; a very short one is dropped', () => {
  const p = new WindowPlanner({ windowSeconds: 8, minSeconds: 3 });
  tick(p, { now: 0 });
  assert.equal(tick(p, { now: 4000, mediaTime: 14, playing: false }), 'finish');
  tick(p, { now: 5000 });
  assert.equal(tick(p, { now: 6000, mediaTime: 11, playing: false }), 'discard');
  assert.equal(p.finished, 1);
  assert.equal(p.discarded, 1);
});

test('a seek throws the window away', () => {
  const p = new WindowPlanner();
  tick(p, { now: 0, mediaTime: 10 });
  assert.equal(tick(p, { now: 2000, mediaTime: 95 }), 'discard');
});

test('at 1.5x speed the media clock runs faster than the wall clock and that is not a seek', () => {
  const p = new WindowPlanner({ windowSeconds: 8 });
  tick(p, { now: 0, mediaTime: 10, rate: 1.5 });
  assert.equal(tick(p, { now: 6000, mediaTime: 19, rate: 1.5 }), null);
  assert.equal(tick(p, { now: 8000, mediaTime: 22, rate: 1.5 }), 'finish');
});

test('when something else stops being true (an ad, captions already cover it) the window ends', () => {
  const p = new WindowPlanner({ windowSeconds: 8 });
  tick(p, { now: 0 });
  assert.equal(tick(p, { now: 1000, mediaTime: 11, eligible: false }), 'discard');
  assert.equal(tick(p, { now: 2000, mediaTime: 12, eligible: false }), null);
});

test('no more than maxWindows windows are started for one video', () => {
  const p = new WindowPlanner({ windowSeconds: 1, maxWindows: 2, minSeconds: 1 });
  let t = 0;
  let mediaTime = 10;
  const run = () => { const a = tick(p, { now: t, mediaTime }); t += 1000; mediaTime += 1; return a; };
  const seen = [];
  for (let i = 0; i < 12; i++) seen.push(run());
  assert.equal(seen.filter((x) => x === 'start').length, 2);
  assert.equal(p.finished, 2);
});
