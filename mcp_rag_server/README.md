# M365 RAG Agent MCP Server

這是一個基於 Model Context Protocol (MCP) 的 Microsoft 365 知識庫問答服務。

## 功能特色

- **智能問答**: 使用 RAG (Retrieval Augmented Generation) 技術，從內部知識庫中檢索相關資訊並提供結構化回答
- **多種工具**: 提供問答、搜索、頁面上下文查詢等多種功能
- **結構化回答**: 根據問題類型提供五種不同的結構化回答格式
- **MCP 協議**: 基於標準 MCP 協議，可與各種支持 MCP 的客戶端整合

## 安裝與設定

### 1. 環境準備

```bash
cd mcp_rag_server
pip install -r requirements.txt
```

### 2. 環境變數設定

創建 `.env` 檔案並設定以下環境變數：

```env
GOOGLE_API_KEY=your_google_gemini_api_key
```

### 3. 確認資料庫路徑

確保 `config.yaml` 中的 ChromaDB 路徑正確指向您的向量資料庫：

```yaml
chroma_config:
  CHROMA_DIRECTORY: "../chroma_db_all_V2"
  CHROMA_COLLECTION_NAME: "rag_collection"
```

## 使用方式

### 直接執行

```bash
python server.py
```

### 作為 MCP Server 使用

配置您的 MCP 客戶端以連接到此 server：

```json
{
  "mcpServers": {
    "m365-rag-agent": {
      "command": "python",
      "args": ["/path/to/mcp_rag_server/server.py"]
    }
  }
}
```

## 可用工具

### 1. ask_m365_question

主要問答工具，提供完整的 RAG 功能。

**參數:**
- `question` (必需): Microsoft 365 相關問題
- `reset_chat` (可選): 是否重設對話歷史，預設為 false

**範例:**
```json
{
  "question": "如何在 Teams 中建立投票？",
  "reset_chat": false
}
```

### 2. search_knowledge_base

直接搜索知識庫工具。

**參數:**
- `query` (必需): 搜索查詢詞

**範例:**
```json
{
  "query": "SharePoint 權限設定"
}
```

### 3. get_page_context

獲取特定文件頁面的上下文資訊。

**參數:**
- `source` (必需): 文件來源名稱
- `page` (必需): 頁碼

**範例:**
```json
{
  "source": "SharePoint_教學手冊",
  "page": 15
}
```

## 回答框架

系統會根據問題類型提供結構化回答：

1. **操作教學類**: 開場說明 → 操作步驟 → 延伸資源
2. **問題解惑類**: 問題解析 → 解決方法 → 回報管道
3. **工具釐清類**: 工具定位說明 → 差異比較表 → 選擇建議
4. **情境應用建議類**: 情境解析 → 工具建議 → 操作方式 → 延伸補充
5. **制度流程說明類**: 制度說明 → 申請流程 → 權責單位

## 技術架構

- **後端框架**: Model Context Protocol (MCP)
- **語言模型**: Google Gemini 2.5 Flash
- **嵌入模型**: gemini-embedding-001
- **向量資料庫**: ChromaDB
- **代理框架**: LangChain Agent

## 故障排除

### 常見問題

1. **ChromaDB 連接失敗**
   - 檢查 `config.yaml` 中的資料庫路徑是否正確
   - 確認資料庫檔案存在且有讀寫權限

2. **Google API 金鑰錯誤**
   - 確認 `.env` 檔案中的 `GOOGLE_API_KEY` 設定正確
   - 檢查 API 金鑰是否有效且有足夠配額

3. **依賴套件問題**
   - 使用 `pip install -r requirements.txt` 重新安裝套件
   - 注意 pydantic 版本需要是 1.10.12

### 日誌除錯

執行時會在控制台顯示詳細的執行日誌，包括：
- 工具執行過程
- 搜索結果
- 錯誤訊息

## 擴展開發

### 新增工具

1. 在 `server.py` 中定義新的工具函數
2. 在 `@server.list_tools()` 中註冊新工具
3. 在 `@server.call_tool()` 中處理新工具的呼叫

### 自定義提示詞

修改 `config.yaml` 中的 `system_prompts` 區段來調整 AI 助理的行為。

## 版本資訊

- 版本: 1.0.0
- 支援的 MCP 協議版本: 最新版本
- Python 版本要求: 3.8+
