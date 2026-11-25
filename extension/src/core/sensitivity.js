// Per-rule sensitivity: how confident a rule must be before it flags.
//
// Every rule has a default `flag at` level. The user may override it with a slider (yes/no rules) or a
// dropdown (rules with levels). The setting is stored as settings.sensitivity[ruleId].
// Nothing here learns: the same settings always give the same threshold.

export const PRESETS = Object.freeze({ strict: 0.9, balanced: 0.7, lenient: 0.5 });

// [choice] The "uncertain" band starts this far below the flag threshold. It is fixed, so moving the
// slider never needs a second setting. To be re-fitted on the labelled set.
export const UNCERTAIN_OFFSET = 0.2;

const EPS = 1e-9;

/** Effective flag-at threshold (0..1) for a rule under the user's settings. */
export function flagAtFor(rule, settings) {
  const o = settings && settings.sensitivity ? settings.sensitivity[rule.id] : undefined;
  if (o === undefined || o === null || o === '') return rule.flagAt;
  if (rule.levels && typeof o === 'string' && Number.isNaN(Number(o))) {
    const i = rule.levels.indexOf(o);
    return i < 0 ? rule.flagAt : i / (rule.levels.length - 1);
  }
  const v = Number(o);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : rule.flagAt;
}

export function uncertainFloor(flagAt) {
  return Math.max(0, flagAt - UNCERTAIN_OFFSET);
}

export function isFlagged(p, flagAt) {
  return p >= flagAt - EPS;
}

/** Name of the level a numeric threshold corresponds to, for rules with levels. */
export function levelLabel(rule, flagAt) {
  if (!rule.levels) return null;
  const i = Math.round(flagAt * (rule.levels.length - 1));
  return rule.levels[Math.min(rule.levels.length - 1, Math.max(0, i))];
}

/**
 * Preview: how many logged items would flag more or less at another sensitivity.
 * @param {{ps?: Record<string, number>}[]} entries log entries with the probabilities per rule
 */
export function wouldChange(entries, ruleId, currentFlagAt, newFlagAt) {
  let more = 0;
  let fewer = 0;
  let considered = 0;
  for (const e of entries) {
    const p = e.ps ? e.ps[ruleId] : undefined;
    if (p === undefined) continue;
    considered++;
    const now = isFlagged(p, currentFlagAt);
    const then = isFlagged(p, newFlagAt);
    if (!now && then) more++;
    if (now && !then) fewer++;
  }
  return { more, fewer, considered };
}
