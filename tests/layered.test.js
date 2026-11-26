import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askLayered, isUnsure, UNSURE_LOW, UNSURE_HIGH } from '../extension/src/core/layered.js';

const layer = (name, answer, available = true) => ({ name, available, calls: 0, async ask() { this.calls++; if (answer instanceof Error) throw answer; return answer; } });

test('a first answer that is sure stands, and the second model is not asked', async () => {
  const kev = layer('kev', { p: 0.9 });
  const chrome = layer('chrome', { p: 0 });
  const r = await askLayered([kev, chrome]);
  assert.equal(r.p, 0.9);
  assert.equal(r.via, 'kev');
  assert.equal(chrome.calls, 0);
  assert.deepEqual(r.steps.map((s) => s.model), ['kev']);
  assert.equal((await askLayered([layer('kev', { p: 0.05 }), chrome])).p, 0.05, 'a sure no stands too');
});

test('a first answer that is not sure gets a second look, and the answer is the mean of the two', async () => {
  const chrome = layer('chrome', { p: 1 });
  const r = await askLayered([layer('kev', { p: 0.5 }), chrome]);
  assert.equal(r.p, 0.75);
  assert.equal(r.via, 'kev+chrome');
  assert.equal(chrome.calls, 1);
  assert.equal((await askLayered([layer('kev', { p: 0.4 }), layer('chrome', { p: 0 })])).p, 0.2);
});

test('the bounds of "not sure" are the choice in layered.js, and the caller may move them', async () => {
  assert.ok(UNSURE_LOW < 0.5 && UNSURE_HIGH > 0.5);
  assert.equal(isUnsure(UNSURE_LOW), false);
  assert.equal(isUnsure(UNSURE_HIGH), false);
  assert.equal(isUnsure(0.5), true);
  assert.equal(isUnsure(null), false);
  const chrome = layer('chrome', { p: 1 });
  assert.equal((await askLayered([layer('kev', { p: 0.8 }), chrome], { low: 0.5, high: 0.9 })).p, 0.9, 'with a wider band a 0.8 is looked at again');
});

test('a model that is not there, not downloaded or fails is skipped; one model alone works', async () => {
  const alone = await askLayered([layer('kev', { p: 0, error: 'not downloaded' }, false), layer('chrome', { p: 0.7 })]);
  assert.equal(alone.p, 0.7);
  assert.equal(alone.via, 'chrome');
  const fails = await askLayered([layer('kev', new Error('out of memory')), layer('chrome', { p: 0.9 })]);
  assert.equal(fails.p, 0.9);
  assert.equal(fails.via, 'chrome');
  assert.equal(fails.steps[0].error, 'out of memory');
  const second = await askLayered([layer('kev', { p: 0.5 }), layer('chrome', { p: null, error: 'unavailable' })]);
  assert.equal(second.p, 0.5, 'unsure, and the second look is not possible: the first answer stands');
  assert.equal(second.via, 'kev');
});

test('with nobody to answer there is no probability and a reason', async () => {
  const none = await askLayered([layer('kev', { p: 0 }, false)]);
  assert.equal(none.p, null);
  assert.equal(none.error, 'unavailable');
  const broken = await askLayered([layer('kev', { p: null, error: 'unsupported' })]);
  assert.equal(broken.p, null);
  assert.equal(broken.error, 'unsupported');
  assert.equal((await askLayered([])).p, null);
});

test('an answer outside 0..1 is clamped, and a non-number is no answer', async () => {
  assert.equal((await askLayered([layer('kev', { p: 1.4 })])).p, 1);
  assert.equal((await askLayered([layer('kev', { p: 'yes' })])).p, null);
  assert.equal((await askLayered([layer('kev', { p: NaN })])).p, null);
});
