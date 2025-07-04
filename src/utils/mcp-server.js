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
import { getAllHealthChecks, getAllTests, runTest, createTest, deleteTest, deleteHealthCheck, undoUpdate, runInteractiveCommand, getUserInfo } from './api.js'
import { getFormattedStatusData } from './status-data.js'
import { libraries } from '../keywords.js'

import { 
  TOOL_CONFIGS,
  getMcpServerConfig,
  validateMcpConfig 
} from './mcp-config.js'

// Interactive session management
const interactiveSessions = new Map()

/**
 * Get or create an interactive session ID
 * @param {string} providedSessionId - Optional session ID provided by user
 * @returns {Promise<string>} The session ID to use
 */
async function getInteractiveSessionId(providedSessionId) {
  if (providedSessionId && providedSessionId !== 'interactive') {
    return providedSessionId
  }
  
  // Check if we have an existing interactive session
  const existingSession = Array.from(interactiveSessions.keys()).find(id => 
    id.includes('__interactive__')
  )
  
  if (existingSession) {
    return existingSession
  }
  
  // Create new interactive session ID
  // Format: interactive__${timestamp} (server will add company ID automatically)
  const timestamp = new Date().toISOString()
  const sessionId = `interactive__${timestamp}`
  
  // Store the session
  interactiveSessions.set(sessionId, {
    created: new Date(),
    lastUsed: new Date()
  })
  
  return sessionId
}

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
 * Convert API base URL to web URL for opening tests in browser
 * @param {string} apiBaseUrl - The API base URL (e.g., 'https://helpmetest.com' or 'https://slava.helpmetest.com')
 * @returns {string} Web URL for browser access
 */
function getWebUrlFromApiUrl(apiBaseUrl) {
  try {
    const url = new URL(apiBaseUrl)
    // For API URLs, we typically want to use the same domain for web access
    // The API and web interface are usually on the same domain
    return `${url.protocol}//${url.host}`
  } catch (error) {
    debug(config, `Error parsing API URL ${apiBaseUrl}: ${error.message}`)
    // Fallback to the provided URL if parsing fails
    return apiBaseUrl
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
      description: 'Run a test by name, tag, or ID. After execution, provides a detailed explanation of what happened, including test results, keyword execution status, and next steps for debugging if needed.',
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
      description: 'Create a new test with specified parameters. After creation, the test will be automatically run and optionally opened in browser. Test content should contain only Robot Framework keywords (no test case structure needed - browser is already launched). Provides a comprehensive explanation of what was accomplished, including test creation status, automatic test run results, and next steps.',
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

  // Register delete_health_check tool
  server.registerTool(
    'helpmetest_delete_health_check',
    {
      title: 'Help Me Test: Delete Health Check Tool',
      description: 'Delete a health check by name. This operation creates an audit trail in the updates feed and can potentially be undone using the undo_update tool if the update is revertable.',
      inputSchema: {
        name: z.string().describe('Health check name to delete'),
      },
    },
    async (args) => {
      debug(config, `Delete health check tool called with args: ${JSON.stringify(args)}`)
      return await handleDeleteHealthCheck(args)
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
      description: 'Modify an existing test by providing its ID and updated parameters. The test will be automatically run after modification and optionally opened in browser. Test content should contain only Robot Framework keywords (no test case structure needed - browser is already launched). Provides a detailed explanation of what changes were made, automatic test run results, and guidance for next steps.',
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

  // Register interactive robot framework tool
  server.registerTool(
    'helpmetest_run_interactive_command',
    {
      title: 'Help Me Test: Interactive Robot Framework Command Tool',
      description: 'Execute a single Robot Framework command interactively for debugging and testing. This starts an interactive session that maintains browser state between commands. Use "Exit" command to close the session. Provides detailed explanations of what each command accomplished, context-specific guidance for next steps, and debugging tips if commands fail.',
      inputSchema: {
        command: z.string().describe('Robot Framework command to execute (e.g., "Go To  https://example.com", "Click  button", "Exit")'),
        line: z.number().optional().default(0).describe('Line number for debugging context (optional)'),
      },
    },
    async (args) => {
      debug(config, `Interactive command tool called with args: ${JSON.stringify(args)}`)
      return await handleInteractiveCommand(args)
    }
  )

  // Register test debugging prompt
  server.registerPrompt(
    'helpmetest_debug_test',
    {
      name: 'helpmetest_debug_test',
      description: 'Interactive test debugging guide that explains how to debug failing tests step by step using the interactive command system',
      arguments: [
        {
          name: 'test_content',
          description: 'The Robot Framework test content to debug',
          required: true
        },
        {
          name: 'test_name',
          description: 'Name of the test being debugged',
          required: false
        },
        {
          name: 'failure_description',
          description: 'Description of the failure or issue',
          required: false
        }
      ]
    },
    async (args) => {
      const { test_content = '', test_name = 'Test', failure_description = '' } = args
      
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: generateTestDebuggingPrompt(test_content, test_name, failure_description)
            }
          }
        ]
      }
    }
  )

  // Register health check integration tool
  server.registerTool(
    'helpmetest_add_health_check',
    {
      title: 'Help Me Test: Add Health Check Tool',
      description: 'Automatically add HelpMeTest health checks to container files (Dockerfile, docker-compose.yml, Kubernetes manifests, devspace.yaml). Note: For Kubernetes services not exposed through Service resources, readiness probes are typically not needed.',
      inputSchema: {
        filePath: z.string().describe('Path to the file to modify (Dockerfile, docker-compose.yml, k8s manifest, devspace.yaml)'),
        serviceName: z.string().describe('Name of the service for the health check'),
        healthCheckUrl: z.string().optional().default('localhost:3000/health').describe('Health check endpoint URL (default: localhost:3000/health)'),
        gracePeriod: z.string().optional().default('1m').describe('Grace period for health check (default: 1m)'),
        interval: z.string().optional().default('30s').describe('Health check interval (default: 30s)'),
        timeout: z.string().optional().default('10s').describe('Health check timeout (default: 10s)'),
        retries: z.number().optional().default(3).describe('Number of retries (default: 3)'),
      },
    },
    async (args) => {
      debug(config, `Add health check tool called with args: ${JSON.stringify(args)}`)
      return await handleAddHealthCheck(args)
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

  server.registerPrompt(
    'helpmetest_health_check_integration',
    {
      name: 'helpmetest_health_check_integration',
      description: 'Guide for integrating HelpMeTest health checks into containers, pods, and devspace files',
      arguments: [
        {
          name: 'container_type',
          description: 'Type of container integration (docker, kubernetes, devspace)',
          required: false
        },
        {
          name: 'service_name',
          description: 'Name of the service to add health checks to',
          required: false
        }
      ]
    },
    async (args) => {
      const { container_type = '', service_name = '' } = args
      
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: generateHealthCheckIntegrationPrompt(container_type, service_name)
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
    
    // Create user-friendly explanation
    const explanation = createTestRunExplanation(response, identifier)
    
    return {
      content: [
        {
          type: 'text',
          text: explanation,
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
    
    // Construct the test URL for browser opening using the configured API base URL
    const webBaseUrl = getWebUrlFromApiUrl(config.apiBaseUrl)
    let testUrl = `${webBaseUrl}/test/${createdTest.id}`
    
    // Run the test immediately after creation
    let testRunResult = null
    let runTimestamp = null
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
      
      // Extract timestamp from run_id for the test run URL
      if (events.length > 0 && events[0].id) {
        // run_id format is: company__testId__timestamp
        const runIdParts = events[0].id.split('__')
        if (runIdParts.length === 3) {
          runTimestamp = runIdParts[2]
        }
      }
      
      testRunResult = {
        status: testResults.length > 0 ? testResults[0].attrs.status : 'UNKNOWN',
        totalEvents: events.length,
        runTimestamp: runTimestamp,
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
      
      // Update test URL to point to the specific run if we have a timestamp
      if (runTimestamp) {
        testUrl = `${webBaseUrl}/test/${createdTest.id}/${runTimestamp}`
        debug(config, `Updated test URL to point to specific run: ${testUrl}`)
      }
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
    
    // Create user-friendly explanation
    const explanation = createTestCreationExplanation(response)
    
    return {
      content: [
        {
          type: 'text',
          text: explanation,
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
    
    // Construct the test URL for browser opening using the configured API base URL
    const webBaseUrl = getWebUrlFromApiUrl(config.apiBaseUrl)
    let testUrl = `${webBaseUrl}/test/${updatedTest.id}`
    
    // Run the test immediately after modification
    let testRunResult = null
    let runTimestamp = null
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
      
      // Extract timestamp from run_id for the test run URL
      if (events.length > 0 && events[0].id) {
        // run_id format is: company__testId__timestamp
        const runIdParts = events[0].id.split('__')
        if (runIdParts.length === 3) {
          runTimestamp = runIdParts[2]
        }
      }
      
      testRunResult = {
        status: testResults.length > 0 ? testResults[0].attrs.status : 'UNKNOWN',
        totalEvents: events.length,
        runTimestamp: runTimestamp,
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
      
      // Update test URL to point to the specific run if we have a timestamp
      if (runTimestamp) {
        testUrl = `${webBaseUrl}/test/${updatedTest.id}/${runTimestamp}`
        debug(config, `Updated test URL to point to specific run: ${testUrl}`)
      }
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
    
    // Create user-friendly explanation
    const explanation = createTestModificationExplanation(response)
    
    return {
      content: [
        {
          type: 'text',
          text: explanation,
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
      results.keywords = {}
      
      // Extract keywords from libraries
      for (const [libName, libData] of Object.entries(libraries)) {
        if (libData.keywords) {
          for (const keyword of libData.keywords) {
            if (!search || 
                keyword.name.toLowerCase().includes(search.toLowerCase()) ||
                (keyword.doc && keyword.doc.toLowerCase().includes(search.toLowerCase())) ||
                (keyword.shortdoc && keyword.shortdoc.toLowerCase().includes(search.toLowerCase()))
               ) {
              results.keywords[keyword.name] = {
                ...keyword,
                library: libName
              }
            }
          }
        }
      }
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
 * Handle interactive Robot Framework command tool call
 * @param {Object} args - Tool arguments
 * @param {string} args.command - Robot Framework command to execute
 * @param {number} [args.line=0] - Line number for debugging context
 * @param {string} [args.sessionId] - Session ID to maintain state
 * @returns {Object} Interactive command execution result
 */
async function handleInteractiveCommand(args) {
  const { command, line = 0 } = args
  
  debug(config, `Executing interactive Robot Framework command: ${command}`)
  debug(config, `API Config: ${JSON.stringify({
    baseURL: config.apiBaseUrl,
    hasToken: !!config.apiToken,
    tokenPrefix: config.apiToken ? config.apiToken.substring(0, 10) + '...' : 'none'
  })}`)
  
  try {
    // Get or create session timestamp - same timestamp for all commands in one session
    let sessionTimestamp = interactiveSessions.get('interactive')?.timestamp
    if (!sessionTimestamp) {
      sessionTimestamp = new Date().toISOString()
      interactiveSessions.set('interactive', {
        timestamp: sessionTimestamp,
        created: new Date(),
        lastUsed: new Date()
      })
    } else {
      // Update last used time
      interactiveSessions.get('interactive').lastUsed = new Date()
    }
    
    // Call the robot service directly via the app API with fixed parameters
    const response = await runInteractiveCommand(command, line, 'interactive', sessionTimestamp)
    
    // Clean up session if Exit command
    if (command.trim() === 'Exit') {
      interactiveSessions.delete('interactive')
    }
    
    // Create user-friendly explanation
    const commandResult = {
      command,
      line,
      test: 'interactive',
      timestamp: sessionTimestamp,
      result: response,
      success: true
    }
    const explanation = createInteractiveCommandExplanation(commandResult)
    
    return {
      content: [
        {
          type: 'text',
          text: explanation,
        },
      ],
    }
  } catch (error) {
    debug(config, `Error executing interactive command: ${error.message}`)
    
    // Get session timestamp for error response
    const sessionTimestamp = interactiveSessions.get('interactive')?.timestamp || new Date().toISOString()
    
    const errorResponse = {
      error: true,
      command,
      line,
      test: 'interactive',
      message: error.message,
      type: error.name || 'Error',
      timestamp: sessionTimestamp,
      debug: {
        apiUrl: config.apiBaseUrl,
        hasToken: !!config.apiToken,
        status: error.status || null
      }
    }
    
    // Add specific error suggestions
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
 * Handle add health check tool call
 * @param {Object} args - Tool arguments
 * @param {string} args.filePath - Path to the file to modify
 * @param {string} args.serviceName - Name of the service for the health check
 * @param {string} [args.healthCheckUrl='localhost:3000/health'] - Health check endpoint URL
 * @param {string} [args.gracePeriod='1m'] - Grace period for health check
 * @param {string} [args.interval='30s'] - Health check interval
 * @param {string} [args.timeout='10s'] - Health check timeout
 * @param {number} [args.retries=3] - Number of retries
 * @returns {Object} Health check addition result
 */
async function handleAddHealthCheck(args) {
  const { 
    filePath, 
    serviceName, 
    healthCheckUrl = 'localhost:3000/health',
    gracePeriod = '1m',
    interval = '30s',
    timeout = '10s',
    retries = 3
  } = args
  
  debug(config, `Adding health check to file: ${filePath}`)
  
  try {
    // Read the file content
    let fileContent
    try {
      fileContent = fs.readFileSync(filePath, 'utf8')
    } catch (readError) {
      throw new Error(`Could not read file ${filePath}: ${readError.message}`)
    }
    
    // Determine file type and add appropriate health check
    const fileName = path.basename(filePath).toLowerCase()
    let modifiedContent
    let healthCheckAdded = false
    
    if (fileName === 'dockerfile' || fileName.endsWith('.dockerfile')) {
      // Docker health check
      modifiedContent = addDockerHealthCheck(fileContent, serviceName, healthCheckUrl, interval, timeout, retries)
      healthCheckAdded = true
    } else if (fileName === 'docker-compose.yml' || fileName === 'docker-compose.yaml') {
      // Docker Compose health check
      modifiedContent = addDockerComposeHealthCheck(fileContent, serviceName, healthCheckUrl, interval, timeout, retries)
      healthCheckAdded = true
    } else if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) {
      // Check if it's a Kubernetes manifest or devspace file
      if (fileContent.includes('apiVersion:') && fileContent.includes('kind:')) {
        // Kubernetes manifest
        modifiedContent = addKubernetesHealthCheck(fileContent, serviceName, healthCheckUrl, gracePeriod, interval, timeout, retries)
        healthCheckAdded = true
      } else if (fileContent.includes('devspace') || fileName === 'devspace.yaml') {
        // DevSpace configuration
        modifiedContent = addDevSpaceHealthCheck(fileContent, serviceName, healthCheckUrl, gracePeriod)
        healthCheckAdded = true
      } else {
        throw new Error(`Unsupported YAML file type. File must be a Kubernetes manifest or devspace.yaml`)
      }
    } else {
      throw new Error(`Unsupported file type: ${fileName}. Supported types: Dockerfile, docker-compose.yml, Kubernetes manifests (.yaml/.yml), devspace.yaml`)
    }
    
    if (!healthCheckAdded) {
      throw new Error('Failed to add health check - unsupported file format')
    }
    
    // Write the modified content back to the file
    try {
      fs.writeFileSync(filePath, modifiedContent, 'utf8')
    } catch (writeError) {
      throw new Error(`Could not write to file ${filePath}: ${writeError.message}`)
    }
    
    const response = {
      success: true,
      filePath,
      serviceName,
      healthCheckUrl,
      gracePeriod,
      interval,
      timeout,
      retries,
      fileType: getFileType(fileName),
      message: `Health check successfully added to ${filePath}`,
      timestamp: new Date().toISOString(),
      instructions: getPostInstallationInstructions(getFileType(fileName))
    }
    
    debug(config, `Health check added successfully to ${filePath}`)
    
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
    debug(config, `Error adding health check: ${error.message}`)
    
    const errorResponse = {
      error: true,
      message: error.message,
      type: error.name || 'Error',
      filePath,
      serviceName,
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
 * Infer appropriate health check command based on container content
 * @param {string} content - Dockerfile content
 * @param {string} defaultUrl - Default health check URL
 * @returns {string} Appropriate health check command
 */
function inferHealthCheckCommand(content, defaultUrl) {
  const lowerContent = content.toLowerCase()
  
  // Look for CMD and ENTRYPOINT instructions
  const cmdMatch = content.match(/(?:CMD|ENTRYPOINT)\s*\[(.*?)\]|(?:CMD|ENTRYPOINT)\s+(.+)/i)
  const cmdLine = cmdMatch ? (cmdMatch[1] || cmdMatch[2] || '').toLowerCase() : ''
  
  // Database containers
  if (lowerContent.includes('postgres') || cmdLine.includes('postgres')) {
    return 'psql -h localhost -c "SELECT 1"'
  }
  
  if (lowerContent.includes('mysql') || cmdLine.includes('mysql')) {
    return 'mysql -h localhost -e "SELECT 1"'
  }
  
  if (lowerContent.includes('redis') || cmdLine.includes('redis')) {
    return 'redis-cli ping'
  }
  
  if (lowerContent.includes('mongo') || cmdLine.includes('mongo')) {
    return 'mongosh --eval "db.runCommand({ping: 1})"'
  }
  
  // Web servers/applications
  if (lowerContent.includes('node') || cmdLine.includes('node') || lowerContent.includes('npm')) {
    // Node.js app - try health endpoint first, fallback to root
    return defaultUrl.includes('localhost') ? `GET ${defaultUrl}` : 'GET localhost:3000/health'
  }
  
  if (lowerContent.includes('python') || cmdLine.includes('python') || lowerContent.includes('flask') || lowerContent.includes('fastapi')) {
    // Python web app
    return defaultUrl.includes('localhost') ? `GET ${defaultUrl}` : 'GET localhost:8000/health'
  }
  
  if (lowerContent.includes('nginx') || cmdLine.includes('nginx')) {
    return 'GET localhost:80/health'
  }
  
  if (lowerContent.includes('apache') || cmdLine.includes('apache')) {
    return 'GET localhost:80/health'
  }
  
  // Message queues
  if (lowerContent.includes('kafka') || cmdLine.includes('kafka')) {
    return ':9092'
  }
  
  if (lowerContent.includes('rabbitmq') || cmdLine.includes('rabbitmq')) {
    return 'GET localhost:15672/api/overview'
  }
  
  // Utility/debug containers
  if (cmdLine.includes('sleep') || cmdLine.includes('tail') || cmdLine.includes('infinity')) {
    return 'echo "Container is responsive"'
  }
  
  // Cron containers
  if (lowerContent.includes('cron') || cmdLine.includes('cron')) {
    return 'ps aux | grep cron'
  }
  
  // Default: if it looks like a web service, use the provided URL, otherwise use basic check
  if (defaultUrl && defaultUrl.includes('localhost') && !defaultUrl.includes('localhost:22')) {
    return `GET ${defaultUrl}`
  }
  
  // Fallback to basic responsiveness check
  return 'echo "Service is running"'
}

/**
 * Add health check to Dockerfile
 * @param {string} content - Original file content
 * @param {string} serviceName - Service name
 * @param {string} healthCheckUrl - Health check URL
 * @param {string} interval - Check interval
 * @param {string} timeout - Check timeout
 * @param {number} retries - Number of retries
 * @returns {string} Modified content
 */
function addDockerHealthCheck(content, serviceName, healthCheckUrl, interval, timeout, retries) {
  // Check if health check already exists
  if (content.includes('HEALTHCHECK')) {
    throw new Error('Dockerfile already contains a HEALTHCHECK instruction')
  }
  
  // Check if HelpMeTest CLI installation exists
  const hasHelpMeTestInstall = content.includes('helpmetest') || content.includes('https://helpmetest.com/install')
  
  let modifiedContent = content
  
  // Add HelpMeTest CLI installation if not present
  if (!hasHelpMeTestInstall) {
    // Find a good place to add the installation (after FROM instruction)
    const lines = content.split('\n')
    let insertIndex = -1
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().toUpperCase().startsWith('FROM ')) {
        insertIndex = i + 1
        break
      }
    }
    
    if (insertIndex === -1) {
      throw new Error('Could not find FROM instruction in Dockerfile')
    }
    
    // Insert HelpMeTest CLI installation
    const installLines = [
      '',
      '# Install HelpMeTest CLI for health checks',
      'RUN curl -fsSL https://helpmetest.com/install | bash',
      ''
    ]
    
    lines.splice(insertIndex, 0, ...installLines)
    modifiedContent = lines.join('\n')
  }
  
  // Analyze container purpose to determine appropriate health check command
  const healthCheckCommand = inferHealthCheckCommand(modifiedContent, healthCheckUrl)
  
  // Add health check instruction
  const healthCheckInstruction = `
# Add HelpMeTest health check
HEALTHCHECK --interval=${interval} --timeout=${timeout} --start-period=5s --retries=${retries} \\
    CMD helpmetest health "${serviceName}" "1m" "${healthCheckCommand}"`
  
  // Add health check before CMD instruction or at the end
  const lines = modifiedContent.split('\n')
  let insertIndex = lines.length
  
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim().toUpperCase().startsWith('CMD ') || 
        lines[i].trim().toUpperCase().startsWith('ENTRYPOINT ')) {
      insertIndex = i
      break
    }
  }
  
  lines.splice(insertIndex, 0, healthCheckInstruction)
  return lines.join('\n')
}

/**
 * Add health check to docker-compose.yml
 * @param {string} content - Original file content
 * @param {string} serviceName - Service name
 * @param {string} healthCheckUrl - Health check URL
 * @param {string} interval - Check interval
 * @param {string} timeout - Check timeout
 * @param {number} retries - Number of retries
 * @returns {string} Modified content
 */
function addDockerComposeHealthCheck(content, serviceName, healthCheckUrl, interval, timeout, retries) {
  // Parse YAML to find services
  const lines = content.split('\n')
  let modifiedLines = [...lines]
  let serviceFound = false
  let serviceIndent = 0
  let insertIndex = -1
  
  // Find the service section
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    if (trimmed === 'services:') {
      continue
    }
    
    // Check if this is a service definition
    if (line.match(/^ {2}\w+:/) && !line.includes('healthcheck:')) {
      const currentServiceName = line.replace(':', '').trim()
      if (currentServiceName === serviceName || serviceName === 'auto') {
        serviceFound = true
        serviceIndent = line.search(/\S/) // Find indentation
        
        // Find where to insert health check (after environment or ports)
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j]
          const nextTrimmed = nextLine.trim()
          
          // If we hit another service or end of file, insert here
          if (nextLine.match(/^ {2}\w+:/) || j === lines.length - 1) {
            insertIndex = j
            break
          }
          
          // If we find existing healthcheck, throw error
          if (nextTrimmed.startsWith('healthcheck:')) {
            throw new Error(`Service ${currentServiceName} already has a healthcheck defined`)
          }
        }
        break
      }
    }
  }
  
  if (!serviceFound) {
    throw new Error(`Service ${serviceName} not found in docker-compose.yml. Available services: ${getDockerComposeServices(content).join(', ')}`)
  }
  
  // Create health check configuration
  const healthCheckConfig = [
    `${' '.repeat(serviceIndent)}healthcheck:`,
    `${' '.repeat(serviceIndent + 2)}test: ["CMD", "helpmetest", "health", "${serviceName}", "1m", "GET", "${healthCheckUrl}"]`,
    `${' '.repeat(serviceIndent + 2)}interval: ${interval}`,
    `${' '.repeat(serviceIndent + 2)}timeout: ${timeout}`,
    `${' '.repeat(serviceIndent + 2)}retries: ${retries}`,
    `${' '.repeat(serviceIndent + 2)}start_period: 40s`
  ]
  
  modifiedLines.splice(insertIndex, 0, ...healthCheckConfig)
  return modifiedLines.join('\n')
}

/**
 * Add health check to Kubernetes manifest
 * @param {string} content - Original file content
 * @param {string} serviceName - Service name
 * @param {string} healthCheckUrl - Health check URL
 * @param {string} gracePeriod - Grace period
 * @param {string} interval - Check interval
 * @param {string} timeout - Check timeout
 * @param {number} retries - Number of retries
 * @returns {string} Modified content
 */
function addKubernetesHealthCheck(content, serviceName, healthCheckUrl, gracePeriod, interval, timeout, retries) {
  const lines = content.split('\n')
  let modifiedLines = [...lines]
  let containerFound = false
  let insertIndex = -1
  let containerIndent = 0
  
  // Find containers section
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    if (trimmed === 'containers:') {
      // Find the container definition
      for (let j = i + 1; j < lines.length; j++) {
        const containerLine = lines[j]
        const containerTrimmed = containerLine.trim()
        
        if (containerTrimmed.startsWith('- name:') || containerTrimmed.startsWith('name:')) {
          containerFound = true
          containerIndent = containerLine.search(/\S/)
          
          // Find where to insert probes (after env or ports)
          for (let k = j + 1; k < lines.length; k++) {
            const nextLine = lines[k]
            const nextTrimmed = nextLine.trim()
            
            // If we hit another container or end of containers, insert here
            if (nextTrimmed.startsWith('- name:') || 
                nextLine.match(/^\s*\w+:/) && !nextLine.includes('  ') ||
                k === lines.length - 1) {
              insertIndex = k
              break
            }
            
            // If we find existing probes, throw error
            if (nextTrimmed.startsWith('livenessProbe:') || nextTrimmed.startsWith('readinessProbe:')) {
              throw new Error('Container already has health check probes defined')
            }
          }
          break
        }
      }
      break
    }
  }
  
  if (!containerFound) {
    throw new Error('Could not find container definition in Kubernetes manifest')
  }
  
  // Create health check probes
  const probeConfig = [
    `${' '.repeat(containerIndent)}livenessProbe:`,
    `${' '.repeat(containerIndent + 2)}exec:`,
    `${' '.repeat(containerIndent + 4)}command:`,
    `${' '.repeat(containerIndent + 4)}- /bin/sh`,
    `${' '.repeat(containerIndent + 4)}- -c`,
    `${' '.repeat(containerIndent + 4)}- helpmetest health "${serviceName}-live-$(hostname)" "${gracePeriod}" "GET ${healthCheckUrl}"`,
    `${' '.repeat(containerIndent + 2)}initialDelaySeconds: 60`,
    `${' '.repeat(containerIndent + 2)}periodSeconds: ${parseInt(interval)}`,
    `${' '.repeat(containerIndent + 2)}timeoutSeconds: ${parseInt(timeout)}`,
    `${' '.repeat(containerIndent + 2)}failureThreshold: ${retries}`,
    `${' '.repeat(containerIndent)}readinessProbe:`,
    `${' '.repeat(containerIndent + 2)}exec:`,
    `${' '.repeat(containerIndent + 4)}command:`,
    `${' '.repeat(containerIndent + 4)}- /bin/sh`,
    `${' '.repeat(containerIndent + 4)}- -c`,
    `${' '.repeat(containerIndent + 4)}- helpmetest health "${serviceName}-ready-$(hostname)" "1m" "GET ${healthCheckUrl}"`,
    `${' '.repeat(containerIndent + 2)}initialDelaySeconds: 10`,
    `${' '.repeat(containerIndent + 2)}periodSeconds: 15`,
    `${' '.repeat(containerIndent + 2)}timeoutSeconds: ${parseInt(timeout)}`,
    `${' '.repeat(containerIndent + 2)}failureThreshold: 2`
  ]
  
  modifiedLines.splice(insertIndex, 0, ...probeConfig)
  return modifiedLines.join('\n')
}

/**
 * Add health check to devspace.yaml
 * @param {string} content - Original file content
 * @param {string} serviceName - Service name
 * @param {string} healthCheckUrl - Health check URL
 * @param {string} gracePeriod - Grace period
 * @returns {string} Modified content
 */
function addDevSpaceHealthCheck(content, serviceName, healthCheckUrl, gracePeriod) {
  // For devspace, we add livenessProbe and readinessProbe to the container in helm values
  const lines = content.split('\n')
  let modifiedLines = [...lines]
  
  // Infer the appropriate health check command
  const healthCheckCommand = inferHealthCheckCommand(content, healthCheckUrl)
  
  // Find the containers section in deployments -> helm -> values
  let containerIndex = -1
  let containerIndent = 0
  let inContainers = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    if (trimmed === 'containers:') {
      inContainers = true
      continue
    }
    
    if (inContainers && trimmed.startsWith('- ')) {
      // Found a container entry
      containerIndex = i
      containerIndent = line.length - line.trimStart().length + 2 // Base indent + 2 for list item
      break
    }
  }
  
  if (containerIndex === -1) {
    throw new Error('Could not find containers section in devspace.yaml')
  }
  
  // Find the end of the current container definition
  let insertIndex = containerIndex + 1
  for (let i = containerIndex + 1; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    // If we hit another container or a section at the same level or higher, stop
    if (trimmed.startsWith('- ') || 
        (trimmed && line.length - line.trimStart().length < containerIndent) ||
        (trimmed && !line.startsWith(' '.repeat(containerIndent)) && trimmed !== '')) {
      insertIndex = i
      break
    }
    
    // If we're at the end of the file
    if (i === lines.length - 1) {
      insertIndex = lines.length
      break
    }
  }
  
  // Create the health check probes
  const indent = ' '.repeat(containerIndent)
  const probeConfig = [
    `${indent}livenessProbe:`,
    `${indent}  exec:`,
    `${indent}    command:`,
    `${indent}      - helpmetest`,
    `${indent}      - health`,
    `${indent}      - "${serviceName}"`,
    `${indent}      - "${gracePeriod}"`,
    `${indent}      - "${healthCheckCommand}"`,
    `${indent}  failureThreshold: 3`,
    `${indent}  periodSeconds: 30`,
    `${indent}  timeoutSeconds: 10`,
    `${indent}readinessProbe:`,
    `${indent}  exec:`,
    `${indent}    command:`,
    `${indent}      - helpmetest`,
    `${indent}      - health`,
    `${indent}      - "${serviceName}"`,
    `${indent}      - "${gracePeriod}"`,
    `${indent}      - "${healthCheckCommand}"`,
    `${indent}  initialDelaySeconds: 5`,
    `${indent}  periodSeconds: 10`,
    `${indent}  timeoutSeconds: 10`,
    `${indent}  failureThreshold: 2`
  ]
  
  // Insert the probe configuration
  modifiedLines.splice(insertIndex, 0, ...probeConfig)
  
  return modifiedLines.join('\n')
}

/**
 * Get file type from filename
 * @param {string} fileName - File name
 * @returns {string} File type
 */
function getFileType(fileName) {
  if (fileName === 'dockerfile' || fileName.endsWith('.dockerfile')) {
    return 'docker'
  } else if (fileName === 'docker-compose.yml' || fileName === 'docker-compose.yaml') {
    return 'docker-compose'
  } else if (fileName === 'devspace.yaml') {
    return 'devspace'
  } else if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) {
    return 'kubernetes'
  }
  return 'unknown'
}

/**
 * Get services from docker-compose.yml content
 * @param {string} content - File content
 * @returns {Array<string>} Service names
 */
function getDockerComposeServices(content) {
  const lines = content.split('\n')
  const services = []
  let inServicesSection = false
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === 'services:') {
      inServicesSection = true
      continue
    }
    
    if (inServicesSection && line.match(/^ {2}\w+:/)) {
      services.push(line.replace(':', '').trim())
    } else if (inServicesSection && line.match(/^\w+:/)) {
      // End of services section
      break
    }
  }
  
  return services
}

/**
 * Get post-installation instructions based on file type
 * @param {string} fileType - Type of file
 * @returns {string} Instructions
 */
function getPostInstallationInstructions(fileType) {
  switch (fileType) {
    case 'docker':
      return 'Make sure to set HELPMETEST_API_TOKEN environment variable when running the container. Build and run: docker build -t myapp . && docker run -e HELPMETEST_API_TOKEN=your-token myapp'
    case 'docker-compose':
      return 'Make sure to set HELPMETEST_API_TOKEN in the environment section of your service. Run: docker-compose up'
    case 'kubernetes':
      return 'Make sure to create a Secret with your HELPMETEST_API_TOKEN and reference it in the container env. Apply: kubectl apply -f your-manifest.yaml'
    case 'devspace':
      return 'Make sure HELPMETEST_API_TOKEN is available in your environment. Deploy: devspace deploy'
    default:
      return 'Make sure HELPMETEST_API_TOKEN environment variable is properly configured'
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
- Example testData: "Go To    https://test.helpmetest.com\\nGet Title    ==    HelpMeTest"`
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
- Simple: "Go To    https://test.helpmetest.com\\nGet Title    ==    HelpMeTest"
- Complex: "Go To    https://test.helpmetest.com\\nClick    id=login-button\\nType    id=username    testuser\\nClick    id=submit"
- With assertions: "Go To    https://test.helpmetest.com\\nGet Text    h1    ==    Welcome\\nShould Contain    ${result}    Welcome"

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
- Example: \`Go To    https://test.helpmetest.com\\nGet Title    ==    HelpMeTest\`

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
- Example testData: "Go To    https://test.helpmetest.com\\nClick    id=login-button\\nType    id=username    testuser"`
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
- Simple: "Go To    https://test.helpmetest.com\\nGet Title    ==    HelpMeTest"
- Complex: "Go To    https://test.helpmetest.com\\nClick    id=login-button\\nType    id=username    testuser\\nClick    id=submit"
- With assertions: "Go To    https://test.helpmetest.com\\nGet Text    h1    ==    Welcome\\nShould Contain    \${result}    Welcome"

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
 * Generate test debugging prompt with interactive debugging guidance
 * @param {string} testContent - The Robot Framework test content to debug
 * @param {string} testName - Name of the test being debugged
 * @param {string} failureDescription - Description of the failure or issue
 * @returns {string} Generated prompt text
 */
function generateTestDebuggingPrompt(testContent, testName, failureDescription) {
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
  
  // Parse test content to show line numbers
  const testLines = testContent.split('\n').map((line, index) => `${index + 1}: ${line}`).join('\n')
  
  let prompt = `# Interactive Test Debugging Guide for HelpMeTest Platform

You are debugging a failing Robot Framework test using the interactive debugging approach.

## Test Information
**Test Name**: ${testName}
**Failure Description**: ${failureDescription || 'Not specified'}

## Test Content to Debug:
\`\`\`
${testLines}
\`\`\`

## Interactive Debugging Process

### Step 1: Run Commands Line by Line
Use \`helpmetest_run_interactive_command\` to execute each test step individually:

1. **Start with the first command** from your test
2. **Check if it passes** - if yes, continue to next line
3. **If it fails** - analyze the error and try alternative approaches
4. **Continue with corrected commands** until all steps work
5. **Modify the original test** with the working commands

### Step 2: Debug Failed Commands
When a command fails, try these debugging strategies:

#### For Element Not Found Errors:
- **Take a screenshot**: \`helpmetest_run_interactive_command({command: "Take Screenshot"})\`
- **Try different selectors**: 
  - \`Click  id=button-id\`
  - \`Click  css=.button-class\`
  - \`Click  xpath=//button[text()='Click Me']\`
  - \`Click  text=Button Text\`
- **Wait for elements**: \`Wait For Elements State  selector  visible\`

#### For Navigation Issues:
- **Check current URL**: \`Get Url\`
- **Wait for page load**: \`Wait For Load State  networkidle\`
- **Verify page title**: \`Get Title\`

#### For Timing Issues:
- **Add explicit waits**: \`Sleep  2s\`
- **Wait for network**: \`Wait Until Network Is Idle\`
- **Wait for elements**: \`Wait For Elements State  selector  visible\`

### Step 3: Alternative Command Strategies
If a command doesn't work, try these alternatives:

#### Instead of \`Click  Button Text\`:
- \`Click  css=button:has-text("Button Text")\`
- \`Click  xpath=//button[contains(text(), 'Button')]\`
- \`Click  [data-testid="button"]\`

#### Instead of \`Type  input  text\`:
- \`Fill Text  input  text\`
- \`Input Text  css=input[name="field"]  text\`
- \`Clear Text  input\` then \`Type  input  text\`

#### Instead of \`Get Text  element\`:
- \`Get Property  element  textContent\`
- \`Get Attribute  element  value\`
- \`Get Element Count  selector\`

## Available MCP Tools for Debugging

### \`helpmetest_run_interactive_command\`
Execute individual Robot Framework commands:
\`\`\`
helpmetest_run_interactive_command({
  command: "Go To  https://example.com",
  line: 1
})
\`\`\`

### \`helpmetest_modify_test\`
Update the original test with working commands:
\`\`\`
helpmetest_modify_test({
  id: "test-id",
  testData: "corrected commands here"
})
\`\`\`

### \`helpmetest_keywords\`
Search for available keywords:
\`\`\`
helpmetest_keywords({search: "click"})
helpmetest_keywords({search: "wait"})
helpmetest_keywords({search: "should"})
\`\`\`

## Available Keywords (${allKeywords.length} total)
**Libraries**: ${availableLibraries}

**Common Debugging Keywords**:
- **Navigation**: Go To, Get Url, Get Title
- **Interaction**: Click, Type, Fill Text, Clear Text
- **Waiting**: Wait For Elements State, Wait For Load State, Sleep, Wait Until Network Is Idle
- **Verification**: Get Text, Get Attribute, Get Property, Should Be Equal, Should Contain
- **Debugging**: Take Screenshot, Get Element Count, Log

**All Available Keywords**:
${allKeywords.slice(0, 50).map(keyword => `- ${keyword}`).join('\n')}
${allKeywords.length > 50 ? `... and ${allKeywords.length - 50} more (use helpmetest_keywords to search)` : ''}

## Debugging Workflow Example

1. **Start Interactive Session**:
   \`helpmetest_run_interactive_command({command: "Go To  https://example.com"})\`

2. **If it fails, try alternatives**:
   \`helpmetest_run_interactive_command({command: "Sleep  2s"})\`
   \`helpmetest_run_interactive_command({command: "Go To  https://example.com"})\`

3. **Continue with next step**:
   \`helpmetest_run_interactive_command({command: "Click  a"})\`

4. **If click fails, debug the selector**:
   \`helpmetest_run_interactive_command({command: "Take Screenshot"})\`
   \`helpmetest_run_interactive_command({command: "Click  css=a[href*='iana']"})\`

5. **Once all steps work, update the test**:
   \`helpmetest_modify_test({id: "test-id", testData: "Go To  https://example.com\\nSleep  2s\\nClick  css=a[href*='iana']"})\`

## Key Debugging Tips

1. **One Command at a Time**: Execute commands individually to isolate issues
3. **Try Multiple Selectors**: Different selector strategies work for different elements
4. **Add Waits**: Many issues are timing-related
5. **Check Page State**: Verify URLs, titles, and element presence
6. **Use Browser DevTools**: Inspect elements to find better selectors
7. **Test Incrementally**: Build up working commands step by step

## Common Error Patterns and Solutions

### "Element not found"
- Try different selector strategies (id, css, xpath, text)
- Add wait conditions before interacting

### "Timeout exceeded"
- Increase wait times
- Add explicit waits for page loads
- Check if page is actually loading

### "Element not interactable"
- Wait for element to be visible/enabled
- Scroll element into view
- Check for overlapping elements

## Next Steps
1. Start by running the first command from your test using \`helpmetest_run_interactive_command\`
2. Work through each command, fixing issues as you encounter them
3. Build up a working sequence of commands
4. Update the original test with the corrected commands using \`helpmetest_modify_test\`

Remember: The goal is to get each command working individually, then combine them into a complete working test.`

  return prompt
}

/**
 * Generate health check integration prompt with container-specific guidance
 * @param {string} containerType - Type of container integration
 * @param {string} serviceName - Name of the service
 * @returns {string} Generated prompt text
 */
function generateHealthCheckIntegrationPrompt(containerType, serviceName) {
  let prompt = `# HelpMeTest Health Check Integration Guide

This guide helps you integrate HelpMeTest health checks into containers, pods, and devspace files.

## Overview

HelpMeTest health checks provide comprehensive monitoring for your containerized applications. Unlike basic HTTP checks, HelpMeTest health checks can:

- Monitor complex workflows and business logic
- Track system performance metrics (CPU, memory, disk)
- Verify database connections and data integrity
- Ensure scheduled tasks complete successfully
- Check API endpoints with custom validation
- Monitor port availability and network connectivity

## Prerequisites

### 1. HelpMeTest CLI Installation
All containers must have the HelpMeTest CLI installed. Add this to your container:

\`\`\`bash
# Install HelpMeTest CLI
curl -fsSL https://helpmetest.com/install | bash
# Binary size: ~55MB (includes Bun runtime)

# Verify installation
helpmetest --version
\`\`\`

### 2. API Token Configuration
Set the \`HELPMETEST_API_TOKEN\` environment variable in your container:

\`\`\`bash
export HELPMETEST_API_TOKEN=your-token-here
\`\`\`

## Available MCP Tools

- \`helpmetest_add_health_check\`: Automatically add health checks to container files
- \`helpmetest_health_check\`: Test health check endpoints
- \`helpmetest_status\`: View current health check status

## Integration Examples

### Docker Health Checks

#### Dockerfile
\`\`\`dockerfile
FROM node:18-alpine

# Install HelpMeTest CLI
RUN curl -fsSL https://helpmetest.com/install | bash

# Copy application
COPY . /app
WORKDIR /app
RUN npm install

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD helpmetest health "docker-app" "1m" "GET localhost:3000/health"

CMD ["npm", "start"]
\`\`\`

#### Docker Compose
\`\`\`yaml
version: '3.8'
services:
  web:
    build: .
    environment:
      - HELPMETEST_API_TOKEN=\${HELPMETEST_API_TOKEN}
      - ENV=production
    healthcheck:
      test: ["CMD", "helpmetest", "health", "web-service", "1m", "GET", "localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
\`\`\`

### Kubernetes Health Checks

#### Pod with Probes
\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-app
spec:
  containers:
  - name: app
    image: myapp:latest
    env:
    - name: HELPMETEST_API_TOKEN
      valueFrom:
        secretKeyRef:
          name: helpmetest-secret
          key: api-token
    livenessProbe:
      exec:
        command:
        - /bin/sh
        - -c
        - helpmetest health "k8s-pod-\${HOSTNAME}" "2m" "GET localhost:8080/health"
      initialDelaySeconds: 30
      periodSeconds: 30
      timeoutSeconds: 10
      failureThreshold: 3
    readinessProbe:
      exec:
        command:
        - /bin/sh
        - -c
        - helpmetest health "k8s-ready-\${HOSTNAME}" "1m" "GET localhost:8080/ready"
      initialDelaySeconds: 5
      periodSeconds: 10
      timeoutSeconds: 5
\`\`\`

#### CronJob with Health Check
\`\`\`yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: data-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: backup-tool:latest
            env:
            - name: HELPMETEST_API_TOKEN
              valueFrom:
                secretKeyRef:
                  name: helpmetest-secret
                  key: api-token
            - name: ENV
              value: "production"
            command:
            - /bin/sh
            - -c
            - |
              # Run backup
              /usr/local/bin/backup-data.sh
              
              # Report success
              helpmetest health "k8s-backup-job" "25h"
          restartPolicy: OnFailure
\`\`\`

### DevSpace Health Checks

#### devspace.yaml
DevSpace uses Kubernetes-style probes in the Helm values, not hooks:

\`\`\`yaml
version: v2beta1

deployments:
  app:
    helm:
      values:
        containers:
          - image: \${REGISTRY}/myapp
            livenessProbe:
              exec:
                command:
                  - helpmetest
                  - health
                  - "myapp"
                  - "1m"
                  - "GET localhost:3000/health"
              failureThreshold: 3
              periodSeconds: 30
              timeoutSeconds: 10
            readinessProbe:
              exec:
                command:
                  - helpmetest
                  - health
                  - "myapp"
                  - "1m"
                  - "GET localhost:3000/health"
              initialDelaySeconds: 5
              periodSeconds: 10
              timeoutSeconds: 10
              failureThreshold: 2
            envFrom:
              - secretRef:
                  name: app-secrets
\`\`\`

## Health Check Command Syntax

### Basic Syntax
\`\`\`bash
helpmetest health <name> <grace_period> [command]
\`\`\`

### ⚠️ IMPORTANT: Infer Health Check Command from Container Purpose

**Always analyze the container's CMD/ENTRYPOINT to determine the appropriate health check:**

#### Web Servers/APIs
\`\`\`bash
# For Node.js apps (typically port 3000)
helpmetest health "web-app" "1m" "GET localhost:3000/health"

# For Python Flask/FastAPI (typically port 5000 or 8000)
helpmetest health "api-service" "1m" "GET localhost:8000/health"

# For Nginx (port 80)
helpmetest health "nginx" "30s" "GET localhost:80/health"

# If no /health endpoint exists, check root
helpmetest health "web-server" "30s" "GET localhost:3000/"
\`\`\`

#### Database Containers
\`\`\`bash
# PostgreSQL (port 5432)
helpmetest health "postgres" "2m" "psql -h localhost -p 5432 -U postgres -c 'SELECT 1'"

# MySQL (port 3306)
helpmetest health "mysql" "2m" "mysql -h localhost -P 3306 -u root -e 'SELECT 1'"

# Redis (port 6379)
helpmetest health "redis" "1m" "redis-cli -h localhost -p 6379 ping"

# MongoDB (port 27017)
helpmetest health "mongo" "2m" "mongosh --host localhost:27017 --eval 'db.runCommand({ping: 1})'"
\`\`\`

#### Message Queues
\`\`\`bash
# Kafka (port 9092)
helpmetest health "kafka" "2m" ":9092"

# RabbitMQ (port 5672, management on 15672)
helpmetest health "rabbitmq" "1m" "GET localhost:15672/api/overview"
\`\`\`

#### Utility/Debug Containers
\`\`\`bash
# Containers that just sleep or provide tools
helpmetest health "debug-container" "1m" "echo 'Container is responsive'"

# Cron containers
helpmetest health "cron-jobs" "5m" "ps aux | grep cron"
\`\`\`

### Command Analysis Examples

**Example 1: Web Application**
\`\`\`dockerfile
CMD ["node", "server.js"]
# Likely runs on port 3000, check for /health or /
HEALTHCHECK CMD helpmetest health "web-app" "1m" "GET localhost:3000/health"
\`\`\`

**Example 2: Database**
\`\`\`dockerfile
CMD ["postgres"]
# PostgreSQL database, use psql to check connection
HEALTHCHECK CMD helpmetest health "postgres" "2m" "psql -h localhost -c 'SELECT 1'"
\`\`\`

**Example 3: Sleep/Debug Container**
\`\`\`dockerfile
CMD ["sleep", "infinity"]
# Just sleeping, check basic responsiveness
HEALTHCHECK CMD helpmetest health "debug" "1m" "echo 'Container alive'"
\`\`\`

### HTTP Health Checks
\`\`\`bash
# Check HTTP endpoint
helpmetest health "api-health" "1m" "GET /health"

# Check specific host:port
helpmetest health "api-check" "1m" "GET 127.0.0.1:3000/health"

# Check full URL
helpmetest health "auth-service" "30s" "GET https://api.test.helpmetest.com/health"
\`\`\`

### Port Availability Checks
\`\`\`bash
# Check if port 3000 is available
helpmetest health "port-3000" "1m" ":3000"
\`\`\`

### Command Execution Checks
\`\`\`bash
# Database connection check
helpmetest health "postgres-check" "5m" "psql -h localhost -c '\\l'"

# Conditional execution (only sends success heartbeat if command succeeds)
psql postgres://user:pass@localhost/db -c "SELECT 1;" && helpmetest health "db-connection" "2m"
\`\`\`

### Cron Job Monitoring
\`\`\`bash
# Daily database backup (runs at 2 AM, grace period of 25 hours)
0 2 * * * /usr/local/bin/helpmetest health "daily-db-backup" "25h" "backup-database.sh"

# Hourly log processing (grace period of 75 minutes)
0 * * * * /usr/local/bin/helpmetest health "log-processing" "75m" "process-logs.sh"

# Data synchronization every 15 minutes
*/15 * * * * /usr/local/bin/helpmetest health "data-sync" "20m" "sync-data.sh"
\`\`\`

## Environment Variables

### Required
- \`HELPMETEST_API_TOKEN\`: Your HelpMeTest API token

### Optional
- \`ENV\`: Environment identifier (dev, staging, prod)
- \`HELPMETEST_*\`: Custom data (any env var starting with HELPMETEST_)

## Best Practices

### Grace Periods
- **Web services**: 1-2 minutes
- **Databases**: 2-5 minutes
- **Batch jobs**: 20-30% longer than expected execution time
- **Microservices**: 30 seconds to 1 minute
- **Cron jobs**: Use grace periods 20-30% longer than expected execution time

### Health Check Intervals
- **Docker**: 30s interval, 10s timeout
- **Kubernetes**: 30s liveness, 10s readiness
- **Production**: Longer intervals to reduce load
- **Development**: Shorter intervals for faster feedback

### Readiness Probes in Kubernetes
**Important**: If your Kubernetes service is not exposed through a Service resource (no service.ports defined), you typically don't need readiness probes. Readiness probes are primarily used to control traffic routing to pods through Services.

- **Services with traffic**: Always include both liveness and readiness probes
- **Background jobs/workers**: Usually only need liveness probes
- **Batch jobs/CronJobs**: Typically don't need readiness probes
- **Internal utilities**: May only need liveness probes if not receiving traffic

### Naming Conventions
- Include environment: \`web-prod\`, \`api-staging\`
- Include instance info: \`web-\${HOSTNAME}\`, \`api-pod-\${POD_NAME}\`
- Be descriptive: \`user-service-health\`, \`payment-api-ready\`

### Multi-Environment Setup
\`\`\`bash
# Production environment
ENV=production HELPMETEST_CLUSTER=prod-us-east-1 helpmetest health "web-app" "1m"

# Staging environment
ENV=staging HELPMETEST_CLUSTER=staging-us-west-2 helpmetest health "web-app" "5m"

# Development environment
ENV=dev HELPMETEST_CLUSTER=dev-local helpmetest health "web-app" "10m"
\`\`\`

## Troubleshooting

### Common Issues
1. **Missing CLI**: Ensure HelpMeTest CLI is installed in container
2. **Missing Token**: Set HELPMETEST_API_TOKEN environment variable
3. **Network Issues**: Check if health check endpoint is accessible
4. **Timeout Issues**: Adjust grace periods and timeouts appropriately

### Debug Commands
\`\`\`bash
# Test health check manually
helpmetest health "test-check" "1m" "GET localhost:3000/health"

# Check status
helpmetest status

# View logs (if available)
docker logs <container-name>
kubectl logs <pod-name>
\`\`\`

## Security Considerations

### API Token Management
- Use secrets management (Kubernetes Secrets, Docker Secrets)
- Never hardcode tokens in images
- Rotate tokens regularly
- Use environment-specific tokens

### Network Security
- Health checks run inside containers
- No external network access required for basic checks
- Use internal service names in Kubernetes
- Consider firewall rules for external health checks`

  if (containerType) {
    prompt += `\n\n## Specific Guidance for ${containerType.toUpperCase()} Integration\n`
    
    switch (containerType.toLowerCase()) {
      case 'docker':
        prompt += `### Docker-Specific Instructions

1. **Install CLI in Dockerfile**:
   \`\`\`dockerfile
   RUN curl -fsSL https://helpmetest.com/install | bash
   \`\`\`

2. **Add HEALTHCHECK instruction**:
   \`\`\`dockerfile
   HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
       CMD helpmetest health "${serviceName || 'docker-app'}" "1m" "GET localhost:3000/health"
   \`\`\`

3. **Set environment variables**:
   \`\`\`bash
   docker run -e HELPMETEST_API_TOKEN=your-token myapp
   \`\`\`

**Use the tool**: \`helpmetest_add_health_check\` with your Dockerfile path to automatically add these configurations.`
        break
      case 'kubernetes':
      case 'k8s':
        prompt += `### Kubernetes-Specific Instructions

1. **Create API Token Secret**:
   \`\`\`yaml
   apiVersion: v1
   kind: Secret
   metadata:
     name: helpmetest-secret
   type: Opaque
   data:
     api-token: <base64-encoded-token>
   \`\`\`

2. **Add probes to container spec**:
   \`\`\`yaml
   livenessProbe:
     exec:
       command:
       - /bin/sh
       - -c
       - helpmetest health "${serviceName || 'k8s-app'}-live-$(hostname)" "2m" "GET localhost:8080/health"
     initialDelaySeconds: 60
     periodSeconds: 30
   \`\`\`

3. **Reference secret in env**:
   \`\`\`yaml
   env:
   - name: HELPMETEST_API_TOKEN
     valueFrom:
       secretKeyRef:
         name: helpmetest-secret
         key: api-token
   \`\`\`

**Use the tool**: \`helpmetest_add_health_check\` with your Kubernetes manifest path to automatically add these configurations.`
        break
      case 'devspace':
        prompt += `### DevSpace-Specific Instructions

1. **Add health check hook**:
   \`\`\`yaml
   hooks:
     - name: health-check
       command: |
         helpmetest health "${serviceName || 'devspace-app'}" "2m" "GET localhost:3000/health"
       events: ["after:deploy"]
   \`\`\`

2. **Ensure CLI is available in dev container**:
   \`\`\`yaml
   dev:
     app:
       container: app
       command: ["sh"]
       workingDir: /app
   \`\`\`

3. **Set environment in devspace config**:
   \`\`\`yaml
   vars:
     HELPMETEST_API_TOKEN: your-token
   \`\`\`

**Use the tool**: \`helpmetest_add_health_check\` with your devspace.yaml path to automatically add these configurations.`
        break
      case 'docker-compose':
        prompt += `### Docker Compose-Specific Instructions

1. **Add healthcheck to service**:
   \`\`\`yaml
   services:
     ${serviceName || 'app'}:
       build: .
       environment:
         - HELPMETEST_API_TOKEN=\${HELPMETEST_API_TOKEN}
       healthcheck:
         test: ["CMD", "helpmetest", "health", "${serviceName || 'compose-app'}", "1m", "GET", "localhost:3000/health"]
         interval: 30s
         timeout: 10s
         retries: 3
         start_period: 40s
   \`\`\`

2. **Use environment file**:
   \`\`\`bash
   # .env file
   HELPMETEST_API_TOKEN=your-token-here
   \`\`\`

**Use the tool**: \`helpmetest_add_health_check\` with your docker-compose.yml path to automatically add these configurations.`
        break
    }
  }

  if (serviceName) {
    prompt += `\n\n## Service-Specific Configuration: ${serviceName}

### Recommended Health Check Names
- \`${serviceName}-health\`: Basic health check
- \`${serviceName}-ready\`: Readiness check
- \`${serviceName}-live\`: Liveness check
- \`${serviceName}-\${ENV}\`: Environment-specific check

### Example Commands for ${serviceName}
\`\`\`bash
# Basic health check
helpmetest health "${serviceName}-health" "1m" "GET localhost:3000/health"

# With environment
ENV=production helpmetest health "${serviceName}-prod" "1m" "GET localhost:3000/health"

# Database check (if applicable)
helpmetest health "${serviceName}-db" "2m" "psql -h localhost -c 'SELECT 1'"

# Port check
helpmetest health "${serviceName}-port" "30s" ":3000"
\`\`\`

### Monitoring Dashboard
After setup, monitor your service at: https://helpmetest.com/dashboard`
  }

  prompt += `\n\n## Next Steps

1. **Choose Integration Method**: Select Docker, Kubernetes, or DevSpace
2. **Use Automation Tool**: Run \`helpmetest_add_health_check\` with your file path
3. **Configure Environment**: Set HELPMETEST_API_TOKEN appropriately
4. **Test Integration**: Deploy and verify health checks are working
5. **Monitor Results**: Check the HelpMeTest dashboard for status

## Quick Start Commands

### Automatic Integration
\`\`\`bash
# For Dockerfile
helpmetest_add_health_check({
  filePath: "./Dockerfile",
  serviceName: "${serviceName || 'my-service'}",
  healthCheckUrl: "localhost:3000/health"
})

# For docker-compose.yml
helpmetest_add_health_check({
  filePath: "./docker-compose.yml",
  serviceName: "${serviceName || 'web'}",
  healthCheckUrl: "localhost:3000/health"
})

# For Kubernetes manifest
helpmetest_add_health_check({
  filePath: "./k8s-deployment.yaml",
  serviceName: "${serviceName || 'app'}",
  healthCheckUrl: "localhost:8080/health"
})
\`\`\`

### Manual Testing
\`\`\`bash
# Test health check endpoint
helpmetest_health_check({url: "http://localhost:3000/health"})

# Check current status
helpmetest_status()
\`\`\`

This integration ensures your containerized applications are properly monitored and can automatically recover from failures.`

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
 * Handle delete health check request
 * @param {Object} args - Tool arguments
 * @param {string} args.name - Name of the health check to delete
 * @returns {Object} Deletion result
 */
async function handleDeleteHealthCheck(args) {
  const { name } = args
  
  debug(config, `Deleting health check with name: ${name}`)
  
  try {
    // Delete the health check
    const result = await deleteHealthCheck(name)
    
    debug(config, `Health check deletion successful: ${name}, update ID: ${result.updateId}`)
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            name: name,
            updateId: result.updateId,
            message: `Health check '${name}' has been deleted. You can potentially undo this operation using the updateId.`,
            timestamp: new Date().toISOString()
          }),
        },
      ],
      isError: false,
    }
  } catch (error) {
    debug(config, `Health check deletion failed: ${error.message}`)
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            name,
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
 * Create user-friendly explanation for test run results
 * @param {Object} response - Test run response object
 * @param {string} identifier - Test identifier
 * @returns {string} User-friendly explanation
 */
function createTestRunExplanation(response, identifier) {
  const { success, testResults, keywords, totalEvents } = response
  
  let explanation = `## Test Execution Complete\n\n`
  explanation += `**Test Identifier:** ${identifier}\n`
  explanation += `**Status:** ${success ? '✅ PASSED' : '❌ FAILED'}\n`
  explanation += `**Total Events:** ${totalEvents}\n\n`
  
  if (testResults && testResults.length > 0) {
    explanation += `### Test Results:\n`
    testResults.forEach(result => {
      const statusIcon = result.status === 'PASS' ? '✅' : '❌'
      explanation += `- ${statusIcon} **${result.testId}** (${result.duration})\n`
      if (result.message) {
        explanation += `  ${result.message}\n`
      }
    })
    explanation += `\n`
  }
  
  if (keywords && keywords.length > 0) {
    explanation += `### Keywords Executed:\n`
    keywords.slice(0, 10).forEach(kw => {
      const statusIcon = kw.status === 'PASS' ? '✅' : kw.status === 'FAIL' ? '❌' : '⏸️'
      const duration = kw.duration ? ` (${kw.duration}s)` : ''
      explanation += `- ${statusIcon} ${kw.keyword}${duration}\n`
    })
    if (keywords.length > 10) {
      explanation += `... and ${keywords.length - 10} more keywords\n`
    }
    explanation += `\n`
  }
  
  if (!success) {
    explanation += `### What Happened:\n`
    explanation += `The test execution completed but some steps failed. Review the failed keywords above to understand what went wrong.\n\n`
    explanation += `### Next Steps:\n`
    explanation += `1. Use \`helpmetest_run_interactive_command\` to debug failing steps\n`
    explanation += `2. Fix the issues and run \`helpmetest_modify_test\` to update the test\n`
    explanation += `3. Re-run the test to verify the fixes\n\n`
  } else {
    explanation += `### What Happened:\n`
    explanation += `The test executed successfully! All keywords completed without errors.\n\n`
  }
  
  // Include raw data for debugging
  explanation += `### Raw Response Data:\n`
  explanation += `\`\`\`json\n${JSON.stringify(response, null, 2)}\`\`\`\n`
  
  return explanation
}

/**
 * Create user-friendly explanation for test creation results
 * @param {Object} response - Test creation response object
 * @returns {string} User-friendly explanation
 */
function createTestCreationExplanation(response) {
  const { success, id, name, testRunResult, testUrl, browserOpened } = response
  
  let explanation = `## Test Created Successfully! 🎉\n\n`
  explanation += `**Test Name:** ${name}\n`
  explanation += `**Test ID:** ${id}\n`
  explanation += `**Test URL:** ${testUrl}\n\n`
  
  if (testRunResult) {
    explanation += `### Automatic Test Run Results:\n`
    const statusIcon = testRunResult.status === 'PASS' ? '✅' : testRunResult.status === 'FAIL' ? '❌' : '⚠️'
    explanation += `**Status:** ${statusIcon} ${testRunResult.status}\n`
    
    if (testRunResult.testResults && testRunResult.testResults.length > 0) {
      explanation += `**Duration:** ${testRunResult.testResults[0].duration}\n`
    }
    
    if (testRunResult.keywords && testRunResult.keywords.length > 0) {
      explanation += `**Keywords Executed:** ${testRunResult.keywords.length}\n`
    }
    explanation += `\n`
    
    if (testRunResult.status === 'FAIL' || testRunResult.status === 'ERROR') {
      explanation += `### ⚠️ Test Failed on First Run\n`
      explanation += `This is normal for new tests. The test was created successfully, but it needs debugging.\n\n`
      explanation += `### Next Steps:\n`
      explanation += `1. Use \`helpmetest_run_interactive_command\` to debug the test step by step\n`
      explanation += `2. Fix any issues you find\n`
      explanation += `3. Use \`helpmetest_modify_test\` to update the test with working commands\n`
      explanation += `4. Re-run the test to verify it works\n\n`
    } else {
      explanation += `### ✅ Test Passed on First Run!\n`
      explanation += `Great! Your test is working correctly right away.\n\n`
    }
  }
  
  if (browserOpened) {
    explanation += `### Browser Access:\n`
    explanation += `✅ Test opened automatically in your browser\n\n`
  } else {
    explanation += `### Browser Access:\n`
    explanation += `⚠️ Could not automatically open browser. You can manually visit: ${testUrl}\n\n`
  }
  
  explanation += `### What Was Done:\n`
  explanation += `1. ✅ Created new test "${name}" with ID: ${id}\n`
  explanation += `2. ✅ Automatically ran the test to check if it works\n`
  explanation += `3. ${browserOpened ? '✅' : '⚠️'} ${browserOpened ? 'Opened' : 'Attempted to open'} test in browser\n`
  explanation += `4. ✅ Test is now available in your HelpMeTest dashboard\n\n`
  
  // Include raw data for debugging
  explanation += `### Raw Response Data:\n`
  explanation += `\`\`\`json\n${JSON.stringify(response, null, 2)}\`\`\`\n`
  
  return explanation
}

/**
 * Create user-friendly explanation for test modification results
 * @param {Object} response - Test modification response object
 * @returns {string} User-friendly explanation
 */
function createTestModificationExplanation(response) {
  const { success, id, name, testRunResult, testUrl, browserOpened, changes } = response
  
  let explanation = `## Test Modified Successfully! 🔄\n\n`
  explanation += `**Test Name:** ${name}\n`
  explanation += `**Test ID:** ${id}\n`
  explanation += `**Test URL:** ${testUrl}\n\n`
  
  if (changes) {
    explanation += `### Changes Made:\n`
    if (changes.name) {
      explanation += `- **Name:** "${changes.name.from}" → "${changes.name.to}"\n`
    }
    if (changes.description) {
      explanation += `- **Description:** Updated\n`
    }
    if (changes.tags) {
      explanation += `- **Tags:** [${changes.tags.from.join(', ')}] → [${changes.tags.to.join(', ')}]\n`
    }
    if (changes.testData) {
      explanation += `- **Test Data:** ✅ Updated with new Robot Framework commands\n`
    }
    explanation += `\n`
  }
  
  if (testRunResult) {
    explanation += `### Automatic Test Run Results:\n`
    const statusIcon = testRunResult.status === 'PASS' ? '✅' : testRunResult.status === 'FAIL' ? '❌' : '⚠️'
    explanation += `**Status:** ${statusIcon} ${testRunResult.status}\n`
    
    if (testRunResult.testResults && testRunResult.testResults.length > 0) {
      explanation += `**Duration:** ${testRunResult.testResults[0].duration}\n`
    }
    
    if (testRunResult.keywords && testRunResult.keywords.length > 0) {
      explanation += `**Keywords Executed:** ${testRunResult.keywords.length}\n`
    }
    explanation += `\n`
    
    if (testRunResult.status === 'FAIL' || testRunResult.status === 'ERROR') {
      explanation += `### ⚠️ Modified Test Still Has Issues\n`
      explanation += `The test was updated successfully, but it's still failing. This might need more debugging.\n\n`
      explanation += `### Next Steps:\n`
      explanation += `1. Use \`helpmetest_run_interactive_command\` to debug the remaining issues\n`
      explanation += `2. Fix any problems you find\n`
      explanation += `3. Use \`helpmetest_modify_test\` again to apply more fixes\n`
      explanation += `4. Repeat until the test passes\n\n`
    } else {
      explanation += `### ✅ Modified Test Now Passes!\n`
      explanation += `Excellent! Your changes fixed the test and it's now working correctly.\n\n`
    }
  }
  
  if (browserOpened) {
    explanation += `### Browser Access:\n`
    explanation += `✅ Modified test opened automatically in your browser\n\n`
  } else {
    explanation += `### Browser Access:\n`
    explanation += `⚠️ Could not automatically open browser. You can manually visit: ${testUrl}\n\n`
  }
  
  explanation += `### What Was Done:\n`
  explanation += `1. ✅ Modified test "${name}" (ID: ${id})\n`
  explanation += `2. ✅ Automatically ran the modified test to check if it works\n`
  explanation += `3. ${browserOpened ? '✅' : '⚠️'} ${browserOpened ? 'Opened' : 'Attempted to open'} test in browser\n`
  explanation += `4. ✅ Changes are now live in your HelpMeTest dashboard\n\n`
  
  // Include raw data for debugging
  explanation += `### Raw Response Data:\n`
  explanation += `\`\`\`json\n${JSON.stringify(response, null, 2)}\`\`\`\n`
  
  return explanation
}

/**
 * Create user-friendly explanation for interactive command results
 * @param {Object} commandResult - Interactive command result object
 * @returns {string} User-friendly explanation
 */
function createInteractiveCommandExplanation(commandResult) {
  const { command, result, success } = commandResult
  
  let explanation = `## Interactive Command Executed\n\n`
  explanation += `**Command:** \`${command}\`\n`
  explanation += `**Status:** ${success ? '✅ SUCCESS' : '❌ FAILED'}\n\n`
  
  if (command.trim() === 'Exit') {
    explanation += `### Session Ended\n`
    explanation += `The interactive debugging session has been closed. You can start a new session anytime by running another \`helpmetest_run_interactive_command\`.\n\n`
  } else {
    explanation += `### What Happened:\n`
    if (success) {
      explanation += `The Robot Framework command executed successfully in the interactive browser session.\n\n`
      
      // Provide context-specific guidance based on command type
      if (command.toLowerCase().includes('go to')) {
        explanation += `### Next Steps:\n`
        explanation += `- The browser navigated to the specified URL\n`
        explanation += `- You can now interact with elements on the page\n`
        explanation += `- Try commands like \`Click\`, \`Type\`, or \`Get Text\` to continue testing\n\n`
      } else if (command.toLowerCase().includes('click')) {
        explanation += `### Next Steps:\n`
        explanation += `- The click action was performed successfully\n`
        explanation += `- Check if the page changed as expected\n`
        explanation += `- You might want to add a wait or verification step next\n\n`
      } else if (command.toLowerCase().includes('type') || command.toLowerCase().includes('fill')) {
        explanation += `### Next Steps:\n`
        explanation += `- Text was entered into the specified field\n`
        explanation += `- You might want to submit the form or click a button next\n`
        explanation += `- Consider adding verification to check the input was accepted\n\n`
      } else if (command.toLowerCase().includes('should') || command.toLowerCase().includes('get')) {
        explanation += `### Next Steps:\n`
        explanation += `- The verification/retrieval command completed successfully\n`
        explanation += `- Check the result to see if it matches your expectations\n`
        explanation += `- Continue with the next step in your test scenario\n\n`
      }
      
      explanation += `### Continue Testing:\n`
      explanation += `- Run more \`helpmetest_run_interactive_command\` calls to build up your test\n`
      explanation += `- Once you have a working sequence, use \`helpmetest_modify_test\` to update your test\n`
      explanation += `- Use \`Exit\` command when you're done with this session\n\n`
    } else {
      explanation += `The command failed to execute. This could be due to:\n`
      explanation += `- Element not found (try different selectors)\n`
      explanation += `- Timing issues (add wait commands)\n`
      explanation += `- Page not loaded (check current page state)\n`
      explanation += `- Incorrect syntax (verify Robot Framework syntax)\n\n`
      
      explanation += `### Debugging Tips:\n`
      explanation += `1. Try \`Take Screenshot\` to see the current page state\n`
      explanation += `2. Use \`Get Title\` or \`Get Url\` to verify page location\n`
      explanation += `3. Try different selector strategies (css, xpath, text)\n`
      explanation += `4. Add wait commands like \`Sleep  2s\` before retrying\n\n`
    }
  }
  
  // Include raw result data
  if (result) {
    explanation += `### Command Result:\n`
    explanation += `\`\`\`json\n${JSON.stringify(result, null, 2)}\`\`\`\n\n`
  }
  
  // Include raw data for debugging
  explanation += `### Raw Response Data:\n`
  explanation += `\`\`\`json\n${JSON.stringify(commandResult, null, 2)}\`\`\`\n`
  
  return explanation
}

/**
 * Utility object for convenience
 */
export const mcpUtils = {
  createServer: createMcpServer,
  startStdio: startStdioServer,
  startHttp: startHttpServer,
}