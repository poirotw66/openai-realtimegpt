# 🔧 MCP Server 錯誤修復指南

## 遇到的問題

基於您提供的錯誤日誌：

```
2025-09-06T15:20:01.549Z [m365-rag-agent] [info] Initializing server...
2025-09-06T15:20:01.601Z [m365-rag-agent] [info] Server started and connected successfully
Traceback (most recent call last):
  File "/Users/cfh00896102/Github/m365_rag_agent/mcp_rag_server/server.py", line 15, in <module>
    import yaml
ModuleNotFoundError: No module named 'yaml'
```

## 問題分析

雖然 pip 顯示套件已安裝，但 Claude Desktop 可能使用了不同的 Python 環境。

## 解決方案

### 方案 1: 使用絕對路徑和明確的 Python 環境

更新 Claude Desktop 配置文件 `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "grounding-search": {
      "command": "/Users/cfh00896102/.local/bin/uv",
      "args": [
        "run",
        "--directory",
        "/Users/cfh00896102/Github/openai-realtimegpt/grounding-mcp",
        "python",
        "grounding_mcp/server.py"
      ],
      "env": {
        "GEMINI_API_KEY": "AIzaSyC5lKSpC33Bm1lJmMFuaSfA_0viHJqiWek"
      }
    },
    "m365-rag-agent": {
      "command": "/Users/cfh00896102/miniconda3/envs/breeze/bin/python",
      "args": ["/Users/cfh00896102/Github/m365_rag_agent/mcp_rag_server/server.py"],
      "env": {
        "GOOGLE_API_KEY": "AIzaSyC5lKSpC33Bm1lJmMFuaSfA_0viHJqiWek",
        "PYTHONPATH": "/Users/cfh00896102/miniconda3/envs/breeze/lib/python3.11/site-packages"
      }
    }
  }
}
```

### 方案 2: 創建啟動腳本

創建一個包含環境設定的啟動腳本：

**創建 `start_server.sh`:**

```bash
#!/bin/bash
cd /Users/cfh00896102/Github/m365_rag_agent/mcp_rag_server
export PATH="/Users/cfh00896102/miniconda3/envs/breeze/bin:$PATH"
export PYTHONPATH="/Users/cfh00896102/miniconda3/envs/breeze/lib/python3.11/site-packages"
/Users/cfh00896102/miniconda3/envs/breeze/bin/python server.py
```

然後在 Claude Desktop 配置中使用：

```json
"m365-rag-agent": {
  "command": "/Users/cfh00896102/Github/m365_rag_agent/mcp_rag_server/start_server.sh",
  "args": []
}
```

### 方案 3: 使用虛擬環境

在 MCP server 目錄中創建獨立的虛擬環境：

```bash
cd /Users/cfh00896102/Github/m365_rag_agent/mcp_rag_server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

然後在 Claude Desktop 配置中使用：

```json
"m365-rag-agent": {
  "command": "/Users/cfh00896102/Github/m365_rag_agent/mcp_rag_server/venv/bin/python",
  "args": ["/Users/cfh00896102/Github/m365_rag_agent/mcp_rag_server/server.py"]
}
```

## 立即解決步驟

1. **停止 Claude Desktop**
2. **應用上述任一方案更新配置**
3. **重新啟動 Claude Desktop**
4. **測試連接**

## 測試命令

在 Claude Desktop 中嘗試：
```
你可以使用哪些工具？
```

如果看到 m365-rag-agent 的工具，表示連接成功！
