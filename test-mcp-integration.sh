#!/bin/bash

echo "🧪 Testing first-agent MCP integration..."

# Test 1: Check if MCP proxy server is running
echo "📡 Test 1: MCP Proxy Server Health Check"
curl -s http://localhost:3001/api/health | jq -r '.status' > /tmp/health_status.txt
if grep -q "ok" /tmp/health_status.txt; then
    echo "✅ MCP Proxy Server is running"
else
    echo "❌ MCP Proxy Server is not responding"
    exit 1
fi

# Test 2: List available tools
echo -e "\n🔧 Test 2: List MCP Tools"
TOOLS_RESPONSE=$(curl -s http://localhost:3001/api/mcp/tools)
if echo "$TOOLS_RESPONSE" | jq -e '.success' > /dev/null && echo "$TOOLS_RESPONSE" | jq -e '.tools[0].name' > /dev/null; then
    TOOL_NAME=$(echo "$TOOLS_RESPONSE" | jq -r '.tools[0].name')
    echo "✅ Found tool: $TOOL_NAME"
else
    echo "❌ Failed to list tools"
    echo "Response: $TOOLS_RESPONSE"
    exit 1
fi

# Test 3: Call grounded search tool
echo -e "\n🔍 Test 3: Call Grounded Search Tool"
SEARCH_RESPONSE=$(curl -s -X POST http://localhost:3001/api/mcp/tools/call \
    -H "Content-Type: application/json" \
    -d '{"name": "grounded_search", "arguments": {"query": "Current time in New York", "include_citations": true}}')

if echo "$SEARCH_RESPONSE" | jq -e '.success' > /dev/null; then
    echo "✅ Grounded search successful"
    # Extract and display the result
    RESULT_TEXT=$(echo "$SEARCH_RESPONSE" | jq -r '.result.content[0].text' | head -c 200)
    echo "📄 Search result preview: $RESULT_TEXT..."
else
    echo "❌ Grounded search failed"
    echo "Response: $SEARCH_RESPONSE"
    exit 1
fi

# Test 4: Check frontend availability
echo -e "\n🌐 Test 4: Frontend Availability"
if curl -s http://localhost:5173 > /dev/null; then
    echo "✅ Frontend is accessible at http://localhost:5173"
else
    echo "❌ Frontend is not accessible"
    exit 1
fi

echo -e "\n🎉 All tests passed! first-agent MCP integration is working correctly."
echo -e "\n📋 Summary:"
echo "   • MCP Proxy Server: http://localhost:3001"
echo "   • Frontend Application: http://localhost:5173"
echo "   • Available Tools: grounded_search"
echo -e "\n🚀 You can now use voice commands to search for information!"

# Cleanup
rm -f /tmp/health_status.txt
