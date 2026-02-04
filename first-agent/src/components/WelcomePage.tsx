import React from 'react';

const WelcomePage: React.FC<{ onStartChat: () => void }> = ({ onStartChat }) => {
  return (
    <div className="welcome-page">
      <div className="welcome-container">
        <div className="welcome-header">
          <h1>AI 語音助手</h1>
          <p className="welcome-subtitle">使用 OpenAI Realtime API 體驗自然的語音對話</p>
        </div>
        
        <div className="chat-preview">
          <div className="message-preview assistant">
            <div className="message-avatar">AI</div>
            <div className="message-content">
              你好！我是 AI 語音助手，可以和你進行自然的語音對話。
            </div>
          </div>
          <div className="message-preview user">
            <div className="message-avatar">我</div>
            <div className="message-content">
              你好，現在幾點了？
            </div>
          </div>
          <div className="message-preview assistant">
            <div className="message-avatar">AI</div>
            <div className="message-content">
              現在是 {new Date().toLocaleTimeString('zh-TW')}。需要我幫你做些什麼嗎？
            </div>
          </div>
        </div>

        <button className="start-chat-btn" onClick={onStartChat}>
          開始對話
        </button>

        <div className="features">
          <div className="feature">
            <span className="feature-icon">🎤</span>
            <span>語音識別</span>
          </div>
          <div className="feature">
            <span className="feature-icon">🗣️</span>
            <span>語音合成</span>
          </div>
          <div className="feature">
            <span className="feature-icon">繁</span>
            <span>繁體中文</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;