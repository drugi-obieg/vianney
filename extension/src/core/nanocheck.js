// A checklist for Chrome's built-in model (Gemini Nano): what has to be true for it to be downloaded and to run, which of these things the browser can
// show by itself, and which Chrome page shows the rest. Pure functions, no browser APIs, so that the settings page and the website use the same words
// and the same tests cover them (the website gets a copy of this file: tools/make-site-data.mjs).
//
// Where the facts come from. [live] was measured on Chromium 158.0.8127.88 (Linux Mint) on 2026-11-28; [source] was read in the Chromium source at that
// tag and in Chrome's documentation (developer.chrome.com/docs/ai/), see plan.md section 3.3; the two are told apart where it matters.
//
// What the facts are not. A page or an extension cannot read Chrome's own diagnostics page (chrome://on-device-internals), the "On-device AI" setting, the
// policies or the video memory. So the checklist does two things: it measures what can be measured (the browser's name and version, what the API answers,
// the reason that Chrome gives when the model cannot be started, the free disk space of the profile) and for the rest it names the page and the line to read.

const GiB = 1024 ** 3;

export const REQUIRE = Object.freeze({
  extensionChrome: 138,        // the Prompt API in extensions [docs]
  pageChrome: 148,             // ... and in web pages [docs]
  installFree: 20 * GiB,       // [live] chrome://on-device-internals: "Enough disk space to install: ... 20480 MiB required" (the documentation says 22 GB)
  keepFree: 5 * GiB,           // [live] "Enough disk space to retain: ... 5120 MiB required" (the documentation says the model goes below 10 GB)
  cores: 4,                    // without a graphics chip [docs]
  ramGB: 16,                   // without a graphics chip [docs]
  vramGB: 4,                   // with one: more than this [docs]
});

/** "44 GiB", "19.6 GiB": binary units, as Chrome's own page counts (it shows MiB). One decimal below 25 GiB, so that 19.6 is not shown as 20, the line Chrome draws. */
export function gib(bytes) {
  return `${(bytes / GiB).toFixed(bytes >= 25 * GiB ? 0 : 1)} GiB`;
}

// ------------------------------------------------------------------ the pages of Chrome that the guide sends the user to
// [live] each of these opened from an extension with chrome.tabs.create (Chromium 158). A web page cannot open any of them: the browser blocks the
// navigation, for a link, window.open and location alike; so the website asks the extension to do it (background/service-worker.js), or copies the address.
export const PAGES = Object.freeze({
  chromeUrls: { url: 'chrome://chrome-urls', label: 'Open chrome://chrome-urls' },
  internals: { url: 'chrome://on-device-internals', label: 'Open on-device internals' },
  aiSettings: { url: 'chrome://settings/ai', label: 'Open AI settings' },
  components: { url: 'chrome://components', label: 'Open components' },
  policy: { url: 'chrome://management/policy', label: 'Open policies' },
  version: { url: 'chrome://version', label: 'Open chrome://version' },
  extensions: { url: 'chrome://extensions', label: 'Open chrome://extensions' },
});

// [live] the flags of Chromium 158 are #prompt-api, #prompt-api-multimodal-input, #prompt-api-tool-use, #prompt-api-sampling-mode and #gemma4-for-built-in-ai;
// the older #prompt-api-for-gemini-nano and #optimization-guide-on-device-model are not there. [source] The older names, and what they did, from Chrome's code
// of the time. None is needed on a current Chrome (the Prompt API is on by default since 138 for extensions): a flag is listed for the versions that have it.
export const FLAGS = Object.freeze([
  { id: 'prompt-api', from: 151, name: 'Prompt API', value: 'Default', why: 'The Prompt API itself. It is on by default: change it only if it was switched off on this computer.' },
  { id: 'prompt-api-multimodal-input', from: 151, name: 'Prompt API Multimodal Input', value: 'Default', why: 'Lets the model take pictures and sound, for the experimental Images & Audio checks. On by default.' },
  { id: 'prompt-api-for-gemini-nano', until: 150, name: 'Prompt API for Gemini Nano', value: 'Enabled', why: 'Chrome 138 to 150, the Prompt API under its old name. Extensions did not need it; web pages did, before Chrome 148.' },
  { id: 'prompt-api-for-gemini-nano-multimodal-input', until: 150, name: 'Prompt API for Gemini Nano with Multimodal Input', value: 'Enabled', why: 'Chrome 138 to 150: pictures and sound.' },
  { id: 'optimization-guide-on-device-model', until: 153, name: 'Enables optimization guide on device', value: 'Enabled BypassPerfRequirement', why: 'Chrome 138 to 153: skips the check of the graphics chip and the memory. Removed in Chrome 154, where Chrome decides alone.' },
]);

/** The flags that exist in a Chrome of this version. */
export function flagsFor(version) {
  if (!version) return [];
  return FLAGS.filter((f) => (f.from == null || version >= f.from) && (f.until == null || version <= f.until));
}

/** Every address that the guide may ask for, and that the extension is willing to open for the website: nothing else is. */
export function openable(url) {
  const u = String(url || '');
  if (Object.values(PAGES).some((p) => p.url === u)) return true;
  const m = /^chrome:\/\/flags\/#([a-z0-9-]+)$/.exec(u);
  return !!m && FLAGS.some((f) => f.id === m[1]);
}

export const flagUrl = (id) => `chrome://flags/#${id}`;

// The lines of chrome://on-device-internals (Broker State) that tell why the model does not come, in the order of the page. [live] the wording of the lines,
// [source] what each one means.
export const DIAGNOSTIC_LINES = Object.freeze([
  { line: 'Enabled by feature flag', want: 'true', otherwise: 'This build of the browser has the model switched off in its code. In Chromium that cannot be changed: use Google Chrome.' },
  { line: 'Enabled by enterprise policy', want: 'true', otherwise: 'A policy (GenAILocalFoundationalModelSettings) forbids it. chrome://management/policy shows which.' },
  { line: 'Enabled by user setting', want: 'true', otherwise: 'Turn on “On-device AI” in chrome://settings/ai. That switch exists only in Google Chrome, so in Chromium this line stays false.' },
  { line: 'Device performance class', want: 'anything but “GPU blocked”', otherwise: 'Chrome found no graphics chip it may use. Update the graphics driver, or use a computer with 16 GB of memory and 4 cores.' },
  { line: 'Enough disk space to install', want: 'true (20480 MiB required)', otherwise: 'Free up disk space on the drive that holds the browser profile. Chrome does not start the download, and does not say so anywhere else.' },
  { line: 'Enough disk space to retain', want: 'true (5120 MiB required)', otherwise: 'Chrome removes the model when free space falls below this.' },
  { line: 'Assets: State, Progress, Error', want: 'Installed', otherwise: 'Error says why a download failed. “Not Installed” although disk space is enough: restart the browser and check chrome://components.' },
  { line: 'Use Cases, prompt_api: Unavailable Reason', want: 'empty', otherwise: '“Not Supported”: one of the lines above is false. “Pending Assets”: the model is still downloading. “Pending Usage”: nothing has asked for it yet, so press Download.' },
]);

// ------------------------------------------------------------------ what the browser is
/**
 * @param {{brands?: {brand: string, version: string}[], ua?: string}} f
 * @returns {{name: string, version: number|null, google: boolean}} name: 'Google Chrome' | 'Chromium' | 'Microsoft Edge' | 'Brave' | 'Opera' | 'Vivaldi' |
 *   'Firefox' | 'Safari' | 'unknown'
 */
export function browserOf({ brands = [], ua = '' } = {}) {
  const find = (n) => brands.find((b) => b.brand === n);
  const num = (b) => (b ? parseInt(b.version, 10) || null : null);
  for (const name of ['Google Chrome', 'Microsoft Edge', 'Brave', 'Opera', 'Vivaldi', 'Chromium']) {
    const b = find(name);
    if (b) return { name, version: num(b), google: name === 'Google Chrome' };
  }
  const gecko = /Firefox\/(\d+)/.exec(ua);
  if (gecko) return { name: 'Firefox', version: Number(gecko[1]), google: false };
  if (/Version\/[\d.]+.*Safari\//.test(ua) && !/Chrom(e|ium)\//.test(ua)) return { name: 'Safari', version: null, google: false };
  const blink = /Chrom(?:e|ium)\/(\d+)/.exec(ua);
  return { name: 'unknown', version: blink ? Number(blink[1]) : null, google: false };
}

// ------------------------------------------------------------------ the reason that Chrome gives
/**
 * What a message of Chrome's own says, in a word. The messages are those of LanguageModel.create() when the model cannot be started.
 * [live] "The feature flag gating model execution was disabled."  [source] "The device does not have enough space for downloading the on-device model.",
 * "The device is not eligible for running on-device model.", "Model execution for this feature was not enabled.", "On-device AI is disabled in Chrome settings".
 * @returns {'feature'|'disk'|'device'|'setting'|'policy'|'not-enabled'|'other'|null}
 */
export function reasonKind(reason) {
  const m = reason && (reason.message || '');
  if (!m) return null;
  if (/feature flag/i.test(m)) return 'feature';
  if (/enough space|disk/i.test(m)) return 'disk';
  if (/not eligible|performance|graphics|gpu/i.test(m)) return 'device';
  if (/chrome settings|user setting|setting/i.test(m)) return 'setting';
  if (/polic/i.test(m)) return 'policy';
  if (/not enabled/i.test(m)) return 'not-enabled';
  return 'other';
}

// ------------------------------------------------------------------ the checklist
const link = (page, extra = {}) => ({ label: page.label, url: page.url, kind: 'chrome', ...extra });
const web = (label, url) => ({ label, url, kind: 'web' });
const step = (id, status, title, detail, links = [], more = {}) => ({ id, status, title, detail, links, ...more });

const KINDS = [['text', 'Text'], ['image', 'Images'], ['audio', 'Audio']];

/**
 * @param {object} f what is known (every part may be missing)
 * @param {'extension'|'page'} [f.where] where the checks ran: an extension page sees more than a web page
 * @param {{brand: string, version: string}[]} [f.brands] navigator.userAgentData.brands
 * @param {string} [f.ua] navigator.userAgent
 * @param {string} [f.platform] navigator.userAgentData.platform ('Linux', 'macOS', 'Windows', 'Chrome OS', 'Android', ...)
 * @param {boolean} [f.mobile]
 * @param {boolean} [f.hasApi] LanguageModel exists
 * @param {{text?: string, image?: string, audio?: string}} [f.availability] what LanguageModel.availability() said, per kind of input
 * @param {{text?: {name: string, message: string}|null, image?: object|null, audio?: object|null}} [f.reason] what LanguageModel.create() threw, where it was tried
 * @param {number|null} [f.freeBytes] free disk space of the profile, where it could be measured
 * @param {number} [f.cores]
 * @param {{description?: string, vendor?: string, architecture?: string}|null} [f.gpu] a graphics adapter the browser may use, or null
 * @returns {{steps: object[], verdict: {tone: 'ok'|'todo'|'busy'|'no'|'unknown', title: string, text: string}, next: string|null, browser: object}}
 */
export function checklist(f = {}) {
  const b = browserOf(f);
  const v = b.version;
  const where = f.where === 'extension' ? 'extension' : 'page';
  const av = f.availability || {};
  const reasons = f.reason || {};
  const textReason = reasons.text || null;
  const kind = reasonKind(textReason);
  const unavailable = av.text === 'unavailable';
  const steps = [];

  // 1. the browser
  const phone = f.mobile || /Android|iOS|iPhone|iPad/.test(f.platform || '');
  if (phone) {
    steps.push(step('browser', 'fail', 'A computer', 'Chrome\'s model runs on Windows, macOS, Linux and Chromebook Plus, not on phones and tablets.'));
  } else if (b.name === 'Google Chrome') {
    if (v && v < REQUIRE.extensionChrome) steps.push(step('browser', 'fail', `Google Chrome ${v}`, `Too old: the model needs Chrome ${REQUIRE.extensionChrome} or newer. Update Chrome.`, [link(PAGES.version)]));
    else steps.push(step('browser', 'ok', `Google Chrome${v ? ' ' + v : ''}`, 'This is the browser that has Chrome\'s model.', [link(PAGES.version, { label: 'Open chrome://version' })]));
  } else if (b.name === 'Chromium') {
    steps.push(step('browser', 'fail', `Chromium${v ? ' ' + v : ''}, not Google Chrome`,
      'Chrome\'s model is part of Google Chrome only. Chromium builds, including the ones that Linux distributions ship, leave it out: no setting, flag or free disk space brings it back. '
      + (textReason ? `Chromium says: “${textReason.message}”` : 'Install Google Chrome to use it.'),
      [web('Get Google Chrome', 'https://www.google.com/chrome/'), link(PAGES.version)], { blocking: true }));
  } else if (b.name === 'Microsoft Edge') {
    steps.push(step('browser', 'warn', `Microsoft Edge${v ? ' ' + v : ''}`, 'Edge has its own built-in model behind a similar interface, and its own flag. This guide was written for Google Chrome, so what follows may not apply.'));
  } else if (b.name === 'Firefox' || b.name === 'Safari') {
    steps.push(step('browser', 'fail', b.name, `${b.name} has no built-in model. Vianney still works: its word lists and the local model Kev-0.6B need no Chrome.`, [], { blocking: true }));
  } else {
    steps.push(step('browser', 'warn', b.name === 'unknown' ? 'A browser that is not Google Chrome' : b.name, 'Only Google Chrome is known to have Chrome\'s model. Other browsers built on Chromium may leave it out.', [web('Get Google Chrome', 'https://www.google.com/chrome/')]));
  }

  // 2. the interface
  if (f.hasApi === false) {
    const page = where === 'page' && v && v < REQUIRE.pageChrome;
    steps.push(step('api', page ? 'warn' : 'fail', 'The Prompt API (LanguageModel)',
      page ? `A web page gets the interface from Chrome ${REQUIRE.pageChrome}; this is Chrome ${v}. The extension has it from Chrome ${REQUIRE.extensionChrome}: open the settings of the extension to check.`
        : `This browser does not offer it. Chrome has had it for extensions since ${REQUIRE.extensionChrome}.`));
  } else if (f.hasApi) {
    steps.push(step('api', 'ok', 'The Prompt API (LanguageModel)', `Present in this ${where === 'extension' ? 'extension' : 'page'}. That does not mean that the model is there: the next steps do.`));
  }

  // 3. the switch in Chrome's settings
  if (av.text === 'available') steps.push(step('setting', 'ok', '“On-device AI” is on', 'Chrome has the model and runs it.'));
  else if (kind === 'setting') steps.push(step('setting', 'fail', '“On-device AI” is off', `Chrome says: “${textReason.message}”. Turn it on in AI settings.`, [link(PAGES.aiSettings, { primary: true })], { blocking: true }));
  else steps.push(step('setting', b.name === 'Chromium' ? 'info' : 'unknown', '“On-device AI” is on',
    'Chrome has a switch for this in its AI settings (Google Chrome only). When it is off, Chrome never downloads the model. A page cannot read the switch: look at it, or at the line “Enabled by user setting” on the diagnostics page.',
    [link(PAGES.aiSettings)]));

  // 4. the disk
  const free = typeof f.freeBytes === 'number' && f.freeBytes >= 0 ? f.freeBytes : null;
  if (free !== null) {
    if (free >= REQUIRE.installFree) {
      steps.push(step('disk', 'ok', `${gib(free)} free on the disk of this browser profile`, `Enough: Chrome starts the download with ${gib(REQUIRE.installFree)} free (its documentation says 22 GB) and removes the model when less than ${gib(REQUIRE.keepFree)} is left.`));
    } else {
      const stuck = av.text === 'downloadable' || av.text === 'downloading';
      steps.push(step('disk', 'fail', `${gib(free)} free: too little`,
        `Chrome starts the download only with ${gib(REQUIRE.installFree)} free on the drive of the browser profile. `
        + (stuck ? 'That is why nothing downloads: Chrome does not say so, it simply waits. ' : '')
        + 'Free up space, or start the browser with its profile on a bigger drive (--user-data-dir).', [], { blocking: true }));
    }
  } else if (kind === 'disk') {
    steps.push(step('disk', 'fail', 'Too little free disk space', `Chrome says: “${textReason.message}” It needs ${gib(REQUIRE.installFree)} free on the drive of the browser profile.`, [link(PAGES.internals)], { blocking: true }));
  } else {
    steps.push(step('disk', 'unknown', `At least ${gib(REQUIRE.installFree)} free on the disk of the profile`,
      'A web page cannot read free disk space; the settings of the extension can. Or read the line “Enough disk space to install” on the diagnostics page.', [link(PAGES.internals)]));
  }

  // 5. the computer
  {
    const cores = f.cores || 0;
    if (f.gpu) {
      const name = [f.gpu.vendor, f.gpu.architecture, f.gpu.description].filter(Boolean).join(' ') || 'a graphics adapter';
      steps.push(step('hardware', 'unknown', `Graphics: ${name}`, `Chrome wants more than ${REQUIRE.vramGB} GB of video memory, which a page cannot read. The line “Device performance class” on the diagnostics page says whether Chrome accepts this computer; “GPU blocked” means that it does not.`));
    } else if (cores && cores < REQUIRE.cores) {
      steps.push(step('hardware', 'fail', `${cores} processor threads, no graphics chip`, `Without a graphics chip Chrome needs ${REQUIRE.cores} cores and ${REQUIRE.ramGB} GB of memory.`, [], { blocking: true }));
    } else {
      steps.push(step('hardware', 'warn', 'No graphics chip found', `Without one Chrome needs ${REQUIRE.cores} cores and ${REQUIRE.ramGB} GB of memory, and cannot take sound. A page sees at most 8 GB, so the memory cannot be checked here.`));
    }
  }

  // 6. the policies
  steps.push(step('policy', kind === 'policy' ? 'fail' : 'info', 'No policy forbids it',
    'On a managed computer, the policy GenAILocalFoundationalModelSettings can forbid the model (and delete it), and ComponentUpdatesEnabled = false stops the download.', [link(PAGES.policy)]));

  // 7. what Chrome says now, for each kind of input
  const rows = KINDS.filter(([k]) => av[k] !== undefined);
  if (rows.length) {
    const word = { available: 'Ready', downloadable: 'Not downloaded yet', downloading: 'Downloading', unavailable: 'Unavailable', unsupported: 'Not supported' };
    // text, pictures and sound often fail for the same reason: one line for each answer, not three
    const groups = new Map();
    for (const [k, label] of rows) {
      const a = av[k];
      const why = a === 'unavailable' && reasons[k] && reasons[k].message ? reasons[k].message : '';
      const key = `${a}|${why}`;
      if (!groups.has(key)) groups.set(key, { a, why, labels: [] });
      groups.get(key).labels.push(label);
    }
    const lines = [...groups.values()].map((g) => `${g.labels.join(', ')}: ${word[g.a] || g.a}${g.why ? ` (“${g.why}”)` : ''}`);
    const t = av.text;
    const status = t === 'available' ? 'ok' : t === 'downloadable' ? 'todo' : t === 'downloading' ? 'busy' : 'fail';
    const title = t === 'available' ? 'Chrome\'s model is ready' : t === 'downloadable' ? 'Chrome\'s model is not downloaded yet' : t === 'downloading' ? 'Chrome\'s model is downloading' : 'Chrome says the model is unavailable';
    const detail = t === 'downloadable' ? `${lines.join('. ')}. Press “Download Gemini Nano” above; Chrome allows it only as the answer to a click.`
      : t === 'downloading' ? `${lines.join('. ')}. If it does not move for minutes, see “Disk space” and the diagnostics page: Chrome waits silently when something is missing.`
        : `${lines.join('. ')}.`;
    steps.push(step('state', status, title, detail, [], { blocking: t === 'unavailable' || t === 'unsupported' }));
  }

  // 8. the flags (a list for this version of Chrome)
  {
    const list = flagsFor(v);
    if (v && v >= 154) {
      steps.push(step('flags', 'ok', `No flag has to be changed in Chrome ${v}`,
        'The Prompt API is on by default, and the flags that used to switch it on are gone. These two exist and are fine at “Default”; open one only to see that nobody has set it to “Disabled”.',
        list.map((fl) => link({ url: flagUrl(fl.id), label: `#${fl.id}` }, { note: fl.value }))));
    } else if (list.length) {
      steps.push(step('flags', 'info', `Flags in Chrome ${v}`, 'These exist in this version of Chrome. Set each one to the value shown, then restart Chrome.',
        list.map((fl) => link({ url: flagUrl(fl.id), label: `#${fl.id}` }, { note: fl.value, why: fl.why }))));
    } else {
      steps.push(step('flags', 'info', 'Flags', 'The flags depend on the version of Chrome, which is not known here. In Chrome 154 and newer none has to be changed.', []));
    }
  }

  // 9. where Chrome says why
  steps.push(step('internals', 'info', 'Read Chrome\'s own reason',
    'Chrome has a page that lists, line by line, why the model is or is not there. Since Chrome 158 it is hidden at first: open chrome://chrome-urls and press “Enable internal debugging pages”, then open on-device internals and read the lines under “Broker State”.',
    [link(PAGES.chromeUrls, { label: '1. Enable internal pages' }), link(PAGES.internals, { label: '2. Open on-device internals', primary: true })], { lines: DIAGNOSTIC_LINES }));

  // 10. the files of the model
  steps.push(step('components', 'info', 'Look for an update of the model\'s manifest',
    'chrome://components lists “Optimization Guide On DeviceModels Manifest”. Press “Check for update” next to it, then restart the browser: that is what starts a download that is waiting for a newer manifest.', [link(PAGES.components)]));

  // the first thing to do
  const next = (steps.find((s) => s.blocking && (s.status === 'fail')) || steps.find((s) => s.status === 'fail') || steps.find((s) => s.status === 'todo') || {}).id || null;

  // one sentence on top
  let verdict;
  const blocked = steps.find((s) => s.blocking && s.status === 'fail');
  if (av.text === 'available') verdict = { tone: 'ok', title: 'Chrome\'s model is ready', text: 'Chrome has the model and Vianney can ask it.' };
  else if (b.name === 'Chromium' && unavailable) verdict = { tone: 'no', title: 'This browser cannot run Chrome\'s model', text: 'It is Chromium, not Google Chrome. Install Google Chrome to test the model; Vianney works here with its word lists and Kev-0.6B.' };
  else if (blocked) verdict = { tone: 'no', title: blocked.title, text: blocked.detail };
  else if (av.text === 'downloadable') verdict = { tone: 'todo', title: 'The model can be downloaded', text: 'Nothing stands in the way that can be measured here. Press “Download Gemini Nano”.' };
  else if (av.text === 'downloading') verdict = { tone: 'busy', title: 'The model is downloading', text: 'Check again in a while. If it does not move, see the steps below.' };
  else if (unavailable || f.hasApi === false) verdict = { tone: 'no', title: 'Chrome says the model is unavailable', text: textReason ? `Chrome says: “${textReason.message}”` : 'Read the steps below, then Chrome\'s own reason on the diagnostics page.' };
  else verdict = { tone: 'unknown', title: 'Not checked yet', text: 'Press “Run the checks”.' };

  return { steps, verdict, next, browser: b };
}

/** The checks as plain text, for pasting into a bug report. */
export function reportText(f, result = checklist(f)) {
  const mark = { ok: '[ok]  ', fail: '[FAIL]', warn: '[warn]', todo: '[todo]', busy: '[wait]', info: '[info]', unknown: '[?]   ' };
  const lines = [`Vianney: Chrome's model, checked from ${f.where === 'extension' ? 'the extension' : 'a web page'}`, `Browser: ${result.browser.name}${result.browser.version ? ' ' + result.browser.version : ''} on ${f.platform || 'an unknown system'}`];
  lines.push(`Result: ${result.verdict.title}`);
  for (const s of result.steps) lines.push(`${mark[s.status] || '[?]'} ${s.title}: ${s.detail}`);
  return lines.join('\n');
}
