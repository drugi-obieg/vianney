// Service worker: the one place that writes shared state (log, watch time, break state) and the
// host of the optional Prompt API backend. It keeps nothing in memory that matters: it can be stopped
// and restarted by the browser at any time, so all state lives in chrome.storage.local.

import { addPlayback, snooze, dismiss, freshState } from '../core/breaktimer.js';
import { loadSettings } from '../shared/config.js';
import * as ai from '../ai/prompt-backend.js';

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
  const { log = [] } = await chrome.storage.local.get('log');
  log.push({ ...entry, t: entry.t || Date.now() });
  const extra = log.length - settings.log.max;
  if (extra > 0) log.splice(0, extra);
  await chrome.storage.local.set({ log });
  return { ok: true, size: log.length };
}

let availabilityCache = { at: 0, value: 'unknown' };
async function aiAvailability(force = false) {
  if (!force && Date.now() - availabilityCache.at < 30000) return availabilityCache.value;
  availabilityCache = { at: Date.now(), value: await ai.getAvailability() };
  return availabilityCache.value;
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

    case 'ai-status':
      return { availability: await aiAvailability(!!msg.force), host: 'service-worker' };

    case 'ai-ask': {
      const settings = await loadSettings();
      if (!settings.ai.enabled) return { p: null, error: 'disabled' };
      if ((await aiAvailability()) !== 'available') return { p: null, error: 'unavailable' };
      return msg.kind === 'score' ? ai.askScore(msg.question, msg.levels, msg.text) : ai.askNoul(msg.question, msg.text);
    }

    case 'badge': {
      if (!sender || !sender.tab) return { ok: false };
      const text = msg.count > 0 ? String(Math.min(msg.count, 999)) : '';
      await chrome.action.setBadgeText({ tabId: sender.tab.id, text });
      if (text) await chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#7a1f2b' });
      return { ok: true };
    }

    default:
      return { error: 'unknown message' };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg, sender).then(sendResponse).catch((e) => sendResponse({ error: String((e && e.message) || e) }));
  return true; // asynchronous response
});

chrome.runtime.onInstalled.addListener(async (details) => {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) await chrome.storage.local.set({ settings: {} });
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});
