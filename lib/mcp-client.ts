import { experimental_createMCPClient as createMCPClient } from 'ai';

export interface KeyValuePair {
  key: string;
  value: string;
}

export interface MCPServerConfig {
  url: string;
  type: 'sse' | 'stdio';
  command?: string;
  args?: string[];
  env?: KeyValuePair[];
  headers?: KeyValuePair[];
}

export interface MCPClientManager {
  tools: Record<string, any>;
  clients: any[];
  cleanup: () => Promise<void>;
}

// ツール引数の型変換を行うヘルパー関数
function convertToolArguments(toolName: string, args: any): any {
  if (toolName === 'brave_web_search') {
    const convertedArgs = { ...args };
    
    // 数値型に変換が必要なパラメータ
    if (convertedArgs.count !== undefined && typeof convertedArgs.count === 'string') {
      const countNum = parseInt(convertedArgs.count, 10);
      if (!isNaN(countNum)) {
        convertedArgs.count = countNum;
      }
    }
    if (convertedArgs.offset !== undefined && typeof convertedArgs.offset === 'string') {
      const offsetNum = parseInt(convertedArgs.offset, 10);
      if (!isNaN(offsetNum)) {
        convertedArgs.offset = offsetNum;
      }
    }
    
    // ブール型に変換が必要なパラメータ
    if (convertedArgs.text_decorations !== undefined && typeof convertedArgs.text_decorations === 'string') {
      convertedArgs.text_decorations = convertedArgs.text_decorations.toLowerCase() === 'true';
    }
    if (convertedArgs.spellcheck !== undefined && typeof convertedArgs.spellcheck === 'string') {
      convertedArgs.spellcheck = convertedArgs.spellcheck.toLowerCase() === 'true';
    }
    
    // 配列型に変換が必要なパラメータ
    if (convertedArgs.result_filter !== undefined && typeof convertedArgs.result_filter === 'string') {
      try {
        convertedArgs.result_filter = JSON.parse(convertedArgs.result_filter);
      } catch {
        convertedArgs.result_filter = [convertedArgs.result_filter];
      }
    }
    
    return convertedArgs;
  }
  
  return args;
}

/**
 * Initialize MCP clients for API calls
 * This uses the already running persistent SSE servers
 */
export async function initializeMCPClients(
  mcpServers: MCPServerConfig[] = [],
  abortSignal?: AbortSignal
): Promise<MCPClientManager> {
  // Initialize tools
  let tools = {};
  const mcpClients: any[] = [];

  // Process each MCP server configuration
  for (const mcpServer of mcpServers) {
    try {
      // All servers are handled as SSE
      const transport = {
        type: 'sse' as const,
        url: mcpServer.url,
        headers: mcpServer.headers?.reduce((acc, header) => {
          if (header.key) acc[header.key] = header.value || '';
          return acc;
        }, {} as Record<string, string>)
      };

      const mcpClient = await createMCPClient({ transport });
      mcpClients.push(mcpClient);

      const mcptools = await mcpClient.tools();

      console.log(`MCP tools from ${mcpServer.url}:`, Object.keys(mcptools));

      // ツールを型変換ラッパーでラップ
      const wrappedTools = Object.fromEntries(
        Object.entries(mcptools).map(([toolName, tool]) => [
          toolName,
          {
            ...tool,
            execute: async (args: any) => {
              const convertedArgs = convertToolArguments(toolName, args);
              console.log(`Executing ${toolName} with converted args:`, convertedArgs);
              return await (tool as any).execute(convertedArgs);
            }
          }
        ])
      );

      // Add wrapped MCP tools to tools object
      tools = { ...tools, ...wrappedTools };
    } catch (error) {
      console.error("Failed to initialize MCP client:", error);
      // Continue with other servers instead of failing the entire request
    }
  }

  // Register cleanup for all clients if an abort signal is provided
  if (abortSignal && mcpClients.length > 0) {
    abortSignal.addEventListener('abort', async () => {
      await cleanupMCPClients(mcpClients);
    });
  }

  return {
    tools,
    clients: mcpClients,
    cleanup: async () => await cleanupMCPClients(mcpClients)
  };
}

async function cleanupMCPClients(clients: any[]): Promise<void> {
  // Clean up the MCP clients
  for (const client of clients) {
    try {
      await client.close();
    } catch (error) {
      console.error("Error closing MCP client:", error);
    }
  }
} 