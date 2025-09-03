import { RealtimeAgent, RealtimeSession } from '@openai/agents-realtime';

// Create your first Agent
const agent = new RealtimeAgent({
  name: 'Assistant',
  instructions: 'You are a helpful assistant.',
});

// Create a session
const session = new RealtimeSession(agent, {
  model: 'gpt-realtime',
});

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
    return session;
  } catch (error) {
    console.error('Failed to connect to RealtimeSession:', error);
    throw error;
  }
}

// Export agent and session for use in other files
export { agent, session };
