// Service worker: the one place that writes shared state (log, watch time, break state) and the
// host of the optional Prompt API backend. It keeps nothing in memory that matters: it can be stopped
// and restarted by the browser at any time, so all state lives in chrome.storage.local.

import { addPlayback, snooze, dismiss, freshState } from '../core/breaktimer.js';
import { hashText } from '../core/text.js';
import { loadSettings } from '../shared/config.js';
import * as ai from '../ai/prompt-backend.js';
import * as kev from '../ai/kev-backend.js';
import { askLayered } from '../core/layered.js';
import { addToLog, compactLog } from '../core/logmerge.js';
import { openable } from '../core/nanocheck.js';
import { collectFacts } from '../shared/nanoprobe.js';
import { backendSetting, buildLayers, statusFor, answerFor, fromExtensionPage } from '../ai/ai-router.js';

// Serialise every read-modify-write on storage so that parallel tabs cannot overwrite each other.
let chain = Promise.resolve();
function exclusive(fn) {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

async function readBreakState(cfg) {
  const { breakState } = await chrome.storage.local.get('breakState');
  return breakState || freshState(Date.now(), cfg);
}

async function appendLog(entry) {
  const settings = await loadSettings();
  if (!settings.log.enabled) return { ok: true, skipped: true };
  const { log: before = [] } = await chrome.storage.local.get('log');
  // one row for each thing that was checked, however often it was looked at (core/logmerge.js)
  const log = addToLog(before, { ...entry, t: entry.t || Date.now() }, settings.log.max);
  await chrome.storage.local.set({ log });
  return { ok: true, size: log.length };
}

let kevAnnounced = false;   // the end of a download is announced to the tabs once
let availabilityCache = { at: 0, value: 'unknown' };
async function aiAvailability(force = false) {
  if (!force && Date.now() - availabilityCache.at < 30000) return availabilityCache.value;
  availabilityCache = { at: Date.now(), value: await ai.getAvailability() };
  return availabilityCache.value;
}

// ------------------------------------------------------------------ pictures and sound (experimental)
const MEDIA_CACHE_MAX = 1500;
const MEDIA_CACHE_TTL_MS = 30 * 24 * 3600 * 1000;
const FLAGGED_MAX = 2000;
const thumbBlobs = new Map(); // small in-memory LRU of thumbnail blobs

let mediaAvailCache = { at: 0, value: null };
async function mediaAvailability(force = false) {
  if (!force && mediaAvailCache.value && Date.now() - mediaAvailCache.at < 30000) return mediaAvailCache.value;
  const [image, audio] = await Promise.all([ai.getMediaAvailability('image'), ai.getMediaAvailability('audio')]);
  mediaAvailCache = { at: Date.now(), value: { image, audio } };
  return mediaAvailCache.value;
}

/** The thumbnail of a video, from YouTube's image server (which allows cross-origin reads). */
async function fetchThumbnail(id) {
  if (!/^[\w-]{11}$/.test(id)) throw new Error('bad video id');
  if (thumbBlobs.has(id)) { const b = thumbBlobs.get(id); thumbBlobs.delete(id); thumbBlobs.set(id, b); return b; }
  let blob = null;
  for (const name of ['mqdefault', 'hqdefault']) {
    const res = await fetch(`https://i.ytimg.com/vi/${id}/${name}.jpg`, { credentials: 'omit' });
    if (!res.ok) continue;
    blob = await res.blob();
    if (blob.size > 1500) break; // a missing size comes back as a tiny placeholder
  }
  if (!blob) throw new Error('no thumbnail');
  thumbBlobs.set(id, blob);
  while (thumbBlobs.size > 24) thumbBlobs.delete(thumbBlobs.keys().next().value);
  return blob;
}

function wavBlobFromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'audio/wav' });
}

async function mediaCacheGet(key) {
  const { mediaCache = {} } = await chrome.storage.local.get('mediaCache');
  const hit = mediaCache[key];
  return hit && Date.now() - hit.t < MEDIA_CACHE_TTL_MS ? hit.p : null;
}

function mediaCachePut(key, p) {
  return exclusive(async () => {
    const { mediaCache = {} } = await chrome.storage.local.get('mediaCache');
    mediaCache[key] = { p, t: Date.now() };
    const keys = Object.keys(mediaCache);
    if (keys.length > MEDIA_CACHE_MAX) {
      keys.sort((a, b) => mediaCache[a].t - mediaCache[b].t).slice(0, keys.length - MEDIA_CACHE_MAX).forEach((k) => delete mediaCache[k]);
    }
    await chrome.storage.local.set({ mediaCache });
  });
}

async function handleMediaAsk(msg) {
  const settings = await loadSettings();
  const kind = msg.kind === 'audio' ? 'audio' : 'image';
  const part = kind === 'audio' ? settings.media.audio : settings.media.thumbnails;
  if (!settings.enabled || !settings.media.enabled || !part.enabled) return { p: null, error: 'disabled' };
  const avail = (await mediaAvailability())[kind];
  if (avail !== 'available') return { p: null, error: 'unavailable' };
  const votes = Math.min(3, Math.max(1, Number(msg.votes) || 2));
  let key = null;
  if (kind === 'image') {
    key = `image|${msg.media.videoId}|${hashText(msg.question)}|${votes}`;
    const cached = await mediaCacheGet(key);
    if (cached !== null) return { p: cached, cached: true };
  }
  let blob;
  try {
    blob = kind === 'image' ? await fetchThumbnail(msg.media.videoId) : wavBlobFromBase64(msg.media.wav);
  } catch (e) {
    return { p: null, error: 'fetch-failed' };
  }
  const r = await ai.askMedia(kind, msg.question, blob, { votes });
  if (key && typeof r.p === 'number') await mediaCachePut(key, r.p);
  return r;
}

function rememberFlagged(entry) {
  return exclusive(async () => {
    const settings = await loadSettings();
    if (!settings.media.rememberFlagged || !/^[\w-]{11}$/.test(entry.id || '')) return { ok: false };
    const { flaggedVideos = {} } = await chrome.storage.local.get('flaggedVideos');
    // keep the highest score seen for each rule: the verdict itself is made again from these scores when it is used
    const merged = new Map(((flaggedVideos[entry.id] && flaggedVideos[entry.id].by) || []).map((b) => [b.rule, b.p]));
    for (const b of entry.by || []) if (b && typeof b.rule === 'string' && typeof b.p === 'number') merged.set(b.rule, Math.max(merged.get(b.rule) || 0, b.p));
    flaggedVideos[entry.id] = { t: Date.now(), by: [...merged].map(([rule, p]) => ({ rule, p })), kind: entry.kind || 'audio' };
    const keys = Object.keys(flaggedVideos);
    if (keys.length > FLAGGED_MAX) keys.sort((a, b) => flaggedVideos[a].t - flaggedVideos[b].t).slice(0, keys.length - FLAGGED_MAX).forEach((k) => delete flaggedVideos[k]);
    await chrome.storage.local.set({ flaggedVideos });
    return { ok: true };
  });
}

async function handle(msg, sender) {
  switch (msg && msg.type) {
    case 'log':
      return exclusive(() => appendLog(msg.entry));

    case 'watch-tick':
      return exclusive(async () => {
        const { brk } = await loadSettings();
        const next = addPlayback(await readBreakState(brk), Date.now(), Number(msg.seconds) || 0, brk);
        await chrome.storage.local.set({ breakState: next });
        return { ok: true, accumSeconds: next.accumSeconds };
      });

    case 'break-snooze':
    case 'break-dismiss':
      return exclusive(async () => {
        const { brk } = await loadSettings();
        const s = await readBreakState(brk);
        const next = msg.type === 'break-snooze' ? snooze(s, brk) : dismiss(s, brk);
        await chrome.storage.local.set({ breakState: next });
        return { ok: true };
      });

    case 'break-test': // make the reminder due right now (settings page button)
      return exclusive(async () => {
        const { brk } = await loadSettings();
        const s = await readBreakState(brk);
        await chrome.storage.local.set({ breakState: { ...s, accumSeconds: Math.max(s.accumSeconds, 1), nextDueSeconds: Math.max(s.accumSeconds, 1) } });
        return { ok: true };
      });

    case 'break-reset':
      return exclusive(async () => {
        const { brk } = await loadSettings();
        await chrome.storage.local.set({ breakState: freshState(Date.now(), brk) });
        return { ok: true };
      });

    case 'ai-status': {
      // which models can answer: Kev-0.6B (local, first) and Chrome's own model (second look); see ai/ai-router.js
      const settings = await loadSettings();
      const backend = backendSetting(settings);
      const kevState = backend === 'prompt' ? { ready: false, state: 'off' } : await kev.readiness(!!msg.force);
      const promptAvailability = backend === 'kev' ? 'unavailable' : await aiAvailability(!!msg.force);
      return statusFor({ settings, kev: kevState, promptAvailability });
    }

    case 'ai-ask': {
      const settings = await loadSettings();
      if (!settings.ai.enabled) return { p: null, error: 'disabled' };
      const backend = backendSetting(settings);
      const kevState = backend === 'prompt' ? { ready: false } : await kev.readiness();
      const promptAvailability = backend === 'kev' ? 'unavailable' : await aiAvailability();
      const question = String(msg.question || '');
      const text = String(msg.text || '');
      const score = msg.kind === 'score';
      const layers = buildLayers({
        backend,
        kev: { ready: kevState.ready, ask: () => (score ? kev.askScore(question, msg.levels, text) : kev.askNoul(question, text)) },
        prompt: { available: promptAvailability === 'available', ask: () => (score ? ai.askScore(question, msg.levels, text) : ai.askNoul(question, text)) },
      });
      return answerFor(await askLayered(layers));
    }

    // ---- the local model: only pages of this extension may look at it, start, stop or delete a download (never a content script on a web page)
    case 'kev-status':
    case 'kev-download':
    case 'kev-pause':
    case 'kev-cancel':
    case 'kev-delete':
    case 'kev-progress':
    case 'kev-idle': {
      if (!fromExtensionPage(sender, chrome.runtime.getURL(''), chrome.runtime.id)) return { ok: false, error: 'not allowed' };
      if (msg.type === 'kev-status') return kev.status(msg.preferSet === 'q4f16' ? 'q4f16' : 'q4');
      if (msg.type === 'kev-download') {
        // the test build (debug on) may name a local server instead of Hugging Face; the files are checked against pinned hashes either way
        const settings = await loadSettings();
        const base = settings.debug && /^http:\/\/(127\.0\.0\.1|localhost):\d+\//.test(String(msg.base || '')) ? String(msg.base) : null;
        return kev.download(msg.set, base);
      }
      if (msg.type === 'kev-pause') return kev.pause();
      if (msg.type === 'kev-cancel') return kev.cancel();
      if (msg.type === 'kev-delete') { const r = await kev.remove(); await chrome.storage.local.set({ kevEpoch: Date.now() }); return r; }
      if (msg.type === 'kev-progress') {
        kev.forget();
        if (msg.job && msg.job.finished && !kevAnnounced) { kevAnnounced = true; await chrome.storage.local.set({ kevEpoch: Date.now() }); }   // tabs look at the models again at once
        if (msg.job && msg.job.phase === 'downloading') kevAnnounced = false;
        return { ok: true };
      }
      // 'kev-idle': the model has been unused for a while; close its page, unless a download needs it
      const st = await kev.status();
      if (!st.job || st.job.phase === 'idle') await kev.closeDocument();
      return { ok: true };
    }

    case 'debug-reset-ai': { // for the browser tests, when the debug switch is on: forget the model sessions, so a new stand-in is used
      const settings = await loadSettings();
      if (!settings.debug) return { error: 'debug only' };
      ai.resetSession();
      await kev.resetSession();
      mediaAvailCache = { at: 0, value: null };
      availabilityCache = { at: 0, value: 'unknown' };
      return { ok: true };
    }

    case 'media-status':
      return mediaAvailability(!!msg.force);

    case 'media-ask':
      return handleMediaAsk(msg);

    case 'media-flag':
      return rememberFlagged(msg.entry || {});

    case 'media-clear':
      return exclusive(async () => {
        await chrome.storage.local.remove(['mediaCache', 'flaggedVideos']);
        thumbBlobs.clear();
        return { ok: true };
      });

    default:
      return { error: 'unknown message' };
  }
}

// Where the model lives in this very page (Firefox, Safari: no offscreen document), its announcements do not come back as messages: they are handled here,
// as the ones of the offscreen document are, with the sender that they would have had.
kev.onLocalMessage((msg) => handle(msg, { id: chrome.runtime.id, origin: chrome.runtime.getURL('').replace(/\/+$/, ''), url: chrome.runtime.getURL('src/ai/kev-offscreen.html') }));

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg, sender).then(sendResponse).catch((e) => sendResponse({ error: String((e && e.message) || e) }));
  return true; // asynchronous response
});

// The website (vianney.cc) can ask this extension for two things, because a web page cannot do them itself: to open a page of Chrome (a browser does not
// let a page navigate to chrome:// addresses, however it asks), and for the facts that only an extension sees (free disk space of the profile). The manifest
// lets only that site send messages (externally_connectable); this checks the origin again, and opens only the addresses of core/nanocheck.js, nothing else.
const SITE_ORIGINS = ['https://vianney.cc', 'https://www.vianney.cc'];

async function handleSite(msg, sender) {
  if (!sender || !SITE_ORIGINS.includes(String(sender.origin || '').replace(/\/+$/, ''))) return { ok: false, error: 'not allowed' };
  switch (msg && msg.type) {
    case 'hello': return { ok: true, id: chrome.runtime.id, version: chrome.runtime.getManifest().version };
    case 'open':
      if (!openable(msg.url)) return { ok: false, error: 'not allowed' };
      await chrome.tabs.create({ url: msg.url });
      return { ok: true };
    case 'nano-facts': return { ok: true, facts: await collectFacts({ where: 'extension' }) };
    default: return { ok: false, error: 'unknown message' };
  }
}

// (Chrome only: the other browsers either lack the event or never fire it, as the manifest of their builds has no externally_connectable. A missing event must not
// stop the whole script, so it is looked for first.)
if (chrome.runtime.onMessageExternal) {
  chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
    handleSite(msg, sender).then(sendResponse).catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }));
    return true;
  });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) await chrome.storage.local.set({ settings: {} });
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
  if (details.reason === 'update') {
    // An earlier version put a count of hidden cards on the toolbar icon, tab by tab; it is gone, and a tab that is already open still shows it.
    try { for (const t of await chrome.tabs.query({})) chrome.action.setBadgeText({ tabId: t.id, text: '' }).catch(() => {}); } catch (e) { /* no tabs to clear */ }
    // ... and it wrote a row of the log each time it looked at the same video: join them
    await exclusive(async () => {
      const { log } = await chrome.storage.local.get('log');
      if (Array.isArray(log) && log.length) await chrome.storage.local.set({ log: compactLog(log, (await loadSettings()).log.max) });
    });
  }
});
