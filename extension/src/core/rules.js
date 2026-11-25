// Parser for the plain-text rule format (see plan.md section 5 and extension/rules/*.rules).

export const TEXT_SURFACES = ['feed-card', 'watch-meta', 'subtitles'];
// Experimental: judged by the on-device model from a thumbnail picture or from a few seconds of sound.
export const MEDIA_SURFACES = ['thumbnail', 'audio'];
export const SURFACES = [...TEXT_SURFACES, ...MEDIA_SURFACES];
export const ACTIONS = {
  'feed-card': ['hide', 'blank', 'dim', 'label'],
  'watch-meta': ['warn-overlay', 'label'],
  subtitles: ['mute-word', 'skip-segment', 'censor-caption'],
  thumbnail: ['blur', 'hide', 'blank', 'dim', 'label'],
  audio: ['pause-overlay', 'mute-next', 'label'],
};
export const DEFAULT_ACTION = { 'feed-card': 'hide', 'watch-meta': 'warn-overlay', subtitles: 'mute-word', thumbnail: 'blur', audio: 'pause-overlay' };

const RULE_KEYS = new Set(['title', 'source', 'where', 'lexicon', 'gate', 'flag at', 'action', 'enabled', 'levels', 'refusal']);

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
        id: ruleHead[1], title: ruleHead[1], source: '', where: [], lexicon: [], asks: [], gate: null,
        flagAtRaw: null, flagAt: 0.7, actionRaw: null, action: {}, enabled: true, refusal: 'ignore', line: n,
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
      case 'source': cur.source = value.trim(); break;
      case 'where': cur.where = list(value); break;
      case 'lexicon': cur.lexicon = list(value); break;
      case 'gate': cur.gate = stripComment(value); break;
      case 'flag at': cur.flagAtRaw = stripComment(value); break;
      case 'action': cur.actionRaw = stripComment(value); break;
      case 'enabled': cur.enabled = stripComment(value) !== 'false'; break;
      case 'refusal': cur.refusal = stripComment(value); break;
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
      r.action[s] = explicit[s] || (bare && ACTIONS[s].includes(bare) ? bare : DEFAULT_ACTION[s]);
    }
  }

  return { pack, rules, errors };
}
