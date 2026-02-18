/**
 * Modular MCP Server
 * 
 * Refactored MCP server implementation that organizes tools into logical categories.
 * Each category is in its own file with its own set of tools and handlers.
 */

// Load environment variables first
import 'dotenv/config'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { output } from './utils/colors.js'
import { config } from './utils/config.js'
import { getMcpServerConfig, validateMcpConfig } from './utils/mcp-config.js'
import { debug } from './utils/log.js'

// Import all tool categories
import { registerHealthTools } from './mcp/healthchecks.js'
import { registerTestTools } from './mcp/tests.js'
import { registerStatusTools } from './mcp/status.js'
import { registerInteractiveTools } from './mcp/interactive.js'
import { registerManagementTools } from './mcp/management.js'
import { registerArtifactTools } from './mcp/artifacts.js'
import { registerDocumentationTools } from './mcp/documentation.js'
import { registerCommandQueueTools } from './mcp/command-queue.js'
import { registerProxyTools } from './mcp/proxy.js'
import { registerInstructionTools } from './mcp/instructions.js'

/**
 * Create and configure the MCP server with all tools
 * @param {Object} options - Server configuration options
 * @returns {Object} Configured MCP server instance
 */
export function createMcpServer(options = {}) {
  const serverConfig = getMcpServerConfig(options)
  validateMcpConfig(serverConfig)

  debug(`MCP Server Debug Log - Started at ${new Date().toISOString()}`)

  const server = new McpServer({
    name: serverConfig.name,
    version: serverConfig.version,
  }, {
    instructions: `# HelpMeTest MCP Server

## 🚨 AUTHENTICATION - READ FIRST

Before doing ANY authentication/login work:

1. **Call how_to({ type: "authentication_state_management" })** - shows your available saved states and how to use them
2. **If state exists** (e.g., "Admin", "User") → use "As <StateName>" keyword to skip login
3. **If state doesn't exist** → create auth test with "Save As <StateName>"

**Example - using existing state:**
\`\`\`robot
As  Admin
Go To  https://app.example.com/dashboard
# Already authenticated!
\`\`\`

**DO NOT re-authenticate if a saved state exists. Use "As <StateName>" instead.**

## Quick Start

1. Call \`how_to({ type: "getting_started" })\` for all available instructions
2. Call \`how_to({ type: "authentication_state_management" })\` to see saved states
3. Call \`helpmetest_status\` to see current tests and health checks`
  })

  /*
   * 🚨 CRITICAL AI INSTRUCTION PATTERN:
   * All tool descriptions include explicit instructions for AI to:
   * 1. ALWAYS explain what they're doing BEFORE calling tools
   * 2. ALWAYS describe results and next steps AFTER tool execution
   * 3. NEVER just say "Done" - be descriptive about actions and outcomes
   * 4. BE HONEST about failures - don't celebrate when things fail
   * 5. ANALYZE actual response data, don't assume success
   * 6. FOLLOW the mandatory interactive testing workflow
   * 7. DO NOT create/modify tests without interactive verification first
   * 8. STOP and debug when steps fail, don't continue blindly
   *
   * This prevents:
   * - Cryptic "Done" messages
   * - False celebrations of failures
   * - Skipping mandatory interactive testing
   * - Creating broken tests
   * - Ignoring actual error messages
   */

  // Add message logging
  server.onrequest = (request, extra) => {
    debug(`INREQUEST: ${JSON.stringify({ type: 'request', ...request, extra }, null, 2)}`)
    debug(`Received request: ${request.method}`)
  }

  server.onnotification = (notification, extra) => {
    debug(`INNOTIFICATION: ${JSON.stringify({ type: 'notification', ...notification, extra }, null, 2)}`)
    debug(`Received notification: ${notification.method}`)
  }

  // Register all tool categories
  debug(config, 'Registering Health tools...')
  registerHealthTools(server)

  debug(config, 'Registering Test tools...')
  registerTestTools(server)

  debug(config, 'Registering Status tools...')
  registerStatusTools(server)

  debug(config, 'Registering Interactive tools...')
  registerInteractiveTools(server)

  debug(config, 'Registering Management tools...')
  registerManagementTools(server)

  debug(config, 'Registering Artifact tools...')
  registerArtifactTools(server)

  debug(config, 'Registering Documentation tools...')
  registerDocumentationTools(server)

  debug(config, 'Registering Command Queue tools...')
  registerCommandQueueTools(server)

  debug(config, 'Registering Proxy tools...')
  registerProxyTools(server)

  debug(config, 'Registering Instruction tools...')
  registerInstructionTools(server)

  debug(config, 'All MCP tools registered successfully')

  // Background listener will be started lazily when first needed
  // (when get_user_messages or send_to_ui is called)

  return server
}

/**
 * Start MCP server with stdio transport
 * @param {Server} server - MCP server instance
 * @returns {Promise<void>}
 */
export async function startStdioServer(server) {
  // Fix for Bun compiled binaries - resume stdin to ensure it's readable
  // This is needed because Bun's compiled binaries sometimes don't automatically
  // start reading from stdin, causing the MCP server to hang
  if (process.stdin && typeof process.stdin.resume === 'function') {
    process.stdin.resume()
    debug('Resumed stdin for Bun compatibility')
  }

  const transport = new StdioServerTransport()

  // Log transport-level messages (only if debug mode enabled)
  if (config.debug) {
    const originalOnMessage = transport.onmessage
    if (originalOnMessage) {
      transport.onmessage = (message) => {
        debug(`TRANSPORT_IN: ${JSON.stringify(message, null, 2)}`)
        return originalOnMessage.call(transport, message)
      }
    }

    // Try to intercept stdin data
    const originalStdin = process.stdin
    if (originalStdin && originalStdin.on) {
      originalStdin.on('data', (data) => {
        try {
          const message = JSON.parse(data.toString().trim())
          debug(`STDIN_RAW: ${JSON.stringify(message, null, 2)}`)
        } catch (e) {
          debug(`STDIN_RAW: ${data.toString()} (parseError: ${e.message})`)
        }
      })
    }

    // Try to intercept stdout data
    const originalWrite = process.stdout.write
    process.stdout.write = function(chunk, encoding, callback) {
      try {
        const message = JSON.parse(chunk.toString().trim())
        debug(`STDOUT_RAW: ${JSON.stringify(message, null, 2)}`)
      } catch (e) {
        debug(`STDOUT_RAW: ${chunk.toString()} (parseError: ${e.message})`)
      }
      return originalWrite.call(this, chunk, encoding, callback)
    }
  }

  await server.connect(transport)
  debug(config, 'MCP server started with stdio transport')
}

/**
 * Start MCP server with HTTP transport
 * @param {Server} server - MCP server instance
 * @param {number} [port=31337] - Port number
 * @returns {Promise<void>}
 */
export async function startHttpServer(server, port = 31337) {
  return new Promise((resolve, reject) => {
    // Create HTTP server
    const httpServer = http.createServer((req, res) => {
      if (req.url === '/sse' && req.method === 'GET') {
        // Handle SSE connection
        const transport = new SSEServerTransport(req, res)
        server.connect(transport).catch(error => {
          debug(`SSE connection error: ${error.message}`)
        })
      } else if (req.url === '/health' && req.method === 'GET') {
        // Simple health check endpoint
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }))
      } else {
        // 404 for other routes
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not Found')
      }
    })

    httpServer.on('error', (error) => {
      reject(error)
    })

    httpServer.listen(port, () => {
      output.success(`MCP server started on http://localhost:${port}`)
      output.info(`SSE endpoint: http://localhost:${port}/sse`)
      output.info(`Health check: http://localhost:${port}/health`)
      resolve()
    })
  })
}

// Export the same interface as the original mcp-server.js
export default {
  createMcpServer,
  startStdio: startStdioServer,
  startHttp: startHttpServer,
}