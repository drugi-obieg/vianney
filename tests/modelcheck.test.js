import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAPABILITIES, statusInfo, recommend, machineRows, median, duration, estimates, gb } from '../extension/src/core/modelcheck.js';

test('there are three capabilities, and only a downloadable one offers a download', () => {
  assert.deepEqual(CAPABILITIES.map((c) => c.id), ['text', 'image', 'audio']);
  for (const a of ['available', 'downloadable', 'downloading', 'unavailable', 'unsupported', 'error:NotAllowedError', undefined]) {
    assert.equal(statusInfo(a, 'text').canDownload, a === 'downloadable', a);
  }
});

test('every status has a label, a tone and a plain explanation', () => {
  for (const a of ['available', 'downloadable', 'downloading', 'unavailable', 'unsupported', 'weird', undefined]) {
    const s = statusInfo(a, 'image');
    assert.ok(s.label && s.tone && s.explain, a);
  }
  assert.match(statusInfo('downloadable').explain, /22 GB/);
  assert.match(statusInfo('unavailable', 'audio').explain, /graphics card/);
  assert.doesNotMatch(statusInfo('unavailable', 'text').explain, /graphics card\.$/);
  assert.match(statusInfo('error:NotAllowedError').explain, /NotAllowedError/);
});

test('the recommendation follows the three statuses and never offers what cannot be done', () => {
  assert.match(recommend({})[0].text, /Press “Check”/);
  assert.match(recommend({ text: 'unsupported' })[0].text, /no built-in model/);
  const none = recommend({ text: 'unavailable', image: 'unavailable', audio: 'unavailable' });
  assert.equal(none.length, 1);
  assert.match(none[0].text, /will not run its model/);
  const first = recommend({ text: 'downloadable', image: 'downloadable', audio: 'unavailable' }).map((r) => r.text).join(' | ');
  assert.match(first, /Download the text model first/);
  assert.match(first, /separate downloads/);
  assert.match(first, /Audio analysis is not possible/);
  const ready = recommend({ text: 'available', image: 'available', audio: 'unavailable' }).map((r) => r.text).join(' | ');
  assert.match(ready, /Rule questions are ready/);
  assert.match(ready, /Run the benchmark/);
});

test('machine rows only claim what a page can know', () => {
  const rows = machineRows({ userAgent: 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/158.0.0.0 Safari/537.36', cores: 8, memoryGB: 8, gpu: { vendor: 'apple', architecture: 'metal-3' }, quotaBytes: 5 * 1073741824 });
  const by = Object.fromEntries(rows.map((r) => [r.label, r]));
  assert.equal(by.Browser.value, 'Chrome 158');
  assert.equal(by['Processor threads'].value, '8');
  assert.equal(by.Memory.value, '8 GB or more');
  assert.match(by.Memory.note, /cannot be confirmed/);
  assert.match(by.Graphics.value, /apple/);
  assert.match(by.Graphics.note, /pages cannot read/);
  assert.match(by.Disk.value, /Not readable/);
  assert.match(by.Disk.note, /22 GB/);
  const bare = Object.fromEntries(machineRows({ userAgent: 'x', gpu: null }).map((r) => [r.label, r]));
  assert.match(bare.Graphics.value, /none/);
  assert.match(bare.Graphics.note, /audio input is unavailable/);
  assert.equal(Object.fromEntries(machineRows({ userAgent: 'Mozilla Edg/140.0 Chrome/140.0' }).map((r) => [r.label, r])).Browser.value, 'Edge 140');
});

test('median, duration and gb read naturally', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), null);
  assert.equal(duration(0.84), '0.8 s');
  assert.equal(duration(45.4), '45 s');
  assert.equal(duration(185), '3 min 05 s');
  assert.equal(duration(NaN), 'unknown');
  assert.equal(gb(1.5 * 1073741824), '1.5 GB');
  assert.equal(gb(60 * 1073741824), '60 GB');
});

test('estimates say whether a pre-pass over preview frames could stay ahead of playback', () => {
  const plan = { votes: 2, pictureRules: 2, soundRules: 2, windowSeconds: 8 };
  const fast = estimates({ image: 100, audio: 500 }, plan).join('\n');
  assert.match(fast, /Thumbnails: 120 prompts per page \(30 cards × 2 rules × 2 prompts\), about 12 s/);
  assert.match(fast, /3\.5-minute video \(a frame every 2 s\): 108 frames, 432 prompts, about 43 s\. Faster than playback/);
  assert.match(fast, /Audio: 2 rules × 2 prompts take about 2\.0 s per 8 s clip\. Keeps up with playback/);
  // at 2 s per prompt the short videos cannot be kept up with, but a one-hour video, sampled only every 10 s, still can
  const slow = estimates({ image: 2000, audio: 3000 }, plan).join('\n');
  assert.match(slow, /3\.5-minute video[^\n]*4\.1× slower than playback/);
  assert.match(slow, /10-minute video[^\n]*× slower than playback/);
  assert.match(slow, /One-hour video[^\n]*Faster than playback/);
  assert.match(slow, /Falls behind \(1\.5× the clip length\), so clips are skipped/);
  // at 3 s per prompt not even that
  assert.match(estimates({ image: 3000 }, plan).join('\n'), /One-hour video[^\n]*1\.2× slower than playback/);
  assert.deepEqual(estimates({}, plan), []);
  assert.deepEqual(estimates({ image: 100 }, { ...plan, pictureRules: 0 }), [], 'no picture rule, nothing to estimate');
  assert.match(estimates({ text: 1200 }, plan).join(''), /Text: about 1\.2 s/);
});

// ------------------------------------------------------------------------------------------------ the row of the local model (Kev-0.6B)
import { KEV_MODEL, kevStatusInfo, kevWay } from '../extension/src/core/modelcheck.js';

const GPU = { webgpu: true, f16: true };
const stored = (o = {}) => ({ set: 'q4f16', complete: false, partial: false, bytesHave: 0, bytesTotal: 345740064, ...o });

test('the model rows carry the name of the model: Kev first, then Chrome\'s model, and the picture and sound rows name it too', () => {
  assert.equal(KEV_MODEL.title, 'Kev-0.6B');
  assert.match(KEV_MODEL.lede, /^Runs on this computer in any browser\. Reads titles and comments before you see them\.$/);
  const text = CAPABILITIES.find((c) => c.id === 'text');
  assert.equal(text.title, 'Gemini Nano (built into Chrome)');
  assert.equal(text.download, 'Download Gemini Nano');
  for (const id of ['image', 'audio']) {
    const c = CAPABILITIES.find((x) => x.id === id);
    assert.match(c.lede, /^Gemini Nano/, `${id} names its model in the line under the title`);
    assert.match(c.title, /\(experimental\)$/, 'and keeps its capability title');
  }
});

test('not downloaded: one button with the name and the size of the files this computer needs', () => {
  const half = kevStatusInfo({ gpu: GPU });
  assert.deepEqual([half.id, half.label, half.tone], ['not-downloaded', 'Not downloaded', 'todo']);
  assert.equal(half.size, '346 MB');
  assert.deepEqual(half.buttons, [{ id: 'download', text: 'Download Kev-0.6B (346 MB)', primary: true }]);
  assert.match(half.facts, /Apache-2\.0, English only/);
  assert.match(half.facts, /nothing is sent anywhere/);
  const wasm = kevStatusInfo({ gpu: { webgpu: false } });
  assert.equal(wasm.size, '383 MB');
  assert.equal(wasm.buttons[0].text, 'Download Kev-0.6B (383 MB)');
  assert.equal(kevStatusInfo({ gpu: { webgpu: true, f16: false } }).size, '383 MB', 'WebGPU without half precision needs the 4-bit set');
  assert.equal(kevStatusInfo({}).id, 'not-downloaded', 'nothing known yet');
  assert.equal(half.progress, null);
});

test('downloading: a bar, megabytes done of the total, the speed, and Pause and Cancel', () => {
  const s = kevStatusInfo({ gpu: GPU, job: { phase: 'downloading', set: 'q4f16', done: 123.4e6, total: 345740064, bytesPerSecond: 8.44e6, fileIndex: 3, files: 5 } });
  assert.deepEqual([s.id, s.label, s.tone], ['downloading', 'Downloading', 'busy']);
  assert.equal(s.progress.text, '123 of 346 MB · 8.4 MB/s · file 4 of 5');
  assert.ok(Math.abs(s.progress.fraction - 123.4e6 / 345740064) < 1e-9);
  assert.deepEqual(s.buttons.map((b) => b.id), ['pause', 'cancel']);
  const early = kevStatusInfo({ gpu: GPU, job: { phase: 'downloading', set: 'q4f16', done: 0, total: 345740064, bytesPerSecond: 0 } });
  assert.equal(early.progress.text, '0 of 346 MB', 'no speed before there is one');
  const over = kevStatusInfo({ job: { phase: 'downloading', set: 'q4', done: 1e12, total: 383111829 } });
  assert.equal(over.progress.fraction, 1, 'never beyond the end');
});

test('checking: what was downloaded before is read again, and says so', () => {
  const s = kevStatusInfo({ job: { phase: 'checking', set: 'q4f16', done: 200e6, total: 345740064 } });
  assert.deepEqual([s.id, s.label, s.tone], ['checking', 'Checking', 'busy']);
  assert.match(s.progress.text, /^Checking what was downloaded before: 200 of 346 MB$/);
});

test('paused, and a partial download found on disk: Resume, with what is there, and a way to delete it', () => {
  const s = kevStatusInfo({ gpu: GPU, stored: stored({ partial: true, bytesHave: 150e6 }), job: { phase: 'paused', set: 'q4f16' } });
  assert.deepEqual([s.id, s.label], ['paused', 'Paused']);
  assert.equal(s.progress.text, '150 of 346 MB downloaded');
  assert.deepEqual(s.buttons.map((b) => b.text), ['Resume', 'Delete what was downloaded']);
  assert.equal(s.buttons[0].primary, true);
  const after = kevStatusInfo({ gpu: GPU, stored: stored({ partial: true, bytesHave: 150e6 }) });
  assert.equal(after.id, 'paused', 'the same after the browser was restarted: nothing runs, but a part is on disk');
  const q4 = kevStatusInfo({ gpu: GPU, stored: stored({ set: 'q4', partial: true, bytesHave: 100e6 }) });
  assert.equal(q4.set, 'q4');
  assert.equal(q4.size, '383 MB', 'the set that is partly downloaded stays the one that is shown');
});

test('ready: how it runs, and a delete that needs a second click', () => {
  const half = kevStatusInfo({ gpu: GPU, stored: stored({ complete: true, bytesHave: 345740064 }), runtime: { state: 'ready', device: 'webgpu', set: 'q4f16' } });
  assert.deepEqual([half.id, half.label, half.tone, half.detail], ['ready', 'Ready', 'ok', 'WebGPU, q4f16']);
  assert.deepEqual(half.buttons, [{ id: 'delete', text: 'Delete model files' }]);
  const slow = kevStatusInfo({ gpu: { webgpu: false }, stored: stored({ set: 'q4', complete: true, bytesHave: 383111829 }), runtime: { state: 'ready', device: 'wasm', set: 'q4' } });
  assert.equal(slow.detail, 'WebAssembly, q4: slow');
  const idle = kevStatusInfo({ gpu: GPU, stored: stored({ complete: true }), runtime: null });
  assert.equal(idle.detail, 'WebGPU, q4f16', 'before the first use the way is known from the files and the graphics chip');
  assert.equal(kevStatusInfo({ gpu: { webgpu: false }, stored: stored({ set: 'q4', complete: true }) }).detail, 'WebAssembly, q4: slow');
  assert.equal(kevStatusInfo({ gpu: { webgpu: true, f16: false }, stored: stored({ set: 'q4', complete: true }) }).detail, 'WebGPU, q4');
  const sure = kevStatusInfo({ stored: stored({ complete: true, bytesHave: 345740064 }), confirmDelete: true });
  assert.deepEqual(sure.buttons.map((b) => b.text), ['Delete 346 MB', 'Keep']);
  assert.equal(kevWay('q4', 'wasm'), 'WebAssembly, q4: slow');
});

test('failed: the file and the reason, Retry, and no stray words when the reason is missing', () => {
  const s = kevStatusInfo({ gpu: GPU, stored: stored({ partial: true, bytesHave: 90e6 }), job: { phase: 'error', set: 'q4f16', error: { code: 'hash-mismatch', file: 'onnx/model_q4f16.onnx_data', message: 'the SHA-256 differs from the pin. The file was deleted.' } } });
  assert.deepEqual([s.id, s.label, s.tone], ['error', 'Failed', 'no']);
  assert.equal(s.note, 'onnx/model_q4f16.onnx_data: the SHA-256 differs from the pin. The file was deleted.');
  assert.deepEqual(s.buttons.map((b) => b.id), ['retry', 'delete']);
  assert.equal(kevStatusInfo({ job: { phase: 'error' } }).note, 'the download stopped');
  const cannot = kevStatusInfo({ stored: stored({ complete: true }), runtime: { state: 'error', error: { message: 'the downloaded files need WebGPU with shader-f16' } } });
  assert.deepEqual([cannot.id, cannot.label, cannot.tone], ['error', 'Cannot run', 'no']);
  assert.match(cannot.note, /shader-f16/);
  for (const state of [{}, { job: { phase: 'error' } }, { stored: stored({ complete: true }) }, { job: { phase: 'downloading' } }]) {
    const text = JSON.stringify(kevStatusInfo(state));
    assert.doesNotMatch(text, /undefined|NaN|null"?,"?(label|title)|\[object/, JSON.stringify(state));
  }
});

test('the graphics row says what the local model will do on this computer', () => {
  const rows = (gpu) => Object.fromEntries(machineRows({ userAgent: 'Chrome/158.0', gpu }).map((r) => [r.label, r]));
  assert.match(rows({ vendor: 'apple', f16: true }).Graphics.note, /Kev-0\.6B runs on the graphics chip here \(WebGPU with half precision\): 346 MB/);
  assert.match(rows({ vendor: 'x', f16: false }).Graphics.note, /WebGPU, no half precision\): 383 MB/);
  assert.match(rows(null).Graphics.note, /Kev-0\.6B runs on the processor here \(WebAssembly, slow\): 383 MB/);
  assert.match(rows({ vendor: 'apple', f16: true }).Graphics.note, /pages cannot read/, 'what the page cannot know is still said');
});

test('the advice starts with Kev when it is known, and stays as before when it is not', () => {
  assert.match(recommend({ kev: 'not-downloaded' })[0].text, /Download Kev-0\.6B first/);
  assert.match(recommend({ kev: 'downloading' })[0].text, /the download goes on/);
  assert.match(recommend({ kev: 'ready' })[0].text, /Kev-0\.6B is ready/);
  const both = recommend({ kev: 'not-downloaded', text: 'downloadable', image: 'unavailable', audio: 'unavailable' }).map((r) => r.text).join(' | ');
  assert.match(both, /Download Kev-0\.6B first/);
  assert.match(both, /Download the text model first/);
  const none = recommend({ kev: 'ready', text: 'unavailable', image: 'unavailable', audio: 'unavailable' }).map((r) => r.text).join(' | ');
  assert.match(none, /Kev-0\.6B answers alone/);
  assert.match(recommend({})[0].text, /Press “Check”/);
});
