// Runs at document_start, before the page is drawn: switches on cleanup.css (which the manifest also loads at document_start) by setting the
// attribute on <html>. content/cleanup.js takes over once the content script has started. Nothing else happens here.
(async () => {
  try {
    const { settings } = await chrome.storage.local.get('settings');
    if (settings && settings.enabled === false) return;
    const c = (settings && settings.cleanup) || {};
    const tokens = ['shorts', 'games', 'movies', 'explore', 'more', 'banners'].filter((t) => c[t] !== false);   // the same list as TOKENS in core/cleanup.js
    if (tokens.length) document.documentElement.setAttribute('data-vianney-clean', tokens.join(' '));
  } catch (e) { /* the extension was reloaded: this old script is orphaned */ }
})();
