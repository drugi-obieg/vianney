// Clean up: hide the extras that YouTube puts around videos (Shorts, Games, Movies & TV, the Explore part of the sidebar, banners and
// shelves with a title the user names). Pure functions, so that they can be tested; content/cleanup.js applies them to the page.
//
// The selectors come from the real page (German interface, measured 2026-11-26), and they avoid words wherever the page offers
// something else to hold on to: element names (ytd-reel-shelf-renderer), what is inside a shelf (a Shorts card, a Playables card, a movie
// card) and where a link goes (/gaming, /feed/storefront). Only the Shorts entry of the sidebar is found by its name, "Shorts", which is
// the same in every language. Only shelves that are named by the user are matched by their title.

export const CLEANUP_DEFAULTS = Object.freeze({
  shorts: true,            // Shorts shelves, Shorts shown as ordinary results, the Shorts entry of the sidebar
  shortsAsVideos: true,    // a /shorts/ address opens in the normal player instead
  games: true,             // Gaming and Playables
  movies: true,            // Movies & TV: the entry, shelves and movie results
  explore: true,           // the Explore section of the sidebar (Music, Live, Podcasts and so on)
  more: true,              // "More from YouTube": Premium, YouTube Music, Kids, Labs
  banners: true,           // suggestion banners and the topic chips above the feed
  music: false,            // videos that YouTube marks as music (the note on the length, the badge of an official artist channel): off until the owner switches it on (core/musicmark.js)
  shelfTitles: ['Von YouTube empfohlen', 'Recommended by YouTube'],   // hide any shelf whose title contains one of these
});

/** The switches that act through the stylesheet, in the order of the settings page. */
export const TOKENS = ['shorts', 'games', 'movies', 'explore', 'more', 'banners'];

const hide = (token, selectors) => selectors.map((s) => `html[data-vianney-clean~="${token}"] ${s}`).join(',\n') + ' { display: none !important; }';
const entry = (inner) => [`ytd-guide-entry-renderer:has(${inner})`, `ytd-mini-guide-entry-renderer:has(${inner})`];
const shortsLink = 'a[href^="/shorts/"]';

export const CLEANUP_CSS = [
  hide('shorts', [
    'ytd-reel-shelf-renderer',                                              // the Shorts shelf in search, on the watch page and elsewhere
    'ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])',   // the Shorts shelf of the home feed
    'ytd-rich-section-renderer:has(ytm-shorts-lockup-view-model)',
    'grid-shelf-view-model:has(ytm-shorts-lockup-view-model)',             // the Shorts shelf of search results, header included
    ...['ytd-video-renderer', 'ytd-rich-item-renderer', 'ytd-compact-video-renderer', 'ytd-grid-video-renderer', 'yt-lockup-view-model'].map((t) => `${t}:has(${shortsLink})`),
    ...entry('a[title="Shorts"]'),
    'ytd-mini-guide-entry-renderer[aria-label="Shorts"]',
  ]),
  hide('games', [
    ...entry('a[href="/gaming"]'),
    ...entry('a[href="/playables"]'),
    'ytd-rich-section-renderer:has(ytd-mini-game-card-view-model)',
  ]),
  hide('movies', [
    ...entry('a[href^="/feed/storefront"]'),
    'ytd-movie-renderer',
    'ytd-compact-movie-renderer',
    'ytd-shelf-renderer:has(ytd-grid-movie-renderer)',
    'ytd-shelf-renderer:has(ytd-movie-renderer)',
  ]),
  // the section that holds Music, Live, Gaming, Podcasts and so on; it is found by its Music entry, which links to a fixed channel
  hide('explore', ['ytd-guide-section-renderer:has(a[href="/channel/UC-9-kyTW8ZkZNDHQJ6FgpwQ"])']),
  hide('more', ['ytd-guide-section-renderer:has(a[href="/premium"])']),
  hide('banners', [
    'ytd-feed-nudge-renderer',
    'ytd-rich-section-renderer:has(ytd-feed-nudge-renderer)',
    'ytd-statement-banner-renderer',
    'ytd-browse[page-subtype="home"] ytd-feed-filter-chip-bar-renderer',
  ]),
  // shelves that the user named by title (content/cleanup.js sets the attribute)
  '[data-vianney-shelf="hidden"] { display: none !important; }',
].join('\n');

/** The tokens that go into the attribute on <html>: the switches that are on. */
export function cleanupTokens(cfg) {
  const c = { ...CLEANUP_DEFAULTS, ...(cfg || {}) };
  return TOKENS.filter((t) => c[t] !== false);
}

/** Shelf titles from the settings: trimmed, lower case, without empty lines and repeats. */
export function normalizeTitles(titles) {
  const list = Array.isArray(titles) ? titles : String(titles || '').split('\n');
  return [...new Set(list.map((t) => String(t).replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean))];
}

/** True when the title of a shelf contains one of the (normalized) titles. */
export function titleMatches(title, normalized) {
  const t = String(title || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return !!t && normalized.some((n) => t.includes(n));
}

/** "/shorts/abc123DEF45" becomes "/watch?v=abc123DEF45"; anything else is null. */
export function shortsWatchPath(pathname) {
  const m = /^\/shorts\/([\w-]{11})(?:[/?#]|$)/.exec(pathname || '');
  return m ? `/watch?v=${m[1]}` : null;
}

/** The elements that can be a shelf with a title. */
export const SHELF_SELECTOR = 'ytd-shelf-renderer, ytd-rich-shelf-renderer, ytd-reel-shelf-renderer, ytd-horizontal-card-list-renderer, grid-shelf-view-model, ytd-rich-section-renderer';
/** Where a shelf keeps its title. */
export const TITLE_SELECTOR = '#title, h2, [role="heading"]';
