import { RealtimeAgent, RealtimeSession } from '@openai/agents-realtime';
import { tools } from './tools';
import { setMessageCallbackForTools } from './tools/getCurrentTime';
import { groundingMCPServer } from './mcp/mcpServer';
import { setupEventHandlers } from './sessionHandler';
import { setupDebugTools } from './debug';
import { fileToPcm24k } from './audioUtils';

/** Realtime model used for session and client_secret */
const REALTIME_MODEL = 'gpt-realtime-mini-2025-12-15';

/**
 * Display language for conversation: AI replies and (optionally) user transcription.
 * - 'zh-TW': 繁體中文
 * - 'en': English
 */
export const DISPLAY_LANGUAGE = 'zh-TW' as const;
type DisplayLanguage = 'zh-TW' | 'en';

const LANGUAGE_INSTRUCTIONS: Record<DisplayLanguage, string> = {
  'zh-TW': 'You MUST respond only in Traditional Chinese (繁體中文). Do not use Simplified Chinese.',
  en: 'You MUST respond only in English. Do not use Chinese or other languages.',
};

// Global variables for agent and session
let agent: RealtimeAgent | null = null;
let session: RealtimeSession | null = null;
let currentResponseId: string | null = null; // Track current active response ID for cancellation

// Initialize MCP server and get additional tools
async function initializeMCPServer() {
  try {
    await groundingMCPServer.connect();
    const mcpTools = await groundingMCPServer.getTools();
    console.log('🔧 MCP tools loaded:', mcpTools.map((t: any) => t.name));
    return mcpTools;
  } catch (error) {
    console.error('❌ Failed to initialize MCP server:', error);
    return [];
  }
}

// Function to create agent with all tools
async function createAgentWithTools() {
  console.log('🔧 Initializing agent with all tools...');
  
  // Get MCP tools first
  const mcpTools = await initializeMCPServer();
  
  // Combine regular tools with MCP tools
  const allTools = [...tools, ...mcpTools];
  
  console.log('🔧 Total tools available:', allTools.length);
  console.log('🔧 Tool names:', allTools.map((t: any) => t.name));
  
  // Create agent with all tools (language is set by DISPLAY_LANGUAGE)
  const langInstructions = LANGUAGE_INSTRUCTIONS[DISPLAY_LANGUAGE];
  const greeting = DISPLAY_LANGUAGE === 'zh-TW'
    ? '哈囉～有什麼可以幫你的？'
    : 'Hello~ What can I help you?';

  agent = new RealtimeAgent({
    name: 'Assistant',
    instructions: `You are a helpful assistant. ${langInstructions} You have access to tools including:
- get_current_time: for time queries
- grounded_search: for web searches and current information
- send_email, send_halloween_invitation, send_system_alert: for sending emails

When the conversation starts (right after the user connects, before they have said anything), greet them first by saying: "${greeting}" Then wait for their response.`,
    tools: allTools
  });
  session = new RealtimeSession(agent, {
    model: REALTIME_MODEL,
    config: {
      input_audio_transcription: {
        model: 'whisper-1',
        language: 'zh',
        prompt: DISPLAY_LANGUAGE === 'zh-TW' ? '繁體中文' : undefined
      }
    }
  } as any);

  return { agent, session };
}

// Store the message callback function
let messageCallback: ((message: { role: 'user' | 'assistant'; content: string; timestamp: Date; isStreaming?: boolean }, messageId?: string) => void) | null = null;

// Flush user messages from session history (set by setupEventHandlers; call after sendAudioFromFile so test-audio transcript appears)
let flushUserMessagesFromSessionHistory: (() => void) | null = null;

// Function to set the message callback
export function setMessageCallback(callback: (message: { role: 'user' | 'assistant'; content: string; timestamp: Date; isStreaming?: boolean }, messageId?: string) => void) {
  messageCallback = callback;
  setMessageCallbackForTools(callback);
}

/** Fetch ephemeral client secret from backend (uses OPENAI_API_KEY from server .env). Use relative /api so Vite proxy can forward to 3001. */
async function fetchClientSecret(): Promise<string> {
  let res: Response;
  try {
    res = await fetch('/api/realtime/client_secret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: { type: 'realtime', model: REALTIME_MODEL }
      })
    });
  } catch (e) {
    throw new Error('無法連線到後端。請確認已執行 npm run dev-full（同時啟動 proxy 與前端）。');
  }
  let data: { success?: boolean; value?: string; error?: string };
  try {
    data = await res.json();
  } catch (_) {
    throw new Error(res.ok ? 'Invalid response from server' : `Server error: ${res.status}`);
  }
  if (!res.ok) {
    throw new Error(data?.error || `Server error: ${res.status}`);
  }
  if (!data?.success || !data?.value) {
    throw new Error(data?.error || 'Failed to get client secret from server');
  }
  return data.value;
}

// Connect to session: prefer env (backend) unless user provided a non-empty API key.
// When apiKey is undefined, null, or blank, use backend OPENAI_API_KEY via fetchClientSecret().
export async function connectSession(apiKey?: string | null) {
  try {
    const useEnvKey = !apiKey || String(apiKey).trim() === '';
    const token = useEnvKey ? await fetchClientSecret() : String(apiKey).trim();
    console.log('Attempting to connect with', useEnvKey ? 'env key from server (OPENAI_API_KEY)' : 'user-provided API key');
    
    // Create agent and session with all tools (including MCP tools)
    const { agent: newAgent, session: newSession } = await createAgentWithTools();
    agent = newAgent;
    session = newSession;
    
    // Automatically connects your microphone and audio output
    // in the browser via WebRTC. Use ephemeral token or API key.
    await session.connect({
      apiKey: token,
    });
    
    // After connection, explicitly enable input audio transcription
    const sessionAny = session as any;
    if (sessionAny.updateSession) {
      try {
        await sessionAny.updateSession({
          input_audio_transcription: {
            model: 'whisper-1'
          }
        });
      } catch (error) {
        // Ignore errors, transcription might already be enabled
      }
    }
    
    console.log('Successfully connected to RealtimeSession');

    // Expose session for debugging
    (window as any).debugSession = session;

    // Setup event handlers
    flushUserMessagesFromSessionHistory = setupEventHandlers(session, messageCallback);
    
    // Expose function to track current response ID
    (window as any).setCurrentResponseId = (id: string | null) => {
        currentResponseId = id;
        console.log('🔔 Response ID updated:', id);
    };

    // Trigger initial greeting: send a minimal message so the model says "Hello~ What can I help you?"
    if (typeof sessionAny.sendMessage === 'function') {
      setTimeout(() => {
        try {
          sessionAny.sendMessage!('.');
        } catch (e) {
          console.warn('Could not send initial greeting trigger:', e);
        }
      }, 500);
    }

    // Add manual testing methods in development
    if (import.meta.env && import.meta.env.DEV) {
      setupDebugTools(session, agent, messageCallback);
    }
    
    return session;
  } catch (error) {
    console.error('❌ Failed to connect to RealtimeSession:', error);
    throw error;
  }
}

// Cleanup function
export async function cleanupMCPServer() {
  try {
    await groundingMCPServer.cleanup();
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

/** Flush user messages from session history into the UI. Call after sendAudioFromFile so test-audio transcript appears in the conversation. */
export function flushUserMessagesFromSession(): void {
  flushUserMessagesFromSessionHistory?.();
}

/** Disconnect from the session and release resources (Realtime API supports close()). */
export function disconnectSession(): void {
  try {
    flushUserMessagesFromSessionHistory = null;
    if (session) {
      const sessionAny = session as { close?: () => void };
      if (typeof sessionAny.close === 'function') {
        sessionAny.close();
        console.log('Disconnected from RealtimeSession');
      }
      session = null;
    }
    agent = null;
    cleanupMCPServer();
  } catch (error) {
    console.error('❌ Error during disconnect:', error);
  }
}

/** Whether the current transport supports pause (mute). WebRTC supports it; WebSocket does not. */
export function getSupportsPause(): boolean {
  if (!session) return false;
  return session.muted !== null;
}

/** Pause or resume sending microphone input. Only supported when using WebRTC transport. */
export function pauseSession(muted: boolean): void {
  if (session && session.muted !== null) {
    session.mute(muted);
  }
}

/** Chunk size for sending audio (SDK uses spread in base64 conversion; large buffers cause stack overflow). */
const AUDIO_CHUNK_BYTES = 4800; // ~100ms at 24kHz 16-bit mono

/** Send audio from a file as user input (for testing without microphone). Realtime API expects PCM 16-bit 24kHz mono. */
export async function sendAudioFromFile(file: File): Promise<void> {
  const currentSession = session;
  if (!currentSession) {
    throw new Error('Not connected. Connect first before sending test audio.');
  }
  const sessionAny = currentSession as { 
    sendAudio: (audio: ArrayBuffer, options?: { commit?: boolean }) => void;
    history?: any[];
  };
  if (typeof sessionAny.sendAudio !== 'function') {
    throw new Error('Session does not support sendAudio');
  }
  
  const pcmBuffer = await fileToPcm24k(file);
  const bytes = new Uint8Array(pcmBuffer);
  let offset = 0;
  while (offset < bytes.length) {
    const end = Math.min(offset + AUDIO_CHUNK_BYTES, bytes.length);
    const chunkLen = end - offset;
    const chunkBuf = new ArrayBuffer(chunkLen);
    new Uint8Array(chunkBuf).set(bytes.subarray(offset, end));
    sessionAny.sendAudio(chunkBuf, { commit: end >= bytes.length });
    offset = end;
  }
}

/**
 * Send text message to OpenAI Realtime API.
 * Cancels any in-progress model response first, then sends the new text message.
 * This ensures the model stops speaking and responds to the new text input immediately.
 */
export async function sendTextMessage(text: string): Promise<void> {
  if (!session) {
    throw new Error('Not connected. Connect first before sending text.');
  }

  const sessionAny = session as any;
  if (typeof sessionAny.sendMessage !== 'function') {
    throw new Error('Session does not support sendMessage method');
  }

  try {
    // Step 1: Cancel any in-progress response to interrupt current speech
    console.log('🛑 Attempting to cancel current response before sending text...');
    console.log('📋 Current response ID:', currentResponseId);
    console.log('🔍 Session methods:', Object.getOwnPropertyNames(sessionAny));
    console.log('🔍 Session prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(sessionAny)));
    
    let cancelSent = false;
    
    // Method 1: Try sessionAny.send (direct client events)
    if (typeof sessionAny.send === 'function') {
      try {
        const cancelEvent: any = { type: 'response.cancel' };
        if (currentResponseId) {
          cancelEvent.response_id = currentResponseId;
        }
        sessionAny.send(cancelEvent);
        cancelSent = true;
        console.log('✅ Sent response.cancel via sessionAny.send');
      } catch (e) {
        console.warn('⚠️ Failed via sessionAny.send:', e);
      }
    }
    
    // Method 2: Try through realtime object
    if (!cancelSent && sessionAny.realtime) {
      console.log('🔍 Realtime object methods:', Object.getOwnPropertyNames(sessionAny.realtime));
      
      if (typeof sessionAny.realtime.send === 'function') {
        try {
          const cancelEvent: any = { type: 'response.cancel' };
          if (currentResponseId) {
            cancelEvent.response_id = currentResponseId;
          }
          sessionAny.realtime.send(cancelEvent);
          cancelSent = true;
          console.log('✅ Sent response.cancel via realtime.send');
        } catch (e) {
          console.warn('⚠️ Failed via realtime.send:', e);
        }
      }
      
      // Try sendClientEvent if available
      if (!cancelSent && typeof sessionAny.realtime.sendClientEvent === 'function') {
        try {
          sessionAny.realtime.sendClientEvent({ type: 'response.cancel' });
          cancelSent = true;
          console.log('✅ Sent response.cancel via realtime.sendClientEvent');
        } catch (e) {
          console.warn('⚠️ Failed via realtime.sendClientEvent:', e);
        }
      }
    }
    
    // Method 3: Try through transport layer
    if (!cancelSent && sessionAny.transport) {
      console.log('🔍 Transport object methods:', Object.getOwnPropertyNames(sessionAny.transport));
      
      if (typeof sessionAny.transport.send === 'function') {
        try {
          const cancelEvent: any = { type: 'response.cancel' };
          if (currentResponseId) {
            cancelEvent.response_id = currentResponseId;
          }
          sessionAny.transport.send(cancelEvent);
          cancelSent = true;
          console.log('✅ Sent response.cancel via transport.send');
        } catch (e) {
          console.warn('⚠️ Failed via transport.send:', e);
        }
      }
    }
    
    // Method 4: Try cancelResponse or interrupt methods
    if (!cancelSent) {
      if (typeof sessionAny.cancelResponse === 'function') {
        try {
          sessionAny.cancelResponse();
          cancelSent = true;
          console.log('✅ Called cancelResponse()');
        } catch (e) {
          console.warn('⚠️ Failed via cancelResponse:', e);
        }
      }
      
      if (!cancelSent && typeof sessionAny.interrupt === 'function') {
        try {
          sessionAny.interrupt();
          cancelSent = true;
          console.log('✅ Called interrupt()');
        } catch (e) {
          console.warn('⚠️ Failed via interrupt:', e);
        }
      }
    }
    
    if (cancelSent) {
      // Wait for cancel to be processed
      await new Promise(resolve => setTimeout(resolve, 300));
      currentResponseId = null;
    } else {
      console.warn('⚠️ Could not find method to cancel response');
      console.log('💡 Trying to interrupt by clearing audio buffer...');
      
      // Last resort: Try to clear audio buffer through sendMessage with empty text
      // This might trigger interruption
      try {
        if (typeof sessionAny.sendMessage === 'function') {
          // Send empty message first to potentially interrupt
          sessionAny.sendMessage('');
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (e) {
        console.warn('⚠️ Failed to send empty message:', e);
      }
    }
    
    // Step 2: Send the new user text message
    sessionAny.sendMessage(text);
    console.log('📤 Sent text message:', text.substring(0, 50));
  } catch (error) {
    console.error('❌ Failed to send text message:', error);
    throw error;
  }
}

// Function to get current agent and session
export function getAgent() {
  return agent;
}

export function getSession() {
  return session;
}

// Legacy exports for backward compatibility
export { agent, session };
