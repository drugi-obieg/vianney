// Entry point of the content script (loaded by loader.js as an ES module).
// Wires together: engine, feed filter, watch guard, break reminder, watch-time tracking, and the experimental
// picture (thumbnail) and sound checks.

import { Engine } from '../core/engine.js';
import { isDue } from '../core/breaktimer.js';
import { loadSettings, loadPack, mergeSettings } from '../shared/config.js';
import { FeedFilter } from './feed.js';
import { WatchGuard } from './watch.js';
import { BreakUI } from './breakcard.js';
import { startWatchTimeTracking } from './watchtime.js';
import { findCards, videoIdOf } from './discover.js';
import { ThumbnailGuard } from './thumbs.js';
import { AudioGuard, pageVideoId, pageVideo } from './audio.js';

function send(msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; resolve(r); });
    } catch (e) {
      resolve(undefined); // the extension was reloaded: this old content script is orphaned
    }
  });
}

export async function start() {
  if (window.__vianneyStarted) return;
  window.__vianneyStarted = true;

  let settings = await loadSettings();
  let pack = await loadPack(settings);

  // The Prompt API backend lives in the service worker; this is a thin proxy.
  const backend = {
    enabled: false,                              // the model can answer text questions
    mediaEnabled: { image: false, audio: false }, // it can judge pictures / sound, and the settings allow it
    askNoul: (question, text) => send({ type: 'ai-ask', kind: 'noul', question, text }),
    askScore: (question, levels, text) => send({ type: 'ai-ask', kind: 'score', question, levels, text }),
    askMedia: (kind, question, media, opts) => send({ type: 'media-ask', kind, question, media, votes: opts && opts.votes }),
  };

  const makeEngine = () => new Engine({ rules: pack.parsed.rules, lexicons: pack.lexicons, settings, backend });
  let engine = makeEngine();

  const log = (entry) => { send({ type: 'log', entry: { ...entry, page: location.pathname } }); };

  const thumbs = new ThumbnailGuard({ engine, log, getSettings: () => settings, rescan: () => feed.schedule(0) });
  const feed = new FeedFilter({ engine, log, getSettings: () => settings, onCards: (cards) => thumbs.observe(cards) });
  const watch = new WatchGuard({ engine, log, getSettings: () => settings });
  const audio = new AudioGuard({
    engine, log, getSettings: () => settings,
    getContext: () => {
      const id = pageVideoId();
      if (!id) return null;
      const v = watch.video && watch.video.id === id ? watch.video : null;
      return { videoId: id, video: pageVideo(), title: v ? v.title : '', channel: v ? v.author : '', captionsLoaded: watch.captionStatus === 'loaded' };
    },
    warn: (top, text) => watch.showWarning(top, text),
    remember: (entry) => send({ type: 'media-flag', entry }),
  });

  // ---- break reminder
  let breakState = (await chrome.storage.local.get('breakState')).breakState || null;
  const breakUI = new BreakUI({
    onSnooze: () => send({ type: 'break-snooze' }),
    onDismiss: () => send({ type: 'break-dismiss' }),
  });
  let breakTimer = null;
  function refreshBreak() {
    const due = isDue(breakState, settings.brk);
    clearInterval(breakTimer);
    if (!due) { breakUI.remove(); return; }
    const apply = () => breakUI.update({ due: true, seconds: (breakState && breakState.accumSeconds) || 0, cfg: settings.brk, cards: findCards() });
    apply();
    breakTimer = setInterval(apply, 1500); // YouTube redraws grids: put the card back when it disappears
  }

  // ---- AI availability (checked now and then, because the model can come and go)
  async function refreshAi() {
    const r = await send({ type: 'ai-status' });
    const was = backend.enabled;
    backend.enabled = !!settings.ai.enabled && !!r && r.availability === 'available';
    if (backend.enabled && !was) { engine.cache.clear(); feed.refilter(); watch.settingsChanged(); }
  }

  // ---- pictures and sound (experimental): which kinds the model can judge right now, and the settings allow
  async function refreshMedia() {
    const m = settings.media;
    const want = !!settings.enabled && !!m.enabled;
    const r = want ? await send({ type: 'media-status' }) : null;
    const before = JSON.stringify(backend.mediaEnabled);
    backend.mediaEnabled = {
      image: !!(want && m.thumbnails.enabled && r && r.image === 'available'),
      audio: !!(want && m.audio.enabled && r && r.audio === 'available'),
    };
    return JSON.stringify(backend.mediaEnabled) !== before;
  }
  async function applyMedia() {
    await refreshMedia();
    thumbs.refresh();
    audio.refresh();
  }

  feed.start();
  thumbs.start();
  audio.start();
  watch.start();
  startWatchTimeTracking((seconds) => send({ type: 'watch-tick', seconds }));
  refreshBreak();
  refreshAi();
  setInterval(refreshAi, 60000);
  applyMedia();
  setInterval(async () => { if (await refreshMedia()) { thumbs.refresh(); audio.refresh(); } }, 60000);
  chrome.storage.local.get('flaggedVideos').then(({ flaggedVideos }) => { if (flaggedVideos) feed.setRemembered(flaggedVideos); });

  let lastBadge = -1;
  setInterval(() => {
    if (feed.hiddenCount !== lastBadge) { lastBadge = feed.hiddenCount; send({ type: 'badge', count: lastBadge }); }
  }, 2000);

  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;
    if (changes.settings) {
      const prev = settings;
      settings = mergeSettings(changes.settings.newValue);
      if (prev.rulesText !== settings.rulesText) {
        pack = await loadPack(settings);
        engine = makeEngine();
        feed.engine = engine;
        watch.engine = engine;
        thumbs.engine = engine;
        audio.engine = engine;
      }
      engine.setSettings(settings);
      feed.refilter();
      watch.settingsChanged();
      refreshBreak();
      refreshAi();
      applyMedia();
    }
    if (changes.flaggedVideos) feed.setRemembered(changes.flaggedVideos.newValue || {});
    if (changes.breakState) {
      breakState = changes.breakState.newValue || null;
      refreshBreak();
    }
  });

  // ---- debug interface for the end-to-end tests (only when settings.debug is true)
  // The page writes a command into an attribute; we answer in another one. Disabled by default.
  const root = document.documentElement;
  new MutationObserver(async () => {
    if (!settings.debug) return;
    const raw = root.getAttribute('data-vianney-cmd');
    if (!raw) return;
    root.removeAttribute('data-vianney-cmd');
    let reply;
    try {
      const { id, cmd, args } = JSON.parse(raw);
      if (cmd === 'snapshot') {
        reply = {
          id,
          feed: { hidden: feed.hiddenCount, lastScanMs: feed.lastScanMs, findMs: (() => { const t = performance.now(); findCards(); return Math.round(performance.now() - t); })(), cards: findCards().length, ids: findCards().map((c) => c.id), states: [...document.querySelectorAll('[data-vianney-state]')].map((el) => { const a = el.querySelector('a[title]'); const link = el.querySelector('a[href*="/watch?v="], a[href*="/shorts/"]'); return { id: link ? videoIdOf(link) : null, state: el.dataset.vianneyState, reason: el.dataset.vianneyReason, title: (a ? a.getAttribute('title') : el.textContent.replace(/\s+/g, ' ').trim()).slice(0, 90) }; }) },
          watch: watch.snapshot(),
          thumbs: thumbs.snapshot(),
          audio: audio.snapshot(),
          media: backend.mediaEnabled,
          brk: { due: isDue(breakState, settings.brk), state: breakState, ui: breakUI.state() },
          rules: pack.parsed.rules.map((r) => r.id),
          problems: pack.problems,
          aiEnabled: backend.enabled,
        };
      } else if (cmd === 'video') {
        // simulate the page hook announcing a video (for tests): same code path as the real message
        watch.video = null;
        watch.state = { metaChecked: false };
        await watch.onVideo(args.video);
        reply = { id, watch: watch.snapshot() };
      } else if (cmd === 'flush') {
        reply = { id, ok: true };
      } else if (cmd === 'evaluate') {
        const v = await engine.evaluate(args.item, args.surface);
        reply = { id, flagged: v.flagged.map((r) => ({ rule: r.ruleId, p: r.p })), ps: v.ps, action: v.action };
      } else reply = { id, error: 'unknown command' };
    } catch (e) {
      reply = { error: String(e) };
    }
    root.setAttribute('data-vianney-reply', JSON.stringify(reply));
  }).observe(root, { attributes: true, attributeFilter: ['data-vianney-cmd'] });
}
