/**
 * AudioWorklet processor for Gemini Live: captures mic at context sample rate,
 * sends Float32 to main thread for resample to 16kHz and send to API.
 */
class GeminiCaptureProcessor extends AudioWorkletProcessor {
  process(inputs, _outputs, _parameters) {
    const input = inputs[0];
    if (!input || !input.length) return true;
    const channel = input[0];
    if (!channel || channel.length === 0) return true;
    this.port.postMessage({ type: 'audio', data: channel.slice(0) });
    return true;
  }
}

registerProcessor('gemini-capture-processor', GeminiCaptureProcessor);
