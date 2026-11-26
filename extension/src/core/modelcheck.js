// What the settings page tells the user about the on-device model: one row for each thing the model is used for,
// what this computer reports, and what measured timings mean. Pure functions, no browser APIs, so they can be tested.
//
// Two models can answer, layered (plan.md section 4.2): the local model Kev-0.6B, which the extension downloads (extension/src/ai/), and Chrome's
// built-in model (Gemini Nano). Kev is asked first because it runs on every computer; Chrome's model takes a second look when Kev is not sure.
//
// Facts used here for Chrome's model (plan.md section 3.3, from Chrome's documentation):
//  - Chrome's model is behind the Prompt API. The extension does not choose that model, the browser does; text, picture and sound input
//    are asked about separately;
//  - Chrome wants at least 22 GB free on the disk of the profile to start the download, and removes the model again
//    when free space falls below 10 GB; the model is about 4 GB;
//  - it needs a graphics card with more than 4 GB of video memory, or a CPU with at least 16 GB of RAM and 4 cores;
//    sound input needs a graphics card;
//  - a web page cannot read free disk space or video memory, so Chrome's own answer (availability) is the real test,
//    and chrome://on-device-internals shows the reason when it says "unavailable".

import { KEV, chooseSet, megabytes, totalBytes } from '../ai/kev-manifest.js';

// Chrome's model, one row per kind of input. Each row names the model, so that it is clear what is running on the computer.
export const CAPABILITIES = [
  { id: 'text', title: 'Gemini Nano (built into Chrome)', lede: 'Chrome\'s own model. It takes a second look when Kev-0.6B is unsure, and works alone when Kev is not downloaded.', used: 'Lets a rule\'s question decide when its word list cannot.', download: 'Download Gemini Nano' },
  { id: 'image', title: 'Images (experimental)', lede: 'Gemini Nano, built into Chrome. Analyzes thumbnails.', used: 'Analyzes thumbnails.', download: 'Download Gemini Nano for images' },
  { id: 'audio', title: 'Audio (experimental)', lede: 'Gemini Nano, built into Chrome. Analyzes audio while a video plays.', used: 'Analyzes audio while a video plays.', download: 'Download Gemini Nano for audio' },
];

// The local model: first in the list, because it is the first layer and the one that works in every browser that can run WebAssembly.
export const KEV_MODEL = {
  id: 'kev',
  title: 'Kev-0.6B',
  lede: 'Runs on this computer in any browser. Reads titles and comments before you see them.',
  used: 'A small English decision model (Apache-2.0). It answers the rule questions that word lists cannot settle. The files are downloaded once, kept in this browser, and nothing is sent anywhere.',
};

export const DOWNLOAD_NOTE = 'Chrome needs 22 GB of free disk space to start the download and removes the model if free space drops below 10 GB. The model is about 4 GB.';

/**
 * @param {string|undefined} availability what LanguageModel.availability() said, or 'unsupported' / 'error:<name>'
 * @param {'text'|'image'|'audio'} id
 * @returns {{label: string, tone: 'ok'|'todo'|'busy'|'no'|'unknown', canDownload: boolean, explain: string}}
 */
export function statusInfo(availability, id = 'text') {
  switch (availability) {
    case 'available':
      return { label: 'Ready', tone: 'ok', canDownload: false, explain: 'Chrome has the model and can run it.' };
    case 'downloadable':
      return { label: 'Download required', tone: 'todo', canDownload: true, explain: `Not on this computer yet. ${DOWNLOAD_NOTE}` };
    case 'downloading':
      return { label: 'Downloading', tone: 'busy', canDownload: false, explain: 'Downloading now. Check again later.' };
    case 'unavailable': {
      const base = 'Chrome cannot run this on this computer. Common reasons: too little free disk space, too little graphics memory (or under 16 GB of RAM and 4 cores without a graphics card), or a policy that turns the model off. Chrome diagnostics shows which applies.';
      const extra = id === 'audio' ? ' Audio input needs a graphics card.' : id === 'image' ? ' Chrome checks image input separately from text.' : '';
      return { label: 'Unavailable', tone: 'no', canDownload: false, explain: base + extra };
    }
    case 'unsupported':
      return { label: 'Unsupported', tone: 'no', canDownload: false, explain: 'This browser has no built-in model API. Rules use word lists only.' };
    case undefined:
    case null:
    case '':
      return { label: 'Not checked', tone: 'unknown', canDownload: false, explain: 'Press “Check”.' };
    default:
      return { label: 'Check failed', tone: 'unknown', canDownload: false, explain: `Chrome answered: ${String(availability)}.` };
  }
}

const mb = (bytes) => `${Math.round(bytes / 1e6)}`;
const mbps = (bytesPerSecond) => `${(bytesPerSecond / 1e6).toFixed(1)} MB/s`;

/** How the local model runs, in a few words: "WebGPU, q4f16" or "WebAssembly, q4: slow". */
export function kevWay(set, device, gpu) {
  const dev = device || (set === 'q4f16' || (gpu && gpu.webgpu) ? 'webgpu' : 'wasm');
  if (dev === 'webgpu') return `WebGPU, ${set}`;
  return `WebAssembly, ${set}: slow`;
}

/**
 * What the row of the local model shows, from what is known about it. Pure, so that every state can be tested.
 * @param {{gpu?: {webgpu?: boolean, f16?: boolean}|null,
 *          stored?: {set: string, complete: boolean, partial?: boolean, bytesHave: number, bytesTotal: number}|null,
 *          job?: {phase: string, set?: string, done?: number, total?: number, bytesPerSecond?: number, fileIndex?: number, files?: number, error?: {code?: string, message?: string, file?: string}}|null,
 *          runtime?: {state: string, device?: string, set?: string, error?: {message?: string}|null}|null,
 *          confirmDelete?: boolean, note?: string}} s
 * @returns {{id: string, label: string, tone: 'ok'|'todo'|'busy'|'no'|'unknown', title: string, lede: string, facts: string, set: string, size: string,
 *            progress: {fraction: number, text: string}|null, detail: string, note: string, buttons: {id: string, text: string, primary?: boolean}[], explain: string}}
 */
export function kevStatusInfo(s = {}) {
  const job = s.job || { phase: 'idle' };
  const stored = s.stored || null;
  const pick = chooseSet(s.gpu || {});
  const set = job.set || (stored && (stored.complete || stored.partial) ? stored.set : pick.set);
  const total = totalBytes(set);
  const size = megabytes(total);
  const base = {
    title: KEV_MODEL.title, lede: KEV_MODEL.lede, set, size, progress: null, detail: '', note: s.note || '',
    facts: 'Apache-2.0, English only. Stored in this browser; nothing is sent anywhere.',
    explain: `${KEV_MODEL.used} Download size: ${size}${set === 'q4' ? ' (the files for WebAssembly; a computer with WebGPU and half precision needs 346 MB)' : ''}.`,
  };
  const download = { id: 'download', text: `Download Kev-0.6B (${size})`, primary: true };
  const del = s.confirmDelete
    ? [{ id: 'delete-yes', text: `Delete ${mb(stored && stored.bytesHave ? stored.bytesHave : total)} MB` }, { id: 'delete-no', text: 'Keep' }]
    : [{ id: 'delete', text: 'Delete model files' }];

  if (job.phase === 'downloading' || job.phase === 'checking') {
    const tot = job.total || total;
    const done = Math.min(job.done || 0, tot);
    const where = job.files > 1 ? ` · file ${(job.fileIndex || 0) + 1} of ${job.files}` : '';
    const text = job.phase === 'checking'
      ? `Checking what was downloaded before: ${mb(done)} of ${mb(tot)} MB`
      : `${mb(done)} of ${mb(tot)} MB${job.bytesPerSecond > 0 ? ` · ${mbps(job.bytesPerSecond)}` : ''}${where}`;
    return { ...base, id: job.phase === 'checking' ? 'checking' : 'downloading', label: job.phase === 'checking' ? 'Checking' : 'Downloading', tone: 'busy', progress: { fraction: tot ? done / tot : 0, text },
      buttons: [{ id: 'pause', text: 'Pause' }, { id: 'cancel', text: 'Cancel' }] };
  }
  if (job.phase === 'error') {
    const e = job.error || {};
    const where = e.file ? `${e.file}: ` : '';
    return { ...base, id: 'error', label: 'Failed', tone: 'no', note: `${where}${e.message || 'the download stopped'}`, buttons: [{ id: 'retry', text: 'Retry', primary: true }, ...del.slice(0, 1)] };
  }
  if (stored && stored.complete) {
    const rt = s.runtime || null;
    if (rt && rt.state === 'error') {
      return { ...base, id: 'error', label: 'Cannot run', tone: 'no', note: `${(rt.error && rt.error.message) || 'the model could not be started'}`, buttons: del };
    }
    return { ...base, id: 'ready', label: 'Ready', tone: 'ok', detail: kevWay(stored.set, rt && rt.device, s.gpu), buttons: del };
  }
  if (job.phase === 'paused' || (stored && stored.partial)) {
    const have = Math.min(stored ? stored.bytesHave : 0, total);
    return { ...base, id: 'paused', label: 'Paused', tone: 'todo', progress: { fraction: total ? have / total : 0, text: `${mb(have)} of ${mb(total)} MB downloaded` },
      buttons: [{ id: 'download', text: 'Resume', primary: true }, ...(s.confirmDelete ? del : [{ id: 'delete', text: 'Delete what was downloaded' }])] };
  }
  return { ...base, id: 'not-downloaded', label: 'Not downloaded', tone: 'todo', buttons: [download] };
}

/**
 * A few short sentences about what to do next, from the three statuses.
 * @param {{text?: string, image?: string, audio?: string}} s
 * @returns {{tone: string, text: string}[]}
 */
export function recommend(s) {
  const out = [];
  const all = [s.text, s.image, s.audio];
  if (s.kev === 'ready') out.push({ tone: 'ok', text: 'Kev-0.6B is ready. Word lists now ask it when they cannot decide, and Chrome\'s model takes a second look when Kev is unsure.' });
  else if (s.kev === 'not-downloaded') out.push({ tone: 'todo', text: 'Download Kev-0.6B first: it runs on every computer, in any browser, and needs no Chrome model.' });
  else if (s.kev === 'downloading' || s.kev === 'checking') out.push({ tone: 'busy', text: 'Kev-0.6B is downloading. You can leave this page: the download goes on.' });
  if (out.length && all.every((x) => x === undefined || x === null || x === '')) return out;
  if (all.every((x) => x === undefined || x === null || x === '')) return [{ tone: 'unknown', text: 'Press “Check” to see what this computer can run.' }];
  const kevOk = s.kev === 'ready';
  if (s.text === 'unsupported') return out.length ? out : [{ tone: 'no', text: 'This browser has no built-in model. Rules use word lists only.' }];
  if (all.every((x) => x === 'unavailable')) {
    return out.concat([{ tone: 'no', text: kevOk ? 'Chrome will not run its model on this computer; Kev-0.6B answers alone. Chrome diagnostics shows why.' : 'Chrome will not run its model on this computer. Rules use word lists only. Chrome diagnostics shows why.' }]);
  }
  if (s.text === 'downloadable') out.push({ tone: 'todo', text: 'Download the text model first. It powers rule questions and is not experimental.' });
  else if (s.text === 'available') out.push({ tone: 'ok', text: 'Rule questions are ready. Word lists now ask the model when they cannot decide.' });
  else if (s.text === 'unavailable') out.push({ tone: 'no', text: 'Chrome will not run the text model here, so word lists decide alone.' });
  else if (s.text === 'downloading') out.push({ tone: 'busy', text: 'The text model is downloading. Check again later.' });
  if (s.image === 'downloadable' || s.audio === 'downloadable') {
    out.push({ tone: 'todo', text: 'Images and audio are separate downloads. Get them only to try the experimental checks; they are slow and may be wrong.' });
  }
  if (s.image === 'available' || s.audio === 'available') {
    out.push({ tone: 'ok', text: 'Run the benchmark to see how fast it is before enabling Images & Audio.' });
  }
  if (s.audio === 'unavailable' && s.text !== 'unavailable') out.push({ tone: 'no', text: 'Audio analysis is not possible on this computer. Chrome diagnostics may say why.' });
  return out;
}

/**
 * Rows about this computer, from what a page may read.
 * @param {{userAgent?: string, cores?: number, memoryGB?: number, gpu?: {vendor?: string, architecture?: string, description?: string}|null,
 *          quotaBytes?: number, usageBytes?: number, language?: string}} f
 * @returns {{label: string, value: string, note: string}[]}
 */
export function machineRows(f) {
  const rows = [];
  const chrome = /(?:Chrome|Chromium)\/(\d+)/.exec(f.userAgent || '');
  const edge = /Edg\/(\d+)/.exec(f.userAgent || '');
  rows.push({
    label: 'Browser',
    value: edge ? `Edge ${edge[1]}` : chrome ? `Chrome ${chrome[1]}` : (f.userAgent || 'unknown'),
    note: 'The model API needs Chrome 138 or newer.',
  });
  rows.push({
    label: 'Processor threads',
    value: f.cores ? String(f.cores) : 'unknown',
    note: f.cores && f.cores >= 4 ? 'Meets the 4-core minimum for running on the processor.' : 'Running on the processor needs at least 4 cores.',
  });
  rows.push({
    label: 'Memory',
    value: f.memoryGB ? (f.memoryGB >= 8 ? '8 GB or more' : `${f.memoryGB} GB`) : 'unknown',
    note: f.memoryGB && f.memoryGB >= 8
      ? 'Pages see at most 8 GB, so the 16 GB needed to run on the processor cannot be confirmed.'
      : 'Running on the processor needs 16 GB; running on a graphics card does not.',
  });
  const g = f.gpu;
  const kevSet = chooseSet({ webgpu: !!g, f16: !!(g && g.f16) });
  const kevNote = g
    ? (g.f16 ? ` Kev-0.6B runs on the graphics chip here (WebGPU with half precision): ${megabytes(totalBytes(kevSet.set))}.` : ` Kev-0.6B runs on the graphics chip here (WebGPU, no half precision): ${megabytes(totalBytes(kevSet.set))}.`)
    : ` Kev-0.6B runs on the processor here (WebAssembly, slow): ${megabytes(totalBytes(kevSet.set))}.`;
  rows.push({
    label: 'Graphics',
    value: g ? [g.vendor, g.architecture, g.description].filter(Boolean).join(' ') || 'a graphics adapter is present' : 'none found by the browser',
    note: (g
      ? 'Running on a graphics card needs more than 4 GB of video memory, which pages cannot read. Audio input needs a graphics card.'
      : 'Without a graphics card, text and image input need 16 GB of RAM and 4 cores, and audio input is unavailable.') + kevNote,
  });
  if (typeof f.quotaBytes === 'number') {
    rows.push({
      label: 'Disk',
      value: 'Not readable by web pages',
      note: `Chrome needs 22 GB free on the profile's disk to start the download. This extension's storage quota (${gb(f.quotaBytes)}) only hints at the disk size.`,
    });
  }
  return rows;
}

export function gb(bytes) {
  return `${(bytes / 1073741824).toFixed(bytes >= 1073741824 * 10 ? 0 : 1)} GB`;
}

export function median(xs) {
  const a = [...xs].sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** "0.8 s", "12 s", "3 min 05 s" */
export function duration(seconds) {
  if (!Number.isFinite(seconds)) return 'unknown';
  if (seconds < 10) return `${seconds.toFixed(1)} s`;
  if (seconds < 120) return `${Math.round(seconds)} s`;
  const m = Math.floor(seconds / 60);
  return `${m} min ${String(Math.round(seconds - m * 60)).padStart(2, '0')} s`;
}

/**
 * What measured times per prompt mean for the checks, under the user's current settings.
 * @param {{image?: number, frame?: number, audio?: number, text?: number}} perPromptMs median time of one prompt, per kind (undefined when not measured);
 *        `image` is a thumbnail-sized picture, `frame` a small preview frame (falls back to `image`)
 * @param {{votes: number, pictureRules: number, soundRules: number, windowSeconds: number, cardsPerPage?: number}} plan
 * @returns {string[]} sentences
 */
export function estimates(perPromptMs, plan) {
  const out = [];
  const votes = Math.min(3, Math.max(1, plan.votes || 2));
  if (typeof perPromptMs.image === 'number' && plan.pictureRules > 0) {
    const per = perPromptMs.image / 1000;
    const cards = plan.cardsPerPage || 30;
    const total = cards * plan.pictureRules * votes * per;
    out.push(`Thumbnails: ${cards * plan.pictureRules * votes} prompts per page (${cards} cards × ${plan.pictureRules} rule${plan.pictureRules > 1 ? 's' : ''} × ${votes} prompt${votes > 1 ? 's' : ''}), about ${duration(total)} on first load. Results are cached for 30 days.`);
    // video moments: one preview frame every `interval` seconds
    const framePer = (typeof perPromptMs.frame === 'number' ? perPromptMs.frame : perPromptMs.image) / 1000;
    for (const [label, length, interval] of [['3.5-minute video', 213, 2], ['10-minute video', 600, 5], ['One-hour video', 3600, 10]]) {
      const tiles = Math.ceil(length / interval) + 1;
      const needed = tiles * plan.pictureRules * votes * framePer;
      const ratio = needed / length;
      out.push(`${label} (a frame every ${interval} s): ${tiles} frames, ${tiles * plan.pictureRules * votes} prompts, about ${duration(needed)}. ${ratio <= 1 ? `Faster than playback (${duration(length)}).` : `${ratio.toFixed(1)}× slower than playback (${duration(length)}).`}`);
    }
  }
  if (typeof perPromptMs.audio === 'number' && plan.soundRules > 0) {
    const per = perPromptMs.audio / 1000;
    const window = plan.windowSeconds || 8;
    const need = plan.soundRules * votes * per;
    out.push(`Audio: ${plan.soundRules} rule${plan.soundRules > 1 ? 's' : ''} × ${votes} prompt${votes > 1 ? 's' : ''} take about ${duration(need)} per ${window} s clip. ${need <= window ? 'Keeps up with playback.' : `Falls behind (${(need / window).toFixed(1)}× the clip length), so clips are skipped.`}`);
  }
  if (typeof perPromptMs.text === 'number') {
    out.push(`Text: about ${duration(perPromptMs.text / 1000)} per question.`);
  }
  return out;
}
