import { useState, useEffect, useRef } from 'react';
import './App.css';
import { connectSession, disconnectSession, pauseSession, getSupportsPause, setMessageCallback, sendAudioFromFile, flushUserMessagesFromSession } from './agent';
import {
  connectGeminiSession,
  disconnectGeminiSession,
  setGeminiMessageCallback,
  sendGeminiAudioFromFile,
  sendGeminiText,
  getGeminiSupportsPause,
  pauseGeminiSession,
  startGeminiMicrophone
} from './geminiLive';
import WelcomePage from './components/WelcomePage';
import ModelSelection from './components/ModelSelection';
import ConversationView from './components/ConversationView';
import ConversationHistory from './components/ConversationHistory';
import ThemeToggle from './components/ThemeToggle';
import { IconArrowLeft, IconMic, IconMicOff, IconPause, IconPhoneOff, IconSend, IconUpload } from './components/Icons';
import { saveConversation, createConversation, type Conversation } from './utils/conversationHistory';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  messageId?: string;
}

type AppView = 'welcome' | 'model-selection' | 'connecting' | 'chat' | 'history';
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
  const [textInput, setTextInput] = useState('');
  const [isSendingText, setIsSendingText] = useState(false);
  const testAudioInputRef = useRef<HTMLInputElement>(null);

  const messageHandlerRef = useRef<(message: Message, messageId?: string) => void>(() => {});
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handler = (message: Message, messageId?: string) => {
      // Filter out trigger messages (both . and 。)
      if (message.role === 'user' && (message.content.trim() === '.' || message.content.trim() === '。')) return;
      setMessages(prev => {
        const id = messageId || `${message.role}-${Date.now()}`;
        if (message.isStreaming) {
          const existingIndex = prev.findIndex(m => m.messageId === id);
          if (existingIndex !== -1) {
            const newMessages = [...prev];
            newMessages[existingIndex] = { ...message, messageId: id };
            return newMessages;
          }
          // Add new streaming message at the end
          return [...prev, { ...message, messageId: id }];
        }
        const existingIndex = prev.findIndex(m => m.messageId === id);
        if (existingIndex !== -1) {
          const newMessages = [...prev];
          newMessages[existingIndex] = { ...message, messageId: id, isStreaming: false };
          return newMessages;
        }
        // Add new final message at the end
        const newMessages = [...prev, { ...message, messageId: id, isStreaming: false }];
        
        // Auto-save conversation when new message is added (only if connected and not streaming)
        if (isConnected && selectedModel && newMessages.length > 0 && !message.isStreaming) {
          // Clear previous timeout
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
          // Debounce saves to avoid saving on every message update
          saveTimeoutRef.current = setTimeout(() => {
            const conversation = createConversation(newMessages, selectedModel);
            saveConversation(conversation);
          }, 2000);
        }
        
        return newMessages;
      });
    };
    messageHandlerRef.current = handler;
    setMessageCallback(handler);
    
    // Cleanup function to prevent duplicate callbacks
    return () => {
      setMessageCallback(null);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [isConnected, selectedModel]);

  const handleStartChat = () => {
    setCurrentView('model-selection');
  };

  const handleSelectModel = (model: 'gpt-realtime' | 'gemini-live', apiKey?: string, projectId?: string) => {
    setSelectedModel(model);
    setCurrentView('connecting');
    handleConnect(model, apiKey, projectId);
  };

  const handleBackToWelcome = () => {
    setCurrentView('welcome');
    setSelectedModel(null);
  };

  const handleBackToModelSelection = () => {
    // If viewing history conversation, go back to history instead
    if (messages.length > 0 && !isConnected) {
      setCurrentView('history');
      setMessages([]);
      setSelectedModel(null);
    } else {
      setCurrentView('model-selection');
      handleDisconnect();
    }
  };

  const handleShowHistory = () => {
    setCurrentView('history');
  };

  const handleLoadConversation = (conversation: Conversation) => {
    // Convert conversation messages to Message format
    const loadedMessages: Message[] = conversation.messages.map(msg => ({
      ...msg,
      isStreaming: false,
      timestamp: new Date(msg.timestamp) // Ensure timestamp is a Date object
    }));
    
    // Set the loaded messages and model
    setMessages(loadedMessages);
    setSelectedModel(conversation.model);
    
    // Go directly to chat view to show the loaded conversation
    setCurrentView('chat');
    setIsConnected(false);
    setIsListening(false);
    setIsPaused(false);
    
    // Note: User can view the conversation history without connecting
    // To continue the conversation, they need to reconnect
  };

  const handleConnect = async (model: 'gpt-realtime' | 'gemini-live', apiKey?: string, projectId?: string) => {
    console.log('🔌 App: handleConnect called with model:', model);
    try {
      setIsConnecting(true);
      setMessages([]);

      if (model === 'gemini-live') {
        console.log('🔌 App: Connecting to Gemini Live...');
        const pid = projectId?.trim() || '';
        console.log('🔌 App: Project ID:', pid ? pid : '(empty)');
        if (!pid) {
          alert('請在 Gemini Live 卡片上點齒輪圖示，輸入 Google Cloud 專案 ID。若已於 first-agent 的 .env 設定 VITE_GOOGLE_CLOUD_PROJECT，請重新整理頁面後再試。');
          setCurrentView('model-selection');
          return;
        }
        console.log('🔌 App: Setting Gemini message callback...');
        setGeminiMessageCallback(messageHandlerRef.current);
        console.log('🔌 App: Calling connectGeminiSession...');
        await connectGeminiSession(pid);
        console.log('✅ App: connectGeminiSession completed');
        console.log('🎤 App: Starting Gemini microphone...');
        await startGeminiMicrophone();
        console.log('✅ App: Gemini microphone started');
        setIsConnected(true);
        setIsListening(true);
        setIsPaused(false);
        setSupportsPause(getGeminiSupportsPause());
        setCurrentView('chat');
        console.log('✅ App: Gemini Live connection complete');
        // Don't add manual message - let AI greet naturally via setupComplete trigger
      } else {
        // Use env key from backend unless user entered a non-empty API key in the GPT card settings
        const userApiKey = apiKey != null && String(apiKey).trim() !== '' ? String(apiKey).trim() : undefined;
        await connectSession(userApiKey);
        setIsConnected(true);
        setIsListening(true);
        setIsPaused(false);
        setSupportsPause(getSupportsPause());
        setCurrentView('chat');
        // Don't add manual message - let AI greet naturally via system instructions
      }
    } catch (error) {
      console.error('Connection error:', error);
      const errorMessage = model === 'gemini-live'
        ? '連接失敗。請確認：1) 已執行 npm run dev-full（同時啟動 proxy 與前端）2) 已執行 gcloud auth application-default login 3) 專案 ID 正確。'
        : '連接失敗。請確認：1) 已執行 npm run dev-full（同時啟動 proxy 與前端）2) .env 中已設定 OPENAI_API_KEY（未輸入自訂金鑰時會使用）。若已輸入自訂 API Key 請檢查是否正確。';
      alert(errorMessage);
      setCurrentView('model-selection');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    if (selectedModel === 'gemini-live') {
      disconnectGeminiSession();
      setGeminiMessageCallback(null);
    } else {
      disconnectSession();
    }
    setIsConnected(false);
    setIsListening(false);
    setIsPaused(false);
    setSupportsPause(false);
    setCurrentView('model-selection');
  };

  const handlePauseToggle = () => {
    if (!supportsPause) return;
    const nextPaused = !isPaused;
    if (selectedModel === 'gemini-live') {
      pauseGeminiSession(nextPaused);
    } else {
      pauseSession(nextPaused);
    }
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
      
      // Mute microphone during file upload to prevent interference
      const wasMuted = isPaused;
      if (!wasMuted && supportsPause) {
        if (selectedModel === 'gemini-live') {
          pauseGeminiSession(true);
        } else {
          pauseSession(true);
        }
        setIsPaused(true);
      }
      
      if (selectedModel === 'gemini-live') {
        await sendGeminiAudioFromFile(file);
      } else {
        await sendAudioFromFile(file);
        setTimeout(() => flushUserMessagesFromSession(), 1000);
        setTimeout(() => flushUserMessagesFromSession(), 3000);
      }
      
      // Restore microphone state after a short delay
      setTimeout(() => {
        if (!wasMuted && supportsPause) {
          if (selectedModel === 'gemini-live') {
            pauseGeminiSession(false);
          } else {
            pauseSession(false);
          }
          setIsPaused(false);
        }
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`傳送失敗: ${msg}`);
    } finally {
      setTestAudioSending(false);
      if (testAudioInputRef.current) testAudioInputRef.current.value = '';
    }
  };

  const handleSendText = async () => {
    if (!textInput.trim() || !isConnected || isSendingText) return;
    
    try {
      setIsSendingText(true);
      const text = textInput.trim();
      setTextInput(''); // Clear input immediately
      
      // Add user message to UI immediately for both models
      const userMessageId = `user-text-${Date.now()}`;
      messageHandlerRef.current({
        role: 'user',
        content: text,
        timestamp: new Date(),
        isStreaming: false
      }, userMessageId);
      
      if (selectedModel === 'gemini-live') {
        // Send text to Gemini Live
        sendGeminiText(text);
      } else {
        // Send to OpenAI Realtime (cancels current response first)
        const { sendTextMessage } = await import('./agent');
        await sendTextMessage(text);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`發送文字失敗: ${msg}`);
    } finally {
      setIsSendingText(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'welcome':
        return (
          <div className="welcome-wrapper">
            <div className="theme-toggle-container">
              <ThemeToggle />
            </div>
            <WelcomePage onStartChat={handleStartChat} onShowHistory={handleShowHistory} />
          </div>
        );
      
      case 'model-selection':
        return (
          <div className="model-selection-wrapper">
            <div className="theme-toggle-container">
              <ThemeToggle />
            </div>
            <ModelSelection 
              onSelectModel={handleSelectModel} 
              onBack={handleBackToWelcome}
            />
          </div>
        );
      
      case 'connecting':
        return (
          <div className="connecting-view">
            <div className="connecting-container">
              <div className="loading-spinner"></div>
              <h2>連接中{isConnecting ? '…' : ''}</h2>
              <p>正在建立與 {selectedModel === 'gpt-realtime' ? 'GPT Realtime' : 'Gemini Live'} 的連接</p>
            </div>
          </div>
        );
      
      case 'history':
        return (
          <div className="history-wrapper">
            <div className="theme-toggle-container">
              <ThemeToggle />
            </div>
            <ConversationHistory 
              onBack={() => setCurrentView('welcome')}
              onLoadConversation={handleLoadConversation}
            />
          </div>
        );
      
      case 'chat':
        return (
          <div className="chat-view">
            <div className="chat-header">
              <button type="button" className="back-btn" onClick={handleBackToModelSelection} aria-label="選擇其他模型">
                <IconArrowLeft width={20} height={20} />
                <span>{isConnected ? '選擇其他模型' : messages.length > 0 ? '返回' : '選擇其他模型'}</span>
              </button>
              <div className="chat-title">
                <span className="model-name">
                  {selectedModel 
                    ? (selectedModel === 'gpt-realtime' ? 'GPT Realtime' : 'Gemini Live')
                    : '歷史對話'}
                  {messages.length > 0 && !isConnected && (
                    <span className="history-badge">歷史記錄</span>
                  )}
                </span>
                <div className="connection-status">
                  <div className={`status-dot ${isListening ? 'listening' : ''}`} aria-hidden />
                  <span className={isListening ? 'listening-text' : ''}>
                    {isConnected
                      ? isPaused
                        ? <>
                            <IconPause width={14} height={14} />
                            已暫停
                          </>
                        : isListening
                          ? <>
                              <IconMic width={14} height={14} />
                              聆聽中…
                            </>
                          : <>
                              <IconMicOff width={14} height={14} />
                              未聆聽
                            </>
                      : messages.length > 0
                        ? '歷史對話'
                        : '已掛斷'}
                  </span>
                </div>
              </div>
              <div className="chat-controls">
                <ThemeToggle />
                {isConnected && supportsPause && (
                  <button type="button" className="btn-pause" onClick={handlePauseToggle} aria-label={isPaused ? '取消靜音' : '靜音'}>
                    {isPaused ? <IconMic width={18} height={18} /> : <IconMicOff width={18} height={18} />}
                    <span>{isPaused ? '取消靜音' : '靜音'}</span>
                  </button>
                )}
                {isConnected && (
                  <button type="button" className="btn-disconnect" onClick={handleDisconnect} aria-label="掛斷">
                    <IconPhoneOff width={18} height={18} />
                    <span>掛斷</span>
                  </button>
                )}
              </div>
            </div>
            
            <div className="chat-content">
              <ConversationView messages={messages} />
            </div>
            
            <div className="chat-footer">
              <div className="text-input-section">
                <label htmlFor="chat-text-input" className="sr-only">輸入文字消息</label>
                <input
                  id="chat-text-input"
                  type="text"
                  className="text-input"
                  placeholder="輸入文字消息..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={!isConnected || isSendingText}
                  aria-label="輸入文字消息"
                />
                <button
                  type="button"
                  className="btn-send-text"
                  onClick={handleSendText}
                  disabled={!isConnected || isSendingText || !textInput.trim()}
                  aria-label={isSendingText ? '發送中' : '發送'}
                >
                  <IconSend width={20} height={20} />
                  <span>{isSendingText ? '發送中...' : '發送'}</span>
                </button>
              </div>
              <div className="test-audio-section">
                <label className="test-audio-label">
                  <IconUpload width={18} height={18} />
                  <span>測試音檔</span>
                  <input
                    ref={testAudioInputRef}
                    type="file"
                    accept="audio/*"
                    className="test-audio-input"
                    disabled={testAudioSending || !isConnected}
                    aria-label="選擇音檔"
                  />
                </label>
                <button
                  type="button"
                  className="btn-send-test-audio"
                  onClick={handleSendTestAudio}
                  disabled={testAudioSending || !isConnected}
                  aria-label={testAudioSending ? '傳送中' : '傳送音檔'}
                >
                  {testAudioSending ? '傳送中…' : '傳送'}
                </button>
              </div>
              <p className="chat-hint">
                {isConnected
                  ? '可直接對麥克風說話、輸入文字，或上傳音檔。'
                  : messages.length > 0
                    ? '這是載入的歷史對話。點擊「選擇其他模型」重新連接以繼續對話。'
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