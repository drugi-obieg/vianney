// The extension for Firefox and for Safari, made from the one source in extension/ (Chrome, Edge and Brave use extension/ as it is: tools/pack.mjs).
//
//   node tools/build.mjs firefox | safari | all        -> dist/<target>/ (a folder) and dist/vianney-content-blocker-<version>-<target>.zip
//
// The code is the same for every browser: where a browser lacks something, the code asks whether the feature is there (chrome.offscreen: kev-backend.js).
// What cannot be asked, the manifest, differs, and so does one small file (src/shared/target.js: what this build offers). Those are the only changes, made here:
//   Firefox  the background is an event page (`scripts`; Firefox has no service workers), the Chrome-only keys and permission go, and the add-on gets its ID,
//            the version of Firefox that has every key used here, and the declaration that AMO asks of every new add-on: it collects no data.
//   Safari   the same, and: `persistent: false` (iOS ends a page that stays), the local model is off (shared/target.js) and so are the files and permissions that
//            only it needs, the site m.youtube.com is matched as well (an iPhone opens that one) and Safari 18 is the least, because of `world: "MAIN"`.
// Each is checked after it is made (checkBuild), and tests/build.test.js runs the check on both.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
export const TARGETS = ['firefox', 'safari'];

// The permanent name of the add-on at Mozilla: it cannot change once a signed version is out. Its form is `name@domain`; the domain is the site's.
export const GECKO_ID = 'vianney@vianney.cc';
// Where an add-on that is not in Mozilla's store looks for newer versions: this file lists them (tools/firefox-release.mjs writes it). It has to be in the manifest that
// Mozilla signs, so it is here from the first version; it names the site, and tests/build.test.js checks that it does.
export const SITE = 'https://vianney.cc';
export const UPDATE_URL = `${SITE}/downloads/firefox-updates.json`;
export const FIREFOX_MIN = '140.0';   // data_collection_permissions (the declaration that AMO asks for) is known from this version; world: "MAIN" needs 128
export const FIREFOX_ANDROID_MIN = '142.0';   // ... and on Android from this one: the linter says so if the two differ
export const SAFARI_MIN = '18.0';     // content scripts with world: "MAIN"
const PHONE_SITE = 'https://m.youtube.com/*';
const OPTIONS_PAGE = 'src/options/options.html';

/** The target.js of a build: the committed file with its one line changed. */
export const TARGET_LINE = {
  firefox: "export const TARGET = Object.freeze({ name: 'firefox', kev: true, nano: false });",
  safari: "export const TARGET = Object.freeze({ name: 'safari', kev: false, nano: false });",
};

export function targetFileText(chromeText, target) {
  const line = /^export const TARGET = .*$/m;
  if (!line.test(chromeText)) throw new Error('src/shared/target.js has no TARGET line');
  return chromeText.replace(line, TARGET_LINE[target]);
}

/** The manifest of a target. Pure: the Chrome manifest goes in, a new object comes out. */
export function transformManifest(chrome, target) {
  if (!TARGETS.includes(target)) throw new Error(`unknown target ${target}`);
  const m = JSON.parse(JSON.stringify(chrome));
  const worker = m.background && m.background.service_worker;
  if (!worker) throw new Error('the Chrome manifest has no background service worker');

  delete m.key;                           // the ID of an extension in Chrome; neither browser reads it
  delete m.minimum_chrome_version;
  delete m.externally_connectable;        // the website talks to the Chrome extension only (the pages of Chrome that it opens do not exist elsewhere)
  m.permissions = (m.permissions || []).filter((p) => p !== 'offscreen');   // there is no such thing here: the model lives in the background page
  // the settings page is open to the website in Chrome, by the ID that the key gives; here the address of an extension is not known beforehand
  m.web_accessible_resources = (m.web_accessible_resources || []).filter((r) => !r.resources.includes(OPTIONS_PAGE));
  m.background = { scripts: [worker], type: 'module' };

  if (target === 'firefox') {
    m.browser_specific_settings = {
      gecko: { id: GECKO_ID, update_url: UPDATE_URL, strict_min_version: FIREFOX_MIN, data_collection_permissions: { required: ['none'] } },
      gecko_android: { strict_min_version: FIREFOX_ANDROID_MIN },
    };
  }

  if (target === 'safari') {
    m.background.persistent = false;
    m.browser_specific_settings = { safari: { strict_min_version: SAFARI_MIN } };
    // no local model here: no files of it to keep, no host to ask for, no need to compile WebAssembly
    m.permissions = m.permissions.filter((p) => p !== 'unlimitedStorage');
    delete m.optional_host_permissions;
    m.content_security_policy = { extension_pages: "script-src 'self';" };
    const phone = (matches) => (matches.includes('https://www.youtube.com/*') && !matches.includes(PHONE_SITE) ? [...matches, PHONE_SITE] : matches);
    m.content_scripts = m.content_scripts.map((c) => ({ ...c, matches: phone(c.matches) }));
    m.web_accessible_resources = m.web_accessible_resources.map((r) => ({ ...r, matches: phone(r.matches) }));
  }
  return m;
}

/** What must be true of a build; throws with the first thing that is not. Used after a build, and by the tests. */
export function checkBuild(dir, target, manifest = JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf8'))) {
  const fail = (what) => { throw new Error(`${target}: ${what}`); };
  if (manifest.manifest_version !== 3) fail('not a Manifest V3');
  if (manifest.background.service_worker) fail('a service worker: neither browser starts one (an event page: background.scripts)');
  if (!manifest.background.scripts || manifest.background.type !== 'module') fail('the background must be module scripts');
  if ('key' in manifest || 'minimum_chrome_version' in manifest || 'externally_connectable' in manifest) fail('a key that only Chrome reads');
  if ((manifest.permissions || []).includes('offscreen')) fail('the offscreen permission does not exist here');
  if (manifest.web_accessible_resources.some((r) => r.resources.includes(OPTIONS_PAGE))) fail('the settings page is open to a website by an ID that this browser does not give');
  const bss = manifest.browser_specific_settings || {};
  if (target === 'firefox') {
    if (!/^[a-zA-Z0-9-._]*@[a-zA-Z0-9-._]+$/.test((bss.gecko || {}).id || '')) fail('the add-on needs an ID of the form name@domain');
    if (JSON.stringify(bss.gecko.data_collection_permissions) !== '{"required":["none"]}') fail('AMO asks for data_collection_permissions');
    if (!/^https:\/\/[^/]+\/.+\.json$/.test(bss.gecko.update_url || '')) fail('an add-on signed outside the store updates itself from an https address (update_url), which cannot be added after the first signing');
  }
  if (target === 'safari') {
    if (!bss.safari || !bss.safari.strict_min_version) fail('a least version of Safari');
    if (manifest.background.persistent !== false) fail('iOS needs a background that is not persistent');
  }
  return true;
}

function zip(dir, out) {
  rmSync(out, { force: true });
  execFileSync('zip', ['-r', '-q', '-X', out, '.'], { cwd: dir, stdio: 'inherit' });   // the contents, not the folder: manifest.json is at the root
}

/**
 * Make the build of one target.
 * @param {string} target
 * @param {{out?: string, zipFile?: boolean}} [o] out: the folder to make (default dist/<target>)
 */
export function build(target, { out = resolve(root, 'dist', target), zipFile = true } = {}) {
  const chrome = JSON.parse(readFileSync(resolve(root, 'extension/manifest.json'), 'utf8'));
  const manifest = transformManifest(chrome, target);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  // Safari builds without the files of the local model (about 10 MB of WebAssembly and scripts): nothing there asks for them
  const skip = (p) => p.endsWith('.DS_Store') || (target === 'safari' && /[\\/]extension[\\/]vendor([\\/]|$)/.test(p));
  cpSync(resolve(root, 'extension'), out, { recursive: true, filter: (p) => !skip(p) });
  writeFileSync(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(resolve(out, 'src/shared/target.js'), targetFileText(readFileSync(resolve(root, 'extension/src/shared/target.js'), 'utf8'), target));
  checkBuild(out, target, manifest);
  const file = resolve(root, 'dist', `vianney-content-blocker-${manifest.version}-${target}.zip`);
  if (zipFile) zip(out, file);
  return { dir: out, zip: zipFile ? file : null, manifest };
}

if (import.meta.main) {
  const arg = process.argv[2] || 'all';
  const which = arg === 'all' ? TARGETS : [arg];
  for (const t of which) {
    if (!TARGETS.includes(t)) { console.error(`usage: node tools/build.mjs ${TARGETS.join(' | ')} | all`); process.exit(1); }
    const r = build(t);
    console.log(`${t}: ${r.dir}  ${r.zip}`);
  }
}
