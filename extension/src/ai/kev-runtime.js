// Kev-0.6B running in the offscreen document: loaded once from the files in OPFS, then asked questions one at a time, unloaded when idle.
//
// What was measured in Chrome 158 on an Apple M2 with 8 GB (research/kev-progress.md, gate B):
//  - under the extension CSP (`wasm-unsafe-eval` only) the vendored runtime loads without a console error;
//  - WebGPU: load 1.9 s, first answer 1.4 s (shader compilation), then about 120 ms per question; the weights are in GPU memory (about 0.7 GB);
//  - WebAssembly on the processor (the plain ONNX Runtime build; the WebGPU build lacks a processor kernel for the 4-bit embedding):
//    load 1.5 s, about 1.8 s per question;
//  - loading reads the 335 to 375 MB weight file into one buffer, so the offscreen renderer peaks at 1.1 to 1.5 GB while it loads.
// The runtime of the model (Transformers.js with ONNX Runtime) is vendored; only the weights, which are data, are downloaded.
import { KEV, filesFor } from './kev-manifest.js';
import { prepareRun, decodeAnswers, backendAnswer } from './kev-core.js';
import { completeSet, openFile } from './kev-store.js';
import { probeGpu } from './kev-gpu.js';

const ASK_TIMEOUT_MS = 60000;      // CHOICE: a question that takes longer than this means the GPU or the runtime is stuck

export class KevRuntime {
  /** @param {{idleMs?: number, onIdle?: () => void, onState?: (s: object) => void, base?: string}} o */
  constructor({ idleMs = 5 * 60 * 1000, onIdle = () => {}, onState = () => {} } = {}) {
    this.idleMs = idleMs;
    this.onIdle = onIdle;
    this.onState = onState;
    this.state = 'idle';                 // idle | loading | ready | error
    this.device = null;                  // 'webgpu' | 'wasm'
    this.set = null;                     // 'q4f16' | 'q4'
    this.error = null;
    this.loadedMs = null;
    this.asked = 0;
    this._loading = null;
    this._queue = Promise.resolve();
    this._timer = null;
    this._parts = null;
  }

  snapshot() {
    return { state: this.state, device: this.device, set: this.set, error: this.error, loadedMs: this.loadedMs, asked: this.asked };
  }

  _set(patch) {
    Object.assign(this, patch);
    this.onState(this.snapshot());
  }

  _touch() {
    clearTimeout(this._timer);
    if (this.idleMs > 0 && this.state === 'ready') this._timer = setTimeout(() => { this.unload().then(() => this.onIdle()); }, this.idleMs);
  }

  /** Load the model from OPFS. Safe to call again: a load in progress is shared, a loaded model stays. */
  load() {
    if (this.state === 'ready') return Promise.resolve(this.snapshot());
    if (!this._loading) {
      this._loading = this._load().finally(() => { this._loading = null; });
    }
    return this._loading;
  }

  async _load() {
    const t0 = performance.now();
    this._set({ state: 'loading', error: null });
    try {
      const stored = await completeSet();
      if (!stored) throw Object.assign(new Error('the model files are not (completely) downloaded'), { code: 'not-downloaded' });
      const gpu = await probeGpu();
      const device = gpu.webgpu ? 'webgpu' : 'wasm';
      if (stored.set === 'q4f16' && !(gpu.webgpu && gpu.f16)) {
        throw Object.assign(new Error('the downloaded files need WebGPU with shader-f16, which this computer does not offer now; delete them and download the WebAssembly files'), { code: 'needs-webgpu' });
      }
      const dtype = stored.set;
      const tf = await import(chrome.runtime.getURL(KEV.runtime.transformers));
      const { env, AutoTokenizer, PreTrainedModel, Tensor } = tf;
      env.allowLocalModels = false;
      env.allowRemoteModels = true;                 // the "remote" files are answered by the custom cache below: nothing is fetched
      env.useBrowserCache = false;
      env.useWasmCache = false;
      const plain = device === 'wasm';
      env.backends.onnx.wasm.wasmPaths = {
        mjs: chrome.runtime.getURL(plain ? KEV.runtime.ortPlainModule : KEV.runtime.ortModule),
        wasm: chrome.runtime.getURL(plain ? KEV.runtime.ortPlainWasm : KEV.runtime.ortWasm),
      };
      env.backends.onnx.wasm.proxy = false;
      env.backends.onnx.wasm.numThreads = 1;        // more threads need cross-origin isolation, which the extension does not ask for
      env.useCustomCache = true;
      env.customCache = {
        async match(key) {
          const m = /\/resolve\/[^/]+\/(.+)$/.exec(String(key));
          if (!m) return undefined;
          const file = filesFor(dtype).find((f) => f.path === m[1]);
          if (!file) return undefined;
          const blob = await openFile(file.path);
          return blob && blob.size === file.size ? new Response(blob, { status: 200 }) : undefined;
        },
        async put() { /* nothing is ever stored here: the files come from our own download */ },
      };
      const tokenizer = await AutoTokenizer.from_pretrained(KEV.repo, { revision: KEV.commit });
      const encode = (t) => Array.from(tokenizer(t, { add_special_tokens: false }).input_ids.data, Number);
      for (const [k, name] of Object.entries(KEV.delimiterTokens)) {
        const ids = encode(name);
        if (ids.length !== 1 || ids[0] !== KEV.delimiters[k]) throw new Error(`the tokenizer does not know the delimiter ${name}`);
      }
      const model = await PreTrainedModel.from_pretrained(KEV.repo, { dtype, device, revision: KEV.commit });
      this._parts = { tf, Tensor, tokenizer, encode, model, env };
      const gpuDevice = device === 'webgpu' && env.backends.onnx.webgpu ? env.backends.onnx.webgpu.device : null;
      if (gpuDevice && gpuDevice.lost) gpuDevice.lost.then((info) => { if (this._parts && this._parts.model === model) this._broken(`the graphics device was lost (${info && info.reason}: ${info && info.message})`); });
      this._set({ device, set: stored.set });
      // the first question pays for compiling the shaders: pay it now, so that the first real question is fast
      await this._run({ kind: 'noul', question: 'Is this a greeting?', text: 'Hello there' });
      this.loadedMs = Math.round(performance.now() - t0);
      this._set({ state: 'ready' });
      this._touch();
      return this.snapshot();
    } catch (e) {
      const message = String((e && e.message) || e).slice(0, 400);
      await this._drop();
      this._set({ state: 'error', error: { code: (e && e.code) || 'load-failed', message } });
      throw e;
    }
  }

  async _run({ kind, question, levels, text }) {
    const { Tensor, encode, model } = this._parts;
    const q = kind === 'score' ? { type: 'score', instructions: question, levels } : { type: 'noul', instructions: question };
    const run = prepareRun({ encode, state: String(text), questions: [q] });
    const out = await model({
      input_ids: new Tensor('int64', BigInt64Array.from(run.inputIds, BigInt), [1, run.inputIds.length]),
      attention_mask: new Tensor('int64', new BigInt64Array(run.inputIds.length).fill(1n), [1, run.inputIds.length]),
    });
    const logits = Array.from(out.logits.to('float32').data);
    const [answer] = decodeAnswers([q], run.groups, logits);
    return { ...backendAnswer(answer), tokens: run.inputIds.length, truncated: run.stateTruncated };
  }

  _broken(message) {
    this._drop();
    this._set({ state: 'error', error: { code: 'device-lost', message } });
  }

  /**
   * Answer one question about a text. Questions are answered one at a time.
   * @param {{kind: 'noul'|'score', question: string, levels?: string[], text: string}} msg
   * @returns {Promise<{p: number|null, error?: string}>}
   */
  ask(msg) {
    const run = this._queue.then(async () => {
      try {
        if (this.state !== 'ready') await this.load();
        const answer = await Promise.race([
          this._run(msg),
          new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error(`no answer within ${ASK_TIMEOUT_MS / 1000} s`), { code: 'timeout' })), ASK_TIMEOUT_MS)),
        ]);
        this.asked++;
        this._touch();
        return answer;
      } catch (e) {
        if (e && e.code === 'timeout') this._broken(e.message);
        else if (this.state === 'ready') this._set({ error: { code: 'ask-failed', message: String((e && e.message) || e).slice(0, 300) } });
        return { p: null, error: (e && e.code) || String((e && e.message) || e).slice(0, 200) };
      }
    });
    this._queue = run.catch(() => {});
    return run;
  }

  async _drop() {
    const parts = this._parts;
    this._parts = null;
    clearTimeout(this._timer);
    if (parts && parts.model && parts.model.dispose) { try { await parts.model.dispose(); } catch (e) { /* the session is gone either way */ } }
  }

  /** Let go of the model and its memory. A later question loads it again. */
  async unload() {
    await this._drop();
    this._set({ state: 'idle', error: null });
  }
}
