// What a page of the extension can ask of the graphics adapter. Used by the offscreen document (to pick the way the model runs) and by the
// settings page (to show the size of the files that this computer needs before anything is downloaded).

/** @returns {Promise<{webgpu: boolean, f16: boolean}>} `webgpu`: an adapter was found; `f16`: it offers `shader-f16`, which the half-precision files need */
export async function probeGpu() {
  try {
    if (!self.navigator || !navigator.gpu) return { webgpu: false, f16: false };
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { webgpu: false, f16: false };
    return { webgpu: true, f16: adapter.features.has('shader-f16') };
  } catch (e) {
    return { webgpu: false, f16: false };
  }
}
