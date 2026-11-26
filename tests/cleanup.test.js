import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLEANUP_DEFAULTS, CLEANUP_CSS, TOKENS, cleanupTokens, normalizeTitles, titleMatches, shortsWatchPath } from '../extension/src/core/cleanup.js';

// Clean up hides the extras around videos. The selectors were measured on the real page (docs: plan.md 3.13); these tests keep their shape.

test('every switch has a rule in the stylesheet, and every rule only hides', () => {
  for (const t of TOKENS) assert.ok(CLEANUP_CSS.includes(`html[data-vianney-clean~="${t}"]`), t);
  const blocks = CLEANUP_CSS.split('}').map((b) => b.trim()).filter(Boolean);
  assert.ok(blocks.length >= TOKENS.length + 1);
  for (const b of blocks) assert.match(b, /\{ display: none !important; ?$/, b.slice(-80));
  assert.equal((CLEANUP_CSS.match(/\{/g) || []).length, (CLEANUP_CSS.match(/\}/g) || []).length);
});

test('the selectors name what was measured: element names, what a shelf holds, where a link goes', () => {
  const rule = (token) => CLEANUP_CSS.split('}').find((b) => b.includes(`~="${token}"]`));
  assert.match(rule('shorts'), /ytd-reel-shelf-renderer/);
  assert.match(rule('shorts'), /ytd-rich-shelf-renderer\[is-shorts\]/);
  assert.match(rule('shorts'), /grid-shelf-view-model:has\(ytm-shorts-lockup-view-model\)/);
  assert.match(rule('shorts'), /a\[href\^="\/shorts\/"\]/);
  assert.match(rule('shorts'), /a\[title="Shorts"\]/);
  assert.match(rule('games'), /a\[href="\/gaming"\]/);
  assert.match(rule('games'), /a\[href="\/playables"\]/);
  assert.match(rule('games'), /ytd-mini-game-card-view-model/);
  assert.match(rule('movies'), /a\[href\^="\/feed\/storefront"\]/);
  assert.match(rule('movies'), /ytd-movie-renderer/);
  assert.match(rule('movies'), /ytd-grid-movie-renderer/);
  assert.match(rule('explore'), /UC-9-kyTW8ZkZNDHQJ6FgpwQ/);
  assert.match(rule('more'), /a\[href="\/premium"\]/);
  assert.match(rule('banners'), /ytd-feed-nudge-renderer/);
  assert.match(CLEANUP_CSS, /\[data-vianney-shelf="hidden"\] \{ display: none !important; \}/);
  // no German or English word of the interface is needed, except the brand name of the Shorts entry
  assert.doesNotMatch(CLEANUP_CSS, /empfohlen|recommended|Spiele|Filme|Entdecken|Primetime/i);
});

test('the switches that are on become tokens; everything is on by default', () => {
  assert.deepEqual(cleanupTokens(undefined), TOKENS);
  assert.deepEqual(cleanupTokens({}), TOKENS);
  assert.deepEqual(cleanupTokens({ shorts: false, more: false }), ['games', 'movies', 'explore', 'banners']);
  assert.deepEqual(cleanupTokens(Object.fromEntries(TOKENS.map((t) => [t, false]))), []);
  for (const k of [...TOKENS, 'shortsAsVideos']) assert.equal(CLEANUP_DEFAULTS[k], true, k);
});

test('shelf titles: the German "Von YouTube empfohlen" is there from the start, matching ignores case and spacing', () => {
  assert.ok(CLEANUP_DEFAULTS.shelfTitles.includes('Von YouTube empfohlen'));
  const n = normalizeTitles(['  Von YouTube   empfohlen ', '', 'von youtube empfohlen', 'Recommended by YouTube']);
  assert.deepEqual(n, ['von youtube empfohlen', 'recommended by youtube']);
  assert.deepEqual(normalizeTitles('a\n\n  B \na'), ['a', 'b']);
  assert.equal(titleMatches('Von YouTube empfohlen', n), true);
  assert.equal(titleMatches('  von   youtube EMPFOHLEN ', n), true);
  assert.equal(titleMatches('Videos – von YouTube empfohlen für dich', n), true);
  assert.equal(titleMatches('Beliebte Podcasts', n), false);
  assert.equal(titleMatches('', n), false);
  assert.equal(titleMatches('anything', []), false);
});

test('a Shorts address becomes the address of the normal player; nothing else does', () => {
  assert.equal(shortsWatchPath('/shorts/D4Wjl7J5LA8'), '/watch?v=D4Wjl7J5LA8');
  assert.equal(shortsWatchPath('/shorts/D4Wjl7J5LA8/'), '/watch?v=D4Wjl7J5LA8');
  assert.equal(shortsWatchPath('/shorts/abc'), null);
  assert.equal(shortsWatchPath('/shorts'), null);
  assert.equal(shortsWatchPath('/watch'), null);
  assert.equal(shortsWatchPath('/results'), null);
  assert.equal(shortsWatchPath(undefined), null);
});

test('the stylesheet that the manifest loads at document_start is the one in core/cleanup.js, and the early script uses the same switches', async () => {
  const { readFileSync } = await import('node:fs');
  const { HEADER } = await import('../tools/make-cleanup-css.mjs');
  const root = new URL('../extension/', import.meta.url);
  assert.equal(readFileSync(new URL('src/content/cleanup.css', root), 'utf8'), HEADER + CLEANUP_CSS + '\n', 'run: node tools/make-cleanup-css.mjs');
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
  const early = manifest.content_scripts.find((c) => (c.js || []).includes('src/content/early.js'));
  assert.ok(early, 'the manifest runs early.js');
  assert.equal(early.run_at, 'document_start');
  assert.deepEqual(early.css, ['src/content/cleanup.css']);
  const tokens = readFileSync(new URL('src/content/early.js', root), 'utf8').match(/\[('shorts'[^\]]*)\]\.filter/)[1].split(',').map((t) => t.trim().replace(/'/g, ''));
  assert.deepEqual(tokens, TOKENS);
});
