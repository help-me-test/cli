/**
 * Health Check MCP Tools
 * Provides health monitoring tools for the helpmetest system
 */

import { z } from 'zod'
import { config, debug } from '../utils/config.js'
import { performHttpHealthCheck } from '../commands/health.js'
import { getAllHealthChecks } from '../utils/api.js'
import { getFormattedStatusData } from '../utils/status-data.js'
import { TOOL_CONFIGS } from '../utils/mcp-config.js'

/**
 * Handle single health check tool call
 * @param {Object} args - Tool arguments
 * @param {string} args.url - URL to check
 * @param {number} [args.timeout] - Timeout in seconds
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
    
    const errorResponse = {
      error: true,
      message: error.message,
      type: error.name || 'Error',
      timestamp: new Date().toISOString(),
      debug: {
        apiUrl: config.apiBaseUrl,
        hasToken: !!config.apiToken
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
 * Handle health status tool call (focused on health checks only)
 * @param {Object} args - Tool arguments
 * @param {boolean} [args.verbose] - Enable verbose output
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
          text: `🏥 HelpMeTest Health Checks Status

Raw Health Check Data:
\`\`\`json
${JSON.stringify(filteredData, null, 2)}
\`\`\`

🚨 CRITICAL AI INSTRUCTION: 
1. CAREFULLY analyze the raw health check data above
2. BE HONEST about health check statuses - don't assume services are up
3. Look for actual status indicators like "up"/"down" in the data
4. Focus on what the data actually shows, not assumptions

### Analysis Requirements:
1. Count total health checks accurately from the data
2. Check actual status fields for each health check
3. Identify any failing/down health checks specifically by name
4. Report any issues that need immediate attention
5. Provide honest assessment of system health

The raw data contains all the information you need - analyze it carefully and be honest about what you find.`,
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
 * Register health-related MCP tools
 * @param {Object} server - MCP server instance
 */
export function registerHealthTools(server) {
  // Register health_check tool
  server.registerTool(
    'helpmetest_health_check',
    {
      title: 'Help Me Test: Health Check Tool',
      description: `Perform a health check on a specified URL

🚨 INSTRUCTION FOR AI: When using this tool, ALWAYS explain to the user which URL you're checking and why. After getting results, describe whether the health check passed or failed and what that means. Don't just say "Done".`,
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

  // Register status_health tool
  server.registerTool(
    'helpmetest_status_health',
    {
      title: 'Help Me Test: Health Status Tool',
      description: `Get status of all health checks in the helpmetest system. When verbose=true, includes additional healthcheck metadata and heartbeat data.

🚨 INSTRUCTION FOR AI: When using this tool, ALWAYS explain to the user what you're checking. After getting results, summarize the health check statuses in plain language - tell them which services are up/down, any issues found, etc. Don't just say "Done".`,
      inputSchema: {
        verbose: z.boolean().optional().default(false).describe('Enable verbose output with additional healthcheck metadata, heartbeat data, and debug information'),
      },
    },
    async (args) => {
      debug(config, `Health status tool called with args: ${JSON.stringify(args)}`)
      return await handleHealthStatus(args)
    }
  )
}