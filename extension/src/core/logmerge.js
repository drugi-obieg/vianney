// The activity log keeps one row for each thing that was checked, not one for each time it was checked.
//
// YouTube redraws its page all the time, a scan looks at the same card again after every change of the settings, and the same video comes back
// in the next list: each of those used to add a row, so one flagged video could fill the page. Rows are now joined by (surface, id). The row says how many
// times it was seen (`n`), when it was first seen (`t0`) and last seen (`t`, the time the list is ordered by).
//
// The latest verdict wins, because it comes from the rules and settings in force now. The two surfaces that log once for each passage (subtitles, audio)
// are different: what they found in one passage does not replace what they found in another, so their findings are added up.
// Pure functions, no extension API; tested in tests/logmerge.test.js.

const ADDS_UP = new Set(['subtitles', 'audio']);
const HITS_CAP = 30;       // the passages one row remembers

/** What makes two entries the same thing: the same kind of place and the same video (or comment). */
export function logKey(e) {
  const id = e && e.id ? String(e.id) : `${(e && e.title) || ''}|${(e && e.channel) || ''}`;
  return `${(e && e.surface) || ''}|${id}`;
}

const union = (a = [], b = []) => [...new Set([...a, ...b])];

function mergeHits(a = [], b = []) {
  const byRule = new Map();
  for (const h of [...a, ...b]) {
    const seen = byRule.get(h.rule) || [];
    byRule.set(h.rule, union(seen, h.hits || []));
  }
  let room = HITS_CAP;
  const out = [];
  for (const [rule, hits] of byRule) {
    const kept = hits.slice(0, Math.max(0, room));
    room -= kept.length;
    if (kept.length) out.push({ rule, hits: kept });
  }
  return out;
}

/** The row `old` and the new `entry` of the same thing as one row. */
export function mergeEntry(old, entry) {
  const base = { ...old, ...entry };
  base.n = (old.n || 1) + (entry.n || 1);
  base.t0 = Math.min(old.t0 || old.t || Infinity, entry.t0 || entry.t || Infinity);
  if (!Number.isFinite(base.t0)) delete base.t0;
  base.t = Math.max(old.t || 0, entry.t || 0);
  if (ADDS_UP.has(entry.surface)) {
    base.ps = {};
    for (const src of [old.ps || {}, entry.ps || {}]) for (const [rule, p] of Object.entries(src)) base.ps[rule] = Math.max(base.ps[rule] || 0, p);
    base.flagged = union(old.flagged, entry.flagged);
    base.uncertain = union(old.uncertain, entry.uncertain).filter((r) => !base.flagged.includes(r));
    base.action = [...new Set([...(old.action ? String(old.action).split(',') : []), ...(entry.action ? String(entry.action).split(',') : [])])].join(',') || null;
    base.via = entry.via || old.via || null;
    base.hits = mergeHits(old.hits, entry.hits);
  }
  if (!entry.error) delete base.error;
  return base;
}

/**
 * Add an entry: into the row of the same thing when there is one (that row moves to the end, as the newest), else as a new row.
 * Returns a new array, at most `max` rows long (the oldest go first).
 */
export function addToLog(log, entry, max = Infinity) {
  const rows = Array.isArray(log) ? [...log] : [];
  const key = logKey(entry);
  let at = -1;
  for (let i = rows.length - 1; i >= 0; i--) if (logKey(rows[i]) === key) { at = i; break; }   // the same thing is usually near the end
  if (at >= 0) rows.push(mergeEntry(rows.splice(at, 1)[0], entry));
  else rows.push({ ...entry, n: entry.n || 1, t0: entry.t0 || entry.t });
  return rows.length > max ? rows.slice(rows.length - max) : rows;
}

/** A log from before rows were joined, as one row for each thing. Rows keep the order of their last sighting. */
export function compactLog(log, max = Infinity) {
  const sorted = [...(Array.isArray(log) ? log : [])].sort((a, b) => (a.t || 0) - (b.t || 0));
  let out = [];
  for (const e of sorted) out = addToLog(out, e);
  return out.length > max ? out.slice(out.length - max) : out;
}
