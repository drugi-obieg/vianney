// Zip the extension folder: dist/vianney-content-blocker-<version>.zip
//
// The files of the extension sit at the ROOT of the zip (manifest.json is an entry named exactly "manifest.json").
// That is what Chrome requires when someone drops the zip onto chrome://extensions: its zip installer unzips only an
// entry called "manifest.json" first, and answers "Could not unzip extension for install." when there is none (as
// happens when everything is inside a wrapper folder). Release 0.2.0 had a wrapper folder and failed that way.
// Unzipping with Finder or Windows Explorer still gives one folder, named after the zip; on Linux use `unzip -d <folder>`.
//
// Needs the `zip` and `unzip` commands (present on macOS and most Linux systems). Run: npm run pack
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

/** The names of the entries in a zip, as `unzip -Z1` lists them (directories end with a slash). */
export function zipEntries(zipPath) {
  return execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).split('\n').filter(Boolean);
}

/** What Chrome's zip installer needs: an entry named exactly "manifest.json", and nothing wrapped in a folder. */
export function checkZipLayout(entries) {
  if (!entries.includes('manifest.json')) throw new Error('the zip has no entry named manifest.json at its root (Chrome would say "Could not unzip extension for install.")');
  const top = new Set(entries.map((e) => e.split('/')[0]));
  if (top.size === 1 && !top.has('manifest.json')) throw new Error(`everything is inside one folder (${[...top][0]}/)`);
}

export function pack() {
  const manifest = JSON.parse(readFileSync(resolve(root, 'extension/manifest.json'), 'utf8'));
  const name = `vianney-content-blocker-${manifest.version}`;
  const stage = resolve(root, 'dist/stage');
  const out = resolve(root, `dist/${name}.zip`);
  rmSync(stage, { recursive: true, force: true });
  rmSync(out, { force: true });
  mkdirSync(stage, { recursive: true });
  cpSync(resolve(root, 'extension'), stage, { recursive: true, filter: (p) => !p.endsWith('.DS_Store') });
  execFileSync('zip', ['-r', '-q', '-X', out, '.'], { cwd: stage, stdio: 'inherit' }); // the contents, not the folder
  rmSync(stage, { recursive: true, force: true });
  checkZipLayout(zipEntries(out));
  return { out, name, version: manifest.version };
}

if (import.meta.main) console.log('wrote', pack().out);
