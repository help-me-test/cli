/**
 * MCP Command Handler
 * 
 * Handles the MCP (Model Context Protocol) server command for the CLI.
 * Provides both stdio and HTTP transport options.
 */

import { output } from '../utils/colors.js'
import { config, isDebugMode } from '../utils/config.js'
import { createMcpServer, startStdioServer, startHttpServer } from '../mcp.js'
import { getMcpServerInfo } from '../utils/version.js'
import { debug } from '../utils/log.js'
import { debug as configDebug } from '../utils/config.js'

/**
 * Handle MCP command execution
 * @param {string} token - API token (positional argument)
 * @param {Object} options - Command options
 * @param {boolean} options.sse - Use SSE transport instead of stdio
 * @param {number} options.port - Port for SSE transport
 * @param {boolean} options.verbose - Enable verbose logging
 */
export default async function mcpCommand(token, options) {
  try {
    const { sse = false, port = 31337, verbose = false } = options
    const transport = sse ? 'http' : 'stdio'

    // Token is already set in index.js before auth check
    // Validate that we have required configuration
    if (!config.apiToken) {
      output.error('API token is required. Provide it as an argument or set HELPMETEST_API_TOKEN environment variable.')
      output.info('Usage: helpmetest mcp HELP-your-token-here')
      process.exit(1)
    }

    // Enable debug mode by default for MCP command
    config.debug = verbose

    // Debug configuration to see what we have
    configDebug(config, `MCP Server Configuration:`)
    configDebug(config, `  API URL: ${config.apiBaseUrl}`)
    configDebug(config, `  Has Token: ${!!config.apiToken}`)
    configDebug(config, `  Token: ${config.apiToken ? config.apiToken.substring(0, 10) + '...' : 'none'}`)
    configDebug(config, `  Debug Mode: ${config.debug}`)

    configDebug(config, `Starting MCP server with ${sse ? 'SSE' : 'stdio'} transport`)

    // Create MCP server instance
    const serverInfo = getMcpServerInfo()
    const server = createMcpServer({
      name: serverInfo.name,
      version: serverInfo.version,
    })

    // Start authentication in background (don't block tool registration)
    // If auth fails, server will exit with error
    ;(async () => {
      try {
        const { detectApiAndAuth } = await import('../utils/api.js')
        await detectApiAndAuth(false, true)
        configDebug(config, 'Authentication verified in background')
      } catch (error) {
        output.error(`Authentication failed: ${error.message}`)
        output.error('MCP server cannot function without valid authentication')
        process.exit(1)
      }
    })()

    // Set up error handling
    server.onerror = (error) => {
      output.error(`MCP Server error: ${error.message}`)
      if (isDebugMode(config)) {
        debug(error.stack || error.message || error)
      }
    }

    // Start server with appropriate transport
    if (sse) {
      if (verbose) {
        output.info(`Starting MCP server with SSE transport on port ${port}...`)
      }
      await startHttpServer(server, port)
    } else {
      if (verbose) {
        output.info('Starting MCP server with stdio transport...')
      }
      await startStdioServer(server)
    }

    // Set up graceful shutdown
    const shutdown = async (signal) => {
      configDebug(config, `Received ${signal}, shutting down MCP server`)
      try {
        if (server && typeof server.close === 'function') {
          await server.close()
        }
        if (verbose) {
          output.success('MCP server shut down gracefully')
        }
        process.exit(0)
      } catch (error) {
        output.error(`Error during shutdown: ${error.message}`)
        process.exit(1)
      }
    }

    // Handle shutdown signals
    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      output.error(`Uncaught exception: ${error.message}`)
      if (isDebugMode(config)) {
        debug(error.stack || error.message || error)
      }
      shutdown('UNCAUGHT_EXCEPTION')
    })

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      output.error(`Unhandled promise rejection: ${reason}`)
      if (isDebugMode(config)) {
        debug(`Promise: ${JSON.stringify(promise, null, 2)}`)
      }
      shutdown('UNHANDLED_REJECTION')
    })

    // Keep the process alive for stdio transport
    if (sse) {
      // For SSE transport, keep the process alive
      configDebug(config, `MCP server running on http://localhost:${port}`)
      
      // Keep process alive
      setInterval(() => {
        // This keeps the process running
      }, 1000)
    } else {
      // For stdio transport, the server will handle the process lifecycle
      configDebug(config, 'MCP server running with stdio transport')
    }

  } catch (error) {
    output.error(`Failed to start MCP server: ${error.message}`)
    if (isDebugMode(config)) {
      log(error.stack || error.message || error)
    }
    process.exit(1)
  }
}