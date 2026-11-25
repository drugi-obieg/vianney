// Text normalisation and tokenisation shared by every part of the extension.
// Pure functions only: no browser APIs, so the same code runs in Node tests.

const MARKS = /[\u0300-\u036f]/g;

// YouTube's auto-captions show a bleeped word as "[ __ ]" (sometimes with non-breaking spaces).
export const CENSORED = '<censored>';
const CENSOR_MARKER = /\[[\s\u00a0]*_+[\s\u00a0]*\]/;

// A token is a run of letters/digits/asterisks (asterisks keep masked words such as "f***" together),
// optionally with inner apostrophes ("don't"), or the censor marker.
const TOKEN_RE = new RegExp(CENSOR_MARKER.source + "|[\\p{L}\\p{N}*]+(?:['\u2018\u2019\u02bc][\\p{L}\\p{N}]+)*", 'gu');

/** Normalise one word for matching: strip accents, lower-case, unify apostrophes. */
export function normalizeWord(word) {
  if (CENSOR_MARKER.test(word)) return CENSORED;
  return String(word)
    .normalize('NFKD')
    .replace(MARKS, '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc\u00b4`]/g, "'");
}

/**
 * Split text into tokens. Each token keeps its original character offsets (s, e) so that
 * callers can mask or highlight words in the original string.
 * @returns {{raw:string,t:string,s:number,e:number}[]}
 */
export function tokenize(text) {
  const out = [];
  const src = String(text ?? '');
  TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = TOKEN_RE.exec(src)) !== null) {
    const raw = m[0];
    if (/^\*+$/.test(raw)) continue; // a lone bullet or emphasis marker is not a word
    out.push({ raw, t: normalizeWord(raw), s: m.index, e: m.index + raw.length });
  }
  return out;
}

/** Lower-cased, accent-stripped text with single spaces, as regex lexicon entries see it. */
export function normalizeText(text) {
  return tokenize(text).map((tok) => tok.t).join(' ');
}

/** Replace the given token ranges of `text` with a mask. Ranges are inclusive token indices. */
export function maskTokens(text, tokens, ranges, mask = '\u25ae\u25ae\u25ae') {
  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  let out = '';
  let cursor = 0;
  for (const { from, to } of sorted) {
    const a = tokens[from]?.s;
    const b = tokens[to]?.e;
    if (a == null || b == null || a < cursor) continue;
    out += text.slice(cursor, a) + mask;
    cursor = b;
  }
  return out + text.slice(cursor);
}

/** Short stable hash (FNV-1a, 32 bit) for cache keys. */
export function hashText(text) {
  let h = 0x811c9dc5;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}
