// How the service worker turns "the models" into answers: which models are asked, in which order, and what it tells a tab about them.
// Pure functions (no extension API), tested in tests/kev-router.test.js.
//
// The models are layered (plan.md section 4.2): Kev-0.6B first (it runs on every computer, on WebGPU or WebAssembly), and when its answer is not
// sure, Chrome's own model (Gemini Nano, when this Chrome has it) takes another look. A model that is not there is skipped, so either one alone
// works too. `askLayered` in core/layered.js does the asking; its contract is unchanged.

/** The values of the setting `ai.backend`. */
export const BACKENDS = ['auto', 'kev', 'prompt'];

export function backendSetting(settings) {
  const b = settings && settings.ai && settings.ai.backend;
  return BACKENDS.includes(b) ? b : 'auto';
}

/**
 * Is this message from a page of this extension (the settings page, the popup, the offscreen document, the service worker itself), and not
 * from a content script on a web page? A content script has the extension's id as well, but its origin is the page's.
 * @param {{id?: string, origin?: string, url?: string}} sender
 * @param {string} base chrome.runtime.getURL('')
 * @param {string} id chrome.runtime.id
 */
export function fromExtensionPage(sender, base, id) {
  if (!sender || sender.id !== id) return false;
  const origin = String(base).replace(/\/+$/, '');          // 'chrome-extension://<id>' (not new URL(base).origin: Node says "null" for this scheme, Chrome does not)
  if (sender.origin !== undefined && sender.origin !== origin) return false;
  if (sender.url !== undefined && !String(sender.url).startsWith(base)) return false;
  return sender.origin !== undefined || sender.url !== undefined;
}

/**
 * The layers for askLayered.
 * @param {{backend: string, kev: {ready: boolean, ask: Function}, prompt: {available: boolean, ask: Function}}} o
 *   `ask` of each is `() => Promise<{p, error?}>` for the question at hand
 */
export function buildLayers({ backend, kev, prompt }) {
  const useKev = backend === 'auto' || backend === 'kev';
  const usePrompt = backend === 'auto' || backend === 'prompt';
  return [
    { name: 'kev', available: useKev && !!kev.ready, ask: kev.ask },
    { name: 'prompt', available: usePrompt && !!prompt.available, ask: prompt.ask },
  ];
}

/**
 * What `ai-status` answers a tab. `availability` stays what it always was (the string a tab compares with 'available'): it says 'available'
 * when ANY model can answer; otherwise it passes on what Chrome's model says, so that the old reading still holds.
 * @param {{settings: object, kev: {state: string, ready: boolean, device?: string, set?: string, error?: object|null}, promptAvailability: string}} o
 */
export function statusFor({ settings, kev, promptAvailability }) {
  const backend = backendSetting(settings);
  const useKev = backend === 'auto' || backend === 'kev';
  const usePrompt = backend === 'auto' || backend === 'prompt';
  const layers = [
    { name: 'kev', available: useKev && !!kev.ready, state: useKev ? kev.state : 'off', device: kev.device || null, set: kev.set || null, error: kev.error || null },
    { name: 'prompt', available: usePrompt && promptAvailability === 'available', state: usePrompt ? promptAvailability : 'off' },
  ];
  const any = layers.some((l) => l.available);
  return {
    availability: any ? 'available' : (usePrompt ? promptAvailability : 'unavailable'),
    backend,
    layers,
    // tabs ask again soon while the local model is being loaded or downloaded: the answer is about to change
    loading: kev.state === 'loading' || kev.state === 'downloading',
    // changes when the set of models that can answer changes: a tab then forgets the answers it kept, which came from other models
    key: layers.map((l) => `${l.name}:${l.available ? 1 : 0}`).join(','),
    host: 'service-worker',
  };
}

/** What `ai-ask` answers a tab: the engine reads p and error; the steps say which model said what. */
export function answerFor(r) {
  const out = { p: r.p };
  if (r.p === null || r.p === undefined) out.error = r.error || 'unavailable';
  if (r.via) out.via = r.via;
  if (r.steps) out.steps = r.steps;
  return out;
}
