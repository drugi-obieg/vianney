// Feed filter: finds cards, asks the engine, applies the action, logs what it did.

import { findCards, extractMeta } from './discover.js';
import { applyCardAction, clearCard, ensureStyle } from './actions.js';

const DEBOUNCE_MS = 250;
const CONCURRENCY = 3;

export class FeedFilter {
  /**
   * @param {{engine: object, log: Function, getSettings: Function, onCards?: Function}} deps
   */
  constructor({ engine, log, getSettings, onCards }) {
    this.engine = engine;
    this.log = log;
    this.getSettings = getSettings;
    this.onCards = onCards || (() => {});
    this.seen = new WeakMap(); // element -> signature that was already evaluated
    this.timer = null;
    this.running = false;
    this.rerun = false;
    this.hiddenCount = 0;
    this.observer = new MutationObserver(() => this.schedule());
  }

  start() {
    ensureStyle();
    this.observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('yt-navigate-finish', () => this.schedule(0));
    this.schedule(0);
  }

  stop() {
    this.observer.disconnect();
    for (const el of document.querySelectorAll('[data-vianney-state]')) clearCard(el);
  }

  /** Forget earlier verdicts (rules or settings changed) and evaluate again. */
  refilter() {
    this.seen = new WeakMap();
    for (const el of document.querySelectorAll('[data-vianney-state]')) clearCard(el);
    this.schedule(0);
  }

  schedule(delay = DEBOUNCE_MS) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.scan(), delay);
  }

  async scan() {
    if (this.running) { this.rerun = true; return; }
    this.running = true;
    try {
      const s = this.getSettings();
      if (!s.enabled || s.surfaces.feed === false) return;
      const cards = findCards();
      this.onCards(cards);
      const todo = [];
      for (const card of cards) {
        const meta = extractMeta(card);
        const sig = card.id + '|' + meta.title + '|' + meta.channel;
        if (this.seen.get(card.el) === sig) continue;
        this.seen.set(card.el, sig);
        todo.push({ card, meta });
      }
      let next = 0;
      const worker = async () => {
        while (next < todo.length) {
          const job = todo[next++];
          try { await this.handle(job.card, job.meta); } catch (e) { console.warn('[vianney] card failed', e); }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));
      this.hiddenCount = document.querySelectorAll('[data-vianney-state="hide"], [data-vianney-state="blank"]').length;
    } finally {
      this.running = false;
      if (this.rerun) { this.rerun = false; this.schedule(50); }
    }
  }

  async handle(card, meta) {
    if (!meta.title && !meta.channel) return;
    const verdict = await this.engine.evaluate(meta, 'feed-card');
    const top = verdict.top;
    if (top && verdict.action) {
      applyCardAction(card.el, verdict.action, top.title);
    } else {
      clearCard(card.el);
    }
    const uncertain = verdict.results.filter((r) => r.uncertain).map((r) => r.ruleId);
    if (top || uncertain.length || Object.keys(verdict.ps).length) {
      this.log({
        surface: 'feed-card', id: card.id, title: meta.title, channel: meta.channel,
        ps: verdict.ps, flagged: verdict.flagged.map((r) => r.ruleId), uncertain,
        action: top ? verdict.action : null, via: top ? top.via : null,
        hits: verdict.results.filter((r) => r.hits.length).map((r) => ({ rule: r.ruleId, hits: r.hits.map((h) => h.text) })),
      });
    }
  }
}
