/**
 * Gemini Live API client (Vertex AI).
 * Uses WebSocket proxy and Vertex AI BidiGenerateContent protocol.
 * @see https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api
 */

import { fileToPcm16k } from './audioUtils';

function getWsProxyUrl(): string {
  const base = typeof import.meta.env !== 'undefined' && (import.meta.env.VITE_PROXY_URL as string);
  if (base) return base.replace(/^http/, 'ws');
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3001';
  return `${protocol}//${host}`;
}

const VERTEX_SERVICE_URL = 'wss://us-central1-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent';

/** Model ID for Vertex AI Live (GA or preview). */
const GEMINI_LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

export type GeminiLiveMessageCallback = (message: {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}, messageId?: string) => void;

let messageCallback: GeminiLiveMessageCallback | null = null;
let ws: WebSocket | null = null;
let playbackContext: AudioContext | null = null;
let micStream: MediaStream | null = null;
let micContext: AudioContext | null = null;
let micNode: AudioWorkletNode | ScriptProcessorNode | null = null;
let outputTranscriptBuffer = '';

export function setGeminiMessageCallback(callback: GeminiLiveMessageCallback | null): void {
  console.log('🔔 Gemini Live: Setting message callback:', callback ? 'callback set' : 'callback cleared');
  messageCallback = callback;
}

function getModelUri(projectId: string): string {
  return `projects/${projectId}/locations/us-central1/publishers/google/models/${GEMINI_LIVE_MODEL}`;
}

/**
 * Play PCM 16-bit 24kHz mono (base64) using Web Audio API.
 */
function playPcm24kBase64(base64: string): void {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

    if (!playbackContext) {
      playbackContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const ctx = playbackContext;
    if (ctx.state === 'suspended') ctx.resume();

    const buf = ctx.createBuffer(1, float32.length, 24000);
    buf.getChannelData(0).set(float32);
    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.connect(ctx.destination);
    source.start(0);
  } catch (e) {
    console.warn('Gemini Live: play audio error', e);
  }
}

/** Normalize server content (Vertex may use snake_case). */
function getServerContent(data: any): any {
  return data?.serverContent ?? data?.server_content ?? null;
}

function handleServerMessage(data: any): void {
  console.log('Gemini Live: received message:', JSON.stringify(data, null, 2));
  
  if (!messageCallback) {
    console.warn('Gemini Live: no message callback set');
    return;
  }

  const sc = getServerContent(data);

  // Setup complete (Vertex may send setup_complete in snake_case) – trigger greeting like GPT Realtime
  if (data?.setupComplete ?? (data as any)?.setup_complete) {
    console.log('Gemini Live: setup complete, triggering greeting.');
    sendGeminiTriggerGreeting();
    return;
  }

  // Turn complete
  if (sc?.turnComplete ?? sc?.turn_complete) {
    if (outputTranscriptBuffer.trim()) {
      messageCallback(
        { role: 'assistant', content: outputTranscriptBuffer.trim(), timestamp: new Date(), isStreaming: false },
        `assistant-${Date.now()}`
      );
      outputTranscriptBuffer = '';
    }
    return;
  }

  // Interrupted – clear buffer
  if (sc?.interrupted) {
    outputTranscriptBuffer = '';
    return;
  }

  // User input transcription
  const inputTranscription = sc?.inputTranscription ?? sc?.input_transcription;
  if (inputTranscription?.text != null) {
    const text = String(inputTranscription.text).trim();
    console.log('Gemini Live: user transcription:', text);
    if (text) {
      messageCallback(
        { role: 'user', content: text, timestamp: new Date(), isStreaming: false },
        `user-${Date.now()}`
      );
    }
    return;
  }

  // Assistant output transcription (streaming)
  const outputTranscription = sc?.outputTranscription ?? sc?.output_transcription;
  if (outputTranscription?.text != null) {
    outputTranscriptBuffer += outputTranscription.text;
    console.log('Gemini Live: assistant transcription:', outputTranscriptBuffer, 'finished:', finished);
    const finished = outputTranscription.finished ?? true;
    messageCallback(
      { role: 'assistant', content: outputTranscriptBuffer, timestamp: new Date(), isStreaming: !finished },
      'assistant-stream'
    );
    return;
  }

  // Model turn: text and audio parts (support modelTurn / model_turn, inlineData / inline_data)
  const modelTurn = sc?.modelTurn ?? sc?.model_turn;
  coconsole.log('Gemini Live: model turn with', parts.length, 'parts');
    for (const part of parts) {
      if (part.text) {
        outputTranscriptBuffer += part.text;
        console.log('Gemini Live: model turn text:', part.text);
        messageCallback(
          { role: 'assistant', content: outputTranscriptBuffer, timestamp: new Date(), isStreaming: true },
          'assistant-stream'
        );
      }
      const inlineData = part.inlineData ?? part.inline_data;
      if (inlineData?.data) {
        console.log('Gemini Live: playing audio chunk');
      const inlineData = part.inlineData ?? part.inline_data;
      if (inlineData?.data) {
        playPcm24kBase64(inlineData.data);
      }
    }
  }
}

/**
 * Connect to Gemini Live API via proxy. Uses GOOGLE_CLOUD_PROJECT from server or provided projectId.
 */
export function connectGeminiSession(projectId: string): Promise<void> {
  console.log('🔌 Gemini Live: connectGeminiSession called with projectId:', projectId);
  
  if (ws?.readyState === WebSocket.OPEN) {
    console.log('✅ Gemini Live: WebSocket already open');
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const wsUrl = `${getWsProxyUrl()}/ws/gemini-live`;
    console.log('🔌 Gemini Live: Connecting to WebSocket:', wsUrl);
    ws = new WebSocket(wsUrl);

    ws.onerror = (error) => {
      console.error('❌ Gemini Live: WebSocket error:', error);
      reject(new Error('WebSocket connection failed. Is the proxy running (npm run dev-full)?'));
    };

  ws.onclose = (ev) => {
    console.log('🔌 Gemini Live: WebSocket closed. Code:', ev.code, 'Reason:', ev.reason, 'Clean:', ev.wasClean);
    ws = null;
    stopGeminiMicrophone();
    if (playbackContext) {
      playbackContext.close().catch(() => {});
      playbackContext = null;
    }
    if (!ev.wasClean && ev.code !== 1000) {
      reject(new Error(ev.reason || 'Connection closed'));
    }
  };

    ws.onopen = () => {
      console.log('✅ Gemini Live: WebSocket connected!');
      
      // First message: service URL for proxy to connect to Vertex
      const serviceUrlMsg = { service_url: VERTEX_SERVICE_URL };
      console.log('📤 Gemini Live: Sending service URL:', serviceUrlMsg);
      ws!.send(JSON.stringify(serviceUrlMsg));

      const modelUri = getModelUri(projectId);
      console.log('📤 Gemini Live: Using model URI:', modelUri);
      
      // Try absolute minimal setup - just model name
      const setupMessage = {
        setup: {
          model: modelUri
        }
      };
      
      console.log('📤 Gemini Live: Sending minimal setup message:', JSON.stringify(setupMessage, null, 2));
      ws!.send(JSON.stringify(setupMessage));
      outputTranscriptBuffer = '';
      console.log('✅ Gemini Live: Setup complete, resolving promise');
      resolve();
    };

    ws.onmessage = (event) => {
      console.log('📨 Gemini Live: Received raw message:', event.data);
      try {
        const data = JSON.parse(event.data as string);
        console.log('📨 Gemini Live: Parsed message:', data);
        handleServerMessage(data);
      } catch (e) {
        console.error('❌ Gemini Live: parse message error', e, 'Raw data:', event.data);
      }
    };
  });
}

export function disconnectGeminiSession(): void {
  stopGeminiMicrophone();
  if (ws) {
    ws.close(1000, 'User disconnect');
    ws = null;
  }
  if (playbackContext) {
    playbackContext.close().catch(() => {});
    playbackContext = null;
  }
  outputTranscriptBuffer = '';
}

const GEMINI_MIC_TARGET_RATE = 16000;
const GEMINI_MIC_BUFFER_SIZE = 1024;

/** Resample Float32 from context sample rate to 16kHz (simple linear downsampling). */
function resampleTo16k(float32: Float32Array, sourceRate: number): Float32Array {
  if (sourceRate === GEMINI_MIC_TARGET_RATE) return float32;
  const ratio = sourceRate / GEMINI_MIC_TARGET_RATE;
  const outLen = Math.floor(float32.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio;
    const j = Math.floor(srcIdx);
    const t = srcIdx - j;
    out[i] = float32[j] * (1 - t) + (float32[j + 1] ?? float32[j]) * t;
  }
  return out;
}

/** Convert Float32 to PCM16 base64 for Gemini (16kHz). */
function float32ToPcm16Base64(float32: Float32Array): string {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  let binary = '';
  for (let i = 0; i < pcm16.length; i++) {
    binary += String.fromCharCode(pcm16[i] & 0xff, (pcm16[i] >> 8) & 0xff);
  }
  return btoa(binary);
}

function sendMicChunk(float32: Float32Array, sampleRate: number): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const resampled = resampleTo16k(float32, sampleRate);
  const base64 = float32ToPcm16Base64(resampled);
  sendGeminiAudioBase64(base64);
}

/**
 * Start streaming microphone audio to Gemini Live (16kHz PCM). Uses AudioWorklet when available.
 */
export async function startGeminiMicrophone(): Promise<void> {
  console.log('🎤 Gemini Live: startGeminiMicrophone called. WebSocket state:', ws?.readyState);
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn('⚠️ Gemini Live: Cannot start microphone - WebSocket not open');
    return;
  }
  if (micStream) {
    console.log('⚠️ Gemini Live: Microphone already started');
    return;
  }

  micStream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
  });

  micContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (micContext.state === 'suspended') await micContext.resume();
  const source = micContext.createMediaStreamSource(micStream);
  const sampleRate = micContext.sampleRate;

  try {
    await micContext.audioWorklet.addModule('/gemini-capture-processor.js');
    const workletNode = new AudioWorkletNode(micContext, 'gemini-capture-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1
    });
    workletNode.port.onmessage = (ev: MessageEvent) => {
      if (ev.data?.type === 'audio' && ev.data.data) {
        sendMicChunk(ev.data.data as Float32Array, sampleRate);
      }
    };
    source.connect(workletNode);
    workletNode.connect(micContext.destination);
    micNode = workletNode;
  } catch (_) {
    const scriptNode = micContext.createScriptProcessor(GEMINI_MIC_BUFFER_SIZE, 1, 1);
    scriptNode.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      sendMicChunk(input, e.inputBuffer.sampleRate);
    };
    source.connect(scriptNode);
    scriptNode.connect(micContext.destination);
    micNode = scriptNode;
  }
}

/**
 * Stop microphone streaming.
 */
export function stopGeminiMicrophone(): void {
  if (micNode) {
    try {
      micNode.disconnect();
    } catch (_) {}
    micNode = null;
  }
  if (micContext) {
    micContext.close().catch(() => {});
    micContext = null;
  }
  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }
}

/**
 * Trigger the model to say the greeting (same as GPT Realtime). Call after setupComplete.
 */
function sendGeminiTriggerGreeting(): void {
  console.log('👋 Gemini Live: sendGeminiTriggerGreeting called');
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn('⚠️ Gemini Live: Cannot send greeting - WebSocket not open');
    return;
  }
  const message = {
    client_content: {
      turns: [{ role: 'user', parts: [{ text: '。' }] }],
      turn_complete: true
    }
  };
  console.log('📤 Gemini Live: Sending greeting trigger:', message);
  ws.send(JSON.stringify(message));
}

/**
 * Send PCM 16kHz 16-bit mono audio (base64) to Gemini Live.
 */
export function sendGeminiAudioBase64(base64Pcm: string): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const message = {
    realtime_input: {
      media_chunks: [{ mime_type: 'audio/pcm;rate=16000', data: base64Pcm }]
    }
  };
  ws.send(JSON.stringify(message));
}

/** Chunk size for file upload: ~100ms at 16kHz 16-bit mono. */
const GEMINI_AUDIO_CHUNK_BYTES = 3200;

/**
 * Send audio file as user input (same as GPT Realtime: upload = user speech).
 * Converts to 16kHz PCM and sends in chunks so the server can transcribe and respond.
 */
export async function sendGeminiAudioFromFile(file: File): Promise<void> {
  const pcmBuffer = await fileToPcm16k(file);
  const bytes = new Uint8Array(pcmBuffer);
  let offset = 0;
  while (offset < bytes.length) {
    const end = Math.min(offset + GEMINI_AUDIO_CHUNK_BYTES, bytes.length);
    const chunk = bytes.subarray(offset, end);
    let binary = '';
    for (let i = 0; i < chunk.length; i++) binary += String.fromCharCode(chunk[i]);
    sendGeminiAudioBase64(btoa(binary));
    offset = end;
    if (offset < bytes.length) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}

/** Gemini Live does not expose mute in the same way; report false for now. */
export function getGeminiSupportsPause(): boolean {
  return false;
}

export function isGeminiConnected(): boolean {
  return ws?.readyState === WebSocket.OPEN;
}
