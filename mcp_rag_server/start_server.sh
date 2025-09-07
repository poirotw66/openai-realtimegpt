#!/bin/bash

# M365 RAG Agent MCP Server Startup Script using UV
# This script ensures the correct Python environment is used with UV

cd /Users/cfh00896102/Github/m365_rag_agent/mcp_rag_server

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Start the server using uv
exec /Users/cfh00896102/.local/bin/uv run python server.py
