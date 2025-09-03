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
      <h3 style={{ margin: '0 0 15px 0', color: '#4CAF50' }}>💬 即時對話內容</h3>

      {messages.length === 0 ? (
        <div style={{ fontStyle: 'italic', color: '#666', textAlign: 'center', padding: '20px' }}>
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

          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
};

export default ConversationView;
