import { RealtimeAgent, RealtimeSession } from '@openai/agents-realtime';
import { tools } from './tools';
import { setMessageCallbackForTools } from './tools/getCurrentTime';
import { setupEventHandlers } from './sessionHandler';
import { setupDebugTools } from './debug';

// Create your first Agent
const agent = new RealtimeAgent({
  name: 'Assistant',
  instructions: 'You are a helpful assistant. Always respond in the same language as the user. 如果用戶說中文，請用中文回答。You have access to a get_current_time tool to check the current time when users ask about time.',
  tools: tools
});

// Create a Realtime Session. gpt-4o-mini-realtime-preview gpt-realtime gpt-4o-realtime-preview	
const session = new RealtimeSession(agent, {
  model: 'gpt-4o-mini-realtime-preview',
});

// Store the message callback function
let messageCallback: ((message: { role: 'user' | 'assistant'; content: string; timestamp: Date; isStreaming?: boolean }, messageId?: string) => void) | null = null;

// Function to set the message callback
export function setMessageCallback(callback: (message: { role: 'user' | 'assistant'; content: string; timestamp: Date; isStreaming?: boolean }, messageId?: string) => void) {
  messageCallback = callback;
  setMessageCallbackForTools(callback);
}

// Function to connect to the session
export async function connectSession(apiKey: string) {
  try {
    console.log('Attempting to connect with API key:', apiKey.substring(0, 20) + '...');
    
    // Automatically connects your microphone and audio output
    // in the browser via WebRTC.
    await session.connect({
      apiKey: apiKey,
    });
    
    console.log('Successfully connected to RealtimeSession');

    // Setup event handlers
    setupEventHandlers(session, messageCallback);

    // Add manual testing methods in development
    if (import.meta.env.DEV) {
      setupDebugTools(session, agent, messageCallback);
    }
    
    return session;
  } catch (error) {
    console.error('❌ Failed to connect to RealtimeSession:', error);
    throw error;
  }
}

export { agent, session };
