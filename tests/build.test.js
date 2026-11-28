import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, checkBuild, targetFileText, transformManifest, TARGETS, GECKO_ID, FIREFOX_MIN, SAFARI_MIN } from '../tools/build.mjs';

// The extension for Firefox and for Safari is made from the one in extension/: the manifest differs (and one small file), the code does not.
const root = new URL('../', import.meta.url);
const chrome = JSON.parse(readFileSync(new URL('extension/manifest.json', root), 'utf8'));
const targetJs = readFileSync(new URL('extension/src/shared/target.js', root), 'utf8');

test('the manifest that is committed is the one for Chrome, and making the others does not change it', () => {
  const before = JSON.stringify(chrome);
  for (const t of TARGETS) transformManifest(chrome, t);
  assert.equal(JSON.stringify(chrome), before);
  assert.ok(chrome.background.service_worker && chrome.key && chrome.permissions.includes('offscreen'));
  assert.match(targetJs, /TARGET = Object\.freeze\(\{ name: 'chrome', kev: true, nano: true \}\)/);
  assert.throws(() => transformManifest(chrome, 'opera'), /unknown target/);
});

test('Firefox: an event page instead of a service worker, no key or permission that only Chrome knows, an ID and the declaration that AMO asks for', () => {
  const m = transformManifest(chrome, 'firefox');
  assert.deepEqual(m.background, { scripts: ['src/background/service-worker.js'], type: 'module' });
  for (const k of ['key', 'minimum_chrome_version', 'externally_connectable']) assert.equal(k in m, false, k);
  assert.deepEqual(m.permissions, ['storage', 'unlimitedStorage']);
  assert.deepEqual(m.optional_host_permissions, chrome.optional_host_permissions, 'the local model is downloaded here too');
  assert.equal(m.browser_specific_settings.gecko.id, GECKO_ID);
  assert.match(GECKO_ID, /^[a-zA-Z0-9-._]*@[a-zA-Z0-9-._]+$/);
  assert.deepEqual(m.browser_specific_settings.gecko.data_collection_permissions, { required: ['none'] }, 'Vianney collects nothing');
  assert.equal(m.browser_specific_settings.gecko.strict_min_version, FIREFOX_MIN);
  assert.ok(m.browser_specific_settings.gecko_android.strict_min_version >= '142', 'on Android the declaration is known from 142');
  assert.equal(m.content_security_policy.extension_pages, chrome.content_security_policy.extension_pages, 'WebAssembly still compiles');
  assert.deepEqual(m.content_scripts, chrome.content_scripts, 'the same pages, the same scripts');
  assert.equal(m.web_accessible_resources.length, 1, 'the settings page is not open to a website: its address is not known beforehand here');
  assert.equal(m.version, chrome.version);
});

test('Safari: also not persistent, no local model, and the phone\'s YouTube as well as the desktop\'s', () => {
  const m = transformManifest(chrome, 'safari');
  assert.deepEqual(m.background, { scripts: ['src/background/service-worker.js'], type: 'module', persistent: false });
  assert.deepEqual(m.browser_specific_settings, { safari: { strict_min_version: SAFARI_MIN } });
  assert.ok(parseInt(SAFARI_MIN, 10) >= 18, 'world: "MAIN" content scripts are in Safari 18');
  assert.deepEqual(m.permissions, ['storage'], 'no offscreen, no unlimitedStorage: nothing is stored that is large');
  assert.equal('optional_host_permissions' in m, false, 'nothing to download');
  assert.equal(m.content_security_policy.extension_pages, "script-src 'self';", 'no WebAssembly to compile');
  for (const c of m.content_scripts) assert.deepEqual(c.matches, ['https://www.youtube.com/*', 'https://m.youtube.com/*']);
  for (const r of m.web_accessible_resources) assert.deepEqual(r.matches, ['https://www.youtube.com/*', 'https://m.youtube.com/*'], 'the scripts of the page must be reachable from it');
  assert.deepEqual(m.content_scripts.map((c) => c.world), chrome.content_scripts.map((c) => c.world), 'the world of each script is kept');
  assert.equal(transformManifest(JSON.parse(JSON.stringify({ ...chrome, content_scripts: m.content_scripts })), 'safari').content_scripts[0].matches.filter((x) => x.includes('m.youtube')).length, 1, 'not added twice');
});

test('the line of target.js is the only thing that differs, and only in the builds that are not for Chrome', () => {
  for (const t of TARGETS) {
    const text = targetFileText(targetJs, t);
    const a = targetJs.split('\n'); const b = text.split('\n');
    assert.equal(a.length, b.length);
    assert.equal(a.filter((l, i) => l !== b[i]).length, 1, t);
    assert.match(text, new RegExp(`name: '${t}'`));
  }
  assert.match(targetFileText(targetJs, 'safari'), /kev: false, nano: false/);
  assert.match(targetFileText(targetJs, 'firefox'), /kev: true, nano: false/);
  assert.throws(() => targetFileText('export const X = 1;', 'safari'), /no TARGET line/);
});

for (const target of TARGETS) {
  test(`${target}: the build holds every file that its manifest names, and passes its own check`, () => {
    const out = mkdtempSync(join(tmpdir(), `vianney-${target}-`));
    try {
      const { manifest } = build(target, { out, zipFile: false });
      assert.equal(checkBuild(out, target), true);
      const has = (p) => existsSync(join(out, p));
      for (const s of manifest.background.scripts) assert.ok(has(s), s);
      for (const p of [manifest.options_page, manifest.action.default_popup, ...Object.values(manifest.icons)]) assert.ok(has(p), p);
      for (const c of manifest.content_scripts) for (const f of [...(c.js || []), ...(c.css || [])]) assert.ok(has(f), f);
      // every pattern that makes files reachable matches something (a glob is a directory and an extension)
      const all = (function walk(d) { return readdirSync(join(out, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)])); })('.');
      for (const r of manifest.web_accessible_resources) for (const g of r.resources) {
        const re = new RegExp('^' + g.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
        assert.ok(all.some((f) => re.test(f.replace(/^\.\//, ''))), `${g} matches a file`);
      }
      assert.equal(readFileSync(join(out, 'src/shared/target.js'), 'utf8').includes(`name: '${target}'`), true);
      assert.deepEqual(JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8')), manifest);
      // what the source has that the build must keep: the rules and the word lists
      assert.ok(has('rules/vianney.en.rules') && has('lexicon/coarse_words.txt'));
      assert.equal(has('vendor'), target === 'firefox', 'only a build that has the local model carries its runtime');
      if (target === 'safari') assert.ok(statSync(join(out, 'manifest.json')).size > 0 && all.every((f) => !/vendor/.test(f)));
      // nothing in the build imports from vendor/ statically (it is loaded at run time, when the model is): a build without it must still start
      for (const f of all.filter((f) => f.endsWith('.js') && !f.includes('vendor'))) {
        assert.ok(!/^\s*import[^'"]*from\s*['"][^'"]*vendor/m.test(readFileSync(join(out, f), 'utf8')), `${f} imports vendor/ statically`);
      }
    } finally { rmSync(out, { recursive: true, force: true }); }
  });
}

test('the check refuses what each browser would refuse', () => {
  const good = transformManifest(chrome, 'firefox');
  const bad = (change, target = 'firefox', base = good) => () => checkBuild('.', target, change(JSON.parse(JSON.stringify(base))));
  assert.throws(bad((m) => { m.background = { service_worker: 'x.js', scripts: ['x.js'], type: 'module' }; return m; }), /service worker/);
  assert.throws(bad((m) => { m.key = 'abc'; return m; }), /only Chrome reads/);
  assert.throws(bad((m) => { m.permissions.push('offscreen'); return m; }), /offscreen/);
  assert.throws(bad((m) => { delete m.browser_specific_settings.gecko.id; return m; }), /ID of the form/);
  assert.throws(bad((m) => { m.browser_specific_settings.gecko.data_collection_permissions = { required: ['browsingActivity'] }; return m; }), /data_collection_permissions/);
  assert.throws(bad((m) => { m.web_accessible_resources.push({ resources: ['src/options/options.html'], matches: ['https://vianney.cc/*'] }); return m; }), /settings page is open/);
  const safari = transformManifest(chrome, 'safari');
  assert.throws(bad((m) => { m.background.persistent = true; return m; }, 'safari', safari), /not persistent/);
  assert.throws(bad((m) => { delete m.browser_specific_settings.safari; return m; }, 'safari', safari), /least version of Safari/);
});

test('the signing script is valid shell and will not start without the keys; the keys are never in a file of the repository', () => {
  const sh = new URL('tools/sign-firefox.sh', root).pathname;
  execFileSync('bash', ['-n', sh]);
  assert.ok(statSync(sh).mode & 0o100, 'executable');
  assert.throws(() => execFileSync('bash', [sh], { env: { PATH: process.env.PATH }, stdio: 'pipe' }), (e) => /WEB_EXT_API_KEY/.test(String(e.stderr)));
  const text = readFileSync(sh, 'utf8');
  assert.match(text, /--channel unlisted/);
  assert.ok(!/(WEB_EXT_API_(KEY|SECRET))=\S/.test(text), 'no key written into the script');
});
