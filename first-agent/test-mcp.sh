#!/bin/bash

echo "🧪 Testing MCP Proxy Server..."

# Test health endpoint
echo "📋 Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:3001/api/health)
echo "Health response: $HEALTH_RESPONSE"

# Test tools list endpoint  
echo "📋 Testing tools list endpoint..."
TOOLS_RESPONSE=$(curl -s http://localhost:3001/api/mcp/tools)
echo "Tools response: $TOOLS_RESPONSE"

# Test grounded search tool
echo "📋 Testing grounded search tool..."
SEARCH_RESPONSE=$(curl -s -X POST http://localhost:3001/api/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name": "grounded_search", "arguments": {"query": "Taiwan news today", "include_citations": true}}')
echo "Search response: $SEARCH_RESPONSE"

echo "🧪 Testing completed!"
