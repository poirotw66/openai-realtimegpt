export class GroundingMCPClient {
  private baseUrl: string;
  private isConnected: boolean = false;

  constructor(baseUrl: string = 'http://localhost:3001/api/mcp') {
    this.baseUrl = baseUrl;
  }

  async connect(): Promise<void> {
    try {
      console.log('🔌 Connecting to MCP Proxy Server...');

      // 測試健康檢查
      const healthResponse = await fetch('http://localhost:3001/api/health');
      if (!healthResponse.ok) {
        throw new Error('MCP Proxy Server not available');
      }

      this.isConnected = true;
      console.log('✅ Connected to MCP Proxy Server');
    } catch (error) {
      console.error('❌ Failed to connect to MCP proxy server:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    console.log('🔌 Disconnected from MCP Proxy Server');
  }

  async listTools() {
    if (!this.isConnected) {
      throw new Error('MCP client not connected');
    }

    try {
      const response = await fetch(`${this.baseUrl}/tools`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to list tools');
      }

      return { tools: data.tools };
    } catch (error) {
      console.error('❌ Error listing tools:', error);
      throw error;
    }
  }

  async callTool(name: string, arguments_: Record<string, any>) {
    if (!this.isConnected) {
      throw new Error('MCP client not connected');
    }

    console.log(`🔧 Calling MCP tool via proxy: ${name}`, arguments_);

    try {
      const response = await fetch(`${this.baseUrl}/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name,
          arguments: arguments_
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to call tool');
      }

      console.log(`✅ MCP tool result:`, data.result);
      return data.result;
    } catch (error) {
      console.error(`❌ Error calling MCP tool ${name}:`, error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.isConnected;
  }
}

// Create a singleton instance
export const groundingMCPClient = new GroundingMCPClient();
