import React from 'react';

interface ModelSelectionProps {
  onSelectModel: (model: 'gpt-realtime' | 'gemini-live') => void;
  onBack: () => void;
}

const ModelSelection: React.FC<ModelSelectionProps> = ({ onSelectModel, onBack }) => {
  return (
    <div className="model-selection-page">
      <div className="model-selection-container">
        <div className="model-selection-header">
          <button className="back-btn" onClick={onBack}>
            ← 返回
          </button>
          <h2>選擇對話模型</h2>
          <p className="selection-subtitle">請選擇您想使用的 AI 語音助手</p>
        </div>

        <div className="model-options">
          <div 
            className="model-card available" 
            onClick={() => onSelectModel('gpt-realtime')}
          >
            <div className="model-header">
              <div className="model-logo openai">GPT</div>
              <div className="model-status available">可用</div>
            </div>
            <h3>GPT Realtime</h3>
            <p className="model-description">
              OpenAI 的實時語音對話模型，支持自然的語音輸入和輸出，具有出色的理解能力和回應速度。
            </p>
            <div className="model-features">
              <span className="feature-tag">🎤 語音識別</span>
              <span className="feature-tag">🗣️ 語音合成</span>
              <span className="feature-tag">🧠 智能對話</span>
            </div>
          </div>

          <div className="model-card unavailable">
            <div className="model-header">
              <div className="model-logo gemini">Gemini</div>
              <div className="model-status unavailable">即將推出</div>
            </div>
            <h3>Gemini Live</h3>
            <p className="model-description">
              Google 的下一代語音助手，提供更強大的多模態理解能力。功能開發中，敬請期待。
            </p>
            <div className="model-features">
              <span className="feature-tag disabled">🎤 語音識別</span>
              <span className="feature-tag disabled">🗣️ 語音合成</span>
              <span className="feature-tag disabled">👁️ 視覺理解</span>
            </div>
          </div>
        </div>

        <div className="selection-footer">
          <p className="footer-note">
            * GPT Realtime 需要 OpenAI API 密鑰才能使用
          </p>
        </div>
      </div>
    </div>
  );
};

export default ModelSelection;