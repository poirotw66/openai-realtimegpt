import { groundingMCPClient } from './httpGroundingClient.js';

export class GroundingMCPServer {
  private isConnected: boolean = false;

  async connect(): Promise<void> {
    try {
      await groundingMCPClient.connect();
      this.isConnected = true;
      console.log('🔌 MCP Server wrapper connected');
    } catch (error) {
      console.error('❌ Failed to connect MCP Server wrapper:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      await groundingMCPClient.disconnect();
      this.isConnected = false;
      console.log('🔌 MCP Server wrapper cleaned up');
    } catch (error) {
      console.error('❌ Error during MCP cleanup:', error);
    }
  }

  async getTools() {
    if (!this.isConnected || !groundingMCPClient.isReady()) {
      throw new Error('MCP server not connected');
    }

    try {
      const toolsResult = await groundingMCPClient.listTools();
      console.log('🔧 Available MCP tools:', toolsResult);
      
      // Transform MCP tools to Realtime API format
      const tools = toolsResult.tools?.map((tool: any) => ({
        type: 'function' as const,
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
        invoke: async (_runContext: any, input: string) => {
          console.log(`🔧 Invoking MCP tool: ${tool.name}`, input);
          
          let params = {};
          try {
            if (input && input.trim()) {
              params = JSON.parse(input);
            }
          } catch (e) {
            console.log('Using default parameters for MCP tool invoke');
          }
          
          try {
            const result = await groundingMCPClient.callTool(tool.name, params);
            return result.content || result;
          } catch (error) {
            console.error(`❌ Error calling MCP tool ${tool.name}:`, error);
            return {
              error: 'Failed to call MCP tool',
              message: String(error)
            };
          }
        },
        needsApproval: async () => false,
        strict: false
      })) || [];

      return tools;
    } catch (error) {
      console.error('❌ Failed to get MCP tools:', error);
      return [];
    }
  }

  isReady(): boolean {
    return this.isConnected && groundingMCPClient.isReady();
  }
}

// Create a singleton instance
export const groundingMCPServer = new GroundingMCPServer();
