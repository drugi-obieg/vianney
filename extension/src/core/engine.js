// The decision engine: deterministic stage first, a model only where the lexicon cannot decide.
//
// Cascade for one rule and one piece of text (plan.md section 4.2):
//   1. lexicon hits give p_lex = the heaviest weight among the hits (0 when there is no hit);
//   2. if p_lex already reaches the rule's flag-at level the rule fires, no model is asked (except for a rule with `confirm: model`: when a model is there it is
//      asked as well, and a clear "no" overrules the hit; without a model the word list decides alone);
//   3. otherwise, if the rule has questions, a backend is available and the gate allows it
//      (gate "lexicon" = only after at least one cue, gate "always" = every time), the model answers
//      and its answer becomes p;
//   4. without a model the weak p_lex stands (so weak cues only flag when the user lowers the slider).
// Everything is deterministic: same text, rules, settings and backend answers give the same verdict.

import { tokenize, hashText, maskTokens } from './text.js';
import { makeMatcher, maxWeight } from './lexicon.js';
import { flagAtFor, uncertainFloor, isFlagged, VETO_BELOW, SPARE_DROP } from './sensitivity.js';
import { withExamples } from './shots.js';
import { ACTIONS } from './rules.js';

const SEVERITY = { hide: 5, blank: 4, 'warn-overlay': 4, 'pause-overlay': 4, 'skip-segment': 4, blackout: 3.5, blur: 3, 'mute-next': 3, 'mute-word': 3, 'censor-caption': 2, dim: 2, label: 1 };

export function strongestAction(actions) {
  return actions.reduce((best, a) => (!best || (SEVERITY[a] || 0) > (SEVERITY[best] || 0) ? a : best), null);
}

/**
 * @typedef {{askNoul?: Function, askScore?: Function, enabled?: boolean}} Backend
 */
export class Engine {
  /**
   * @param {{rules: object[], lexicons: Record<string, object>, settings?: object, backend?: Backend|null}} opts
   */
  constructor({ rules, lexicons, settings = {}, backend = null }) {
    this.rules = rules;
    this.settings = settings;
    this.backend = backend;
    this.matcher = makeMatcher(lexicons);
    this.cache = new Map();
  }

  setSettings(settings) {
    this.settings = settings || {};
  }

  setBackend(backend) {
    this.backend = backend;
    this.cache.clear();
  }

  /**
   * What happens when a rule flags on a surface: the user's choice in the settings (settings.actions[ruleId][surface]),
   * if it is one this surface knows, otherwise the action written in the rule.
   */
  actionFor(rule, surface) {
    const mine = this.settings.actions && this.settings.actions[rule.id] && this.settings.actions[rule.id][surface];
    return mine && ACTIONS[surface] && ACTIONS[surface].includes(mine) ? mine : rule.action[surface];
  }

  isEnabled(rule) {
    const o = this.settings.ruleEnabled ? this.settings.ruleEnabled[rule.id] : undefined;
    return o === undefined ? rule.enabled : !!o;
  }

  rulesFor(surface) {
    return this.rules.filter((r) => r.where.includes(surface) && this.isEnabled(r));
  }

  textFor(item, surface) {
    if (surface === 'subtitles' || surface === 'comment') return item.text || '';
    if (surface === 'watch-meta') return [item.title, item.channel, item.description, item.keywords].filter(Boolean).join('\n');
    return [item.title, item.channel].filter(Boolean).join('\n');
  }

  modelUsable() {
    return !!this.backend && this.backend.enabled !== false;
  }

  /** How many examples of each side go beside a question (settings.ai.shots; none when the settings say nothing, as in the first tests). */
  shots() {
    const n = this.settings && this.settings.ai ? Number(this.settings.ai.shots) : 0;
    return Number.isFinite(n) ? n : 0;
  }

  /** The yes/no question as the model gets it: the rule's own, with the nearest of the rule's examples and spared lines after it (core/shots.js). */
  questionFor(rule, q, text, leaveOut) {
    return q.type === 'noul' ? withExamples(q.question, rule, { shots: this.shots(), text, leaveOut }) : q.question;
  }

  /** Ask the model all questions of a rule; the highest p wins. Returns {p} or {error}. `leaveOut` is a line of the rule that must not be shown as an example. */
  async ask(rule, text, leaveOut = null) {
    const key = `${rule.id}|${hashText(text)}|${this.shots()}|${leaveOut ? hashText(leaveOut) : ''}`;
    if (this.cache.has(key)) return this.cache.get(key);
    let best = null;
    let error = null;
    for (const q of rule.asks) {
      let r;
      try {
        if (q.type === 'noul') r = await this.backend.askNoul(this.questionFor(rule, q, text, leaveOut), text);
        else r = await this.backend.askScore(q.question, q.levels, text);
      } catch (e) {
        r = { p: null, error: String((e && e.name) || e) };
      }
      if (r && typeof r.p === 'number') best = best === null ? r.p : Math.max(best, r.p);
      else if (r && r.error) error = r.error;
    }
    const out = best === null ? { p: null, error: error || 'unavailable' } : { p: best };
    if (best !== null) this.cache.set(key, out);
    return out;
  }

  /**
   * The deterministic stage of one rule: what the word lists say, and whether a model could still change the answer. `channel` is the channel name of the card:
   * for a rule with `spare channel`, a channel name that hits that word list (a Catholic channel) lowers a strong hit to just under the flag level, into the
   * band where a model decides (and where, with no model, nothing is flagged); so does a text that hits the list of a rule's `spare words` (the life of an author
   * is not his books).
   */
  lexiconStage(rule, text, channel = '') {
    const tokens = tokenize(text);
    const hits = rule.lexicon.length ? this.matcher.match(tokens, rule.lexicon) : [];
    let pLex = maxWeight(hits);
    const flagAt = flagAtFor(rule, this.settings);
    let channelSpared = false;
    let wordsSpared = false;
    if (pLex >= flagAt - 1e-9) {
      if (rule.spareChannel && channel && this.matcher.match(tokenize(channel), [rule.spareChannel]).length) channelSpared = true;
      if (rule.spareWords && this.matcher.match(tokens, [rule.spareWords]).length) wordsSpared = true;
      if (channelSpared || wordsSpared) pLex = Math.min(pLex, flagAt - SPARE_DROP);
    }
    const low = uncertainFloor(flagAt, rule.band === null ? undefined : rule.band);
    // The model is only asked inside the uncertain band (or always, for gate "always" rules).
    const needsModel = rule.asks.length > 0 && pLex < flagAt - 1e-9
      && (rule.gate === 'always' || (hits.length > 0 && pLex >= low - 1e-9));
    // a strong hit that the rule wants the model to look at too (`confirm: model`): the model may overrule it
    const needsConfirm = rule.confirm === 'model' && rule.asks.length > 0 && hits.length > 0 && pLex >= flagAt - 1e-9;
    return { tokens, hits, pLex, flagAt, low, needsModel, needsConfirm, channelSpared, wordsSpared };
  }

  /** Evaluate one rule on some text. `opts.leaveOut`: a line of the rule that is not shown to the model as an example (the check on the rule's own examples). */
  async evalRule(rule, text, opts = {}) {
    const { tokens, hits, pLex, flagAt, low, needsModel, needsConfirm, channelSpared, wordsSpared } = this.lexiconStage(rule, text, opts.channel || '');
    let p = pLex;
    let via = pLex > 0 ? 'lexicon' : 'none';
    let modelError = null;
    let vetoed = false;
    if (needsModel && this.modelUsable()) {
      const m = await this.ask(rule, text, opts.leaveOut);
      if (typeof m.p === 'number') { p = m.p; via = 'model'; } else modelError = m.error;
    } else if (needsConfirm && this.modelUsable()) {
      const m = await this.ask(rule, text, opts.leaveOut);
      if (typeof m.p !== 'number') modelError = m.error;                   // no answer: the word list stands
      else if (m.p < VETO_BELOW) { p = m.p; via = 'model'; vetoed = true; } // a clear no overrules it
      else via = 'lexicon+model';                                           // confirmed, or not sure enough to overrule
    }
    return {
      ruleId: rule.id,
      p,
      pLex,
      flagAt,
      vetoed,
      channelSpared,
      wordsSpared,
      flagged: isFlagged(p, flagAt),
      uncertain: p > 0 && p < flagAt && p >= low - 1e-9,
      via,
      needsModel: needsModel && !this.modelUsable(),
      modelError,
      hits: hits.slice(0, 6).map((h) => ({ entry: h.entry, weight: h.weight, text: tokens.slice(h.from, h.to + 1).map((t) => t.raw).join(' ') })),
    };
  }

  /**
   * True when the backend can judge this kind of media right now. It does not depend on the switch for the
   * text questions: pictures and sound have their own settings and their own model availability.
   */
  mediaUsable(kind) {
    return !!this.backend && !!(this.backend.mediaEnabled && this.backend.mediaEnabled[kind]);
  }

  /** Ask the model one question about a picture or a piece of sound. */
  async askMedia(rule, surface, item) {
    const kind = surface === 'thumbnail' ? 'image' : 'audio';
    const key = `${surface}|${item.id}|${item.window === undefined ? '' : item.window}|${rule.id}`;
    if (this.cache.has(key)) return this.cache.get(key);
    let best = null;
    let error = null;
    for (const q of rule.asks) {
      let r;
      try {
        r = await this.backend.askMedia(kind, q.question, item.media, { votes: (this.settings.media && this.settings.media.votes) || 2 });
      } catch (e) {
        r = { p: null, error: String((e && e.name) || e) };
      }
      if (r && typeof r.p === 'number') best = best === null ? r.p : Math.max(best, r.p);
      else if (r && r.error) error = r.error;
    }
    const out = best === null ? { p: null, error: error || 'unavailable' } : { p: best };
    if (best !== null && item.window === undefined) this.cache.set(key, out); // pictures are cached; sound windows are not repeated
    return out;
  }

  /** Evaluate one rule on a picture or sound. A model that refuses ("unsafe response") counts as a flag only for rules that say so. */
  async evalMediaRule(rule, surface, item) {
    const flagAt = flagAtFor(rule, this.settings);
    const low = uncertainFloor(flagAt);
    const kind = surface === 'thumbnail' ? 'image' : 'audio';
    const base = { ruleId: rule.id, pLex: 0, flagAt, hits: [], needsModel: false, modelError: null };
    if (!this.mediaUsable(kind)) return { ...base, p: 0, flagged: false, uncertain: false, via: 'none', needsModel: true };
    const m = await this.askMedia(rule, surface, item);
    let p = 0;
    let via = 'none';
    let modelError = null;
    if (typeof m.p === 'number') { p = m.p; via = 'model'; }
    else if (m.error === 'NotReadableError' && rule.refusal === 'flag' && !(this.settings.media && this.settings.media.refusalIsFlag === false)) { p = 1; via = 'refusal'; }
    else modelError = m.error;
    return { ...base, p, flagged: isFlagged(p, flagAt), uncertain: p > 0 && p < flagAt && p >= low - 1e-9, via, modelError };
  }

  /**
   * Judge a picture or a few seconds of sound against every enabled rule for the surface.
   * @param {'thumbnail'|'audio'} surface
   * @param {{id: string, window?: number, media: object}} item
   */
  async evaluateMedia(surface, item) {
    const results = [];
    for (const rule of this.rulesFor(surface)) {
      const r = await this.evalMediaRule(rule, surface, item);
      r.action = this.actionFor(rule, surface);
      r.title = rule.name;
      results.push(r);
    }
    const flagged = results.filter((r) => r.flagged).sort((a, b) => b.p - a.p);
    const ps = {};
    for (const r of results) if (r.p > 0) ps[r.ruleId] = r.p;
    return { surface, results, flagged, ps, action: strongestAction(flagged.map((r) => r.action)), top: flagged[0] || null };
  }

  /**
   * A video remembered from an earlier sound check, judged again under today's rules and sensitivities.
   * The stored p values are kept, not the decisions, so moving a slider changes what is hidden.
   * @param {{by?: {rule: string, p: number}[]}} entry
   */
  rememberedVerdict(entry) {
    const flagged = [];
    for (const b of (entry && entry.by) || []) {
      const rule = this.rules.find((r) => r.id === b.rule);
      if (!rule || !this.isEnabled(rule) || typeof b.p !== 'number') continue;
      const flagAt = flagAtFor(rule, this.settings);
      if (isFlagged(b.p, flagAt)) flagged.push({ ruleId: rule.id, title: rule.name, p: b.p, flagAt, via: 'remembered' });
    }
    flagged.sort((a, b) => b.p - a.p);
    return { flagged, top: flagged[0] || null };
  }

  /**
   * The deterministic stage alone, for every enabled rule, synchronously: what the word lists decide without any model.
   * The feed filter applies this in the same task in which a card appears, so a card the word lists flag is never painted.
   * A model can ADD flags to this (it answers below the flag-at level) and, for a rule with `confirm: model`, take one away again (a clear "no" overrules a
   * strong hit): the hit is applied first all the same, because content that the words flag must not be painted while the model thinks, and the slow path
   * puts the card back if the model overrules it. `undecided` is true when a model could still change the answer of this.
   */
  evaluateQuick(item, surface) {
    const text = this.textFor(item, surface);
    const results = [];
    let undecided = false;
    for (const rule of this.rulesFor(surface)) {
      if (!text.trim()) continue;
      const { tokens, hits, pLex, flagAt, low, needsModel, needsConfirm, channelSpared, wordsSpared } = this.lexiconStage(rule, text, item.channel || '');
      if ((needsModel || needsConfirm) && this.modelUsable()) undecided = true;
      results.push({
        ruleId: rule.id, title: rule.name, action: this.actionFor(rule, surface),
        p: pLex, pLex, flagAt, channelSpared, wordsSpared, flagged: isFlagged(pLex, flagAt), uncertain: pLex > 0 && pLex < flagAt && pLex >= low - 1e-9,
        via: pLex > 0 ? 'lexicon' : 'none', needsModel: needsModel && !this.modelUsable(), modelError: null,
        hits: hits.slice(0, 6).map((h) => ({ entry: h.entry, weight: h.weight, text: tokens.slice(h.from, h.to + 1).map((t) => t.raw).join(' ') })),
      });
    }
    const flagged = results.filter((r) => r.flagged).sort((a, b) => b.p - a.p);
    const ps = {};
    for (const r of results) if (r.p > 0) ps[r.ruleId] = r.p;
    return { surface, results, flagged, ps, action: strongestAction(flagged.map((r) => r.action)), top: flagged[0] || null, undecided };
  }

  /** Evaluate a card or a video page against every enabled rule for the surface. `opts.leaveOut`: see evalRule. */
  async evaluate(item, surface, opts = {}) {
    const text = this.textFor(item, surface);
    const results = [];
    for (const rule of this.rulesFor(surface)) {
      if (!text.trim()) continue;
      const r = await this.evalRule(rule, text, { ...opts, channel: item.channel || '' });
      r.action = this.actionFor(rule, surface);
      r.title = rule.name;
      results.push(r);
    }
    const flagged = results.filter((r) => r.flagged).sort((a, b) => b.p - a.p);
    const ps = {};
    for (const r of results) if (r.p > 0) ps[r.ruleId] = r.p;
    return {
      surface,
      results,
      flagged,
      ps,
      action: strongestAction(flagged.map((r) => r.action)),
      top: flagged[0] || null,
    };
  }

  /** Mask words of visible caption text that flag by the lexicon alone (no model, so it is instant). */
  maskText(text, mask = '\u25ae\u25ae\u25ae') {
    let out = text;
    for (const rule of this.rulesFor('subtitles')) {
      if (!rule.lexicon.length) continue;
      const flagAt = flagAtFor(rule, this.settings);
      const { tokens, hits } = this.matcher.matchText(out, rule.lexicon);
      const ranges = hits.filter((h) => isFlagged(h.weight, flagAt)).map((h) => ({ from: h.from, to: h.to }));
      if (ranges.length) out = maskTokens(out, tokens, ranges, mask);
    }
    return out;
  }

  /**
   * Evaluate caption tokens (with start/end seconds). Returns one decision per lexicon hit that flags.
   * @param {{raw:string,t:string,start?:number,end?:number}[]} tokens
   */
  async evaluateSubtitles(tokens, { context = 24, maxModelCalls = 40 } = {}) {
    const decisions = [];
    let calls = 0;
    for (const rule of this.rulesFor('subtitles')) {
      if (!rule.lexicon.length) continue;
      const hits = this.matcher.match(tokens, rule.lexicon);
      const flagAt = flagAtFor(rule, this.settings);
      const low = uncertainFloor(flagAt, rule.band === null ? undefined : rule.band);
      for (const h of hits) {
        let p = h.weight;
        let via = 'lexicon';
        let win = null;
        if (rule.asks.length && p < flagAt - 1e-9 && p >= low - 1e-9 && this.modelUsable() && calls < maxModelCalls) {
          calls++;
          const a = Math.max(0, h.from - context);
          const b = Math.min(tokens.length - 1, h.to + context);
          const text = tokens.slice(a, b + 1).map((t) => t.raw).join(' ');
          const m = await this.ask(rule, text);
          if (typeof m.p === 'number') { p = m.p; via = 'model'; win = { a, b }; }
        }
        if (!isFlagged(p, flagAt)) continue;
        // Skipping a passage means skipping the whole stretch the model judged, not only the cue words.
        const action = this.actionFor(rule, 'subtitles');
        const wide = via === 'model' && action === 'skip-segment' && win;
        const first = wide ? tokens[win.a] : tokens[h.from];
        const last = wide ? tokens[win.b] : tokens[h.to];
        decisions.push({
          ruleId: rule.id, title: rule.name, action, p, flagAt, via,
          from: h.from, to: h.to, entry: h.entry,
          text: tokens.slice(h.from, h.to + 1).map((t) => t.raw).join(' '),
          start: first && first.start, end: last && last.end,
        });
      }
    }
    return decisions;
  }
}
