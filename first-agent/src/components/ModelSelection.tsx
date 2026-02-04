import React, { useState } from 'react';

interface ModelSelectionProps {
  onSelectModel: (model: 'gpt-realtime' | 'gemini-live', apiKey?: string) => void;
  onBack: () => void;
}

const ModelSelection: React.FC<ModelSelectionProps> = ({ onSelectModel, onBack }) => {
  const [showApiKeySettings, setShowApiKeySettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const handleSelectModel = (model: 'gpt-realtime' | 'gemini-live', e?: React.MouseEvent) => {
    // Prevent card click when clicking on settings button
    if (e && (e.target as HTMLElement).closest('.model-settings-btn')) {
      return;
    }
    
    if (apiKey.trim()) {
      onSelectModel(model, apiKey.trim());
    } else {
      onSelectModel(model);
    }
  };

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowApiKeySettings(!showApiKeySettings);
  };

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
            onClick={(e) => handleSelectModel('gpt-realtime', e)}
          >
            <div className="model-header">
              <div className="model-logo openai">GPT</div>
              <div className="model-header-right">
                <button
                  type="button"
                  className="model-settings-btn"
                  onClick={handleSettingsClick}
                  aria-label="設定 API Key"
                  title="設定 API Key"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
                <div className="model-status available">可用</div>
              </div>
            </div>
            <h3>GPT Realtime</h3>
            <p className="model-description">
              OpenAI 的實時語音對話模型，支持自然的語音輸入和輸出，具有出色的理解能力和回應速度。
            </p>
            
            {showApiKeySettings && (
              <div className="model-api-key-settings">
                <div className="api-key-input-group">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    className="api-key-input"
                    placeholder="sk-...（留空則使用環境變數）"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    type="button"
                    className="api-key-toggle-visibility"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowApiKey(!showApiKey);
                    }}
                    aria-label={showApiKey ? '隱藏' : '顯示'}
                  >
                    {showApiKey ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                <p className="api-key-hint">
                  輸入您的 OpenAI API Key。若留空，將使用後端環境變數中的 API Key。
                </p>
              </div>
            )}
            
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
            * 預設使用環境變數中的 API Key，點擊 GPT Realtime 卡片上的齒輪圖標可設定自訂 API Key
          </p>
        </div>
      </div>
    </div>
  );
};

export default ModelSelection;