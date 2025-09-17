/**
 * MCP Command Handler
 * 
 * Handles the MCP (Model Context Protocol) server command for the CLI.
 * Provides both stdio and HTTP transport options.
 */

import { output } from '../utils/colors.js'
import { config, debug, isDebugMode } from '../utils/config.js'
import { createMcpServer, startStdioServer, startHttpServer } from '../mcp.js'
import { getMcpServerInfo } from '../utils/version.js'

/**
 * Handle MCP command execution
 * @param {string} token - API token (positional argument)
 * @param {Object} options - Command options
 * @param {string} options.url - API base URL
 * @param {boolean} options.sse - Use SSE transport instead of stdio
 * @param {number} options.port - Port for SSE transport
 * @param {boolean} options.verbose - Enable verbose logging
 */
export default async function mcpCommand(token, options) {
  try {
    const { url, sse = false, port = 31337, verbose = false } = options
    const transport = sse ? 'http' : 'stdio'

    // Override config with command line parameters if provided
    if (token) {
      config.apiToken = token
    }
    if (url) {
      config.apiBaseUrl = url
    }

    // Validate that we have required configuration
    if (!config.apiToken) {
      output.error('API token is required. Provide it as an argument or set HELPMETEST_API_TOKEN environment variable.')
      output.info('Usage: helpmetest mcp HELP-your-token-here')
      process.exit(1)
    }

    // Enable debug mode if verbose is requested
    if (verbose) {
      config.debug = true
    }

    // Debug configuration to see what we have
    debug(config, `MCP Server Configuration:`)
    debug(config, `  API URL: ${config.apiBaseUrl}`)
    debug(config, `  Has Token: ${!!config.apiToken}`)
    debug(config, `  Token: ${config.apiToken ? config.apiToken.substring(0, 10) + '...' : 'none'}`)
    debug(config, `  Debug Mode: ${config.debug}`)

    debug(config, `Starting MCP server with ${sse ? 'SSE' : 'stdio'} transport`)

    // Create MCP server instance
    const serverInfo = getMcpServerInfo()
    const server = createMcpServer({
      name: serverInfo.name,
      version: serverInfo.version,
    })

    // Set up error handling
    server.onerror = (error) => {
      output.error(`MCP Server error: ${error.message}`)
      if (isDebugMode(config)) {
        console.error(error)
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
      debug(config, `Received ${signal}, shutting down MCP server`)
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
        console.error(error)
      }
      shutdown('UNCAUGHT_EXCEPTION')
    })

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      output.error(`Unhandled promise rejection: ${reason}`)
      if (isDebugMode(config)) {
        console.error('Promise:', promise)
      }
      shutdown('UNHANDLED_REJECTION')
    })

    // Keep the process alive for stdio transport
    if (sse) {
      // For SSE transport, keep the process alive
      debug(config, `MCP server running on http://localhost:${port}`)
      
      // Keep process alive
      setInterval(() => {
        // This keeps the process running
      }, 1000)
    } else {
      // For stdio transport, the server will handle the process lifecycle
      debug(config, 'MCP server running with stdio transport')
    }

  } catch (error) {
    output.error(`Failed to start MCP server: ${error.message}`)
    if (isDebugMode(config)) {
      console.error(error)
    }
    process.exit(1)
  }
}