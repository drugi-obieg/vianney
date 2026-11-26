// Sound check (experimental). Listens to the video's sound in short windows and asks Chrome's on-device
// model about each window.
//
// What it can and cannot do (plan.md section 3.10):
//  - a window is judged after it has played, so it can only react to what comes next: pause the video,
//    mute it until a window comes back clean, or show a label. It can never stop the first seconds;
//  - the model may be slower than the sound. At most two windows wait; older ones are dropped and counted,
//    so "checked" always means what it says;
//  - if the video has captions that were read, the subtitle rules already cover speech and this stays idle
//    (setting "only without captions");
//  - nothing is recorded to disk and nothing leaves the machine: the clip goes from the page to the service
//    worker to the browser's own model, and is dropped when the answer is back.

import { WindowPlanner, rms, encodeWav, bytesToBase64, clock } from '../core/audio.js';
import { listVerdict } from '../core/lists.js';
import { decodeToMono16k } from '../shared/decode.js';
import { setMuteLock, isMuteLocked } from './actions.js';

const TICK_MS = 400;
const SILENT_RMS = 0.003;       // [choice] a window quieter than this is silence: no model call
const MAX_PENDING = 2;          // windows waiting for the model; older ones are dropped
const MUTE_STALE_WINDOWS = 3;   // let go of a mute that no newer verdict has confirmed for this many windows
const TAG_MS = 7000;

export function pageVideoId() {
  const u = new URL(location.href);
  if (u.pathname.startsWith('/watch')) return u.searchParams.get('v');
  const m = u.pathname.match(/^\/shorts\/([\w-]{11})/);
  return m ? m[1] : null;
}

export function pageVideo() {
  const all = [...document.querySelectorAll('video')];
  return document.querySelector('video.html5-main-video') || all.find((v) => !v.paused) || all[0] || null;
}

function adShowing() {
  return !!document.querySelector('.html5-video-player.ad-showing');
}

/** A small label over the player, in its own shadow DOM so the page cannot restyle it. */
function showTag(text) {
  const host = document.createElement('div');
  host.dataset.vianneyUi = 'tag';
  const player = document.querySelector('#movie_player') || document.querySelector('video');
  const r = player ? player.getBoundingClientRect() : { top: 80, left: 20 };
  host.style.cssText = `position:fixed;z-index:2147483000;top:${Math.round(r.top + 10)}px;left:${Math.round(r.left + 10)}px;`;
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<style>.t{background:#7a1f2b;color:#fff;font:600 12px/1.3 system-ui,sans-serif;padding:5px 9px;border-radius:5px;max-width:28em}</style><div class="t"></div>';
  root.querySelector('.t').textContent = text;
  document.body.appendChild(host);
  setTimeout(() => host.remove(), TAG_MS);
  return host;
}

export class AudioGuard {
  /**
   * @param {{engine: object, log: Function, getSettings: Function,
   *          getContext: () => ({videoId: string, video: HTMLVideoElement, title?: string, channel?: string, captionsLoaded?: boolean}|null),
   *          warn: (top: object, text: string) => void, remember: (entry: object) => void}} deps
   */
  constructor({ engine, log, getSettings, getContext, warn, remember }) {
    this.engine = engine;
    this.log = log;
    this.getSettings = getSettings;
    this.getContext = getContext;
    this.warn = warn;
    this.remember = remember;
    this.planner = new WindowPlanner();
    this.timer = null;
    this.rec = null;
    this.stream = null;
    this.streamFor = null;
    this.pending = [];
    this.busy = false;
    this.videoId = null;
    this.index = 0;
    this.ignored = new Set();
    this.counts = this.freshCounts();
    this.last = null;
    this.lastMuteVerdictAt = 0;
    this.supported = typeof MediaRecorder !== 'undefined' && typeof HTMLMediaElement !== 'undefined' && typeof HTMLMediaElement.prototype.captureStream === 'function';
  }

  freshCounts() {
    return { judged: 0, flagged: 0, silent: 0, dropped: 0, errors: 0, decodeErrors: 0, captureErrors: 0 };
  }

  start() {
    this.timer = setInterval(() => this.tick(), TICK_MS);
    window.addEventListener('yt-navigate-start', () => this.newVideo(null));
  }

  active() {
    const s = this.getSettings();
    return !!(this.supported && s.enabled && s.media && s.media.enabled && s.media.audio.enabled && this.engine.mediaUsable('audio'));
  }

  /** Settings changed: stop what must stop. */
  refresh() {
    if (!this.active()) this.newVideo(this.videoId);
  }

  newVideo(id) {
    this.abortRecording();
    this.planner.reset();
    this.pending.length = 0;
    this.ignored.clear();
    this.counts = this.freshCounts();
    this.index = 0;
    this.last = null;
    this.releaseMute();
    this.videoId = id;
  }

  tick() {
    const s = this.getSettings();
    const ctx = this.getContext();
    if (!ctx || !ctx.videoId) { if (this.videoId) this.newVideo(null); return; }
    if (ctx.videoId !== this.videoId) this.newVideo(ctx.videoId);
    const video = ctx.video;
    const a = (s.media && s.media.audio) || {};
    const captionsCover = a.onlyWithoutCaptions !== false && !!ctx.captionsLoaded;
    const listed = listVerdict(s.lists, { id: ctx.videoId, channel: ctx.channel }) === 'allow';
    const eligible = this.active() && !!video && !adShowing() && !captionsCover && !listed;
    const playing = !!video && !video.paused && !video.ended && video.readyState >= 3;
    this.planner.configure({ windowSeconds: Number(a.windowSeconds) || 8, startAfter: Number(a.startAfterSeconds) || 0, maxWindows: Number(a.maxWindowsPerVideo) || 150 });
    const cmd = this.planner.step({ now: performance.now(), playing, eligible, mediaTime: video ? video.currentTime : 0, rate: video ? video.playbackRate || 1 : 1 });
    if (cmd === 'start') this.startRecording(video);
    else if (cmd === 'finish') this.finishRecording(true, video);
    else if (cmd === 'discard') this.finishRecording(false, video);
    this.releaseStaleMute((Number(a.windowSeconds) || 8) * MUTE_STALE_WINDOWS * 1000);
  }

  // ---------------------------------------------------------------- recording
  captureFor(video) {
    if (this.streamFor !== video || !this.stream || this.stream.getAudioTracks().every((t) => t.readyState === 'ended')) {
      this.stream = video.captureStream(); // once per element: every call would start another capture
      this.streamFor = video;
    }
    return this.stream;
  }

  startRecording(video) {
    try {
      const tracks = this.captureFor(video).getAudioTracks();
      if (!tracks.length) throw new Error('no audio track');
      const type = 'audio/webm;codecs=opus';
      const rec = new MediaRecorder(new MediaStream(tracks), MediaRecorder.isTypeSupported(type) ? { mimeType: type } : undefined);
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.start();
      this.rec = { rec, chunks, from: video.currentTime, videoId: this.videoId };
    } catch (e) {
      this.counts.captureErrors++;
      this.planner.stop('discard'); // the planner thinks it is recording; it is not
      this.rec = null;
    }
  }

  abortRecording() {
    const r = this.rec;
    this.rec = null;
    if (r) { r.rec.ondataavailable = null; try { r.rec.stop(); } catch (e) { /* already stopped */ } }
  }

  finishRecording(keep, video) {
    const r = this.rec;
    this.rec = null;
    if (!r) return;
    const stopped = new Promise((resolve) => { r.rec.onstop = resolve; });
    try { r.rec.stop(); } catch (e) { return; }
    if (!keep) return;
    const to = video ? video.currentTime : r.from;
    stopped.then(() => {
      if (r.videoId !== this.videoId) return;
      this.pending.push({ blob: new Blob(r.chunks, { type: 'audio/webm' }), from: r.from, to, index: this.index++, videoId: r.videoId });
      while (this.pending.length > MAX_PENDING) { this.pending.shift(); this.counts.dropped++; }
      this.pump();
    });
  }

  // ---------------------------------------------------------------- judging
  async pump() {
    if (this.busy) return;
    this.busy = true;
    try {
      while (this.pending.length) {
        const job = this.pending.shift();
        if (job.videoId !== this.videoId || !this.active()) continue;
        try { await this.analyse(job); } catch (e) { this.counts.errors++; console.warn('[vianney] sound check failed', e); }
      }
    } finally {
      this.busy = false;
    }
  }

  async analyse(job) {
    const s = this.getSettings();
    let samples;
    try {
      samples = await decodeToMono16k(job.blob, (Number(s.media.audio.windowSeconds) || 8) + 2);
    } catch (e) {
      this.counts.decodeErrors++;
      return;
    }
    if (rms(samples) < SILENT_RMS) { this.counts.silent++; this.afterVerdict([], job); return; }
    const wav = bytesToBase64(encodeWav(samples));
    const verdict = await this.engine.evaluateMedia('audio', { id: job.videoId, window: job.index, media: { wav } });
    if (job.videoId !== this.videoId) return;
    this.counts.judged++;
    this.apply(verdict, job);
  }

  apply(verdict, job) {
    const failed = verdict.results.filter((r) => r.modelError);
    if (failed.length && failed.length === verdict.results.length) this.counts.errors++;
    const flagged = verdict.flagged;
    const when = `${clock(job.from)} to ${clock(job.to)}`;
    const uncertain = verdict.results.filter((r) => r.uncertain).map((r) => r.ruleId);
    this.last = { window: job.index, when, ps: verdict.ps, flagged: flagged.map((r) => r.ruleId) };
    if (flagged.length || uncertain.length || Object.keys(verdict.ps).length || failed.length) {
      const ctx = this.getContext() || {};
      this.log({
        surface: 'audio', id: job.videoId, title: ctx.title || '', channel: ctx.channel || '', ps: verdict.ps,
        flagged: flagged.map((r) => r.ruleId), uncertain, action: flagged.length ? verdict.action : null, via: flagged.length ? flagged[0].via : null,
        hits: flagged.length ? [{ rule: 'audio', hits: [`window ${when}`] }] : [], error: failed.length ? failed[0].modelError : undefined,
      });
    }
    if (flagged.length) {
      this.counts.flagged++;
      if (this.getSettings().media.rememberFlagged !== false) {
        this.remember({ id: job.videoId, kind: 'audio', by: flagged.map((r) => ({ rule: r.ruleId, p: r.p })) });
      }
    }
    this.afterVerdict(flagged, job);
  }

  /** Act on the flagged rules of one window; an empty list means the window was clean. */
  afterVerdict(flagged, job) {
    const ctx = this.getContext();
    const video = ctx && ctx.video;
    const when = `${clock(job.from)} to ${clock(job.to)}`;
    const mutes = flagged.filter((r) => r.action === 'mute-next');
    if (mutes.length) { setMuteLock(video, 'audio', true); this.lastMuteVerdictAt = performance.now(); } else this.releaseMute();

    const pausers = flagged.filter((r) => r.action === 'pause-overlay' && !this.ignored.has(r.ruleId));
    if (pausers.length) {
      for (const r of pausers) this.ignored.add(r.ruleId); // "Watch anyway" means: do not ask again for this rule in this video
      const top = pausers[0];
      this.warn(top, `Audio flagged by “${top.title}” (${when}): ${Math.round(top.p * 100)}% confidence (threshold ${Math.round(top.flagAt * 100)}%).`);
    }
    const labels = flagged.filter((r) => r.action === 'label');
    if (labels.length) showTag(`Audio flagged: ${labels[0].title} (${when})`);
  }

  releaseMute() {
    const ctx = this.getContext();
    if (ctx && ctx.video) setMuteLock(ctx.video, 'audio', false);
  }

  /** A mute that no newer verdict confirms is let go: when the model falls behind, silence must not last for ever. */
  releaseStaleMute(afterMs) {
    const ctx = this.getContext();
    if (!ctx || !ctx.video || !isMuteLocked(ctx.video, 'audio')) return;
    if (performance.now() - this.lastMuteVerdictAt > afterMs) setMuteLock(ctx.video, 'audio', false);
  }

  snapshot() {
    const ctx = this.getContext();
    return {
      supported: this.supported, active: this.active(), videoId: this.videoId, recording: !!this.rec,
      windows: this.planner.finished, discarded: this.planner.discarded, pending: this.pending.length,
      counts: { ...this.counts }, last: this.last, muted: !!(ctx && ctx.video && isMuteLocked(ctx.video, 'audio')),
      ignored: [...this.ignored],
    };
  }
}
