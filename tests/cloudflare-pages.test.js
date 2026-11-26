import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFile, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// tools/cloudflare-pages.sh keeps the Cloudflare side of the website in place: the Pages project, its custom domains, the DNS records, and a check of the live site.
// The real API cannot be used in a test (it needs a token and changes an account), so these tests run the real script against a stand-in server on this computer that
// answers in the shape of Cloudflare's API (the paths, the parameters and the fields are those of Cloudflare's OpenAPI schema, api-schemas/openapi.json): the project, the
// domains of a project (with the status that moves from "pending" to "active"), the zones and the DNS records of a zone. The stand-in keeps a log of every request, so that
// what the script does NOT do (a second run changes nothing; no record is ever deleted) can be checked as well.
const SCRIPT = new URL('../tools/cloudflare-pages.sh', import.meta.url).pathname;
const TOKEN = 'cfut_test_0123456789abcdefghijklmnopqrstuvwxyz';
const ACCOUNT = 'e'.repeat(32);
const ACCOUNT_NAME = "Somebody's Account";
const ZONE_ID = 'z'.repeat(32);

const tools = ['bash', 'curl', 'jq'].filter((t) => spawnSync('sh', ['-c', `command -v ${t}`]).status !== 0);
const skip = tools.length ? `needs ${tools.join(', ')}` : false;

const envelope = (result, extra = {}) => ({ success: true, errors: [], messages: [], result, ...extra });
const failure = (code, message) => ({ success: false, errors: [{ code, message }], messages: [], result: null });

/** A stand-in for the parts of the Cloudflare API that the script uses. */
function cloudflare({ project = null, records = [], zone = true, subdomain = 'vianney.pages.dev', activateAfter = 2, token = TOKEN } = {}) {
  const state = {
    project: project && { name: 'vianney', production_branch: 'main', subdomain, ...project },
    domains: [],
    records: records.map((r, i) => ({ id: `r${i}`, proxied: false, ttl: 1, ...r })),
    log: [],
    polls: {},
  };
  let next = records.length;
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const url = new URL(req.url, 'http://stand-in');
      const path = url.pathname;
      const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
      state.log.push(`${req.method} ${path}`);
      if (req.headers.authorization !== `Bearer ${token}`) return send(403, failure(10000, 'Authentication error'));
      const data = raw ? JSON.parse(raw) : {};
      const pages = `/accounts/${ACCOUNT}/pages/projects`;
      let m;
      if (path === pages && req.method === 'POST') {
        if (!data.name || !data.production_branch) return send(400, failure(8000000, 'name and production_branch are required'));
        state.project = { name: data.name, production_branch: data.production_branch, subdomain };
        return send(200, envelope(state.project));
      }
      if (path === `${pages}/vianney` && req.method === 'GET') {
        return state.project ? send(200, envelope(state.project)) : send(404, failure(8000007, 'Project not found. The specified project name does not match any of your existing projects.'));
      }
      if (path === `${pages}/vianney/domains` && req.method === 'GET') {
        for (const d of state.domains) {
          state.polls[d.name] = (state.polls[d.name] || 0) + 1;
          const pointed = state.records.some((r) => r.type === 'CNAME' && r.name === d.name && r.content === subdomain);
          d.status = pointed && state.polls[d.name] >= activateAfter ? 'active' : 'pending';
        }
        return send(200, envelope(state.domains, { result_info: { page: 1, per_page: 25, count: state.domains.length, total_count: state.domains.length } }));
      }
      if (path === `${pages}/vianney/domains` && req.method === 'POST') {
        if (state.domains.some((d) => d.name === data.name)) return send(409, failure(8000018, 'The domain is already added.'));
        const d = { id: `d${state.domains.length}`, name: data.name, status: 'pending', validation_data: { status: 'pending' }, verification_data: { status: 'pending' } };
        state.domains.push(d);
        return send(200, envelope(d));
      }
      if (path === '/zones' && req.method === 'GET') {
        const found = zone && url.searchParams.get('name') === 'vianney.cc' ? [{ id: ZONE_ID, name: 'vianney.cc', status: 'active', account: { id: ACCOUNT, name: ACCOUNT_NAME } }] : [];
        return send(200, envelope(found, { result_info: { page: 1, per_page: 20, count: found.length, total_count: found.length } }));
      }
      if (path === `/zones/${ZONE_ID}/dns_records` && req.method === 'GET') {
        const name = url.searchParams.get('name');
        return send(200, envelope(state.records.filter((r) => !name || r.name === name)));
      }
      if (path === `/zones/${ZONE_ID}/dns_records` && req.method === 'POST') {
        if (state.records.some((r) => r.name === data.name && ['A', 'AAAA', 'CNAME'].includes(r.type))) return send(400, failure(81053, 'An A, AAAA, or CNAME record with that host already exists.'));
        const r = { id: `r${next++}`, ...data };
        state.records.push(r);
        return send(200, envelope(r));
      }
      if ((m = path.match(new RegExp(`^/zones/${ZONE_ID}/dns_records/(r\\d+)$`))) && req.method === 'PATCH') {
        const r = state.records.find((x) => x.id === m[1]);
        if (!r) return send(404, failure(81044, 'Record does not exist.'));
        Object.assign(r, data);
        return send(200, envelope(r));
      }
      return send(404, failure(7003, `no route for ${req.method} ${path}`));
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ state, port: server.address().port, close: () => server.close() })));
}

function run(command, api, extra = {}) {
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    CLOUDFLARE_API_TOKEN: TOKEN,
    CLOUDFLARE_ACCOUNT_ID: ACCOUNT,
    CF_PROJECT: 'vianney',
    CF_ZONE: 'vianney.cc',
    CF_DOMAINS: 'vianney.cc www.vianney.cc',
    CF_BRANCH: 'main',
    CF_API: api ? `http://127.0.0.1:${api.port}` : 'http://127.0.0.1:9',
    CF_POLL_SECONDS: '0.2',
    CF_WAIT_SECONDS: '8',
    ...extra,
  };
  return new Promise((resolve) => {
    execFile('bash', [SCRIPT, command], { env, timeout: 60000 }, (error, stdout, stderr) => resolve({ code: error ? error.code : 0, out: stdout + stderr }));
  });
}

const writes = (api) => api.state.log.filter((l) => !l.startsWith('GET '));
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

test('project: creates the Pages project when there is none, and a second run changes nothing', { skip }, async () => {
  const api = await cloudflare();
  try {
    let r = await run('project', api);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /created the Pages project vianney \(production branch main\)/);
    assert.equal(api.state.project.production_branch, 'main');
    assert.deepEqual(writes(api), [`POST /accounts/${ACCOUNT}/pages/projects`]);
    api.state.log.length = 0;
    r = await run('project', api);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /the Pages project vianney exists/);
    assert.deepEqual(writes(api), [], 'nothing is written the second time');
  } finally { api.close(); }
});

test('project: stops when the project has another production branch than the one that is deployed', { skip }, async () => {
  const api = await cloudflare({ project: { production_branch: 'master' } });
  try {
    const r = await run('project', api);
    assert.notEqual(r.code, 0);
    assert.match(r.out, /production branch, but the deploy names main/);
    assert.deepEqual(writes(api), []);
  } finally { api.close(); }
});

test('domains: attaches both domains and points them at the address Cloudflare gave the project, then waits until they are active', { skip }, async () => {
  const api = await cloudflare({ project: {}, subdomain: 'vianney-4kq.pages.dev' });
  try {
    const r = await run('domains', api);
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(api.state.domains.map((d) => [d.name, d.status]), [['vianney.cc', 'active'], ['www.vianney.cc', 'active']]);
    const cnames = api.state.records.filter((x) => x.type === 'CNAME');
    assert.deepEqual(cnames.map((x) => [x.name, x.content, x.proxied, x.ttl]), [
      ['vianney.cc', 'vianney-4kq.pages.dev', true, 1],
      ['www.vianney.cc', 'vianney-4kq.pages.dev', true, 1],
    ], 'the target is what the API said (not a guess from the project name), proxied, automatic TTL');
    assert.match(r.out, /every custom domain is active/);
    assert.ok(!writes(api).some((l) => l.startsWith('DELETE')), 'nothing is deleted');
    assert.ok(!r.out.includes(TOKEN) && !r.out.includes(ACCOUNT_NAME) && !r.out.includes(ACCOUNT), 'the log (public, for a public repository) names neither the token nor the account');
  } finally { api.close(); }
});

test('domains: a second run changes nothing', { skip }, async () => {
  const api = await cloudflare({ project: {} });
  try {
    assert.equal((await run('domains', api)).code, 0);
    api.state.log.length = 0;
    const r = await run('domains', api);
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(writes(api), [], r.out);
    assert.match(r.out, /vianney\.cc: CNAME to vianney\.pages\.dev is in place/);
  } finally { api.close(); }
});

test('domains: a record of the right kind that points elsewhere on Pages is changed, one that points anywhere else is left alone', { skip }, async () => {
  let api = await cloudflare({ project: {}, records: [{ type: 'CNAME', name: 'vianney.cc', content: 'old-project.pages.dev', proxied: false }] });
  try {
    const r = await run('domains', api);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /vianney\.cc: CNAME changed from old-project\.pages\.dev to vianney\.pages\.dev/);
    assert.ok(writes(api).some((l) => l.startsWith('PATCH ')));
    assert.deepEqual(api.state.records.find((x) => x.name === 'vianney.cc').proxied, true);
  } finally { api.close(); }
  api = await cloudflare({ project: {}, records: [{ type: 'CNAME', name: 'www.vianney.cc', content: 'parking.example.net' }] });
  try {
    const r = await run('domains', api);
    assert.notEqual(r.code, 0);
    assert.match(r.out, /www\.vianney\.cc is a CNAME to parking\.example\.net, which is not a Cloudflare Pages address: it is left as it is/);
    assert.equal(api.state.records.find((x) => x.name === 'www.vianney.cc').content, 'parking.example.net');
    assert.ok(!writes(api).some((l) => l.startsWith('PATCH ') || l.startsWith('DELETE ')));
  } finally { api.close(); }
});

test('domains: an A record at the name stops the script, which never deletes a record', { skip }, async () => {
  const api = await cloudflare({ project: {}, records: [{ type: 'A', name: 'vianney.cc', content: '192.0.2.10' }] });
  try {
    const r = await run('domains', api);
    assert.notEqual(r.code, 0);
    assert.match(r.out, /vianney\.cc has an A or AAAA record/);
    assert.equal(api.state.records.length, 1, 'the record is still there');
    assert.ok(!api.state.log.some((l) => l.startsWith('DELETE ')));
    assert.ok(!api.state.log.some((l) => l.startsWith('POST /zones')), 'and no record was added beside it');
  } finally { api.close(); }
});

test('domains: a TXT or MX record at the apex does not get in the way (Cloudflare flattens the CNAME there)', { skip }, async () => {
  const api = await cloudflare({ project: {}, records: [{ type: 'TXT', name: 'vianney.cc', content: '"v=spf1 -all"' }, { type: 'MX', name: 'vianney.cc', content: 'mail.example.net', priority: 10 }] });
  try {
    const r = await run('domains', api);
    assert.equal(r.code, 0, r.out);
    assert.equal(api.state.records.filter((x) => x.type === 'CNAME').length, 2);
    assert.equal(api.state.records.filter((x) => x.type === 'TXT' || x.type === 'MX').length, 2, 'the others are untouched');
  } finally { api.close(); }
});

test('domains: the domain must be in the account, and a token that Cloudflare refuses is reported without being printed', { skip }, async () => {
  let api = await cloudflare({ project: {}, zone: false });
  try {
    const r = await run('domains', api);
    assert.notEqual(r.code, 0);
    assert.match(r.out, /the token sees no zone named vianney\.cc/);
  } finally { api.close(); }
  api = await cloudflare({ project: {} });
  try {
    const r = await run('domains', api, { CLOUDFLARE_API_TOKEN: 'cfut_wrong_token_value' });
    assert.notEqual(r.code, 0);
    assert.match(r.out, /HTTP 403\): 10000: Authentication error/);
    assert.ok(!r.out.includes('cfut_wrong_token_value'));
    assert.deepEqual(writes(api), []);
  } finally { api.close(); }
});

test('domains: a zone id given in the environment is used without reading zones (a token without Zone: Read)', { skip }, async () => {
  const api = await cloudflare({ project: {} });
  try {
    const r = await run('domains', api, { CF_ZONE_ID: ZONE_ID });
    assert.equal(r.code, 0, r.out);
    assert.ok(!api.state.log.some((l) => l.startsWith('GET /zones?') || l === 'GET /zones'), 'no zone lookup');
  } finally { api.close(); }
});

test('domains: stops with a message when a domain stays pending', { skip }, async () => {
  const api = await cloudflare({ project: {}, activateAfter: Infinity });
  try {
    const r = await run('domains', api, { CF_WAIT_SECONDS: '1' });
    assert.notEqual(r.code, 0);
    assert.match(r.out, /not active after 1 s: vianney\.cc=pending www\.vianney\.cc=pending/);
    assert.match(r.out, /run the workflow again later/);
  } finally { api.close(); }
});

// ---- the built site and the live site ------------------------------------------------------------------------------------------------------------

function builtSite({ tamper = '' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'vianney-site-'));
  mkdirSync(join(dir, 'downloads'), { recursive: true });
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Vianney</title>');
  const zip = Buffer.from('PK pretend zip ' + 'x'.repeat(5000));
  const latest = { version: '9.9.9', file: 'vianney-content-blocker-9.9.9.zip', latest: 'vianney-content-blocker-latest.zip', bytes: zip.length, sha256: tamper === 'sha' ? sha(Buffer.from('other')) : sha(zip) };
  writeFileSync(join(dir, 'downloads', latest.file), zip);
  writeFileSync(join(dir, 'downloads', latest.latest), zip);
  writeFileSync(join(dir, 'downloads', 'latest.json'), JSON.stringify(latest, null, 2) + '\n');
  if (tamper === 'big') { writeFileSync(join(dir, 'downloads', 'huge.bin'), ''); truncateSync(join(dir, 'downloads', 'huge.bin'), 26 * 1024 * 1024); }
  return { dir, zip, latestJson: join(dir, 'downloads', 'latest.json'), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('build: a site whose download and checksum agree passes', { skip }, async () => {
  const site = builtSite();
  try {
    const r = await run('build', null, { SITE_DIR: site.dir });
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /the site: 4 files, download vianney-content-blocker-9\.9\.9\.zip \(\d+ bytes, SHA-256 matches\)/);
  } finally { site.cleanup(); }
});

test('build: refuses a site whose checksum is not the file\'s, and a file above the limit of Cloudflare Pages', { skip }, async () => {
  let site = builtSite({ tamper: 'sha' });
  try {
    const r = await run('build', null, { SITE_DIR: site.dir });
    assert.notEqual(r.code, 0);
    assert.match(r.out, /does not have the SHA-256 that downloads\/latest\.json states: run npm run release/);
  } finally { site.cleanup(); }
  site = builtSite({ tamper: 'big' });
  try {
    const r = await run('build', null, { SITE_DIR: site.dir });
    assert.notEqual(r.code, 0);
    assert.match(r.out, /refuses files above 25 MiB/);
  } finally { site.cleanup(); }
  const r = await run('build', null, { SITE_DIR: join(tmpdir(), 'no-such-site-folder') });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /was not built/);
});

/** A stand-in for the live site: serves what `files` maps paths to. */
function liveSite(files) {
  const server = http.createServer((req, res) => {
    const body = files[req.url.split('?')[0]];
    if (body === undefined) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200); res.end(body);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ host: `127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

test('check: passes when the live site is the build, on every host', { skip }, async () => {
  const site = builtSite();
  const live = await liveSite({ '/': '<html>', '/downloads/latest.json': readFileSync(site.latestJson), '/downloads/vianney-content-blocker-latest.zip': site.zip });
  try {
    const r = await run('check', null, { SITE_DIR: site.dir, CF_CHECK_HOSTS: live.host, CF_SCHEME: 'http', CF_WAIT_SECONDS: '3' });
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /the live site is the new build/);
  } finally { live.close(); site.cleanup(); }
});

test('check: fails, after waiting, when the live site still serves the previous build or its zip is not the one in latest.json', { skip }, async () => {
  const site = builtSite();
  let live = await liveSite({ '/': '<html>', '/downloads/latest.json': '{"version":"9.9.8"}\n', '/downloads/vianney-content-blocker-latest.zip': site.zip });
  try {
    const r = await run('check', null, { SITE_DIR: site.dir, CF_CHECK_HOSTS: live.host, CF_SCHEME: 'http', CF_WAIT_SECONDS: '1' });
    assert.notEqual(r.code, 0);
    assert.match(r.out, /downloads\/latest\.json is not the one just built/);
    assert.match(r.out, /the live site is not the new build after 1 s/);
  } finally { live.close(); }
  live = await liveSite({ '/': '<html>', '/downloads/latest.json': readFileSync(site.latestJson), '/downloads/vianney-content-blocker-latest.zip': Buffer.from('an older zip') });
  try {
    const r = await run('check', null, { SITE_DIR: site.dir, CF_CHECK_HOSTS: live.host, CF_SCHEME: 'http', CF_WAIT_SECONDS: '1' });
    assert.notEqual(r.code, 0);
    assert.match(r.out, /has not the SHA-256 that latest\.json states/);
  } finally { live.close(); site.cleanup(); }
});
