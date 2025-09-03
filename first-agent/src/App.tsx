import { useState, useEffect, useRef } from 'react'
import './App.css'
import { connectSession, setMessageCallback } from './agent'

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  messageId?: string;
}

function App() {
  const [count, setCount] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isListening, setIsListening] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Add debug message function
  const addDebugInfo = (info: string) => {
    console.log('Debug:', info)
    setDebugInfo(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${info}`])
  }

  // Set up message callback when component mounts
  useEffect(() => {
    setMessageCallback((message: Message, messageId?: string) => {
      console.log('Message received:', message, 'ID:', messageId)
      
      setMessages(prev => {
        // If this is a streaming update for an existing message, update it
        if (messageId && message.isStreaming) {
          const existingIndex = prev.findIndex(m => m.messageId === messageId)
          if (existingIndex !== -1) {
            const newMessages = [...prev]
            newMessages[existingIndex] = { ...message, messageId }
            return newMessages
          } else {
            // New streaming message
            return [...prev, { ...message, messageId }]
          }
        } else {
          // Final message or new message without streaming
          const finalMessage = { ...message, messageId: messageId || `${message.role}-${Date.now()}`, isStreaming: false }
          
          // If this was a streaming message, replace it
          if (messageId) {
            const existingIndex = prev.findIndex(m => m.messageId === messageId)
            if (existingIndex !== -1) {
              const newMessages = [...prev]
              newMessages[existingIndex] = finalMessage
              return newMessages
            }
          }
          
          // Add as new message
          return [...prev, finalMessage]
        }
      })
      
      addDebugInfo(`新消息: ${message.role} - ${message.content.substring(0, 50)}... (${message.isStreaming ? '流式中' : '完成'})`)
    })
  }, [])

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleConnect = async () => {
    if (!apiKey) {
      alert('Please enter your OpenAI API key')
      return
    }
    
    try {
      // Clear any existing messages
      setMessages([])
      addDebugInfo('開始連接...')
      
      await connectSession(apiKey)
      setIsConnected(true)
      setIsListening(true)
      addDebugInfo('連接成功！')
      
      // Add a system message to indicate connection
      setMessages([{
        role: 'assistant',
        content: '🔗 已連接到語音助手！請開始說話...',
        timestamp: new Date()
      }])
      
    } catch (error) {
      console.error('Connection error:', error)
      addDebugInfo(`連接錯誤: ${error}`)
      alert('Failed to connect. Please check your API key and try again.')
    }
  }

  // Test function to simulate AI response
  const testAIResponse = () => {
    const testResponses = [
      '你好！我是 AI 助手，很高興為您服務。',
      '我可以幫助您回答問題和進行對話。',
      '請問有什麼我可以協助您的嗎？',
      '您的中文說得很好！',
      '今天天氣真不錯，適合出門走走。'
    ]
    
    const randomResponse = testResponses[Math.floor(Math.random() * testResponses.length)]
    
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: randomResponse,
      timestamp: new Date()
    }])
    
    addDebugInfo(`測試 AI 回應: ${randomResponse}`)
  }

  // Manual voice test function
  const testVoiceRecognition = async () => {
    addDebugInfo('開始手動語音測試...')
    
    try {
      // Get user's microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      addDebugInfo('✅ 麥克風權限已獲得')
      
      // Create a simple speech recognition test
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
        const recognition = new SpeechRecognition()
        
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'zh-CN'
        
        recognition.onresult = (event: any) => {
          const transcript = event.results[event.results.length - 1][0].transcript
          addDebugInfo(`語音識別結果: ${transcript}`)
          setMessages(prev => [...prev, {
            role: 'user',
            content: transcript,
            timestamp: new Date()
          }])
        }
        
        recognition.onerror = (event: any) => {
          addDebugInfo(`語音識別錯誤: ${event.error}`)
        }
        
        recognition.start()
        addDebugInfo('✅ 瀏覽器語音識別已啟動')
        
        // Stop after 10 seconds
        setTimeout(() => {
          recognition.stop()
          addDebugInfo('語音識別已停止')
        }, 10000)
        
      } else {
        addDebugInfo('❌ 瀏覽器不支持語音識別')
      }
      
      // Stop the stream
      stream.getTracks().forEach(track => track.stop())
      
    } catch (error) {
      addDebugInfo(`麥克風測試失敗: ${error}`)
    }
  }

  return (
    <>
      <h1>OpenAI Realtime Agent</h1>
      
      <div className="card">
        {!isConnected ? (
          <div>
            <input
              type="password"
              placeholder="Enter your OpenAI API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{ marginBottom: '10px', padding: '5px', width: '300px' }}
            />
            <br />
            <button onClick={handleConnect}>
              Connect to Voice Assistant
            </button>
          </div>
        ) : (
          <div>
            <h2>🎤 Voice Assistant Connected!</h2>
            <p>You can now start talking to your assistant.</p>
            <p>Grant microphone access when prompted.</p>
            
            {/* Real-time conversation display */}
            <div className="conversation-container">
              <h3 style={{margin: '0 0 15px 0', color: '#4CAF50'}}>💬 即時對話內容</h3>
              
              {messages.length === 0 ? (
                <div style={{fontStyle: 'italic', color: '#666', textAlign: 'center', padding: '20px'}}>
                  開始說話，對話內容會顯示在這裡...
                </div>
              ) : (
                <div>
                  {messages.map((message, index) => (
                    <div key={message.messageId || index} className={`message ${message.role}`}>
                      <div className={`message-header ${message.role}`}>
                        {message.role === 'user' ? '🎤 您說' : '🤖 AI 回答'}
                        {message.isStreaming && (
                          <span className="streaming-indicator">⚡ 即時中...</span>
                        )}
                        <span className="timestamp">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="message-content" style={{
                        fontSize: '1.1em',
                        lineHeight: '1.6',
                        wordWrap: 'break-word',
                        opacity: message.isStreaming ? 0.8 : 1,
                        borderLeft: message.isStreaming ? '3px solid #4CAF50' : 'none',
                        paddingLeft: message.isStreaming ? '10px' : '0'
                      }}>
                        {message.content}
                        {message.isStreaming && (
                          <span className="typing-cursor" style={{
                            display: 'inline-block',
                            width: '2px',
                            height: '1.2em',
                            backgroundColor: '#4CAF50',
                            marginLeft: '2px',
                            animation: 'blink 1s infinite'
                          }}>▌</span>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {/* Auto scroll to bottom */}
                  <div style={{
                    textAlign: 'center',
                    padding: '10px',
                    fontSize: '0.9em',
                    color: '#666',
                    borderTop: '1px solid #eee',
                    marginTop: '10px'
                  }}>
                    共 {messages.length} 條對話
                  </div>
                  
                  {/* Invisible element for auto-scrolling */}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
            
            <div className="listening-indicator">
              <div className={`status-dot ${isListening ? 'listening' : ''}`}></div>
              <span style={{color: isListening ? '#4CAF50' : '#666'}}>
                {isListening ? '🎤 Listening...' : '🔇 Not listening'}
              </span>
            </div>
            
            {/* Test buttons */}
            <div style={{marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
              <button 
                onClick={testAIResponse}
                style={{
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                🧪 測試 AI 回應
              </button>
              
              <button 
                onClick={testVoiceRecognition}
                style={{
                  backgroundColor: '#FF9800',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                🎤 測試語音識別
              </button>
              
              <button 
                onClick={() => (window as any).sendTestMessage?.()}
                style={{
                  backgroundColor: '#9C27B0',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                🔧 測試事件系統
              </button>
              
              <button 
                onClick={() => (window as any).testEventListeners?.()}
                style={{
                  backgroundColor: '#607D8B',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                🔍 檢查事件監聽器
              </button>
              
              <button 
                onClick={() => (window as any).simulateConversation?.()}
                style={{
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                🎭 模擬完整對話
              </button>
              
              <button 
                onClick={() => (window as any).testCurrentTimeTool?.()}
                style={{
                  backgroundColor: '#FF5722',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                🕒 測試時間工具
              </button>
              
              <button 
                onClick={() => (window as any).simulateTimeQuery?.()}
                style={{
                  backgroundColor: '#795548',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                ⏰ 模擬時間查詢
              </button>
              
              <button 
                onClick={() => (window as any).debugSession?.()}
                style={{
                  backgroundColor: '#E91E63',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                🔍 調試 Session
              </button>
              
              <button 
                onClick={() => (window as any).sendManualToolCall?.()}
                style={{
                  backgroundColor: '#3F51B5',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                🛠️ 手動工具調用
              </button>
              
              <button 
                onClick={() => (window as any).forceCompleteResponse?.()}
                style={{
                  backgroundColor: '#F44336',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                🚨 強制完成回應
              </button>
              
              <button 
                onClick={() => (window as any).sendTimeResult?.()}
                style={{
                  backgroundColor: '#FF9800',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                ⏰ 手動發送時間
              </button>
            </div>
            
            {/* Debug panel */}
            <div style={{marginTop: '20px'}}>
              <details>
                <summary style={{cursor: 'pointer', fontWeight: 'bold'}}>
                  🔍 調試信息 ({debugInfo.length})
                </summary>
                <div style={{
                  maxHeight: '200px',
                  overflow: 'auto',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  padding: '10px',
                  margin: '10px 0',
                  backgroundColor: '#f9f9f9',
                  fontSize: '0.9em'
                }}>
                  {debugInfo.length === 0 ? (
                    <p style={{color: '#666', margin: 0}}>沒有調試信息</p>
                  ) : (
                    debugInfo.map((info, index) => (
                      <div key={index} style={{marginBottom: '5px', fontFamily: 'monospace'}}>
                        {info}
                      </div>
                    ))
                  )}
                </div>
              </details>
            </div>
          </div>
        )}
      </div>
      
      <p className="read-the-docs">
        Connect your OpenAI API key and start voice chatting!
      </p>
    </>
  )
}

export default App
