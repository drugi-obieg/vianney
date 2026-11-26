// Layered local models: the first model that can answer does, and when it is not sure the next one takes another look.
//
// The first layer is the one that runs everywhere (Kev-0.6B, in the browser, on WebGPU or WASM); a later layer is one that only some computers have
// (Chrome's built-in model). A layer that cannot answer (not downloaded, not available, an error) is skipped, so one model alone works too.
//
// "Not sure" is a first answer strictly between UNSURE_LOW and UNSURE_HIGH. Both numbers are a CHOICE, to be fitted on the labelled set of the
// project (plan.md section 8); they are given as arguments so that the settings or the tests can move them. What happens to a case that two models
// looked at: the answer is the mean of the two (it flags only when both lean the same way far enough, whatever the rule's sensitivity is).

export const UNSURE_LOW = 0.35;
export const UNSURE_HIGH = 0.65;

/** True when a first answer leaves the question open. */
export function isUnsure(p, low = UNSURE_LOW, high = UNSURE_HIGH) {
  return typeof p === 'number' && p > low && p < high;
}

/**
 * @param {{name: string, available: boolean, ask: () => Promise<{p: number|null, error?: string}>}[]} layers in the order of preference
 * @returns {Promise<{p: number|null, via?: string, error?: string, steps: {model: string, p: number|null, error: string|null}[]}>}
 */
export async function askLayered(layers, { low = UNSURE_LOW, high = UNSURE_HIGH } = {}) {
  const steps = [];
  let first = null;      // {name, p} of the first layer that answered
  for (const layer of layers) {
    if (!layer || !layer.available) continue;
    let r;
    try { r = await layer.ask(); } catch (e) { r = { p: null, error: String((e && e.message) || e) }; }
    const p = r && typeof r.p === 'number' && Number.isFinite(r.p) ? Math.min(1, Math.max(0, r.p)) : null;
    steps.push({ model: layer.name, p, error: p === null ? ((r && r.error) || 'no answer') : null });
    if (p === null) continue;                                     // it could not answer: the next one tries
    if (!first) {
      first = { name: layer.name, p };
      if (!isUnsure(p, low, high)) return { p, via: layer.name, steps };   // sure: no second look
      continue;
    }
    return { p: (first.p + p) / 2, via: `${first.name}+${layer.name}`, steps };
  }
  if (first) return { p: first.p, via: first.name, steps };       // unsure, and nobody to ask: what the first one said stands
  return { p: null, error: (steps.find((s) => s.error) || {}).error || 'unavailable', steps };
}
