// Comment filter: finds the comments under a video, asks the engine, applies the action, logs what it did.
//
// A comment is one <ytd-comment-view-model> (an older page has <ytd-comment-renderer>): the text is in #content-text, the author in #author-text.
// Replies are comments of their own, inside <ytd-comment-replies-renderer>. The rules that apply are the ones that name the surface "comment"
// (the rules that also judge what is said, i.e. those that apply to subtitles). The word lists decide at once, in the frame that adds the
// comment; a model is asked only for a comment that holds a weak cue.

import { applyCommentAction, clearCard } from './actions.js';
import { hashText } from '../core/text.js';

export const COMMENT = 'ytd-comment-view-model, ytd-comment-renderer';
const TEXT = '#content-text';
const AUTHOR = '#author-text';
const HEARTBEAT_MS = 1500;
const CONCURRENCY = 3;

const clean = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
export const commentText = (comment) => clean(comment.querySelector(TEXT));
export const commentAuthor = (comment) => clean(comment.querySelector(AUTHOR));

/** The element an action goes on: "hide" on a comment that starts a thread takes the whole thread with it (its replies would hang in the air). */
export function targetFor(comment, action) {
  if (action !== 'hide') return comment;
  const thread = comment.closest('ytd-comment-thread-renderer');
  return thread && !comment.closest('ytd-comment-replies-renderer') ? thread : comment;
}

export class CommentFilter {
  /** @param {{engine: object, log: Function, getSettings: Function}} deps */
  constructor({ engine, log, getSettings }) {
    this.engine = engine;
    this.log = log;
    this.getSettings = getSettings;
    this.seen = new WeakMap();   // comment element -> text that was already judged
    this.raf = 0;
    this.timer = null;
    this.running = false;
    this.rerun = false;
    this.watched = null;         // the <ytd-comments> element being observed
    this.observer = new MutationObserver(() => this.schedule());
    this.heartbeat = null;
  }

  start() {
    // <ytd-comments> is made when a video page opens, and stays or is made again when you go to another video: look for it now and then
    this.heartbeat = setInterval(() => { this.watch(); if (document.visibilityState === 'visible') this.schedule(); }, HEARTBEAT_MS);
    window.addEventListener('yt-navigate-finish', () => { this.watch(); this.schedule(0); });
    this.watch();
    this.schedule(0);
  }

  watch() {
    const comments = document.querySelector('ytd-comments');
    if (comments === this.watched) return;
    this.observer.disconnect();
    this.watched = comments;
    if (comments) this.observer.observe(comments, { childList: true, subtree: true, characterData: true });
  }

  /** Forget earlier verdicts (rules or settings changed) and judge every comment again. */
  refilter() {
    this.seen = new WeakMap();
    for (const el of document.querySelectorAll('[data-vianney-kind="comment"]')) clearCard(el);
    this.schedule(0);
  }

  schedule(delay) {
    if (this.timer || this.raf) return;
    const run = () => { cancelAnimationFrame(this.raf); clearTimeout(this.timer); this.raf = 0; this.timer = null; this.scan(); };
    const arm = () => { this.timer = setTimeout(run, 250); this.raf = requestAnimationFrame(run); };   // a hidden tab never gets the frame
    if (delay === 0) arm(); else this.timer = setTimeout(() => { this.timer = null; arm(); }, 30);
  }

  snapshot() {
    const all = [...document.querySelectorAll(COMMENT)];
    return {
      count: all.length,
      armed: document.documentElement.hasAttribute('data-vianney-armed-comments'),
      states: [...document.querySelectorAll('[data-vianney-kind="comment"]')].map((el) => ({ tag: el.tagName.toLowerCase(), state: el.dataset.vianneyState, reason: el.dataset.vianneyReason, text: clean(el.querySelector(TEXT) || el).slice(0, 90) })),
    };
  }

  async scan() {
    if (this.running) { this.rerun = true; return; }
    this.running = true;
    try {
      const s = this.getSettings();
      const armed = !!s.enabled && s.surfaces.comments !== false;
      document.documentElement.toggleAttribute('data-vianney-armed-comments', armed);   // off: nothing is held back
      if (!armed) return;
      const later = [];
      for (const el of document.querySelectorAll(COMMENT)) {
        const text = commentText(el);
        if (this.seen.get(el) === text) continue;
        this.seen.set(el, text);
        if (!text) continue;                                    // not filled in yet: it is judged again when its text arrives
        try { if (!this.applyQuick(el, text)) later.push({ el, text }); } catch (e) { console.warn('[vianney] comment failed', e); }
        el.setAttribute('data-vianney-seen', '');
      }
      let next = 0;
      const worker = async () => {
        while (next < later.length) {
          const job = later[next++];
          try { await this.handle(job.el, job.text); } catch (e) { console.warn('[vianney] comment failed', e); }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, later.length) }, worker));
    } finally {
      this.running = false;
      if (this.rerun) { this.rerun = false; this.schedule(); }
    }
  }

  /** Put the verdict on the page: clear what an earlier verdict did to this comment (or its thread), then act. */
  show(el, verdict) {
    clearCard(el);
    const thread = el.closest('ytd-comment-thread-renderer');
    if (thread && !el.closest('ytd-comment-replies-renderer')) clearCard(thread);
    if (verdict.top && verdict.action) applyCommentAction(targetFor(el, verdict.action), verdict.action, verdict.top.title);
  }

  /** What the word lists decide, at once. @returns {boolean} true when the comment is fully decided (no model could still flag it) */
  applyQuick(el, text) {
    const verdict = this.engine.evaluateQuick({ text }, 'comment');
    this.show(el, verdict);
    if (verdict.undecided) return false;
    this.logVerdict(el, text, verdict);
    return true;
  }

  async handle(el, text) {
    const verdict = await this.engine.evaluate({ text }, 'comment');
    if (commentText(el) !== text) return;                       // the comment changed while the model thought
    this.show(el, verdict);
    this.logVerdict(el, text, verdict);
  }

  logVerdict(el, text, verdict) {
    const top = verdict.top;
    const uncertain = verdict.results.filter((r) => r.uncertain).map((r) => r.ruleId);
    if (!top && !uncertain.length && !Object.keys(verdict.ps).length) return;
    this.log({
      surface: 'comment', id: 'comment:' + hashText(text), title: text.slice(0, 160), channel: commentAuthor(el),
      ps: verdict.ps, flagged: verdict.flagged.map((r) => r.ruleId), uncertain,
      action: top ? verdict.action : null, via: top ? top.via : null,
      hits: verdict.results.filter((r) => r.hits.length).map((r) => ({ rule: r.ruleId, hits: r.hits.map((h) => h.text) })),
    });
  }
}
