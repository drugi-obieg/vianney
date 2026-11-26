// Write extension/src/content/cleanup.css from core/cleanup.js. The manifest loads that file at document_start, so that the extras of the
// page never flash before the content script has started; every rule in it waits for the attribute that early.js sets on <html>.
// Run: node tools/make-cleanup-css.mjs   (tests/cleanup.test.js fails when the file is out of date)
import { writeFileSync } from 'node:fs';
import { CLEANUP_CSS } from '../extension/src/core/cleanup.js';

export const HEADER = '/* Generated from src/core/cleanup.js by tools/make-cleanup-css.mjs: do not edit by hand. Every rule waits for the attribute data-vianney-clean on <html> (set by early.js and content/cleanup.js). */\n';
if (import.meta.main) {
  writeFileSync(new URL('../extension/src/content/cleanup.css', import.meta.url), HEADER + CLEANUP_CSS + '\n');
  console.log('wrote extension/src/content/cleanup.css');
}
