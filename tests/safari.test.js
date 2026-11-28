import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

// The Safari extension is made on a Mac (Apple's tool exists nowhere else), so what can be checked here is the text of the script and of the workflow that runs it:
// that the script says what the tool needs, and that the workflow follows the rules of this repository for workflows (it is public).
const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const script = read('tools/safari.sh');
const raw = read('.github/workflows/safari.yml');
const code = raw.split('\n').map((l) => l.replace(/^\s*#.*$/, '').replace(/\s+#.*$/, '')).join('\n');
const [head] = code.split(/\njobs:\n/);

test('the script is valid shell, executable, stops at the first error and refuses to run anywhere but on a Mac', () => {
  execFileSync('bash', ['-n', new URL('tools/safari.sh', root).pathname]);
  assert.ok(statSync(new URL('tools/safari.sh', root)).mode & 0o100, 'executable');
  assert.match(script, /^set -euo pipefail$/m);
  assert.match(script, /\[ "\$\(uname\)" != "Darwin" \]/);
  assert.match(script, /exit 2/);
});

test('the script gives the packager what it needs for an iPhone app that is complete in itself', () => {
  assert.match(script, /xcrun safari-web-extension-packager dist\/safari/, 'from the build that tools/build.mjs makes');
  for (const flag of ['--project-location', '--app-name', '--bundle-identifier', '--swift', '--ios-only', '--copy-resources', '--no-open', '--no-prompt', '--force']) assert.ok(script.includes(flag), flag);
  assert.match(script, /node tools\/build\.mjs safari/);
  assert.match(script, /CODE_SIGNING_ALLOWED=NO/, 'the build for the Simulator signs nothing');
  assert.match(script, /generic\/platform=iOS Simulator/);
  assert.match(script, /BUNDLE_ID:-[\w.]+/, 'the identifier is the reader\'s to change');
});

test('the workflow runs by hand only, can only read the repository, uses no secret, and pins every action to a commit', () => {
  assert.match(head, /\non:\n  workflow_dispatch:\n/);
  for (const trigger of ['push', 'pull_request', 'pull_request_target', 'workflow_run', 'issue_comment', 'issues', 'fork', 'release', 'schedule']) assert.ok(!new RegExp(`^  ${trigger}:`, 'm').test(head), `no trigger ${trigger}`);
  assert.match(head, /\npermissions:\n  contents: read\n/);
  assert.ok(!/:\s*write\b/.test(code));
  assert.ok(!/secrets\./.test(code), 'no secret');
  const uses = [...raw.matchAll(/^\s*(?:- )?uses:\s*(\S+)(.*)$/gm)];
  assert.equal(uses.length, 3, "checkout, node, upload");
  for (const [, action, rest] of uses) {
    assert.match(action, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, `${action} is pinned to a commit`);
    assert.match(rest, /#\s*v\d+\.\d+\.\d+/, `${action}: the comment names the release`);
  }
  assert.equal([...code.matchAll(/actions\/checkout@/g)].length, [...code.matchAll(/persist-credentials: false/g)].length, 'a checkout leaves no credentials behind');
  assert.match(code, /runs-on: macos-/, 'it needs a Mac');
});

test('the workflow runs the tests, then the script that builds the project, and keeps what it made', () => {
  assert.ok(code.indexOf('npm test') < code.indexOf('tools/safari.sh --build'), 'tests first');
  assert.match(code, /path: dist\/safari-xcode/, 'the folder that the script writes');
  assert.match(script, /OUT=dist\/safari-xcode/);
  assert.match(code, /retention-days: 7/);
});
