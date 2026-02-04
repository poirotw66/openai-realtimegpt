import React from 'react';

interface ConnectionViewProps {
  handleConnect: () => void;
}

const ConnectionView: React.FC<ConnectionViewProps> = ({ handleConnect }) => {
  return (
    <div>
      <p style={{ marginBottom: '10px', color: '#666' }}>
        Token is obtained from the server using OPENAI_API_KEY in .env. Ensure <code>npm run dev-full</code> is running.
      </p>
      <button onClick={handleConnect}>
        Connect to Voice Assistant
      </button>
    </div>
  );
};

export default ConnectionView;
