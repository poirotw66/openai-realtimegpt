import { RealtimeAgent, RealtimeSession } from '@openai/agents-realtime';

// Create your first Agent
const agent = new RealtimeAgent({
  name: 'Assistant',
  instructions: 'You are a helpful assistant. Always respond in the same language as the user. 如果用戶說中文，請用中文回答。',
});

// Create a Realtime Session. gpt-4o-mini-realtime-preview gpt-realtime gpt-4o-realtime-preview	
const session = new RealtimeSession(agent, {
  model: 'gpt-4o-mini-realtime-preview',
});

// Store the message callback function
let messageCallback: ((message: { role: 'user' | 'assistant'; content: string; timestamp: Date }) => void) | null = null;

// Function to set the message callback
export function setMessageCallback(callback: (message: { role: 'user' | 'assistant'; content: string; timestamp: Date }) => void) {
  messageCallback = callback;
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
    console.log('Session object properties:', Object.keys(session));
    console.log('Session prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(session)));
    
    // Set up event listeners using @openai/agents-realtime API
    try {
      console.log('Searching for event methods...');
      
      const sessionAny = session as any;
      
      // Check if session has emit/on methods
      if (sessionAny.on || sessionAny.addEventListener || sessionAny.addListener) {
        console.log('✅ Found event listener methods on session');
        
        const eventMethod = sessionAny.on || sessionAny.addEventListener || sessionAny.addListener;
        
        // Listen only for key events to avoid duplicates
        const importantEvents = [
          'conversation.item.input_audio_transcription.completed',
          'response.audio_transcript.done',
          'response.text.done'
        ];
        
        importantEvents.forEach(eventName => {
          try {
            eventMethod.call(sessionAny, eventName, (event: any) => {
              console.log(`🎧 Event [${eventName}]:`, event);
              console.log(`🎧 Event [${eventName}] full object:`, JSON.stringify(event, null, 2));
              
              // Handle user speech transcription
              if (eventName === 'conversation.item.input_audio_transcription.completed' && messageCallback) {
                const transcript = event.transcript || event.text || event.content;
                if (transcript) {
                  console.log('📝 Adding user message:', transcript);
                  messageCallback({
                    role: 'user',
                    content: transcript,
                    timestamp: new Date()
                  });
                }
              }
              
              // Handle assistant responses - prefer audio_transcript.done for complete response
              if (eventName === 'response.audio_transcript.done' && messageCallback) {
                const content = event.transcript;
                if (content) {
                  console.log('🔊 Adding assistant response (audio transcript done):', content);
                  messageCallback({
                    role: 'assistant',
                    content: content,
                    timestamp: new Date()
                  });
                }
              }
              
              // Fallback to text.done if audio transcript not available
              if (eventName === 'response.text.done' && messageCallback) {
                const content = event.text;
                if (content) {
                  console.log('💬 Adding assistant response (text done):', content);
                  messageCallback({
                    role: 'assistant',
                    content: content,
                    timestamp: new Date()
                  });
                }
              }
            });
            console.log(`✅ Registered listener for: ${eventName}`);
          } catch (err) {
            console.log(`❌ Failed to register ${eventName}:`, err);
          }
        });
        
        // Also try to listen for ALL events using wildcard for debugging
        try {
          if (sessionAny.on) {
            sessionAny.on('*', (eventType: string, eventData: any) => {
              console.log(`🌟 Wildcard event [${eventType}]:`, eventData);
            });
            console.log('✅ Wildcard event listener registered');
          }
        } catch (wildcardErr) {
          console.log('❌ Wildcard listener failed:', wildcardErr);
        }
      }
      
      console.log('🔧 Event listener setup completed for @openai/agents-realtime');
      
      // Add manual testing methods
      (window as any).testSession = session;
      (window as any).testAgent = agent;
      (window as any).sendTestMessage = () => {
        console.log('🧪 Sending test message...');
        if (messageCallback) {
          messageCallback({
            role: 'user',
            content: '測試用戶消息',
            timestamp: new Date()
          });
          messageCallback({
            role: 'assistant',
            content: '測試 AI 回覆',
            timestamp: new Date()
          });
        }
      };
      
      console.log('🧪 Test methods added to window: testSession, testAgent, sendTestMessage()');
      
    } catch (eventError) {
      console.error('❌ Event listener setup failed:', eventError);
    }
    
    return session;
  } catch (error) {
    console.error('❌ Failed to connect to RealtimeSession:', error);
    throw error;
  }
}

export { agent, session };
