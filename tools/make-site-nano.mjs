// Writes what the page "Gemini Nano" of the website takes from the extension, so that the two cannot say different things:
//   assets/nano/nanocheck.js, assets/nano/nanoprobe.js   copies of extension/src/core/nanocheck.js and extension/src/shared/nanoprobe.js (the checks run in the page)
//   _data/nano.json                                      the flags, the lines of Chrome's diagnostics page and its pages, for the reference that needs no script
// tests/site.test.js checks that the files are what this writes. Run: node tools/make-site-nano.mjs
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { FLAGS, DIAGNOSTIC_LINES, PAGES, REQUIRE } from '../extension/src/core/nanocheck.js';

const root = new URL('../', import.meta.url);

/** The data for the Liquid templates: a range of versions in words, for each flag. */
export function nanoData() {
  const range = (f) => (f.from != null ? `Chrome ${f.from} and newer` : `Chrome ${REQUIRE.extensionChrome} to ${f.until}`);
  return {
    flags: FLAGS.map((f) => ({ id: f.id, name: f.name, value: f.value, why: f.why, range: range(f) })),
    lines: DIAGNOSTIC_LINES.map((l) => ({ line: l.line, want: l.want, otherwise: l.otherwise })),
    pages: Object.fromEntries(Object.entries(PAGES).map(([k, p]) => [k, p.url])),
    minChrome: REQUIRE.extensionChrome,
  };
}

export const COPIES = [
  ['extension/src/core/nanocheck.js', 'assets/nano/nanocheck.js'],
  ['extension/src/shared/nanoprobe.js', 'assets/nano/nanoprobe.js'],
];

if (import.meta.main) {
  mkdirSync(new URL('assets/nano/', root), { recursive: true });
  for (const [from, to] of COPIES) copyFileSync(new URL(from, root), new URL(to, root));
  writeFileSync(new URL('_data/nano.json', root), JSON.stringify(nanoData(), null, 2) + '\n');
  console.log(`assets/nano/ (${COPIES.length} files) and _data/nano.json (${FLAGS.length} flags, ${DIAGNOSTIC_LINES.length} lines)`);
}
