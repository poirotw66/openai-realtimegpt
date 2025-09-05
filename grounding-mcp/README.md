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

3. **Run the Server**:
   ```bash
   /Users/cfh00896102/.local/bin/uv run --directory /path/to/grounding-mcp python grounding_mcp/server.py
   ```

   Or if you have uv in your PATH:
   ```bash
   uv run --directory /path/to/grounding-mcp python grounding_mcp/server.py
   ```

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

To use this server with an MCP client, add the following configuration:

```json
{
  "mcpServers": {
    "grounding-search": {
      "command": "/Users/cfh00896102/.local/bin/uv",
      "args": ["run", "--directory", "/path/to/grounding-mcp", "python", "grounding_mcp/server.py"],
      "cwd": "/path/to/grounding-mcp"
    }
  }
}
```

## Development

The server is built using:
- [MCP (Model Context Protocol)](https://github.com/modelcontextprotocol/python-sdk)
- [Google GenAI](https://github.com/google/generative-ai-python)
- [python-dotenv](https://github.com/theskumar/python-dotenv)

## License

This project is licensed under the MIT License.