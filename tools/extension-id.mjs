// The ID of the extension, derived from the public "key" in manifest.json (the first 128 bits of the SHA-256 of the key, with the hex digits 0-f
// written as the letters a-p). It is what the website links to: _data/extension.yml. Run: node tools/extension-id.mjs
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function extensionId(manifestText) {
  const key = JSON.parse(manifestText).key;
  if (!key) throw new Error('manifest.json has no "key"');
  const hex = createHash('sha256').update(Buffer.from(key, 'base64')).digest('hex').slice(0, 32);
  return [...hex].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
}

if (import.meta.main) console.log(extensionId(readFileSync(new URL('../extension/manifest.json', import.meta.url), 'utf8')));
