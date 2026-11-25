// Pure helpers for the experimental sound check (no browser APIs, so they can be unit-tested):
//  - turning decoded samples into a small WAV file and a base64 string for the message to the service worker;
//  - WindowPlanner: when to start, finish or throw away a recording window.
//
// Why windows: the on-device model judges a short clip, not a stream. The player's sound is recorded in
// windows of a few seconds; each finished window is judged after it has already played, so a sound check can
// only react to the NEXT seconds (mute, pause), never prevent the first ones. plan.md section 3.10 says so.

export const SAMPLE_RATE = 16000;

export function rms(samples) {
  if (!samples || !samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

/** Average several channels into one. A single channel is returned as it is. */
export function mixToMono(channels) {
  if (channels.length === 1) return channels[0];
  const n = channels[0].length;
  const out = new Float32Array(n);
  for (const ch of channels) for (let i = 0; i < n; i++) out[i] += ch[i] / channels.length;
  return out;
}

/** 16-bit PCM, mono, little endian. */
export function encodeWav(samples, rate = SAMPLE_RATE) {
  const n = samples.length;
  const out = new Uint8Array(44 + n * 2);
  const v = new DataView(out.buffer);
  const put = (offset, text) => { for (let i = 0; i < text.length; i++) v.setUint8(offset + i, text.charCodeAt(i)); };
  put(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); put(8, 'WAVE');
  put(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  put(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), true);
  }
  return out;
}

/** Base64 of some bytes, in chunks so that long clips do not overflow the call stack. */
export function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** 83 -> "1:23" */
export function clock(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export const WINDOW_DEFAULTS = Object.freeze({
  windowSeconds: 8,   // [choice] long enough for a sentence, short enough to react
  minSeconds: 3,      // a window cut short by a pause is still judged if it got this far
  startAfter: 3,      // [choice] skip the first seconds: intros, and the player is still settling
  maxWindows: 150,    // per video
  maxJump: 3,         // seconds of disagreement between the clock and the video's time that mean "the user seeked"
});

/**
 * Decides, once per tick, what to do with the recorder. It owns no timers and no recorder.
 *   step({now, playing, eligible, mediaTime, rate}) -> 'start' | 'finish' | 'discard' | null
 * `eligible` is everything else that must hold (enabled, model available, no ad, captions not already covering it).
 */
export class WindowPlanner {
  constructor(options = {}) {
    this.o = { ...WINDOW_DEFAULTS, ...options };
    this.recording = false;
    this.startedAt = 0;
    this.startMedia = 0;
    this.finished = 0;   // windows handed on for judging
    this.discarded = 0;
  }

  reset() {
    this.recording = false;
    this.finished = 0;
    this.discarded = 0;
  }

  configure(options) {
    this.o = { ...this.o, ...options };
  }

  elapsed(now) {
    return this.recording ? (now - this.startedAt) / 1000 : 0;
  }

  step({ now, playing, eligible, mediaTime, rate = 1 }) {
    if (this.recording) {
      const seconds = (now - this.startedAt) / 1000;
      if (!playing || !eligible) return this.stop(seconds >= this.o.minSeconds ? 'finish' : 'discard');
      // media time should advance about rate * wall time; anything else is a jump (a seek)
      if (Math.abs((mediaTime - this.startMedia) - seconds * rate) > this.o.maxJump) return this.stop('discard');
      if (seconds >= this.o.windowSeconds) return this.stop('finish');
      return null;
    }
    if (!playing || !eligible) return null;
    if (this.finished >= this.o.maxWindows) return null;
    if (mediaTime < this.o.startAfter) return null;
    this.recording = true;
    this.startedAt = now;
    this.startMedia = mediaTime;
    return 'start';
  }

  stop(what) {
    this.recording = false;
    if (what === 'finish') this.finished++; else this.discarded++;
    return what;
  }
}
