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

test('a channel is found by its handle, its id or the address of its page, not only by the name on the card', () => {
  const l = { ...EMPTY_LISTS, allowChannels: ['@cantusvaticanus', 'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv', 'youtube.com/c/Old%20Name', 'https://www.youtube.com/@Kyrie%20Eleison?si=x'] };
  const none = { id: 'zzzzzzzzzzz' };
  assert.equal(listVerdict(l, { ...none, channel: 'Cantus Vaticanus', handle: '@CantusVaticanus' }), 'allow');   // the handle on the card's link
  assert.equal(listVerdict(l, { ...none, channel: 'Some Name', channelId: 'UCabcdefghijklmnopqrstuv' }), 'allow'); // a pasted channel address, the player knows the id
  assert.equal(listVerdict(l, { ...none, channel: 'old name' }), 'allow');                                          // /c/ addresses name the channel too
  assert.equal(listVerdict(l, { ...none, channel: 'Kyrie Eleison' }), 'allow');                                     // percent-encoding and the tracking tail are undone
  assert.equal(listVerdict(l, { ...none, channel: 'Somebody Else', handle: '@somebody' }), null);
});

test('only a real youtube.com address is read as an address: a name with slashes stays a name', () => {
  const l = { ...EMPTY_LISTS, denyChannels: ['AC/DC Official', 'Some/user/Name'] };
  assert.equal(listVerdict(l, { id: 'zzzzzzzzzzz', channel: 'ac/dc official' }), 'deny');
  assert.equal(listVerdict(l, { id: 'zzzzzzzzzzz', channel: 'some/user/name' }), 'deny');
  assert.equal(listVerdict(l, { id: 'zzzzzzzzzzz', channel: 'Name' }), null);
});

test('an empty channel never matches an empty or odd list entry', () => {
  const l = { ...EMPTY_LISTS, allowChannels: ['', '   ', '@'] };
  assert.equal(listVerdict(l, { id: 'zzzzzzzzzzz', channel: '', handle: '', channelId: '' }), null);
  assert.equal(listVerdict(l, { id: 'zzzzzzzzzzz', channel: 'x' }), null);
});
