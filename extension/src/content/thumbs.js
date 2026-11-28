// Thumbnail check (experimental). Asks Chrome's on-device model about the picture of every video card.
//
// How it works, and what it costs:
//  - the picture is fetched by the service worker from YouTube's image server and put to the model together
//    with the question of each picture rule (rules with `where: thumbnail`); see core/engine.js evaluateMedia;
//  - every rule asks one question per wording ("votes" setting) for every thumbnail, so this is slow: cards near
//    the screen are done first, a page has a budget, and verdicts are remembered for 30 days;
//  - while a thumbnail is unchecked it can be kept invisible ("hold"), but it is shown after a while when the
//    model is too slow, and always when the model is unavailable or a check fails. A blocker that breaks the page
//    would be switched off, and showing a picture unchecked is the failure we can recover from;
//  - lists come first: an allowed video or channel is never judged, a blocked one is hidden by the feed filter.

import { extractMeta } from './discover.js';
import { applyThumbAction, clearThumb, markThumbsSeen, THUMB_IMG } from './actions.js';
import { listVerdict } from '../core/lists.js';

const CONCURRENCY = 2;
const NEAR_MARGIN = '700px 0px';
const STRAY_MS = 2500; // a thumbnail outside any card that the feed filter found: nothing will ever judge it

export class ThumbnailGuard {
  /**
   * @param {{engine: object, log: Function, getSettings: Function, rescan?: Function}} deps
   */
  constructor({ engine, log, getSettings, rescan }) {
    this.engine = engine;
    this.log = log;
    this.getSettings = getSettings;
    this.rescan = rescan || (() => {});
    this.known = new WeakMap();     // card element -> {id, state, queuedAt, meta, verdict}
    this.cards = new Set();         // the same elements, to be able to walk them
    this.queue = [];
    this.running = 0;
    this.counts = { checked: 0, flagged: 0, errors: 0, skipped: 0, listed: 0 };
    this.io = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => this.onIntersect(entries), { rootMargin: NEAR_MARGIN })
      : null;
    this.srcObserver = null;
    this.timer = null;
  }

  start() {
    this.srcObserver = new MutationObserver((records) => this.onSrc(records));
    this.srcObserver.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['src'] });
    window.addEventListener('yt-navigate-finish', () => { this.counts.checked = 0; });
    this.timer = setInterval(() => this.sweep(), 1000);
    this.refresh();
  }

  active() {
    const s = this.getSettings();
    return !!(s.enabled && s.media && s.media.enabled && s.media.thumbnails.enabled && this.engine.mediaUsable('image'));
  }

  holdOn() {
    return this.active() && this.getSettings().media.thumbnails.hold !== false;
  }

  syncHold() {
    const on = this.holdOn();
    document.documentElement.toggleAttribute('data-vianney-hold', on);
    if (!on) for (const el of this.cards) el.removeAttribute('data-vianney-pending');
  }

  /** Settings or availability changed: apply again from what is known. */
  refresh() {
    this.syncHold();
    if (!this.active()) { this.clearAll(); return; }
    for (const el of this.cards) {
      const k = this.known.get(el);
      if (!k || k.state !== 'done') continue;
      // verdicts are made again from the scores the engine remembers, so a moved slider takes effect at once
      if (k.verdict) this.reevaluate(el, k).catch(() => {});
      else k.state = 'new'; // it was let through without a verdict (a list, the page budget): look again
    }
    this.pump();
    this.rescan();
  }

  /** What the user's lists say about this card now. They always win over the model. */
  listed(k) {
    return listVerdict(this.getSettings().lists, { id: k.id, channel: k.meta.channel, handle: k.meta.handle, channelId: k.meta.channelId });
  }

  async reevaluate(el, k) {
    if (this.listed(k)) { this.release(el, k); return; }
    const verdict = await this.engine.evaluateMedia('thumbnail', { id: k.id, media: { videoId: k.id } });
    if (this.known.get(el) !== k || this.listed(k)) return;
    k.verdict = verdict;
    this.settle(el, k);
  }

  clearAll() {
    this.queue.length = 0;
    for (const el of this.cards) {
      clearThumb(el);
      el.querySelectorAll(THUMB_IMG).forEach((img) => { delete img.dataset.vianneySeen; delete img.dataset.vianneySeenSrc; });
    }
    for (const el of this.cards) el.removeAttribute('data-vianney-pending');
    this.cards.clear();
    this.known = new WeakMap();
    if (this.io) this.io.disconnect();
  }

  /** Called by the feed filter with every card it finds, on every scan. */
  observe(cards) {
    this.syncHold();
    if (!this.active()) return;
    for (const card of cards) {
      let k = this.known.get(card.el);
      if (k && k.id !== card.id) { clearThumb(card.el); this.cards.delete(card.el); k = null; } // YouTube re-used the element
      if (!k) {
        k = { id: card.id, state: 'new', queuedAt: 0, meta: extractMeta(card), verdict: null };
        this.known.set(card.el, k);
        this.cards.add(card.el);
        // while the picture is unchecked the hover preview must not show the video either (see preview.js)
        if (this.holdOn()) card.el.setAttribute('data-vianney-pending', '');
      }
      if (k.state === 'done') this.settle(card.el, k);
      if (k.state === 'new') {
        if (this.io && this.getSettings().media.thumbnails.nearViewOnly !== false) { k.state = 'waiting'; this.io.observe(card.el); }
        else this.enqueue(card.el, k);
      }
    }
    this.pump();
  }

  enqueue(el, k) {
    k.state = 'queued';
    k.queuedAt = performance.now();
    this.queue.push(el);
  }

  onIntersect(entries) {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      this.io.unobserve(e.target);
      const k = this.known.get(e.target);
      if (k && k.state === 'waiting') this.enqueue(e.target, k);
    }
    this.pump();
  }

  /** A thumbnail's address changed (YouTube re-used the picture element): it has to be checked again. */
  onSrc(records) {
    let changed = false;
    for (const r of records) {
      const img = r.target;
      if (!img || img.nodeType !== 1 || !img.dataset || img.dataset.vianneySeen === undefined) continue;
      if (img.dataset.vianneySeenSrc !== img.getAttribute('src')) {
        delete img.dataset.vianneySeen;
        delete img.dataset.vianneySeenSrc;
        changed = true;
      }
    }
    if (changed) this.rescan();
  }

  nextCard() {
    this.queue = this.queue.filter((el) => el.isConnected); // YouTube drops and re-creates cards while scrolling
    // cards nearest to the top of the screen first, those already scrolled past last
    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < this.queue.length; i++) {
      const r = this.queue[i].getBoundingClientRect();
      const score = r.bottom < 0 ? 1e6 - r.bottom : r.top;
      if (score < bestScore) { bestScore = score; best = i; }
    }
    return best < 0 ? null : this.queue.splice(best, 1)[0];
  }

  pump() {
    while (this.running < CONCURRENCY && this.queue.length && this.active()) {
      const el = this.nextCard();
      if (!el) break;
      this.running++;
      this.judge(el).catch((e) => console.warn('[vianney] thumbnail check failed', e)).finally(() => { this.running--; this.pump(); });
    }
  }

  async judge(el) {
    const k = this.known.get(el);
    if (!k || k.state !== 'queued') return;
    k.state = 'judging';
    const s = this.getSettings();
    if (this.listed(k)) { this.counts.listed++; this.release(el, k); return; }
    if (this.counts.checked >= (Number(s.media.thumbnails.maxPerPage) || 60)) { this.counts.skipped++; this.release(el, k); return; }
    this.counts.checked++;
    const verdict = await this.engine.evaluateMedia('thumbnail', { id: k.id, media: { videoId: k.id } });
    if (this.known.get(el) !== k) return; // the element was re-used meanwhile
    if (this.listed(k)) { this.release(el, k); return; } // the user listed it while the model was thinking
    k.verdict = verdict;
    k.state = 'done';
    this.settle(el, k);
    this.report(k, verdict);
  }

  /** Show the thumbnail again without a verdict (list entry, budget used up, or no way to judge). */
  release(el, k) {
    k.state = 'done';
    k.verdict = null;
    el.removeAttribute('data-vianney-pending');
    clearThumb(el);
    markThumbsSeen(el);
  }

  /** Apply a finished verdict to the card. */
  settle(el, k) {
    const v = k.verdict;
    el.removeAttribute('data-vianney-pending');
    if (v && v.top && v.action) {
      applyThumbAction(el, v.action, `Image: ${v.top.title}`, { revealed: !!k.revealed, onToggle: (shown) => { k.revealed = shown; } });
    } else {
      k.revealed = false;
      clearThumb(el);
      markThumbsSeen(el);
    }
  }

  report(k, verdict) {
    const top = verdict.top;
    const failed = verdict.results.filter((r) => r.modelError);
    if (top) this.counts.flagged++;
    else if (failed.length === verdict.results.length && failed.length) this.counts.errors++;
    const uncertain = verdict.results.filter((r) => r.uncertain).map((r) => r.ruleId);
    if (top || uncertain.length || Object.keys(verdict.ps).length || failed.length) {
      this.log({
        surface: 'thumbnail', id: k.id, title: k.meta.title, channel: k.meta.channel, ps: verdict.ps,
        flagged: verdict.flagged.map((r) => r.ruleId), uncertain, action: top ? verdict.action : null, via: top ? top.via : null,
        error: failed.length ? failed[0].modelError : undefined,
      });
    }
  }

  /** Once a second: let go of thumbnails that will not be judged, or have waited too long. */
  sweep() {
    if (!document.documentElement.hasAttribute('data-vianney-hold')) return;
    const holdMs = (Number(this.getSettings().media.thumbnails.holdSeconds) || 0) * 1000;
    const now = performance.now();
    for (const img of document.querySelectorAll(THUMB_IMG.split(', ').map((x) => x + ':not([data-vianney-seen])').join(', '))) {
      let el = img.parentElement;
      let k = null;
      while (el && !(k = this.known.get(el))) el = el.parentElement;
      let release = false;
      if (!k) {
        const first = Number(img.dataset.vianneyFirst) || 0;
        if (!first) img.dataset.vianneyFirst = String(now); else release = now - first > STRAY_MS;
      } else if (k.state === 'done') release = true;
      else if (k.state === 'queued' || k.state === 'judging') release = holdMs > 0 && now - k.queuedAt > holdMs;
      // 'waiting' (not near the screen yet) and 'new' stay hidden: nobody sees them
      if (release) {
        img.dataset.vianneySeen = '1';
        img.dataset.vianneySeenSrc = img.getAttribute('src') || '';
        delete img.dataset.vianneyFirst;
        if (el && k) el.removeAttribute('data-vianney-pending'); // shown unchecked after the wait, so is the preview
      }
    }
  }

  snapshot() {
    const states = [];
    for (const el of this.cards) {
      const k = this.known.get(el);
      if (k) states.push({ id: k.id, state: k.state, thumb: el.dataset.vianneyThumb || null, ps: k.verdict ? k.verdict.ps : null });
    }
    return {
      active: this.active(), hold: document.documentElement.hasAttribute('data-vianney-hold'),
      counts: { ...this.counts }, queued: this.queue.length, running: this.running, cards: states,
    };
  }
}
