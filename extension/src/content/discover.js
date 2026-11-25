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
const CHANNEL_LINKS = 'a[href^="/@"], a[href*="/channel/"], a[href^="/c/"], a[href^="/user/"]';

export function videoIdOf(anchor) {
  const m = (anchor.getAttribute('href') || '').match(ID_RE);
  return m ? m[1] : null;
}

function idsIn(el) {
  const ids = new Set();
  el.querySelectorAll(LINKS).forEach((a) => { const i = videoIdOf(a); if (i) ids.add(i); });
  return ids;
}

function cardElementFor(id, anchors) {
  let el = anchors[0];
  while (el && !anchors.every((a) => el.contains(a))) el = el.parentElement;
  if (!el) return null;
  while (el.parentElement && el.parentElement !== document.body && el.parentElement !== document.documentElement) {
    const ids = idsIn(el.parentElement);
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
  const byId = new Map();
  root.querySelectorAll(LINKS).forEach((a) => {
    if (a.closest(EXCLUDE)) return;
    const id = videoIdOf(a);
    if (!id) return;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(a);
  });
  const candidates = [];
  for (const [id, anchors] of byId) {
    const el = cardElementFor(id, anchors);
    if (el) candidates.push({ id, el, anchors });
  }
  const set = new Set(candidates.map((c) => c.el));
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

const TIME_UNITS = '(?:hours?|stunden?|heures?|horas?|ore|minutes?|minuten?|minutos?|minuti|seconds?|sekunden?|secondes?|segundos?|secondi)';
const TAIL_DURATION = new RegExp(`\\s+\\d+\\s+${TIME_UNITS}(?:\\s*(?:,|and|und|et|y|e)?\\s*\\d+\\s+${TIME_UNITS})*\\s*$`, 'i');

function cleanLabel(label) {
  return label.replace(/\s+/g, ' ').replace(TAIL_DURATION, '').trim();
}

/** Title and channel of a card, from attributes and text. Empty strings when not found. */
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
  return { id: card.id, title, channel };
}
