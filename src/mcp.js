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
import { config, debug } from './utils/config.js'
import { getMcpServerConfig, validateMcpConfig } from './utils/mcp-config.js'

// Import all tool categories
import { registerHealthTools } from './mcp/healthchecks.js'
import { registerTestTools } from './mcp/tests.js'
import { registerStatusTools } from './mcp/status.js'
import { registerInteractiveTools } from './mcp/interactive.js'
import { registerManagementTools } from './mcp/management.js'
import { registerExploratoryTools } from './mcp/exploratory.js'
import { registerArtifactTools } from './mcp/artifacts.js'
import { registerDocumentationTools } from './mcp/documentation.js'
import { registerBrowserTaskTools } from './mcp/browser-tasks.js'
import { registerCommandQueueTools, startBackgroundListener } from './mcp/command-queue.js'

/**
 * Log MCP messages to file for debugging
 * @param {string} direction - 'IN' or 'OUT'
 * @param {Object} message - The message object
 */
function logMcpMessage(direction, message) {
  const logFile = path.join(process.cwd(), 'mcp-debug.log')
  const timestamp = new Date().toISOString()
  const logEntry = `[${timestamp}] ${direction}: ${JSON.stringify(message, null, 2)}\n\n`
  
  try {
    fs.appendFileSync(logFile, logEntry)
  } catch (error) {
    // Ignore logging errors to avoid breaking the server
    console.error(`Failed to log MCP message: ${error.message}`)
  }
}

/**
 * Create and configure the MCP server with all tools
 * @param {Object} options - Server configuration options
 * @returns {Object} Configured MCP server instance
 */
export function createMcpServer(options = {}) {
  const serverConfig = getMcpServerConfig(options)
  validateMcpConfig(serverConfig)
  
  // Clear previous log file
  const logFile = path.join(process.cwd(), 'mcp-debug.log')
  try {
    fs.writeFileSync(logFile, `MCP Server Debug Log - Started at ${new Date().toISOString()}\n\n`)
  } catch (error) {
    console.error(`Failed to initialize log file: ${error.message}`)
  }
  
  const server = new McpServer({
    name: serverConfig.name,
    version: serverConfig.version,
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
    logMcpMessage('IN', { type: 'request', ...request, extra })
    debug(config, `Received request: ${request.method}`)
  }

  server.onnotification = (notification, extra) => {
    logMcpMessage('IN', { type: 'notification', ...notification, extra })
    debug(config, `Received notification: ${notification.method}`)
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

  debug(config, 'Registering Exploratory tools...')
  registerExploratoryTools(server)

  debug(config, 'Registering Artifact tools...')
  registerArtifactTools(server)

  debug(config, 'Registering Documentation tools...')
  registerDocumentationTools(server)

  debug(config, 'Registering Browser Task tools...')
  registerBrowserTaskTools(server)

  debug(config, 'Registering Command Queue tools...')
  registerCommandQueueTools(server)

  debug(config, 'All MCP tools registered successfully')

  // Start background listener for agent-UI communication (fire and forget)
  startBackgroundListener().catch(err => {
    console.error('[MCP] Failed to start background listener:', err)
  })

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
    debug(config, 'Resumed stdin for Bun compatibility')
  }
  
  const transport = new StdioServerTransport()
  
  // Log transport-level messages
  const originalOnMessage = transport.onmessage
  if (originalOnMessage) {
    transport.onmessage = (message) => {
      logMcpMessage('TRANSPORT_IN', message)
      return originalOnMessage.call(transport, message)
    }
  }
  
  // Try to intercept stdin data
  const originalStdin = process.stdin
  if (originalStdin && originalStdin.on) {
    originalStdin.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString().trim())
        logMcpMessage('STDIN_RAW', message)
      } catch (e) {
        logMcpMessage('STDIN_RAW', { raw: data.toString(), parseError: e.message })
      }
    })
  }
  
  // Try to intercept stdout data
  const originalWrite = process.stdout.write
  process.stdout.write = function(chunk, encoding, callback) {
    try {
      const message = JSON.parse(chunk.toString().trim())
      logMcpMessage('STDOUT_RAW', message)
    } catch (e) {
      logMcpMessage('STDOUT_RAW', { raw: chunk.toString(), parseError: e.message })
    }
    return originalWrite.call(this, chunk, encoding, callback)
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
          debug(config, `SSE connection error: ${error.message}`)
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