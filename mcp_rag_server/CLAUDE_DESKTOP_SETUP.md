# Claude Desktop MCP Configuration for M365 RAG Agent

## 配置步驟

### 1. 找到 Claude Desktop 的配置檔案位置

在 macOS 上，Claude Desktop 的配置檔案位置是：
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

### 2. 編輯配置檔案

如果檔案不存在，請創建它。然後添加以下配置：

```json
{
  "mcpServers": {
    "m365-rag-agent": {
      "command": "python3",
      "args": ["/Users/cfh00896102/Github/m365_rag_agent/mcp_rag_server/server.py"],
      "env": {
        "GOOGLE_API_KEY": "AIzaSyC5lKSpC33Bm1lJmMFuaSfA_0viHJqiWek"
      }
    }
  }
}
```

### 3. 如果您已經有其他 MCP servers，請合併配置

如果您的配置檔案已經存在其他 MCP servers，請將 "m365-rag-agent" 區塊添加到現有的 "mcpServers" 物件中：

```json
{
  "mcpServers": {
    "existing-server": {
      "command": "...",
      "args": ["..."]
    },
    "m365-rag-agent": {
      "command": "python3",
      "args": ["/Users/cfh00896102/Github/m365_rag_agent/mcp_rag_server/server.py"],
      "env": {
        "GOOGLE_API_KEY": "AIzaSyC5lKSpC33Bm1lJmMFuaSfA_0viHJqiWek"
      }
    }
  }
}
```

### 4. 重新啟動 Claude Desktop

配置完成後，請重新啟動 Claude Desktop 應用程式。

### 5. 驗證連接

重新啟動後，您可以在 Claude Desktop 中詢問：
- "你可以使用哪些工具？"
- "請幫我搜索 Teams 會議相關資料"
- "如何在 SharePoint 中設定權限？"

## 可用的工具

一旦連接成功，您將可以使用以下三個工具：

1. **ask_m365_question**: 完整的 M365 問答功能
2. **search_knowledge_base**: 直接搜索內部知識庫  
3. **get_page_context**: 獲取特定文件頁面的上下文

## 故障排除

如果連接失敗，請檢查：

1. **路徑是否正確**: 確認 server.py 的完整路徑
2. **Python 環境**: 確認 `python3` 命令可用且安裝了所需套件
3. **API 金鑰**: 確認 Google API 金鑰有效
4. **資料庫路徑**: 確認 ChromaDB 路徑在 config.yaml 中正確設定
5. **權限**: 確認 Claude Desktop 有權限執行 Python 腳本

## 測試指令

您可以在 Claude Desktop 中嘗試這些測試指令：

```
請幫我搜索關於"Teams 會議錄影"的資料
```

```
如何在 Outlook 中設定自動回覆？
```

```
SharePoint 和 OneDrive 有什麼差別？
```
