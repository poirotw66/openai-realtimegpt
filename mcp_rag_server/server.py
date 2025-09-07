#!/usr/bin/env python3
"""
M365 RAG Agent MCP Server

This MCP server provides tools for querying an internal Microsoft 365 knowledge base
using Retrieval Augmented Generation (RAG) capabilities.
"""

import asyncio
import json
import os
import sys
from typing import Any, Sequence

import yaml
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.tools import tool
from pydantic import BaseModel, Field

# MCP imports
from mcp.server.models import InitializationOptions
from mcp.server import NotificationOptions, Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    CallToolRequest,
    CallToolResult,
    ListToolsRequest,
    ListToolsResult,
    Tool,
    TextContent,
    ImageContent,
    EmbeddedResource,
    LoggingLevel
)

# Load environment variables
load_dotenv()

# Load configuration
with open('config.yaml', 'r', encoding='utf-8') as f:
    yaml_data = yaml.safe_load(f)

SYSTEM_PROMPT = yaml_data['system_prompts']['prompt_V4']
LLM_MODEL = "gemini-2.5-flash"
EMBEDDING_MODEL = yaml_data['model_config']['EMBEDDING_MODEL']
CHROMA_DIRECTORY = yaml_data['chroma_config']['CHROMA_DIRECTORY']
CHROMA_COLLECTION_NAME = yaml_data['chroma_config']['CHROMA_COLLECTION_NAME']

# Global agent executor
agent_executor = None
chat_history = []

class PageContextArgs(BaseModel):
    source: str = Field(description="The source file name from the metadata")
    page: int = Field(description="The page number from the metadata")

def initialize_agent():
    """Initialize the RAG agent with tools"""
    global agent_executor
    
    @tool
    def internal_software_knowledge_retriever(query: str) -> str:
        """
        當你需要回答關於內部軟體使用、功能、操作流程等問題時，請使用這個工具。
        這個工具會從知識庫中搜尋並回傳最相關的資訊，包含內容和其來源(metadata)。
        """
        print(f"\n[工具執行]: internal_software_knowledge_retriever(query='{query}')", file=sys.stderr)
        
        # 建立 embedding model
        embeddings = GoogleGenerativeAIEmbeddings(model=EMBEDDING_MODEL)

        # 連接到指定的 ChromaDB 資料庫和集合
        vectorstore = Chroma(
            persist_directory=CHROMA_DIRECTORY,
            embedding_function=embeddings,
            collection_name=CHROMA_COLLECTION_NAME
        )
        retriever = vectorstore.as_retriever(search_kwargs={"k": 4})

        # 使用 retriever 取得相關文件
        docs = retriever.get_relevant_documents(query)

        # 將文件列表格式化為包含 metadata 的單一字串
        formatted_docs = []
        for i, doc in enumerate(docs):
            metadata_str = (
                f"Type: {doc.metadata.get('type', 'N/A')}, "
                f"Source: {doc.metadata.get('source', 'N/A')}, "
                f"Page: {doc.metadata.get('page', 'N/A')}, "
                f"Sheet: {doc.metadata.get('sheet', 'N/A')}, "
                f"Row: {doc.metadata.get('row', 'N/A')}, "
            )
            formatted_doc = f"\n[Document {i + 1}]\nMetadata: {metadata_str}\nContent: {doc.page_content}"
            print("查詢到的資料", metadata_str, file=sys.stderr)
            formatted_docs.append(formatted_doc)

        result = "\n".join(formatted_docs)
        return result

    @tool(args_schema=PageContextArgs)
    def get_specific_page_content(source: str, page: int) -> str:
        """
        當你需要獲取特定文件頁面的周圍上下文時，請使用這個工具。
        它會根據指定的 source 和 page，從 Chroma DB 中獲取當前頁、前一頁和後一頁的內容。
        """
        print(f"\n[工具執行]: get_specific_page_content(source='{source}', page={page})", file=sys.stderr)

        try:
            # 從 LangChain 的 vectorstore 物件中，獲取底層的原生 collection
            embeddings = GoogleGenerativeAIEmbeddings(model=EMBEDDING_MODEL)
            vectorstore = Chroma(
                persist_directory=CHROMA_DIRECTORY,
                embedding_function=embeddings,
                collection_name=CHROMA_COLLECTION_NAME
            )
            collection = vectorstore._collection

            # 定義要獲取的頁面範圍
            pages_to_fetch = [page - 1, page + 1]
            
            if not pages_to_fetch:
                return f"錯誤：提供的頁碼 '{page}' 無效。"

            # 建立 metadata 過濾條件
            where_filter = {
                "$and": [
                    {"source": {"$eq": source}},
                    {"page": {"$in": pages_to_fetch}}
                ]
            }

            # 使用原生 collection 的 .get() 方法執行查詢
            results = collection.get(where=where_filter)
            
            documents = results.get('documents', [])
            metadatas = results.get('metadatas', [])

            if not documents:
                return f"錯誤：在 Chroma DB 的 '{source}' 中找不到頁碼為 {page} 及其相鄰頁面的內容。"

            sorted_docs = sorted(zip(metadatas, documents), key=lambda item: item[0].get('page', 0))

            formatted_output = [f"[CONTEXT FOR source='{source}', page={page}]"]
            for meta, content in sorted_docs:
                source_val = meta.get('source', 'N/A')
                page_val = meta.get('page', 'N/A')
                header = f"--- [METADATA: source={source_val}, page={page_val}] ---"
                formatted_output.append(f"{header}\n{content}\n")
            
            result = "\n".join(formatted_output)
            print(f"[工具回傳]:\n{result[:150]}...", file=sys.stderr)

            return result

        except Exception as e:
            print(f"[工具錯誤]: get_specific_page_content 執行失敗 - {e}", file=sys.stderr)
            return f"錯誤：在查詢 Chroma DB 時發生問題: {e}"

    # 建立工具清單
    tools = [internal_software_knowledge_retriever, get_specific_page_content]
    
    # 建立 prompt
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="chat_history"),
        ("user", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])

    # 建立 llm agent
    llm = ChatGoogleGenerativeAI(model=LLM_MODEL, temperature=0.0)
    agent = create_tool_calling_agent(llm, tools, prompt)
    agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=False)

    return agent_executor

# Create the server instance
server = Server("m365-rag-agent")

@server.list_tools()
async def handle_list_tools() -> list:
    """List available tools."""
    # Create individual tool objects
    tool1 = Tool(
        name="ask_m365_question",
        description="Ask a question about Microsoft 365 software usage, features, and processes. This tool uses RAG to search the internal knowledge base and provide structured answers.",
        inputSchema={
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "The question about Microsoft 365 (Teams, SharePoint, OneDrive, Planner, etc.)"
                },
                "reset_chat": {
                    "type": "boolean",
                    "description": "Whether to reset chat history before asking (default: False)",
                    "default": False
                }
            },
            "required": ["question"]
        }
    )
    
    tool2 = Tool(
        name="search_knowledge_base",
        description="Search the internal knowledge base directly for specific information about Microsoft 365.",
        inputSchema={
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query for the knowledge base"
                }
            },
            "required": ["query"]
        }
    )
    
    tool3 = Tool(
        name="get_page_context",
        description="Get contextual information from specific pages of documents in the knowledge base.",
        inputSchema={
            "type": "object",
            "properties": {
                "source": {
                    "type": "string",
                    "description": "The source file name from document metadata"
                },
                "page": {
                    "type": "integer",
                    "description": "The page number to get context from"
                }
            },
            "required": ["source", "page"]
        }
    )
    
    # Create the tools list and return result
    tools_list = [tool1, tool2, tool3]
    try:
        tools_dict_list = [tool.model_dump() for tool in tools_list]
    except AttributeError:
        tools_dict_list = [tool.dict() for tool in tools_list]
    return tools_dict_list

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict | None) -> list:
    """Handle tool calls."""
    global agent_executor, chat_history
    
    if not agent_executor:
        agent_executor = initialize_agent()
    
    if name == "ask_m365_question":
        question = arguments.get("question", "")
        reset_chat = arguments.get("reset_chat", False)
        
        if reset_chat:
            chat_history = []
        
        if not question:
            raise ValueError("錯誤：請提供問題內容")
        
        # Use the agent executor to get the answer
        response = agent_executor.invoke(
            {"input": question, "chat_history": chat_history}
        )
        answer = response.get('output', 'N/A')
        
        # Update chat history
        chat_history.append(HumanMessage(content=question))
        chat_history.append(AIMessage(content=answer))
        
        return [{"type": "text", "text": answer}]
        
    elif name == "search_knowledge_base":
        query = arguments.get("query", "")
        if not query:
            raise ValueError("錯誤：請提供查詢內容")
        
        # Direct search in knowledge base
        embeddings = GoogleGenerativeAIEmbeddings(model=EMBEDDING_MODEL)
        vectorstore = Chroma(
            persist_directory=CHROMA_DIRECTORY,
            embedding_function=embeddings,
            collection_name=CHROMA_COLLECTION_NAME
        )
        retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
        docs = retriever.get_relevant_documents(query)
        
        # Format results
        formatted_docs = []
        for i, doc in enumerate(docs):
            metadata_str = (
                f"Type: {doc.metadata.get('type', 'N/A')}, "
                f"Source: {doc.metadata.get('source', 'N/A')}, "
                f"Page: {doc.metadata.get('page', 'N/A')}, "
                f"Sheet: {doc.metadata.get('sheet', 'N/A')}, "
                f"Row: {doc.metadata.get('row', 'N/A')}"
            )
            formatted_doc = f"[Document {i + 1}]\nMetadata: {metadata_str}\nContent: {doc.page_content}\n"
            formatted_docs.append(formatted_doc)
        
        result = "\n".join(formatted_docs)
        return [{"type": "text", "text": result}]
        
    elif name == "get_page_context":
        source = arguments.get("source", "")
        page = arguments.get("page", 0)
        
        if not source or not page:
            raise ValueError("錯誤：請提供來源檔案名稱和頁碼")
        
        embeddings = GoogleGenerativeAIEmbeddings(model=EMBEDDING_MODEL)
        vectorstore = Chroma(
            persist_directory=CHROMA_DIRECTORY,
            embedding_function=embeddings,
            collection_name=CHROMA_COLLECTION_NAME
        )
        collection = vectorstore._collection
        
        pages_to_fetch = [page - 1, page + 1]
        where_filter = {
            "$and": [
                {"source": {"$eq": source}},
                {"page": {"$in": pages_to_fetch}}
            ]
        }
        
        results = collection.get(where=where_filter)
        documents = results.get('documents', [])
        metadatas = results.get('metadatas', [])
        
        if not documents:
            raise ValueError(f"找不到 {source} 頁碼 {page} 的相關內容")
        
        sorted_docs = sorted(zip(metadatas, documents), key=lambda item: item[0].get('page', 0))
        
        formatted_output = [f"[CONTEXT FOR source='{source}', page={page}]"]
        for meta, content in sorted_docs:
            source_val = meta.get('source', 'N/A')
            page_val = meta.get('page', 'N/A')
            header = f"--- [METADATA: source={source_val}, page={page_val}] ---"
            formatted_output.append(f"{header}\n{content}\n")
        
        result = "\n".join(formatted_output)
        return [{"type": "text", "text": result}]
    
    else:
        raise ValueError(f"未知工具: {name}")



async def main():
    """Run the server."""
    # Initialize the agent on startup
    initialize_agent()
    
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="m365-rag-agent",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )

if __name__ == "__main__":
    asyncio.run(main())