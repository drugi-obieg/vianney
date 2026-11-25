// Word and phrase lexicons: the deterministic first stage.
//
// File format (one entry per line, '#' starts a comment line):
//   weight | entry
// weight  confidence 0..1 that a hit breaks the rule (placeholder tiers until calibrated on a labelled set)
// entry   words matched on normalised tokens; a trailing * on a word means prefix match;
//         several words match consecutive tokens; /regex/ is tested on the normalised text;
//         <censored> matches YouTube's auto-caption marker for a bleeped word.

import { tokenize, normalizeWord, CENSORED } from './text.js';

/** @returns {{entries: object[], errors: {line:number,message:string}[]}} */
export function parseLexicon(text, name = '') {
  const entries = [];
  const errors = [];
  String(text ?? '').split(/\r?\n/).forEach((line, idx) => {
    const raw = line.trim();
    if (!raw || raw.startsWith('#')) return;
    const m = raw.match(/^(\d*\.?\d+)\s*\|\s*(.+)$/);
    if (!m) {
      errors.push({ line: idx + 1, message: 'expected "weight | entry"' });
      return;
    }
    const weight = Number(m[1]);
    if (!(weight >= 0 && weight <= 1)) {
      errors.push({ line: idx + 1, message: 'weight must be between 0 and 1' });
      return;
    }
    let body = m[2].trim();
    if (body.startsWith('/')) {
      const last = body.lastIndexOf('/');
      if (last <= 0) {
        errors.push({ line: idx + 1, message: 'regex entry must end with /' });
        return;
      }
      try {
        entries.push({ kind: 'regex', weight, raw: body, regex: new RegExp(body.slice(1, last), 'g'), lexicon: name });
      } catch (e) {
        errors.push({ line: idx + 1, message: 'bad regex: ' + e.message });
      }
      return;
    }
    body = body.replace(/\s+#.*$/, '');
    const words = [];
    for (const piece of body.split(/\s+/)) {
      if (!piece) continue;
      if (piece === CENSORED) { words.push({ w: CENSORED, prefix: false }); continue; }
      const prefix = piece.endsWith('*') && piece.length > 1;
      const w = normalizeWord(prefix ? piece.slice(0, -1) : piece);
      if (!w) continue;
      words.push({ w, prefix });
    }
    if (!words.length) {
      errors.push({ line: idx + 1, message: 'empty entry' });
      return;
    }
    entries.push({ kind: 'phrase', weight, raw: body, words, lexicon: name });
  });
  return { entries, errors };
}

/**
 * Build a matcher over several named lexicons.
 * @param {Record<string, {entries: object[]}>} lexicons
 */
export function makeMatcher(lexicons) {
  const index = new Map(); // name -> { exact: Map(firstWord -> entry[]), prefix: entry[], regex: entry[] }
  for (const [name, lex] of Object.entries(lexicons || {})) {
    const exact = new Map();
    const prefix = [];
    const regex = [];
    for (const e of lex.entries || []) {
      if (e.kind === 'regex') regex.push(e);
      else if (e.words[0].prefix) prefix.push(e);
      else {
        const k = e.words[0].w;
        if (!exact.has(k)) exact.set(k, []);
        exact.get(k).push(e);
      }
    }
    index.set(name, { exact, prefix, regex });
  }

  function phraseAt(entry, tokens, i) {
    const ws = entry.words;
    if (i + ws.length > tokens.length) return false;
    for (let k = 0; k < ws.length; k++) {
      const t = tokens[i + k].t;
      if (ws[k].prefix ? !t.startsWith(ws[k].w) : t !== ws[k].w) return false;
    }
    return true;
  }

  /**
   * Find lexicon hits in a token array (see tokenize()).
   * @returns {{lexicon:string,entry:string,weight:number,from:number,to:number}[]} sorted by position
   */
  function match(tokens, names) {
    const hits = [];
    const wanted = names && names.length ? names : [...index.keys()];
    const norm = tokens.map((x) => x.t).join(' ');
    let starts = null;
    for (const name of wanted) {
      const ix = index.get(name);
      if (!ix) continue;
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i].t;
        const cand = ix.exact.get(t);
        if (cand) {
          for (const e of cand) if (phraseAt(e, tokens, i)) hits.push({ lexicon: name, entry: e.raw, weight: e.weight, from: i, to: i + e.words.length - 1 });
        }
        for (const e of ix.prefix) if (phraseAt(e, tokens, i)) hits.push({ lexicon: name, entry: e.raw, weight: e.weight, from: i, to: i + e.words.length - 1 });
      }
      if (ix.regex.length) {
        if (!starts) {
          starts = [];
          let pos = 0;
          for (const tok of tokens) { starts.push(pos); pos += tok.t.length + 1; }
        }
        for (const e of ix.regex) {
          e.regex.lastIndex = 0;
          let m;
          while ((m = e.regex.exec(norm)) !== null) {
            if (m[0] === '') { e.regex.lastIndex++; continue; }
            const a = m.index;
            const b = m.index + m[0].length - 1;
            let from = starts.findIndex((s, k) => s + tokens[k].t.length > a);
            let to = from;
            for (let k = from; k < tokens.length; k++) { if (starts[k] <= b) to = k; else break; }
            if (from >= 0) hits.push({ lexicon: name, entry: e.raw, weight: e.weight, from, to });
          }
        }
      }
    }
    // keep the heaviest hit for every identical token span
    const best = new Map();
    for (const h of hits) {
      const key = h.from + ':' + h.to;
      if (!best.has(key) || best.get(key).weight < h.weight) best.set(key, h);
    }
    return [...best.values()].sort((a, b) => a.from - b.from || a.to - b.to);
  }

  /** Convenience: tokenise a string and match it. */
  function matchText(text, names) {
    const tokens = tokenize(text);
    return { tokens, hits: match(tokens, names) };
  }

  return { match, matchText, names: () => [...index.keys()] };
}

export function maxWeight(hits) {
  return hits.reduce((m, h) => Math.max(m, h.weight), 0);
}
