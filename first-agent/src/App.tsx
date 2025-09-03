import { useState, useEffect } from 'react';
import './App.css';
import { connectSession, setMessageCallback } from './agent';
import ConnectionView from './components/ConnectionView';
import ConversationView from './components/ConversationView';
import DebugPanel from './components/DebugPanel';
import TestControls from './components/TestControls';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  messageId?: string;
}

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebugInfo = (info: string) => {
    console.log('Debug:', info);
    setDebugInfo(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${info}`]);
  };

  useEffect(() => {
    setMessageCallback((message: Message, messageId?: string) => {
      console.log('Message received:', message, 'ID:', messageId);
      
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
      
      addDebugInfo(`新消息: ${message.role} - ${message.content.substring(0, 50)}... (${message.isStreaming ? '流式中' : '完成'})`);
    });
  }, []);

  const handleConnect = async () => {
    if (!apiKey) {
      alert('Please enter your OpenAI API key');
      return;
    }
    
    try {
      setMessages([]);
      addDebugInfo('開始連接...');
      
      await connectSession(apiKey);
      setIsConnected(true);
      setIsListening(true);
      addDebugInfo('連接成功！');
      
      setMessages([{
        role: 'assistant',
        content: '🔗 已連接到語音助手！請開始說話...',
        timestamp: new Date()
      }]);
      
    } catch (error) {
      console.error('Connection error:', error);
      if (error instanceof Error) {
        addDebugInfo(`連接錯誤: ${error.message}`);
      } else {
        addDebugInfo(`連接錯誤: ${String(error)}`);
      }
      alert('Failed to connect. Please check your API key and try again.');
    }
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
    
    addDebugInfo(`測試 AI 回應: ${randomResponse}`);
  };

  const testVoiceRecognition = async () => {
    addDebugInfo('開始手動語音測試...');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      addDebugInfo('✅ 麥克風權限已獲得');
      
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'zh-CN';
        
        recognition.onresult = (event: any) => {
          const transcript = event.results[event.results.length - 1][0].transcript;
          addDebugInfo(`語音識別結果: ${transcript}`);
          setMessages(prev => [...prev, {
            role: 'user',
            content: transcript,
            timestamp: new Date()
          }]);
        };
        
        recognition.onerror = (event: any) => {
          addDebugInfo(`語音識別錯誤: ${event.error}`);
        };
        
        recognition.start();
        addDebugInfo('✅ 瀏覽器語音識別已啟動');
        
        setTimeout(() => {
          recognition.stop();
          addDebugInfo('語音識別已停止');
        }, 10000);
        
      } else {
        addDebugInfo('❌ 瀏覽器不支持語音識別');
      }
      
      stream.getTracks().forEach(track => track.stop());
      
    } catch (error) {
      addDebugInfo(`麥克風測試失敗: ${error}`);
    }
  };

  return (
    <>
      <h1>OpenAI Realtime Agent</h1>
      
      <div className="card">
        {!isConnected ? (
          <ConnectionView
            apiKey={apiKey}
            setApiKey={setApiKey}
            handleConnect={handleConnect}
          />
        ) : (
          <div>
            <h2>🎤 Voice Assistant Connected!</h2>
            <p>You can now start talking to your assistant.</p>
            <p>Grant microphone access when prompted.</p>
            
            <ConversationView messages={messages} />
            
            <div className="listening-indicator">
              <div className={`status-dot ${isListening ? 'listening' : ''}`}></div>
              <span style={{ color: isListening ? '#4CAF50' : '#666' }}>
                {isListening ? '🎤 Listening...' : '🔇 Not listening'}
              </span>
            </div>
            
            <TestControls
              testAIResponse={testAIResponse}
              testVoiceRecognition={testVoiceRecognition}
            />
            
            <DebugPanel debugInfo={debugInfo} />
          </div>
        )}
      </div>
      
      <p className="read-the-docs">
        Connect your OpenAI API key and start voice chatting!
      </p>
    </>
  );
}

export default App;