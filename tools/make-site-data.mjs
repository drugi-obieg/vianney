// Writes _data/rules.json for the website from the real rule files: how many rules there are, and one rule shown in its own format on the
// Features page (its name, the word list it looks in, a title it must not flag, its sensitivity and its action). The numbers on the site come
// from here, and tests/site.test.js checks that the file still matches the rules. Run: node tools/make-site-data.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { parseRules } from '../extension/src/core/rules.js';

const root = new URL('../', import.meta.url);
const SAMPLE = 'divination';           // the rule the Features page shows: its examples are mild, and it has all the parts

export function siteRules() {
  const text = ['vianney.en.rules', 'vianney.media.en.rules'].map((f) => readFileSync(new URL(`extension/rules/${f}`, root), 'utf8')).join('\n\n');
  const { rules, errors } = parseRules(text);
  if (errors.length) throw new Error('the rule files have errors: ' + JSON.stringify(errors[0]));
  const rule = rules.find((r) => r.id === SAMPLE);
  if (!rule) throw new Error(`no rule ${SAMPLE}`);
  const media = rules.filter((r) => r.where.every((w) => w === 'thumbnail' || w === 'audio'));
  return {
    count: rules.length,
    text: rules.length - media.length,
    media: media.length,
    enabled: rules.filter((r) => r.enabled).length,
    card: {
      id: rule.id,
      lines: [
        ['lexicon', rule.lexicon.join(', ')],
        ['spared', rule.spared[0]],
        ['flag at', rule.flagAtLabel],
        ['action', rule.actionRaw],
      ],
    },
  };
}

if (import.meta.main) {
  const data = siteRules();
  writeFileSync(new URL('_data/rules.json', root), JSON.stringify(data, null, 2) + '\n');
  console.log(`_data/rules.json: ${data.count} rules (${data.text} text, ${data.media} picture and sound, ${data.enabled} on by default); sample ${data.card.id}`);
}
