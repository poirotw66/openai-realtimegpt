import { RealtimeAgent, RealtimeSession } from '@openai/agents-realtime';
import { getCurrentTime } from './tools/getCurrentTime';

export function setupDebugTools(
    session: RealtimeSession, 
    agent: RealtimeAgent, 
    messageCallback: ((message: { role: 'user' | 'assistant'; content: string; timestamp: Date; isStreaming?: boolean }, messageId?: string) => void) | null
) {
    const sessionAny = session as any;

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
      
    (window as any).testCurrentTimeTool = () => {
        console.log('🕒 Testing get_current_time tool...');
        const result = getCurrentTime({ format: 'full', timezone: 'Asia/Taipei' });
        console.log('Tool result:', result);
    };
      
    (window as any).simulateTimeQuery = () => {
        console.log('🎭 Simulating time query conversation...');
        if (messageCallback) {
          // Simulate user asking for time
          setTimeout(() => {
            if (messageCallback) {
              messageCallback({
                role: 'user',
                content: '現在幾點了？',
                timestamp: new Date(),
                isStreaming: false
              }, `user-time-${Date.now()}`);
            }
          }, 500);
          
          // Simulate tool call and response
          setTimeout(() => {
            const result = getCurrentTime();
            if (messageCallback) {
              messageCallback({
                role: 'assistant',
                content: `現在時間是 ${result.current_time}`,
                timestamp: new Date(),
                isStreaming: false
              }, `assistant-time-${Date.now()}`);
            }
          }, 1500);
        }
    };
      
    (window as any).debugSession = () => {
        console.log('🔍 Session debugging info:');
        console.log('Session object:', session);
        console.log('Session methods:', Object.getOwnPropertyNames(session));
        console.log('Session prototype:', Object.getOwnPropertyNames(Object.getPrototypeOf(session)));
        
        if (sessionAny.realtime) {
          console.log('Realtime connection:', sessionAny.realtime);
          console.log('Realtime methods:', Object.getOwnPropertyNames(sessionAny.realtime));
        }
        
        // Try to check current session state
        if (sessionAny.getSessionConfig || sessionAny.config || sessionAny.session) {
          console.log('Current session config:', sessionAny.getSessionConfig?.() || sessionAny.config || sessionAny.session);
        }
    };
      
    (window as any).sendManualToolCall = () => {
        console.log('🔧 Sending manual tool call...');
        
        if (sessionAny.send) {
          try {
            sessionAny.send({
              type: 'response.create',
              response: {
                modalities: ['text'],
                instructions: 'Please call the get_current_time function to tell me what time it is now.'
              }
            });
            console.log('✅ Manual tool call request sent');
          } catch (error) {
            console.error('❌ Failed to send manual tool call:', error);
          }
        }
    };
      
    (window as any).forceCompleteResponse = () => {
        console.log('🚨 Force completing stuck response...');
        
        if (sessionAny.send) {
          try {
            // Try to cancel current response and create new one
            sessionAny.send({
              type: 'response.cancel'
            });
            console.log('✅ Response cancel sent');
            
            setTimeout(() => {
              sessionAny.send({
                type: 'response.create'
              });
              console.log('✅ New response created');
            }, 500);
            
          } catch (error) {
            console.error('❌ Failed to force complete:', error);
          }
        }
    };
      
    (window as any).sendTimeResult = () => {
        console.log('🕒 Manually sending time result...');
        const result = getCurrentTime();
        
        if (sessionAny.send) {
          try {
            // Try to add function call output
            sessionAny.send({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: `manual-${Date.now()}`,
                output: JSON.stringify(result)
              }
            });
            console.log('✅ Manual time result sent');
            
            // Then try to create response
            setTimeout(() => {
              sessionAny.send({
                type: 'response.create'
              });
              console.log('✅ Response create sent after manual result');
            }, 500);
            
          } catch (error) {
            console.error('❌ Failed to send manual time result:', error);
          }
        }
        
        // Also display in UI
        if (messageCallback) {
          messageCallback({
            role: 'assistant',
            content: `🕒 當前時間: ${result.current_time}`,
            timestamp: new Date(),
            isStreaming: false
          }, `manual-time-${Date.now()}`);
        }
    };
      
    console.log('🧪 Test methods added to window: testSession, testAgent, sendTestMessage()');
}
