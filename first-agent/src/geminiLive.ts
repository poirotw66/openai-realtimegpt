/**
 * Gemini Live API client.
 * Uses Python backend with google-genai SDK (like plain-js-python-sdk-demo-app).
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

export type GeminiLiveMessageCallback = (message: {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}, messageId?: string) => void;

let messageCallback: GeminiLiveMessageCallback | null = null;
let ws: WebSocket | null = null;
let playbackContext: AudioContext | null = null;
let nextStartTime = 0;
let scheduledSources: AudioBufferSourceNode[] = [];
let micStream: MediaStream | null = null;
let micContext: AudioContext | null = null;
let micNode: AudioWorkletNode | ScriptProcessorNode | null = null;
let outputTranscriptBuffer = '';
let currentUserMessageId = '';
let userTranscriptBuffer = '';
let isFileUploadSession = false;  // Track if we're in a file upload session

export function setGeminiMessageCallback(callback: GeminiLiveMessageCallback | null): void {
  console.log('🔔 Gemini Live: Setting message callback:', callback ? 'callback set' : 'callback cleared');
  messageCallback = callback;
}

/**
 * Play PCM 16-bit 24kHz mono (base64) using Web Audio API with scheduling.
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
    
    // Schedule audio to play sequentially
    const now = ctx.currentTime;
    nextStartTime = Math.max(now, nextStartTime);
    source.start(nextStartTime);
    nextStartTime += buf.duration;
    
    scheduledSources.push(source);
    source.onended = () => {
      const idx = scheduledSources.indexOf(source);
      if (idx > -1) scheduledSources.splice(idx, 1);
    };
  } catch (e) {
    console.warn('Gemini Live: play audio error', e);
  }
}

/** Normalize server content (Vertex may use snake_case). */
function getServerContent(data: any): any {
  return data?.serverContent ?? data?.server_content ?? null;
}

function handleServerMessage(data: any): void {
  if (!messageCallback) {
    console.warn('Gemini Live: no message callback set');
    return;
  }

  const sc = getServerContent(data);

  // Setup complete - Python backend sends this
  if (data?.setupComplete ?? (data as any)?.setup_complete) {
    console.log('Gemini Live: setup complete received.');
    return;
  }

  // Turn complete
  if (sc?.turnComplete ?? sc?.turn_complete) {
    if (outputTranscriptBuffer.trim()) {
      messageCallback(
        { role: 'assistant', content: outputTranscriptBuffer.trim(), timestamp: new Date(), isStreaming: false },
        'assistant-stream'
      );
      outputTranscriptBuffer = '';
    }
    // Finalize user message only if not in file upload session
    if (currentUserMessageId && userTranscriptBuffer.trim()) {
      if (isFileUploadSession) {
        // Keep accumulating for file uploads - just update as non-streaming
        messageCallback(
          { role: 'user', content: userTranscriptBuffer.trim(), timestamp: new Date(), isStreaming: false },
          currentUserMessageId
        );
        console.log('📝 Audio file segment complete, waiting for more...');
      } else {
        // Finalize and reset for realtime voice
        messageCallback(
          { role: 'user', content: userTranscriptBuffer.trim(), timestamp: new Date(), isStreaming: false },
          currentUserMessageId
        );
        currentUserMessageId = '';
        userTranscriptBuffer = '';
      }
    }
    return;
  }

  // Interrupted – clear buffer and stop audio
  if (sc?.interrupted) {
    outputTranscriptBuffer = '';
    // Don't reset if in file upload session to prevent splitting
    if (!isFileUploadSession) {
      currentUserMessageId = '';
      userTranscriptBuffer = '';
    }
    // Stop all scheduled audio
    scheduledSources.forEach((s) => {
      try { s.stop(); } catch (e) {}
    });
    scheduledSources = [];
    if (playbackContext) {
      nextStartTime = playbackContext.currentTime;
    }
    return;
  }

  // User input transcription
  const inputTranscription = sc?.inputTranscription ?? sc?.input_transcription;
  if (inputTranscription?.text != null) {
    const text = String(inputTranscription.text).trim();
    const isFromFile = inputTranscription.is_from_file || false;
    if (text) {
      // If switching from realtime to file or vice versa, finalize previous message
      if (currentUserMessageId && ((isFileUploadSession && !isFromFile) || (!isFileUploadSession && isFromFile))) {
        // Finalize previous message
        if (userTranscriptBuffer.trim()) {
          messageCallback(
            { role: 'user', content: userTranscriptBuffer.trim(), timestamp: new Date(), isStreaming: false },
            currentUserMessageId
          );
        }
        currentUserMessageId = '';
        userTranscriptBuffer = '';
      }
      
      // Update session type
      isFileUploadSession = isFromFile;
      
      // Accumulate user transcript in the same message
      if (!currentUserMessageId) {
        // Use stable ID for uploaded files to prevent splitting
        currentUserMessageId = isFromFile ? 'user-file-upload' : `user-${Date.now()}`;
        userTranscriptBuffer = '';
        if (isFromFile) {
          console.log('📎 Audio file upload - starting new session');
        }
      }
      userTranscriptBuffer += text + ' ';
      messageCallback(
        { role: 'user', content: userTranscriptBuffer, timestamp: new Date(), isStreaming: true },
        currentUserMessageId
      );
    }
    return;
  }

  // Assistant output transcription (streaming)
  const outputTranscription = sc?.outputTranscription ?? sc?.output_transcription;
  if (outputTranscription?.text != null) {
    const text = String(outputTranscription.text);
    outputTranscriptBuffer += text;
    const finished = outputTranscription.finished ?? false;
    messageCallback(
      { role: 'assistant', content: outputTranscriptBuffer, timestamp: new Date(), isStreaming: !finished },
      'assistant-stream'
    );
    if (finished) {
      outputTranscriptBuffer = '';
    }
    return;
  }

  // Model turn: text and audio parts (support modelTurn / model_turn, inlineData / inline_data)
  const modelTurn = sc?.modelTurn ?? sc?.model_turn;
  const parts = modelTurn?.parts;
  if (Array.isArray(parts) && parts.length > 0) {
    console.log('Gemini Live: model turn with', parts.length, 'parts');
    for (const part of parts) {
      if (part?.text) {
        outputTranscriptBuffer += part.text;
        console.log('Gemini Live: model turn text:', part.text);
        messageCallback(
          { role: 'assistant', content: outputTranscriptBuffer, timestamp: new Date(), isStreaming: true },
          'assistant-stream'
        );
      }
      const inlineData = part?.inlineData ?? part?.inline_data;
      if (inlineData?.data) {
        console.log('Gemini Live: playing audio chunk');
        playPcm24kBase64(inlineData.data);
      }
    }
    return;
  }
}

/**
 * Connect to Gemini Live API via Python backend.
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
      reject(new Error('WebSocket connection failed. Is the Python backend running?'));
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
      console.log('✅ Gemini Live: WebSocket connected to Python backend!');
      outputTranscriptBuffer = '';
      console.log('✅ Gemini Live: Setup complete, resolving promise');
      // Trigger greeting after connection
      setTimeout(() => {
        sendGeminiTriggerGreeting();
      }, 500);
      resolve();
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
        // Binary audio data
        const processAudio = async () => {
          let arrayBuffer: ArrayBuffer;
          if (event.data instanceof Blob) {
            arrayBuffer = await event.data.arrayBuffer();
          } else {
            arrayBuffer = event.data;
          }
          
          // Convert Int16 PCM to base64 and play
          const int16Array = new Int16Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < int16Array.length; i++) {
            binary += String.fromCharCode(int16Array[i] & 0xff, (int16Array[i] >> 8) & 0xff);
          }
          playPcm24kBase64(btoa(binary));
        };
        processAudio().catch(e => console.error('❌ Audio processing error:', e));
        return;
      }

      // JSON messages
      try {
        const data = JSON.parse(event.data as string);
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
  nextStartTime = 0;
  scheduledSources = [];
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
 * Trigger the model to say the greeting. Send a trigger text after connection.
 */
function sendGeminiTriggerGreeting(): void {
  console.log('👋 Gemini Live: sendGeminiTriggerGreeting called');
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn('⚠️ Gemini Live: Cannot send greeting - WebSocket not open');
    return;
  }
  // Send text trigger to Python backend
  ws.send(JSON.stringify({ text: '。' }));
}

/**
 * Send PCM 16kHz 16-bit mono audio (raw bytes) to Python backend.
 */
export function sendGeminiAudioBase64(base64Pcm: string): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  // Convert base64 to binary and send as ArrayBuffer
  const binary = atob(base64Pcm);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  ws.send(bytes.buffer);
}

/**
 * Send text message to Gemini Live
 */
export function sendGeminiText(text: string): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket not connected');
  }
  // Send text as JSON message
  ws.send(JSON.stringify({ text: text }));
}

/** Chunk size for file upload: ~100ms at 16kHz 16-bit mono. */
const GEMINI_AUDIO_CHUNK_BYTES = 3200;

/**
 * Send audio file as user input.
 * Sends the entire audio file at once (not streaming) so Gemini will process it completely before responding.
 */
export async function sendGeminiAudioFromFile(file: File): Promise<void> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket not connected');
  }
  
  const pcmBuffer = await fileToPcm16k(file);
  const bytes = new Uint8Array(pcmBuffer);
  
  // Convert entire audio to base64
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Audio = btoa(binary);
  
  // Send as a special audio upload message (not realtime streaming)
  ws.send(JSON.stringify({
    type: 'audio_file',
    data: base64Audio,
    mime_type: 'audio/pcm;rate=16000'
  }));
}

/** Gemini Live does not expose mute in the same way; report false for now. */
export function getGeminiSupportsPause(): boolean {
  return false;
}

export function isGeminiConnected(): boolean {
  return ws?.readyState === WebSocket.OPEN;
}
