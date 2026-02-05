/**
 * Convert an audio File to PCM 16-bit 24kHz mono ArrayBuffer for OpenAI Realtime API.
 * Uses Web Audio API to decode and resample.
 */

const TARGET_SAMPLE_RATE_24K = 24000;
const TARGET_SAMPLE_RATE_16K = 16000;

/**
 * Resample a Float32Array from sourceRate to targetRate (simple linear interpolation).
 */
function resample(
  input: Float32Array,
  sourceRate: number,
  targetRate: number
): Float32Array {
  if (sourceRate === targetRate) return input;
  const ratio = sourceRate / targetRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
    const t = srcIndex - srcIndexFloor;
    output[i] = input[srcIndexFloor] * (1 - t) + input[srcIndexCeil] * t;
  }
  return output;
}

/**
 * Convert Float32Array (-1..1) to Int16 PCM little-endian ArrayBuffer.
 */
function float32ToPcm16(float32: Float32Array): ArrayBuffer {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16.buffer;
}

/**
 * Decode audio file to PCM 16-bit 24kHz mono ArrayBuffer for Realtime API input.
 * Supports formats the browser can decode (WAV, MP3, OGG, etc.).
 */
export async function fileToPcm24k(file: File): Promise<ArrayBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));

  // Use first channel (mono)
  let channelData = decoded.getChannelData(0);
  const sampleRate = decoded.sampleRate;

  if (decoded.numberOfChannels > 1) {
    const other = decoded.getChannelData(1);
    channelData = new Float32Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = (decoded.getChannelData(0)[i] + other[i]) / 2;
    }
  }

  const resampled = resample(
    channelData,
    sampleRate,
    TARGET_SAMPLE_RATE_24K
  );
  return float32ToPcm16(resampled);
}

/**
 * Decode audio file to PCM 16-bit 16kHz mono ArrayBuffer for Gemini Live API input.
 */
export async function fileToPcm16k(file: File): Promise<ArrayBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));

  let channelData = decoded.getChannelData(0);
  const sampleRate = decoded.sampleRate;

  if (decoded.numberOfChannels > 1) {
    const other = decoded.getChannelData(1);
    channelData = new Float32Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = (decoded.getChannelData(0)[i] + other[i]) / 2;
    }
  }

  const resampled = resample(
    channelData,
    sampleRate,
    TARGET_SAMPLE_RATE_16K
  );
  return float32ToPcm16(resampled);
}
