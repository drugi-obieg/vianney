// Parser for the plain-text rule format (see plan.md section 5 and extension/rules/*.rules).

// feed-card: a video in a list, in search results or on the home page. related: a recommended video next to the one you watch (a card like
// any other, but with a switch and an action of its own). comment: a comment under a video. watch-meta: the title and description of the video
// you opened. subtitles: what is said in it.
export const TEXT_SURFACES = ['feed-card', 'related', 'comment', 'watch-meta', 'subtitles'];
// Experimental: judged by the on-device model from a thumbnail picture or from a few seconds of sound.
export const MEDIA_SURFACES = ['thumbnail', 'audio'];
export const SURFACES = [...TEXT_SURFACES, ...MEDIA_SURFACES];
export const ACTIONS = {
  'feed-card': ['hide', 'blank', 'dim', 'label'],
  related: ['hide', 'blank', 'dim', 'label'],
  comment: ['hide', 'blur', 'dim', 'label'], // blur: the comment stays, unreadable, with a Show button
  'watch-meta': ['warn-overlay', 'label'],
  subtitles: ['mute-word', 'skip-segment', 'censor-caption'],
  thumbnail: ['blur', 'blackout', 'hide', 'blank', 'dim', 'label'], // blackout: the picture becomes pure black, the card and its title stay
  audio: ['pause-overlay', 'mute-next', 'label'],
};
// A rule that names no action for a surface gets this. A recommended video takes the action the rule gives a feed card, because it is
// the same kind of thing; a comment is blurred rather than removed, so that a false alarm costs one click and the conversation stays whole.
export const DEFAULT_ACTION = { 'feed-card': 'hide', related: 'hide', comment: 'blur', 'watch-meta': 'warn-overlay', subtitles: 'mute-word', thumbnail: 'blur', audio: 'pause-overlay' };

// name, plain, group, example, spared: how the rule is shown to a person (settings page). They never change what a rule does.
//   name     the plain name ("God's name in vain"); `title` stays the traditional name
//   plain    one sentence in plain words
//   group    which heading of the list it sits under
//   example  a title the rule catches (repeatable; for text rules the tests check that it really does)
//   spared   a title that looks similar but is left alone (repeatable)
// confirm: model  a word-list hit at or above `flag at` is not final when an on-device model is there: the model is asked the rule's question too, and a clear
//          "no" (below VETO_BELOW in sensitivity.js) overrules the hit. For rules that flag an ideology but must spare what warns against it (Freemasonry, Communism):
//          the words are the same on both sides, only a model can tell the invitation from the warning. Without a model the word list decides alone. Needs an "ask" line.
// The examples and the spared lines are also shown to the model beside the question (core/shots.js), the nearest ones, so a rule teaches the model by its own lines.
// A line may name the channel it comes from after " @ " ("Ouija Boards @ Ascent of Mount Carmel"): splitLine() gives the title and the channel, which tests, the check on the
// rule examples and the examples for the model use as the engine does with a card (a title and a channel).
// spare words: <word list>  when the text of the card (title and channel) hits this word list, a strong word-list hit of this rule is lowered like that: for the rules about
//          books, a title about the LIFE or the history of the author (biography, born, died, exile, "influence on") is not about his works, which are what the Index forbade
//          (the owner, 2026-11-26: "it's about the life of the person David Hume (historical), not 'opera omnia' (his works), that's the difficulty"); the model decides.
// spare channel: <word list>  when the CHANNEL name of a card hits this word list (Catholic, Apostolic, Carmel, ...), a strong word-list hit of this rule is lowered to the
//          top of the uncertain band: the model decides, and without a model the card is not flagged. A video about an error from a channel that is itself Catholic is
//          most likely a warning against it (the owner's reading, 2026-11-26); only for rules about errors, not for rules about books ("videos that discuss these authors").
const RULE_KEYS = new Set(['title', 'name', 'plain', 'group', 'example', 'spared', 'source', 'where', 'lexicon', 'gate', 'flag at', 'band', 'action', 'enabled', 'levels', 'refusal', 'confirm', 'spare channel', 'spare words']);

/** A line of examples may end in " @ <channel>": the title and the channel of the card it stands for. */
export function splitLine(line) {
  const s = String(line);
  const i = s.lastIndexOf(' @ ');
  if (i < 1) return { title: s, channel: '' };
  const channel = s.slice(i + 3).trim();
  return channel && channel.length <= 80 ? { title: s.slice(0, i).trim(), channel } : { title: s, channel: '' };
}

function stripComment(v) {
  return v.replace(/\s+#.*$/, '').trim();
}

function list(v) {
  return stripComment(v).split(',').map((x) => x.trim()).filter(Boolean);
}

/**
 * Parse rule text.
 * @returns {{pack: object, rules: object[], errors: {line:number,message:string}[]}}
 */
export function parseRules(text) {
  const errors = [];
  const pack = { id: '', version: 1, language: 'en', note: '' };
  const rules = [];
  let cur = null;
  let lastAsk = null;

  const fail = (line, message) => errors.push({ line, message });

  const lines = String(text ?? '').split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const n = idx + 1;
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;

    const ruleHead = line.match(/^rule\s+([a-z0-9_]+)\s*(?:#.*)?$/);
    if (ruleHead) {
      cur = {
        id: ruleHead[1], title: ruleHead[1], name: '', plain: '', group: '', examples: [], spared: [], source: '', where: [], lexicon: [], asks: [], gate: null,
        flagAtRaw: null, flagAt: 0.7, band: null, actionRaw: null, action: {}, enabled: true, refusal: 'ignore', confirm: 'none', spareChannel: '', spareWords: '', line: n,
      };
      lastAsk = null;
      rules.push(cur);
      return;
    }
    if (/^rule\b/.test(line)) { fail(n, 'rule ids may only use lowercase letters, digits and underscores'); cur = null; return; }

    const kv = line.match(/^([a-z][a-z ]*?)\s*:\s*(.*)$/);
    if (!kv) { fail(n, 'cannot read this line'); return; }
    let key = kv[1].trim();
    const value = kv[2];

    if (!cur) {
      if (key === 'pack') pack.id = stripComment(value);
      else if (key === 'version') pack.version = Number(stripComment(value)) || 1;
      else if (key === 'language') pack.language = stripComment(value);
      else if (key === 'note') pack.note = value.trim();
      else fail(n, `unknown pack key "${key}"`);
      return;
    }

    const ask = key.match(/^ask (noul|score)$/);
    if (ask) {
      if (!value.trim()) { fail(n, 'a question is empty'); return; }
      lastAsk = { type: ask[1], question: value.trim(), levels: null };
      cur.asks.push(lastAsk);
      return;
    }
    if (!RULE_KEYS.has(key)) { fail(n, `unknown key "${key}" in rule ${cur.id}`); return; }

    switch (key) {
      case 'title': cur.title = value.trim(); break;
      case 'name': cur.name = value.trim(); break;
      case 'plain': cur.plain = value.trim(); break;
      case 'group': cur.group = stripComment(value); break;
      case 'example': if (value.trim()) cur.examples.push(value.trim()); break;
      case 'spared': if (value.trim()) cur.spared.push(value.trim()); break;
      case 'source': cur.source = value.trim(); break;
      case 'where': cur.where = list(value); break;
      case 'lexicon': cur.lexicon = list(value); break;
      case 'gate': cur.gate = stripComment(value); break;
      case 'flag at': cur.flagAtRaw = stripComment(value); break;
      case 'band': { const b = Number(stripComment(value)); if (!(b >= 0 && b <= 1)) fail(n, `rule ${cur.id}: "band" must be a number between 0 and 1`); else cur.band = b; break; }
      case 'action': cur.actionRaw = stripComment(value); break;
      case 'enabled': cur.enabled = stripComment(value) !== 'false'; break;
      case 'refusal': cur.refusal = stripComment(value); break;
      case 'confirm': cur.confirm = stripComment(value); break;
      case 'spare channel': cur.spareChannel = stripComment(value); break;
      case 'spare words': cur.spareWords = stripComment(value); break;
      case 'levels':
        if (!lastAsk || lastAsk.type !== 'score') fail(n, '"levels" belongs under an "ask score" line');
        else lastAsk.levels = list(value);
        break;
      default: break;
    }
  });

  const seen = new Set();
  for (const r of rules) {
    if (seen.has(r.id)) fail(r.line, `duplicate rule id "${r.id}"`);
    seen.add(r.id);
    if (!r.name) r.name = r.title; // the plain name defaults to the title

    if (!r.where.length) fail(r.line, `rule ${r.id}: "where" is missing`);
    for (const w of r.where) if (!SURFACES.includes(w)) fail(r.line, `rule ${r.id}: unknown surface "${w}"`);
    if (!r.lexicon.length && !r.asks.length) fail(r.line, `rule ${r.id}: needs a lexicon or an "ask" question`);
    for (const a of r.asks) if (a.type === 'score' && (!a.levels || a.levels.length < 2)) fail(r.line, `rule ${r.id}: an "ask score" needs "levels" with at least two names`);

    if (r.refusal !== 'flag' && r.refusal !== 'ignore') fail(r.line, `rule ${r.id}: refusal must be "flag" or "ignore"`);
    const mediaWhere = r.where.filter((w) => MEDIA_SURFACES.includes(w));
    if (mediaWhere.length) {
      if (mediaWhere.length !== r.where.length) fail(r.line, `rule ${r.id}: a rule cannot look at both text and pictures or sound; split it into two rules`);
      if (!r.asks.length) fail(r.line, `rule ${r.id}: pictures and sound are judged by a question, so it needs an "ask noul" line`);
      if (r.lexicon.length) fail(r.line, `rule ${r.id}: word lists only work on text`);
      if (r.asks.some((a) => a.type !== 'noul')) fail(r.line, `rule ${r.id}: pictures and sound take "ask noul" questions only`);
    }
    if (r.gate === null) r.gate = r.lexicon.length ? 'lexicon' : 'always';
    if (r.gate !== 'lexicon' && r.gate !== 'always') fail(r.line, `rule ${r.id}: gate must be "lexicon" or "always"`);
    if (r.confirm !== 'model' && r.confirm !== 'none') fail(r.line, `rule ${r.id}: confirm must be "model" or "none"`);
    else if (r.confirm === 'model' && !r.asks.some((a) => a.type === 'noul')) fail(r.line, `rule ${r.id}: "confirm: model" needs an "ask noul" question to ask`);
    else if (r.confirm === 'model' && !r.lexicon.length) fail(r.line, `rule ${r.id}: "confirm: model" confirms word-list hits, so it needs a lexicon`);
    if (r.spareChannel && !r.lexicon.length) fail(r.line, `rule ${r.id}: "spare channel" lowers word-list hits, so it needs a lexicon`);
    if (r.spareChannel && !/^[a-z0-9_]+$/.test(r.spareChannel)) fail(r.line, `rule ${r.id}: "spare channel" names a word list (letters, digits and underscores)`);
    if (r.spareWords && !r.lexicon.length) fail(r.line, `rule ${r.id}: "spare words" lowers word-list hits, so it needs a lexicon`);
    if (r.spareWords && !/^[a-z0-9_]+$/.test(r.spareWords)) fail(r.line, `rule ${r.id}: "spare words" names a word list (letters, digits and underscores)`);

    // a score question without usable levels was already reported above; ignore it from here on
    const scoreAsk = r.asks.find((a) => a.type === 'score' && a.levels && a.levels.length >= 2);
    r.levels = scoreAsk ? scoreAsk.levels : null;
    if (r.flagAtRaw === null) {
      r.flagAt = scoreAsk ? 1 : 0.7;
      r.flagAtLabel = scoreAsk ? scoreAsk.levels[scoreAsk.levels.length - 1] : '0.7';
    } else if (scoreAsk && Number.isNaN(Number(r.flagAtRaw))) {
      const i = scoreAsk.levels.indexOf(r.flagAtRaw);
      if (i < 0) fail(r.line, `rule ${r.id}: "flag at" must be one of ${scoreAsk.levels.join(', ')}`);
      r.flagAt = i < 0 ? 1 : i / (scoreAsk.levels.length - 1);
      r.flagAtLabel = r.flagAtRaw;
    } else {
      const v = Number(r.flagAtRaw);
      if (!(v >= 0 && v <= 1)) fail(r.line, `rule ${r.id}: "flag at" must be a number between 0 and 1`);
      r.flagAt = Math.min(1, Math.max(0, v || 0));
      r.flagAtLabel = String(r.flagAt);
    }

    // actions per surface
    const explicit = {};
    let bare = null;
    if (r.actionRaw) {
      for (const part of r.actionRaw.split(',').map((x) => x.trim()).filter(Boolean)) {
        const eq = part.match(/^([a-z-]+)\s*=\s*([a-z-]+)$/);
        if (eq) {
          if (!SURFACES.includes(eq[1])) fail(r.line, `rule ${r.id}: unknown surface "${eq[1]}" in action`);
          else if (!ACTIONS[eq[1]].includes(eq[2])) fail(r.line, `rule ${r.id}: action "${eq[2]}" is not valid for ${eq[1]}`);
          else explicit[eq[1]] = eq[2];
        } else if (/^[a-z-]+$/.test(part)) bare = part;
        else fail(r.line, `rule ${r.id}: cannot read action "${part}"`);
      }
    }
    if (bare && !SURFACES.some((s) => ACTIONS[s].includes(bare))) fail(r.line, `rule ${r.id}: unknown action "${bare}"`);
    for (const s of r.where) {
      if (!SURFACES.includes(s)) continue;
      r.action[s] = explicit[s] || (s === 'related' && explicit['feed-card']) || (bare && ACTIONS[s].includes(bare) ? bare : DEFAULT_ACTION[s]);
    }
  }

  return { pack, rules, errors };
}
