import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, videoIdFrom, parseListText, listVerdict, addToList, EMPTY_LISTS } from '../extension/src/core/lists.js';

test('names are compared without case, accents and extra spaces', () => {
  assert.equal(normalizeName('  Cantus   Vaticanus '), 'cantus vaticanus');
  assert.equal(normalizeName('Curé d’Ars'), 'cure d’ars');
});

test('video ids come from ids and from the URL forms people paste', () => {
  assert.equal(videoIdFrom('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(videoIdFrom('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5s'), 'dQw4w9WgXcQ');
  assert.equal(videoIdFrom('https://youtu.be/dQw4w9WgXcQ?si=abc'), 'dQw4w9WgXcQ');
  assert.equal(videoIdFrom('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(videoIdFrom('not a video'), null);
});

test('list text: one entry per line, comments and blank lines ignored', () => {
  assert.deepEqual(parseListText('# my list\nfoo\n\n  bar  # why\n#x\n'), ['foo', 'bar']);
});

const lists = { ...EMPTY_LISTS, allowVideos: ['aaaaaaaaaaa'], allowChannels: ['@Good Channel'], denyVideos: ['bbbbbbbbbbb'], denyChannels: ['Bad Channel'] };

test('allow and block lists match videos and channels', () => {
  assert.equal(listVerdict(lists, { id: 'aaaaaaaaaaa', channel: 'x' }), 'allow');
  assert.equal(listVerdict(lists, { id: 'zzzzzzzzzzz', channel: 'good channel' }), 'allow'); // case and @ are ignored
  assert.equal(listVerdict(lists, { id: 'bbbbbbbbbbb', channel: '' }), 'deny');
  assert.equal(listVerdict(lists, { id: 'zzzzzzzzzzz', channel: 'BAD  channel' }), 'deny');
  assert.equal(listVerdict(lists, { id: 'zzzzzzzzzzz', channel: 'someone else' }), null);
  assert.equal(listVerdict(lists, { id: 'zzzzzzzzzzz', channel: '' }), null); // no channel name: nothing to match
});

test('allow wins when something is on both lists, so a mistake can always be undone', () => {
  const both = { ...EMPTY_LISTS, allowVideos: ['ccccccccccc'], denyVideos: ['ccccccccccc'] };
  assert.equal(listVerdict(both, { id: 'ccccccccccc' }), 'allow');
});

test('addToList adds once and does not mutate', () => {
  const a = addToList(EMPTY_LISTS, 'allowVideos', 'aaaaaaaaaaa');
  assert.deepEqual(a.allowVideos, ['aaaaaaaaaaa']);
  assert.deepEqual(addToList(a, 'allowVideos', 'aaaaaaaaaaa').allowVideos, ['aaaaaaaaaaa']);
  assert.deepEqual(EMPTY_LISTS.allowVideos, []);
});
