import { useState, useEffect, useRef } from 'react';
import './App.css';
import { connectSession, disconnectSession, pauseSession, getSupportsPause, setMessageCallback, sendAudioFromFile, flushUserMessagesFromSession } from './agent';
import WelcomePage from './components/WelcomePage';
import ModelSelection from './components/ModelSelection';
import ConversationView from './components/ConversationView';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  messageId?: string;
}

type AppView = 'welcome' | 'model-selection' | 'connecting' | 'chat';
type SelectedModel = 'gpt-realtime' | 'gemini-live' | null;

function App() {
  const [currentView, setCurrentView] = useState<AppView>('welcome');
  const [selectedModel, setSelectedModel] = useState<SelectedModel>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [supportsPause, setSupportsPause] = useState(false);
  const [testAudioSending, setTestAudioSending] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const testAudioInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMessageCallback((message: Message, messageId?: string) => {
      // Hide initial greeting trigger (single dot sent to make model say hello)
      if (message.role === 'user' && message.content.trim() === '.') return;
      
      setMessages(prev => {
        const id = messageId || `${message.role}-${Date.now()}`;
        
        // For streaming messages, update existing or add new
        if (message.isStreaming) {
          const existingIndex = prev.findIndex(m => m.messageId === id);
          if (existingIndex !== -1) {
            const newMessages = [...prev];
            newMessages[existingIndex] = { ...message, messageId: id };
            return newMessages;
          } else {
            return [...prev, { ...message, messageId: id }];
          }
        } 
        // For final messages, always update existing or add new
        else {
          const existingIndex = prev.findIndex(m => m.messageId === id);
          if (existingIndex !== -1) {
            // Update existing message with final content
            const newMessages = [...prev];
            newMessages[existingIndex] = { ...message, messageId: id, isStreaming: false };
            return newMessages;
          } else {
            // Add new final message only if no existing message with same ID
            return [...prev, { ...message, messageId: id, isStreaming: false }];
          }
        }
      });
    });
  }, []);

  const handleStartChat = () => {
    setCurrentView('model-selection');
  };

  const handleSelectModel = (model: 'gpt-realtime' | 'gemini-live') => {
    if (model === 'gemini-live') {
      alert('Gemini Live 功能即將推出，請選擇 GPT Realtime');
      return;
    }
    
    setSelectedModel(model);
    setCurrentView('connecting');
    handleConnect();
  };

  const handleBackToWelcome = () => {
    setCurrentView('welcome');
    setSelectedModel(null);
  };

  const handleBackToModelSelection = () => {
    setCurrentView('model-selection');
    handleDisconnect();
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setMessages([]);
      
      await connectSession();
      setIsConnected(true);
      setIsListening(true);
      setCurrentView('chat');
      
      setMessages([{
        role: 'assistant',
        content: '🔗 已連接到 GPT Realtime！請開始說話...',
        timestamp: new Date()
      }]);
      
    } catch (error) {
      console.error('Connection error:', error);
      alert('連接失敗。請確保 MCP proxy 正在運行 (npm run dev-full) 且 .env 中已設定 OPENAI_API_KEY');
      setCurrentView('model-selection');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnectSession();
    setIsConnected(false);
    setIsListening(false);
    setIsPaused(false);
    setSupportsPause(false);
    setCurrentView('model-selection');
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

  const renderCurrentView = () => {
    switch (currentView) {
      case 'welcome':
        return <WelcomePage onStartChat={handleStartChat} />;
      
      case 'model-selection':
        return (
          <ModelSelection 
            onSelectModel={handleSelectModel} 
            onBack={handleBackToWelcome}
          />
        );
      
      case 'connecting':
        return (
          <div className="connecting-view">
            <div className="connecting-container">
              <div className="loading-spinner"></div>
              <h2>連接中...</h2>
              <p>正在建立與 {selectedModel === 'gpt-realtime' ? 'GPT Realtime' : 'Gemini Live'} 的連接</p>
            </div>
          </div>
        );
      
      case 'chat':
        return (
          <div className="chat-view">
            <div className="chat-header">
              <button className="back-btn" onClick={handleBackToModelSelection}>
                ← 選擇其他模型
              </button>
              <div className="chat-title">
                <span className="model-name">{selectedModel === 'gpt-realtime' ? 'GPT Realtime' : 'Gemini Live'}</span>
                <div className="connection-status">
                  <div className={`status-dot ${isListening ? 'listening' : ''}`} />
                  <span className={isListening ? 'listening-text' : ''}>
                    {isConnected ? (isPaused ? '⏸ 已暫停' : isListening ? '🎤 聆聽中…' : '🔇 未聆聽') : '已掛斷'}
                  </span>
                </div>
              </div>
              <div className="chat-controls">
                {isConnected && supportsPause && (
                  <button type="button" className="btn-pause" onClick={handlePauseToggle}>
                    {isPaused ? '繼續' : '暫停'}
                  </button>
                )}
                {isConnected && (
                  <button type="button" className="btn-disconnect" onClick={handleDisconnect}>
                    掛斷
                  </button>
                )}
              </div>
            </div>
            
            <div className="chat-content">
              <ConversationView messages={messages} />
            </div>
            
            <div className="chat-footer">
              <div className="test-audio-section">
                <label className="test-audio-label">
                  <span>測試音檔：</span>
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
                  {testAudioSending ? '傳送中…' : '傳送'}
                </button>
              </div>
              <p className="chat-hint">
                {isConnected
                  ? '可直接對麥克風說話，或使用上方「測試音檔」上傳音檔。'
                  : '連接已中斷'}
              </p>
            </div>
          </div>
        );
      
      default:
        return <WelcomePage onStartChat={handleStartChat} />;
    }
  };

  return (
    <div className="app">
      {renderCurrentView()}
    </div>
  );
}

export default App;