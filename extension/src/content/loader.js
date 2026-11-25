// Content scripts cannot use static imports, so this tiny classic script loads the real entry point
// as an ES module (it is listed under web_accessible_resources in the manifest).
(async () => {
  try {
    const main = await import(chrome.runtime.getURL('src/content/main.js'));
    await main.start();
  } catch (e) {
    console.warn('[Vianney] could not start:', e);
  }
})();
