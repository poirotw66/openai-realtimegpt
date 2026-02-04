# OpenAI Realtime Voice Assistant

一個基於 OpenAI Realtime API 的智能語音助手，提供類似 ChatGPT 的使用體驗，支援實時語音對話、文字串流顯示，以及深色/淺色模式切換。

## ✨ 功能特色

### 🎤 語音對話
- **實時語音識別**：支援繁體中文和英文語音輸入
- **實時語音合成**：AI 回覆以語音播放
- **語音轉錄顯示**：使用者語音和 AI 回覆都會即時顯示在對話框中
- **測試音檔上傳**：可上傳音檔模擬語音輸入進行測試

### 💬 GPT-like 聊天介面
- **現代化設計**：簡潔優雅的對話介面，類似 ChatGPT
- **訊息氣泡**：使用者訊息（藍色）和 AI 回覆（白色）清晰區分
- **即時串流**：AI 回覆以打字效果即時顯示
- **流暢動畫**：平滑的過渡動畫和視覺反饋

### 🌓 深色/淺色模式
- **自動偵測**：首次載入時自動偵測系統偏好
- **一鍵切換**：隨時切換深色或淺色模式
- **持久化儲存**：選擇的模式會自動儲存
- **完整支援**：所有頁面和元件都支援主題切換

### 🎛️ 連線控制
- **暫停/繼續**：可暫停與模型的連線（WebRTC 模式），重新連線後繼續對話
- **掛斷連線**：結束與模型的連線
- **連線狀態顯示**：即時顯示連線狀態（聆聽中、已暫停、已掛斷）

### 🔧 工具整合
- **時間查詢**：AI 可查詢當前時間
- **MCP 工具**：支援 Model Context Protocol 工具整合
- **擴展性**：易於添加新的工具和功能

## 🚀 快速開始

### 前置需求

- Node.js 16+
- 現代瀏覽器（支援 WebRTC）
- OpenAI API Key

### 安裝步驟

1. **安裝依賴**
   ```bash
   cd first-agent
   npm install
   ```

2. **設定環境變數**
   
   在 `first-agent` 目錄下建立 `.env` 檔案：
   ```bash
   cp .env.example .env
   ```
   
   編輯 `.env`，填入你的 OpenAI API Key：
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

3. **啟動服務**
   ```bash
   npm run dev-full
   ```
   
   這個命令會同時啟動：
   - MCP 代理伺服器（`http://localhost:3001`）
   - 前端開發伺服器（`http://localhost:5173`）

4. **開啟瀏覽器**
   
   訪問 http://localhost:5173/，點擊「開始對話」即可開始使用。

## 📖 使用說明

### 基本流程

1. **選擇模型**：在模型選擇頁面選擇「GPT Realtime」
2. **建立連線**：系統會自動從後端取得 ephemeral token 並建立連線
3. **開始對話**：對麥克風說話，AI 會即時回應
4. **查看對話**：所有對話內容會即時顯示在對話框中

### 功能操作

- **切換主題**：點擊右上角的主題切換按鈕（🌙/☀️）
- **暫停連線**：點擊「暫停」按鈕暫停語音收發（僅 WebRTC 模式）
- **掛斷連線**：點擊「掛斷」按鈕結束連線
- **測試音檔**：在聊天頁面底部上傳音檔進行測試

### 主題模式

- **淺色模式**：清爽明亮的介面，適合白天使用
- **深色模式**：護眼的深色介面，適合夜間使用
- **自動切換**：首次載入時會自動偵測系統偏好

## 🏗️ 專案結構

```
openai-realtimegpt/
├── first-agent/              # 前端應用
│   ├── src/
│   │   ├── agent.ts         # Realtime Agent 核心邏輯
│   │   ├── App.tsx          # React 主應用
│   │   ├── theme.tsx        # 主題管理（深色/淺色模式）
│   │   ├── sessionHandler.ts # 事件處理和訊息顯示
│   │   ├── components/      # React 元件
│   │   │   ├── WelcomePage.tsx
│   │   │   ├── ModelSelection.tsx
│   │   │   ├── ConversationView.tsx
│   │   │   └── ThemeToggle.tsx
│   │   ├── tools/           # AI 工具定義
│   │   └── mcp/             # MCP 整合
│   ├── mcp-proxy-server.js  # MCP 代理伺服器
│   └── package.json
├── grounding-mcp/           # Google Search MCP Server
├── mcp_rag_server/          # RAG MCP Server
└── readme.md                # 本檔案
```

## 🎨 UI/UX 特色

### 設計系統
- **字體**：Inter（Google Fonts）
- **顏色系統**：完整的 CSS 變數系統，支援主題切換
- **響應式設計**：支援 375px、768px、1024px、1440px 斷點
- **可訪問性**：符合 WCAG AA 標準，支援鍵盤導航

### 互動體驗
- **平滑動畫**：所有狀態變化都有平滑過渡效果
- **即時反饋**：連線狀態、訊息串流都有視覺指示
- **直觀操作**：清晰的按鈕和狀態顯示

## 🔧 技術細節

### 核心技術
- **前端框架**：React 19 + TypeScript
- **構建工具**：Vite
- **SDK**：@openai/agents-realtime
- **傳輸協議**：WebRTC（瀏覽器）或 WebSocket

### 模型配置
- **預設模型**：`gpt-realtime-mini-2025-12-15`
- **語言設定**：繁體中文（可切換為英文）
- **語音轉錄**：自動轉錄使用者語音為文字

### API 整合
- **後端代理**：`mcp-proxy-server.js` 自動處理 ephemeral token 取得
- **環境變數**：使用 `.env` 檔案管理 API Key
- **安全性**：API Key 不會暴露在前端代碼中

## 🐛 故障排除

### 連線問題
- **無法連線**：確保 MCP 代理伺服器正在運行（`npm run dev-full`）
- **API Key 錯誤**：檢查 `.env` 檔案中的 `OPENAI_API_KEY` 是否正確
- **麥克風權限**：確保瀏覽器允許麥克風權限

### 顯示問題
- **使用者訊息未顯示**：檢查瀏覽器控制台是否有錯誤訊息
- **主題切換無效**：清除瀏覽器快取並重新載入頁面

### 音訊問題
- **無聲音輸出**：檢查瀏覽器音訊設定
- **語音識別失敗**：確保使用 HTTPS 或 localhost，並允許麥克風權限

## 📚 相關資源

- [OpenAI Realtime API 文檔](https://platform.openai.com/docs/api-reference/realtime)
- [@openai/agents-realtime SDK](https://www.npmjs.com/package/@openai/agents-realtime)
- [React 官方文檔](https://react.dev/)
- [Vite 官方文檔](https://vitejs.dev/)

## 🔐 安全注意事項

### API Key 管理
- ✅ 使用 `.env` 檔案在本地開發（已加入 `.gitignore`）
- ✅ API Key 由後端代理伺服器管理，不會暴露在前端
- ❌ **絕對不要**將 `.env` 檔案提交到 git
- ❌ **絕對不要**在客戶端代碼中硬編碼 API Key

### 生產環境建議
- 使用後端代理 API 調用
- 實施 API 調用限制和監控
- 定期檢查 API 使用量和費用
- 使用 HTTPS 加密傳輸

## 📝 更新日誌

### v2.0.0 (2025-02-03)
- ✨ 新增深色/淺色模式切換功能
- 🎨 優化 UI 設計，採用 GPT-like 聊天介面
- 🎤 修復使用者語音轉錄顯示問題
- ⏸️ 新增暫停/繼續功能（WebRTC 模式）
- 🔄 改進連線狀態顯示和用戶體驗
- 🐛 修復測試音檔轉錄顯示問題

### v1.0.0 (2025-09-03)
- ✅ 實現 Realtime API 集成
- ✅ 支援實時語音對話
- ✅ 支援實時文字串流
- ✅ 實現工具調用功能
- ✅ 完整的調試和測試功能

## 📄 許可證

MIT License

---

**享受你的 AI 語音助手體驗！** 🎉
