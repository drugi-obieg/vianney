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
/* pictures: until a thumbnail has been checked it stays invisible (only while the picture check is on and able) */
${within('html[data-vianney-hold]', ':not([data-vianney-seen])')} { visibility: hidden !important; }
[data-vianney-thumb] { position: relative !important; }
[data-vianney-thumb="hide"] { display: none !important; }
[data-vianney-thumb="blank"] { visibility: hidden !important; }
${within('[data-vianney-thumb="blur"]')}, [data-vianney-thumb="blur"] video { filter: blur(28px) saturate(.5) !important; }
${within('[data-vianney-thumb="dim"]')}, [data-vianney-thumb="dim"] video { opacity: .12 !important; filter: grayscale(1) !important; }
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
 * @param {'blur'|'hide'|'blank'|'dim'|'label'} action
 * Blurred and dimmed pictures get a small badge with a "Show" button, so a false alarm costs one click.
 */
export function applyThumbAction(el, action, reason) {
  clearThumb(el);
  markThumbsSeen(el);
  el.dataset.vianneyThumbReason = reason;
  el.dataset.vianneyThumb = action;
  if (action === 'hide' || action === 'blank') return;
  const badge = document.createElement('div');
  badge.className = 'vianney-thumb-badge';
  badge.dataset.vianneyUi = 'badge';
  const text = document.createElement('span');
  text.textContent = reason;
  badge.append(text);
  if (action === 'blur' || action === 'dim') {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Show';
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const shown = el.dataset.vianneyThumb === 'revealed';
      el.dataset.vianneyThumb = shown ? action : 'revealed';
      button.textContent = shown ? 'Show' : 'Hide';
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
