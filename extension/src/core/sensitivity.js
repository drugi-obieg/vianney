// Per-rule sensitivity: how confident a rule must be before it flags.
//
// Every rule has a default `flag at` level. The user may override it with a slider (yes/no rules) or a
// dropdown (rules with levels). The setting is stored as settings.sensitivity[ruleId].
// Nothing here learns: the same settings always give the same threshold.

export const PRESETS = Object.freeze({ strict: 0.9, balanced: 0.7, lenient: 0.5 });

// [choice] The "uncertain" band starts this far below the flag threshold. It is fixed, so moving the
// slider never needs a second setting. To be re-fitted on the labelled set.
export const UNCERTAIN_OFFSET = 0.2;

// [choice] A word-list hit that a rule asks the model to confirm (`confirm: model`) stands unless the model answers BELOW this: it is overruled only when the model
// is fairly sure that it is not what the rule is about (a Catholic warning about Freemasonry, say). The same bound as UNSURE_LOW in layered.js. To be re-fitted
// on the labelled set.
export const VETO_BELOW = 0.35;

// [choice] A strong word-list hit of a rule with `spare channel` whose card comes from a channel that hits that list (a Catholic channel) is lowered to this far under the
// flag level, which is inside the uncertain band of every rule that has the default band (0.2): the model decides. To be re-fitted on the labelled set.
export const SPARE_DROP = 0.05;

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

/**
 * The lowest word-list score that still asks the model. A rule may widen the band with `band: <number>`; the default is
 * UNCERTAIN_OFFSET. (A rule that flags only at its top level, such as gossip at "heavy" = 1.0, needs a wide band: its cues
 * weigh 0.75 at most, so with the default band the model was never asked and the rule could never fire.)
 */
export function uncertainFloor(flagAt, width = UNCERTAIN_OFFSET) {
  const w = Number.isFinite(width) ? Math.min(1, Math.max(0, width)) : UNCERTAIN_OFFSET;
  return Math.max(0, flagAt - w);
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
