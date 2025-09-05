#!/usr/bin/env python3
"""
Grounding Search MCP Server

A Model Context Protocol server that provides Google search grounding capabilities
using Google's GenAI API with grounding support.
"""

import os
import asyncio
from typing import Any, Sequence
from dotenv import load_dotenv

from google import genai
from google.genai import types

from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.types import (
    CallToolRequest,
    CallToolResult,
    ListToolsRequest,
    Tool,
    TextContent,
    ServerCapabilities,
    ToolsCapability,
)

# Load environment variables
load_dotenv()

class GroundingSearchServer:
    def __init__(self):
        self.server = Server("grounding-search")
        self.api_key = os.getenv("GEMINI_API_KEY")
        
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        
        # Configure the GenAI client
        self.client = genai.Client(api_key=self.api_key)
        
        # Define the grounding tool
        self.grounding_tool = types.Tool(
            google_search=types.GoogleSearch()
        )
        
        # Configure generation settings
        self.config = types.GenerateContentConfig(
            tools=[self.grounding_tool]
        )
        
        self._setup_handlers()
    
    def _setup_handlers(self):
        @self.server.list_tools()
        async def handle_list_tools() -> list[Tool]:
            """List available tools."""
            return [
                Tool(
                    name="grounded_search",
                    description="Search for information using Google search with grounding and citations",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The search query to find information about"
                            },
                            "include_citations": {
                                "type": "boolean",
                                "description": "Whether to include citations in the response",
                                "default": True
                            }
                        },
                        "required": ["query"],
                    },
                )
            ]
        
        @self.server.call_tool()
        async def handle_call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
            """Handle tool calls."""
            if name == "grounded_search":
                return await self._grounded_search(arguments)
            else:
                raise ValueError(f"Unknown tool: {name}")
    
    async def _grounded_search(self, arguments: dict[str, Any]) -> list[TextContent]:
        """Perform a grounded search using Google GenAI."""
        query = arguments["query"]
        include_citations = arguments.get("include_citations", True)
        
        try:
            # Make the request to GenAI with grounding
            response = self.client.models.generate_content(
                model="gemini-2.0-flash-exp",
                contents=query,
                config=self.config,
            )
            
            if include_citations:
                # Add citations to the response
                text_with_citations = self._add_citations(response)
                return [TextContent(type="text", text=text_with_citations)]
            else:
                return [TextContent(type="text", text=response.text)]
                
        except Exception as e:
            error_msg = f"Error performing grounded search: {str(e)}"
            return [TextContent(type="text", text=error_msg)]
    
    def _add_citations(self, response) -> str:
        """Add citations to the response text."""
        text = response.text
        
        # Check if grounding metadata exists
        if not hasattr(response, 'candidates') or not response.candidates:
            return text
            
        candidate = response.candidates[0]
        if not hasattr(candidate, 'grounding_metadata') or not candidate.grounding_metadata:
            return text
            
        supports = candidate.grounding_metadata.grounding_supports or []
        chunks = candidate.grounding_metadata.grounding_chunks or []
        
        # Sort supports by end_index in descending order to avoid shifting issues when inserting
        sorted_supports = sorted(supports, key=lambda s: s.segment.end_index, reverse=True)
        
        for support in sorted_supports:
            end_index = support.segment.end_index
            if support.grounding_chunk_indices:
                # Create citation string like [1](link1), [2](link2)
                citation_links = []
                for i in support.grounding_chunk_indices:
                    if i < len(chunks):
                        uri = chunks[i].web.uri
                        citation_links.append(f"[{i + 1}]({uri})")
                
                citation_string = " " + ", ".join(citation_links)
                text = text[:end_index] + citation_string + text[end_index:]
        
        return text
    
    async def run(self):
        """Run the MCP server."""
        from mcp.server.stdio import stdio_server
        
        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                InitializationOptions(
                    server_name="grounding-search",
                    server_version="0.1.0",
                    capabilities=ServerCapabilities(
                        tools=ToolsCapability(listChanged=False)
                    ),
                )
            )

async def main():
    """Main entry point."""
    server = GroundingSearchServer()
    await server.run()

if __name__ == "__main__":
    asyncio.run(main())
