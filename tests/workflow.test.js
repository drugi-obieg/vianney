import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

// .github/workflows/deploy.yml puts the website on Cloudflare with a token in a secret, and this repository is public. A workflow is code that anybody can read and that
// runs with the secrets of the repository, so what keeps the secrets safe is checked here, in the text of the file (there is no YAML parser in this project, and the file is
// written so that these lines can be read as they are), together with the agreement between the workflow, the site's address and the manifest of the extension.
const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const raw = read('.github/workflows/deploy.yml');
const code = raw.split('\n').map((l) => l.replace(/^\s*#.*$/, '').replace(/\s+#.*$/, '')).join('\n');   // the file without its comments
const [head, jobsPart] = code.split(/\njobs:\n/);
const jobs = Object.fromEntries([...jobsPart.matchAll(/^  ([a-z]+):\n([\s\S]*?)(?=^  [a-z]+:\n|(?![\s\S]))/gm)].map((m) => [m[1], m[2]]));
const config = read('_config.yml');
const manifest = JSON.parse(read('extension/manifest.json'));
const script = read('tools/cloudflare-pages.sh');

test('it runs for a push to main and by hand, and for nothing a stranger can start', () => {
  assert.match(head, /\non:\n  push:\n    branches: \[main\]\n  workflow_dispatch:\n/);
  for (const trigger of ['pull_request', 'pull_request_target', 'workflow_run', 'issue_comment', 'issues', 'fork', 'release', 'schedule']) {
    assert.ok(!new RegExp(`^  ${trigger}:`, 'm').test(head), `no trigger ${trigger}`);
  }
  assert.deepEqual(Object.keys(jobs), ['test', 'deploy']);
});

test('the token of the workflow can read the repository and nothing else', () => {
  assert.match(head, /\npermissions:\n  contents: read\n/);
  assert.ok(!/:\s*write\b/.test(code), 'no permission to write anywhere');
  assert.ok(!/\bpermissions:/.test(jobsPart), 'no job asks for more than the top of the file gives');
});

test('every action is pinned to a commit, with the release in a comment', () => {
  const uses = [...raw.matchAll(/^\s*(?:- )?uses:\s*(\S+)(.*)$/gm)];
  assert.ok(uses.length >= 4);
  for (const [, action, rest] of uses) {
    assert.match(action, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, `${action} is pinned to a commit`);
    assert.match(rest, /#\s*v\d+\.\d+\.\d+/, `${action}: the comment names the release`);
  }
  assert.equal([...code.matchAll(/actions\/checkout@/g)].length, [...code.matchAll(/persist-credentials: false/g)].length, 'a checkout leaves no credentials behind');
});

test('the two secrets are used by the steps that need them, and by no other', () => {
  const names = new Set([...code.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]));
  assert.deepEqual([...names].sort(), ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN']);
  assert.ok(!head.includes('secrets.'), 'not in the environment of the whole workflow');
  assert.ok(!jobs.test.includes('secrets.'), 'the job that runs the repository\'s tests has no secret');
  assert.ok(!/^    env:/m.test(jobs.deploy), 'not in the environment of the whole job either');
  // every step that has a secret is one of the four that talk to Cloudflare
  const steps = jobs.deploy.split(/\n      - name: /).slice(1);
  const withSecret = steps.filter((s) => s.includes('secrets.')).map((s) => s.split('\n')[0]);
  assert.deepEqual(withSecret, ['Make sure the Pages project exists', 'Upload the site', 'Custom domains and DNS records', 'Check the live site']);
  assert.ok(!steps.find((s) => s.startsWith('Build the site')).includes('secrets.'), 'the build, which reads the repository\'s files, has none');
  assert.ok(!/echo\s.*\$\{\{\s*secrets/.test(code), 'and none is printed');
});

test('the deployment waits for the tests, belongs to the environment "production" and uploads the branch the project is set to', () => {
  assert.match(jobs.deploy, /needs: test/);
  assert.match(jobs.deploy, /environment:\n      name: production/);
  assert.match(jobs.test, /run: npm test/);
  assert.match(head, /\n  CF_BRANCH: main\n/);
  assert.match(code, /--branch=\$\{\{ env\.CF_BRANCH \}\}/);
  assert.match(code, /--project-name=\$\{\{ env\.CF_PROJECT \}\}/);
  assert.match(code, /wranglerVersion: "\d+\.\d+\.\d+"/, 'wrangler is pinned to a version');
});

test('the workflow, the address of the site and the manifest name the same domains', () => {
  const domains = head.match(/\n  CF_DOMAINS: (.+)\n/)[1].split(' ');
  const zone = head.match(/\n  CF_ZONE: (\S+)\n/)[1];
  assert.deepEqual(domains, [zone, `www.${zone}`], 'the apex and www');
  assert.equal(config.match(/^url: "(.*)"$/m)[1], `https://${zone}`, '_config.yml: the site is at the apex');
  assert.match(config, /^baseurl: ""$/m, 'and at the root of it');
  const open = manifest.web_accessible_resources.find((r) => r.resources.includes('src/options/options.html'));
  assert.deepEqual(open.matches, domains.map((d) => `https://${d}/*`), 'the settings page opens for the site, on both of its names, and for nobody else');
  assert.match(code, /url: https:\/\/vianney\.cc\n/);
});

test('the script has every command the workflow calls, and the build folder is not committed', () => {
  assert.ok(statSync(new URL('tools/cloudflare-pages.sh', root)).mode & 0o111, 'executable');
  const called = [...code.matchAll(/tools\/cloudflare-pages\.sh (\w+)/g)].map((m) => m[1]);
  assert.deepEqual(called, ['build', 'project', 'domains', 'check']);
  for (const c of called) assert.match(script, new RegExp(`^  ${c}\\) ${c} ;;$`, 'm'), `the script has ${c}`);
  assert.match(read('.gitignore'), /^_site\/$/m);
  for (const dir of ['tools', 'tests', 'extension']) assert.match(config, new RegExp(`^  - ${dir}$`, 'm'), `${dir}/ is not part of the website`);
});

test('the script prints nothing that a public log must not have', () => {
  assert.ok(!/set -x|set -o xtrace/.test(script), 'no trace, which would print the token in the headers');
  assert.ok(!/echo[^\n]*(CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID)/.test(script), 'neither the token nor the account id is echoed');
  assert.ok(!/cat "\$BODY"|jq \. "\$BODY"/.test(script), 'an answer of the API is never printed whole: it names the account');
});
