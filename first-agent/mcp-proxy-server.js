import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from first-agent or project root
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const uvPath = '/Users/cfh00896102/.local/bin/uv';

const mcpServers = {
  grounding: {
    path: path.resolve('..', 'grounding-mcp'),
    command: ['run', 'python', 'grounding_mcp/server.py'],
    tools: ['grounded_search']
  },
  rag: {
    path: path.resolve('..', 'mcp_rag_server'),
    command: ['run', 'python', 'server.py'],
    tools: ['ask_m365_question', 'search_knowledge_base', 'get_page_context']
  }
};

// Function to call a specific MCP server
async function callSpecificMCPServer(serverConfig, method, params = {}) {
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

    const child = spawn(uvPath, serverConfig.command, {
      cwd: serverConfig.path,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GEMINI_API_KEY: 'AIzaSyC5lKSpC33Bm1lJmMFuaSfA_0viHJqiWek'
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
    
    const toolPromises = Object.values(mcpServers).map(serverConfig => 
      callSpecificMCPServer(serverConfig, 'tools/list')
    );

    const results = await Promise.all(toolPromises);
    const allTools = results.flatMap(result => result.tools || []);

    console.log('✅ All tools listed successfully:', allTools);
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

app.listen(PORT, () => {
  console.log(`🚀 MCP Proxy Server running on http://localhost:${PORT}`);
  console.log('📡 Available endpoints:');
  console.log('  GET  /api/health - Health check');
  console.log('  POST /api/realtime/client_secret - Get ephemeral token (uses OPENAI_API_KEY from .env)');
  console.log('  GET  /api/mcp/tools - List available MCP tools');
  console.log('  POST /api/mcp/tools/call - Call MCP tool');
});

export default app;
