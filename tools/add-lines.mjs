// Adds `spared:` (a title the rule must leave alone) or `example:` (a title it must flag) lines to a rule of the shipped rule files, so that the owner's real titles
// can be given in one go: they become examples for the model (core/shots.js), test cases of the rule tests and of the check on the rule examples.
// Usage: node tools/add-lines.mjs <rule id> spared|example <file with one title per line>   (or "-" for standard input)
// A line that is already there is skipped. The lines go after the last `spared:` / `example:` line of the rule, in the order given.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const FILES = ['extension/rules/vianney.en.rules', 'extension/rules/vianney.media.en.rules'];

export function addLines(text, ruleId, kind, titles) {
  const lines = text.split('\n');
  const head = lines.findIndex((l) => l.trim() === `rule ${ruleId}` || l.startsWith(`rule ${ruleId} `));
  if (head < 0) return null;
  let end = lines.length;
  for (let i = head + 1; i < lines.length; i++) if (/^rule\s/.test(lines[i])) { end = i; break; }
  const block = lines.slice(head, end);
  const have = new Set(block.map((l) => l.match(/^\s+(?:example|spared):\s*(.*?)\s*$/)).filter(Boolean).map((m) => m[1]));
  const fresh = [];
  for (const t of titles.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean)) if (!have.has(t) && !fresh.includes(t)) fresh.push(t);
  if (!fresh.length) return { text, added: [] };
  let at = -1;
  block.forEach((l, i) => { if (/^\s+(?:example|spared):/.test(l)) at = i; });
  if (at < 0) at = block.findIndex((l) => /^\s+(?:group|plain|name):/.test(l));
  if (at < 0) at = 0;
  const add = fresh.map((t) => `  ${kind}: ${t}`);
  block.splice(at + 1, 0, ...add);
  lines.splice(head, end - head, ...block);
  return { text: lines.join('\n'), added: fresh };
}

if (import.meta.main) {
  const [ruleId, kind, file] = process.argv.slice(2);
  if (!ruleId || !['spared', 'example'].includes(kind) || !file) { console.error('usage: node tools/add-lines.mjs <rule id> spared|example <file|->'); process.exit(2); }
  const titles = readFileSync(file === '-' ? 0 : file, 'utf8').split('\n');
  for (const f of FILES) {
    const url = new URL(f, root);
    const r = addLines(readFileSync(url, 'utf8'), ruleId, kind, titles);
    if (!r) continue;
    writeFileSync(url, r.text);
    console.log(`${ruleId}: ${r.added.length} ${kind} line(s) added to ${f}${r.added.length ? '' : ' (all of them were there already)'}`);
    for (const t of r.added) console.log(`  + ${t}`);
    process.exit(0);
  }
  console.error(`no rule "${ruleId}"`);
  process.exit(1);
}
