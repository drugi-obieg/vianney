// The settings page never shows a vulgar word in full. The examples of the rules are real sentences, because the word lists have
// to catch what people really write; the page masks the vulgar part of each word when it shows them: "fuck" becomes "f***",
// "fucking" becomes "f***ing", "bullshit" becomes "bulls***". The first letter stays, the other letters of the stem become stars.
//
// STEMS is what gets masked. Mild words (damn, hell, crap) are not on it. tests/censor.test.js keeps the list in step with the
// word lists: every vulgar entry of coarse_words must be covered, and no shown example may contain a stem in full.

export const STEMS = [
  'motherfuck', 'fuck', 'bullshit', 'shit', 'cunt', 'bitch', 'bastard', 'asshole', 'arsehole', 'dumbass', 'jackass', 'dickhead',
  'whore', 'slut', 'twat', 'wank', 'bollock', 'piss', 'douche', 'pussy',
];

const STEM_RE = new RegExp(`\\b(\\w*?)(${[...STEMS].sort((a, b) => b.length - a.length).join('|')})(\\w*)`, 'gi');

/** The text with the stem of every vulgar word masked. Text without such a word comes back unchanged. */
export function censor(text) {
  return String(text).replace(STEM_RE, (_, pre, stem, post) => pre + stem[0] + '*'.repeat(stem.length - 1) + post);
}

/** True when the text still holds a stem in full (a word that was not masked). */
export function hasVulgar(text) {
  return new RegExp(STEMS.join('|'), 'i').test(String(text));
}
