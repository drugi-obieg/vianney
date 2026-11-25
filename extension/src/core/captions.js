// Captions: parse YouTube's json3 timed text into word tokens with times, and plan mute/skip spans.
//
// json3 shape (auto-generated captions): {events:[{tStartMs, dDurationMs, segs:[{utf8, tOffsetMs}]}]}
// Auto-generated captions carry a start offset per word; manual captions usually do not, so their
// words are spread over the event's duration by character count (flagged as approximate).

import { tokenize } from './text.js';

/**
 * @returns {{tokens: {raw:string,t:string,start:number,end:number}[], approx: boolean, events: number}}
 */
export function parseJson3(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  const tokens = [];
  let approx = false;
  let events = 0;
  for (const ev of (data && data.events) || []) {
    if (!ev.segs) continue;
    const evStart = (ev.tStartMs || 0) / 1000;
    const evEnd = evStart + (ev.dDurationMs || 0) / 1000;
    const words = [];
    ev.segs.forEach((seg) => {
      const parts = tokenize(seg.utf8 || '');
      parts.forEach((p, i) => {
        words.push({ raw: p.raw, t: p.t, start: i === 0 && seg.tOffsetMs != null ? evStart + seg.tOffsetMs / 1000 : null });
      });
    });
    if (!words.length) continue;
    events++;
    if (words[0].start === null) words[0].start = evStart;
    // fill gaps between known starts proportionally to word length
    let i = 0;
    while (i < words.length) {
      if (words[i].start !== null) { i++; continue; }
      const prevIdx = i - 1;
      let j = i;
      while (j < words.length && words[j].start === null) j++;
      const from = words[prevIdx].start;
      const to = j < words.length ? words[j].start : Math.max(evEnd, from + 0.2 * (j - prevIdx));
      const span = words.slice(prevIdx, j).reduce((n, w) => n + w.raw.length, 0) || 1;
      let acc = words[prevIdx].raw.length;
      for (let k = i; k < j; k++) {
        words[k].start = from + ((to - from) * acc) / span;
        acc += words[k].raw.length;
      }
      approx = true;
      i = j;
    }
    words.forEach((w, k) => {
      const next = k + 1 < words.length ? words[k + 1].start : Math.max(evEnd, w.start + 0.3);
      tokens.push({ raw: w.raw, t: w.t, start: w.start, end: Math.max(next, w.start + 0.05) });
    });
  }
  return { tokens, approx, events };
}

/**
 * Turn decisions (see Engine.evaluateSubtitles) into sorted, merged spans in seconds.
 * @param {{action:string,start?:number,end?:number,ruleId?:string,p?:number,text?:string}[]} decisions
 */
export function buildSpans(decisions, { pre = 0.12, post = 0.18 } = {}) {
  const raw = decisions
    .filter((d) => typeof d.start === 'number' && typeof d.end === 'number')
    .map((d) => ({ action: d.action, start: Math.max(0, d.start - pre), end: d.end + post, rules: [d.ruleId], text: d.text }))
    .sort((a, b) => a.start - b.start);
  const out = [];
  for (const s of raw) {
    const last = out[out.length - 1];
    if (last && last.action === s.action && s.start <= last.end + 0.05) {
      last.end = Math.max(last.end, s.end);
      last.text += ' | ' + s.text;
      for (const r of s.rules) if (!last.rules.includes(r)) last.rules.push(r);
    } else out.push({ ...s, rules: [...s.rules] });
  }
  return out;
}

/** The span that contains time t, or null. Spans must be sorted and non-overlapping per action. */
export function findActive(spans, t) {
  let lo = 0;
  let hi = spans.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = spans[mid];
    if (t < s.start) hi = mid - 1;
    else if (t > s.end) lo = mid + 1;
    else return s;
  }
  // spans of different actions may overlap: check the neighbours before giving up
  for (let k = Math.max(0, lo - 2); k <= Math.min(spans.length - 1, lo + 1); k++) {
    if (t >= spans[k].start && t <= spans[k].end) return spans[k];
  }
  return null;
}
