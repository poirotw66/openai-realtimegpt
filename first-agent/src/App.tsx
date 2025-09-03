import { useState } from 'react'
import './App.css'
import { connectSession } from './agent'

function App() {
  const [count, setCount] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const [apiKey, setApiKey] = useState('')

  const handleConnect = async () => {
    if (!apiKey) {
      alert('Please enter your OpenAI API key')
      return
    }
    
    try {
      await connectSession(apiKey)
      setIsConnected(true)
    } catch (error) {
      console.error('Connection error:', error)
      alert('Failed to connect. Please check your API key and try again.')
    }
  }

  return (
    <>
      <h1>OpenAI Realtime Agent</h1>
      
      <div className="card">
        {!isConnected ? (
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
        ) : (
          <div>
            <h2>🎤 Voice Assistant Connected!</h2>
            <p>You can now start talking to your assistant.</p>
            <p>Grant microphone access when prompted.</p>
            <p style={{color: '#4CAF50', fontWeight: 'bold'}}>
              ✅ Realtime session active - start speaking!
            </p>
          </div>
        )}
      </div>
      
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
    </>
  )
}

export default App
