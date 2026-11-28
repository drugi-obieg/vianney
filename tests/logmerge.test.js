import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logKey, mergeEntry, addToLog, compactLog } from '../extension/src/core/logmerge.js';

const feed = (over = {}) => ({ surface: 'feed-card', id: 'aaaaaaaaaaa', title: 'T', channel: 'C', ps: { gossip: 0.8 }, flagged: ['gossip'], uncertain: [], action: 'hide', via: 'lexicon', hits: [], t: 1000, ...over });

test('the same video seen again is one row, with a count, first and last sighting', () => {
  let log = addToLog([], feed({ t: 1000 }));
  log = addToLog(log, feed({ t: 2000 }));
  log = addToLog(log, feed({ t: 3000 }));
  assert.equal(log.length, 1);
  assert.equal(log[0].n, 3);
  assert.equal(log[0].t0, 1000);
  assert.equal(log[0].t, 3000);
});

test('the same video in another place is another row: the places are checked differently', () => {
  const log = addToLog(addToLog([], feed()), feed({ surface: 'related' }));
  assert.equal(log.length, 2);
  assert.notEqual(logKey(log[0]), logKey(log[1]));
});

test('the latest verdict wins: a video that is no longer flagged does not stay flagged', () => {
  let log = addToLog([], feed({ t: 1000 }));
  log = addToLog(log, feed({ t: 2000, ps: { gossip: 0.2 }, flagged: [], action: null, via: null }));
  assert.equal(log.length, 1);
  assert.deepEqual(log[0].flagged, []);
  assert.equal(log[0].action, null);
  assert.deepEqual(log[0].ps, { gossip: 0.2 });
});

test('the row of a thing seen again moves to the end, as the newest', () => {
  let log = addToLog([], feed({ id: 'aaaaaaaaaaa', t: 1 }));
  log = addToLog(log, feed({ id: 'bbbbbbbbbbb', t: 2 }));
  log = addToLog(log, feed({ id: 'aaaaaaaaaaa', t: 3 }));
  assert.deepEqual(log.map((e) => e.id), ['bbbbbbbbbbb', 'aaaaaaaaaaa']);
});

test('subtitles and audio log once for each passage: their findings are added up, not replaced', () => {
  const sub = (word, at, over = {}) => ({ surface: 'subtitles', id: 'vvvvvvvvvvv', title: 'V', channel: 'C', ps: { coarse: 0.9 }, flagged: ['coarse'], uncertain: [], action: 'mute-word', via: 'lexicon', hits: [{ rule: 'subtitles', hits: [`${word} @${at}s`] }], t: at, ...over });
  let log = addToLog([], sub('damn', 1));
  log = addToLog(log, sub('crap', 9, { ps: { coarse: 0.95, lords: 0.8 }, flagged: ['coarse', 'lords'], action: 'skip-segment' }));
  log = addToLog(log, sub('damn', 1));     // the same passage again adds nothing
  assert.equal(log.length, 1);
  assert.equal(log[0].n, 3);
  assert.deepEqual(log[0].hits, [{ rule: 'subtitles', hits: ['damn @1s', 'crap @9s'] }]);
  assert.deepEqual(log[0].flagged.sort(), ['coarse', 'lords']);
  assert.equal(log[0].ps.coarse, 0.95);
  assert.equal(log[0].action, 'mute-word,skip-segment');
});

test('one row remembers only so many passages', () => {
  let row = { surface: 'audio', id: 'vvvvvvvvvvv', title: '', channel: '', ps: {}, flagged: [], uncertain: [], hits: [], t: 0 };
  let log = addToLog([], row);
  for (let i = 1; i <= 80; i++) log = addToLog(log, { ...row, t: i, flagged: ['x'], hits: [{ rule: 'audio', hits: [`window ${i}`] }] });
  assert.equal(log.length, 1);
  assert.equal(log[0].hits[0].hits.length, 30);
  assert.equal(log[0].n, 81);
});

test('a row without an id is joined by its title and channel; comments by their id', () => {
  let log = addToLog([], { surface: 'comment', id: 'comment:1f', title: 'x', channel: 'a', t: 1 });
  log = addToLog(log, { surface: 'comment', id: 'comment:1f', title: 'x', channel: 'a', t: 2 });
  log = addToLog(log, { surface: 'comment', id: 'comment:2e', title: 'x', channel: 'a', t: 3 });
  assert.equal(log.length, 2);
  assert.equal(logKey({ surface: 'x', title: 'T', channel: 'C' }), 'x|T|C');
});

test('the log is kept to its maximum, the oldest rows go first', () => {
  let log = [];
  for (let i = 0; i < 12; i++) log = addToLog(log, feed({ id: String(i).padStart(11, '0'), t: i }), 5);
  assert.equal(log.length, 5);
  assert.equal(log[0].id, '00000000007');
  assert.equal(log[4].id, '00000000011');
});

test('a log from before the rows were joined is joined once, in the order of the last sighting', () => {
  const old = [feed({ id: 'aaaaaaaaaaa', t: 5 }), feed({ id: 'bbbbbbbbbbb', t: 6 }), feed({ id: 'aaaaaaaaaaa', t: 1 }), feed({ id: 'aaaaaaaaaaa', t: 9 })];
  const log = compactLog(old);
  assert.deepEqual(log.map((e) => [e.id, e.n, e.t0, e.t]), [['bbbbbbbbbbb', 1, 6, 6], ['aaaaaaaaaaa', 3, 1, 9]]);
  assert.equal(compactLog(log).length, 2, 'compacting twice changes nothing');
  assert.deepEqual(compactLog(log).map((e) => e.n), [1, 3]);
});

test('merging does not change the rows it was given', () => {
  const a = feed({ t: 1 });
  const before = JSON.stringify(a);
  mergeEntry(a, feed({ t: 2 }));
  addToLog([a], feed({ t: 3 }));
  assert.equal(JSON.stringify(a), before);
});

test('a model error belongs to the sighting that had it', () => {
  let log = addToLog([], feed({ error: 'NotReadableError' }));
  log = addToLog(log, feed({ t: 2000 }));
  assert.equal('error' in log[0], false);
});
