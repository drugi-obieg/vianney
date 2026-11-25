// Decode a recorded or uploaded sound clip into 16 kHz mono samples (what the sound check sends to the model).
// Browser only: it needs OfflineAudioContext, which decodes without a user gesture and without playing anything.

import { mixToMono, SAMPLE_RATE } from '../core/audio.js';

/**
 * @param {Blob} blob any format the browser can decode (webm/opus from the recorder, wav, mp3, ...)
 * @param {number} maxSeconds longer clips are cut
 * @returns {Promise<Float32Array>}
 */
export async function decodeToMono16k(blob, maxSeconds = 30) {
  const bytes = await blob.arrayBuffer();
  const ctx = new OfflineAudioContext(1, SAMPLE_RATE, SAMPLE_RATE); // the length only matters for rendering, which we never do
  const buffer = await ctx.decodeAudioData(bytes);               // the result is resampled to the context's rate
  const channels = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));
  const mono = mixToMono(channels);
  const limit = Math.floor(SAMPLE_RATE * maxSeconds);
  return mono.length > limit ? mono.subarray(0, limit) : mono;
}
