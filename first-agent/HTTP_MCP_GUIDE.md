# HTTP-Based MCP 整合使用指南

## 概述
由於瀏覽器環境限制，我們使用 HTTP 代理服務器來與 MCP 服務器通信。

## 架構設計
```
前端 (React App)
    ↓ HTTP/fetch
Express 代理服務器 (port 3001)
    ↓ MCP Protocol
Grounding MCP Server
    ↓  
Google GenAI API
```

## 文件結構
```
first-agent/
├── mcp-proxy-server.js           # Express 代理服務器
├── src/
│   └── mcp/
│       ├── httpGroundingClient.ts # HTTP MCP 客戶端
│       └── mcpServer.ts           # 服務器包裝器
└── package.json                   # 更新的腳本和依賴
```

## 使用步驟

### 1. 確保環境準備
```bash
# 檢查 grounding-mcp 服務器
cd ../grounding-mcp
cat .env  # 確保有 GEMINI_API_KEY

# 測試 MCP 服務器
/Users/cfh00896102/.local/bin/uv run python grounding_mcp/server.py
```

### 2. 啟動應用

#### 方法一：同時啟動（推薦）
```bash
cd first-agent
npm run dev-full
```

#### 方法二：分別啟動
```bash
# 終端 1：啟動 MCP 代理服務器
npm run mcp-server

# 終端 2：啟動前端
npm run dev
```

### 3. 測試 API 端點

代理服務器提供以下端點：
- `GET /api/health` - 健康檢查
- `GET /api/mcp/tools` - 列出可用工具
- `POST /api/mcp/tools/call` - 調用工具

測試示例：
```bash
# 健康檢查
curl http://localhost:3001/api/health

# 列出工具
curl http://localhost:3001/api/mcp/tools

# 調用搜索工具
curl -X POST http://localhost:3001/api/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name": "grounded_search", "arguments": {"query": "台灣新聞"}}'
```

## 在應用中使用

當用戶向 AI 助手提問需要搜索的內容時，系統會：

1. **前端**: 用戶提問 "搜索台灣新聞"
2. **RealtimeAgent**: 識別需要使用搜索工具
3. **HTTP 客戶端**: 向代理服務器發送 HTTP 請求
4. **代理服務器**: 與 MCP 服務器通信
5. **MCP 服務器**: 調用 Google GenAI API
6. **返回結果**: 逐層返回搜索結果

## 錯誤處理

### 1. 代理服務器未啟動
```
❌ Failed to connect to MCP proxy server: MCP Proxy Server not available
```
**解決**: 確保運行 `npm run mcp-server`

### 2. MCP 服務器問題
```
❌ MCP Error: ...
```
**解決**: 檢查 grounding-mcp 配置和 API 密鑰

### 3. CORS 問題
代理服務器已配置 CORS，應該不會有跨域問題。

## 開發調試

### 查看日誌
- **代理服務器日誌**: 檢查代理服務器終端輸出
- **瀏覽器控制台**: 查看前端日誌
- **Network 面板**: 檢查 HTTP 請求

### 測試工具可用性
```javascript
// 在瀏覽器控制台測試
fetch('http://localhost:3001/api/mcp/tools')
  .then(r => r.json())
  .then(console.log);
```

## 生產部署

對於生產環境，你需要：
1. 將代理服務器部署到雲服務器
2. 更新前端的 API 端點 URL
3. 配置適當的環境變數和安全設置

這個方案解決了瀏覽器環境下無法直接使用 MCP SDK 的問題，提供了穩定的 HTTP API 接口！🎉
