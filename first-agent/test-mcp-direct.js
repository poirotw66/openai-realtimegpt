import { spawn } from 'child_process';
import path from 'path';

async function testMCPServer() {
  const mcpServerPath = path.resolve('..', 'grounding-mcp');
  const uvPath = '/Users/cfh00896102/.local/bin/uv';

  console.log('🧪 Testing MCP Server directly...');

  // Create a simple test request
  const request = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "first-agent",
        "version": "1.0.0"
      }
    }
  };

  const inputData = JSON.stringify(request) + '\n';

  const child = spawn(uvPath, ['run', 'python', 'grounding_mcp/server.py'], {
    cwd: mcpServerPath,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GEMINI_API_KEY: 'REMOVED_SENSITIVE_VALUE'
    }
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (data) => {
    stdout += data.toString();
    console.log('📤 STDOUT:', data.toString());
  });

  child.stderr.on('data', (data) => {
    stderr += data.toString();
    console.log('🔥 STDERR:', data.toString());
  });

  child.on('close', (code) => {
    console.log('✅ Process closed with code:', code);
    console.log('📤 Final STDOUT:', stdout);
    console.log('🔥 Final STDERR:', stderr);
  });

  child.on('error', (error) => {
    console.error('❌ Process error:', error);
  });

  // Send the request
  console.log('📨 Sending request:', request);
  child.stdin.write(inputData);
  child.stdin.end();
}

testMCPServer().catch(console.error);
