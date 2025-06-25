/**
 * MCP Server Utility
 * 
 * Simple MCP (Model Context Protocol) server implementation using the official SDK.
 * Provides health monitoring tools and system metrics via MCP.
 */

// Load environment variables from .env file first
import 'dotenv/config'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { z } from 'zod'
import http from 'http'
import fs from 'fs'
import path from 'path'
import open from 'open'
import { output } from './colors.js'
import { config, debug } from './config.js'
import { performHttpHealthCheck } from '../commands/health.js'
// import { collectSystemMetrics } from './metrics.js'
import { getAllHealthChecks, getAllTests, runTest, createTest, deleteTest, undoUpdate, apiGet } from './api.js'
import { getFormattedStatusData } from './status-data.js'
import { libraries, keywords } from '../keywords.js'
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
      description: 'Get comprehensive status of all tests and health checks in the helpmetest system. When verbose=true, includes full test content and additional healthcheck data.',
      inputSchema: {
        verbose: z.boolean().optional().default(false).describe('Enable verbose output with test content, descriptions, and additional debug information'),
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

  // Register status_test tool (shows only tests)
  server.registerTool(
    'helpmetest_status_test',
    {
      title: 'Help Me Test: Test Status Tool',
      description: 'Get status of all tests in the helpmetest system. When verbose=true, includes full test content and descriptions.',
      inputSchema: {
        verbose: z.boolean().optional().default(false).describe('Enable verbose output with full test content, descriptions, and execution details'),
      },
    },
    async (args) => {
      debug(config, `Test status tool called with args: ${JSON.stringify(args)}`)
      return await handleTestStatus(args)
    }
  )

  // Register status_health tool (shows only healthchecks)
  server.registerTool(
    'helpmetest_status_health',
    {
      title: 'Help Me Test: Health Status Tool',
      description: 'Get status of all health checks in the helpmetest system. When verbose=true, includes additional healthcheck metadata and heartbeat data.',
      inputSchema: {
        verbose: z.boolean().optional().default(false).describe('Enable verbose output with additional healthcheck metadata, heartbeat data, and debug information'),
      },
    },
    async (args) => {
      debug(config, `Health status tool called with args: ${JSON.stringify(args)}`)
      return await handleHealthStatus(args)
    }
  )

  // Register create_test tool
  server.registerTool(
    'helpmetest_create_test',
    {
      title: 'Help Me Test: Create Test Tool',
      description: 'Create a new test with specified parameters. After creation, the test will be automatically run and optionally opened in browser. Test content should contain only Robot Framework keywords (no test case structure needed - browser is already launched).',
      inputSchema: {
        id: z.string().optional().describe('Test ID (optional - will auto-generate if not provided)'),
        name: z.string().describe('Test name (required)'),
        description: z.string().optional().describe('Test description (optional)'),
        tags: z.array(z.string()).optional().describe('Test tags as array of strings (optional)'),
        testData: z.string().optional().describe('Robot Framework keywords only (no test case structure needed - just the keywords to execute)'),
      },
    },
    async (args) => {
      debug(config, `Create test tool called with args: ${JSON.stringify(args)}`)
      return await handleCreateTest(args)
    }
  )

  // Register delete_test tool
  server.registerTool(
    'helpmetest_delete_test',
    {
      title: 'Help Me Test: Delete Test Tool',
      description: 'Delete a test by ID, name, or tag. This operation can be undone using the undo_update tool if the update is revertable.',
      inputSchema: {
        identifier: z.string().describe('Test ID, name, or tag (with tag: prefix) to delete'),
      },
    },
    async (args) => {
      debug(config, `Delete test tool called with args: ${JSON.stringify(args)}`)
      return await handleDeleteTest(args)
    }
  )

  // Register undo_update tool
  server.registerTool(
    'helpmetest_undo_update',
    {
      title: 'Help Me Test: Undo Update Tool',
      description: 'Undo a previous update by update ID. Can revert various operations including test deletion, modification, etc. if the update is revertable.',
      inputSchema: {
        updateId: z.string().describe('ID of the update to undo'),
      },
    },
    async (args) => {
      debug(config, `Undo update tool called with args: ${JSON.stringify(args)}`)
      return await handleUndoUpdate(args)
    }
  )

  // Register modify_test tool
  server.registerTool(
    'helpmetest_modify_test',
    {
      title: 'Help Me Test: Modify Test Tool',
      description: 'Modify an existing test by providing its ID and updated parameters. The test will be automatically run after modification and optionally opened in browser. Test content should contain only Robot Framework keywords (no test case structure needed - browser is already launched).',
      inputSchema: {
        id: z.string().describe('Test ID (required - ID of the existing test to modify)'),
        name: z.string().optional().describe('Test name (optional - if not provided, keeps existing name)'),
        description: z.string().optional().describe('Test description (optional - if not provided, keeps existing description)'),
        tags: z.array(z.string()).optional().describe('Test tags as array of strings (optional - if not provided, keeps existing tags)'),
        testData: z.string().optional().describe('Robot Framework keywords only (optional - if not provided, keeps existing test data)'),
      },
    },
    async (args) => {
      debug(config, `Modify test tool called with args: ${JSON.stringify(args)}`)
      return await handleModifyTest(args)
    }
  )

  // Register keywords search tool
  server.registerTool(
    'helpmetest_keywords',
    {
      title: 'Help Me Test: Keywords Search Tool',
      description: 'Search and get documentation for available Robot Framework keywords and libraries',
      inputSchema: {
        search: z.string().optional().describe('Search term to filter keywords/libraries (optional - if not provided, returns all)'),
        type: z.enum(['keywords', 'libraries', 'all']).optional().default('all').describe('Type of documentation to search: keywords, libraries, or all'),
      },
    },
    async (args) => {
      debug(config, `Keywords search tool called with args: ${JSON.stringify(args)}`)
      return await handleKeywordsSearch(args)
    }
  )

  // Register prompts
  server.registerPrompt(
    'helpmetest_create_test',
    {
      name: 'helpmetest_create_test',
      description: 'Guide for creating comprehensive Robot Framework tests using HelpMeTest platform',
      arguments: [
        {
          name: 'test_type',
          description: 'Type of test to create (ui, api, database, integration)',
          required: false
        },
        {
          name: 'target_system',
          description: 'Target system or application to test',
          required: false
        }
      ]
    },
    async (args) => {
      const { test_type = '', target_system = '' } = args
      
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: generateTestCreationPrompt(test_type, target_system)
            }
          }
        ]
      }
    }
  )

  server.registerPrompt(
    'helpmetest_explore_keywords',
    {
      name: 'helpmetest_explore_keywords',
      description: 'Guide for exploring and understanding available Robot Framework keywords and libraries',
      arguments: [
        {
          name: 'search_term',
          description: 'Specific functionality or library to explore',
          required: false
        }
      ]
    },
    async (args) => {
      const { search_term = '' } = args
      
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: generateKeywordExplorationPrompt(search_term)
            }
          }
        ]
      }
    }
  )

  server.registerPrompt(
    'helpmetest_modify_test',
    {
      name: 'helpmetest_modify_test',
      description: 'Guide for modifying existing Robot Framework tests using HelpMeTest platform',
      arguments: [
        {
          name: 'test_id',
          description: 'ID of the test to modify',
          required: false
        },
        {
          name: 'modification_type',
          description: 'Type of modification (update_steps, change_name, add_tags, etc.)',
          required: false
        }
      ]
    },
    async (args) => {
      const { test_id = '', modification_type = '' } = args
      
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: generateTestModificationPrompt(test_id, modification_type)
            }
          }
        ]
      }
    }
  )

  debug(config, 'MCP server tools and prompts registered successfully')

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
 * Handle test status tool call (shows only tests)
 * @param {Object} args - Tool arguments
 * @param {boolean} args.verbose - Enable verbose output with test content
 * @returns {Object} Test status result
 */
async function handleTestStatus(args) {
  const { verbose = false } = args
  
  debug(config, 'Getting test status for MCP client')
  
  try {
    const statusData = await getFormattedStatusData({ verbose })
    
    // Filter to only include tests
    const filteredData = {
      company: statusData.company,
      total: statusData.tests.length,
      tests: statusData.tests,
      timestamp: statusData.timestamp
    }
    
    debug(config, `Retrieved test status data: ${filteredData.total} tests`)
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(filteredData),
        },
      ],
    }
  } catch (error) {
    debug(config, `Error getting test status: ${error.message}`)
    
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
 * Handle health status tool call (shows only healthchecks)
 * @param {Object} args - Tool arguments
 * @param {boolean} args.verbose - Enable verbose output with additional healthcheck data
 * @returns {Object} Health status result
 */
async function handleHealthStatus(args) {
  const { verbose = false } = args
  
  debug(config, 'Getting health status for MCP client')
  
  try {
    const statusData = await getFormattedStatusData({ verbose })
    
    // Filter to only include healthchecks
    const filteredData = {
      company: statusData.company,
      total: statusData.healthchecks.length,
      healthchecks: statusData.healthchecks,
      timestamp: statusData.timestamp
    }
    
    debug(config, `Retrieved health status data: ${filteredData.total} healthchecks`)
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(filteredData),
        },
      ],
    }
  } catch (error) {
    debug(config, `Error getting health status: ${error.message}`)
    
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
 * Handle create test tool call
 * @param {Object} args - Tool arguments
 * @param {string} args.name - Test name
 * @param {string} [args.description] - Test description
 * @param {Array<string>} [args.tags] - Test tags
 * @param {Object} [args.testData] - Additional test data
 * @returns {Object} Test creation result
 */
async function handleCreateTest(args) {
  const { id = 'new', name, description = '', tags = [], testData = '' } = args
  
  debug(config, `Creating test with name: ${name}`)
  
  try {
    // Process testData to ensure it contains only keywords (no test case structure)
    const processedTestData = processTestDataForKeywordsOnly(testData)
    
    const testPayload = {
      id, // Use provided ID or 'new' to auto-generate
      name,
      description,
      tags,
      content: processedTestData // Robot Framework code goes in content field
    }
    
    const createdTest = await createTest(testPayload)
    debug(config, `Test created successfully: ${createdTest.id}`)
    
    // Check if the API call failed (returns error object instead of test data)
    if (createdTest && createdTest.status === 'error') {
      throw new Error(createdTest.error || 'API call failed')
    }
    
    // Construct the test URL for browser opening
    const testUrl = `https://helpmetest.slava.helpmetest.com/test/${createdTest.id}`
    
    // Run the test immediately after creation
    let testRunResult = null
    try {
      debug(config, `Running test immediately: ${createdTest.id}`)
      const events = []
      await runTest(createdTest.id, (event) => {
        if (event) {
          events.push(event)
        }
      })
      
      // Process events to extract meaningful results
      const testResults = events.filter(e => e.type === 'end_test' && e.attrs?.status)
      const keywordEvents = events.filter(e => e.type === 'keyword')
      
      testRunResult = {
        status: testResults.length > 0 ? testResults[0].attrs.status : 'UNKNOWN',
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
        }))
      }
      
      debug(config, `Test run completed with status: ${testRunResult.status}`)
    } catch (runError) {
      debug(config, `Error running test: ${runError.message}`)
      testRunResult = {
        status: 'ERROR',
        error: runError.message
      }
    }
    
    const response = {
      success: true,
      id: createdTest.id,
      name: createdTest.name,
      description: createdTest.description,
      tags: createdTest.tags,
      testData: createdTest.content || processedTestData,
      testUrl: testUrl,
      testRunResult: testRunResult,
      message: `Test "${name}" created successfully with ID: ${createdTest.id}`,
      timestamp: new Date().toISOString(),
      actions: {
        openInBrowser: {
          question: "Would you like to open this test in your browser?",
          url: testUrl,
          action: "open_browser"
        }
      }
    }
    
    // Ask user if they want to open the test in browser
    // Note: In a real MCP implementation, this would be handled by the client
    // For now, we'll include the URL and action in the response
    try {
      // Attempt to open browser automatically (this might not work in all environments)
      debug(config, `Opening test in browser: ${testUrl}`)
      await open(testUrl)
      response.browserOpened = true
    } catch (openError) {
      debug(config, `Could not automatically open browser: ${openError.message}`)
      response.browserOpened = false
      response.browserError = openError.message
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response),
        },
      ],
      isError: false,
    }
  } catch (error) {
    debug(config, `Error creating test: ${error.message}`)
    
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
 * Handle modify test tool call
 * @param {Object} args - Tool arguments
 * @param {string} args.id - Test ID (required)
 * @param {string} [args.name] - Test name (optional)
 * @param {string} [args.description] - Test description (optional)
 * @param {Array<string>} [args.tags] - Test tags (optional)
 * @param {string} [args.testData] - Test data (optional)
 * @returns {Object} Test modification result
 */
async function handleModifyTest(args) {
  const { id, name, description, tags, testData } = args
  
  if (!id || id === 'new') {
    throw new Error('Test ID is required for modification. Use helpmetest_create_test to create a new test.')
  }
  
  debug(config, `Modifying test with ID: ${id}`)
  
  try {
    // First, get the existing test to preserve fields that aren't being updated
    const existingTests = await getAllTests()
    const existingTest = existingTests.find(test => test.id === id)
    
    if (!existingTest) {
      throw new Error(`Test with ID "${id}" not found. Available test IDs: ${existingTests.map(t => t.id).join(', ')}`)
    }
    
    debug(config, `Found existing test: ${existingTest.name}`)
    
    // Process testData if provided
    let processedTestData = existingTest.content || existingTest.testData || ''
    if (testData !== undefined) {
      processedTestData = processTestDataForKeywordsOnly(testData)
    }
    
    // Build the update payload, preserving existing values for fields not provided
    const testPayload = {
      id: id, // Use the provided ID for modification
      name: name !== undefined ? name : existingTest.name,
      description: description !== undefined ? description : (existingTest.description || ''),
      tags: tags !== undefined ? tags : (existingTest.tags || []),
      content: processedTestData // Robot Framework code goes in content field
    }
    
    debug(config, `Updating test with payload: ${JSON.stringify(testPayload, null, 2)}`)
    
    const updatedTest = await createTest(testPayload) // Same API endpoint handles both create and update
    debug(config, `Test updated successfully: ${updatedTest.id}`)
    
    // Check if the API call failed (returns error object instead of test data)
    if (updatedTest && updatedTest.status === 'error') {
      throw new Error(updatedTest.error || 'API call failed')
    }
    
    // Construct the test URL for browser opening
    const testUrl = `https://helpmetest.slava.helpmetest.com/test/${updatedTest.id}`
    
    // Run the test immediately after modification
    let testRunResult = null
    try {
      debug(config, `Running modified test immediately: ${updatedTest.id}`)
      const events = []
      await runTest(updatedTest.id, (event) => {
        if (event) {
          events.push(event)
        }
      })
      
      // Process events to extract meaningful results
      const testResults = events.filter(e => e.type === 'end_test' && e.attrs?.status)
      const keywordEvents = events.filter(e => e.type === 'keyword')
      
      testRunResult = {
        status: testResults.length > 0 ? testResults[0].attrs.status : 'UNKNOWN',
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
        }))
      }
      
      debug(config, `Test run completed with status: ${testRunResult.status}`)
    } catch (runError) {
      debug(config, `Error running test: ${runError.message}`)
      testRunResult = {
        status: 'ERROR',
        error: runError.message
      }
    }
    
    const response = {
      success: true,
      id: updatedTest.id,
      name: updatedTest.name,
      description: updatedTest.description,
      tags: updatedTest.tags,
      testData: updatedTest.content || processedTestData,
      testUrl: testUrl,
      testRunResult: testRunResult,
      message: `Test "${updatedTest.name}" (ID: ${id}) modified successfully`,
      timestamp: new Date().toISOString(),
      changes: {
        name: name !== undefined ? { from: existingTest.name, to: updatedTest.name } : null,
        description: description !== undefined ? { from: existingTest.description || '', to: updatedTest.description } : null,
        tags: tags !== undefined ? { from: existingTest.tags || [], to: updatedTest.tags } : null,
        testData: testData !== undefined ? { updated: true } : null
      },
      actions: {
        openInBrowser: {
          question: "Would you like to open this modified test in your browser?",
          url: testUrl,
          action: "open_browser"
        }
      }
    }
    
    // Ask user if they want to open the test in browser
    // Note: In a real MCP implementation, this would be handled by the client
    // For now, we'll include the URL and action in the response
    try {
      // Attempt to open browser automatically (this might not work in all environments)
      debug(config, `Opening modified test in browser: ${testUrl}`)
      await open(testUrl)
      response.browserOpened = true
    } catch (openError) {
      debug(config, `Could not automatically open browser: ${openError.message}`)
      response.browserOpened = false
      response.browserError = openError.message
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response),
        },
      ],
      isError: false,
    }
  } catch (error) {
    debug(config, `Error modifying test: ${error.message}`)
    
    const errorResponse = {
      error: true,
      message: error.message,
      type: error.name || 'Error',
      timestamp: new Date().toISOString(),
      testId: id,
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
 * Process test data to ensure it contains only keywords (no test case structure)
 * Browser is already launched, so we filter out browser setup keywords
 * @param {string} testData - Raw test data
 * @returns {string} Processed test data with only essential keywords
 */
function processTestDataForKeywordsOnly(testData) {
  if (!testData || typeof testData !== 'string') {
    return ''
  }
  
  // Keywords to skip because browser is already launched and libraries imported
  const skipKeywords = [
    'New Browser',
    'New Context', 
    'New Page',
    'Library',
    'Import Library'
  ]
  
  // Split into lines and process
  const lines = testData.split('\n')
  const processedLines = []
  
  let inTestCase = false
  let inSettings = false
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    
    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue
    }
    
    // Skip section headers
    if (trimmedLine.startsWith('***') && trimmedLine.endsWith('***')) {
      const sectionName = trimmedLine.replace(/\*/g, '').trim().toLowerCase()
      inTestCase = sectionName.includes('test case')
      inSettings = sectionName.includes('setting')
      continue
    }
    
    // Skip settings section
    if (inSettings) {
      continue
    }
    
    // Skip test case names (lines that don't start with whitespace in test cases section)
    if (inTestCase && !line.startsWith(' ') && !line.startsWith('\t')) {
      continue
    }
    
    // Process keywords
    let keywordLine = ''
    if (inTestCase && (line.startsWith(' ') || line.startsWith('\t'))) {
      keywordLine = trimmedLine
    } else if (!inTestCase && !inSettings) {
      keywordLine = trimmedLine
    }
    
    if (keywordLine) {
      // Skip browser setup keywords since browser is already launched
      const shouldSkip = skipKeywords.some(skipKeyword => 
        keywordLine.startsWith(skipKeyword)
      )
      
      if (!shouldSkip) {
        // Convert "New Page" to "Go To" since page navigation is what we want
        if (keywordLine.startsWith('New Page')) {
          const url = keywordLine.replace('New Page', '').trim()
          if (url) {
            processedLines.push(`Go To    ${url}`)
          }
        } else {
          processedLines.push(keywordLine)
        }
      }
    }
  }
  
  // If no processed lines, return the original (might be already just keywords)
  if (processedLines.length === 0) {
    // Check if the original data looks like it's already just keywords
    const originalLines = lines.filter(line => line.trim() && !line.trim().startsWith('#'))
    if (originalLines.length > 0 && !originalLines.some(line => line.includes('***'))) {
      // Still filter out browser setup keywords from direct input
      const filteredLines = originalLines.filter(line => {
        const trimmed = line.trim()
        return !skipKeywords.some(skipKeyword => trimmed.startsWith(skipKeyword))
      }).map(line => {
        const trimmed = line.trim()
        // Convert "New Page" to "Go To"
        if (trimmed.startsWith('New Page')) {
          const url = trimmed.replace('New Page', '').trim()
          return url ? `Go To    ${url}` : ''
        }
        return trimmed
      }).filter(line => line)
      
      return filteredLines.join('\n')
    }
    return ''
  }
  
  return processedLines.join('\n')
}

/**
 * Handle keywords search tool call
 * @param {Object} args - Tool arguments
 * @param {string} [args.search] - Search term
 * @param {string} [args.type='all'] - Type of documentation to search
 * @returns {Object} Keywords search result
 */
async function handleKeywordsSearch(args) {
  const { search = '', type = 'all' } = args
  
  debug(config, `Searching keywords with term: "${search}", type: ${type}`)
  
  try {
    let results = {}
    
    // Helper function to search within an object
    const searchInObject = (obj, searchTerm) => {
      if (!searchTerm) return obj
      
      const lowerSearch = searchTerm.toLowerCase()
      const filtered = {}
      
      for (const [key, value] of Object.entries(obj)) {
        // Search in key name
        if (key.toLowerCase().includes(lowerSearch)) {
          filtered[key] = value
          continue
        }
        
        // Search in documentation/description
        if (value && typeof value === 'object') {
          if (value.doc && value.doc.toLowerCase().includes(lowerSearch)) {
            filtered[key] = value
            continue
          }
          if (value.name && value.name.toLowerCase().includes(lowerSearch)) {
            filtered[key] = value
            continue
          }
          if (value.shortdoc && value.shortdoc.toLowerCase().includes(lowerSearch)) {
            filtered[key] = value
            continue
          }
          
          // Search in keywords array for libraries
          if (value.keywords && Array.isArray(value.keywords)) {
            const matchingKeywords = value.keywords.filter(kw => 
              (kw.name && kw.name.toLowerCase().includes(lowerSearch)) ||
              (kw.doc && kw.doc.toLowerCase().includes(lowerSearch)) ||
              (kw.shortdoc && kw.shortdoc.toLowerCase().includes(lowerSearch))
            )
            
            if (matchingKeywords.length > 0) {
              filtered[key] = {
                ...value,
                keywords: matchingKeywords,
                _matchCount: matchingKeywords.length
              }
            }
          }
        }
      }
      
      return filtered
    }
    
    // Search based on type
    if (type === 'libraries' || type === 'all') {
      results.libraries = searchInObject(libraries, search)
    }
    
    if (type === 'keywords' || type === 'all') {
      results.keywords = searchInObject(keywords, search)
    }
    
    // Count results
    const libraryCount = results.libraries ? Object.keys(results.libraries).length : 0
    const keywordCount = results.keywords ? Object.keys(results.keywords).length : 0
    
    const response = {
      search: search || 'all',
      type,
      results,
      summary: {
        libraries: libraryCount,
        keywords: keywordCount,
        total: libraryCount + keywordCount
      },
      timestamp: new Date().toISOString()
    }
    
    debug(config, `Keywords search completed: ${response.summary.total} results`)
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response),
        },
      ],
      isError: false,
    }
  } catch (error) {
    debug(config, `Error searching keywords: ${error.message}`)
    
    const errorResponse = {
      error: true,
      message: error.message,
      type: error.name || 'Error',
      search: search || 'all',
      searchType: type,
      timestamp: new Date().toISOString()
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
 * Generate test creation prompt with context-specific guidance
 * @param {string} testType - Type of test to create
 * @param {string} targetSystem - Target system to test
 * @returns {string} Generated prompt text
 */
function generateTestCreationPrompt(testType, targetSystem) {
  const availableLibraries = Object.keys(libraries).join(', ')
  
  // Get all available keywords from all libraries
  const allKeywords = []
  Object.values(libraries).forEach(library => {
    if (library.keywords) {
      library.keywords.forEach(keyword => {
        allKeywords.push(keyword.name)
      })
    }
  })
  
  // Sort keywords alphabetically for better readability
  allKeywords.sort()
  
  let prompt = `# Test Creation Assistant for HelpMeTest Platform

You are helping create comprehensive Robot Framework tests using the HelpMeTest platform.

## CRITICAL: Available Keywords Only
You MUST ONLY use keywords from the following list. Using any keyword not in this list is FORBIDDEN and will cause test failures.

### Available Robot Framework Keywords:
${allKeywords.map(keyword => `- ${keyword}`).join('\n')}

## Available Libraries
The following Robot Framework libraries are available: ${availableLibraries}

## RESTRICTIONS
- **FORBIDDEN**: Do NOT use any keywords not listed above
- **FORBIDDEN**: Do NOT use New Browser, New Page, or browser setup keywords (browser is already launched)
- **FORBIDDEN**: Do NOT use keywords from libraries not imported (SeleniumLibrary, etc.)
- **REQUIRED**: Only use keywords from the approved list above

## Common Keywords by Category
### Browser/UI Testing (if Browser library is available):
- Go To, Click, Type, Get Text, Get Title, Wait For Elements State
- Fill Text, Select Options, Check Checkbox, Uncheck Checkbox
- Take Screenshot, Get Element Count, Get Attribute

### Assertions (BuiltIn library):
- Should Be Equal, Should Contain, Should Be True, Should Not Be Empty
- Should Be Greater Than, Should Be Less Than, Should Match

### Variables & Data (BuiltIn library):
- Set Variable, Get Variable Value, Log, Comment
- Convert To Integer, Convert To String, Catenate

### API Testing (if RequestsLibrary is available):
- GET, POST, PUT, DELETE, Create Session
- Status Should Be, Response Should Contain

## Available MCP Tools
- \`helpmetest_create_test\`: Create a new test with specified parameters
- \`helpmetest_modify_test\`: Modify an existing test by providing its ID and updated parameters
- \`helpmetest_keywords\`: Search available Robot Framework keywords and libraries
- \`helpmetest_list_tests\`: List existing tests for reference

## Test Creation Process

### 1. Gather Requirements
Ask the user about:
- **Test Purpose**: What should this test verify?
- **Test Steps**: What actions need to be performed?
- **Expected Results**: What should happen when the test runs?
- **Test Data**: What data is needed for the test?

### 2. Search Available Keywords
Use \`helpmetest_keywords\` to find relevant Robot Framework keywords:
- Search for keywords related to the test functionality
- Look for assertion keywords (search for "should")
- Find setup/teardown keywords if needed

### 3. Design Test Keywords
Plan ONLY the keywords to execute (browser is already launched):
- **Navigation**: Go To, Click, etc.
- **Interactions**: Input Text, Select From List, etc.
- **Assertions**: Get Title, Should Be Equal, etc.
- **NO browser setup needed** (New Browser, New Page are filtered out)

### 4. Create the Test
Use \`helpmetest_create_test\` with:
- **name**: Descriptive test name
- **description**: Detailed description of what the test does
- **tags**: Relevant tags for organization
- **testData**: ONLY Robot Framework keywords (no *** Test Cases *** structure needed)

## Test Modification Process

### 1. Find the Test to Modify
Use \`helpmetest_list_tests\` to find the test ID you want to modify.

### 2. Modify the Test
Use \`helpmetest_modify_test\` with:
- **id**: Test ID (required - the ID of the existing test to modify)
- **name**: New test name (optional - keeps existing if not provided)
- **description**: New description (optional - keeps existing if not provided)
- **tags**: New tags array (optional - keeps existing if not provided)
- **testData**: New Robot Framework keywords (optional - keeps existing if not provided)

### 3. Partial Updates
You can update only specific fields:
- To change only the name: provide just \`id\` and \`name\`
- To update only test steps: provide just \`id\` and \`testData\`
- To add/change tags: provide just \`id\` and \`tags\`
- Any combination of fields can be updated

## Test Naming Conventions
- Use descriptive names that explain what the test does
- Start with the action or feature being tested
- Include the expected outcome
- Examples:
  - "Login with Valid Credentials Should Succeed"
  - "API Returns 404 for Non-Existent Resource"
  - "Database Connection Should Be Established"

## Common Test Tags
- **smoke**: Critical functionality tests
- **regression**: Tests for bug prevention
- **ui**: User interface tests (using Browser library)
- **api**: API/service tests (using RequestsLibrary)
- **database**: Database-related tests
- **integration**: Integration tests
- **performance**: Performance tests
- **security**: Security tests`

  if (testType) {
    prompt += `\n\n## Specific Guidance for ${testType.toUpperCase()} Testing\n`
    
    switch (testType.toLowerCase()) {
      case 'ui':
        prompt += `- Browser is ALREADY LAUNCHED - no New Browser/New Page needed
- Use navigation keywords: Go To, Click, Input Text, etc.
- Search for "click", "input", "wait", "should" keywords
- Consider page load times and element visibility
- Use appropriate selectors (id, class, xpath, etc.)
- Include assertions to verify UI state
- Example testData: "Go To    https://example.com\\nGet Title    ==    Example Domain"`
        break
      case 'api':
        prompt += `- Use RequestsLibrary for HTTP/REST API testing
- Search for "get", "post", "put", "delete", "status" keywords
- Include request/response validation
- Test different HTTP status codes
- Validate response content and structure`
        break
      case 'database':
        prompt += `- Search for database-related keywords
- Include connection setup and teardown
- Test queries, inserts, updates, deletes
- Validate data integrity
- Consider transaction handling`
        break
      case 'integration':
        prompt += `- Combine multiple libraries as needed
- Test end-to-end workflows
- Include proper setup and teardown
- Test data flow between systems
- Validate system interactions`
        break
    }
  }

  if (targetSystem) {
    prompt += `\n\n## Target System: ${targetSystem}
Consider system-specific requirements:
- Authentication methods
- Data formats and protocols
- Error handling patterns
- Performance characteristics
- Security considerations`
  }

  prompt += `\n\n## Best Practices
1. **Clear Test Names**: Make test purpose obvious from the name
2. **Comprehensive Descriptions**: Explain what the test does and why
3. **Appropriate Tags**: Use tags for test organization and filtering
4. **Keywords Only**: testData should contain ONLY Robot Framework keywords, no test structure
5. **No Browser Setup**: Browser is already launched, skip New Browser/New Page keywords
6. **Direct Actions**: Start with Go To, Click, Input Text, Get Title, etc.
7. **Maintainability**: Write tests that are easy to understand and modify

## testData Format Examples (ONLY using approved keywords):
- Simple: "Go To    https://example.com\\nGet Title    ==    Example Domain"
- Complex: "Go To    https://example.com\\nClick    id=login-button\\nType    id=username    testuser\\nClick    id=submit"
- With assertions: "Go To    https://example.com\\nGet Text    h1    ==    Welcome\\nShould Contain    ${result}    Welcome"

## IMPORTANT REMINDERS:
- **VERIFY KEYWORDS**: Before using any keyword, check it exists in the approved list above
- **USE helpmetest_keywords**: Search for keywords if you're unsure about availability
- **NO BROWSER SETUP**: Browser is already launched, start directly with Go To, Click, etc.
- **STICK TO THE LIST**: Only use keywords from the approved list - no exceptions!

Start by using \`helpmetest_keywords\` to explore available keywords for your test needs.`

  return prompt
}

/**
 * Generate keyword exploration prompt with search guidance
 * @param {string} searchTerm - Specific term to search for
 * @returns {string} Generated prompt text
 */
function generateKeywordExplorationPrompt(searchTerm) {
  const availableLibraries = Object.keys(libraries).join(', ')
  
  // Get all available keywords from all libraries
  const allKeywords = []
  Object.values(libraries).forEach(library => {
    if (library.keywords) {
      library.keywords.forEach(keyword => {
        allKeywords.push(keyword.name)
      })
    }
  })
  
  // Sort keywords alphabetically for better readability
  allKeywords.sort()
  
  let prompt = `# Robot Framework Keywords Explorer for HelpMeTest Platform

This guide helps you explore and understand available Robot Framework keywords and libraries.

## CRITICAL: Available Keywords Only
You MUST ONLY use keywords from the following list. Using any keyword not in this list is FORBIDDEN and will cause test failures.

### Available Robot Framework Keywords:
${allKeywords.map(keyword => `- ${keyword}`).join('\n')}

## Available Libraries
${availableLibraries}

## RESTRICTIONS
- **FORBIDDEN**: Do NOT use any keywords not listed above
- **FORBIDDEN**: Do NOT use keywords from libraries not imported (SeleniumLibrary, etc.)
- **REQUIRED**: Only use keywords from the approved list above

## Common Keywords by Category
### Browser/UI Testing (if Browser library is available):
- Go To, Click, Type, Get Text, Get Title, Wait For Elements State
- Fill Text, Select Options, Check Checkbox, Uncheck Checkbox
- Take Screenshot, Get Element Count, Get Attribute

### Assertions (BuiltIn library):
- Should Be Equal, Should Contain, Should Be True, Should Not Be Empty
- Should Be Greater Than, Should Be Less Than, Should Match

### Variables & Data (BuiltIn library):
- Set Variable, Get Variable Value, Log, Comment
- Convert To Integer, Convert To String, Catenate

### API Testing (if RequestsLibrary is available):
- GET, POST, PUT, DELETE, Create Session
- Status Should Be, Response Should Contain

## Available Tool
Use \`helpmetest_keywords\` to search and explore:
- **search**: Filter keywords/libraries by search term
- **type**: Choose 'keywords', 'libraries', or 'all'

## Common Search Patterns

### By Functionality
- \`helpmetest_keywords({search: "browser"})\` - Web automation keywords (Browser library)
- \`helpmetest_keywords({search: "api"})\` - API testing keywords (RequestsLibrary)
- \`helpmetest_keywords({search: "should"})\` - Assertion keywords (BuiltIn library)
- \`helpmetest_keywords({search: "log"})\` - Logging keywords (BuiltIn library)
- \`helpmetest_keywords({search: "wait"})\` - Wait/timing keywords

### By Library
- \`helpmetest_keywords({search: "BuiltIn", type: "libraries"})\` - Core Robot Framework keywords
- \`helpmetest_keywords({search: "Browser", type: "libraries"})\` - Web browser automation
- \`helpmetest_keywords({search: "RequestsLibrary", type: "libraries"})\` - HTTP/API testing

### By Action Type
- \`helpmetest_keywords({search: "click"})\` - Click actions
- \`helpmetest_keywords({search: "input"})\` - Input/typing actions
- \`helpmetest_keywords({search: "get"})\` - Retrieval operations
- \`helpmetest_keywords({search: "set"})\` - Setting/assignment operations
- \`helpmetest_keywords({search: "create"})\` - Creation operations

## Understanding Keyword Documentation
Each keyword result includes:
- **name**: The keyword name to use in tests
- **args**: Parameters the keyword accepts
- **doc**: Full documentation with examples
- **shortdoc**: Brief description
- **source**: Where the keyword is defined

## Library Overview

### BuiltIn Library
Always available, provides:
- **Assertions**: Should Be Equal, Should Contain, Should Be True
- **Variables**: Set Variable, Get Variable Value
- **Control Flow**: Run Keyword If, Run Keywords
- **Logging**: Log, Log Many, Comment
- **Conversions**: Convert To Integer, Convert To String

### Browser Library
For web browser automation:
- **Navigation**: Open Browser, Go To, Close Browser
- **Element Interaction**: Click, Type, Select Options
- **Waiting**: Wait For Elements State, Wait For Load State
- **Assertions**: Get Text, Get Attribute

### RequestsLibrary
For HTTP/REST API testing:
- **Requests**: GET, POST, PUT, DELETE
- **Sessions**: Create Session, Delete All Sessions
- **Assertions**: Status Should Be, Response Should Contain

## Search Tips
1. **Start Broad**: Begin with general terms like "browser" or "api"
2. **Get Specific**: Narrow down to specific actions like "click" or "input"
3. **Check Documentation**: Read the full doc field for usage examples
4. **Explore Libraries**: Look at entire libraries to understand capabilities
5. **Find Alternatives**: Search for similar keywords if one doesn't fit

## Workflow for Test Development
1. **Identify Need**: What action do you need to perform?
2. **Search Keywords**: Use \`helpmetest_keywords\` to find relevant keywords
3. **Read Documentation**: Understand parameters and usage
4. **Check Examples**: Look for usage examples in the documentation
5. **Test Implementation**: Use the keyword in your test`

  if (searchTerm) {
    prompt += `\n\n## Focused Search: "${searchTerm}"
Let's start by exploring keywords related to "${searchTerm}":

\`helpmetest_keywords({search: "${searchTerm}"})\`

This will help you find relevant keywords and understand their usage.`
  }

  prompt += `\n\n## Advanced Search Techniques

### Finding Related Keywords
If you find a useful keyword, search for related ones:
- Found "Click"? Search "click" for more click-related keywords
- Found "Should Be Equal"? Search "should" for more assertions

### Library Exploration
Explore entire libraries to understand their full capabilities:
\`helpmetest_keywords({search: "BuiltIn", type: "libraries"})\`

### Keyword Patterns
Look for common patterns:
- Keywords starting with "Should" are usually assertions
- Keywords with "Wait" handle timing and synchronization
- Keywords with "Get" retrieve information
- Keywords with "Set" modify state

This systematic approach helps you build comprehensive and effective Robot Framework tests.`

  return prompt
}

/**
 * Generate test modification prompt with context-specific guidance
 * @param {string} testId - ID of the test to modify
 * @param {string} modificationType - Type of modification being performed
 * @returns {string} Generated prompt text
 */
function generateTestModificationPrompt(testId, modificationType) {
  const availableLibraries = Object.keys(libraries).join(', ')
  
  // Get all available keywords from all libraries
  const allKeywords = []
  Object.values(libraries).forEach(library => {
    if (library.keywords) {
      library.keywords.forEach(keyword => {
        allKeywords.push(keyword.name)
      })
    }
  })
  
  // Sort keywords alphabetically for better readability
  allKeywords.sort()
  
  let prompt = `# Robot Framework Test Modification Guide for HelpMeTest Platform

This guide helps you modify existing Robot Framework tests using the HelpMeTest platform.

## CRITICAL: Available Keywords Only
You MUST ONLY use keywords from the following list. Using any keyword not in this list is FORBIDDEN and will cause test failures.

**Available Libraries**: ${availableLibraries}

**Available Keywords** (${allKeywords.length} total):
${allKeywords.map(keyword => `- ${keyword}`).join('\n')}

## Available MCP Tools
- \`helpmetest_modify_test\`: Modify an existing test by providing its ID and updated parameters
- \`helpmetest_list_tests\`: List existing tests to find the test ID you want to modify
- \`helpmetest_keywords\`: Search available Robot Framework keywords and libraries

## Test Modification Process

### 1. Find the Test to Modify
Use \`helpmetest_list_tests\` to find the test ID you want to modify.

### 2. Modify the Test
Use \`helpmetest_modify_test\` with:
- **id**: Test ID (required - the ID of the existing test to modify)
- **name**: New test name (optional - keeps existing if not provided)
- **description**: New description (optional - keeps existing if not provided)
- **tags**: New tags array (optional - keeps existing if not provided)
- **testData**: New Robot Framework keywords (optional - keeps existing if not provided)

### 3. Partial Updates
You can update only specific fields:
- To change only the name: provide just \`id\` and \`name\`
- To update only test steps: provide just \`id\` and \`testData\`
- To add/change tags: provide just \`id\` and \`tags\`
- Any combination of fields can be updated

## Common Modification Scenarios

### Update Test Steps
When modifying testData:
- Browser is ALREADY LAUNCHED - no New Browser/New Page needed
- Use navigation keywords: Go To, Click, Input Text, etc.
- Include assertions to verify expected behavior
- Example: \`Go To    https://example.com\\nGet Title    ==    Example Domain\`

### Change Test Name
- Use descriptive names that explain what the test does
- Start with the action or feature being tested
- Include the expected outcome
- Examples:
  - "Login with Valid Credentials Should Succeed"
  - "API Returns 404 for Non-Existent Resource"

### Update Tags
- **smoke**: Critical functionality tests
- **regression**: Tests for bug prevention
- **ui**: User interface tests (using Browser library)
- **api**: API/service tests (using RequestsLibrary)
- **database**: Database-related tests
- **integration**: Integration tests

### Common Keywords by Category

#### Web Browser Automation (Browser library):
- Go To, Click, Type, Get Text, Get Title
- Wait For Elements State, Wait For Load State
- Should Be Equal, Should Contain

#### Assertions (BuiltIn library):
- Should Be Equal, Should Contain, Should Be True, Should Not Be Empty
- Should Be Greater Than, Should Be Less Than, Should Match

#### Variables & Data (BuiltIn library):
- Set Variable, Get Variable Value, Log, Comment
- Convert To Integer, Convert To String, Catenate

#### API Testing (if RequestsLibrary is available):
- GET, POST, PUT, DELETE, Create Session
- Status Should Be, Response Should Contain`

  if (testId) {
    prompt += `\n\n## Specific Test: ${testId}
First, use \`helpmetest_list_tests\` to get the current details of test "${testId}".
Then use \`helpmetest_modify_test\` with the test ID and your desired changes.`
  }

  if (modificationType) {
    prompt += `\n\n## Specific Modification: ${modificationType.toUpperCase()}
    
Focus on this type of modification:`
    
    switch (modificationType.toLowerCase()) {
      case 'update_steps':
      case 'change_steps':
      case 'modify_steps':
        prompt += `
- Use \`helpmetest_modify_test\` with \`id\` and \`testData\`
- Browser is ALREADY LAUNCHED - start directly with Go To, Click, etc.
- Include proper assertions to verify expected behavior
- Use only keywords from the approved list above
- Example testData: "Go To    https://example.com\\nClick    id=login-button\\nType    id=username    testuser"`
        break
      case 'change_name':
      case 'rename':
        prompt += `
- Use \`helpmetest_modify_test\` with \`id\` and \`name\`
- Make the name descriptive and clear about test purpose
- Follow naming convention: "Action/Feature Should Expected_Outcome"
- Example: "User Login Should Succeed with Valid Credentials"`
        break
      case 'add_tags':
      case 'update_tags':
      case 'change_tags':
        prompt += `
- Use \`helpmetest_modify_test\` with \`id\` and \`tags\`
- Tags should be an array of strings
- Use standard tags: smoke, regression, ui, api, database, integration
- Example tags: ["smoke", "ui", "login"]`
        break
      case 'update_description':
      case 'change_description':
        prompt += `
- Use \`helpmetest_modify_test\` with \`id\` and \`description\`
- Describe what the test does and why it's important
- Include any special setup or prerequisites
- Mention expected outcomes and validation points`
        break
    }
  }

  prompt += `\n\n## Best Practices for Test Modification
1. **Preserve Working Tests**: Only modify what needs to change
2. **Test After Changes**: The test will run automatically after modification
3. **Clear Documentation**: Update descriptions when changing test behavior
4. **Appropriate Tags**: Keep tags current with test functionality
5. **Keywords Only**: testData should contain ONLY Robot Framework keywords, no test structure
6. **No Browser Setup**: Browser is already launched, skip New Browser/New Page keywords
7. **Verify Keywords**: Use \`helpmetest_keywords\` to verify keyword availability before using

## testData Format Examples (ONLY using approved keywords):
- Simple: "Go To    https://example.com\\nGet Title    ==    Example Domain"
- Complex: "Go To    https://example.com\\nClick    id=login-button\\nType    id=username    testuser\\nClick    id=submit"
- With assertions: "Go To    https://example.com\\nGet Text    h1    ==    Welcome\\nShould Contain    \${result}    Welcome"

## IMPORTANT REMINDERS:
- **VERIFY KEYWORDS**: Before using any keyword, check it exists in the approved list above
- **USE helpmetest_keywords**: Search for keywords if you're unsure about availability
- **NO BROWSER SETUP**: Browser is already launched, start directly with Go To, Click, etc.
- **STICK TO THE LIST**: Only use keywords from the approved list - no exceptions!
- **PARTIAL UPDATES**: You only need to provide the fields you want to change

Start by using \`helpmetest_list_tests\` to see existing tests, then \`helpmetest_modify_test\` to make your changes.`

  return prompt
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
 * Handle test deletion request
 * @param {Object} args - Tool arguments
 * @param {string} args.identifier - Test ID, name, or tag (with tag: prefix) to delete
 * @returns {Object} Deletion result
 */
async function handleDeleteTest(args) {
  const { identifier } = args
  
  debug(config, `Deleting test with identifier: ${identifier}`)
  
  try {
    // For names or tags, we need to resolve to ID first
    let testId = identifier
    
    if (identifier.startsWith('tag:') || (identifier.length < 15 || identifier.includes(' '))) {
      // Treat as name or tag - look up the test first
      const tests = await getAllTests()
      let matchingTest
      
      if (identifier.startsWith('tag:')) {
        const tagToFind = identifier.substring(4)
        matchingTest = tests.find(test => 
          test.tags && test.tags.includes(tagToFind)
        )
      } else {
        matchingTest = tests.find(test => 
          test.name === identifier || 
          test.doc === identifier ||
          test.id === identifier
        )
      }
      
      if (!matchingTest) {
        throw new Error(`Test not found: ${identifier}`)
      }
      
      testId = matchingTest.id
    }
    
    // Delete the test
    const result = await deleteTest(testId)
    
    debug(config, `Test deletion successful: ${testId}, update ID: ${result.updateId}`)
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            testId: testId,
            updateId: result.updateId,
            message: `Test ${testId} has been deleted. You can undo this operation using the updateId.`,
            timestamp: new Date().toISOString()
          }),
        },
      ],
      isError: false,
    }
  } catch (error) {
    debug(config, `Test deletion failed: ${error.message}`)
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            identifier,
            timestamp: new Date().toISOString()
          }),
        },
      ],
      isError: true,
    }
  }
}

/**
 * Handle undo update request
 * @param {Object} args - Tool arguments
 * @param {string} args.updateId - ID of the update to undo
 * @returns {Object} Undo result
 */
async function handleUndoUpdate(args) {
  const { updateId } = args
  
  debug(config, `Attempting to undo update: ${updateId}`)
  
  try {
    // Call the undo update API endpoint
    const result = await undoUpdate(updateId)
    
    debug(config, `Update undone successfully: ${updateId}, action: ${result.action}`)
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            updateId: updateId,
            action: result.action,
            message: `Update ${updateId} has been undone successfully.`,
            result: result.result,
            timestamp: new Date().toISOString()
          }),
        },
      ],
      isError: false,
    }
  } catch (error) {
    debug(config, `Undo update failed: ${error.message}`)
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            updateId,
            timestamp: new Date().toISOString()
          }),
        },
      ],
      isError: true,
    }
  }
}

/**
 * Utility object for convenience
 */
export const mcpUtils = {
  createServer: createMcpServer,
  startStdio: startStdioServer,
  startHttp: startHttpServer,
}