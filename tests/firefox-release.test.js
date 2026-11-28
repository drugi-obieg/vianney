import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { firefoxEntry, release, signedFiles, updatesJson, xpiName } from '../tools/firefox-release.mjs';
import { GECKO_ID, UPDATE_URL, SITE, FIREFOX_MIN, transformManifest } from '../tools/build.mjs';

// A Firefox add-on that is not in Mozilla's store is signed by Mozilla and then served from the site; it updates itself from a list on the site (update_url).
// Nothing here signs anything (that needs the account's keys): these are the steps after, on a file that stands in for the signed one.
const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const chrome = JSON.parse(read('extension/manifest.json'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

function site(version = '0.4.0') {
  const base = mkdtempSync(join(tmpdir(), 'vianney-ffrel-'));
  mkdirSync(join(base, 'extension'), { recursive: true });
  mkdirSync(join(base, 'downloads'));
  mkdirSync(join(base, '_data'));
  writeFileSync(join(base, 'extension/manifest.json'), JSON.stringify({ version }));
  for (const f of ['_data/release.json', 'downloads/latest.json']) writeFileSync(join(base, f), JSON.stringify({ version, file: `vianney-content-blocker-${version}.zip` }, null, 2) + '\n');
  return base;
}

test('the add-on updates itself from a list on the site, and the manifest that Mozilla signs says so', () => {
  const gecko = transformManifest(chrome, 'firefox').browser_specific_settings.gecko;
  assert.equal(gecko.update_url, UPDATE_URL);
  assert.equal(UPDATE_URL, `${SITE}/downloads/firefox-updates.json`);
  const domain = read('_config.yml').match(/^url: "https:\/\/([^"]+)"/m)[1];
  assert.equal(new URL(UPDATE_URL).hostname, domain, 'the site that serves the add-on');
  assert.ok(UPDATE_URL.startsWith('https://'));
  assert.equal('update_url' in (transformManifest(chrome, 'safari').browser_specific_settings.safari || {}), false);
});

test('the list that Firefox reads names every signed version with its hash, and the newest is the one the install page shows', () => {
  const base = site();
  try {
    const a = join(base, 'a.xpi'); writeFileSync(a, 'signed one');
    release(a, { base, version: '0.9.0' });
    const b = join(base, 'b.xpi'); writeFileSync(b, 'signed two, longer');
    const { entry, updates } = release(b, { base, version: '0.10.0' });
    assert.equal(entry.version, '0.10.0', 'numbers, not text: 0.10.0 is newer than 0.9.0');
    assert.equal(entry.file, xpiName('0.10.0'));
    assert.equal(entry.sha256, sha('signed two, longer'));
    assert.deepEqual(signedFiles(join(base, 'downloads')).map((e) => e.version), ['0.9.0', '0.10.0']);
    const list = updates.addons[GECKO_ID].updates;
    assert.deepEqual(list.map((u) => u.version), ['0.9.0', '0.10.0']);
    assert.equal(list[1].update_link, `${SITE}/downloads/${xpiName('0.10.0')}`);
    assert.equal(list[1].update_hash, `sha256:${sha('signed two, longer')}`);
    assert.equal(list[1].applications.gecko.strict_min_version, FIREFOX_MIN);
    assert.deepEqual(JSON.parse(readFileSync(join(base, 'downloads/firefox-updates.json'), 'utf8')), updates, 'written as it is returned');
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('signing puts the file on the site and tells the install page, in both copies of the release data, and keeps what was there', () => {
  const base = site('0.4.0');
  try {
    const signed = join(base, 'signed.xpi'); writeFileSync(signed, 'the signed add-on');
    release(signed, { base });
    assert.equal(readFileSync(join(base, 'downloads', xpiName('0.4.0')), 'utf8'), 'the signed add-on');
    for (const f of ['_data/release.json', 'downloads/latest.json']) {
      const data = JSON.parse(readFileSync(join(base, f), 'utf8'));
      assert.equal(data.file, 'vianney-content-blocker-0.4.0.zip', `${f}: the Chrome download is untouched`);
      assert.equal(data.firefox.file, xpiName('0.4.0'));
      assert.equal(data.firefox.sha256, sha('the signed add-on'));
      assert.match(data.firefox.date, /^\d{4}-\d{2}-\d{2}$/);
    }
    assert.equal(readFileSync(join(base, '_data/release.json'), 'utf8'), readFileSync(join(base, 'downloads/latest.json'), 'utf8'), 'the two copies are the same');
    assert.equal(firefoxEntry(join(base, 'no-such-folder')), null);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('a release of the Chrome build keeps offering the signed Firefox file', () => {
  const text = read('tools/release.mjs');
  assert.match(text, /import \{ firefoxEntry \} from '\.\/firefox-release\.mjs'/);
  assert.match(text, /const firefox = firefoxEntry\(resolve\(root, 'downloads'\)\);\s+if \(firefox\) release\.firefox = firefox;/);
  assert.ok(text.indexOf('release.firefox = firefox') < text.indexOf("writeFileSync(resolve(root, '_data/release.json')"), 'before the file is written');
});

test('the site serves the add-on as an add-on, and the install page offers it only when there is one', () => {
  const headers = read('_headers');
  assert.match(headers, /\/downloads\/\*\.xpi\n  Content-Type: application\/x-xpinstall/);
  assert.match(headers, /\/downloads\/firefox-updates\.json\n  Content-Type: application\/json/);
  assert.match(read('_config.yml'), /\ninclude:\n  - _headers\n/, 'Jekyll leaves out files that start with an underscore unless told');
  const install = read('install.html');
  const block = install.slice(install.indexOf('{%- if site.data.release.firefox %}'), install.indexOf('{%- endif %}', install.indexOf('{%- if site.data.release.firefox %}')));
  assert.ok(block.includes('Add to Firefox') && block.includes("site.data.release.firefox.file"));
  assert.equal((install.match(/Firefox/g) || []).length, (block.match(/Firefox/g) || []).length, 'Firefox is named only inside that block');
});

test('the signing script ends by putting the file on the site, and says what to commit', () => {
  const sh = read('tools/sign-firefox.sh');
  assert.match(sh, /node tools\/firefox-release\.mjs "\$SIGNED"/);
  assert.match(sh, /commit downloads\/ and _data\//);
  assert.ok(sh.indexOf('web-ext@10 sign') < sh.indexOf('firefox-release.mjs'), 'after the signing');
});
