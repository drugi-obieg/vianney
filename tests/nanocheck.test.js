import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browserOf, checklist, reasonKind, flagsFor, openable, flagUrl, gib, reportText, PAGES, FLAGS, REQUIRE, DIAGNOSTIC_LINES } from '../extension/src/core/nanocheck.js';

const GiB = 1024 ** 3;
const brands = (...pairs) => pairs.map(([brand, version]) => ({ brand, version }));
const CHROME = (v) => brands(['Not.A/Brand', '24'], ['Chromium', String(v)], ['Google Chrome', String(v)]);
const CHROMIUM = (v) => brands(['Not.A/Brand', '24'], ['Chromium', String(v)]);
const step = (r, id) => r.steps.find((s) => s.id === id);

test('the browser is told from the brands the browser gives about itself', () => {
  assert.deepEqual(browserOf({ brands: CHROME(158) }), { name: 'Google Chrome', version: 158, google: true });
  assert.deepEqual(browserOf({ brands: CHROMIUM(158) }), { name: 'Chromium', version: 158, google: false });   // [live] what Linux Mint's Chromium reports
  assert.equal(browserOf({ brands: brands(['Chromium', '150'], ['Microsoft Edge', '150']) }).name, 'Microsoft Edge');
  assert.equal(browserOf({ brands: brands(['Chromium', '150'], ['Brave', '150']) }).name, 'Brave');
  assert.equal(browserOf({ ua: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0' }).name, 'Firefox');
  assert.equal(browserOf({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }).name, 'Safari');
  assert.deepEqual(browserOf({ ua: 'Mozilla/5.0 Chrome/150.0.0.0 Safari/537.36' }), { name: 'unknown', version: 150, google: false });
  assert.equal(browserOf({}).name, 'unknown');
});

test('the very machine this was written on: Chromium 158 with 44 GiB free says the model is unavailable, and the checklist says why', () => {
  const r = checklist({
    where: 'extension', brands: CHROMIUM(158), platform: 'Linux', hasApi: true, cores: 8, freeBytes: 44 * GiB,
    availability: { text: 'unavailable', image: 'unavailable', audio: 'unavailable' },
    reason: { text: { name: 'NotSupportedError', message: 'The feature flag gating model execution was disabled.' } },
  });
  assert.equal(r.verdict.tone, 'no');
  assert.match(r.verdict.title, /cannot run Chrome's model/);
  assert.equal(r.next, 'browser', 'the first thing to do is the browser, not the disk');
  assert.equal(step(r, 'browser').status, 'fail');
  assert.match(step(r, 'browser').detail, /The feature flag gating model execution was disabled/, 'Chrome\'s own words are shown');
  assert.ok(step(r, 'browser').links.some((l) => l.url === 'https://www.google.com/chrome/' && l.kind === 'web'));
  assert.equal(step(r, 'disk').status, 'ok', 'the disk is not the problem here, and the list says so');
  assert.equal(step(r, 'setting').status, 'info', 'the switch cannot exist in Chromium: nothing to ask of the user');
});

test('Chrome with too little disk: the download does not start, and the list says that this is why', () => {
  const r = checklist({ where: 'extension', brands: CHROME(158), platform: 'Linux', hasApi: true, freeBytes: 13 * GiB, cores: 8, availability: { text: 'downloadable' } });
  const disk = step(r, 'disk');
  assert.equal(disk.status, 'fail');
  assert.match(disk.title, /13\.0 GiB free: too little/);
  assert.match(disk.detail, /nothing downloads/);
  assert.equal(r.next, 'disk');
  assert.equal(r.verdict.tone, 'no');
});

test('Chrome with enough disk and the model not downloaded yet: the next thing is the download button', () => {
  const r = checklist({ where: 'extension', brands: CHROME(158), platform: 'Windows', hasApi: true, freeBytes: 60 * GiB, cores: 8, gpu: { vendor: 'nvidia', architecture: 'ampere' }, availability: { text: 'downloadable', image: 'downloadable', audio: 'unavailable' } });
  assert.equal(r.verdict.tone, 'todo');
  assert.equal(r.next, 'state');
  assert.equal(step(r, 'state').status, 'todo');
  assert.match(step(r, 'state').detail, /Audio: Unavailable/);
  assert.equal(step(r, 'hardware').status, 'unknown');
});

test('a model that is ready, and one that is downloading', () => {
  const base = { where: 'extension', brands: CHROME(158), hasApi: true, freeBytes: 60 * GiB, cores: 8 };
  assert.equal(checklist({ ...base, availability: { text: 'available' } }).verdict.tone, 'ok');
  assert.equal(step(checklist({ ...base, availability: { text: 'available' } }), 'setting').status, 'ok');
  assert.equal(checklist({ ...base, availability: { text: 'downloading' } }).verdict.tone, 'busy');
  assert.equal(checklist({ ...base, availability: { text: 'downloading' } }).next, null, 'nothing to do but wait');
});

test('Chrome\'s own reason decides the step it belongs to, also where nothing could be measured', () => {
  const base = { where: 'page', brands: CHROME(158), hasApi: true, availability: { text: 'unavailable' } };
  const disk = checklist({ ...base, reason: { text: { message: 'The device does not have enough space for downloading the on-device model.' } } });
  assert.equal(step(disk, 'disk').status, 'fail');
  assert.equal(disk.next, 'disk');
  const setting = checklist({ ...base, reason: { text: { message: 'On-device AI is disabled in Chrome settings.' } } });
  assert.equal(step(setting, 'setting').status, 'fail');
  assert.ok(step(setting, 'setting').links.some((l) => l.url === PAGES.aiSettings.url));
  assert.equal(checklist({ ...base, reason: { text: { message: 'The device is not eligible for running on-device model.' } } }).verdict.tone, 'no');
});

test('the words of Chrome\'s messages are sorted into causes', () => {
  assert.equal(reasonKind({ message: 'The feature flag gating model execution was disabled.' }), 'feature');
  assert.equal(reasonKind({ message: 'The device does not have enough space for downloading the on-device model.' }), 'disk');
  assert.equal(reasonKind({ message: 'The device is not eligible for running on-device model.' }), 'device');
  assert.equal(reasonKind({ message: 'On-device AI is disabled in Chrome settings' }), 'setting');
  assert.equal(reasonKind({ message: 'Model execution for this feature was not enabled.' }), 'not-enabled');
  assert.equal(reasonKind({ message: 'something else' }), 'other');
  assert.equal(reasonKind(null), null);
  assert.equal(reasonKind({ name: 'X' }), null);
});

test('the flags are those of the version: none to change in Chrome 154 and newer, the old names before', () => {
  assert.deepEqual(flagsFor(158).map((f) => f.id), ['prompt-api', 'prompt-api-multimodal-input']);
  assert.deepEqual(flagsFor(153).map((f) => f.id), ['prompt-api', 'prompt-api-multimodal-input', 'optimization-guide-on-device-model']);
  assert.deepEqual(flagsFor(140).map((f) => f.id), ['prompt-api-for-gemini-nano', 'prompt-api-for-gemini-nano-multimodal-input', 'optimization-guide-on-device-model']);
  assert.deepEqual(flagsFor(null), []);
  const now = checklist({ where: 'extension', brands: CHROME(158), hasApi: true, availability: { text: 'unavailable' } });
  assert.equal(step(now, 'flags').status, 'ok');
  assert.match(step(now, 'flags').title, /No flag has to be changed in Chrome 158/);
  const old = checklist({ where: 'extension', brands: CHROME(141), hasApi: true, availability: { text: 'unavailable' } });
  assert.equal(step(old, 'flags').status, 'info');
  assert.ok(step(old, 'flags').links.some((l) => l.url === 'chrome://flags/#optimization-guide-on-device-model' && l.note === 'Enabled BypassPerfRequirement'));
  assert.equal(checklist({ where: 'page', brands: [], ua: '' }).steps.find((s) => s.id === 'flags').status, 'info', 'an unknown version is not told that nothing is needed');
});

test('a web page of Chrome before 148 has no interface, and the list says that the extension has', () => {
  const r = checklist({ where: 'page', brands: CHROME(140), hasApi: false });
  assert.equal(step(r, 'api').status, 'warn');
  assert.match(step(r, 'api').detail, /from Chrome 148/);
  assert.equal(step(checklist({ where: 'extension', brands: CHROME(140), hasApi: false }), 'api').status, 'fail');
});

test('browsers without the model are told so, and told that Vianney works without it', () => {
  const ff = checklist({ where: 'page', brands: [], ua: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0', hasApi: false });
  assert.equal(step(ff, 'browser').status, 'fail');
  assert.match(step(ff, 'browser').detail, /Kev-0\.6B/);
  assert.equal(checklist({ where: 'page', brands: CHROME(150), platform: 'Android', mobile: true, hasApi: false }).steps[0].status, 'fail');
  assert.equal(step(checklist({ brands: CHROME(120), hasApi: true }), 'browser').status, 'fail', 'Chrome 120 is older than 138');
  assert.equal(step(checklist({ brands: brands(['Chromium', '158'], ['Microsoft Edge', '158']) }), 'browser').status, 'warn');
});

test('without a graphics chip the cores are counted; with one, Chrome\'s own page is named', () => {
  assert.equal(step(checklist({ brands: CHROME(158), cores: 2 }), 'hardware').status, 'fail');
  assert.equal(step(checklist({ brands: CHROME(158), cores: 8 }), 'hardware').status, 'warn');
  assert.match(step(checklist({ brands: CHROME(158), cores: 8, gpu: { vendor: 'amd' } }), 'hardware').detail, /GPU blocked/);
});

test('the pages that the guide links to are the ones the extension is willing to open for the website, and no others', () => {
  for (const p of Object.values(PAGES)) assert.equal(openable(p.url), true, p.url);
  for (const f of FLAGS) assert.equal(openable(flagUrl(f.id)), true, f.id);
  for (const bad of ['chrome://settings/passwords', 'chrome://flags/#some-other-flag', 'chrome://flags', 'chrome://crash', 'chrome://quit', 'javascript:alert(1)', 'https://example.com', 'chrome-extension://x/y.html', '', null, undefined, 'chrome://flags/#prompt-api;x']) {
    assert.equal(openable(bad), false, String(bad));
  }
  // every address in the steps can be opened
  const r = checklist({ where: 'extension', brands: CHROME(152), hasApi: true, availability: { text: 'unavailable' } });
  for (const s of r.steps) for (const l of s.links) if (l.kind === 'chrome') assert.equal(openable(l.url), true, l.url);
});

test('the lines to read on Chrome\'s page are those that the real page has (as seen on Chromium 158)', () => {
  const real = ['Enabled by feature flag', 'Enabled by enterprise policy', 'Enabled by user setting', 'Device performance class', 'Enough disk space to install', 'Enough disk space to retain'];
  for (const line of real) assert.ok(DIAGNOSTIC_LINES.some((d) => d.line === line), line);
  assert.ok(DIAGNOSTIC_LINES.every((d) => d.want && d.otherwise));
});

test('sizes and the text for a bug report', () => {
  assert.equal(gib(13 * GiB), '13.0 GiB');
  assert.equal(gib(19.6 * GiB), '19.6 GiB', 'just under the line is not shown as the line');
  assert.equal(gib(44 * GiB), '44 GiB');
  assert.equal(gib(REQUIRE.installFree), '20.0 GiB');
  const f = { where: 'extension', brands: CHROMIUM(158), platform: 'Linux', hasApi: true, availability: { text: 'unavailable' }, reason: { text: { message: 'The feature flag gating model execution was disabled.' } } };
  const t = reportText(f);
  assert.match(t, /^Vianney: Chrome's model, checked from the extension/);
  assert.match(t, /Browser: Chromium 158 on Linux/);
  assert.match(t, /\[FAIL\] Chromium 158, not Google Chrome/);
});

test('text, pictures and sound that fail for the same reason are one line', () => {
  const same = { message: 'The feature flag gating model execution was disabled.' };
  const r = checklist({ brands: CHROMIUM(158), hasApi: true, availability: { text: 'unavailable', image: 'unavailable', audio: 'unavailable' }, reason: { text: same, image: same, audio: same } });
  assert.equal(step(r, 'state').detail, 'Text, Images, Audio: Unavailable (“The feature flag gating model execution was disabled.”).');
  const differ = checklist({ brands: CHROME(158), hasApi: true, availability: { text: 'available', image: 'downloadable', audio: 'unavailable' }, reason: { audio: { message: 'No graphics chip.' } } });
  assert.equal(step(differ, 'state').detail, 'Text: Ready. Images: Not downloaded yet. Audio: Unavailable (“No graphics chip.”).');
});
