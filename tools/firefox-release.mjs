// What happens to the Firefox add-on once Mozilla has signed it (tools/sign-firefox.sh): the signed file goes to downloads/, Firefox is told about it in
// downloads/firefox-updates.json (the file that update_url in the manifest names: this is how an add-on that is not in the store updates itself), and the
// install page learns of it: _data/release.json and downloads/latest.json get a "firefox" entry, which the page shows only when it is there.
//
//   node tools/firefox-release.mjs dist/signed/<the file that web-ext sign wrote>.xpi
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GECKO_ID, FIREFOX_MIN, SITE } from './build.mjs';

const root = resolve(import.meta.dirname, '..');
const XPI = /^vianney-content-blocker-(\d+\.\d+\.\d+)-firefox\.xpi$/;

export const xpiName = (version) => `vianney-content-blocker-${version}-firefox.xpi`;
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const byVersion = (a, b) => { const x = a.split('.').map(Number); const y = b.split('.').map(Number); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };

/** Every signed file in a folder, the oldest version first. */
export function signedFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((f) => ({ f, m: XPI.exec(f) })).filter((x) => x.m).map(({ f, m }) => {
    const file = resolve(dir, f);
    return { version: m[1], file: f, bytes: statSync(file).size, kilobytes: Math.round(statSync(file).size / 1024), sha256: sha256(file) };
  }).sort((a, b) => byVersion(a.version, b.version));
}

/** The newest signed file, as the install page needs it; null when there is none. */
export function firefoxEntry(dir) {
  const all = signedFiles(dir);
  const last = all[all.length - 1];
  return last ? { ...last, date: new Date(statSync(resolve(dir, last.file)).mtime).toISOString().slice(0, 10) } : null;
}

/**
 * The file that Firefox reads to update the add-on: every signed version (Firefox takes the highest one above the installed version that it is compatible with).
 * The hash lets Firefox check the file it downloads; the link is https as well.
 */
export function updatesJson(entries) {
  return {
    addons: {
      [GECKO_ID]: {
        updates: entries.map((e) => ({ version: e.version, update_link: `${SITE}/downloads/${e.file}`, update_hash: `sha256:${e.sha256}`, applications: { gecko: { strict_min_version: FIREFOX_MIN } } })),
      },
    },
  };
}

/**
 * Put a signed file on the site (in `base`, the repository by default). Returns what was written.
 * @param {string} signed the .xpi that Mozilla signed
 * @param {{base?: string, version?: string}} [o]
 */
export function release(signed, { base = root, version } = {}) {
  const manifest = JSON.parse(readFileSync(resolve(base, 'extension/manifest.json'), 'utf8'));
  const ver = version || manifest.version;
  const downloads = resolve(base, 'downloads');
  copyFileSync(signed, resolve(downloads, xpiName(ver)));
  const updates = updatesJson(signedFiles(downloads));
  writeFileSync(resolve(downloads, 'firefox-updates.json'), JSON.stringify(updates, null, 2) + '\n');
  const entry = firefoxEntry(downloads);
  for (const path of [resolve(base, '_data/release.json'), resolve(downloads, 'latest.json')]) {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    data.firefox = entry;
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  }
  return { entry, updates };
}

if (import.meta.main) {
  const signed = process.argv[2];
  if (!signed || !existsSync(signed)) { console.error('usage: node tools/firefox-release.mjs <the signed .xpi>'); process.exit(1); }
  const { entry } = release(resolve(signed));
  console.log(`firefox ${entry.version}: ${entry.kilobytes} KB, sha256 ${entry.sha256}`);
}
