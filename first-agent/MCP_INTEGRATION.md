# MCP 整合使用指南

## 概述
這個項目現在使用原生的 MCP (Model Context Protocol) 支持來與 grounding-mcp 服務器通信，讓 AI 助手可以進行實時網絡搜索。

## 架構設計
```
first-agent (React App)
    ↓
RealtimeAgent (原生 MCP 支持)
    ↓
MCP Client (SDK)
    ↓
Grounding MCP Server
    ↓  
Google GenAI API
```

## 新增功能

### 1. MCP 客戶端 (`src/mcp/groundingClient.ts`)
- 使用 `@modelcontextprotocol/sdk` 與 MCP 服務器通信
- 支持工具列表和工具調用
- 自動管理連接生命週期

### 2. MCP 服務器包裝器 (`src/mcp/mcpServer.ts`) 
- 將 MCP 工具轉換為 RealtimeAgent 兼容格式
- 處理工具調用和錯誤處理
- 提供連接狀態管理

### 3. 集成到 RealtimeAgent
- 在 `connectSession` 時自動初始化 MCP 服務器
- 將 MCP 工具添加到 agent 的可用工具列表
- 提供清理功能

## 使用方法

### 1. 確保環境配置
```bash
# 確保 grounding-mcp 目錄存在且配置正確
cd ../grounding-mcp
cat .env  # 應該包含 GEMINI_API_KEY

# 測試 MCP 服務器是否可用
/Users/cfh00896102/.local/bin/uv run python grounding_mcp/server.py
```

### 2. 啟動應用
```bash
cd first-agent
npm run dev
```

### 3. 在應用中使用
當用戶詢問需要搜索的問題時，AI 助手會自動：
1. 連接到 MCP 服務器
2. 調用 `grounded_search` 工具
3. 返回實時搜索結果

## 示例對話
- 用戶："搜索台灣今日新聞"
- 助手會自動調用搜索工具並返回結果

## 技術細節

### MCP 工具格式轉換
MCP 服務器返回的工具會被轉換為 RealtimeAgent 格式：
```javascript
{
  type: 'function',
  name: tool.name,
  description: tool.description,
  parameters: tool.inputSchema,
  invoke: async (runContext, input) => { /* MCP 調用邏輯 */ }
}
```

### 錯誤處理
- MCP 連接失敗時會回退到基本工具
- 工具調用錯誤會返回錯誤信息
- 自動重試和清理機制

### 生命週期管理
```javascript
// 連接時初始化
await connectSession(apiKey);

// 可選：手動清理
await cleanupMCPServer();
```

## 故障排除

### 1. MCP 連接失敗
```bash
# 檢查 grounding-mcp 服務器
cd ../grounding-mcp
/Users/cfh00896102/.local/bin/uv run python grounding_mcp/server.py

# 檢查 uv 路徑
which uv
```

### 2. 工具不可用  
- 確保 GEMINI_API_KEY 設置正確
- 檢查網絡連接
- 查看瀏覽器控制台錯誤信息

### 3. 開發調試
```javascript
// 在瀏覽器控制台查看 MCP 狀態
console.log('MCP Ready:', groundingMCPServer.isReady());
```

這樣，你的 first-agent 現在完全使用原生 MCP 支持與 grounding 搜索服務器通信！🎉
