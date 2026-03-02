# OpenAI Realtime Voice Assistant（前端與代理）

本目錄為 **openai-realtimegpt** 主應用的前端與後端代理：React 介面、OpenAI Realtime / Gemini Live 連線，以及 MCP 代理伺服器。

## 功能特色

- **雙模型**：GPT Realtime（OpenAI）與 Gemini Live（Vertex AI），於模型選擇頁面切換
- **實時語音**：語音輸入、語音輸出、轉錄即時顯示
- **文字輸入**：可輸入文字發送給模型
- **測試音檔**：上傳音檔模擬語音輸入
- **對話歷史**：本機儲存與載入對話記錄
- **深色/淺色模式**：主題切換並持久化
- **MCP 工具**：透過 `mcp-proxy-server.js` 整合 grounding、RAG、Email 等 MCP Server

## 系統需求

- Node.js 16+
- 現代瀏覽器（支援 WebRTC）
- OpenAI API Key（GPT Realtime，可由後端 `.env` 提供）
- 若使用 Gemini Live：Google Cloud 專案 ID 與 `gcloud auth application-default login`

## 安裝與啟動

### 1. 安裝依賴

```bash
cd first-agent
npm install
```

### 2. 環境變數

複製範例並編輯 `.env`：

```bash
cp .env.example .env
```

至少設定（GPT Realtime）：

```
OPENAI_API_KEY=your_api_key_here
```

可選：

- **Gemini Live**：`GOOGLE_CLOUD_PROJECT`、`VITE_GOOGLE_CLOUD_PROJECT`，並執行 `gcloud auth application-default login`
- **Email MCP**：於 `mcp_sent_mail/.env` 設定帳密；或設 `EMAIL_MCP_DISABLED=true` 關閉

### 3. 啟動方式

**僅前端（需後端與 MCP 另行啟動）：**

```bash
npm run dev
```

**完整環境（推薦）：** 同時啟動 MCP 代理、Gemini 後端、Email MCP、前端

```bash
npm run dev-full
```

會啟動：

- MCP 代理：`http://localhost:3001`
- Gemini 後端：`http://localhost:8001`
- Email MCP：`http://localhost:8082/mcp`（若未禁用）
- 前端：`http://localhost:5173`

### 4. 使用

開啟 http://localhost:5173/，點擊「開始對話」→ 選擇模型（GPT Realtime 或 Gemini Live）→ 建立連線後即可語音/文字對話。

## 專案結構

```
first-agent/
├── src/
│   ├── agent.ts           # OpenAI Realtime Agent
│   ├── geminiLive.ts      # Gemini Live 連線與麥克風
│   ├── App.tsx            # 主應用與路由視圖
│   ├── theme.tsx          # 深色/淺色主題
│   ├── sessionHandler.ts  # 訊息與事件處理
│   ├── components/        # WelcomePage, ModelSelection, ConversationView, ConversationHistory, ThemeToggle 等
│   ├── tools/             # get_current_time 等工具定義
│   ├── mcp/               # MCP 客戶端（grounding、email）
│   └── utils/             # conversationHistory 儲存
├── mcp-proxy-server.js    # MCP 代理（ephemeral token、MCP tools、Gemini Live WebSocket）
├── gemini_backend.py      # Gemini Live 後端 API
├── package.json
└── .env.example
```

## 腳本說明

| 腳本 | 說明 |
|------|------|
| `npm run dev` | 僅啟動 Vite 前端 |
| `npm run mcp-server` | 僅啟動 MCP 代理 |
| `npm run gemini-backend` | 僅啟動 Gemini 後端 |
| `npm run email-mcp` | 僅啟動 Email MCP（在 `mcp_sent_mail`，port 8082） |
| `npm run dev-full` | 同時啟動上述四項（開發推薦） |
| `npm run build` | 建置生產版 |
| `npm run preview` | 預覽建置結果 |

## 工具與 MCP

- **內建工具**：`get_current_time`（可於 `src/tools/` 擴充）
- **MCP**：由 `mcp-proxy-server.js` 連接 grounding-mcp（stdio）、mcp_rag_server（stdio）、mcp_sent_mail（http-streamable，預設 `http://localhost:8082/mcp`）

API Key 由後端與 `.env` 管理，不暴露於前端程式碼。

## 故障排除

- **無法連線**：確認已執行 `npm run dev-full`，或手動啟動 MCP 代理與前端。
- **GPT 連線失敗**：檢查 `first-agent/.env` 的 `OPENAI_API_KEY`。
- **Gemini 無法使用**：確認已執行 `gcloud auth application-default login` 且 `GOOGLE_CLOUD_PROJECT` 已設定。
- **麥克風無效**：允許瀏覽器麥克風權限，並使用 HTTPS 或 localhost。

## 相關資源

- [專案根目錄 README](../README.md)：整體說明、介面預覽、快速開始
- [OpenAI Realtime API](https://platform.openai.com/docs/api-reference/realtime)
- [@openai/agents-realtime](https://www.npmjs.com/package/@openai/agents-realtime)

## 許可證

MIT License
