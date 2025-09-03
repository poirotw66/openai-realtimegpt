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
let messageCallback: ((message: { role: 'user' | 'assistant'; content: string; timestamp: Date; isStreaming?: boolean }, messageId?: string) => void) | null = null;

// Function to set the message callback
export function setMessageCallback(callback: (message: { role: 'user' | 'assistant'; content: string; timestamp: Date; isStreaming?: boolean }, messageId?: string) => void) {
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
        
        // Listen for streaming and completion events
        const allEvents = [
          // Delta events for real-time streaming
          'conversation.item.input_audio_transcription.delta',
          'response.audio_transcript.delta', 
          'response.text.delta',
          
          // Completion events
          'conversation.item.input_audio_transcription.completed',
          'response.audio_transcript.done',
          'response.text.done',
          
          // Session events
          'response.created',
          'input_audio_buffer.speech_started',
          'input_audio_buffer.speech_stopped',
          
          // Additional possible event names
          'conversation.item.created',
          'response.output_item_added',
          'response.content_part.added',
          'response.audio.delta',
          'response.function_call_arguments.delta',
          'conversation.updated',
          'response.done',
          'conversation.item.completed',
          'conversation.item.truncated'
        ];
        
        // Store current streaming messages
        let currentUserMessage = '';
        let currentAssistantMessage = '';
        let userMessageId = '';
        let assistantMessageId = '';
        
        allEvents.forEach(eventName => {
          try {
            eventMethod.call(sessionAny, eventName, (event: any) => {
              console.log(`🎧 Event [${eventName}]:`, event);
              
              // Handle user speech transcription delta (real-time)
              if (eventName === 'conversation.item.input_audio_transcription.delta' && messageCallback) {
                if (event.delta) {
                  currentUserMessage += event.delta;
                  if (!userMessageId) {
                    userMessageId = `user-${Date.now()}`;
                  }
                  messageCallback({
                    role: 'user',
                    content: currentUserMessage,
                    timestamp: new Date(),
                    isStreaming: true
                  }, userMessageId);
                }
              }
              
              // Handle user speech transcription completion
              if (eventName === 'conversation.item.input_audio_transcription.completed' && messageCallback) {
                const transcript = event.transcript || event.text || event.content;
                if (transcript) {
                  console.log('📝 Adding user message (completed):', transcript);
                  currentUserMessage = transcript;
                  messageCallback({
                    role: 'user',
                    content: transcript,
                    timestamp: new Date(),
                    isStreaming: false
                  }, userMessageId);
                  // Reset for next message
                  currentUserMessage = '';
                  userMessageId = '';
                }
              }
              
              // Handle assistant audio transcript delta (real-time)
              if (eventName === 'response.audio_transcript.delta' && messageCallback) {
                if (event.delta) {
                  currentAssistantMessage += event.delta;
                  if (!assistantMessageId) {
                    assistantMessageId = `assistant-${Date.now()}`;
                  }
                  messageCallback({
                    role: 'assistant',
                    content: currentAssistantMessage,
                    timestamp: new Date(),
                    isStreaming: true
                  }, assistantMessageId);
                }
              }
              
              // Handle assistant text delta (real-time)
              if (eventName === 'response.text.delta' && messageCallback) {
                if (event.delta) {
                  currentAssistantMessage += event.delta;
                  if (!assistantMessageId) {
                    assistantMessageId = `assistant-${Date.now()}`;
                  }
                  messageCallback({
                    role: 'assistant',
                    content: currentAssistantMessage,
                    timestamp: new Date(),
                    isStreaming: true
                  }, assistantMessageId);
                }
              }
              
              // Handle assistant audio transcript completion
              if (eventName === 'response.audio_transcript.done' && messageCallback) {
                const content = event.transcript;
                if (content) {
                  console.log('🔊 Adding assistant response (audio transcript done):', content);
                  currentAssistantMessage = content;
                  messageCallback({
                    role: 'assistant',
                    content: content,
                    timestamp: new Date(),
                    isStreaming: false
                  }, assistantMessageId);
                  // Reset for next message
                  currentAssistantMessage = '';
                  assistantMessageId = '';
                }
              }
              
              // Handle assistant text completion
              if (eventName === 'response.text.done' && messageCallback) {
                const content = event.text;
                if (content) {
                  console.log('💬 Adding assistant response (text done):', content);
                  currentAssistantMessage = content;
                  messageCallback({
                    role: 'assistant',
                    content: content,
                    timestamp: new Date(),
                    isStreaming: false
                  }, assistantMessageId);
                  // Reset for next message
                  currentAssistantMessage = '';
                  assistantMessageId = '';
                }
              }
              
              // Handle response creation (prepare for new assistant message)
              if (eventName === 'response.created') {
                assistantMessageId = event.response?.id || `assistant-${Date.now()}`;
                currentAssistantMessage = '';
                console.log('🚀 New assistant response created, ID:', assistantMessageId);
              }
              
              // Handle speech start (prepare for new user message)
              if (eventName === 'input_audio_buffer.speech_started') {
                userMessageId = `user-${Date.now()}`;
                currentUserMessage = '';
                console.log('🎤 User started speaking, ID:', userMessageId);
              }
              
              // Handle additional possible event formats
              if (eventName === 'response.output_item_added' && messageCallback) {
                const item = event.item;
                if (item && item.content && Array.isArray(item.content)) {
                  for (const content of item.content) {
                    if (content.type === 'text' && content.text) {
                      console.log('📄 Output item added (text):', content.text);
                      if (!assistantMessageId) {
                        assistantMessageId = `assistant-${Date.now()}`;
                      }
                      messageCallback({
                        role: 'assistant',
                        content: content.text,
                        timestamp: new Date(),
                        isStreaming: false
                      }, assistantMessageId);
                    }
                  }
                }
              }
              
              if (eventName === 'response.content_part.added' && messageCallback) {
                const part = event.part;
                if (part && part.type === 'text' && part.text) {
                  console.log('📝 Content part added (text):', part.text);
                  if (!assistantMessageId) {
                    assistantMessageId = `assistant-${Date.now()}`;
                  }
                  currentAssistantMessage += part.text;
                  messageCallback({
                    role: 'assistant',
                    content: currentAssistantMessage,
                    timestamp: new Date(),
                    isStreaming: true
                  }, assistantMessageId);
                }
              }
              
              if (eventName === 'conversation.item.created' && messageCallback) {
                const item = event.item;
                if (item && item.role === 'assistant' && item.content && Array.isArray(item.content)) {
                  for (const content of item.content) {
                    if (content.type === 'text' && content.text) {
                      console.log('💬 Conversation item created (assistant text):', content.text);
                      if (!assistantMessageId) {
                        assistantMessageId = item.id || `assistant-${Date.now()}`;
                      }
                      messageCallback({
                        role: 'assistant',
                        content: content.text,
                        timestamp: new Date(),
                        isStreaming: false
                      }, assistantMessageId);
                    }
                  }
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
              
              // Log EVERYTHING during real conversation
              console.log(`🔍 Event details for ${eventType}:`, {
                type: eventType,
                data: eventData,
                keys: eventData ? Object.keys(eventData) : [],
                stringified: JSON.stringify(eventData, null, 2)
              });
              
              // Try to capture any response-related events that we might have missed
              if (eventType.includes('response') || eventType.includes('transcript') || eventType.includes('text') || eventType.includes('audio') || eventType.includes('conversation')) {
                console.log(`🔥 重要事件 [${eventType}]:`, JSON.stringify(eventData, null, 2));
                
                // Emergency fallback - try to extract any text content from ANY field
                if (messageCallback && eventData) {
                  // Check multiple possible text fields
                  const possibleTextFields = [
                    'text', 'transcript', 'content', 'delta', 'message', 'response', 'output',
                    'item.content', 'item.text', 'item.transcript', 'content.text', 'part.text'
                  ];
                  
                  let foundText: string | null = null;
                  
                  // Direct field check
                  for (const field of possibleTextFields) {
                    if (field.includes('.')) {
                      // Nested field check
                      const [parent, child] = field.split('.');
                      if (eventData[parent] && eventData[parent][child]) {
                        foundText = eventData[parent][child];
                        console.log(`🎯 Found text in nested field ${field}:`, foundText);
                        break;
                      }
                    } else {
                      // Direct field check
                      if (eventData[field]) {
                        foundText = eventData[field];
                        console.log(`🎯 Found text in field ${field}:`, foundText);
                        break;
                      }
                    }
                  }
                  
                  // Deep object search
                  if (!foundText && typeof eventData === 'object') {
                    const searchForText = (obj: any, path = ''): string | null => {
                      if (typeof obj === 'string' && obj.length > 0 && obj.length < 1000) {
                        console.log(`🔎 Found string at ${path}:`, obj);
                        return obj;
                      }
                      if (typeof obj === 'object' && obj !== null) {
                        for (const key in obj) {
                          if (obj.hasOwnProperty(key)) {
                            const result = searchForText(obj[key], path ? `${path}.${key}` : key);
                            if (result) return result;
                          }
                        }
                      }
                      return null;
                    };
                    
                    foundText = searchForText(eventData);
                  }
                  
                  if (foundText && typeof foundText === 'string' && foundText.length > 0) {
                    console.log(`🚨 緊急回退：從事件 ${eventType} 提取文字:`, foundText);
                    messageCallback({
                      role: 'assistant',
                      content: `[${eventType}] ${foundText}`,
                      timestamp: new Date(),
                      isStreaming: false
                    }, `emergency-${Date.now()}`);
                  }
                }
              }
            });
            console.log('✅ Enhanced wildcard event listener registered');
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
          // Test streaming message
          const testId = `test-${Date.now()}`;
          const testMessage = '這是一個測試流式消息，會逐字顯示...';
          
          // Simulate streaming
          let currentText = '';
          for (let i = 0; i < testMessage.length; i++) {
            setTimeout(() => {
              currentText += testMessage[i];
              if (messageCallback) {
                messageCallback({
                  role: 'assistant',
                  content: currentText,
                  timestamp: new Date(),
                  isStreaming: i < testMessage.length - 1
                }, testId);
              }
            }, i * 100);
          }
        }
      };
      
      // Add event listener testing
      (window as any).testEventListeners = () => {
        console.log('🔧 Testing event listeners...');
        console.log('Session object:', session);
        console.log('Session methods:', Object.getOwnPropertyNames(session));
        console.log('Session prototype:', Object.getOwnPropertyNames(Object.getPrototypeOf(session)));
        
        // Try to manually trigger events for testing
        if (sessionAny.emit) {
          console.log('✅ Session has emit method');
          try {
            sessionAny.emit('response.text.done', { text: '手動測試 AI 回應' });
          } catch (e) {
            console.log('❌ Manual emit failed:', e);
          }
        }
      };
      
      // Add real-time conversation test
      (window as any).simulateConversation = () => {
        console.log('🎭 Simulating real conversation...');
        if (messageCallback) {
          // Simulate user speaking
          setTimeout(() => {
            if (messageCallback) {
              messageCallback({
                role: 'user',
                content: '你好，我想測試語音功能',
                timestamp: new Date(),
                isStreaming: false
              }, `user-sim-${Date.now()}`);
            }
          }, 500);
          
          // Simulate AI response with streaming
          setTimeout(() => {
            const responses = [
              '你好！',
              '你好！我',
              '你好！我是',
              '你好！我是語音',
              '你好！我是語音助手',
              '你好！我是語音助手，',
              '你好！我是語音助手，很高興',
              '你好！我是語音助手，很高興為您',
              '你好！我是語音助手，很高興為您服務！'
            ];
            
            const assistantId = `assistant-sim-${Date.now()}`;
            responses.forEach((text, i) => {
              setTimeout(() => {
                if (messageCallback) {
                  messageCallback({
                    role: 'assistant',
                    content: text,
                    timestamp: new Date(),
                    isStreaming: i < responses.length - 1
                  }, assistantId);
                }
              }, i * 200);
            });
          }, 2000);
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
