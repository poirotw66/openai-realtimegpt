/**
 * HTTP Streamable MCP Client for Email Sender MCP Server
 * Connects to Streamable HTTP MCP server (single /mcp endpoint)
 */
export class EmailMCPClient {
  private baseUrl: string;
  private isConnected: boolean = false;
  private sessionId: string | null = null;

  constructor(baseUrl: string = 'https://email-sender-mcp-jt7pjdeeoa-de.a.run.app/mcp') {
    // Ensure trailing slash for Streamable HTTP
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  }

  async connect(): Promise<void> {
    try {
      console.log('🔌 Connecting to Email MCP Server (Streamable HTTP)...');

      // Test health check first
      const healthUrl = this.baseUrl.replace('/mcp/', '/health');
      const healthResponse = await fetch(healthUrl);
      if (!healthResponse.ok) {
        throw new Error('Email MCP Server not available');
      }

      // Initialize MCP session via Streamable HTTP
      const initResponse = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: '1',
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'realtimegpt', version: '1.0.0' },
          },
        }),
      });

      if (!initResponse.ok) {
        throw new Error(`HTTP error! status: ${initResponse.status}`);
      }

      const initData = await initResponse.json();
      if (initData.error) {
        throw new Error(`MCP Error: ${initData.error.message}`);
      }

      // Send initialized notification
      await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
        }),
      });

      this.isConnected = true;
      console.log('✅ Connected to Email MCP Server');
    } catch (error) {
      console.error('❌ Failed to connect to Email MCP server:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.sessionId = null;
    console.log('🔌 Disconnected from Email MCP Server');
  }

  async listTools() {
    if (!this.isConnected) {
      throw new Error('Email MCP client not connected');
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: '2',
          method: 'tools/list',
          params: {},
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(`MCP Error: ${data.error.message}`);
      }

      return { tools: data.result?.tools || [] };
    } catch (error) {
      console.error('❌ Error listing email tools:', error);
      throw error;
    }
  }

  async callTool(name: string, arguments_: Record<string, any>) {
    if (!this.isConnected) {
      throw new Error('Email MCP client not connected');
    }

    console.log(`🔧 Calling Email MCP tool via Streamable HTTP: ${name}`, arguments_);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: '3',
          method: 'tools/call',
          params: {
            name: name,
            arguments: arguments_,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(`MCP Error: ${data.error.message}`);
      }

      // Extract content from result
      const result = data.result;
      let content = '';
      if (result?.content) {
        if (Array.isArray(result.content)) {
          content = result.content
            .map((c: any) => (c.text || c.content || JSON.stringify(c)))
            .join('\n');
        } else if (result.content.text) {
          content = result.content.text;
        }
      } else if (result?.text) {
        content = result.text;
      } else {
        content = JSON.stringify(result);
      }

      // Try to parse as JSON if possible
      try {
        const parsed = JSON.parse(content);
        console.log(`✅ Email MCP tool result:`, parsed);
        return parsed;
      } catch {
        console.log(`✅ Email MCP tool result:`, content);
        return { content: content };
      }
    } catch (error) {
      console.error(`❌ Error calling Email MCP tool ${name}:`, error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.isConnected;
  }
}

// Create a singleton instance
// Default to deployed Cloud Run URL, can be overridden via env
const emailMCPUrl =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAIL_MCP_URL
    ? import.meta.env.VITE_EMAIL_MCP_URL
    : 'https://email-sender-mcp-jt7pjdeeoa-de.a.run.app/mcp';

export const emailMCPClient = new EmailMCPClient(emailMCPUrl);
