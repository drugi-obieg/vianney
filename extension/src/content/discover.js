import { isMusic } from '../core/musicmark.js';
// Find video cards on a YouTube page without depending on YouTube's element names.
//
// Method (prototyped and measured in plan.md section 3.6):
//   1. every link whose href holds /watch?v=<id> or /shorts/<id> yields a video id;
//   2. the card of an id is the largest ancestor that still contains links to that id only;
//   3. a candidate counts as a card only if it is one of several repeated siblings and has a
//      plausible size (so links in a description or a page-level wrapper are never hidden).
// The small exclusion list below only keeps out places that are known to hold stray links.

const ID_RE = /(?:[?&]v=|\/shorts\/)([\w-]{11})(?![\w-])/;
const LINKS = 'a[href*="/watch?v="], a[href*="/shorts/"]';
const EXCLUDE = '#comments, ytd-comments, ytd-masthead, [data-vianney-ui]';
// The player holds links to the first recommendations of the list next to it: its Next button, and the grid of stills of its end screen and of
// full screen. Counted together with the list's own links they spread a video over the whole page, which then is no card (and the first
// recommendations were never filtered). A button is no card at all, the stills are cards of their own (and only when they are drawn).
const PLAYER = '#movie_player, .html5-video-player';
const CONTROLS = '.ytp-next-button, .ytp-prev-button';

/** True for what is inside the video player (its end screen holds cards of its own: nothing else of the page, such as the break card, goes there). */
export const inPlayer = (el) => !!el.closest(PLAYER);
const CHANNEL_LINKS = 'a[href^="/@"], a[href*="/channel/"], a[href^="/c/"], a[href^="/user/"]';

export function videoIdOf(anchor) {
  const m = (anchor.getAttribute('href') || '').match(ID_RE);
  return m ? m[1] : null;
}

function idsIn(el, memo) {
  if (memo && memo.has(el)) return memo.get(el);
  const ids = new Set();
  el.querySelectorAll(LINKS).forEach((a) => { const i = videoIdOf(a); if (i) ids.add(i); });
  if (memo) memo.set(el, ids);
  return ids;
}

// The card of ONE link: the largest ancestor of it that holds links to this video only. Each link finds its own card (the thumbnail and the title of a card climb to the same
// element), so that a video that appears in two places of the page is two cards. It used to be one group of all its links, whose common ancestor was most of the page, and
// then neither place was a card: the first results of a search for music, which also stand in a Mix further down, were never looked at (found 2026-11-26, by the music option).
function cardElementOf(anchor, id, memo) {
  let el = anchor;
  while (el.parentElement && el.parentElement !== document.body && el.parentElement !== document.documentElement) {
    const ids = idsIn(el.parentElement, memo);
    if (ids.size === 1 && ids.has(id)) el = el.parentElement;
    else break;
  }
  return el;
}

function plausibleSize(el) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  if (r.height > window.innerHeight * 1.6) return false;
  if (r.width > window.innerWidth * 0.98 && r.height > window.innerHeight * 0.5) return false;
  return true;
}

/**
 * @param {ParentNode} root
 * @returns {{id:string, el:Element, anchors:Element[]}[]} in document order
 */
export function findCards(root = document) {
  const memo = new Map();
  const byElement = new Map();
  root.querySelectorAll(LINKS).forEach((a) => {
    if (a.closest(EXCLUDE) || a.matches(CONTROLS)) return;
    const id = videoIdOf(a);
    if (!id) return;
    const el = cardElementOf(a, id, memo);
    if (!byElement.has(el)) byElement.set(el, { id, el, anchors: [] });
    byElement.get(el).anchors.push(a);
  });
  const candidates = [...byElement.values()];
  const set = new Set(byElement.keys());
  const cards = candidates.filter((c) => {
    const parent = c.el.parentElement;
    if (!parent) return false;
    let siblings = 0;
    for (const child of parent.children) if (set.has(child)) siblings++;
    return siblings >= 2 && plausibleSize(c.el);
  });
  cards.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  return cards;
}

// Where the recommendations of a video page are: the list next to (or, in a narrow window, under) the video, and the cards that the player
// shows when the video ends. A playlist you play from sits in the same column but is yours, not a recommendation.
const RELATED = '#related, ytd-watch-next-secondary-results-renderer, .ytp-endscreen-content, .ytp-ce-element, .ytp-fullscreen-grid';
const PLAYLIST = 'ytd-playlist-panel-renderer';

/** "related" for a card that YouTube recommends on a video page, "feed-card" for every other card (lists, search results, channel pages). */
export function cardSurface(el) {
  if (location.pathname !== '/watch') return 'feed-card';
  if (el.closest(PLAYLIST)) return 'feed-card';
  return el.closest(RELATED) ? 'related' : 'feed-card';
}

const TIME_UNITS = '(?:hours?|stunden?|heures?|horas?|ore|minutes?|minuten?|minutos?|minuti|seconds?|sekunden?|secondes?|segundos?|secondi)';
const TAIL_DURATION = new RegExp(`\\s+\\d+\\s+${TIME_UNITS}(?:\\s*(?:,|and|und|et|y|e)?\\s*\\d+\\s+${TIME_UNITS})*\\s*$`, 'i');

function cleanLabel(label) {
  return label.replace(/\s+/g, ' ').replace(TAIL_DURATION, '').trim();
}

/** Title and channel of a card, from attributes and text. Empty strings when not found. */
/** What the card shows of YouTube's own music marks (core/musicmark.js says what they are): the thumbnail badges, and the small icons beside the channel name. */
export function musicSignals(el) {
  const badges = [...el.querySelectorAll('badge-shape')].map((b) => ({ text: b.textContent || '', hasIcon: !!b.querySelector('svg') }));
  const icons = [...el.querySelectorAll('badge-shape[role="img"], .ytContentMetadataViewModelIcon')];
  return {
    badges,
    labels: icons.map((i) => i.getAttribute('aria-label') || ''),
    paths: icons.flatMap((i) => [...i.querySelectorAll('svg path')].map((p) => p.getAttribute('d') || '')),
  };
}

export function extractMeta(card) {
  const el = card.el;
  let title = '';
  for (const a of card.anchors) {
    const t = (a.getAttribute('title') || '').trim();
    if (t.length > title.length) title = t;
  }
  if (!title) {
    const heading = el.querySelector('#video-title, h3, [id*="title"]');
    if (heading) title = (heading.getAttribute('title') || heading.textContent || '').replace(/\s+/g, ' ').trim();
  }
  if (!title) {
    for (const a of card.anchors) {
      const t = cleanLabel(a.getAttribute('aria-label') || a.textContent || '');
      if (t.length > title.length) title = t;
    }
  }
  let channel = '';
  for (const a of el.querySelectorAll(CHANNEL_LINKS)) {
    const t = (a.textContent || '').replace(/\s+/g, ' ').trim();
    if (t) { channel = t; break; }
  }
  return { id: card.id, title, channel, music: isMusic(musicSignals(el)) };
}
