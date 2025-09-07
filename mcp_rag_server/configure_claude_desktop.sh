#!/bin/bash

# Claude Desktop MCP Configuration Script for M365 RAG Agent

echo "🤖 Setting up Claude Desktop MCP configuration for M365 RAG Agent..."

# Configuration variables
CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"
SERVER_PATH="/Users/cfh00896102/Github/m365_rag_agent/mcp_rag_server/server.py"
ENV_FILE="/Users/cfh00896102/Github/m365_rag_agent/mcp_rag_server/.env"

# Read API key from .env file
if [ -f "$ENV_FILE" ]; then
    API_KEY=$(grep "GOOGLE_API_KEY=" "$ENV_FILE" | cut -d'=' -f2 | tr -d ' ')
    if [ -z "$API_KEY" ]; then
        echo "❌ GOOGLE_API_KEY not found in .env file"
        echo "Please set your API key in .env file first"
        exit 1
    fi
else
    echo "❌ .env file not found"
    echo "Please run setup.sh first to create the .env file"
    exit 1
fi

# Create Claude config directory if it doesn't exist
if [ ! -d "$CLAUDE_CONFIG_DIR" ]; then
    echo "📁 Creating Claude config directory..."
    mkdir -p "$CLAUDE_CONFIG_DIR"
fi

# Check if config file exists
if [ -f "$CLAUDE_CONFIG_FILE" ]; then
    echo "📝 Claude Desktop config file already exists"
    echo "Creating backup..."
    cp "$CLAUDE_CONFIG_FILE" "$CLAUDE_CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Check if the config already has mcpServers
    if grep -q "mcpServers" "$CLAUDE_CONFIG_FILE"; then
        echo "⚠️  Existing mcpServers found in config"
        echo "Please manually merge the following configuration:"
        echo ""
        echo "Add this to your mcpServers section:"
        cat << EOF
    "m365-rag-agent": {
      "command": "python3",
      "args": ["$SERVER_PATH"],
      "env": {
        "GOOGLE_API_KEY": "$API_KEY"
      }
    }
EOF
        echo ""
        echo "Full example config saved to: claude_desktop_config_example.json"
        
        # Create example config
        cat << EOF > claude_desktop_config_example.json
{
  "mcpServers": {
    "m365-rag-agent": {
      "command": "python3",
      "args": ["$SERVER_PATH"],
      "env": {
        "GOOGLE_API_KEY": "$API_KEY"
      }
    }
  }
}
EOF
        
    else
        # Add mcpServers to existing config
        echo "🔧 Adding M365 RAG Agent to existing config..."
        # Remove the closing brace, add our config, then close
        head -n -1 "$CLAUDE_CONFIG_FILE" > temp_config.json
        cat << EOF >> temp_config.json
  ,"mcpServers": {
    "m365-rag-agent": {
      "command": "python3",
      "args": ["$SERVER_PATH"],
      "env": {
        "GOOGLE_API_KEY": "$API_KEY"
      }
    }
  }
}
EOF
        mv temp_config.json "$CLAUDE_CONFIG_FILE"
        echo "✅ Configuration updated"
    fi
else
    # Create new config file
    echo "📝 Creating new Claude Desktop config file..."
    cat << EOF > "$CLAUDE_CONFIG_FILE"
{
  "mcpServers": {
    "m365-rag-agent": {
      "command": "python3",
      "args": ["$SERVER_PATH"],
      "env": {
        "GOOGLE_API_KEY": "$API_KEY"
      }
    }
  }
}
EOF
    echo "✅ New configuration created"
fi

echo ""
echo "🎉 Configuration complete!"
echo ""
echo "Next steps:"
echo "1. Restart Claude Desktop application"
echo "2. Test the connection by asking:"
echo "   '你可以使用哪些工具？'"
echo "   '請幫我搜索 Teams 會議相關資料'"
echo ""
echo "Configuration file location: $CLAUDE_CONFIG_FILE"
echo ""
echo "If you encounter issues, check the troubleshooting section in:"
echo "CLAUDE_DESKTOP_SETUP.md"
