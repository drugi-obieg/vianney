// Visual actions on feed cards: hide, blank, dim, label. All of them are reversible.
// Pictures (experimental) have their own state, data-vianney-thumb, so a verdict from the title and a verdict
// from the thumbnail never overwrite each other. A muting helper lets several checks share one <video>.

const STYLE_ID = 'vianney-style';

// Video pictures come from i.ytimg.com/vi/, /vi_webp/ and /vi_lc/ (the localised variant); moving ones from /an_webp/.
// Avatars (yt3.ggpht.com) are deliberately not matched.
export const THUMB_SELECTORS = ['img[src*="ytimg.com/vi"]', 'img[src*="ytimg.com/an_"]'];
export const THUMB_IMG = THUMB_SELECTORS.join(', ');
const within = (before, after = '') => THUMB_SELECTORS.map((s) => `${before} ${s}${after}`).join(', ');

const CSS = `
[data-vianney-state="hide"] { display: none !important; }
[data-vianney-state="blank"] { visibility: hidden !important; }
[data-vianney-state="dim"], [data-vianney-state="label"] { position: relative !important; }
[data-vianney-state="dim"] > :not(.vianney-badge) { opacity: .22 !important; filter: grayscale(1) !important; }
.vianney-badge {
  position: absolute; top: 6px; left: 6px; z-index: 5; max-width: 90%;
  background: #7a1f2b; color: #fff; font: 600 11px/1.25 system-ui, sans-serif;
  padding: 3px 7px; border-radius: 4px; pointer-events: none; letter-spacing: .02em;
}
/* comments: a flagged comment is hidden, or blurred behind a button, or dimmed, or only labelled. The badge sits over the text of a blurred or dimmed
   comment (to the right of the avatar), so that it can be read and pressed; on a label or a comment that was shown again it sits in the corner. */
[data-vianney-kind="comment"][data-vianney-state="blur"], [data-vianney-kind="comment"][data-vianney-state="dim"],
[data-vianney-kind="comment"][data-vianney-state="label"], [data-vianney-kind="comment"][data-vianney-state="revealed"] { position: relative !important; }
[data-vianney-kind="comment"][data-vianney-state="blur"] > :not(.vianney-badge) { filter: blur(7px) saturate(.5) !important; opacity: .8; pointer-events: none !important; user-select: none !important; }
[data-vianney-kind="comment"] > .vianney-badge { display: flex; gap: 8px; align-items: center; pointer-events: auto; }
[data-vianney-kind="comment"][data-vianney-state="blur"] > .vianney-badge, [data-vianney-kind="comment"][data-vianney-state="dim"] > .vianney-badge {
  top: 50%; left: 56px; transform: translateY(-50%); max-width: calc(100% - 64px); font-size: 12px; padding: 5px 6px 5px 10px; border-radius: 6px;
}
[data-vianney-kind="comment"][data-vianney-state="label"] > .vianney-badge, [data-vianney-kind="comment"][data-vianney-state="revealed"] > .vianney-badge { top: 0; right: 0; left: auto; transform: none; }
.vianney-badge button {
  all: unset; cursor: pointer; font: 600 11px/1.25 system-ui, sans-serif; padding: 2px 7px; border-radius: 3px; background: rgba(255,255,255,.18); color: #fff;
}
.vianney-badge button:hover { background: rgba(255,255,255,.32); }
/* new comments stay invisible until they have been looked at, as new cards do (they are shown by themselves after REVEAL_MS if the script is busy) */
html[data-vianney-armed-comments] ytd-comment-view-model:not([data-vianney-seen]), html[data-vianney-armed-comments] ytd-comment-renderer:not([data-vianney-seen]) { visibility: hidden; animation: vianney-reveal 0s linear 180ms forwards; }
@keyframes vianney-reveal { to { visibility: visible; } }
/* pictures: until a thumbnail has been checked it stays invisible (only while the picture check is on and able) */
${within('html[data-vianney-hold]', ':not([data-vianney-seen])')} { visibility: hidden !important; }
[data-vianney-thumb] { position: relative !important; }
[data-vianney-thumb="hide"] { display: none !important; }
[data-vianney-thumb="blank"] { visibility: hidden !important; }
${within('[data-vianney-thumb="blur"]')}, [data-vianney-thumb="blur"] video { filter: blur(28px) saturate(.5) !important; }
${within('[data-vianney-thumb="blackout"]')}, [data-vianney-thumb="blackout"] video { filter: brightness(0) !important; }
${within('[data-vianney-thumb="dim"]')}, [data-vianney-thumb="dim"] video { opacity: .12 !important; filter: grayscale(1) !important; }
/* the hover preview: one shared element that YouTube puts over the thumbnail, outside the card (see preview.js) */
ytd-video-preview[data-vianney-preview="black"] { filter: brightness(0) !important; }
ytd-video-preview[data-vianney-preview="blur"] { filter: blur(28px) saturate(.5) !important; }
ytd-video-preview[data-vianney-preview="dim"] { opacity: .12 !important; filter: grayscale(1) !important; }
.vianney-thumb-badge {
  position: absolute; top: 6px; left: 6px; z-index: 6; max-width: 92%; display: flex; gap: 6px; align-items: center;
  background: #7a1f2b; color: #fff; font: 600 11px/1.25 system-ui, sans-serif; padding: 3px 4px 3px 7px; border-radius: 4px;
}
.vianney-thumb-badge button {
  all: unset; cursor: pointer; font: 600 11px/1.25 system-ui, sans-serif; padding: 1px 6px; border-radius: 3px;
  background: rgba(255,255,255,.18); color: #fff;
}
.vianney-thumb-badge button:hover { background: rgba(255,255,255,.32); }
`;

// ------------------------------------------------------------------ new cards stay invisible until they have been looked at
// A card that the word lists flag must never be painted, but a scan can only run after the page has inserted the card, and a
// frame may be painted in between (more often on a slow computer). So cards that were not scanned yet are hidden by a rule that
// reveals them BY ITSELF after REVEAL_MS (a CSS animation: it runs even if this script is busy, or stopped, so it can never leave
// a hole in the page). A scanned card gets data-vianney-seen and is shown at once, or stays hidden if a rule flagged it.
// The tag names of cards are not written down for good: they are learned from the structure-based card finder (feed.js), and
// this list only covers the first paint. If YouTube renames its elements the rule simply matches nothing, and filtering works as before.
export const REVEAL_MS = 180;
export const DEFAULT_CARD_TAGS = ['ytd-video-renderer', 'ytd-rich-item-renderer', 'ytd-compact-video-renderer', 'ytd-grid-video-renderer', 'yt-lockup-view-model', 'ytd-playlist-video-renderer'];
const CARDS_STYLE_ID = 'vianney-cards';

export function setCardTags(tags) {
  let style = document.getElementById(CARDS_STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = CARDS_STYLE_ID;
    (document.head || document.documentElement).appendChild(style);
  }
  const list = [...tags].filter((t) => /^[a-z][a-z0-9]*-[a-z0-9-]+$/.test(t)).join(', '); // custom elements only: never a plain div
  style.textContent = list
    ? `html[data-vianney-armed] :is(${list}):not([data-vianney-seen]) { visibility: hidden; animation: vianney-reveal 0s linear ${REVEAL_MS}ms forwards; }\n@keyframes vianney-reveal { to { visibility: visible; } }`
    : '';
}

export function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  (document.head || document.documentElement).appendChild(style);
}

export function clearCard(el) {
  if (!el.dataset.vianneyState) return;
  delete el.dataset.vianneyState;
  delete el.dataset.vianneyReason;
  delete el.dataset.vianneyKind;
  el.querySelectorAll(':scope > .vianney-badge').forEach((b) => b.remove());
}

/** @param {'hide'|'blank'|'dim'|'label'} action */
export function applyCardAction(el, action, reason) {
  clearCard(el);
  el.dataset.vianneyState = action;
  el.dataset.vianneyReason = reason;
  if (action === 'dim' || action === 'label') {
    const badge = document.createElement('div');
    badge.className = 'vianney-badge';
    badge.textContent = reason;
    el.appendChild(badge);
  }
}

// ------------------------------------------------------------------ comments
/**
 * @param {'hide'|'blur'|'dim'|'label'} action
 * Blurred and dimmed comments get a badge with the reason and a "Show" button, so that a false alarm costs one click. The element is the
 * comment itself, or, for "hide" on a top-level comment, its whole thread (the replies go with it).
 */
export function applyCommentAction(el, action, reason, { revealed = false, onToggle } = {}) {
  clearCard(el);
  el.dataset.vianneyKind = 'comment';
  el.dataset.vianneyReason = reason;
  const canReveal = action === 'blur' || action === 'dim';
  el.dataset.vianneyState = canReveal && revealed ? 'revealed' : action;
  if (action === 'hide') return;
  const badge = document.createElement('div');
  badge.className = 'vianney-badge';
  badge.dataset.vianneyUi = 'badge';
  const text = document.createElement('span');
  text.textContent = reason;
  badge.append(text);
  if (canReveal) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = revealed ? 'Hide' : 'Show';
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const shown = el.dataset.vianneyState === 'revealed';
      el.dataset.vianneyState = shown ? action : 'revealed';
      button.textContent = shown ? 'Show' : 'Hide';
      if (onToggle) onToggle(!shown);
    });
    badge.append(button);
  }
  el.appendChild(badge);
}

// ------------------------------------------------------------------ pictures (experimental)
/** Let the thumbnails of a card show: they have been checked (or will not be). */
export function markThumbsSeen(root) {
  root.querySelectorAll(THUMB_IMG).forEach((img) => {
    img.dataset.vianneySeen = '1';
    img.dataset.vianneySeenSrc = img.getAttribute('src') || ''; // a changed address means another picture: check it again
  });
}

export function clearThumb(el) {
  if (!el.dataset.vianneyThumb && !el.querySelector(':scope > .vianney-thumb-badge')) return;
  delete el.dataset.vianneyThumb;
  delete el.dataset.vianneyThumbReason;
  el.querySelectorAll(':scope > .vianney-thumb-badge').forEach((b) => b.remove());
}

/**
 * @param {'blur'|'blackout'|'hide'|'blank'|'dim'|'label'} action
 * Blurred, blacked-out and dimmed pictures get a small badge with a "Show" button, so a false alarm costs one click.
 * "blackout" replaces the picture by pure black (brightness 0), so nothing of it can be made out; the card stays.
 */
export function applyThumbAction(el, action, reason, { revealed = false, onToggle } = {}) {
  clearThumb(el);
  markThumbsSeen(el);
  const canReveal = action === 'blur' || action === 'dim' || action === 'blackout';
  el.dataset.vianneyThumbReason = reason;
  el.dataset.vianneyThumb = canReveal && revealed ? 'revealed' : action;
  if (action === 'hide' || action === 'blank') return;
  const badge = document.createElement('div');
  badge.className = 'vianney-thumb-badge';
  badge.dataset.vianneyUi = 'badge';
  const text = document.createElement('span');
  text.textContent = reason;
  badge.append(text);
  if (canReveal) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = revealed ? 'Hide' : 'Show';
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const shown = el.dataset.vianneyThumb === 'revealed';
      el.dataset.vianneyThumb = shown ? action : 'revealed';
      button.textContent = shown ? 'Show' : 'Hide';
      if (onToggle) onToggle(!shown); // the guard remembers it: every feed scan applies the verdict again
    });
    badge.append(button);
  }
  el.appendChild(badge);
}

// ------------------------------------------------------------------ one <video>, several reasons to mute it
const muteLocks = new WeakMap();

/**
 * Mute a video for a named reason. It stays muted while any reason holds, and goes back to what it was
 * (usually unmuted) when the last one lets go. Subtitle words and the sound check both use this.
 */
export function setMuteLock(video, reason, on) {
  if (!video) return;
  let st = muteLocks.get(video);
  if (!st) { st = { reasons: new Set(), before: false }; muteLocks.set(video, st); }
  const had = st.reasons.size > 0;
  if (on) st.reasons.add(reason); else st.reasons.delete(reason);
  const has = st.reasons.size > 0;
  if (!had && has) { st.before = video.muted; video.muted = true; }
  else if (had && !has) video.muted = st.before;
}

export function isMuteLocked(video, reason) {
  const st = muteLocks.get(video);
  return !!st && (reason ? st.reasons.has(reason) : st.reasons.size > 0);
}
