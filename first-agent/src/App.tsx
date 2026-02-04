import { useState, useEffect, useRef } from 'react';
import './App.css';
import { connectSession, disconnectSession, pauseSession, getSupportsPause, setMessageCallback, sendAudioFromFile, flushUserMessagesFromSession } from './agent';
import ConnectionView from './components/ConnectionView';
import ConversationView from './components/ConversationView';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  messageId?: string;
}

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [hasEnteredConversation, setHasEnteredConversation] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [supportsPause, setSupportsPause] = useState(false);
  const [testAudioSending, setTestAudioSending] = useState(false);
  const testAudioInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMessageCallback((message: Message, messageId?: string) => {
      // Hide initial greeting trigger (single dot sent to make model say hello)
      if (message.role === 'user' && message.content.trim() === '.') return;
      
      setMessages(prev => {
        if (messageId && message.isStreaming) {
          const existingIndex = prev.findIndex(m => m.messageId === messageId);
          if (existingIndex !== -1) {
            const newMessages = [...prev];
            newMessages[existingIndex] = { ...message, messageId };
            return newMessages;
          } else {
            return [...prev, { ...message, messageId }];
          }
        } else {
          const finalMessage = { ...message, messageId: messageId || `${message.role}-${Date.now()}`, isStreaming: false };
          
          if (messageId) {
            const existingIndex = prev.findIndex(m => m.messageId === messageId);
            if (existingIndex !== -1) {
              const newMessages = [...prev];
              newMessages[existingIndex] = finalMessage;
              return newMessages;
            }
          }
          
          return [...prev, finalMessage];
        }
      });
      
    });
  }, []);

  const handleConnect = async () => {
    try {
      if (!hasEnteredConversation) {
        setMessages([]);
      }
      
      await connectSession();
      setIsConnected(true);
      setIsListening(true);
      setHasEnteredConversation(true);
      
      setMessages((prev) => {
        if (prev.length === 0) {
          return [{
            role: 'assistant',
            content: '🔗 已連接到語音助手！請開始說話...',
            timestamp: new Date()
          }];
        }
        return prev;
      });
      
    } catch (error) {
      console.error('Connection error:', error);
      alert('Failed to connect. Ensure MCP proxy is running (npm run dev-full) and OPENAI_API_KEY is set in .env');
    }
  };

  const handleDisconnect = () => {
    disconnectSession();
    setIsConnected(false);
    setIsListening(false);
    setIsPaused(false);
    setSupportsPause(false);
  };

  const handlePauseToggle = () => {
    if (!supportsPause) return;
    const nextPaused = !isPaused;
    pauseSession(nextPaused);
    setIsPaused(nextPaused);
  };

  const handleSendTestAudio = async () => {
    const file = testAudioInputRef.current?.files?.[0];
    if (!file) {
      alert('請先選擇一個音檔（WAV、MP3 等）');
      return;
    }
    try {
      setTestAudioSending(true);
      await sendAudioFromFile(file);
      
      // Simple retry mechanism for transcription
      setTimeout(() => flushUserMessagesFromSession(), 1000);
      setTimeout(() => flushUserMessagesFromSession(), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`傳送失敗: ${msg}`);
    } finally {
      setTestAudioSending(false);
      if (testAudioInputRef.current) testAudioInputRef.current.value = '';
    }
  };

  const debugSessionHistory = () => {
    flushUserMessagesFromSession();
  };

  const testAIResponse = () => {
    const testResponses = [
      '你好！我是 AI 助手，很高興為您服務。',
      '我可以幫助您回答問題和進行對話。',
      '請問有什麼我可以協助您的嗎？',
      '您的中文說得很好！',
      '今天天氣真不錯，適合出門走走。'
    ];
    
    const randomResponse = testResponses[Math.floor(Math.random() * testResponses.length)];
    
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: randomResponse,
      timestamp: new Date()
    }]);
  };

  const testVoiceRecognition = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'zh-CN';
        
        recognition.onresult = (event: any) => {
          const transcript = event.results[event.results.length - 1][0].transcript;
          setMessages(prev => [...prev, {
            role: 'user',
            content: transcript,
            timestamp: new Date()
          }]);
        };
        
        recognition.start();
        
        setTimeout(() => {
          recognition.stop();
        }, 10000);
        
      }
      
      stream.getTracks().forEach(track => track.stop());
      
    } catch (error) {
      console.error('Voice test failed:', error);
    }
  };

  return (
    <>
      <h1>OpenAI Realtime Agent</h1>
      
      <div className="card">
        {!hasEnteredConversation ? (
          <ConnectionView handleConnect={handleConnect} />
        ) : (
          <div className="connected-view">
            <div className="connection-bar">
              <div className="listening-indicator">
                <div className={`status-dot ${isListening ? 'listening' : ''}`} />
                <span className={isListening ? 'listening-text' : ''}>
                  {isConnected ? (isPaused ? '⏸ 已暫停' : isListening ? '🎤 聆聽中…' : '🔇 未聆聽') : '已掛斷'}
                </span>
              </div>
              {isConnected ? (
                <>
                  {supportsPause && (
                    <button type="button" className="btn-pause" onClick={handlePauseToggle}>
                      {isPaused ? '繼續' : '暫停'}
                    </button>
                  )}
                  <button type="button" className="btn-disconnect" onClick={handleDisconnect}>
                    掛斷
                  </button>
                </>
              ) : (
                <button type="button" className="btn-connect" onClick={handleConnect}>
                  開始連線
                </button>
              )}
            </div>
            <p className="connected-hint">
              {isConnected
                ? '可直接對麥克風說話，或使用下方「測試音檔」上傳音檔模擬語音輸入。'
                : '點「開始連線」重新連接，對話記錄會保留。'}
            </p>
            <div className="test-audio-section" style={{ opacity: isConnected ? 1 : 0.6 }}>
              <label className="test-audio-label">
                <span>使用測試音檔：</span>
                <input
                  ref={testAudioInputRef}
                  type="file"
                  accept="audio/*"
                  className="test-audio-input"
                  disabled={testAudioSending || !isConnected}
                />
              </label>
              <button
                type="button"
                className="btn-send-test-audio"
                onClick={handleSendTestAudio}
                disabled={testAudioSending || !isConnected}
              >
                {testAudioSending ? '傳送中…' : '傳送測試音檔'}
              </button>
            </div>
            <ConversationView messages={messages} />
          </div>
        )}
      </div>
      
      <p className="read-the-docs">
        點「Connect to Voice Assistant」開始連線；連線後可直接說話，可點「暫停」暫停收發語音（再點「繼續」恢復），或點「掛斷」結束連線。
      </p>
    </>
  );
}

export default App;