// The pure parts of the break reminder when it is drawn as a video or as a comment: where it goes, and how its small texts are written.
// (The drawing itself is content/breakcard.js; everything here can be tested without a browser.)
//
// The numbers marked CHOICE are the writer's (the owner fixed the principle: "random places, not directly obvious", never first, one at a time).

import { formatDuration } from './breaktimer.js';

/** Fewer than this many items on the page and the reminder waits (CHOICE: it needs real neighbours on both sides to pass as one of them). */
export const MIN_ITEMS = 3;
/** The video goes at index 1..7 of the cards of the list (the owner's number). Index 0, the first card, is never used. */
export const MAX_CARD_INDEX = 7;
/** The comment goes at index 1..10 of the loaded threads (CHOICE: the owner said "1.." without an end; a place far down is seen by hardly anyone). */
export const MAX_COMMENT_INDEX = 10;

const clamp = (r) => (r >= 0 && r < 1 ? r : 0);

/**
 * The index (0-based) before which the item is put, among `n` items that are on the page. Never 0 (never first); null when too few items are
 * there (fewer than MIN_ITEMS: wait until the page has loaded more).
 * @param {number} n how many items there are
 * @param {() => number} rand a function that gives a number in [0, 1)
 * @param {number} [max] the highest index that may be used
 */
export function pickIndex(n, rand, max = MAX_CARD_INDEX) {
  if (!(n >= MIN_ITEMS)) return null;
  const top = Math.min(max, n - 1);
  return 1 + Math.floor(clamp(rand()) * top);   // 1..top
}

/**
 * What a video page gets: the video in the list of recommendations, or the comment. When both are possible it is a coin toss; when only one is
 * possible (comments only load when the user scrolls down to them), that one. null when neither is possible.
 * @param {() => number} rand
 * @param {{video: boolean, comment: boolean}} can
 */
export function pickKind(rand, can) {
  if (can.video && can.comment) return clamp(rand()) < 0.5 ? 'video' : 'comment';
  if (can.video) return 'video';
  if (can.comment) return 'comment';
  return null;
}

/**
 * The place on the site that a pick belongs to. A new place is a new pick. On a video page only the video counts (YouTube puts a time into the
 * address when you jump to a chapter, and that must not move the reminder).
 */
export function locationKey(pathname, search) {
  if (pathname === '/watch') {
    const v = new URLSearchParams(search).get('v');
    return v ? `/watch?v=${v}` : pathname;
  }
  return pathname + search;
}

/** The watched time as YouTube writes the length of a video: "7:00", "1:07:00" (CHOICE: whole minutes, like the sentence "1 hour 7 minutes" next to it). */
export function clockText(seconds) {
  const m = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(m / 60);
  const r = String(m % 60).padStart(2, '0');
  return h ? `${h}:${r}:00` : `${m % 60}:00`;
}

/** The line under the title of the video, where YouTube writes the views and the age (CHOICE of wording). */
export function watchingText(seconds) {
  return `Watching for ${formatDuration(seconds)}`;
}

/** The sentence of the comment, and of the description of the video in a list of search results. `message` is the user's own wording, if they set one. */
export function sentenceText(seconds, message) {
  const own = message && message.trim();
  return `You've been watching for ${formatDuration(seconds)}. ${own || 'This is a good moment to take a break.'}`;
}

/** The age of the comment as YouTube writes it: "1 minute ago", "3 minutes ago", "1 hour ago". It grows while the comment is on the page (CHOICE: a comment that stays "1 minute ago" for an hour gives itself away). */
export function agoText(minutes) {
  const m = Math.max(1, Math.floor(minutes));
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  return `${h} hour${h === 1 ? '' : 's'} ago`;
}
