// Examples inside the question: a small model answers better when it is shown what counts and what does not.
//
// The rule author's own lines are the examples: every `example:` line of a rule is a title it must flag, every `spared:` line a title that looks similar
// and is left alone. The model is shown a few of each beside the question, the ones nearest to the text it is asked about (so that a Catholic warning meets
// the other Catholic warnings, and an invitation to join meets the other invitations). Nothing here learns: the same rule, text and settings give the same
// question. The settings page lets the owner add lines (real titles of channels he knows) to a rule's `spared:` or `example:` lines, and they are used from then on.
//
// "Leave out" is for tests and for the check on the rule examples: an example that is the text itself must not be shown to the model as its own answer.

import { splitLine } from './rules.js';

// [choice] The most examples per side that are ever shown, whatever the settings say. A title is short, and the small model reads at most 1,024 tokens in all.
export const MAX_SHOTS = 5;

const words = (t) => new Set(String(t).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 2));

/** The `n` lines that share most words with `text` (by overlap of word sets); on a tie the line that comes first in the rule. */
export function nearest(lines, text, n) {
  if (!text) return lines.slice(0, n);
  const w = words(text);
  const scored = lines.map((line, i) => {
    const v = words(line);
    let hit = 0;
    for (const x of v) if (w.has(x)) hit++;
    return { line, i, score: hit / (v.size + w.size - hit || 1) };
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.slice(0, n).map((x) => x.line);
}

// a line that names its channel ("title @ channel") is shown as the model sees a card: the title, and the channel after it
const quote = (line) => {
  const { title, channel } = splitLine(line);
  return `“${title.replace(/\s+/g, ' ').trim().slice(0, 140)}”${channel ? ` (${channel.replace(/\s+/g, ' ').slice(0, 60)})` : ''}`;
};

/**
 * The question with examples BEFORE it: what counts, what does not, then the question. Without enough examples (none of one side) or with `shots` 0 it is
 * the question itself. [choice, measured] Examples first and the question last separated the rule author's own lines clearly better for Kev-0.6B than the
 * examples after the question did (research/kev-accuracy-smoke.md: the engine got 25 of the 228 lines wrong against 56, the model alone separated them with
 * an AUC of 0.82 against 0.75), and two examples of each side were better than three or five.
 * @param {string} question
 * @param {{examples?: string[], spared?: string[]}} rule
 * @param {{shots?: number, text?: string, leaveOut?: string|null}} [opts] shots: how many of each side (0 = none); text: what is being asked about
 */
export function withExamples(question, rule, { shots = 0, text = '', leaveOut = null } = {}) {
  const n = Math.min(MAX_SHOTS, Math.max(0, Math.floor(Number(shots)) || 0));
  if (!n) return question;
  const keep = (t) => t !== leaveOut;
  const yes = nearest((rule.examples || []).filter(keep), text, n);
  const no = nearest((rule.spared || []).filter(keep), text, n);
  if (!yes.length || !no.length) return question;
  return `Examples that count (yes): ${yes.map(quote).join('; ')}\nExamples that do not count (no): ${no.map(quote).join('; ')}\nQuestion: ${question}`;
}
