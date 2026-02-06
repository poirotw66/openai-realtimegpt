import React from 'react';
import { IconMic, IconSpeaker, IconSparkles } from './Icons';

const WelcomePage: React.FC<{ onStartChat: () => void }> = ({ onStartChat }) => {
  return (
    <div className="welcome-page">
      <div className="welcome-container">
        <div className="welcome-header">
          <h1>AI 語音助手</h1>
          <p className="welcome-subtitle">使用 OpenAI Realtime 或 Gemini Live 體驗即時語音對話</p>
        </div>

        <button type="button" className="start-chat-btn" onClick={onStartChat}>
          開始對話
        </button>

        <div className="chat-preview">
          <div className="message-preview assistant">
            <div className="message-avatar" aria-hidden>
              <IconSparkles width={20} height={20} />
            </div>
            <div className="message-content">
              你好！我是 AI 語音助手，可以和你進行自然的語音對話。
            </div>
          </div>
          <div className="message-preview user">
            <div className="message-avatar" aria-hidden>我</div>
            <div className="message-content">
              你好，現在幾點了？
            </div>
          </div>
          <div className="message-preview assistant">
            <div className="message-avatar" aria-hidden>
              <IconSparkles width={20} height={20} />
            </div>
            <div className="message-content">
              現在是 {new Date().toLocaleTimeString('zh-TW')}。需要我幫你做些什麼嗎？
            </div>
          </div>
        </div>

        <div className="features">
          <div className="feature">
            <span className="feature-icon" aria-hidden>
              <IconMic width={28} height={28} />
            </span>
            <span>語音識別</span>
          </div>
          <div className="feature">
            <span className="feature-icon" aria-hidden>
              <IconSpeaker width={28} height={28} />
            </span>
            <span>語音合成</span>
          </div>
          <div className="feature">
            <span className="feature-icon feature-icon-text">繁</span>
            <span>繁體中文</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
