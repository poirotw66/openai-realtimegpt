import { RealtimeAgent, RealtimeSession } from '@openai/agents-realtime';
import { tools } from './tools';
import { setMessageCallbackForTools } from './tools/getCurrentTime';
import { groundingMCPServer } from './mcp/mcpServer';
import { setupEventHandlers } from './sessionHandler';
import { setupDebugTools } from './debug';

// Global variables for agent and session
let agent: RealtimeAgent | null = null;
let session: RealtimeSession | null = null;

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
  
  // Create agent with all tools
  agent = new RealtimeAgent({
    name: 'Assistant',
    instructions: 'You are a helpful assistant. Always respond in the same language as the user. 如果用戶說中文，請用中文回答。You have access to tools including get_current_time for time queries and grounded_search for web searches and current information.',
    tools: allTools
  });
// gpt-4o-realtime-preview-2025-06-03 gpt-4o-mini-realtime-preview=gpt-4o-mini-realtime-preview-2024-12-17
// gpt-realtime-2025-08-28
// Create session
  session = new RealtimeSession(agent, {
    model: 'gpt-4o-realtime-preview-2025-06-03',
  });

  return { agent, session };
}

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
    
    // Create agent and session with all tools (including MCP tools)
    const { agent: newAgent, session: newSession } = await createAgentWithTools();
    agent = newAgent;
    session = newSession;
    
    // Automatically connects your microphone and audio output
    // in the browser via WebRTC.
    await session.connect({
      apiKey: apiKey,
    });
    
    console.log('Successfully connected to RealtimeSession');

    // Setup event handlers
    setupEventHandlers(session, messageCallback);

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

// Function to get current agent and session
export function getAgent() {
  return agent;
}

export function getSession() {
  return session;
}

// Legacy exports for backward compatibility
export { agent, session };
