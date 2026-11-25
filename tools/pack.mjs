// Zip the extension folder for download: dist/vianney-content-blocker-<version>.zip
// Needs the `zip` command (present on macOS and most Linux systems). Run: npm run pack
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'extension/manifest.json'), 'utf8'));
mkdirSync(resolve(root, 'dist'), { recursive: true });
const out = resolve(root, `dist/vianney-content-blocker-${manifest.version}.zip`);
rmSync(out, { force: true });
execFileSync('zip', ['-r', '-q', '-X', out, '.', '-x', '*.DS_Store'], { cwd: resolve(root, 'extension'), stdio: 'inherit' });
console.log('wrote', out);
