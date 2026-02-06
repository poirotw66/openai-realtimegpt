import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import dotenv from 'dotenv';
import WebSocket, { WebSocketServer } from 'ws';
import { GoogleAuth } from 'google-auth-library';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from first-agent or project root
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

/** Get Google Cloud access token for Vertex AI (uses ADC or GOOGLE_APPLICATION_CREDENTIALS). */
async function getGoogleAccessToken() {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) throw new Error('Failed to get Google Cloud access token');
  return tokenResponse.token;
}

const uvPath = '/Users/cfh00896102/.local/bin/uv';

const mcpServers = {
  grounding: {
    type: 'stdio',
    path: path.resolve('..', 'grounding-mcp'),
    command: ['run', 'python', 'grounding_mcp/server.py'],
    tools: ['grounded_search']
  },
  rag: {
    type: 'stdio',
    path: path.resolve('..', 'mcp_rag_server'),
    command: ['run', 'python', 'server.py'],
    tools: ['ask_m365_question', 'search_knowledge_base', 'get_page_context']
  }
};

// Add email MCP server if enabled (default: enabled, set EMAIL_MCP_DISABLED=true to disable)
if (!process.env.EMAIL_MCP_DISABLED) {
  // Default to local server if EMAIL_MCP_URL not set (for npm run dev-full integration)
  const defaultEmailMCPUrl = process.env.EMAIL_MCP_URL || 'http://localhost:8080/mcp';
  mcpServers.email = {
    type: 'http-streamable',
    url: defaultEmailMCPUrl,
    tools: ['send_email', 'send_halloween_invitation', 'send_system_alert']
  };
  console.log(`📧 Email MCP server configured: ${defaultEmailMCPUrl}`);
} else {
  console.log('ℹ️  Email MCP server disabled (EMAIL_MCP_DISABLED=true)');
}

// Helper function to parse SSE (Server-Sent Events) response
function parseSSEResponse(text) {
  const lines = text.split('\n');
  let eventType = null;
  let data = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue; // Skip empty lines
    
    if (trimmed.startsWith('event:')) {
      eventType = trimmed.substring(6).trim();
    } else if (trimmed.startsWith('data:')) {
      const dataStr = trimmed.substring(5).trim();
      if (dataStr) {
        try {
          data = JSON.parse(dataStr);
        } catch (e) {
          // If not JSON, use as-is
          data = dataStr;
        }
      }
    }
  }
  
  return { eventType, data };
}

// Function to call HTTP Streamable MCP server
// For stateless Streamable HTTP, each request needs initialize → initialized → method call sequence
// But since we can't send multiple messages in one HTTP request, we'll use a session-based approach
// by sending initialize/initialized first, then the method call in a separate request
async function callHTTPStreamableMCPServer(serverConfig, method, params = {}) {
  const baseUrl = serverConfig.url.endsWith('/') ? serverConfig.url : `${serverConfig.url}/`;
  
  try {
    // Step 1: Initialize (required for each session)
    const initResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'first-agent', version: '1.0.0' },
        },
      }),
    });

    if (!initResponse.ok) {
      throw new Error(`HTTP error during initialize! status: ${initResponse.status}`);
    }

    // Parse response (could be JSON or SSE format)
    const initText = await initResponse.text();
    let initData = null;
    if (initText.trim().startsWith('event:') || initText.includes('data:')) {
      const parsed = parseSSEResponse(initText);
      initData = parsed.data;
    } else {
      try {
        initData = JSON.parse(initText);
      } catch (e) {
        throw new Error(`Failed to parse initialize response: ${e.message}`);
      }
    }

    if (initData?.error) {
      throw new Error(`MCP Initialize Error: ${initData.error.message || JSON.stringify(initData.error)}`);
    }

    // Step 2: Send initialized notification
    await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }),
    });

    // Step 3: Call the actual method
    let requestBody;
    if (method === 'tools/list') {
      requestBody = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      };
    } else if (method === 'tools/call') {
      requestBody = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: params,
      };
    } else {
      throw new Error(`Unknown method: ${method}`);
    }

    console.log(`🔧 Calling HTTP Streamable MCP server at ${baseUrl}:`, method, params);

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP error response (${response.status}): ${errorText.substring(0, 200)}`);
      if (response.status === 404) {
        throw new Error(`Email MCP server not found at ${baseUrl}. The service may not be deployed or the URL is incorrect.`);
      }
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`);
    }

    // Parse response (could be JSON or SSE format)
    const responseText = await response.text();
    let data = null;
    
    if (responseText.trim().startsWith('event:') || responseText.includes('data:')) {
      // SSE format
      const parsed = parseSSEResponse(responseText);
      data = parsed.data;
    } else {
      // Pure JSON format
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Failed to parse response: ${e.message}, response: ${responseText.substring(0, 200)}`);
      }
    }

    if (!data) {
      throw new Error('No valid response data found');
    }

    if (data.error) {
      throw new Error(`MCP Error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    return data.result || {};
  } catch (error) {
    console.error(`❌ Error calling HTTP Streamable MCP server:`, error);
    throw error;
  }
}

// Function to call a specific MCP server (stdio or HTTP Streamable)
async function callSpecificMCPServer(serverConfig, method, params = {}) {
  // Handle HTTP Streamable MCP servers
  if (serverConfig.type === 'http-streamable') {
    return await callHTTPStreamableMCPServer(serverConfig, method, params);
  }

  // Handle stdio MCP servers (existing implementation)
  return new Promise((resolve, reject) => {
    const requests = [];
    requests.push(JSON.stringify({
      "jsonrpc": "2.0",
      "id": 1,
      "method": "initialize",
      "params": {
        "protocolVersion": "2024-11-05",
        "capabilities": { "tools": {} },
        "clientInfo": { "name": "first-agent", "version": "1.0.0" }
      }
    }));
    requests.push(JSON.stringify({ "jsonrpc": "2.0", "method": "notifications/initialized" }));

    if (method === 'tools/list') {
      requests.push(JSON.stringify({ "jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {} }));
    } else if (method === 'tools/call') {
      requests.push(JSON.stringify({ "jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": params }));
    }

    const inputData = requests.join('\n') + '\n';

    console.log(`🔧 Calling MCP server at ${serverConfig.path}:`, method, params);
    console.log('📨 Sending requests:', requests);

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const child = spawn(uvPath, serverConfig.command, {
      cwd: serverConfig.path,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...(geminiKey ? { GEMINI_API_KEY: geminiKey } : {})
      }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`[${path.basename(serverConfig.path)} STDERR]:`, data.toString());
    });

    child.on('close', (code) => {
      console.log(`MCP server process at ${serverConfig.path} closed with code:`, code);
      try {
        const lines = stdout.trim().split('\n');
        let result = null;
        for (const line of lines) {
          if (line.trim()) {
            const response = JSON.parse(line);
            if (response.id === 2) {
              if (response.result) {
                result = response.result;
              } else if (response.error) {
                reject(new Error(`MCP Error: ${response.error.message}`));
                return;
              }
              break;
            }
          }
        }
        if (result !== null) {
          resolve(result);
        } else {
          // reject(new Error('No valid response from MCP server'));
          // It's possible that the server just exits without a response for some calls.
          // Resolve with an empty object in this case.
          resolve({});
        }
      } catch (parseError) {
        console.error('Error parsing MCP response:', parseError);
        console.error('Raw stdout:', stdout);
        console.error('Raw stderr:', stderr);
        reject(parseError);
      }
    });

    child.on('error', (error) => {
      console.error(`Error spawning MCP server at ${serverConfig.path}:`, error);
      reject(error);
    });

    child.stdin.write(inputData);
    child.stdin.end();
  });
}

// API endpoint to list all tools from all servers
app.get('/api/mcp/tools', async (req, res) => {
  try {
    console.log('📡 GET /api/mcp/tools - Listing available tools from all servers');
    
    const toolPromises = Object.entries(mcpServers).map(async ([serverName, serverConfig]) => {
      try {
        const result = await callSpecificMCPServer(serverConfig, 'tools/list');
        console.log(`✅ ${serverName} (${serverConfig.type || 'stdio'}): ${(result.tools || []).length} tools`);
        return result;
      } catch (error) {
        const serverType = serverConfig.type || 'stdio';
        const serverUrl = serverConfig.url || serverConfig.path || 'unknown';
        console.error(`⚠️ Failed to list tools from ${serverName} (${serverType}):`, error.message);
        console.error(`   Server: ${serverUrl}`);
        if (serverType === 'http-streamable') {
          console.error(`   💡 Tip: Ensure the email MCP server is deployed and accessible at ${serverUrl}`);
        }
        return { tools: [] }; // Return empty tools on error to allow other servers to work
      }
    });

    const results = await Promise.all(toolPromises);
    const allTools = results.flatMap(result => result.tools || []);

    console.log('✅ All tools listed successfully:', allTools.map((t) => t.name));
    res.json({
      success: true,
      tools: allTools
    });
  } catch (error) {
    console.error('❌ Error listing all tools:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint to call a tool
app.post('/api/mcp/tools/call', async (req, res) => {
  try {
    const { name, arguments: args } = req.body;
    console.log(`📡 POST /api/mcp/tools/call - Calling tool: ${name}`, args);

    let serverConfig = null;
    for (const key in mcpServers) {
      if (mcpServers[key].tools.includes(name)) {
        serverConfig = mcpServers[key];
        break;
      }
    }

    if (!serverConfig) {
      throw new Error(`Tool "${name}" not found in any MCP server.`);
    }

    const result = await callSpecificMCPServer(serverConfig, 'tools/call', {
      name: name,
      arguments: args || {}
    });
    
    console.log('✅ Tool called successfully:', result);
    res.json({
      success: true,
      result: result
    });
  } catch (error) {
    console.error('❌ Error calling tool:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Gemini Live API config (Vertex AI: project ID and WebSocket URL)
const GEMINI_LIVE_SERVICE_URL = 'wss://us-central1-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent';
app.get('/api/gemini-live/config', (req, res) => {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || '';
  res.json({
    success: true,
    service_url: GEMINI_LIVE_SERVICE_URL,
    project_id: projectId
  });
});

// Create ephemeral client secret for Realtime API (uses OPENAI_API_KEY from env)
app.post('/api/realtime/client_secret', async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        success: false,
        error: 'OPENAI_API_KEY is not set. Add it to .env in project root or first-agent.'
      });
      return;
    }

    const body = req.body?.session
      ? { session: req.body.session }
      : { session: { type: 'realtime', model: 'gpt-realtime-mini-2025-12-15' } };

    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({
        success: false,
        error: data.error?.message || data.error || 'OpenAI API error'
      });
      return;
    }

    if (!data.value) {
      res.status(500).json({
        success: false,
        error: 'No client secret in OpenAI response'
      });
      return;
    }

    res.json({ success: true, value: data.value, expires_at: data.expires_at });
  } catch (error) {
    console.error('❌ Error creating realtime client secret:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create client secret'
    });
  }
});

// Create HTTP server and attach WebSocket for Gemini Live proxy
const server = createServer(app);

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
  if (pathname === '/ws/gemini-live') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', async (clientWs) => {
  let serviceUrl = null;
  let bearerToken = null;
  let serverWs = null;

  const firstMessageHandler = (data) => {
    try {
      const msg = JSON.parse(data.toString());
      serviceUrl = msg.service_url || null;
      bearerToken = msg.bearer_token || null;
    } catch (e) {
      clientWs.close(1008, 'Invalid JSON');
      return;
    }
  };

  const onceFirst = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
    clientWs.once('message', (data) => {
      clearTimeout(timeout);
      firstMessageHandler(data);
      resolve();
    });
  });

  try {
    await onceFirst;
  } catch (e) {
    clientWs.close(1008, 'Timeout waiting for setup');
    return;
  }

  if (!serviceUrl) {
    clientWs.close(1008, 'service_url required');
    return;
  }

  if (!bearerToken) {
    try {
      bearerToken = await getGoogleAccessToken();
    } catch (err) {
      console.error('❌ Gemini Live: failed to get access token:', err.message);
      clientWs.close(1008, 'Authentication failed');
      return;
    }
  }

  const headers = {
    Authorization: `Bearer ${bearerToken}`,
    'Content-Type': 'application/json'
  };

  try {
    serverWs = new WebSocket(serviceUrl, { headers });
  } catch (e) {
    clientWs.close(1008, 'Upstream connection failed');
    return;
  }

  const clientMessageQueue = [];
  function flushClientQueue() {
    while (clientMessageQueue.length && serverWs && serverWs.readyState === WebSocket.OPEN) {
      serverWs.send(clientMessageQueue.shift());
    }
  }

  serverWs.on('open', () => {
    console.log('✅ Gemini Live: connected to Vertex AI');
    flushClientQueue();
  });

  serverWs.on('message', (data) => {
    if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data);
  });
  serverWs.on('close', (code, reason) => {
    if (clientWs.readyState === WebSocket.OPEN) clientWs.close(code, reason);
  });
  serverWs.on('error', (err) => {
    console.error('Gemini Live upstream error:', err.message);
    if (clientWs.readyState === WebSocket.OPEN) clientWs.close(1011, 'Upstream error');
  });

  clientWs.on('message', (data) => {
    if (serverWs && serverWs.readyState === WebSocket.OPEN) {
      serverWs.send(data);
    } else {
      clientMessageQueue.push(data);
    }
  });
  clientWs.on('close', () => {
    if (serverWs) serverWs.close();
  });
  clientWs.on('error', () => {
    if (serverWs) serverWs.close();
  });
});

server.listen(PORT, () => {
  console.log(`🚀 MCP Proxy Server running on http://localhost:${PORT}`);
  console.log('📡 Available endpoints:');
  console.log('  GET  /api/health - Health check');
  console.log('  POST /api/realtime/client_secret - Get ephemeral token (uses OPENAI_API_KEY from .env)');
  console.log('  WS   /ws/gemini-live - Gemini Live API WebSocket proxy (Vertex AI, uses ADC)');
  console.log('  GET  /api/mcp/tools - List available MCP tools');
  console.log('  POST /api/mcp/tools/call - Call MCP tool');
  console.log('');
  console.log('📧 MCP Servers configured:');
  Object.entries(mcpServers).forEach(([name, config]) => {
    const serverInfo = config.type === 'http-streamable' 
      ? `${config.type} (${config.url})`
      : `${config.type} (${config.path})`;
    console.log(`  - ${name}: ${serverInfo}`);
  });
});

export default app;
