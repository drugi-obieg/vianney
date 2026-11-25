// Allow and block lists: the deterministic stage that comes before any rule or model.
//
// The user's lists always win over a classifier. They are the main way to correct a misfire:
//   allow  = never flag this video or channel (a false alarm)
//   block  = always hide this video or channel (a miss)
// If something is on both, allow wins, so a mistake in one list can always be undone from the other.

const MARKS = /[\u0300-\u036f]/g;

export function normalizeName(s) {
  return String(s == null ? '' : s).normalize('NFKD').replace(MARKS, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const VIDEO_ID = /^[\w-]{11}$/;

/** A video id from an id, a watch URL, a youtu.be URL or a shorts URL; null when there is none. */
export function videoIdFrom(text) {
  const t = String(text || '').trim();
  if (VIDEO_ID.test(t)) return t;
  const m = t.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/embed\/)([\w-]{11})(?![\w-])/);
  return m ? m[1] : null;
}

/** One entry per non-empty line; '#' starts a comment. */
export function parseListText(text) {
  return String(text || '').split(/\r?\n/).map((l) => l.replace(/\s+#.*$/, '').trim()).filter((l) => l && !l.startsWith('#'));
}

export const EMPTY_LISTS = Object.freeze({ allowVideos: [], allowChannels: [], denyVideos: [], denyChannels: [] });

/**
 * @param {{allowVideos?:string[],allowChannels?:string[],denyVideos?:string[],denyChannels?:string[]}} lists
 * @param {{id?: string, channel?: string}} item
 * @returns {'allow'|'deny'|null}
 */
export function listVerdict(lists, item) {
  const l = lists || EMPTY_LISTS;
  const id = item.id || '';
  const ch = normalizeName(item.channel).replace(/^@/, '');
  const hasChannel = (arr) => ch && (arr || []).some((x) => normalizeName(x).replace(/^@/, '') === ch);
  if ((l.allowVideos || []).includes(id) || hasChannel(l.allowChannels)) return 'allow';
  if ((l.denyVideos || []).includes(id) || hasChannel(l.denyChannels)) return 'deny';
  return null;
}

/** Add a value to a list (no duplicates); returns a new lists object. */
export function addToList(lists, key, value) {
  const l = { ...EMPTY_LISTS, ...(lists || {}) };
  const v = String(value || '').trim();
  if (!v || (l[key] || []).includes(v)) return l;
  return { ...l, [key]: [...(l[key] || []), v] };
}
