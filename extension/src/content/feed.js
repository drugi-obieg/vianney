// Feed filter: finds cards, asks the engine, applies the action, logs what it did.

import { findCards, extractMeta, cardSurface } from './discover.js';
import { applyCardAction, clearCard, ensureStyle, setCardTags, DEFAULT_CARD_TAGS } from './actions.js';
import { listVerdict } from '../core/lists.js';

// When a scan runs. NOT a debounce: later changes join the scan that is already due instead of postponing it, because YouTube
// changes its page continuously while it renders, and a debounce then never fires (cards that should have been hidden stayed
// visible for seconds on a slow computer). The scan runs in requestAnimationFrame, i.e. right before the next paint, so a card
// that the word lists flag is hidden before it is ever drawn. A scan costs time, so it waits until about three times its own
// cost has passed since the last one: a busy page cannot make the filter use more than about a quarter of the processor.
const HIDDEN_TAB_MS = 250; // requestAnimationFrame does not run in a hidden tab
const HEARTBEAT_MS = 1500;
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
    this.remembered = {};      // videoId -> what an earlier sound check found (see media-flag in the service worker)
    this.timer = null;
    this.raf = 0;
    this.tags = new Set(DEFAULT_CARD_TAGS);  // tag names of cards: the defaults cover the first paint, the rest is learned (see actions.js)
    this.running = false;
    this.rerun = false;
    this.lastScanMs = 0;     // how long the last scan took, for diagnostics
    this.lastScanEnd = 0;
    this.observer = new MutationObserver(() => this.schedule());
    this.heartbeat = null;
  }

  /** Cards hidden or blanked right now, by a title rule, a list or a thumbnail check. Counted live: pictures are judged later than titles. */
  get hiddenCount() {
    return document.querySelectorAll('[data-vianney-state="hide"], [data-vianney-state="blank"], [data-vianney-thumb="hide"], [data-vianney-thumb="blank"]').length;
  }

  start() {
    ensureStyle();
    setCardTags(this.tags);
    document.documentElement.setAttribute('data-vianney-armed', '');
    try {
      chrome.storage.local.get('cardTags').then(({ cardTags }) => {
        if (Array.isArray(cardTags)) { for (const t of cardTags) this.tags.add(t); setCardTags(this.tags); }
      }).catch(() => {});
    } catch (e) { /* the extension was reloaded */ }
    // childList: cards appear. attributes/characterData: titles are often filled in after the card exists (a title attribute,
    // or the text of a heading), and without these a card whose title arrived late was only looked at again when something
    // else, such as the mouse resting on it, happened to change the page.
    this.observer.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'href'],
    });
    window.addEventListener('yt-navigate-finish', () => this.schedule(0));
    // a last safety net against any change that no observer reports
    this.heartbeat = setInterval(() => { if (document.visibilityState === 'visible') this.schedule(); }, HEARTBEAT_MS);
    this.schedule(0);
  }

  stop() {
    clearInterval(this.heartbeat);
    document.documentElement.removeAttribute('data-vianney-armed');
    this.observer.disconnect();
    for (const el of document.querySelectorAll('[data-vianney-state]')) clearCard(el);
  }

  setRemembered(map) {
    this.remembered = map || {};
    this.refilter();
  }

  /** Forget earlier verdicts (rules or settings changed) and evaluate again. */
  refilter() {
    this.seen = new WeakMap();
    for (const el of document.querySelectorAll('[data-vianney-state]')) clearCard(el);
    this.schedule(0);
  }

  schedule(delay) {
    if (this.timer || this.raf) return; // a scan is already due: this change joins it
    const wait = delay !== undefined ? delay : Math.max(0, this.lastScanMs * 3 - (performance.now() - this.lastScanEnd));
    const run = () => {
      cancelAnimationFrame(this.raf);
      clearTimeout(this.timer);
      this.raf = 0;
      this.timer = null;
      this.scan();
    };
    const arm = () => {
      this.timer = setTimeout(run, HIDDEN_TAB_MS);       // a hidden tab never gets the frame
      this.raf = requestAnimationFrame(run);              // the usual case: right before the next paint
    };
    if (wait > 4) this.timer = setTimeout(() => { this.timer = null; arm(); }, wait);
    else arm();
  }

  async scan() {
    if (this.running) { this.rerun = true; return; }
    this.running = true;
    const t0 = performance.now();
    try {
      const s = this.getSettings();
      const armed = !!s.enabled && (s.surfaces.feed !== false || s.surfaces.related !== false);
      document.documentElement.toggleAttribute('data-vianney-armed', armed); // off: nothing is held back
      if (!s.enabled) return;
      const cards = findCards();
      this.onCards(cards); // the thumbnail check has its own switch and does not depend on the title filter
      const todo = [];
      for (const card of cards) {
        const surface = cardSurface(card.el);       // a list or search result, or a recommendation next to the video you watch
        if (s.surfaces[surface === 'related' ? 'related' : 'feed'] === false) continue;
        const meta = extractMeta(card);
        const sig = card.id + '|' + meta.title + '|' + meta.channel + '|' + surface + (meta.music ? '|music' : '');   // the badges can be drawn after the title
        if (this.seen.get(card.el) === sig) continue;
        this.seen.set(card.el, sig);
        todo.push({ card, meta, surface });
      }
      // 1. In this very task, before the page is painted: the lists and the word lists. A card that they flag is never shown.
      const later = [];
      for (const job of todo) {
        try { if (!this.applyQuick(job)) later.push(job); } catch (e) { console.warn('[vianney] card failed', e); }
      }
      this.release(cards);
      // 2. Only for the cards that a model could still flag: ask it. This can add to what step 1 did, never undo it.
      let next = 0;
      const worker = async () => {
        while (next < later.length) {
          const job = later[next++];
          try { await this.handle(job.card, job.meta, job.surface); } catch (e) { console.warn('[vianney] card failed', e); }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, later.length) }, worker));
    } finally {
      this.lastScanMs = Math.round(performance.now() - t0);
      this.lastScanEnd = performance.now();
      this.running = false;
      if (this.rerun) { this.rerun = false; this.schedule(); }
    }
  }

  /** Allow and block lists, and videos remembered from a sound check. They come before any rule. */
  decide(card, meta) {
    const s = this.getSettings();
    const listed = listVerdict(s.lists, { id: card.id, channel: meta.channel });
    if (listed === 'allow') return { skip: true };
    if (listed === 'deny') return { action: 'hide', reason: 'Blocked', via: 'list' };
    if (s.cleanup && s.cleanup.music === true && meta.music) return { action: 'hide', reason: 'Music video', via: 'mark' };   // YouTube's own mark (Clean up: "Music videos")
    const entry = this.remembered[card.id];
    if (entry && s.media && s.media.rememberFlagged !== false) {
      const v = this.engine.rememberedVerdict(entry);
      if (v.top) return { action: (s.media.rememberedAction || 'hide'), reason: `Audio: ${v.top.title}`, via: 'remembered', top: v.top };
    }
    return null;
  }

  /** Cards that have been looked at may be shown (a flagged one is hidden by its state), and their tag names are learned. */
  release(cards) {
    let grew = false;
    for (const c of cards) {
      if (!c.el.hasAttribute('data-vianney-seen')) c.el.setAttribute('data-vianney-seen', '');
      const tag = c.el.tagName.toLowerCase();
      if (tag.includes('-') && !this.tags.has(tag)) { this.tags.add(tag); grew = true; }
    }
    if (grew) {
      setCardTags(this.tags);
      try { chrome.storage.local.set({ cardTags: [...this.tags] }).catch(() => {}); } catch (e) { /* the extension was reloaded */ }
    }
  }

  /**
   * Everything that needs no model, applied synchronously.
   * @returns {boolean} true when the card is fully decided; false when a model could still flag it (handle() asks it)
   */
  applyQuick({ card, meta, surface }) {
    if (!meta.title && !meta.channel) return true; // nothing to judge yet: the signature changes when the title arrives
    const decided = this.decide(card, meta);
    if (decided && decided.skip) { clearCard(card.el); return true; }
    if (decided) {
      applyCardAction(card.el, decided.action, decided.reason);
      this.log({ surface, id: card.id, title: meta.title, channel: meta.channel, ps: decided.top ? { [decided.top.ruleId]: decided.top.p } : {}, flagged: decided.top ? [decided.top.ruleId] : [], uncertain: [], action: decided.action, via: decided.via, hits: [] });
      return true;
    }
    const verdict = this.engine.evaluateQuick(meta, surface);
    if (verdict.top && verdict.action) applyCardAction(card.el, verdict.action, verdict.top.title);
    else clearCard(card.el);
    if (verdict.undecided) return false;
    this.logVerdict(card, meta, verdict, surface);
    return true;
  }

  /** The slow path, for cards that a model could still flag. */
  async handle(card, meta, surface) {
    const verdict = await this.engine.evaluate(meta, surface);
    if (verdict.top && verdict.action) applyCardAction(card.el, verdict.action, verdict.top.title);
    else clearCard(card.el);
    this.logVerdict(card, meta, verdict, surface);
  }

  logVerdict(card, meta, verdict, surface) {
    const top = verdict.top;
    const uncertain = verdict.results.filter((r) => r.uncertain).map((r) => r.ruleId);
    if (top || uncertain.length || Object.keys(verdict.ps).length) {
      this.log({
        surface, id: card.id, title: meta.title, channel: meta.channel,
        ps: verdict.ps, flagged: verdict.flagged.map((r) => r.ruleId), uncertain,
        action: top ? verdict.action : null, via: top ? top.via : null,
        hits: verdict.results.filter((r) => r.hits.length).map((r) => ({ rule: r.ruleId, hits: r.hits.map((h) => h.text) })),
      });
    }
  }
}
