#!/usr/bin/env node

/**
 * Minimal MCP server test to isolate the keyValidator._parse error
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { getVersion } from './src/utils/version.js'

async function main() {
  const server = new McpServer({
    name: 'test-mcp-server',
    version: getVersion(),
  })

  // Register a very simple tool using the correct MCP SDK format
  server.registerTool(
    'simple_test',
    {
      title: 'Simple Test Tool',
      description: 'A simple test tool',
      inputSchema: {},
    },
    async (args) => {
      console.error('Simple test tool called with:', JSON.stringify(args))
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ 
              message: 'Hello from simple test tool', 
              input: args,
              timestamp: new Date().toISOString() 
            }),
          },
        ],
      }
    }
  )

  console.error('Starting minimal MCP server...')
  
  const transport = new StdioServerTransport()
  await server.connect(transport)
  
  console.error('Minimal MCP server started')
}

main().catch(error => {
  console.error('Error starting minimal MCP server:', error)
  process.exit(1)
})