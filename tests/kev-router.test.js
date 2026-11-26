import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askLayered } from '../extension/src/core/layered.js';
import { BACKENDS, backendSetting, buildLayers, statusFor, answerFor, fromExtensionPage } from '../extension/src/ai/ai-router.js';
import { DEFAULT_SETTINGS } from '../extension/src/shared/config.js';
import { SECTION_KEYS, resetKeys } from '../extension/src/shared/reset.js';

const BASE = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/';
const ID = 'abcdefghijklmnopabcdefghijklmnop';

test('who may control the local model: pages of the extension, never a content script on a web page', () => {
  assert.equal(fromExtensionPage({ id: ID, origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop', url: BASE + 'src/options/options.html' }, BASE, ID), true, 'the settings page');
  assert.equal(fromExtensionPage({ id: ID, origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop', url: BASE + 'src/ai/kev-offscreen.html' }, BASE, ID), true, 'the offscreen document');
  assert.equal(fromExtensionPage({ id: ID, url: BASE + 'src/background/service-worker.js' }, BASE, ID), true, 'the service worker, if it only reports a url');
  assert.equal(fromExtensionPage({ id: ID, origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop' }, BASE, ID), true, 'or only an origin');
  // a content script carries the extension's id too, but the origin and the url of the web page it runs in
  assert.equal(fromExtensionPage({ id: ID, origin: 'https://www.youtube.com', url: 'https://www.youtube.com/watch?v=x', tab: { id: 1 } }, BASE, ID), false, 'a content script on YouTube');
  assert.equal(fromExtensionPage({ id: ID, url: 'https://www.youtube.com/' }, BASE, ID), false);
  assert.equal(fromExtensionPage({ id: ID, origin: 'https://evil.example', url: BASE + 'src/options/options.html' }, BASE, ID), false, 'an origin that is not the extension\'s decides, whatever the url says');
  assert.equal(fromExtensionPage({ id: 'someoneelse', origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop' }, BASE, ID), false, 'another extension');
  assert.equal(fromExtensionPage({ id: ID }, BASE, ID), false, 'nothing to go by');
  assert.equal(fromExtensionPage(undefined, BASE, ID), false);
  assert.equal(fromExtensionPage({ id: ID, origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop', url: 'chrome-extension://otherotherotherotherotherother/x.html' }, BASE, ID), false, 'a page of another extension');
});

test('the setting: automatic, Kev only, or Chrome\'s model only; anything else is automatic', () => {
  assert.deepEqual(BACKENDS, ['auto', 'kev', 'prompt']);
  assert.equal(DEFAULT_SETTINGS.ai.backend, 'auto');
  assert.equal(backendSetting({ ai: { backend: 'kev' } }), 'kev');
  assert.equal(backendSetting({ ai: { backend: 'prompt' } }), 'prompt');
  assert.equal(backendSetting({ ai: { backend: 'gpt' } }), 'auto');
  assert.equal(backendSetting({}), 'auto');
  assert.equal(backendSetting(undefined), 'auto');
  // "Reset to defaults" of the On-device AI pane puts the choice back, and nothing else is touched
  assert.deepEqual(SECTION_KEYS.ai, ['ai']);
  assert.equal(resetKeys({ ai: { enabled: false, backend: 'kev' }, enabled: false }, SECTION_KEYS.ai).ai.backend, 'auto');
});

const answer = (p, error) => async () => (p === undefined ? { p: null, error } : { p });
const layers = (backend, kevReady, kevAsk, promptAvailable, promptAsk) => buildLayers({ backend, kev: { ready: kevReady, ask: kevAsk }, prompt: { available: promptAvailable, ask: promptAsk } });

test('automatic: Kev first, Chrome\'s model second; each setting leaves out the other', () => {
  const a = layers('auto', true, answer(0.5), true, answer(1));
  assert.deepEqual(a.map((l) => [l.name, l.available]), [['kev', true], ['prompt', true]]);
  assert.deepEqual(layers('kev', true, answer(0.5), true, answer(1)).map((l) => [l.name, l.available]), [['kev', true], ['prompt', false]]);
  assert.deepEqual(layers('prompt', true, answer(0.5), true, answer(1)).map((l) => [l.name, l.available]), [['kev', false], ['prompt', true]]);
  assert.deepEqual(layers('auto', false, answer(0.5), true, answer(1)).map((l) => [l.name, l.available]), [['kev', false], ['prompt', true]], 'Kev not downloaded: Chrome\'s model alone, as before');
  assert.deepEqual(layers('auto', true, answer(0.5), false, answer(1)).map((l) => [l.name, l.available]), [['kev', true], ['prompt', false]]);
});

test('through askLayered: a sure Kev answers alone, an unsure one is looked at again by Chrome\'s model', async () => {
  let promptCalls = 0;
  const prompt = async () => { promptCalls++; return { p: 1 }; };
  const sure = await askLayered(layers('auto', true, answer(0.9), true, prompt));
  assert.deepEqual([sure.p, sure.via, promptCalls], [0.9, 'kev', 0]);
  const unsure = await askLayered(layers('auto', true, answer(0.5), true, prompt));
  assert.deepEqual([unsure.p, unsure.via, promptCalls], [0.75, 'kev+prompt', 1]);
  const broken = await askLayered(layers('auto', true, answer(undefined, 'timeout'), true, prompt));
  assert.deepEqual([broken.p, broken.via], [1, 'prompt'], 'Kev failed: Chrome\'s model answers');
  const none = await askLayered(layers('auto', false, answer(0.5), false, prompt));
  assert.deepEqual([none.p, none.error], [null, 'unavailable']);
  assert.deepEqual(answerFor(none), { p: null, error: 'unavailable', steps: [] });
  assert.deepEqual(answerFor(unsure), { p: 0.75, via: 'kev+prompt', steps: unsure.steps });
});

test('what a tab is told: any model that can answer makes the answer "available", and the key changes with the set of models', () => {
  const settings = { ai: { enabled: true, backend: 'auto' } };
  const ready = { ready: true, state: 'ready', device: 'webgpu', set: 'q4f16' };
  const none = { ready: false, state: 'not-downloaded' };
  const both = statusFor({ settings, kev: ready, promptAvailability: 'available' });
  assert.equal(both.availability, 'available');
  assert.equal(both.key, 'kev:1,prompt:1');
  assert.deepEqual(both.layers.map((l) => [l.name, l.available]), [['kev', true], ['prompt', true]]);
  assert.equal(both.layers[0].device, 'webgpu');
  const onlyKev = statusFor({ settings, kev: ready, promptAvailability: 'downloadable' });
  assert.equal(onlyKev.availability, 'available', 'Kev alone is enough');
  assert.equal(onlyKev.key, 'kev:1,prompt:0');
  const onlyChrome = statusFor({ settings, kev: none, promptAvailability: 'available' });
  assert.equal(onlyChrome.availability, 'available');
  assert.equal(onlyChrome.key, 'kev:0,prompt:1');
  const nothing = statusFor({ settings, kev: none, promptAvailability: 'downloadable' });
  assert.equal(nothing.availability, 'downloadable', 'what Chrome says is passed on, as before');
  assert.equal(nothing.key, 'kev:0,prompt:0');
  assert.equal(statusFor({ settings, kev: none, promptAvailability: 'unsupported' }).availability, 'unsupported');
  assert.notEqual(both.key, onlyKev.key);
});

test('the local model is "loading" while it loads or downloads, so that tabs ask again soon', () => {
  const settings = {};
  assert.equal(statusFor({ settings, kev: { ready: false, state: 'downloading' }, promptAvailability: 'unavailable' }).loading, true);
  assert.equal(statusFor({ settings, kev: { ready: true, state: 'loading' }, promptAvailability: 'unavailable' }).loading, true);
  assert.equal(statusFor({ settings, kev: { ready: true, state: 'ready' }, promptAvailability: 'unavailable' }).loading, false);
  assert.equal(statusFor({ settings, kev: { ready: false, state: 'not-downloaded' }, promptAvailability: 'unavailable' }).loading, false);
});

test('"Kev only" and "Chrome\'s model only" ignore the other model, also in the status', () => {
  const ready = { ready: true, state: 'ready' };
  const kevOnly = statusFor({ settings: { ai: { backend: 'kev' } }, kev: ready, promptAvailability: 'available' });
  assert.equal(kevOnly.key, 'kev:1,prompt:0');
  assert.equal(kevOnly.layers[1].state, 'off');
  const chromeOnly = statusFor({ settings: { ai: { backend: 'prompt' } }, kev: ready, promptAvailability: 'available' });
  assert.equal(chromeOnly.key, 'kev:0,prompt:1');
  assert.equal(chromeOnly.layers[0].state, 'off');
  const chromeOnlyDown = statusFor({ settings: { ai: { backend: 'prompt' } }, kev: ready, promptAvailability: 'downloadable' });
  assert.equal(chromeOnlyDown.availability, 'downloadable');
  const kevOnlyNot = statusFor({ settings: { ai: { backend: 'kev' } }, kev: { ready: false, state: 'not-downloaded' }, promptAvailability: 'available' });
  assert.equal(kevOnlyNot.availability, 'unavailable', 'Kev only, and Kev is not there: nothing answers');
});
