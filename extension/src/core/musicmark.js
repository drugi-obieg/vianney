// Music, as YouTube marks it itself. The owner (2026-11-26): "make an option to ban music videos, so anything that has a 'song' mark behind it is usually not a good idea to
// watch - YT has a special flag for these 'music creators'". YouTube draws two marks, and both are read from the card as it is drawn, so no list of channels or titles is needed:
//   1. a note in front of the length on the thumbnail: every video of the Music category has one, no other kind of video does;
//   2. the "official artist channel" badge beside the name of a channel that an artist runs (also on live streams, which have no length).
// [measured 2026-11-26, signed out, English interface: search results for an artist, for chant, for cooking and for lofi radio, and the recommendations of two music videos:
// 47 duration badges with the note, all music (official videos, chant, soundtracks, a metal track); none of the cooking, pranks or horror videos had one; a Mix or a playlist
// has an icon too, but with no length ("Mix", "51 videos"), so it is not matched.] Pure, so that it can be tested; content/discover.js reads the page.

/** The first part of the path of the badge's icon (the shape of the artist badge), as YouTube draws it now: a fallback for the label, which is translated. */
export const ARTIST_ICON = 'M9.03 2.242 8.272 3H7.2A4.2 4.2 0 003';

const TIME = /^\s*(?:\d+:)?\d{1,2}:\d\d\s*$/;

/**
 * @param {{badges?: {text: string, hasIcon: boolean}[], labels?: string[], paths?: string[]}} signals what was read from one card:
 *   badges: the thumbnail badges (the text, and whether an icon stands in front of it); labels: the accessible names of its small badge icons; paths: the shapes of those icons
 */
export function isMusic({ badges = [], labels = [], paths = [] } = {}) {
  if (badges.some((b) => b && b.hasIcon && TIME.test(String(b.text || '')))) return true;       // a note in front of a length
  if (labels.some((l) => String(l).trim().toLowerCase() === 'official artist channel')) return true;
  return paths.some((d) => String(d).startsWith(ARTIST_ICON));
}
