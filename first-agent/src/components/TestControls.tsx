import React from 'react';

interface TestControlsProps {
  testAIResponse: () => void;
  testVoiceRecognition: () => void;
}

const TestControls: React.FC<TestControlsProps> = ({ testAIResponse, testVoiceRecognition }) => {
  return (
    <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      <button
        onClick={testAIResponse}
        style={{
          backgroundColor: '#2196F3',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        🧪 測試 AI 回應
      </button>

      <button
        onClick={testVoiceRecognition}
        style={{
          backgroundColor: '#FF9800',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        🎤 測試語音識別
      </button>

      <button
        onClick={() => (window as any).sendTestMessage?.()}
        style={{
          backgroundColor: '#9C27B0',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        🔧 測試事件系統
      </button>

      <button
        onClick={() => (window as any).testEventListeners?.()}
        style={{
          backgroundColor: '#607D8B',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        🔍 檢查事件監聽器
      </button>

      <button
        onClick={() => (window as any).simulateConversation?.()}
        style={{
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        🎭 模擬完整對話
      </button>

      <button
        onClick={() => (window as any).testCurrentTimeTool?.()}
        style={{
          backgroundColor: '#FF5722',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        🕒 測試時間工具
      </button>

      <button
        onClick={() => (window as any).simulateTimeQuery?.()}
        style={{
          backgroundColor: '#795548',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        ⏰ 模擬時間查詢
      </button>

      <button
        onClick={() => (window as any).debugSession?.()}
        style={{
          backgroundColor: '#E91E63',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        🔍 調試 Session
      </button>

      <button
        onClick={() => (window as any).sendManualToolCall?.()}
        style={{
          backgroundColor: '#3F51B5',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        🛠️ 手動工具調用
      </button>

      <button
        onClick={() => (window as any).forceCompleteResponse?.()}
        style={{
          backgroundColor: '#F44336',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        🚨 強制完成回應
      </button>

      <button
        onClick={() => (window as any).sendTimeResult?.()}
        style={{
          backgroundColor: '#FF9800',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        ⏰ 手動發送時間
      </button>
    </div>
  );
};

export default TestControls;
