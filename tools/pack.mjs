// Zip the extension folder: dist/vianney-content-blocker-<version>.zip
// The zip holds ONE top-level folder (vianney-content-blocker-<version>/), so that unzipping it never
// scatters files, and "Load unpacked" can be pointed at that folder.
// Needs the `zip` command (present on macOS and most Linux systems). Run: npm run pack
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

export function pack() {
  const manifest = JSON.parse(readFileSync(resolve(root, 'extension/manifest.json'), 'utf8'));
  const name = `vianney-content-blocker-${manifest.version}`;
  const stage = resolve(root, 'dist/stage');
  const out = resolve(root, `dist/${name}.zip`);
  rmSync(stage, { recursive: true, force: true });
  rmSync(out, { force: true });
  mkdirSync(stage, { recursive: true });
  cpSync(resolve(root, 'extension'), resolve(stage, name), { recursive: true, filter: (p) => !p.endsWith('.DS_Store') });
  execFileSync('zip', ['-r', '-q', '-X', out, name], { cwd: stage, stdio: 'inherit' });
  rmSync(stage, { recursive: true, force: true });
  return { out, name, version: manifest.version };
}

if (import.meta.main) console.log('wrote', pack().out);
