import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkZipLayout, pack, zipEntries } from '../tools/pack.mjs';

const hasZip = (() => { try { execFileSync('zip', ['-v'], { stdio: 'ignore' }); execFileSync('unzip', ['-v'], { stdio: 'ignore' }); return true; } catch { return false; } })();

test('the layout check accepts files at the root and rejects a wrapper folder or a missing manifest', () => {
  assert.doesNotThrow(() => checkZipLayout(['manifest.json', 'icons/', 'icons/icon16.png', 'src/']));
  assert.throws(() => checkZipLayout(['vianney-0.2.0/', 'vianney-0.2.0/manifest.json', 'vianney-0.2.0/src/a.js']), /no entry named manifest\.json/);
  assert.throws(() => checkZipLayout(['readme.txt', 'icons/a.png']), /no entry named manifest\.json/);
});

// Chrome's zip installer (extensions/browser/zipfile_installer.cc) unzips only an entry whose whole path equals
// "manifest.json" and fails with "Could not unzip extension for install." when there is none. This is that test.
test('the packed zip has manifest.json at its root, holds exactly the extension folder, and unzips to a loadable extension', { skip: !hasZip }, () => {
  const { out, version } = pack();
  const entries = zipEntries(out);
  assert.ok(entries.includes('manifest.json'), 'manifest.json must be a root entry');
  assert.ok(!entries.some((e) => e.includes('.DS_Store')));
  const extension = resolve(import.meta.dirname, '../extension');
  const files = (dir, base = '') => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name), `${base}${d.name}/`) : [`${base}${d.name}`]));
  const wanted = files(extension).filter((f) => !f.endsWith('.DS_Store')).sort();
  assert.deepEqual(entries.filter((e) => !e.endsWith('/')).sort(), wanted, 'the zip holds every file of extension/, and nothing else');

  const dir = mkdtempSync(join(tmpdir(), 'vianney-unzip-'));
  try {
    execFileSync('unzip', ['-q', out, '-d', dir]);
    assert.ok(existsSync(join(dir, 'manifest.json')));
    assert.equal(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')).version, version);
    for (const f of wanted) assert.ok(existsSync(join(dir, f)), `${f} is missing after unzipping`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
