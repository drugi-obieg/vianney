// Collects what core/nanocheck.js judges: what this browser says about itself, what Chrome's model interface answers, the reason that Chrome gives when the
// model cannot be started, the free disk space of the profile, and the graphics adapter. Browser APIs only (navigator, LanguageModel); no extension API, so the same
// file runs in the settings page, in the service worker (which answers the website) and, as a copy, on the website (tools/make-site-data.mjs).
//
// Nothing here changes anything: availability() asks, and create() is tried only where Chrome has already said "unavailable", where it fails at once and its
// error is Chrome's own explanation. Where the answer is "downloadable", a session would start a download, which Chrome allows only in answer to a click: not here.

const IO = {
  text: { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] },
  image: { expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }], expectedOutputs: [{ type: 'text', languages: ['en'] }] },
  audio: { expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'audio' }], expectedOutputs: [{ type: 'text', languages: ['en'] }] },
};

/** The promise, or an error after `ms`: a diagnostic must not hang on the thing it diagnoses. */
function within(ms, promise) {
  let timer;
  const late = new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('no answer in time'), { name: 'TimeoutError' })), ms); });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

/**
 * @param {{where?: 'extension'|'page'}} [o] where: in an extension page (or the service worker) the storage quota is not capped, so it measures the free disk space
 * @returns {Promise<object>} the facts of core/nanocheck.js checklist()
 */
export async function collectFacts({ where = 'page' } = {}) {
  const nav = globalThis.navigator || {};
  const uad = nav.userAgentData;
  const f = {
    where,
    ua: nav.userAgent || '',
    brands: uad && uad.brands ? uad.brands.map(({ brand, version }) => ({ brand, version })) : [],
    platform: (uad && uad.platform) || '',
    mobile: !!(uad && uad.mobile),
    cores: nav.hardwareConcurrency || 0,
    hasApi: typeof globalThis.LanguageModel !== 'undefined',
    availability: {},
    reason: {},
    freeBytes: null,
    gpu: null,
  };

  if (f.hasApi) {
    for (const kind of Object.keys(IO)) {
      try { f.availability[kind] = await within(5000, globalThis.LanguageModel.availability(IO[kind])); } catch (e) { f.availability[kind] = 'error:' + ((e && e.name) || 'unknown'); }
    }
    for (const kind of Object.keys(IO)) {
      if (f.availability[kind] !== 'unavailable') continue;
      try {
        const session = await within(4000, globalThis.LanguageModel.create(IO[kind]));
        try { if (session && session.destroy) session.destroy(); } catch (e) { /* it was not needed */ }
        f.reason[kind] = null;      // it started after all: the answer above was out of date
      } catch (e) {
        f.reason[kind] = { name: (e && e.name) || 'Error', message: String((e && e.message) || '') };
      }
    }
  }

  // An extension with unlimitedStorage has no quota of its own: what the browser reports is what it has already stored plus the free space of the drive that
  // holds the profile, which is the drive that Chrome's check looks at. [live] 47289504350 = 86622 used + 47289417728 free (chrome.system.storage said the same).
  // A web page's quota is a share of the whole disk, so it says nothing about what is free.
  if (where === 'extension' && nav.storage && nav.storage.estimate) {
    try {
      const { quota, usage } = await nav.storage.estimate();
      if (Number.isFinite(quota) && Number.isFinite(usage) && quota >= usage) f.freeBytes = quota - usage;
    } catch (e) { /* not measured */ }
  }

  try {
    if (nav.gpu && nav.gpu.requestAdapter) {
      const adapter = await within(3000, nav.gpu.requestAdapter());
      if (adapter) {
        const info = adapter.info || (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : {});
        f.gpu = { vendor: info.vendor || '', architecture: info.architecture || '', description: info.description || '' };
      }
    }
  } catch (e) { /* no adapter for this page */ }
  return f;
}
