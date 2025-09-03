import React from 'react';

interface DebugPanelProps {
  debugInfo: string[];
}

const DebugPanel: React.FC<DebugPanelProps> = ({ debugInfo }) => {
  return (
    <div style={{ marginTop: '20px' }}>
      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
          🔍 調試信息 ({debugInfo.length})
        </summary>
        <div style={{
          maxHeight: '200px',
          overflow: 'auto',
          border: '1px solid #ddd',
          borderRadius: '5px',
          padding: '10px',
          margin: '10px 0',
          backgroundColor: '#f9f9f9',
          fontSize: '0.9em'
        }}>
          {debugInfo.length === 0 ? (
            <p style={{ color: '#666', margin: 0 }}>沒有調試信息</p>
          ) : (
            debugInfo.map((info, index) => (
              <div key={index} style={{ marginBottom: '5px', fontFamily: 'monospace' }}>
                {info}
              </div>
            ))
          )}
        </div>
      </details>
    </div>
  );
};

export default DebugPanel;
