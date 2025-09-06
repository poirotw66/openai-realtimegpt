# First-Agent 與 Grounding-MCP 整合指南

## 概述

本指南說明如何讓 `first-agent` 使用 MCP (Model Context Protocol) 協議與 `grounding-mcp` 進行通信，實現 Google 搜索功能的整合。

## 系統架構

```
first-agent (React + OpenAI Realtime API)
    ↓ HTTP API calls
mcp-proxy-server.js (Express.js 代理服務器)
    ↓ MCP Protocol (stdio)
grounding-mcp (Python MCP Server)
    ↓ API calls
Google GenAI API (Gemini + Grounding)
```

## 組件說明

### 1. first-agent (前端應用)
- **位置**: `/first-agent/`
- **技術**: React + TypeScript + Vite + OpenAI Realtime API
- **端口**: 5173 (開發模式)
- **功能**: 提供語音交互界面，整合 MCP 工具

### 2. mcp-proxy-server.js (MCP 代理服務器)
- **位置**: `/first-agent/mcp-proxy-server.js`
- **技術**: Node.js + Express.js
- **端口**: 3001
- **功能**: 
  - 將 HTTP API 請求轉換為 MCP 協議
  - 管理與 grounding-mcp 服務器的通信
  - 提供 RESTful API 接口

### 3. grounding-mcp (Python MCP 服務器)
- **位置**: `/grounding-mcp/`
- **技術**: Python + MCP + Google GenAI
- **通信**: stdin/stdout (MCP 標準)
- **功能**: 提供 Google 搜索與內容生成服務

## API 接口

### MCP Proxy Server 端點

1. **健康檢查**
   ```bash
   GET http://localhost:3001/api/health
   ```

2. **列出可用工具**
   ```bash
   GET http://localhost:3001/api/mcp/tools
   ```
   
   **響應範例**:
   ```json
   {
     "success": true,
     "tools": [
       {
         "name": "grounded_search",
         "description": "Search for information using Google search with grounding and citations",
         "inputSchema": {
           "type": "object",
           "properties": {
             "query": {
               "type": "string",
               "description": "The search query to find information about"
             },
             "include_citations": {
               "type": "boolean",
               "description": "Whether to include citations in the response",
               "default": true
             }
           },
           "required": ["query"]
         }
       }
     ]
   }
   ```

3. **調用工具**
   ```bash
   POST http://localhost:3001/api/mcp/tools/call
   Content-Type: application/json
   
   {
     "name": "grounded_search",
     "arguments": {
       "query": "What is the weather in Tokyo today?",
       "include_citations": true
     }
   }
   ```

## 設定步驟

### 1. 環境準備

#### grounding-mcp 環境設定
```bash
cd /Users/cfh00896102/Github/openai-realtimegpt/grounding-mcp
# 確保 uv 已安裝
/Users/cfh00896102/.local/bin/uv --version
```

#### 設定環境變數
在 `mcp-proxy-server.js` 中已設定 GEMINI_API_KEY:
```javascript
env: {
  ...process.env,
  GEMINI_API_KEY: 'AIzaSyC5lKSpC33Bm1lJmMFuaSfA_0viHJqiWek'
}
```

### 2. 啟動服務

#### 方法一：分別啟動（推薦用於調試）

1. **啟動 MCP 代理服務器**:
   ```bash
   cd /Users/cfh00896102/Github/openai-realtimegpt/first-agent
   npm run mcp-server
   ```
   
2. **啟動前端應用**:
   ```bash
   cd /Users/cfh00896102/Github/openai-realtimegpt/first-agent
   npm run dev
   ```

#### 方法二：同時啟動

```bash
cd /Users/cfh00896102/Github/openai-realtimegpt/first-agent
npm run dev-full
```

### 3. 驗證設定

1. **檢查 MCP 代理服務器**:
   ```bash
   curl -X GET http://localhost:3001/api/health
   ```

2. **測試工具列表**:
   ```bash
   curl -X GET http://localhost:3001/api/mcp/tools
   ```

3. **測試搜索功能**:
   ```bash
   curl -X POST http://localhost:3001/api/mcp/tools/call \
     -H "Content-Type: application/json" \
     -d '{"name": "grounded_search", "arguments": {"query": "What is the weather in Tokyo today?", "include_citations": true}}'
   ```

## 核心代碼文件

### 1. MCP 客戶端整合

**文件**: `/first-agent/src/mcp/httpGroundingClient.ts`
- 實現 HTTP 客戶端與 MCP 代理服務器通信
- 提供 `connect()`, `listTools()`, `callTool()` 方法

**文件**: `/first-agent/src/mcp/mcpServer.ts`
- 包裝 MCP 客戶端，轉換為 OpenAI Realtime API 格式
- 整合到 RealtimeAgent 工具系統

### 2. Agent 整合

**文件**: `/first-agent/src/agent.ts`
- 初始化 MCP 服務器連接
- 將 MCP 工具整合到 RealtimeAgent
- 設定中英文支持

### 3. MCP 代理服務器

**文件**: `/first-agent/mcp-proxy-server.js`
- Express.js 服務器，提供 HTTP API
- 實現 MCP 協議通信
- 處理請求/響應轉換

## 功能特色

1. **多語言支持**: 支持中文和英文查詢
2. **引用功能**: 搜索結果包含來源引用
3. **實時語音**: 通過 OpenAI Realtime API 支持語音交互
4. **標準協議**: 使用 MCP 標準協議，便於擴展其他工具

## 故障排除

### 常見問題

1. **MCP 服務器無響應**:
   - 檢查 GEMINI_API_KEY 是否正確設定
   - 確認 Python 環境和依賴項已安裝
   ```bash
   cd /Users/cfh00896102/Github/openai-realtimegpt/grounding-mcp
   /Users/cfh00896102/.local/bin/uv run python -c "import mcp; print('MCP imported successfully')"
   ```

2. **代理服務器連接失敗**:
   - 確認端口 3001 未被占用
   - 檢查防火牆設置

3. **前端連接問題**:
   - 確認 MCP 代理服務器正在運行
   - 檢查瀏覽器控制台錯誤信息

### 調試模式

在 `first-agent` 中添加了調試功能，開發模式下可以查看：
- MCP 工具調用日誌
- 響應數據詳情
- 錯誤追蹤信息

## 擴展指南

### 添加新的 MCP 工具

1. 在 `grounding-mcp` 中添加新工具定義
2. 更新 `handle_list_tools()` 和 `handle_call_tool()` 方法
3. 重啟 MCP 代理服務器
4. 新工具會自動整合到 RealtimeAgent

### 自定義工具參數

修改 `inputSchema` 來定義工具參數：
```python
inputSchema = {
    "type": "object",
    "properties": {
        "query": {"type": "string", "description": "搜索查詢"},
        "language": {"type": "string", "enum": ["zh", "en"], "default": "zh"}
    },
    "required": ["query"]
}
```

這個整合方案提供了一個完整的、可擴展的 MCP 通信架構，讓 first-agent 能夠無縫使用 grounding-mcp 提供的 Google 搜索服務。
