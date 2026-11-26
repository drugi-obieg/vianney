// Clean up, on the page: switches the stylesheet cleanup.css (loaded by the manifest at document_start) on and off with the settings,
// hides the shelves whose title the user named, and opens a /shorts/ address in the normal player. The stylesheet does most of the work;
// this file only sets the attribute that activates it, so a change in the settings needs no reload.

import { cleanupTokens, normalizeTitles, titleMatches, shortsWatchPath, SHELF_SELECTOR, TITLE_SELECTOR } from '../core/cleanup.js';

/** @param {() => object} getSettings */
export function startCleanup(getSettings) {
  const root = document.documentElement;
  let queued = false;
  let last = 0;

  const shelfTitle = (el) => { const h = el.querySelector(TITLE_SELECTOR); return h ? h.textContent : ''; };

  /** Mark the shelves with a named title (the stylesheet hides what is marked), and unmark the ones that no longer match. */
  function scanShelves(titles) {
    const marked = new Set();
    if (titles.length) {
      for (const el of document.querySelectorAll(SHELF_SELECTOR)) {
        if (titleMatches(shelfTitle(el), titles)) marked.add(el.closest('ytd-rich-section-renderer') || el);
      }
    }
    for (const el of document.querySelectorAll('[data-vianney-shelf]')) if (!marked.has(el)) el.removeAttribute('data-vianney-shelf');
    for (const el of marked) if (el.getAttribute('data-vianney-shelf') !== 'hidden') el.setAttribute('data-vianney-shelf', 'hidden');
  }

  function apply() {
    const s = getSettings();
    const cfg = s && s.enabled !== false ? s.cleanup : null;
    const tokens = cfg ? cleanupTokens(cfg) : [];
    if (tokens.length) root.setAttribute('data-vianney-clean', tokens.join(' ')); else root.removeAttribute('data-vianney-clean');
    scanShelves(cfg ? normalizeTitles(cfg.shelfTitles) : []);
    if (cfg && cfg.shortsAsVideos !== false) {
      const to = shortsWatchPath(location.pathname);
      if (to) location.replace(to);
    }
  }

  // YouTube changes its page all the time: look again at most four times a second
  function schedule() {
    if (queued) return;
    queued = true;
    setTimeout(() => requestAnimationFrame(() => { queued = false; last = performance.now(); apply(); }), Math.max(0, 250 - (performance.now() - last)));
  }

  new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
  window.addEventListener('yt-navigate-finish', apply);
  window.addEventListener('popstate', apply);
  setInterval(apply, 3000);
  apply();
  return { refresh: apply };
}
