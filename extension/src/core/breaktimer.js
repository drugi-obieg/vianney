// Break reminder arithmetic: how long has the user been watching, and is a reminder due?
// Pure functions over a small state object so they can be tested without a browser.
//
// Watch time is the time a video is actually playing, summed over all tabs by the service worker.
// A period is either a "session" (ends after a gap without playback) or a calendar day.

export const DEFAULTS = Object.freeze({
  enabled: true,
  afterMinutes: 120,       // N: the user sets this
  snoozeMinutes: 15,       // "Remind me later"
  period: 'session',       // 'session' | 'day'
  sessionGapMinutes: 30,   // M: a pause this long starts a new session
  showCard: true,
  showBanner: true,
});

/** Local calendar day key, e.g. "2026-11-25". */
export function dayKey(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function freshState(nowMs, cfg) {
  return {
    periodKey: cfg.period === 'day' ? dayKey(nowMs) : 'session',
    accumSeconds: 0,
    lastPlayMs: 0,
    nextDueSeconds: cfg.afterMinutes * 60,
  };
}

/** Record `seconds` of playback that ended at `nowMs`. Returns the new state. */
export function addPlayback(state, nowMs, seconds, cfg) {
  let s = state && typeof state === 'object' ? { ...state } : freshState(nowMs, cfg);
  const gapMs = cfg.sessionGapMinutes * 60 * 1000;
  if (cfg.period === 'day') {
    const key = dayKey(nowMs);
    if (s.periodKey !== key) s = { ...freshState(nowMs, cfg), periodKey: key };
  } else if (s.periodKey !== 'session' || (s.lastPlayMs && nowMs - s.lastPlayMs > gapMs + seconds * 1000)) {
    s = freshState(nowMs, cfg);
  }
  s.accumSeconds += Math.max(0, seconds);
  s.lastPlayMs = nowMs;
  return s;
}

export function isDue(state, cfg) {
  if (!cfg.enabled || !state) return false;
  return state.accumSeconds >= state.nextDueSeconds;
}

/** "Remind me later": due again after `snoozeMinutes` more of watching. */
export function snooze(state, cfg) {
  return { ...state, nextDueSeconds: state.accumSeconds + cfg.snoozeMinutes * 60 };
}

/** "Dismiss": due again after another full `afterMinutes` of watching. */
export function dismiss(state, cfg) {
  return { ...state, nextDueSeconds: state.accumSeconds + cfg.afterMinutes * 60 };
}

/** Human text such as "2 hours" or "1 hour 30 minutes". */
export function formatDuration(seconds) {
  const m = Math.round(seconds / 60);
  const h = Math.floor(m / 60);
  const r = m % 60;
  const parts = [];
  if (h) parts.push(`${h} hour${h === 1 ? '' : 's'}`);
  if (r || !h) parts.push(`${r} minute${r === 1 ? '' : 's'}`);
  return parts.join(' ');
}
