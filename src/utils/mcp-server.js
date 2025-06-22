/**
 * MCP Server Utility
 * 
 * Simple MCP (Model Context Protocol) server implementation using the official SDK.
 * Provides health monitoring tools and system metrics via MCP.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { z } from 'zod'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { output } from './colors.js'
import { config, debug } from './config.js'
import { performHttpHealthCheck } from '../commands/health.js'
// import { collectSystemMetrics } from './metrics.js'
import { getAllHealthChecks, getAllTests, runTest } from './api.js'
import { getFormattedStatusData } from './status-data.js'
import { 
  TOOL_CONFIGS,
  getMcpServerConfig,
  validateMcpConfig 
} from './mcp-config.js'

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
 * Helper function to create MCP response with consistent format
 * @param {Function} operation - Async operation to execute
 * @param {string} [errorMessage] - Custom error message prefix
 * @returns {Promise<Object>} MCP response object
 */
async function createMcpResponse(operation, errorMessage = 'Operation failed') {
  try {
    const result = await operation()
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result),
        },
      ],
    }
  } catch (error) {
    debug(config, `${errorMessage}: ${error.message}`)
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString()
          }),
        },
      ],
      isError: true,
    }
  }
}

/**
 * Create and configure MCP server with health monitoring capabilities
 * @param {Object} options - Server configuration options
 * @param {string} [options.name='helpmetest-mcp-server'] - Server name
 * @param {string} [options.version='1.0.0'] - Server version
 * @returns {Server} Configured MCP server instance
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

  // Add message logging
  server.onrequest = (request, extra) => {
    logMcpMessage('IN', { type: 'request', ...request, extra })
    debug(config, `Received request: ${request.method}`)
  }

  server.onnotification = (notification, extra) => {
    logMcpMessage('IN', { type: 'notification', ...notification, extra })
    debug(config, `Received notification: ${notification.method}`)
  }

  // Register health_check tool
  server.registerTool(
    'helpmetest_health_check',
    {
      title: 'Help Me Test: Health Check Tool',
      description: 'Perform a health check on a specified URL',
      inputSchema: {
        url: z.string().describe('URL to check'),
        timeout: z.number().optional().default(30).describe('Timeout in seconds (optional)'),
      },
    },
    async (args) => {
      debug(config, `Health check tool called with args: ${JSON.stringify(args)}`)
      return await handleHealthCheck(args)
    }
  )

  // Register system_status tool
  // // server.registerTool(
  // //   'system_status',
  // //   {
  / ///     title: 'System Status Tool',
  // //     description: 'Get current system status and metrics using helpmetest metrics collection',
  // //     inputSchema: {},
  // //   },
  / ///   async (args) => {
  // //     debug(config, `System status tool called with args: ${JSON.stringify(args)}`)
  // //     return await handleSystemStatus(args)
  // //  //  }
  // )

  // Register health_checks_status tool
  server.registerTool(
    'helpmetest_health_checks_status',
    {
      title: 'Help Me Test: Health Checks Status Tool',
      description: 'Get status of all health checks in the helpmetest system',
      inputSchema: {},
    },
    async (args) => {
      debug(config, `Health checks status tool called with args: ${JSON.stringify(args)}`)
      return await handleHealthChecksStatus(args)
    }
  )

  // Register status tool (comprehensive status including tests and healthchecks)
  server.registerTool(
    'helpmetest_status',
    {
      title: 'Help Me Test: Complete Status Tool',
      description: 'Get comprehensive status of all tests and health checks in the helpmetest system',
      inputSchema: {
        verbose: z.boolean().optional().default(false).describe('Enable verbose output with debug information'),
      },
    },
    async (args) => {
      debug(config, `Status tool called with args: ${JSON.stringify(args)}`)
      return await handleStatus(args)
    }
  )

  // Register run_test tool
  server.registerTool(
    'helpmetest_run_test',
    {
      title: 'Help Me Test: Run Test Tool',
      description: 'Run a test by name, tag, or ID',
      inputSchema: {
        identifier: z.string().describe('Test name, tag (tag:tagname), or ID to run'),
      },
    },
    async (args) => {
      debug(config, `Run test tool called with args: ${JSON.stringify(args)}`)
      return await handleRunTest(args)
    }
  )

  // Register list_tests tool
  server.registerTool(
    'helpmetest_list_tests',
    {
      title: 'Help Me Test: List Tests Tool',
      description: 'List all available tests with their metadata',
      inputSchema: {},
    },
    async (args) => {
      debug(config, `List tests tool called with args: ${JSON.stringify(args)}`)
      return await handleListTests(args)
    }
  )

  debug(config, 'MCP server tools registered successfully')

  return server
}

/**
 * Handle health check tool call
 * @param {Object} args - Tool arguments
 * @param {string} args.url - URL to check
 * @param {number} [args.timeout=30] - Timeout in seconds
 * @returns {Object} Health check result
 */
async function handleHealthCheck(args) {
  const { url, timeout = TOOL_CONFIGS.health_check.defaultTimeout } = args

  debug(config, `Performing health check on ${url}`)
  
  try {
    // Use the same health check logic as the health command
    const startTime = Date.now()
    const result = await performHttpHealthCheck(url, 'GET', startTime)
    
    const healthCheckResult = {
      url,
      status: result.status || 'N/A',
      statusText: result.statusText || '',
      healthy: result.success,
      responseTime: result.elapsedTime,
      timestamp: new Date().toISOString(),
      ...(result.error && { error: result.error })
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(healthCheckResult),
        },
      ],
      isError: !result.success,
    }
  } catch (error) {
    const errorResult = {
      url,
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorResult),
        },
      ],
      isError: true,
    }
  }
}

/**
 * Handle system status tool call
 * @param {Object} args - Tool arguments (unused)
 * @returns {Object} System status result
 */
// async function handleSystemStatus(args) {
//   return createMcpResponse(
//     async () => {
//       debug(config, 'Collecting system metrics for MCP client')
//       return await collectSystemMetrics()
//     },
//     'Error collecting system metrics'
//   )
// }

/**
 * Handle health checks status tool call
 * @param {Object} args - Tool arguments (unused)
 * @returns {Object} Health checks status result
 */
async function handleHealthChecksStatus(args) {
  debug(config, 'Getting health checks status for MCP client')
  debug(config, `API Config: ${JSON.stringify({
    baseURL: config.apiBaseUrl,
    hasToken: !!config.apiToken,
    tokenPrefix: config.apiToken ? config.apiToken.substring(0, 10) + '...' : 'none'
  })}`)
  
  try {
    const healthChecks = await getAllHealthChecks()
    debug(config, `Retrieved ${healthChecks?.length || 0} health checks`)
    
    if (!healthChecks?.length) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ 
              total: 0, 
              checks: [],
              message: 'No health checks found - this could mean the API returned an empty list or there are genuinely no health checks configured',
              debug: {
                apiUrl: config.apiBaseUrl,
                hasToken: !!config.apiToken
              }
            }),
          },
        ],
      }
    }

    // Format checks for JSON output (similar to status command)
    const formattedChecks = healthChecks.map(check => ({
      name: check.name,
      status: check.status?.toLowerCase() || 'unknown',
      lastHeartbeat: check.lastHeartbeat,
      gracePeriod: check.gracePeriod,
      data: check.data || {},
    }))

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            total: healthChecks.length,
            checks: formattedChecks,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    }
  } catch (error) {
    debug(config, `Error getting health checks: ${error.message}`)
    
    // Return detailed error information instead of swallowing it
    const errorResponse = {
      error: true,
      message: error.message,
      type: error.name || 'Error',
      timestamp: new Date().toISOString(),
      debug: {
        apiUrl: config.apiBaseUrl,
        hasToken: !!config.apiToken,
        status: error.status || null,
        endpoint: error.request?.endpoint || '/api/healthchecks'
      }
    }
    
    // Add specific error details if available
    if (error.status === 401) {
      errorResponse.suggestion = 'Check your HELPMETEST_API_TOKEN environment variable'
    } else if (error.status === 403) {
      errorResponse.suggestion = 'Your API token may not have permission for this operation'
    } else if (error.status === 404) {
      errorResponse.suggestion = 'The API endpoint was not found - check your HELPMETEST_API_URL'
    } else if (error.status >= 500) {
      errorResponse.suggestion = 'Server error - please try again later'
    } else if (!error.status) {
      errorResponse.suggestion = 'Check your internet connection and API URL configuration'
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorResponse),
        },
      ],
      isError: true,
    }
  }
}

/**
 * Handle comprehensive status tool call
 * @param {Object} args - Tool arguments
 * @param {boolean} [args.verbose=false] - Enable verbose output
 * @returns {Object} Complete status result
 */
async function handleStatus(args) {
  const { verbose = false } = args
  
  debug(config, 'Getting comprehensive status for MCP client')
  debug(config, `API Config: ${JSON.stringify({
    baseURL: config.apiBaseUrl,
    hasToken: !!config.apiToken,
    tokenPrefix: config.apiToken ? config.apiToken.substring(0, 10) + '...' : 'none'
  })}`)
  
  try {
    const statusData = await getFormattedStatusData({ verbose })
    debug(config, `Retrieved status data: ${statusData.total} total items (${statusData.tests.length} tests, ${statusData.healthchecks.length} healthchecks)`)
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(statusData),
        },
      ],
    }
  } catch (error) {
    debug(config, `Error getting comprehensive status: ${error.message}`)
    
    // Return detailed error information
    const errorResponse = {
      error: true,
      message: error.message,
      type: error.name || 'Error',
      timestamp: new Date().toISOString(),
      debug: {
        apiUrl: config.apiBaseUrl,
        hasToken: !!config.apiToken,
        status: error.status || null,
        verbose
      }
    }
    
    // Add specific error details if available
    if (error.status === 401) {
      errorResponse.suggestion = 'Check your HELPMETEST_API_TOKEN environment variable'
    } else if (error.status === 403) {
      errorResponse.suggestion = 'Your API token may not have permission for this operation'
    } else if (error.status === 404) {
      errorResponse.suggestion = 'The API endpoint was not found - check your HELPMETEST_API_URL'
    } else if (error.status >= 500) {
      errorResponse.suggestion = 'Server error - please try again later'
    } else if (!error.status) {
      errorResponse.suggestion = 'Check your internet connection and API URL configuration'
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorResponse),
        },
      ],
      isError: true,
    }
  }
}

/**
 * Handle run test tool call
 * @param {Object} args - Tool arguments
 * @param {string} args.identifier - Test identifier (name, tag, or ID)
 * @returns {Object} Test execution result
 */
async function handleRunTest(args) {
  const { identifier } = args
  
  debug(config, `Running test with identifier: ${identifier}`)
  
  try {
    // Collect all events from the test run
    const events = []
    
    await runTest(identifier, (event) => {
      if (event) {
        events.push(event)
      }
    })
    
    // Process events to extract meaningful results
    const testResults = events.filter(e => e.type === 'end_test' && e.attrs?.status)
    const keywordEvents = events.filter(e => e.type === 'keyword')
    
    // Build response with test execution data
    const response = {
      identifier,
      timestamp: new Date().toISOString(),
      totalEvents: events.length,
      testResults: testResults.map(result => ({
        testId: result.attrs?.name || 'unknown',
        status: result.attrs?.status || 'UNKNOWN',
        duration: result.attrs?.elapsed_time ? `${result.attrs.elapsed_time}s` : 'N/A',
        message: result.attrs?.doc || ''
      })),
      keywords: keywordEvents.map(kw => ({
        keyword: kw.keyword,
        status: kw.status,
        duration: kw.elapsed_time || kw.elapsedtime || null
      })),
      allEvents: events // Include all raw events for debugging
    }
    
    // Determine overall success
    const hasFailures = testResults.some(r => r.status === 'FAIL')
    response.success = !hasFailures && testResults.length > 0
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response),
        },
      ],
      isError: hasFailures,
    }
  } catch (error) {
    debug(config, `Error running test: ${error.message}`)
    
    const errorResponse = {
      error: true,
      identifier,
      message: error.message,
      type: error.name || 'Error',
      timestamp: new Date().toISOString(),
      debug: {
        apiUrl: config.apiBaseUrl,
        hasToken: !!config.apiToken,
        status: error.status || null
      }
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorResponse),
        },
      ],
      isError: true,
    }
  }
}

/**
 * Handle list tests tool call
 * @param {Object} args - Tool arguments (unused)
 * @returns {Object} List of available tests
 */
async function handleListTests(args) {
  debug(config, 'Getting list of tests for MCP client')
  
  try {
    const tests = await getAllTests()
    debug(config, `Retrieved ${tests?.length || 0} tests`)
    
    if (!tests?.length) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ 
              total: 0, 
              tests: [],
              message: 'No tests found',
              timestamp: new Date().toISOString()
            }),
          },
        ],
      }
    }

    // Format tests with verbose details (always verbose as requested)
    const formattedTests = tests.map(test => ({
      id: test.id,
      name: test.name || test.id,
      description: test.doc || test.description || '',
      tags: test.tags || [],
    }))

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            total: tests.length,
            tests: formattedTests,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    }
  } catch (error) {
    debug(config, `Error getting tests list: ${error.message}`)
    
    const errorResponse = {
      error: true,
      message: error.message,
      type: error.name || 'Error',
      timestamp: new Date().toISOString(),
      debug: {
        apiUrl: config.apiBaseUrl,
        hasToken: !!config.apiToken,
        status: error.status || null
      }
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorResponse),
        },
      ],
      isError: true,
    }
  }
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

/**
 * Utility object for convenience
 */
export const mcpUtils = {
  createServer: createMcpServer,
  startStdio: startStdioServer,
  startHttp: startHttpServer,
}