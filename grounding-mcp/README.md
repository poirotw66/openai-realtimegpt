# Grounding Search MCP Server

A Model Context Protocol (MCP) server that provides Google search grounding capabilities using Google's GenAI API.

## Features

- **Grounded Search**: Search for information using Google search with AI-powered grounding
- **Citations**: Automatically includes citations and source links in responses
- **Real-time Information**: Access to current information through Google search

## Setup

1. **Install Dependencies**:
   ```bash
   uv sync
   ```

2. **Environment Variables**:
   Create a `.env` file with your Google GenAI API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. **Run the Server** (from repo root or this directory):
   ```bash
   uv run --directory /path/to/grounding-mcp python grounding_mcp/server.py
   ```
   Replace `/path/to/grounding-mcp` with the actual path (e.g. `openai-realtimegpt/grounding-mcp`).

## Usage

The server provides one tool:

### `grounded_search`
Performs a search query with Google search grounding and returns results with citations.

**Parameters**:
- `query` (string, required): The search query
- `include_citations` (boolean, optional): Whether to include citations (default: true)

**Example**:
```json
{
  "name": "grounded_search",
  "arguments": {
    "query": "What are the latest developments in AI?",
    "include_citations": true
  }
}
```

## MCP Client Configuration

**In this repo**: The `first-agent` app uses `mcp-proxy-server.js` to start this server via **stdio** (path: `openai-realtimegpt/grounding-mcp`). No extra client config needed when running `npm run dev-full`.

For other MCP clients:

```json
{
  "mcpServers": {
    "grounding-search": {
      "command": "uv",
      "args": ["run", "--directory", "/path/to/grounding-mcp", "python", "grounding_mcp/server.py"],
      "cwd": "/path/to/grounding-mcp"
    }
  }
}
```
Replace `/path/to/grounding-mcp` with your actual path (e.g. the repo's `grounding-mcp` folder).

## Development

The server is built using:
- [MCP (Model Context Protocol)](https://github.com/modelcontextprotocol/python-sdk)
- [Google GenAI](https://github.com/google/generative-ai-python)
- [python-dotenv](https://github.com/theskumar/python-dotenv)

## License

This project is licensed under the MIT License.