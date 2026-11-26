import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRules } from '../extension/src/core/rules.js';
import { parseLexicon } from '../extension/src/core/lexicon.js';
import { Engine } from '../extension/src/core/engine.js';
import { tokenize } from '../extension/src/core/text.js';

const RULES = `
rule coarse
  where: feed-card, subtitles
  lexicon: coarse
  flag at: 0.7
  action: feed-card=hide, subtitles=mute-word

rule gossip
  where: feed-card
  lexicon: cues
  ask noul: Does this expose the private faults of a named person?
  flag at: 0.7
  action: feed-card=blank

rule lords
  where: subtitles
  lexicon: strong, bare
  ask noul: Is the name of God used as an exclamation and not in prayer?
  flag at: 0.8
  action: subtitles=mute-word
`;

const LEX = {
  coarse: parseLexicon('0.95 | fuck*\n0.5 | crap', 'coarse'),
  cues: parseLexicon('0.5 | exposed\n0.15 | drama', 'cues'),
  strong: parseLexicon('0.95 | oh my god\n0.75 | jesus christ', 'strong'),
  bare: parseLexicon('0.15 | god', 'bare'),
};

function engine(settings = {}, backend = null) {
  const { rules, errors } = parseRules(RULES);
  assert.deepEqual(errors, []);
  return new Engine({ rules, lexicons: LEX, settings, backend });
}

class FakeBackend {
  constructor(answer) { this.answer = answer; this.calls = []; }
  async askNoul(question, text) { this.calls.push({ question, text }); return typeof this.answer === 'function' ? this.answer(text) : this.answer; }
  async askScore() { return { p: 0 }; }
}

test('a strong lexicon hit flags without any model', async () => {
  const r = await engine().evaluate({ title: 'This is fucking great', channel: 'x' }, 'feed-card');
  assert.equal(r.flagged[0].ruleId, 'coarse');
  assert.equal(r.action, 'hide');
  assert.equal(r.ps.coarse, 0.95);
});

test('a weak cue does not flag at the default level, but does when the slider is lowered', async () => {
  const item = { title: 'Total crap', channel: 'x' };
  assert.equal((await engine().evaluate(item, 'feed-card')).flagged.length, 0);
  const lenient = engine({ sensitivity: { coarse: 0.5 } });
  assert.equal((await lenient.evaluate(item, 'feed-card')).flagged[0].ruleId, 'coarse');
  const strict = engine({ sensitivity: { coarse: 0.99 } });
  assert.equal((await strict.evaluate({ title: 'fuck', channel: '' }, 'feed-card')).flagged.length, 0);
});

test('the same input and settings always give the same verdict', async () => {
  const e = engine();
  const a = JSON.stringify(await e.evaluate({ title: 'fuck this crap' }, 'feed-card'));
  const b = JSON.stringify(await e.evaluate({ title: 'fuck this crap' }, 'feed-card'));
  assert.equal(a, b);
});

test('disabled rules are skipped and rules only run on their surfaces', async () => {
  const e = engine({ ruleEnabled: { coarse: false } });
  assert.equal((await e.evaluate({ title: 'fuck' }, 'feed-card')).results.length, 1); // only gossip left for feed-card
  assert.equal((await engine().evaluate({ title: 'oh my god' }, 'feed-card')).results.some((r) => r.ruleId === 'lords'), false);
});

test('the model is not asked when there is no cue, and not for cues below the uncertain band', async () => {
  const be = new FakeBackend({ p: 1 });
  const e = engine({}, be);
  await e.evaluate({ title: 'Gregorian chant for evening prayer' }, 'feed-card');
  await e.evaluate({ title: 'Reality drama' }, 'feed-card'); // 0.15 < band start (0.5)
  assert.equal(be.calls.length, 0);
});

test('inside the uncertain band the model decides, and its answer becomes p', async () => {
  const yes = new FakeBackend({ p: 1 });
  const r1 = await engine({}, yes).evaluate({ title: 'Celebrity exposed!' }, 'feed-card');
  assert.equal(yes.calls.length, 1);
  assert.equal(r1.flagged[0].ruleId, 'gossip');
  assert.equal(r1.flagged[0].via, 'model');
  assert.equal(r1.action, 'blank');

  const no = new FakeBackend({ p: 0 });
  const r2 = await engine({}, no).evaluate({ title: 'Celebrity exposed!' }, 'feed-card');
  assert.equal(r2.flagged.length, 0);
});

test('without a backend, or when the backend errors, the cue stays uncertain and nothing is flagged', async () => {
  const r0 = await engine().evaluate({ title: 'Celebrity exposed!' }, 'feed-card');
  assert.equal(r0.flagged.length, 0);
  assert.equal(r0.results.find((r) => r.ruleId === 'gossip').needsModel, true);
  assert.equal(r0.results.find((r) => r.ruleId === 'gossip').uncertain, true);

  const bad = new FakeBackend({ p: null, error: 'NotReadableError' });
  const r1 = await engine({}, bad).evaluate({ title: 'Celebrity exposed!' }, 'feed-card');
  assert.equal(r1.flagged.length, 0);
  assert.equal(r1.results.find((r) => r.ruleId === 'gossip').modelError, 'NotReadableError');
});

test('model answers are cached per rule and text', async () => {
  const be = new FakeBackend({ p: 0 });
  const e = engine({}, be);
  await e.evaluate({ title: 'Celebrity exposed!' }, 'feed-card');
  await e.evaluate({ title: 'Celebrity exposed!' }, 'feed-card');
  assert.equal(be.calls.length, 1);
});

function timed(words) {
  let t = 0;
  return words.split(' ').map((w) => { const tok = tokenize(w)[0]; const o = { ...tok, start: t, end: t + 0.4 }; t += 0.5; return o; });
}

test('subtitles: a strong hit becomes a timed decision', async () => {
  const toks = timed('well oh my god look at this');
  // tokens: "oh" "my" "god" were split into words above; rebuild as one run
  const d = await engine().evaluateSubtitles(toks);
  assert.equal(d.length, 1);
  assert.equal(d[0].ruleId, 'lords');
  assert.equal(d[0].action, 'mute-word');
  assert.equal(d[0].text, 'oh my god');
  assert.ok(Math.abs(d[0].start - 0.5) < 1e-9);
  assert.ok(Math.abs(d[0].end - 1.9) < 1e-9);
});

test('subtitles: a mid-weight phrase is verified by the model in context, and a prayer is spared', async () => {
  const toks = timed('we pray jesus christ our lord have mercy on us');
  const prayer = new FakeBackend({ p: 0 });
  const d1 = await engine({}, prayer).evaluateSubtitles(toks);
  assert.equal(prayer.calls.length, 1);
  assert.equal(d1.length, 0);

  const curse = new FakeBackend({ p: 1 });
  const d2 = await engine({}, curse).evaluateSubtitles(timed('jesus christ that hurt'));
  assert.equal(d2.length, 1);
  assert.equal(d2[0].via, 'model');
});

test('subtitles: the per-video model budget is respected', async () => {
  const be = new FakeBackend({ p: 0 });
  const toks = timed(Array.from({ length: 10 }, (_, i) => `jesus christ w${i}`).join(' '));
  await engine({}, be).evaluateSubtitles(toks, { maxModelCalls: 3 });
  assert.equal(be.calls.length, 3);
});

test('subtitles: a skip-segment judged by the model covers the whole context window, a lexicon-only hit just the cue', async () => {
  const { rules, errors } = parseRules(`
rule gossip
  where: subtitles
  lexicon: cues
  ask noul: Is this gossip about a named person?
  flag at: 0.7
  action: subtitles=skip-segment
`);
  assert.deepEqual(errors, []);
  const lex = { cues: parseLexicon('0.5 | exposed\n0.95 | leaked', 'cues') };
  const toks = timed('well everyone says he was exposed in the end really');
  const yes = new FakeBackend({ p: 1 });
  const e = new Engine({ rules, lexicons: lex, settings: {}, backend: yes });
  const [d] = await e.evaluateSubtitles(toks, { context: 3 });
  assert.equal(d.via, 'model');
  assert.ok(d.start < toks.find((t) => t.t === 'exposed').start, 'the skip starts before the cue word');
  assert.ok(d.end > toks.find((t) => t.t === 'exposed').end, 'and ends after it');
  // a strong cue flags by the lexicon alone and keeps its own narrow span
  const e2 = new Engine({ rules, lexicons: lex, settings: {}, backend: null });
  const [d2] = await e2.evaluateSubtitles(timed('it was leaked yesterday'));
  assert.equal(d2.via, 'lexicon');
  assert.equal(d2.text, 'leaked');
});

// ---------------------------------------------------------------- pictures and sound
const MEDIA_RULES = `
rule explicit_images
  title: Explicit pictures
  where: thumbnail
  ask noul: Does this picture show nudity?
  flag at: 0.6
  refusal: flag
  action: thumbnail=hide

rule immodest_images
  title: Immodest pictures
  where: thumbnail
  ask noul: Does this picture show swimwear?
  flag at: 0.6
  action: thumbnail=blur

rule audio_coarse
  title: Coarse sound
  where: audio
  ask noul: Is vulgar language used?
  flag at: 0.6
  action: audio=mute-next
`;

class FakeMediaBackend {
  constructor(fn) { this.fn = fn; this.calls = []; this.mediaEnabled = { image: true, audio: true }; }
  async askMedia(kind, question, media, opts) { this.calls.push({ kind, question, media, opts }); return this.fn({ kind, question, media, opts }); }
}

function mediaEngine(backend, settings = {}) {
  const { rules, errors } = parseRules(MEDIA_RULES);
  assert.deepEqual(errors, []);
  return new Engine({ rules, lexicons: {}, settings, backend });
}

test('a picture is judged by every thumbnail rule; the strongest action wins', async () => {
  const be = new FakeMediaBackend(({ question }) => ({ p: question.includes('nudity') ? 1 : 0.5 }));
  const v = await mediaEngine(be).evaluateMedia('thumbnail', { id: 'vid', media: { videoId: 'vid' } });
  assert.equal(be.calls.length, 2);
  assert.ok(be.calls.every((c) => c.kind === 'image'));
  assert.deepEqual(v.flagged.map((r) => r.ruleId), ['explicit_images']); // 0.5 stays below 0.6
  assert.equal(v.action, 'hide');
  assert.deepEqual(v.ps, { explicit_images: 1, immodest_images: 0.5 });
  const r = v.results.find((x) => x.ruleId === 'immodest_images');
  assert.equal(r.uncertain, true);
});

test('sound goes to the audio rules only, and the vote count is passed through', async () => {
  const be = new FakeMediaBackend(() => ({ p: 1 }));
  const v = await mediaEngine(be, { media: { votes: 3 } }).evaluateMedia('audio', { id: 'vid', window: 0, media: { wav: 'AAAA' } });
  assert.equal(be.calls.length, 1);
  assert.equal(be.calls[0].kind, 'audio');
  assert.equal(be.calls[0].opts.votes, 3);
  assert.equal(v.action, 'mute-next');
});

test('the sensitivity of a media rule moves its verdict without asking the model again', async () => {
  const be = new FakeMediaBackend(() => ({ p: 0.5 }));
  const e = mediaEngine(be);
  assert.equal((await e.evaluateMedia('thumbnail', { id: 'vid', media: {} })).flagged.length, 0);
  e.setSettings({ sensitivity: { immodest_images: 0.4, explicit_images: 0.4 } });
  assert.equal((await e.evaluateMedia('thumbnail', { id: 'vid', media: {} })).flagged.length, 2);
  assert.equal(be.calls.length, 2, 'the pictures were asked about once per rule, then served from the cache');
});

test('sound windows are not cached, pictures are', async () => {
  const be = new FakeMediaBackend(() => ({ p: 0 }));
  const e = mediaEngine(be);
  await e.evaluateMedia('audio', { id: 'v', window: 0, media: {} });
  await e.evaluateMedia('audio', { id: 'v', window: 0, media: {} });
  assert.equal(be.calls.length, 2);
});

test('a refusal ("unsafe response") counts as a flag only for rules that opt in, and only while the setting allows it', async () => {
  const be = new FakeMediaBackend(() => ({ p: null, error: 'NotReadableError' }));
  const v = await mediaEngine(be).evaluateMedia('thumbnail', { id: 'vid', media: {} });
  assert.deepEqual(v.flagged.map((r) => r.ruleId), ['explicit_images']);
  assert.equal(v.flagged[0].via, 'refusal');
  assert.equal(v.results.find((r) => r.ruleId === 'immodest_images').modelError, 'NotReadableError');
  const off = await mediaEngine(be, { media: { refusalIsFlag: false } }).evaluateMedia('thumbnail', { id: 'vid2', media: {} });
  assert.equal(off.flagged.length, 0);
});

test('without a media-capable backend nothing is flagged and the rules say they need the model', async () => {
  const be = new FakeMediaBackend(() => ({ p: 1 }));
  be.mediaEnabled = { image: false, audio: true };
  const v = await mediaEngine(be).evaluateMedia('thumbnail', { id: 'vid', media: {} });
  assert.equal(v.flagged.length, 0);
  assert.ok(v.results.every((r) => r.needsModel));
  assert.equal(be.calls.length, 0);
  assert.equal((await mediaEngine(null).evaluateMedia('audio', { id: 'v', window: 0, media: {} })).flagged.length, 0);
});

test('the user can choose another action for a rule and surface; an action the surface does not know is ignored', async () => {
  const be = new FakeMediaBackend(() => ({ p: 1 }));
  const e = mediaEngine(be, { actions: { immodest_images: { thumbnail: 'blackout' }, explicit_images: { thumbnail: 'mute-word' } } });
  const v = await e.evaluateMedia('thumbnail', { id: 'vid', media: {} });
  const by = Object.fromEntries(v.results.map((r) => [r.ruleId, r.action]));
  assert.equal(by.immodest_images, 'blackout', 'the choice replaces the rule\'s "blur"');
  assert.equal(by.explicit_images, 'hide', '"mute-word" is not a picture action, so the rule\'s own action stays');
  assert.equal(v.action, 'hide');
  assert.equal(e.actionFor({ id: 'nothing_set', action: { thumbnail: 'blur' } }, 'thumbnail'), 'blur');
});

test('blackout is stronger than blur and weaker than hide when several rules flag the same picture', async () => {
  const { strongestAction } = await import('../extension/src/core/engine.js');
  assert.equal(strongestAction(['blur', 'blackout']), 'blackout');
  assert.equal(strongestAction(['blackout', 'hide']), 'hide');
  assert.equal(strongestAction(['dim', 'blackout', 'label']), 'blackout');
});

test('a chosen action applies to titles and subtitles too', async () => {
  const e = engine({ actions: { coarse: { 'feed-card': 'dim', subtitles: 'skip-segment' } } });
  assert.equal((await e.evaluate({ title: 'This is fucking great', channel: 'x' }, 'feed-card')).action, 'dim');
  const tokens = tokenize('well this is fucking great').map((t, i) => ({ ...t, start: i, end: i + 0.5 }));
  const d = await e.evaluateSubtitles(tokens);
  assert.equal(d[0].action, 'skip-segment');
});

test('the quick (synchronous, word-list only) verdict equals the full verdict whenever no model can add to it', async () => {
  const titles = ['This is fucking great', 'Total crap', 'oh my god look', 'Jesus Christ is Lord', 'thank god it is friday', 'exposed: the drama', 'Friday Vespers, Lord have mercy', '', 'plain title'];
  for (const settings of [{}, { sensitivity: { coarse: 0.5, lords: 0.1 } }, { ruleEnabled: { coarse: false } }]) {
    const e = engine(settings);
    for (const title of titles) {
      for (const surface of ['feed-card', 'subtitles']) {
        const item = { title, channel: 'x', text: title };
        const quick = e.evaluateQuick(item, surface);
        const full = await e.evaluate(item, surface);
        assert.deepEqual(quick.ps, full.ps, `${title} / ${surface}`);
        assert.deepEqual(quick.flagged.map((r) => r.ruleId), full.flagged.map((r) => r.ruleId), `${title} / ${surface}`);
        assert.equal(quick.action, full.action, `${title} / ${surface}`);
        assert.equal(quick.undecided, false, 'without a backend nothing is undecided');
      }
    }
  }
});

test('quick verdicts say when a model could still add a flag, and a model answer only ever adds to them', async () => {
  const be = new FakeBackend({ p: 1 });
  be.enabled = true;
  const e = engine({}, be);
  // "exposed" is a 0.5 cue for gossip (flag at 0.7): inside the uncertain band, so a model could still flag it
  const quick = e.evaluateQuick({ title: 'exposed by his friend', channel: '' }, 'feed-card');
  assert.equal(quick.flagged.length, 0);
  assert.equal(quick.undecided, true);
  assert.equal(be.calls.length, 0, 'the quick stage never asks the model');
  const full = await e.evaluate({ title: 'exposed by his friend', channel: '' }, 'feed-card');
  assert.deepEqual(full.flagged.map((r) => r.ruleId), ['gossip']);
  // a strong word-list hit is decided without the model
  const strong = e.evaluateQuick({ title: 'This is fucking great', channel: '' }, 'feed-card');
  assert.equal(strong.top.ruleId, 'coarse');
  assert.equal(strong.undecided, false);
  for (const title of ['This is fucking great', 'oh my god look', 'exposed by his friend']) {
    const q = e.evaluateQuick({ title, channel: '' }, 'feed-card').flagged.map((r) => r.ruleId);
    const f = (await e.evaluate({ title, channel: '' }, 'feed-card')).flagged.map((r) => r.ruleId);
    for (const id of q) assert.ok(f.includes(id), `${title}: a quick flag (${id}) must survive the full evaluation`);
  }
});

test('pictures and sound do not depend on the switch for the text questions', async () => {
  const be = new FakeMediaBackend(() => ({ p: 1 }));
  be.enabled = false; // "use the on-device AI for rules" is off
  const v = await mediaEngine(be).evaluateMedia('thumbnail', { id: 'vid', media: {} });
  assert.deepEqual(v.flagged.map((r) => r.ruleId), ['explicit_images', 'immodest_images']);
});

test('a remembered video is judged again under the current sensitivity and enabled rules', () => {
  const e = mediaEngine(new FakeMediaBackend(() => ({ p: 0 })));
  const entry = { by: [{ rule: 'loud_audio', p: 0.5 }, { rule: 'explicit_images', p: 1 }, { rule: 'gone', p: 1 }] };
  assert.deepEqual(e.rememberedVerdict(entry).flagged.map((r) => r.ruleId), ['explicit_images']);
  e.setSettings({ sensitivity: { explicit_images: 1 }, ruleEnabled: { explicit_images: false } });
  assert.equal(e.rememberedVerdict(entry).top, null, 'a rule that is switched off no longer hides remembered videos');
  e.setSettings({ ruleEnabled: { explicit_images: true }, sensitivity: { explicit_images: 1 } });
  assert.equal(e.rememberedVerdict(entry).top.ruleId, 'explicit_images');
  e.setSettings({ sensitivity: { explicit_images: 1 } });
  assert.equal(e.rememberedVerdict({ by: [{ rule: 'explicit_images', p: 0.5 }] }).top, null);
  assert.equal(e.rememberedVerdict(null).top, null);
});

test('a model error that is not a refusal is reported and flags nothing', async () => {
  const be = new FakeMediaBackend(() => ({ p: null, error: 'QuotaExceededError' }));
  const v = await mediaEngine(be).evaluateMedia('thumbnail', { id: 'vid', media: {} });
  assert.equal(v.flagged.length, 0);
  assert.equal(v.results[0].modelError, 'QuotaExceededError');
});
