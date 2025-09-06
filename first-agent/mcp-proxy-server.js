import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// MCP 服務器通信函數
async function callMCPServer(method, params = {}) {
  return new Promise((resolve, reject) => {
    const mcpServerPath = path.resolve('..', 'grounding-mcp');
    const uvPath = '/Users/cfh00896102/.local/bin/uv';

    // 創建 MCP 請求序列
    const requests = [];
    
    // Initialize request
    requests.push(JSON.stringify({
      "jsonrpc": "2.0",
      "id": 1,
      "method": "initialize",
      "params": {
        "protocolVersion": "2024-11-05",
        "capabilities": {
          "tools": {}
        },
        "clientInfo": {
          "name": "first-agent",
          "version": "1.0.0"
        }
      }
    }));

    // Initialized notification
    requests.push(JSON.stringify({
      "jsonrpc": "2.0",
      "method": "notifications/initialized"
    }));

    // 添加實際的方法調用
    if (method === 'tools/list') {
      requests.push(JSON.stringify({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/list",
        "params": {}
      }));
    } else if (method === 'tools/call') {
      requests.push(JSON.stringify({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/call",
        "params": params
      }));
    }

    const inputData = requests.join('\n') + '\n';

    console.log('🔧 Calling MCP server:', method, params);
    console.log('📨 Sending requests:', requests);

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
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      console.log('MCP server process closed with code:', code);

      try {
        const lines = stdout.trim().split('\n');
        let result = null;

        // 查找 id: 2 的響應（我們的實際請求）
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
          reject(new Error('No valid response from MCP server'));
        }
      } catch (parseError) {
        console.error('Error parsing MCP response:', parseError);
        console.error('Raw stdout:', stdout);
        console.error('Raw stderr:', stderr);
        reject(parseError);
      }
    });

    child.on('error', (error) => {
      console.error('Error spawning MCP server:', error);
      reject(error);
    });

    // 發送輸入到 MCP 服務器
    child.stdin.write(inputData);
    child.stdin.end();
  });
}

// API 端點：列出可用工具
app.get('/api/mcp/tools', async (req, res) => {
  try {
    console.log('📡 GET /api/mcp/tools - Listing available tools');
    
    const result = await callMCPServer('tools/list');
    
    console.log('✅ Tools listed successfully:', result);
    res.json({
      success: true,
      tools: result.tools || []
    });
  } catch (error) {
    console.error('❌ Error listing tools:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API 端點：調用工具
app.post('/api/mcp/tools/call', async (req, res) => {
  try {
    const { name, arguments: args } = req.body;
    
    console.log(`📡 POST /api/mcp/tools/call - Calling tool: ${name}`, args);
    
    const result = await callMCPServer('tools/call', {
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

// 健康檢查端點
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 MCP Proxy Server running on http://localhost:${PORT}`);
  console.log('📡 Available endpoints:');
  console.log('  GET  /api/health - Health check');
  console.log('  GET  /api/mcp/tools - List available MCP tools');
  console.log('  POST /api/mcp/tools/call - Call MCP tool');
});

export default app;
