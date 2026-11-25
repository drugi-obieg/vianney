import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as ai from '../extension/src/ai/prompt-backend.js';

// A fake of the documented Prompt API surface: LanguageModel.availability/create, session.clone/prompt/destroy.
let created;
let prompts;
let answer;
let active;
let maxActive;

class FakeSession {
  async clone() { return new FakeSession(); }
  async prompt(text, opts) {
    active++; maxActive = Math.max(maxActive, active);
    await new Promise((r) => setTimeout(r, 2));
    prompts.push({ text, opts });
    active--;
    return answer(text, opts);
  }
  destroy() {}
}

beforeEach(() => {
  created = []; prompts = []; active = 0; maxActive = 0;
  answer = () => 'true';
  globalThis.LanguageModel = {
    availability: async () => 'available',
    create: async (o) => { created.push(o); return new FakeSession(); },
  };
  ai.resetSession();
});

test('without the API the backend reports unsupported and never throws', async () => {
  delete globalThis.LanguageModel;
  assert.equal(ai.isSupported(), false);
  assert.equal(await ai.getAvailability(), 'unsupported');
  assert.deepEqual(await ai.askNoul('q', 't'), { p: null, error: 'unsupported' });
});

test('availability is asked with the same input/output languages the session uses', async () => {
  let seen;
  globalThis.LanguageModel.availability = async (o) => { seen = o; return 'downloadable'; };
  assert.equal(await ai.getAvailability(), 'downloadable');
  assert.deepEqual(seen.expectedInputs[0].languages, ['en']);
});

test('yes/no: three differently worded prompts, a boolean constraint, p is the share of "true"', async () => {
  const outs = ['true', 'true', 'false'];
  answer = () => outs.shift();
  const r = await ai.askNoul('Is this a curse?', 'damn you');
  assert.equal(prompts.length, 3);
  assert.equal(new Set(prompts.map((x) => x.text)).size, 3);
  assert.ok(prompts.every((x) => x.text.includes('damn you') && x.text.includes('Is this a curse?')));
  assert.ok(prompts.every((x) => JSON.stringify(x.opts.responseConstraint) === '{"type":"boolean"}'));
  assert.equal(r.p, 2 / 3);
});

test('the session is created once with topK 1 and temperature 0 together, and with a system prompt', async () => {
  await ai.askNoul('q', 't');
  await ai.askNoul('q2', 't2');
  assert.equal(created.length, 1);
  assert.equal(created[0].topK, 1);
  assert.equal(created[0].temperature, 0);
  assert.equal(created[0].initialPrompts[0].role, 'system');
});

test('if the legacy sampling parameters are rejected it falls back to defaults instead of failing', async () => {
  globalThis.LanguageModel.create = async (o) => {
    created.push(o);
    if ('topK' in o) { const e = new TypeError('bad params'); throw e; }
    return new FakeSession();
  };
  const r = await ai.askNoul('q', 't');
  assert.equal(r.p, 1);
  assert.equal(created.length, 2);
  assert.ok(!('topK' in created[1]));
});

test('model failures become an error result, not an exception', async () => {
  answer = () => { const e = new Error('filtered'); e.name = 'NotReadableError'; throw e; };
  assert.deepEqual(await ai.askNoul('q', 't'), { p: null, error: 'NotReadableError' });
});

test('ordinal answers: a RegExp constraint over the level names, p is the mean level scaled to 0..1', async () => {
  const outs = ['heavy', 'heavy', 'mild'];
  answer = () => outs.shift();
  const r = await ai.askScore('How much gossip?', ['none', 'mild', 'heavy'], 'text');
  assert.ok(prompts.every((x) => x.opts.responseConstraint instanceof RegExp));
  assert.ok(prompts[0].opts.responseConstraint.test('mild') && !prompts[0].opts.responseConstraint.test('severe'));
  assert.ok(Math.abs(r.p - (1 + 1 + 0.5) / 3) < 1e-9);
});

test('an answer outside the levels is an error, not a guess', async () => {
  answer = () => 'banana';
  assert.deepEqual(await ai.askScore('q', ['a', 'b'], 't'), { p: null, error: 'bad-answer' });
});

test('very long text is truncated before it reaches the model', async () => {
  await ai.askNoul('q', 'x'.repeat(5000));
  assert.ok(prompts.every((x) => x.text.length < 1700));
});

test('requests are serialised: the model never sees two prompts at once', async () => {
  await Promise.all([ai.askNoul('a', '1'), ai.askNoul('b', '2'), ai.askNoul('c', '3')]);
  assert.equal(maxActive, 1);
  assert.equal(prompts.length, 9);
});

// ---------------------------------------------------------------- pictures and sound
const picture = new Blob([new Uint8Array(2048)], { type: 'image/jpeg' });
const clip = new Blob([new Uint8Array(4096)], { type: 'audio/wav' });

test('media availability is asked with the matching input type', async () => {
  const seen = [];
  globalThis.LanguageModel.availability = async (o) => { seen.push(o.expectedInputs.map((i) => i.type)); return 'downloadable'; };
  assert.equal(await ai.getMediaAvailability('image'), 'downloadable');
  assert.equal(await ai.getMediaAvailability('audio'), 'downloadable');
  assert.deepEqual(seen, [['text', 'image'], ['text', 'audio']]);
  assert.equal(await ai.getMediaAvailability('video'), 'unsupported');
});

test('picture question: documented multimodal prompt shape, boolean constraint, p from the votes', async () => {
  const outs = ['true', 'false'];
  answer = () => outs.shift();
  const r = await ai.askMedia('image', 'Does this picture show nudity?', picture, { votes: 2 });
  assert.equal(prompts.length, 2);
  const msg = prompts[0].text; // for media the "text" the fake receives is the message array
  assert.ok(Array.isArray(msg) && msg[0].role === 'user');
  assert.equal(msg[0].content[0].type, 'text');
  assert.ok(msg[0].content[0].value.includes('Does this picture show nudity?'));
  assert.equal(msg[0].content[1].type, 'image');
  assert.equal(msg[0].content[1].value, picture);
  assert.equal(JSON.stringify(prompts[0].opts.responseConstraint), '{"type":"boolean"}');
  assert.equal(r.p, 0.5);
});

test('image and audio get separate base sessions that declare their input type', async () => {
  await ai.askMedia('image', 'q', picture, { votes: 1 });
  await ai.askMedia('audio', 'q', clip, { votes: 1 });
  const types = created.map((o) => o.expectedInputs.map((i) => i.type).join('+'));
  assert.deepEqual(types, ['text+image', 'text+audio']);
  assert.ok(created.every((o) => o.topK === 1 && o.temperature === 0));
});

test('votes are clamped between one and three prompt wordings', async () => {
  await ai.askMedia('image', 'q', picture, { votes: 0 });
  assert.equal(prompts.length, 1);
  prompts.length = 0;
  await ai.askMedia('image', 'q', picture, { votes: 9 });
  assert.equal(prompts.length, 3);
});

test('an unsupported input type and a safety refusal both come back as error results', async () => {
  globalThis.LanguageModel.create = async () => { const e = new Error('no image input'); e.name = 'NotSupportedError'; throw e; };
  assert.deepEqual(await ai.askMedia('image', 'q', picture), { p: null, error: 'NotSupportedError' });
  ai.resetSession();
  globalThis.LanguageModel.create = async () => new FakeSession();
  answer = () => { const e = new Error('unsafe'); e.name = 'NotReadableError'; throw e; };
  assert.deepEqual(await ai.askMedia('image', 'q', picture), { p: null, error: 'NotReadableError' });
});

test('NotSupportedError is not retried as if it were a bad sampling parameter', async () => {
  let calls = 0;
  globalThis.LanguageModel.create = async () => { calls++; const e = new Error('x'); e.name = 'NotSupportedError'; throw e; };
  await ai.askMedia('audio', 'q', clip);
  assert.equal(calls, 1);
});

test('without the API the media functions report unsupported', async () => {
  delete globalThis.LanguageModel;
  assert.deepEqual(await ai.askMedia('image', 'q', picture), { p: null, error: 'unsupported' });
  assert.equal(await ai.getMediaAvailability('audio'), 'unsupported');
});
