import { getCurrentTime } from './tools/getCurrentTime';

export function setupEventHandlers(session: any, messageCallback: ((message: { role: 'user' | 'assistant'; content: string; timestamp: Date; isStreaming?: boolean }, messageId?: string) => void) | null) {
    const sessionAny = session as any;

    if (!sessionAny.on && !sessionAny.addEventListener && !sessionAny.addListener) {
        console.log('❌ No event listener methods found on session');
        return;
    }

    console.log('✅ Found event listener methods on session');
    const eventMethod = sessionAny.on || sessionAny.addEventListener || sessionAny.addListener;

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
      'conversation.item.truncated',
      
      // Tool/Function call events
      'response.function_call_arguments.done',
      'conversation.item.function_call_output.added',
      'session.tool_call',
      'function_call',
      'response.function_call_arguments.delta',
      'conversation.item.input_audio_transcription.delta'
    ];

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
              
              // Handle function/tool calls
              if (eventName === 'response.function_call_arguments.done' && event.name === 'get_current_time') {
                console.log('🔧 Function call for get_current_time:', event);
                console.log('完整事件對象:', JSON.stringify(event, null, 2));
                try {
                  let params = {};
                  if (event.arguments) {
                    try {
                      params = JSON.parse(event.arguments);
                      console.log('✅ 解析參數成功:', params);
                    } catch (e) {
                      console.log('參數解析失敗，使用默認參數:', e);
                    }
                  }
                  
                  console.log('🕒 開始執行 getCurrentTime...');
                  const result = getCurrentTime(params);
                  console.log('🕒 Tool execution result:', result);
                  
                  // Send the result back to the session using the correct method
                  if (sessionAny.send) {
                    const payload = {
                      type: 'conversation.item.create',
                      item: {
                        type: 'function_call_output',
                        call_id: event.call_id,
                        output: JSON.stringify(result)
                      }
                    };
                    console.log('📤 發送工具結果:', payload);
                    sessionAny.send(payload);
                    console.log('✅ Function call output sent to session');
                    
                    // 重要：發送工具結果後，需要觸發新的回應
                    setTimeout(() => {
                      console.log('🔄 觸發 response.create...');
                      sessionAny.send({
                        type: 'response.create'
                      });
                      console.log('✅ Triggered new response after tool call');
                    }, 100);
                    
                  } else if (sessionAny.addFunctionCallOutput) {
                    sessionAny.addFunctionCallOutput({
                      call_id: event.call_id,
                      output: JSON.stringify(result)
                    });
                  } else if (sessionAny.realtime && sessionAny.realtime.send) {
                    sessionAny.realtime.send({
                      type: 'conversation.item.create',
                      item: {
                        type: 'function_call_output',
                        call_id: event.call_id,
                        output: JSON.stringify(result)
                      }
                    });
                    
                    // Also trigger response here
                    setTimeout(() => {
                      sessionAny.realtime.send({
                        type: 'response.create'
                      });
                      console.log('✅ Triggered new response after tool call (realtime)');
                    }, 100);
                  }
                } catch (error) {
                  console.error('❌ Error executing get_current_time:', error);
                  console.error('錯誤堆棧:', error.stack);
                }
              }
              
              // Handle function call arguments delta (streaming)
              if (eventName === 'response.function_call_arguments.delta' && event.name === 'get_current_time') {
                console.log('🔧 Function call arguments delta:', event);
                // This might contain partial arguments as they're being built
              }
              
              if ((eventName === 'session.tool_call' || eventName === 'function_call') && event.name === 'get_current_time') {
                console.log('🔧 Tool call detected:', event);
                try {
                  let params = {};
                  if (event.parameters || event.arguments) {
                    const paramString = event.parameters || event.arguments;
                    try {
                      params = typeof paramString === 'string' ? JSON.parse(paramString) : paramString;
                    } catch (e) {
                      console.log('Using default parameters for tool call');
                    }
                  }
                  
                  const result = getCurrentTime(params);
                  console.log('🕒 Tool execution result:', result);
                  
                  // Send result back if we have a call_id
                  if (event.call_id && sessionAny.send) {
                    sessionAny.send({
                      type: 'conversation.item.create',
                      item: {
                        type: 'function_call_output',
                        call_id: event.call_id,
                        output: JSON.stringify(result)
                      }
                    });
                    
                    // Trigger new response
                    setTimeout(() => {
                      sessionAny.send({
                        type: 'response.create'
                      });
                      console.log('✅ Triggered new response after session tool call');
                    }, 100);
                  }
                } catch (error) {
                  console.error('❌ Error executing get_current_time:', error);
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
              
              // 特別關注工具調用相關的事件
              if (eventType.includes('function') || eventType.includes('tool') || 
                  eventType.includes('call') || eventType.includes('arguments')) {
                console.log(`🚨 工具相關事件 [${eventType}]:`, JSON.stringify(eventData, null, 2));
                
                // 如果是 get_current_time 工具調用
                if (eventData && (
                  eventData.name === 'get_current_time' || 
                  (eventData.function && eventData.function.name === 'get_current_time') ||
                  (eventData.item && eventData.item.name === 'get_current_time') ||
                  (eventData.type === 'function' && eventData.name === 'get_current_time')
                )) {
                  console.log('🔧 檢測到 get_current_time 工具調用！');
                  console.log('事件類型:', eventType);
                  console.log('事件數據:', eventData);
                  
                  // 立即執行工具並返回結果
                  try {
                    let params = {};
                    
                    // 嘗試從多個可能的位置提取參數
                    const possibleParams = [
                      eventData.arguments,
                      eventData.function?.arguments,
                      eventData.item?.arguments,
                      eventData.parameters,
                      eventData.function?.parameters
                    ];
                    
                    for (const paramSource of possibleParams) {
                      if (paramSource) {
                        try {
                          params = typeof paramSource === 'string' ? JSON.parse(paramSource) : paramSource;
                          console.log('✅ 成功提取參數:', params);
                          break;
                        } catch (e) {
                          console.log('參數解析失敗，使用默認參數');
                        }
                      }
                    }
                    
                    console.log('🕒 執行 getCurrentTime 工具...');
                    const result = getCurrentTime(params);
                    console.log('🕒 工具執行結果:', result);
                    
                    // 嘗試多種方式發送結果
                    const callId = eventData.call_id || eventData.id || eventData.item?.id || `emergency-${Date.now()}`;
                    console.log('📤 使用 call_id:', callId);
                    
                    // 方法1: conversation.item.create
                    if (sessionAny.send) {
                      try {
                        const itemCreate = {
                          type: 'conversation.item.create',
                          item: {
                            type: 'function_call_output',
                            call_id: callId,
                            output: JSON.stringify(result)
                          }
                        };
                        console.log('📤 發送工具結果 (方法1):', itemCreate);
                        sessionAny.send(itemCreate);
                        console.log('✅ 方法1: conversation.item.create 發送成功');
                        
                        // 觸發新的回應
                        setTimeout(() => {
                          sessionAny.send({ type: 'response.create' });
                          console.log('✅ 觸發 response.create');
                        }, 200);
                        
                      } catch (e) {
                        console.error('❌ 方法1失敗:', e);
                      }
                    }
                    
                    // 方法2: 通過 realtime 連接
                    if (sessionAny.realtime && sessionAny.realtime.send) {
                      try {
                        sessionAny.realtime.send({
                          type: 'conversation.item.create',
                          item: {
                            type: 'function_call_output',
                            call_id: callId,
                            output: JSON.stringify(result)
                          }
                        });
                        console.log('✅ 方法2: realtime.send 發送成功');
                      } catch (e) {
                        console.error('❌ 方法2失敗:', e);
                      }
                    }
                    
                  } catch (error) {
                    console.error('❌ 緊急工具處理失敗:', error);
                  }
                }
              }
              
              // Try to capture any response-related events that we might have missed
              if (eventType.includes('response') || eventType.includes('transcript') || eventType.includes('text') || eventType.includes('audio') || eventType.includes('conversation')) {
                console.log(`🔥 重要事件 [${eventType}]:`, JSON.stringify(eventData, null, 2));
                
                // Emergency fallback - try to extract any text content
                if (messageCallback && eventData) {
                  const possibleText = eventData.text || eventData.transcript || eventData.content || eventData.delta;
                  if (possibleText && typeof possibleText === 'string' && possibleText.length > 0) {
                    console.log(`🚨 緊急回退：從事件 ${eventType} 提取文字:`, possibleText);
                    messageCallback({
                      role: 'assistant',
                      content: `${possibleText}`,
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
