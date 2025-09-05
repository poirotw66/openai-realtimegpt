#!/bin/bash

echo "🚀 設置 Claude Desktop 使用 Grounding MCP 服務器..."

# 創建 Claude 配置目錄
CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
mkdir -p "$CLAUDE_CONFIG_DIR"

# 複製配置文件
CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

# 讀取實際的 API Key
GEMINI_API_KEY=$(grep "GEMINI_API_KEY=" .env | cut -d'=' -f2)

# 創建配置文件
cat > "$CONFIG_FILE" << EOF
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
        "GEMINI_API_KEY": "$GEMINI_API_KEY"
      }
    }
  }
}
EOF

echo "✅ 配置文件已創建: $CONFIG_FILE"
echo ""
echo "📋 接下來的步驟:"
echo "1. 關閉 Claude Desktop (如果正在運行)"
echo "2. 重新啟動 Claude Desktop"
echo "3. 在 Claude 中輸入: '使用 grounded_search 工具搜索台灣的首都'"
echo ""
echo "🔧 配置內容:"
cat "$CONFIG_FILE"
