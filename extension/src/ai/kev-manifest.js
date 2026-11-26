// Kev-0.6B, the local decision model: what it is, where it comes from and the exact bytes that are accepted.
//
// Everything here was checked against Hugging Face on 2026-11-26 (tools/check-kev-manifest.mjs repeats the check):
//  - the commit, the sizes and the SHA-256 of the two large files come from the API (`?blobs=true`, `lfs.sha256`);
//  - the SHA-256 of every file was computed again from a full download of that file (not only copied from the API);
//  - the delimiter ids and the limits are the `kev` section of the pinned config.json.
// The weights are DATA: nothing in these files is code that the browser runs. The runtime that reads them (Transformers.js and the
// ONNX Runtime WASM files) is vendored in extension/vendor/ (see vendor/README.md), never downloaded.

const MODEL_REPO = 'onnx-community/kev-0.6b-ONNX';
const COMMIT = '5a827091b3d58fe4fdfc02a5a5b2ce364047d678';

/** Needed by both sets: the model's own settings and the tokenizer. */
const COMMON = [
  { path: 'config.json', size: 2267, sha256: '40ce1c875acf016ab7742ecdc45d3bad0fe8c51d3ead0ca2263ec5eb4e96f42d' },
  { path: 'tokenizer_config.json', size: 9678, sha256: '3c04ed3ca964ea2f6b2b5faf0dc4d31aec1cb1e8b4bcf63f402d295046b422b5' },
  { path: 'tokenizer.json', size: 7031645, sha256: 'c0382117ea329cdf097041132f6d735924b697924d6f6fc3945713e96ce87539' },
];

/**
 * The two weight sets. Only one of them is needed on a computer.
 *  - q4f16: 4-bit weights, the rest of the graph in half precision. For WebGPU with the `shader-f16` feature.
 *  - q4:    4-bit weights, the rest in single precision. For WebAssembly (and WebGPU without `shader-f16`).
 * The graph file is small and names its data file, which holds all the weights ("external data").
 */
const SETS = {
  q4f16: {
    id: 'q4f16',
    label: 'WebGPU, half precision',
    files: [
      { path: 'onnx/model_q4f16.onnx', size: 3338522, sha256: '26e059ddd954efd9897772b098db10b9eeda9b873984dc1c73b32a9ce177c7c8' },
      { path: 'onnx/model_q4f16.onnx_data', size: 335357952, sha256: '777335dbc052e2e02ec7591f6eefcfb29e2c28caf52075e492d226fc27e0824b' },
    ],
  },
  q4: {
    id: 'q4',
    label: 'WebAssembly, 4-bit',
    files: [
      { path: 'onnx/model_q4.onnx', size: 1245327, sha256: 'db4657bb2f14f073cb4d289260dfc50af31adc1260a04cb2fe17c4f03da0881a' },
      { path: 'onnx/model_q4.onnx_data', size: 374822912, sha256: '20668ed757f5de294c254cab111910fbc37fb11addca8189e3f58b3c695f90f1' },
    ],
  },
};

export const KEV = Object.freeze({
  name: 'Kev-0.6B',
  repo: MODEL_REPO,
  commit: COMMIT,
  baseModel: 'Qwen/Qwen3-0.6B-Base',
  license: 'Apache-2.0',
  language: 'en',
  /** Where the files are fetched from. Only a test build with debug switched on may name another base (see downloadUrl). */
  host: 'https://huggingface.co',
  /** Host permissions asked for at the click on "Download": the page, and the CDN that the page redirects to. */
  hostPermissions: ['https://huggingface.co/*', 'https://*.hf.co/*'],
  common: COMMON,
  sets: SETS,

  // ---- how the graph is fed (the `kev` section of the pinned config.json)
  delimiters: Object.freeze({ state: 151659, question: 151660, optionStart: 151648, optionEnd: 151649, decide: 151661 }),
  delimiterTokens: Object.freeze({ state: '<|fim_prefix|>', question: '<|fim_middle|>', optionStart: '<|box_start|>', optionEnd: '<|box_end|>', decide: '<|fim_suffix|>' }),
  /** The state (the text that is judged) is cut to this many tokens. The model was trained on states of at most 384 tokens (`trained_max_state_tokens`); longer ones run but are untested. */
  maxStateTokens: 384,
  /** The state plus the delimiter plus the longest question (instruction, options, delimiters) may not exceed this: `trained_max_branch_tokens` is 1024. */
  maxLength: 1024,
  /** The graph accepts 8,192 tokens (config.json `max_state_tokens`), but attention memory grows with the square of the length. */
  graphMaxTokens: 8192,
  maxOptions: 255,
  noulOptions: Object.freeze(['no', 'yes']),

  // ---- the vendored runtime, relative to the extension folder
  runtime: Object.freeze({
    transformers: 'vendor/transformers/transformers.min.js',
    // WebGPU: the "asyncify" build. WebAssembly on the processor: the plain build (the asyncify one has no processor kernel for GatherBlockQuantized).
    ortModule: 'vendor/ort/ort-wasm-simd-threaded.asyncify.mjs',
    ortWasm: 'vendor/ort/ort-wasm-simd-threaded.asyncify.wasm',
    ortPlainModule: 'vendor/ort/ort-wasm-simd-threaded.mjs',
    ortPlainWasm: 'vendor/ort/ort-wasm-simd-threaded.wasm',
  }),
});

/** The files to download for a set: the common ones first, then the graph, the big data file last. */
export function filesFor(setId) {
  const set = SETS[setId];
  if (!set) throw new Error(`no such Kev file set: ${setId}`);
  return [...COMMON, ...set.files];
}

export function totalBytes(setId) {
  return filesFor(setId).reduce((n, f) => n + f.size, 0);
}

/** The data file of a set (the one that holds the weights) and its graph. */
export function graphFile(setId) {
  return SETS[setId].files[0];
}

export function dataFile(setId) {
  return SETS[setId].files[1];
}

/**
 * Which files this computer needs, from what a page can ask of the graphics adapter.
 * @param {{webgpu?: boolean, f16?: boolean}} gpu `webgpu`: an adapter was found; `f16`: it has the `shader-f16` feature
 * @returns {{set: 'q4f16'|'q4', device: 'webgpu'|'wasm'}}
 */
export function chooseSet(gpu) {
  const webgpu = !!(gpu && gpu.webgpu);
  return { set: webgpu && gpu.f16 ? 'q4f16' : 'q4', device: webgpu ? 'webgpu' : 'wasm' };
}

/** "346 MB": decimal megabytes, as download sizes are quoted. */
export function megabytes(bytes) {
  return `${Math.round(bytes / 1e6)} MB`;
}

/**
 * The address of one pinned file. The commit is part of the address, so a later change of the repository changes nothing here.
 * `base` replaces the host and the repository path: it is for the test build only.
 */
export function downloadUrl(path, base) {
  if (base) return `${String(base).replace(/\/+$/, '')}/${path}`;
  return `${KEV.host}/${KEV.repo}/resolve/${KEV.commit}/${path}`;
}

/** Where the files live in the extension's private file system (OPFS): one folder per pinned commit, so a new pin never mixes with old files. */
export const STORE_DIR = 'kev-0.6b';
export function storeDirFor() {
  return `${STORE_DIR}-${KEV.commit.slice(0, 8)}`;
}
