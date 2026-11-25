// Entry point of the content script (loaded by loader.js as an ES module).
// Wires together: engine, feed filter, watch guard, break reminder, watch-time tracking.

import { Engine } from '../core/engine.js';
import { isDue } from '../core/breaktimer.js';
import { loadSettings, loadPack, mergeSettings } from '../shared/config.js';
import { FeedFilter } from './feed.js';
import { WatchGuard } from './watch.js';
import { BreakUI } from './breakcard.js';
import { startWatchTimeTracking } from './watchtime.js';
import { findCards } from './discover.js';

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
    enabled: false,
    askNoul: (question, text) => send({ type: 'ai-ask', kind: 'noul', question, text }),
    askScore: (question, levels, text) => send({ type: 'ai-ask', kind: 'score', question, levels, text }),
  };

  const makeEngine = () => new Engine({ rules: pack.parsed.rules, lexicons: pack.lexicons, settings, backend });
  let engine = makeEngine();

  const log = (entry) => { send({ type: 'log', entry: { ...entry, page: location.pathname } }); };

  const feed = new FeedFilter({ engine, log, getSettings: () => settings });
  const watch = new WatchGuard({ engine, log, getSettings: () => settings });

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

  feed.start();
  watch.start();
  startWatchTimeTracking((seconds) => send({ type: 'watch-tick', seconds }));
  refreshBreak();
  refreshAi();
  setInterval(refreshAi, 60000);

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
      }
      engine.setSettings(settings);
      feed.refilter();
      watch.settingsChanged();
      refreshBreak();
      refreshAi();
    }
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
          feed: { hidden: feed.hiddenCount, cards: findCards().length, states: [...document.querySelectorAll('[data-vianney-state]')].map((el) => ({ state: el.dataset.vianneyState, reason: el.dataset.vianneyReason })) },
          watch: watch.snapshot(),
          brk: { due: isDue(breakState, settings.brk), state: breakState, ui: breakUI.state() },
          rules: pack.parsed.rules.map((r) => r.id),
          problems: pack.problems,
          aiEnabled: backend.enabled,
        };
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
