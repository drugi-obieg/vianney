// Publish a build to the website: zip the extension, copy it to downloads/, and write _data/release.json
// (version, file name, size, SHA-256, date) which the install page reads.
// Run: npm run release   then commit downloads/ and _data/ and push.
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pack } from './pack.mjs';

const root = resolve(import.meta.dirname, '..');
const { out, name, version } = pack();
const bytes = readFileSync(out);
const sha256 = createHash('sha256').update(bytes).digest('hex');

mkdirSync(resolve(root, 'downloads'), { recursive: true });
mkdirSync(resolve(root, '_data'), { recursive: true });
copyFileSync(out, resolve(root, `downloads/${name}.zip`));
copyFileSync(out, resolve(root, 'downloads/vianney-content-blocker-latest.zip'));

const release = {
  version,
  file: `${name}.zip`,
  latest: 'vianney-content-blocker-latest.zip',
  folder: name,
  bytes: statSync(out).size,
  kilobytes: Math.round(statSync(out).size / 1024),
  sha256,
  date: new Date().toISOString().slice(0, 10),
};
writeFileSync(resolve(root, '_data/release.json'), JSON.stringify(release, null, 2) + '\n');
// the same facts as a public file, so people and tools can see what the newest build is
writeFileSync(resolve(root, 'downloads/latest.json'), JSON.stringify(release, null, 2) + '\n');
console.log(`release ${version}: ${release.kilobytes} KB, sha256 ${sha256}`);
