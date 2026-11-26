// Watch page: check the video's own details, show a warning when a rule says so, and filter the
// subtitles (mute a word, skip a passage, mask words in the visible captions).

import { parseJson3, buildSpans, findActive } from '../core/captions.js';
import { listVerdict } from '../core/lists.js';
import { setMuteLock } from './actions.js';

const getVideo = () => document.querySelector('video.html5-main-video') || document.querySelector('video');
const currentVideoId = () => new URL(location.href).searchParams.get('v');

/** Plays the planned spans: mute during a word, jump over a passage. */
export class SpanScheduler {
  constructor(video, spans) {
    this.video = video;
    this.spans = spans;
    this.muted = false;
    this.raf = 0;
    this.skips = 0;
    this.mutes = 0;
  }

  start() {
    const loop = () => { this.tick(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }

  tick() {
    const v = this.video;
    if (!v) return;
    const s = findActive(this.spans, v.currentTime);
    if (s && s.action === 'skip-segment') {
      v.currentTime = s.end + 0.05;
      this.skips++;
    }
    const wantMute = !!s && s.action === 'mute-word';
    if (wantMute && !this.muted) {
      setMuteLock(v, 'subtitles', true);
      this.muted = true;
      this.mutes++;
    } else if (!wantMute && this.muted) {
      setMuteLock(v, 'subtitles', false);
      this.muted = false;
    }
  }

  stop() {
    cancelAnimationFrame(this.raf);
    if (this.muted && this.video) setMuteLock(this.video, 'subtitles', false);
    this.muted = false;
  }
}

/** Mask flagged words in the caption text that YouTube draws over the video. */
function startCaptionMasking(getEngine, getSettings) {
  const sel = '.ytp-caption-segment';
  const mask = () => {
    document.querySelectorAll(sel).forEach((node) => {
      const text = node.textContent || '';
      if (!text || node.dataset.vianneyMasked === text) return;
      if (!getSettings().subtitles.maskVisible) return;
      const out = getEngine().maskText(text);
      if (out !== text) node.textContent = out;
      node.dataset.vianneyMasked = out;
    });
  };
  const obs = new MutationObserver(mask);
  obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  mask();
  return () => obs.disconnect();
}

function createOverlay({ title, reason, onWatch, onLeave }) {
  const host = document.createElement('div');
  host.dataset.vianneyUi = 'overlay';
  host.style.cssText = 'position:fixed;z-index:2147483000;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      .box { box-sizing:border-box; width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center;
             gap:14px; padding:24px; text-align:center; background:#14110d; color:#efe7d6; font:16px/1.5 Georgia, serif; }
      h2 { margin:0; font-size:22px; font-weight:600; }
      p { margin:0; max-width:34em; color:#cbbfa8; }
      .tag { font:600 11px system-ui, sans-serif; letter-spacing:.1em; text-transform:uppercase; color:#e3a0a5; }
      .row { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:6px; }
      button { font:600 14px system-ui, sans-serif; padding:9px 16px; border-radius:6px; border:1px solid #e3a0a5; background:transparent; color:#e3a0a5; cursor:pointer; }
      button.primary { background:#e3a0a5; color:#1a1210; }
    </style>
    <div class="box" role="alertdialog" aria-label="Vianney Content Blocker">
      <div class="tag">Vianney Content Blocker</div>
      <h2></h2>
      <p class="why"></p>
      <div class="row"><button class="primary leave">Leave</button><button class="watch">Watch anyway</button></div>
    </div>`;
  root.querySelector('h2').textContent = title;
  root.querySelector('.why').textContent = reason;
  root.querySelector('.leave').addEventListener('click', onLeave);
  root.querySelector('.watch').addEventListener('click', onWatch);
  return host;
}

export class WatchGuard {
  /**
   * @param {{engine: object, log: Function, getSettings: Function}} deps
   */
  constructor({ engine, log, getSettings }) {
    this.engine = engine;
    this.log = log;
    this.getSettings = getSettings;
    this.video = null;       // details of the current video
    this.tokens = null;      // caption tokens with times
    this.captionInfo = null;
    this.scheduler = null;
    this.overlay = null;
    this.stopMasking = null;
    this.decisions = [];
    this.captionStatus = 'none';
    this.state = { metaChecked: false };
  }

  start() {
    window.addEventListener('message', (e) => {
      if (e.source !== window || !e.data || e.data.source !== 'vianney-main') return;
      if (e.data.type === 'video') this.onVideo(e.data.video);
      else if (e.data.type === 'captions') this.onCaptions(e.data);
    });
    window.addEventListener('yt-navigate-start', () => this.reset());
    window.postMessage({ source: 'vianney-iso', type: 'hello' }, location.origin); // ask the page hook to repeat the video details
    // fallback for pages where the main-world hook has nothing: read the meta tags
    setTimeout(() => this.metaFallback(), 2500);
    window.addEventListener('yt-navigate-finish', () => setTimeout(() => this.metaFallback(), 2500));
    this.stopMasking = startCaptionMasking(() => this.engine, this.getSettings);
  }

  /** Record what happened to the captions of the current video, for the settings page. */
  setStatus(status, extra = {}) {
    this.captionStatus = status;
    try {
      chrome.storage.local.set({
        captionDiag: {
          t: Date.now(), status, videoId: this.video ? this.video.id : currentVideoId(), title: this.video ? this.video.title : '',
          lang: this.captionInfo ? this.captionInfo.lang : null, kind: this.captionInfo ? this.captionInfo.kind : null,
          words: this.tokens ? this.tokens.length : 0, flagged: this.decisions.length, ...extra,
        },
      });
    } catch (e) { /* extension reloaded */ }
  }

  reset() {
    this.video = null;
    this.listed = null;
    this.tokens = null;
    this.decisions = [];
    this.captionStatus = 'none';
    this.state = { metaChecked: false };
    if (this.scheduler) { this.scheduler.stop(); this.scheduler = null; }
    this.removeOverlay();
  }

  metaFallback() {
    if (this.video || !location.pathname.startsWith('/watch')) return;
    const id = currentVideoId();
    if (!id) return;
    const meta = (n) => (document.querySelector(`meta[name="${n}"]`) || {}).content || '';
    const author = document.querySelector('[itemprop="author"] link[itemprop="name"]');
    this.onVideo({ id, title: meta('title') || document.title, author: (author && author.content) || '', description: meta('description'), keywords: meta('keywords') });
  }

  async onVideo(v) {
    if (!v || v.id !== currentVideoId()) return;
    if (this.video && this.video.id === v.id && this.state.metaChecked) return;
    this.video = v;
    this.state.metaChecked = true;
    const s = this.getSettings();
    if (!s.enabled) return;
    this.listed = listVerdict(s.lists, { id: v.id, channel: v.author });
    if (this.listed === 'allow') return; // on the allow list: no check at all, not even of the subtitles
    if (this.listed === 'deny') {
      this.log({ surface: 'watch-meta', id: v.id, title: v.title, channel: v.author, ps: {}, flagged: [], uncertain: [], action: 'warn-overlay', via: 'list' });
      this.showWarning({ title: 'Blocked by you', p: 1, flagAt: 1 }, 'This video or its channel is on your block list.');
      return;
    }
    if (s.subtitles && s.subtitles.autoCaptions) this.enableCaptionsSoon();
    if (s.surfaces.watchMeta !== false) {
      const verdict = await this.engine.evaluate({ title: v.title, channel: v.author, description: v.description, keywords: v.keywords }, 'watch-meta');
      const top = verdict.top;
      if (top || Object.keys(verdict.ps).length) {
        this.log({
          surface: 'watch-meta', id: v.id, title: v.title, channel: v.author, ps: verdict.ps,
          flagged: verdict.flagged.map((r) => r.ruleId), uncertain: verdict.results.filter((r) => r.uncertain).map((r) => r.ruleId),
          action: top ? verdict.action : null, via: top ? top.via : null,
        });
      }
      if (top && verdict.action === 'warn-overlay') this.showWarning(top);
    }
    if (this.tokens) this.planSubtitles(); // captions arrived before the details
  }

  showWarning(top, reason) {
    const video = getVideo();
    if (video) video.pause();
    this.removeOverlay();
    const place = () => {
      const player = document.querySelector('#movie_player') || document.querySelector('video');
      if (!player || !this.overlay) return;
      const r = player.getBoundingClientRect();
      Object.assign(this.overlay.style, { top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px' });
    };
    this.overlay = createOverlay({
      title: top.title,
      reason: reason || `Flagged by “${top.title}” at ${Math.round(top.p * 100)}% confidence (threshold ${Math.round(top.flagAt * 100)}%).`,
      onWatch: () => { this.removeOverlay(); const v = getVideo(); if (v) v.play().catch(() => {}); },
      onLeave: () => { this.removeOverlay(); if (history.length > 1) history.back(); else location.href = 'https://www.youtube.com/'; },
    });
    document.body.appendChild(this.overlay);
    place();
    this.overlayTimer = setInterval(place, 400);
  }

  removeOverlay() {
    clearInterval(this.overlayTimer);
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
  }

  enableCaptionsSoon() {
    let tries = 0;
    const attempt = () => {
      const btn = document.querySelector('.ytp-subtitles-button');
      if (btn && btn.getAttribute('aria-pressed') === 'false' && btn.offsetParent !== null && btn.getAttribute('aria-disabled') !== 'true') {
        btn.click();
        this.setStatus('requested');
        return;
      }
      if (btn && btn.getAttribute('aria-pressed') === 'true') return;
      if (++tries < 20) setTimeout(attempt, 750);
      else if (this.captionStatus === 'none') this.setStatus('unavailable');
    };
    setTimeout(attempt, 1200);
  }

  onCaptions(msg) {
    const id = msg.info && msg.info.v;
    if (id && id !== currentVideoId()) return;
    if (msg.empty || !msg.body) { this.setStatus('empty'); return; }
    let parsed;
    try { parsed = parseJson3(msg.body); } catch (e) { this.setStatus('unreadable'); return; }
    if (!parsed.tokens.length) return;
    this.tokens = parsed.tokens;
    this.captionInfo = { ...msg.info, approx: parsed.approx, words: parsed.tokens.length };
    this.setStatus('loaded');
    this.planSubtitles();
  }

  /** Evaluate the caption tokens and (re)start the scheduler. Safe to call again after a settings change. */
  async planSubtitles() {
    if (!this.tokens) return;
    const s = this.getSettings();
    if (!s.enabled || s.surfaces.subtitles === false || this.listed === 'allow') return;
    const decisions = await this.engine.evaluateSubtitles(this.tokens);
    this.decisions = decisions;
    if (this.captionStatus === 'loaded') this.setStatus('loaded');
    const spans = buildSpans(decisions, { pre: s.subtitles.mutePre, post: s.subtitles.mutePost });
    if (this.scheduler) this.scheduler.stop();
    const video = getVideo();
    if (video && spans.length) {
      this.scheduler = new SpanScheduler(video, spans);
      this.scheduler.start();
    } else {
      this.scheduler = null;
      // the player may not have created its <video> element yet: try again shortly (bounded)
      if (spans.length && (this.attachTries = (this.attachTries || 0) + 1) <= 20) {
        clearTimeout(this.attachTimer);
        this.attachTimer = setTimeout(() => this.planSubtitles(), 700);
      }
    }
    if (video) this.attachTries = 0;
    this.spans = spans;
    if (decisions.length) {
      const ps = {};
      for (const d of decisions) ps[d.ruleId] = Math.max(ps[d.ruleId] || 0, d.p);
      this.log({
        surface: 'subtitles', id: this.video ? this.video.id : currentVideoId(), title: this.video ? this.video.title : '', channel: this.video ? this.video.author : '',
        ps, flagged: [...new Set(decisions.map((d) => d.ruleId))], uncertain: [], action: [...new Set(decisions.map((d) => d.action))].join(','), via: decisions[0].via,
        hits: [{ rule: 'subtitles', hits: decisions.slice(0, 12).map((d) => `${d.text} @${(d.start || 0).toFixed(1)}s`) }],
      });
    }
  }

  settingsChanged() {
    if (this.tokens) this.planSubtitles();
  }

  /** Snapshot for the options page and the end-to-end tests. */
  snapshot() {
    return {
      videoId: this.video && this.video.id,
      captionStatus: this.captionStatus,
      captionInfo: this.captionInfo,
      words: this.tokens ? this.tokens.length : 0,
      decisions: this.decisions.map((d) => ({ rule: d.ruleId, action: d.action, text: d.text, start: d.start, end: d.end, p: d.p, via: d.via })),
      spans: (this.spans || []).map((x) => ({ action: x.action, start: x.start, end: x.end })),
      muted: this.scheduler ? this.scheduler.muted : false,
      mutes: this.scheduler ? this.scheduler.mutes : 0,
      skips: this.scheduler ? this.scheduler.skips : 0,
      overlay: !!this.overlay,
    };
  }
}

