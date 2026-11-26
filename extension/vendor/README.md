# vendor: the runtime of the local model (Kev-0.6B)

Written by `node tools/vendor-kev.mjs`; do not edit by hand. `node tools/vendor-kev.mjs --check` verifies these files against the pins below (no network).

These files are CODE that the extension runs, so they ship inside the extension and are never downloaded at run time (Manifest V3 forbids remotely hosted code).
The model's weights are DATA and are downloaded on the user's click: see extension/src/ai/kev-manifest.js.

## Transformers.js 4.3.2 (Apache-2.0)

- source: https://registry.npmjs.org/@huggingface/transformers/-/transformers-4.3.2.tgz
- the tarball's integrity as the npm registry publishes it: `sha512-V3+dqf3iWlRYJ9I9GreM3zGQd0lAXnnoPeddmkOQYWAEE4l/+Fi6p7tx/qVUJlKQgLXGim2W76rTOzz+eC0i7g==`
- `transformers/transformers.min.js`: 587917 bytes, SHA-256 `8b5a3171f8876bab2b1820a7d65eb87628e3d30bb5ea85b9dd398e76eb34decb` (from `package/dist/transformers.min.js`)
- `transformers/LICENSE`: 11358 bytes, SHA-256 `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` (from `package/LICENSE`)
- `transformers.min.js` is the self-contained browser bundle (an ES module with no imports). It contains ONNX Runtime Web (MIT) and the tokenizer code.
- The bundle names a default location for the WebAssembly files on a content delivery network. The extension never uses it: it sets the two paths below before the first session is made, and its content security policy would refuse the other address anyway.

## ONNX Runtime Web 1.31.0-dev.20260914-8d85527a0 (MIT)

- source: https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-1.31.0-dev.20260914-8d85527a0.tgz
- the tarball's integrity as the npm registry publishes it: `sha512-Iy7rtadoBgxS/LLvDr3QW38DB1PNXRnr0GJMcL0TAt7c9qjgVQl83UlGCVyeAnK2InpmW8Uc3PL8XIuqtDeF6g==`
- `ort/ort-wasm-simd-threaded.asyncify.mjs`: 53057 bytes, SHA-256 `0966b6105cd936744498aa60df7a22cbd47af3374dbc64a9ab561c08a71e3611` (from `package/dist/ort-wasm-simd-threaded.asyncify.mjs`)
- `ort/ort-wasm-simd-threaded.asyncify.wasm`: 26861777 bytes, SHA-256 `49871f5a4409519797e127440868a6d1923339d9185907f301a5b2a1d90af082` (from `package/dist/ort-wasm-simd-threaded.asyncify.wasm`)
- `ort/ort-wasm-simd-threaded.mjs`: 24381 bytes, SHA-256 `c57ca56328877353a575e51bbca6f18450027d6c9bf2307a2cb2c41363b4de9f` (from `package/dist/ort-wasm-simd-threaded.mjs`)
- `ort/ort-wasm-simd-threaded.wasm`: 14264838 bytes, SHA-256 `06ba057753da3847e4c24f02d91ab133455b0817c69a44993a9a53a2146df9e3` (from `package/dist/ort-wasm-simd-threaded.wasm`)
- `ort/LICENSE`: the MIT text of the project repository (https://cdn.jsdelivr.net/gh/microsoft/onnxruntime@v1.31.0/LICENSE), 1073 bytes, SHA-256 `2f07c72751aed99790b8a4869cf2311df85a860b22ded05fa22803587a48922c`. The npm package has no licence file.
- This is the exact development build that Transformers.js 4.3.2 depends on. The JavaScript inside `transformers.min.js` and these WebAssembly files must come from the same build, so they are updated together.
- Two builds are vendored, because each does one job that the other cannot (measured in Chrome 158 on 2026-11-26):
  - "asyncify" (`ort-wasm-simd-threaded.asyncify.*`): the WebGPU execution provider. It runs on one thread. Its processor kernels lack `GatherBlockQuantized`, which the model needs, so it cannot run the model on the processor.
  - plain (`ort-wasm-simd-threaded.*`): the WebAssembly (processor) execution provider, without WebGPU. It has the kernel.

## Size

- 41804401 bytes in total, of which the two WebAssembly binaries are 26861777 (WebGPU) and 14264838 (processor).
