import React, { useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  messageId?: string;
}

interface ConversationViewProps {
  messages: Message[];
}

const ConversationView: React.FC<ConversationViewProps> = ({ messages }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="conversation-container">
      {messages.length === 0 ? (
        <div className="conversation-empty">
          開始對麥克風說話，您的語音和 AI 的回覆會即時顯示在這裡。
        </div>
      ) : (
        <div style={{ width: '100%' }}>
          {messages.map((message, index) => (
            <div key={message.messageId || index} className={`message ${message.role} ${message.isStreaming ? 'streaming' : ''}`}>
              <div className="message-content-wrapper">
                <div className={`message-header ${message.role}`}>
                  <span>{message.role === 'user' ? '您' : 'AI'}</span>
                  {message.isStreaming && (
                    <span className="streaming-indicator">輸入中</span>
                  )}
                  <span className="timestamp">
                    {message.timestamp.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="message-content">
                  {message.content}
                  {message.isStreaming && (
                    <span className="typing-cursor">▌</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
};

export default ConversationView;