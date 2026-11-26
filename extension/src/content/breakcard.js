// The break reminder, drawn as the real thing: a VIDEO in a list of videos, or a COMMENT under a video. One at a time, in a place chosen at random,
// never first, never a popup; the user may simply ignore it. The owner's words (2026-11-26): "I want this to be exactly like a video, with random-ish
// titles ... basically satirized clickbait titles", "it should show up in random places, not directly obvious, in comments sections, in video titles: the
// user can ignore it, the system should just subtly tell it to take a break and how long he's been watching", "the only indication that this is a
// fake comment is that it should have a picture of vianney as the channel icon or thumbnail", "so you go 'huh, what was that?' and it's not a
// 'popup in your face'". So nothing on it says "extension" or "reminder" (the aria-label, for screen readers, does); the portrait of St. Jean-Marie
// Vianney (vianney-image.js) on the round channel picture and on the thumbnail is the only tell.
//
// What it is made of. The item is a plain <div data-vianney-ui="break-video|break-comment"> with a shadow root (YouTube's style sheets cannot reach into
// it, and its own markup is never copied: it is drawn here, with measured numbers). It has no link in it (so the card finder and the comment filter never
// see it), and it uses no position:fixed (it sits in the flow of the list, like the item it stands between). The title of the video is chosen once per
// appearance (core/breaktitles.js) and does not change; the watched time in the line under it, in the badge and in the comment is rewritten in place.
// Clicking the thumbnail or the title does what "Remind me later" does and never opens anything; the three dots open a small menu with that and "Dismiss".
//
// Where it goes (core/breakitem.js has the pure parts): while a reminder is due, once the page has at least three items, at index 1..7 of the video cards
// (the list in the middle of a search, the recommendations next to a video, the grid of a channel or of the home page), or at index 1..10 of the loaded comments.
// A video page chooses between the two by a coin toss, or takes the one that exists (comments only load when the user scrolls to them). The choice is made once
// per place on the site and kept: the 1.5 s loop of main.js only puts the item back if YouTube removed it (where it was, or at a new random place if that
// is gone too) and rewrites the times. A new place (the address changes, or yt-navigate-finish) is a new choice.
//
// MEASURED in the real page (signed out, English, Chrome 158, 2026-11-26; computed styles and getBoundingClientRect; the numbers below are copied from there).
// The sizes of the page are read again from the real neighbour card at every placing and every loop (measure()), because YouTube changes some of them with the
// width of the window; these are the ones that do not change, and the ones used when the neighbour cannot be read.
//   Grid card (home, channel, hashtag; a signed-out home page is empty, so this was measured on a hashtag page and on a channel's videos, which have the same grid):
//     margin 0 8px 32px; thumbnail 16:9, radius 12; duration badge 12/18 px weight 500, white on rgba(0,0,0,.6), radius 4,
//     padding 1px 4px, 8 px from the corner; avatar 36 px at margin 12px 12px 0 0; title 16/22 weight 500, two lines, margin 12px 0 4px, colour #0f0f0f (dark
//     #f1f1f1); channel and metadata 14/20, colour #606060 (dark #aaa); the three dots: a 40 px button, icon 24, 4 px under the top of the text and 12 px outside
//     the right edge; on hover two buttons of 28 px (rgba(0,0,0,.8), radius 4) at 8 px from the right, 8 px and 40 px from the top.
//   Search result (row): thumbnail 240..500 px wide (about 49% of the row), radius 12, gap 16; title 18/26 weight 400, two lines; metadata line 12/18; channel
//     row padding 12px 0 with a 24 px avatar and 8 px gap, name 12/18; description 12/18, two lines, margin-bottom 8; the dots at the right edge, 11 px above
//     the top; margin-top 16.
//   Recommendation (compact): thumbnail 200..330 px wide, radius 8 (12 from 1500 px window width), gap 12; title 12/18, 14/20, 16/22 or 18/26 weight 500
//     depending on the window; channel and metadata 12/18, 2 px apart; the dots appear on hover at the bottom right; the badge sits 4 px from the corner; the
//     hover fill reaches 6 px beyond the card, radius 8, the colour of the thumbnail at 13% (dark: 17%); cards are 8 px apart.
//   Comment: avatar 36 px (not 40), gap 16; handle 12/18 weight 500, age 12/18 #606060, text 14/20; buttons 32 px with 18 px icons, "Reply" 12/32 weight 500;
//     the dots 40 px at the top right, 12 px above the top; margin-bottom 16.
//   Menu: radius 12, shadow 0 4px 32px rgba(0,0,0,.1), background #fff (dark #282828), padding 8px 0, no minimum width, items 36 px, padding 0 12px 0 16px, icon 24 + 12 px,
//     text 14/20, item hover rgba(0,0,0,.05) (dark rgba(255,255,255,.1)); it opens 8 px under the button, at its left edge; z-index 2202.
//   The icons (three dots, clock, queue, like, dislike) are the shapes YouTube draws; the cross and everything else is drawn here.
// What is a CHOICE (not measured): the portrait and the sunburst thumbnail with its caption, the wording of the texts, the menu with two items, that the two
// small buttons on the thumbnail and "Reply" do what "Remind me later" does, that the two like/dislike buttons only change colour, the colour of the hover fill.

import { cardSurface, inPlayer, extractMeta } from './discover.js';
import { TITLES, CAPTIONS, pickTitle, pickCaption } from '../core/breaktitles.js';
import { MIN_ITEMS, MAX_CARD_INDEX, MAX_COMMENT_INDEX, pickIndex, pickKind, locationKey, clockText, watchingText, sentenceText, agoText } from '../core/breakitem.js';
import { PORTRAIT } from './vianney-image.js';

const CHANNEL = 'Vianney';   // CHOICE: the name of the "channel" and the handle of the "commenter"

// The shapes of the icons (viewBox 24 unless said otherwise). The first five are the ones YouTube draws.
const ICON = {
  dots: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a2 2 0 100 4 2 2 0 000-4Zm0 6a2 2 0 100 4 2 2 0 000-4Zm0 6a2 2 0 100 4 2 2 0 000-4Z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1Zm0 2a9 9 0 110 18.001A9 9 0 0112 3Zm0 3a1 1 0 00-1 1v5.565l.485.292 3.33 2a1 1 0 001.03-1.714L13 11.435V7a1 1 0 00-1-1Z"/></svg>',
  queue: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 2.864v6.277a.5.5 0 00.748.434L9 6.002 2.748 2.43A.5.5 0 002 2.864ZM21 5h-9a1 1 0 100 2h9a1 1 0 100-2Zm0 6H9a1 1 0 000 2h12a1 1 0 000-2Zm0 6H9a1 1 0 000 2h12a1 1 0 000-2Z"/></svg>',
  like: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="m7.748.854.779.13a3 3 0 012.44 3.588L10.5 6.75h3.046a2.748 2.748 0 012.204 4.387l.015.066A2.862 2.862 0 0115 13.874v.033c0 .227-.037.452-.109.668l-.08.21a2.815 2.815 0 01-2.59 1.715H9.516l-.294-.005a9.002 9.002 0 01-3.918-1.041l-.256-.142-.204-.116a1.502 1.502 0 00-.55-.186L4.102 15H2.625l-.116-.006a1.126 1.126 0 01-1.003-1.005l-.006-.114v-4.5c0-.62.504-1.124 1.125-1.124h1.342a.75.75 0 00.66-.395l.048-.107 2.24-6.403a.75.75 0 01.833-.491ZM6.09 8.243A2.25 2.25 0 013.967 9.75H3v3.749h1.1a3 3 0 011.49.395l.202.116a7.503 7.503 0 003.724.99h2.703c.566 0 1.07-.363 1.248-.9a.61.61 0 00.032-.193v-.655l.44-.439a1.36 1.36 0 00.363-1.272l-.014-.065-.157-.675.413-.556a1.248 1.248 0 00-.999-1.995H10.5a1.501 1.501 0 01-1.467-1.815L9.5 4.257a1.5 1.5 0 00-1.22-1.794l-.157-.026L6.09 8.243Z"/></svg>',
  dislike: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="m8.482 1.5.294.005a9.01 9.01 0 013.918 1.04l.257.143.203.116c.17.097.357.16.55.185l.194.012h1.477l.115.006c.53.054.95.475 1.004 1.005l.006.114v4.499c0 .621-.504 1.125-1.125 1.125h-1.343a.75.75 0 00-.66.395l-.048.107-2.24 6.402a.75.75 0 01-.832.491l-.78-.13a3 3 0 01-2.439-3.587L7.5 11.25H4.454a2.749 2.749 0 01-2.683-2.151 2.762 2.762 0 01.479-2.237l-.016-.065A2.862 2.862 0 013 4.125v-.032c0-.227.037-.453.108-.668l.08-.211A2.816 2.816 0 015.78 1.5h2.703ZM5.78 3c-.566 0-1.069.362-1.248.9a.613.613 0 00-.031.193v.654l-.44.44c-.333.332-.47.813-.364 1.271l.015.065.157.675-.413.557a1.248 1.248 0 00.999 1.995H7.5a1.501 1.501 0 011.467 1.815L8.5 13.742a1.5 1.5 0 001.22 1.794l.157.027 2.031-5.806a2.25 2.25 0 012.124-1.507H15V4.501h-1.102a3.001 3.001 0 01-1.489-.396l-.202-.116A7.504 7.504 0 008.482 3H5.78Z"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.7 4.3 12 10.6l6.3-6.3 1.4 1.4-6.3 6.3 6.3 6.3-1.4 1.4-6.3-6.3-6.3 6.3-1.4-1.4 6.3-6.3-6.3-6.3 1.4-1.4Z"/></svg>',
};

const CSS = `
:host { all: initial; display: block; position: relative; box-sizing: border-box;
  --text1: #0f0f0f; --text2: #606060; --menu-bg: #fff; --menu-hover: rgba(0,0,0,.05); --press: rgba(0,0,0,.1); --hover-fill: rgba(229,53,45,.13); }
:host-context(html[dark]) { --text1: #f1f1f1; --text2: #aaa; --menu-bg: #282828; --menu-hover: rgba(255,255,255,.1); --press: rgba(255,255,255,.1); --hover-fill: rgba(229,53,45,.17); }
* { box-sizing: border-box; }
button { all: unset; box-sizing: border-box; cursor: pointer; }
button:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--text1); outline-offset: 2px; }
svg { display: block; fill: currentColor; pointer-events: none; }
.vc { position: relative; display: flex; width: 100%; color: var(--text1); font: 400 14px/20px Roboto, Arial, sans-serif; text-align: left; letter-spacing: normal; text-transform: none; }
.vc[data-layout="column"] { flex-direction: column; }

/* the picture of the video: a sunburst, the portrait with a white rim, and a caption in capitals (everything in it is sized by the width of the picture) */
.thumb { position: relative; display: block; flex: none; width: var(--w, 100%); aspect-ratio: 16 / 9; border-radius: var(--tr, 12px); overflow: hidden; cursor: pointer; container-type: inline-size;
  background: radial-gradient(ellipse 60% 85% at 74% 55%, #ffe66d 0%, #ffb02e 38%, rgba(255,140,0,0) 72%), repeating-conic-gradient(from 0deg at 74% 62%, rgba(255,255,255,.14) 0deg 7deg, rgba(255,255,255,0) 7deg 15deg), linear-gradient(135deg, #e5352d 0%, #a3121f 55%, #5b0a14 100%); }
.portrait { position: absolute; right: 3%; bottom: -1%; height: 96%; width: auto; pointer-events: none; user-select: none;
  filter: drop-shadow(.6cqw 0 0 #fff) drop-shadow(-.6cqw 0 0 #fff) drop-shadow(0 .6cqw 0 #fff) drop-shadow(0 -.6cqw 0 #fff) drop-shadow(0 1cqw 1.4cqw rgba(0,0,0,.45)); }
.cap { position: absolute; left: 5%; top: 50%; max-width: 58%; transform: translateY(-52%) rotate(-5deg); transform-origin: left center; pointer-events: none;
  font: italic 900 var(--capfs, 17cqw)/.92 Impact, 'Arial Black', 'Haettenschweiler', Roboto, sans-serif; text-transform: uppercase; color: #fff34a; letter-spacing: .01em;
  -webkit-text-stroke: 1.6cqw #111; paint-order: stroke fill; text-shadow: 0 1.2cqw 0 #111, 0 1.8cqw 2cqw rgba(0,0,0,.5); }
.badge { position: absolute; right: 8px; bottom: 8px; padding: 1px 4px; border-radius: 4px; background: rgba(0,0,0,.6); color: #fff; font: 500 12px/18px Roboto, Arial, sans-serif; pointer-events: none; }
.vc[data-layout="compact"] .badge { right: 4px; bottom: 4px; }
.quick { position: absolute; top: 8px; right: 8px; display: flex; flex-direction: column; gap: 4px; opacity: 0; transition: opacity .1s; }
.thumb:hover .quick, .quick:focus-within { opacity: 1; }
.vc[data-layout="compact"] .quick { display: none; }
.q { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 4px; background: rgba(0,0,0,.8); color: #fff; }
.q svg { width: 24px; height: 24px; }

/* the round picture of the channel */
.avatar, .av { flex: none; overflow: hidden; border-radius: 50%; background: #000; }
.avatar img, .av img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 38% 4%; }
.avatar { width: 36px; height: 36px; }

/* the text */
h3 { margin: 0; font: inherit; }
.title { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: var(--clamp, 2); overflow: hidden; cursor: pointer; overflow-wrap: break-word;
  font: var(--tfw, 500) var(--tfs, 16px)/var(--tlh, 22px) Roboto, Arial, sans-serif; color: var(--tcolor, var(--text1)); }
.sub { font: 400 var(--sfs, 14px)/var(--slh, 20px) Roboto, Arial, sans-serif; color: var(--scolor, var(--text2)); }

/* the three dots */
.more { position: absolute; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; color: var(--text1); }
.more svg { width: 24px; height: 24px; }
.more:hover, .more[aria-expanded="true"] { background: var(--press); }

/* column: the thumbnail on top, the round picture beside the text (home, channel, hashtag) */
.vc[data-layout="column"] .details { position: relative; display: flex; }
.vc[data-layout="column"] .avatar { margin: 12px 12px 0 0; }
.vc[data-layout="column"] .meta { flex: 1; min-width: 0; padding-right: 24px; }
.vc[data-layout="column"] .title { margin: 12px 0 4px; }
.vc[data-layout="column"] .more { top: 4px; right: -12px; }

/* row: a large thumbnail on the left (search results) */
.vc[data-layout="row"] .thumb { margin-right: 16px; }
.vc[data-layout="row"] .details { position: relative; flex: 1; min-width: 0; }
.vc[data-layout="row"] .title { margin-right: 48px; }
.vc[data-layout="row"] .more { top: -11px; right: 0; }
.vc[data-layout="row"] .chrow { display: flex; align-items: flex-start; min-height: 50px; padding: 12px 0; }
.vc[data-layout="row"] .chrow .channel { margin-top: 4px; }   /* measured: the picture at 12 px, the name at 16 px */
.vc[data-layout="row"] .av { width: 24px; height: 24px; margin-right: 8px; }
.vc[data-layout="row"] .desc { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; margin-bottom: 8px; }

/* compact: a small thumbnail on the left, text on the right (the recommendations next to a video) */
.vc[data-layout="compact"] .thumb { margin-right: 12px; }
.vc[data-layout="compact"] .details { position: relative; flex: 1; min-width: 0; }   /* positioned, so that it is drawn above the hover fill */
.vc[data-layout="compact"] .channel, .vc[data-layout="compact"] .stats { margin-top: 2px; }
.vc[data-layout="compact"] .more { bottom: 0; right: 0; opacity: 0; transition: opacity .1s; }
.vc[data-layout="compact"]:hover .more, .vc[data-layout="compact"] .more:focus-visible, .vc[data-layout="compact"] .more[aria-expanded="true"] { opacity: 1; }
.vc[data-layout="compact"]::before { content: ''; position: absolute; inset: -6px; border-radius: 8px; background: var(--hover-fill); opacity: 0; transition: opacity .1s; pointer-events: none; }
.vc[data-layout="compact"]:hover::before { opacity: 1; }

/* the comment */
.vc[data-layout="comment"] .avatar { margin-right: 16px; }
.vc[data-layout="comment"] .main { flex: 1; min-width: 0; }
.vc[data-layout="comment"] .head { display: flex; align-items: flex-start; margin-bottom: 2px; padding-right: 32px; }
.vc[data-layout="comment"] .handle { margin-right: 4px; padding-bottom: 2px; font: 500 12px/18px Roboto, Arial, sans-serif; color: var(--text1); }
.vc[data-layout="comment"] .ago { font: 400 12px/18px Roboto, Arial, sans-serif; color: var(--text2); }
.vc[data-layout="comment"] .text { white-space: pre-wrap; overflow-wrap: break-word; font: 400 14px/20px Roboto, Arial, sans-serif; color: var(--text1); }
.vc[data-layout="comment"] .actions { display: flex; align-items: center; height: 32px; margin: 4px 0 0 -8px; }
.vc[data-layout="comment"] .ic { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; color: var(--text1); }
.vc[data-layout="comment"] .ic svg { width: 18px; height: 18px; }
.vc[data-layout="comment"] .ic:hover { background: var(--press); }
.vc[data-layout="comment"] .reply { margin-left: 8px; padding: 0 12px; height: 32px; border-radius: 16px; font: 500 12px/32px Roboto, Arial, sans-serif; color: var(--text1); }
.vc[data-layout="comment"] .reply:hover { background: var(--press); }
.vc[data-layout="comment"] .more { top: -12px; right: 0; }

/* the menu of the three dots */
.menu { position: absolute; z-index: 10; padding: 8px 0; border-radius: 12px; background: var(--menu-bg); box-shadow: 0 4px 32px rgba(0,0,0,.1); }
.menu[hidden] { display: none; }
.item { display: flex; align-items: center; width: 100%; height: 36px; padding: 0 12px 0 16px; color: var(--text1); font: 400 14px/20px Roboto, Arial, sans-serif; white-space: nowrap; }
.item:hover, .item:focus-visible { background: var(--menu-hover); outline: none; }
.item svg { width: 24px; height: 24px; margin-right: 12px; }
.item span { margin-right: 24px; }
`;

// ------------------------------------------------------------------------------------------------------------------------------ what the real neighbour looks like
const px = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };

// What YouTube uses when the neighbour does not say (see the numbers in the header).
const FALLBACK = {
  column: { tfs: 16, tlh: 22, tfw: 500, sfs: 14, slh: 20, clamp: 2, radius: 12 },
  row: { tfs: 18, tlh: 26, tfw: 400, sfs: 12, slh: 18, clamp: 2, radius: 12 },
  compact: { tfs: 14, tlh: 20, tfw: 500, sfs: 12, slh: 18, clamp: 2, radius: 12 },
};

/** The picture of a card: its largest image that is about 16:9. */
function thumbImage(card) {
  let best = null; let area = 0;
  for (const img of card.querySelectorAll('img')) {
    const b = img.getBoundingClientRect();
    if (b.width < 100 || b.height < 40) continue;
    const ratio = b.width / b.height;
    if (ratio < 1.4 || ratio > 2.2) continue;
    if (b.width * b.height > area) { best = img; area = b.width * b.height; }
  }
  return best;
}

/** Is there a round channel picture in the card (a small square image that is not the thumbnail)? */
function hasAvatar(card, thumb) {
  for (const img of card.querySelectorAll('img')) {
    if (img === thumb) continue;
    const b = img.getBoundingClientRect();
    if (b.width >= 18 && b.width <= 64 && Math.abs(b.width - b.height) <= 2) return true;
  }
  return false;
}

/** The rounding of the corners of the picture: the first rounded element from the image outwards. */
function thumbRadius(thumb, card) {
  for (let el = thumb, i = 0; el && el !== card.parentElement && i < 5; el = el.parentElement, i++) {
    const r = px(getComputedStyle(el).borderTopLeftRadius);
    if (r > 0) return r;
  }
  return 0;
}

/** The style of the title (the element that holds its text), and of the first line of text that comes after it (the channel, or the views). */
function textStyles(card, title, thumbRect) {
  const want = norm(title).slice(0, 12);
  if (want.length < 3) return {};
  const onThumb = (el) => { const b = el.getBoundingClientRect(); return b.left >= thumbRect.left - 1 && b.right <= thumbRect.right + 1 && b.top >= thumbRect.top - 1 && b.bottom <= thumbRect.bottom + 1; };   // the length of the video and the like are written on it
  const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
  let titleEl = null;
  let subEl = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const s = norm(n.nodeValue);
    if (!s) continue;
    const el = n.parentElement;
    if (!el || !visible(el) || onThumb(el)) continue;
    if (!titleEl) { if (s.startsWith(want) || (s.length >= 3 && want.startsWith(s.slice(0, 12)))) titleEl = el; continue; }
    if (el !== titleEl && !titleEl.contains(el)) { subEl = el; break; }
  }
  // how many lines of text stand under the title (the channel and the views: two; on a channel's own page the card has the views only)
  const tops = new Set();
  if (titleEl) {
    const w2 = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    let after = false;
    for (let n = w2.nextNode(); n; n = w2.nextNode()) {
      const e2 = n.parentElement;
      if (!e2 || onThumb(e2)) continue;
      if (e2 === titleEl || titleEl.contains(e2)) { after = true; continue; }
      if (after && norm(n.nodeValue) && visible(e2)) tops.add(Math.round(e2.getBoundingClientRect().top / 4));
    }
  }
  const out = { lines: tops.size };
  if (titleEl) {
    const cs = getComputedStyle(titleEl);
    out.titleLeft = titleEl.getBoundingClientRect().left - card.getBoundingClientRect().left;   // where the text starts: 48 px in from the card when a round picture stands before it
    out.tfs = px(cs.fontSize); out.tfw = px(cs.fontWeight) || 500; out.tcolor = cs.color;
    out.tlh = px(cs.lineHeight) || Math.round(out.tfs * 1.375);
    for (let el = titleEl, i = 0; el && i < 4; el = el.parentElement, i++) {
      const c = getComputedStyle(el).webkitLineClamp;
      if (c && c !== 'none') { out.clamp = Number(c); break; }
    }
  }
  if (subEl) {
    const cs = getComputedStyle(subEl);
    out.sfs = px(cs.fontSize); out.slh = px(cs.lineHeight) || Math.round(out.sfs * 1.43); out.scolor = cs.color;
  }
  return out;
}

/** A plain video has its length written on the picture ("4:04"); a mix, a playlist or a live stream has another label there. (Digits and a colon: no language is needed. The
 *  text is there before it is drawn: YouTube lays out the labels of a picture only when the card comes near the screen.) */
function hasLength(card) {
  const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (/^\d{1,2}(:\d{2}){1,2}$/.test(norm(n.nodeValue))) return true;
  return false;
}

/** A card is drawn when it has its title; before that the only text that can be found on it is the length of the video ("4:04"). */
const titleReady = (meta) => !!meta && meta.title.length >= 3 && !/^\d{1,2}(:\d{2}){1,2}$/.test(meta.title);

/**
 * How the item has to look to stand among these cards: which of the three shapes, how wide, how large its text is. Read from a real card of the list.
 * @returns {null | {layout: 'column'|'row'|'compact', avatar: boolean, width: number, margin: string, thumbW: number, radius: number, tfs: number, tlh: number, tfw: number, sfs: number, slh: number, clamp: number, tcolor?: string, scolor?: string}}
 */
export function measureCard(card, meta) {
  const r = card.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const thumb = thumbImage(card);
  if (!thumb) return null;
  if (!titleReady(meta)) return null;
  const t = thumb.getBoundingClientRect();
  const side = t.width < r.width * 0.8;                       // the picture stands beside the text, not above it
  const styles = textStyles(card, meta.title, t);
  // Beside the text: a row (search results, with a channel line and a description) or, next to a video, the compact card of a recommendation. Above the text:
  // a column, with the round picture of the channel in front of the text or without it. (Whether the picture is there is read from where the title starts:
  // the picture itself is only loaded when the card is near the screen, but its room is always kept.)
  const layout = side ? (cardSurface(card) === 'related' ? 'compact' : 'row') : 'column';
  const avatar = layout === 'column' ? (styles.titleLeft != null ? styles.titleLeft >= 24 : hasAvatar(card, thumb)) : layout === 'row';
  const fb = FALLBACK[layout];
  const m = { layout, avatar, channelLine: layout === 'row' || !styles.tfs || styles.lines >= 2, width: r.width, margin: getComputedStyle(card).margin, thumbW: t.width, radius: thumbRadius(thumb, card) || fb.radius };
  for (const k of ['tfs', 'tlh', 'tfw', 'sfs', 'slh', 'clamp']) m[k] = styles[k] > 0 ? styles[k] : fb[k];
  if (styles.tcolor) m.tcolor = styles.tcolor;
  if (styles.scolor) m.scolor = styles.scolor;
  return m;
}

/** The comment's neighbour: only its margin and its width matter. */
function measureThread(thread) {
  const r = thread.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { layout: 'comment', avatar: true, width: r.width, margin: getComputedStyle(thread).margin };
}

// ------------------------------------------------------------------------------------------------------------------------------ choosing the neighbours
const hiddenByFilter = (el) => el.dataset.vianneyState === 'hide' || el.dataset.vianneyState === 'blank';

/**
 * The cards among which the video may stand: the visible cards of the main list of the page that the filter has not hidden. Never what is in the player
 * (its end screen), a playlist or a mix, a live stream, or a card that only links to a Short; on a video page only the recommendations. The main list is the group of cards that
 * share a parent and are the most; one row of cards (a shelf that you scroll sideways) is no list.
 * @param {{id: string, el: Element, anchors: Element[]}[]} cards the result of findCards()
 */
export function listCandidates(cards) {
  const watch = location.pathname === '/watch';
  if (location.pathname === '/playlist') return [];
  const ok = cards.filter((c) => c.el.isConnected && !inPlayer(c.el) && visible(c.el) && !hiddenByFilter(c.el)
    && c.anchors.some((a) => /\/watch\?v=/.test(a.getAttribute('href') || ''))
    && !c.el.closest('ytd-playlist-video-renderer, ytd-playlist-panel-renderer') && titleReady(extractMeta(c)) && hasLength(c.el)
    && (!watch || cardSurface(c.el) === 'related'));
  const groups = new Map();
  for (const c of ok) {
    const p = c.el.parentElement;
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push(c);
  }
  let best = [];
  for (const list of groups.values()) {
    const rows = new Set(list.map((c) => Math.round(c.el.getBoundingClientRect().top / 4)));
    if (rows.size >= 2 && list.length > best.length) best = list;
  }
  // Of those, the cards of the kind that most of them are: the card of a channel or an advertisement that stands in the same list is no video row, and the
  // video must not end up first among the real rows only because that card counts as the first one.
  const kinds = new Map();
  for (const c of best) kinds.set(c.el.tagName, (kinds.get(c.el.tagName) || 0) + 1);
  const top = [...kinds.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? best.filter((c) => c.el.tagName === top[0]) : [];
}

/** The loaded top-level comments, in order. */
function commentThreads() {
  return [...document.querySelectorAll('ytd-comments ytd-comment-thread-renderer')]
    .filter((el) => el.isConnected && visible(el) && !hiddenByFilter(el));
}

// ------------------------------------------------------------------------------------------------------------------------------ the item
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function markup(layout, avatar, channelLine) {
  const more = `<button class="more" data-act="menu" aria-label="Action menu" aria-haspopup="menu" aria-expanded="false">${ICON.dots}</button>`;
  const menu = `<div class="menu" role="menu" hidden>
      <button class="item" role="menuitem" data-act="later">${ICON.clock}<span>Remind me later</span></button>
      <button class="item" role="menuitem" data-act="dismiss">${ICON.close}<span>Dismiss</span></button></div>`;
  if (layout === 'comment') {
    return `<div class="avatar"><img alt=""></div>
      <div class="main">
        <div class="head"><span class="handle"></span><span class="ago"></span></div>
        <div class="text"></div>
        <div class="actions"><button class="ic" data-act="like" aria-label="Like this comment">${ICON.like}</button><button class="ic" data-act="dislike" aria-label="Dislike this comment">${ICON.dislike}</button><button class="reply" data-act="later">Reply</button></div>
      </div>${more}${menu}`;
  }
  const thumb = `<div class="thumb" role="button" tabindex="0" data-act="later">
      <div class="cap"></div><img class="portrait" alt=""><div class="badge"></div>
      <div class="quick"><button class="q" data-act="later" aria-label="Watch later">${ICON.clock}</button><button class="q" data-act="later" aria-label="Add to queue">${ICON.queue}</button></div></div>`;
  const title = '<h3><span class="title" role="button" tabindex="0" data-act="later"></span></h3>';
  if (layout === 'column') {
    return `${thumb}<div class="details">${avatar ? '<div class="avatar"><img alt=""></div>' : ''}
      <div class="meta">${title}${channelLine ? '<div class="sub channel"></div>' : ''}<div class="sub stats"></div></div>${more}</div>${menu}`;
  }
  if (layout === 'row') {
    return `${thumb}<div class="details">${title}<div class="sub stats"></div>
      <div class="chrow"><span class="av"><img alt=""></span><span class="sub channel"></span></div><div class="sub desc"></div>${more}</div>${menu}`;
  }
  return `${thumb}<div class="details">${title}${channelLine ? '<div class="sub channel"></div>' : ''}<div class="sub stats"></div></div>${more}${menu}`;   // compact
}

export class BreakUI {
  /**
   * @param {{onSnooze: Function, onDismiss: Function, rand?: () => number, now?: () => number}} deps rand and now can be replaced by tests
   */
  constructor({ onSnooze, onDismiss, rand = Math.random, now = () => Date.now() }) {
    this.onSnooze = onSnooze;
    this.onDismiss = onDismiss;
    this.rand = rand;
    this.now = now;
    this.host = null;         // the element that is (or was, if YouTube removed it) in the page
    this.nodes = null;        // the parts of it that change
    this.layout = '';
    this.sig = '';            // what the last measuring said (nothing is written when it did not change)
    this.pick = null;         // {kind, title, caption, startedAt, anchor, card, index}: made once per appearance
    this.loc = '';            // the place on the site that the pick belongs to
    this.cfg = {};
    this.seconds = 0;
    this.mutedUntil = 0;      // after a click: no new item until the answer of the service worker has taken the reminder away
    this.debug = null;        // {kind, index, title, caption}: set only through the debug interface of main.js, which works only while settings.debug is true
    this.menuOpen = false;
    this.raf = 0;
    this.onOutside = (ev) => { if (this.host && !ev.composedPath().includes(this.host)) this.closeMenu(); };
    this.onKey = (ev) => { if (ev.key === 'Escape') this.closeMenu(); };
    window.addEventListener('yt-navigate-finish', () => this.reset());
    window.addEventListener('resize', () => { if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.sync(); }); });
  }

  allows(kind) { return kind === 'comment' ? !!this.cfg.showComment : !!this.cfg.showCard; }

  /**
   * One tick of the loop (every 1.5 s while a reminder is due).
   * @param {{due: boolean, seconds: number, cfg: object, findCards: () => {id: string, el: Element, anchors: Element[]}[]}} s findCards is called only when the item has to be placed
   */
  update({ due, seconds, cfg, findCards }) {
    this.cfg = cfg;
    this.seconds = seconds;
    if (!due || !(cfg.showCard || cfg.showComment)) { this.remove(); return; }
    if (this.now() < this.mutedUntil) return;
    const loc = locationKey(location.pathname, location.search);
    if (loc !== this.loc) { this.reset(); this.loc = loc; }                       // a new place on the site: a new choice
    if (this.pick && !this.allows(this.pick.kind)) this.reset();                  // its switch was turned off
    if (this.pick && this.host) {
      if (this.host.isConnected) { this.sync(); return; }
      const at = this.pick.anchor;                                               // YouTube took it away: put it back where it was
      if (at && at.isConnected && at.parentNode) { at.parentNode.insertBefore(this.host, at); this.sync(); return; }
      this.reset();                                                               // ... and if that place is gone too, choose again
    }
    this.place(findCards);
  }

  /** Choose kind, place and words, and put the item into the page. Does nothing while the page has too few items to hide among. */
  place(findCards) {
    const watch = location.pathname === '/watch';
    const cards = this.cfg.showCard ? listCandidates(findCards()) : [];
    const threads = watch && this.cfg.showComment ? commentThreads() : [];
    const can = { video: cards.length >= MIN_ITEMS, comment: threads.length >= MIN_ITEMS };
    let kind = pickKind(this.rand, can);
    if (this.debug && this.debug.kind) kind = can[this.debug.kind] && this.allows(this.debug.kind) ? this.debug.kind : null;   // the end-to-end test decides
    if (!kind) return;
    const list = kind === 'video' ? cards : threads;
    let index = pickIndex(list.length, this.rand, kind === 'video' ? MAX_CARD_INDEX : MAX_COMMENT_INDEX);
    if (this.debug && Number.isInteger(this.debug.index)) index = Math.min(Math.max(1, this.debug.index), list.length - 1);
    const target = list[index];
    const anchor = kind === 'video' ? target.el : target;
    const card = kind === 'video' ? target : null;
    const m = this.measure(kind, anchor, card);
    if (!m) return;                                                               // not drawn far enough to be measured: try again at the next tick
    const d = this.debug || {};                                                      // (the test may also decide on the words, so that a picture is the same every time)
    const title = kind === 'video' ? pickTitle(Number.isInteger(d.title) ? () => (d.title % TITLES.length + 0.5) / TITLES.length : this.rand, this.seconds) : '';
    const caption = pickCaption(Number.isInteger(d.caption) ? () => (d.caption % CAPTIONS.length + 0.5) / CAPTIONS.length : this.rand);
    this.pick = { kind, title, caption, startedAt: this.now(), anchor, card, index };
    this.build(m);
    anchor.parentNode.insertBefore(this.host, anchor);
    this.sync();
  }

  measure(kind, anchor, card) {
    try { return kind === 'video' ? measureCard(anchor, extractMeta(card)) : measureThread(anchor); } catch (e) { return null; }
  }

  /** Make the element (and its shadow tree) for the shape that the neighbours have. */
  build(m) {
    const old = this.host;
    const host = document.createElement('div');
    host.dataset.vianneyUi = this.pick.kind === 'comment' ? 'break-comment' : 'break-video';
    host.setAttribute('role', 'group');
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    const vc = el('div', 'vc');
    vc.dataset.layout = m.layout;
    vc.innerHTML = markup(m.layout, m.avatar, m.channelLine);          // fixed markup: every text below is put in with textContent
    root.append(style, vc);
    for (const img of root.querySelectorAll('img')) img.src = PORTRAIT;
    const q = (s) => root.querySelector(s);
    this.nodes = { vc, title: q('.title'), channel: q('.channel'), stats: q('.stats'), desc: q('.desc'), badge: q('.badge'), cap: q('.cap'), handle: q('.handle'), ago: q('.ago'), text: q('.text'), more: q('.more'), menu: q('.menu') };
    if (this.nodes.title) this.nodes.title.textContent = this.pick.title;
    if (this.nodes.channel) this.nodes.channel.textContent = CHANNEL;
    if (this.nodes.handle) this.nodes.handle.textContent = '@' + CHANNEL;
    if (this.nodes.cap) {
      this.nodes.cap.textContent = this.pick.caption;
      // A caption is drawn as large as the picture allows: 17% of its width, less for a long word, so that it ends before the portrait (a letter of this typeface is about half as wide as it is high).
      const longest = Math.max(...this.pick.caption.split(' ').map((w) => w.length));
      this.nodes.cap.style.setProperty('--capfs', `${Math.min(17, 112 / longest).toFixed(2)}cqw`);
    }
    root.addEventListener('click', (ev) => this.onClick(ev));
    root.addEventListener('keydown', (ev) => this.onKeydown(ev));
    this.closeMenu();
    if (old && old.isConnected) old.replaceWith(host);
    this.host = host;
    this.layout = m.layout;
    this.sig = '';
    this.apply(m);
  }

  /** Put the numbers that were read from the neighbour on the item. Only what changed is written. */
  apply(m) {
    const sig = JSON.stringify(m);
    if (sig === this.sig) return;
    this.sig = sig;
    const h = this.host;
    h.style.margin = m.margin;
    const parent = (this.pick.anchor || {}).parentElement;
    let free = true;                       // the item fills its row by itself, unless the list is a grid whose cards have a width of their own
    if (parent) { const cs = getComputedStyle(parent); free = Math.abs(m.width - (parent.getBoundingClientRect().width - px(cs.paddingLeft) - px(cs.paddingRight))) <= 3; }
    h.style.width = free ? '' : `${m.width}px`;
    h.style.flex = free ? '' : 'none';
    const set = (name, value) => (value == null ? h.style.removeProperty(name) : h.style.setProperty(name, value));
    if (m.layout !== 'comment') {
      set('--w', m.layout === 'column' ? null : `${m.thumbW}px`);
      set('--tr', `${m.radius}px`);
      set('--tfs', `${m.tfs}px`); set('--tlh', `${m.tlh}px`); set('--tfw', String(m.tfw)); set('--clamp', String(m.clamp));
      set('--sfs', `${m.sfs}px`); set('--slh', `${m.slh}px`);
      set('--tcolor', m.tcolor || null); set('--scolor', m.scolor || null);
    }
  }

  /** The times (and the sizes of the neighbour, which the width of the window may have changed) are brought up to date, in place. */
  sync() {
    if (!this.host || !this.pick) return;
    const p = this.pick;
    const n = this.nodes;
    const s = this.seconds;
    const put = (node, text) => { if (node && node.textContent !== text) node.textContent = text; };
    let label;
    if (p.kind === 'video') {
      put(n.stats, watchingText(s));
      put(n.badge, clockText(s));
      put(n.desc, sentenceText(s, this.cfg.message));
      label = `Break reminder from ${CHANNEL}: ${p.title}. ${watchingText(s)}`;
    } else {
      const body = sentenceText(s, this.cfg.message);
      put(n.text, body);
      put(n.ago, agoText((this.now() - p.startedAt) / 60000));
      label = `Break reminder from ${CHANNEL}: ${body}`;
    }
    if (this.host.getAttribute('aria-label') !== label) this.host.setAttribute('aria-label', label);
    if (!this.host.isConnected || !p.anchor || !p.anchor.isConnected) return;
    const m = this.measure(p.kind, p.anchor, p.card);
    if (!m) return;
    const drawnAvatar = !!this.nodes.vc.querySelector('.details > .avatar');
    const drawnChannel = !!this.nodes.vc.querySelector('.details .channel, .meta .channel');
    if (m.layout !== this.layout || (m.layout === 'column' && m.avatar !== drawnAvatar) || (m.layout !== 'comment' && m.layout !== 'row' && m.channelLine !== drawnChannel)) { this.build(m); this.sync(); return; }   // the window changed so much that the neighbours have another shape
    this.apply(m);
  }

  // ---------------------------------------------------------------------------------------------------------------- what the user does
  onClick(ev) {
    const t = ev.target.closest && ev.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'menu') { this.menuOpen ? this.closeMenu() : this.openMenu(); return; }
    if (act === 'like' || act === 'dislike') {                                    // decorative: the icon gets its colour back and forth, nothing else happens
      const on = t.getAttribute('aria-pressed') === 'true';
      for (const b of this.nodes.vc.querySelectorAll('.ic')) b.setAttribute('aria-pressed', 'false');
      t.setAttribute('aria-pressed', on ? 'false' : 'true');
      t.style.background = on ? '' : 'var(--press)';
      return;
    }
    this.act(act);
  }

  onKeydown(ev) {
    if (ev.key === 'Escape') { this.closeMenu(); return; }
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.getAttribute && ev.target.getAttribute('role') === 'button') { ev.preventDefault(); this.act('later'); }
  }

  /** "Remind me later" (also what a click on the thumbnail or the title means) or "Dismiss". The item goes at once; the service worker moves the next reminder. */
  act(kind) {
    this.closeMenu();
    this.mutedUntil = this.now() + 4000;       // CHOICE: long enough for the answer of the service worker, so that no new item shows up before it
    this.remove();
    (kind === 'dismiss' ? this.onDismiss : this.onSnooze)();
  }

  openMenu() {
    const { more, menu, vc } = this.nodes;
    menu.hidden = false;
    more.setAttribute('aria-expanded', 'true');
    this.menuOpen = true;
    this.host.style.zIndex = '2202';          // YouTube's own parts of a card go up to z-index 300, its own menus have 2202 (measured): while the menu is open it must be above the cards that follow
    const b = more.getBoundingClientRect();
    const v = vc.getBoundingClientRect();
    const w = menu.offsetWidth;
    const h = menu.offsetHeight;
    let left = b.left;                                                    // the popup opens 8 px under the button, at its left edge (measured) ...
    let top = b.bottom + 8;
    if (left + w > window.innerWidth - 8) left = Math.max(8, b.right - w);  // ... and moves where there is room
    if (top + h > window.innerHeight - 8 && b.top - 8 - h > 8) top = b.top - 8 - h;
    menu.style.left = `${left - v.left}px`;
    menu.style.top = `${top - v.top}px`;
    document.addEventListener('pointerdown', this.onOutside, true);
    document.addEventListener('keydown', this.onKey, true);
    const first = menu.querySelector('.item');
    if (first) first.focus({ preventScroll: true });
  }

  closeMenu() {
    if (!this.menuOpen) return;
    this.menuOpen = false;
    document.removeEventListener('pointerdown', this.onOutside, true);
    document.removeEventListener('keydown', this.onKey, true);
    if (this.nodes) { this.nodes.menu.hidden = true; this.nodes.more.setAttribute('aria-expanded', 'false'); }
    if (this.host) this.host.style.zIndex = '';
  }

  // ---------------------------------------------------------------------------------------------------------------- taking it away
  /** The item goes and the choice is forgotten (the next one is a new appearance). */
  reset() {
    this.closeMenu();
    if (this.host) this.host.remove();
    this.host = null;
    this.nodes = null;
    this.pick = null;
    this.layout = '';
    this.sig = '';
  }

  /** No reminder is due (or its switches are off): nothing is shown and nothing is remembered. */
  remove() {
    this.reset();
    this.loc = '';
  }

  /** For the end-to-end test only (main.js lets it through only while settings.debug is true). */
  setDebug(d) {
    const num = (v) => (Number.isInteger(v) ? v : null);
    const next = d && (d.kind || num(d.index) != null || num(d.title) != null || num(d.caption) != null) ? { kind: d.kind || null, index: num(d.index), title: num(d.title), caption: num(d.caption) } : null;
    if (!next && !this.debug) return;      // nothing was forced and nothing is: the item stays where it is
    this.debug = next;
    this.reset();
  }

  state() {
    const p = this.pick;
    const here = !!(this.host && this.host.isConnected);
    return { shown: here, kind: p ? p.kind : null, layout: this.layout || null, title: p ? p.title : null, index: p ? p.index : null, loc: this.loc };
  }
}
