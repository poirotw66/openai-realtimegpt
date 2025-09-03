import React from 'react';

interface ConnectionViewProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  handleConnect: () => void;
}

const ConnectionView: React.FC<ConnectionViewProps> = ({ apiKey, setApiKey, handleConnect }) => {
  return (
    <div>
      <input
        type="password"
        placeholder="Enter your OpenAI API key"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        style={{ marginBottom: '10px', padding: '5px', width: '300px' }}
      />
      <br />
      <button onClick={handleConnect}>
        Connect to Voice Assistant
      </button>
    </div>
  );
};

export default ConnectionView;
