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

    const emoji = result.success ? '✅' : '❌'
    const statusText = result.statusText || 'N/A'
    const responseTime = result.elapsedTime ? `${result.elapsedTime}ms` : 'N/A'

    let output = `${emoji} **${url}**

- Status: ${result.status || 'N/A'} ${statusText}
- Response Time: ${responseTime}
- Healthy: ${result.success ? 'Yes' : 'No'}
- Checked: ${new Date().toLocaleString()}`

    if (result.error) {
      output += `\n- Error: ${result.error}`
    }

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
      isError: !result.success,
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ **${url}**

- Healthy: No
- Error: ${error.message}
- Checked: ${new Date().toLocaleString()}`,
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
            text: `# 🏥 Health Checks

No health checks found. This could mean:
- The API returned an empty list
- No health checks are configured yet
- There may be an authentication issue`,
          },
        ],
      }
    }

    // Format as simple list
    const upCount = healthChecks.filter(hc => hc.status?.toLowerCase() === 'up').length
    const downCount = healthChecks.filter(hc => hc.status?.toLowerCase() === 'down').length
    const unknownCount = healthChecks.length - upCount - downCount

    let output = `# 🏥 Health Checks: ${upCount}✅ ${downCount}❌ ${unknownCount}⚠️ (${healthChecks.length} total)

`

    for (const check of healthChecks) {
      const emoji = check.status?.toLowerCase() === 'up' ? '✅' : check.status?.toLowerCase() === 'down' ? '❌' : '⚠️'
      const lastHeartbeat = check.lastHeartbeat ? new Date(check.lastHeartbeat).toLocaleString() : 'Never'
      output += `${emoji} **${check.name}** - Last: ${lastHeartbeat}\n`
    }

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
    }
  } catch (error) {
    debug(config, `Error getting health checks: ${error.message}`)

    return {
      content: [
        {
          type: 'text',
          text: `❌ **Error Getting Health Checks**

**Message:** ${error.message}
**Type:** ${error.name || 'Error'}

Check your API connection and credentials.`,
        },
      ],
      isError: true,
    }
  }
}

/**
 * Format healthchecks as markdown table
 * @param {Array} healthchecks - Array of healthcheck objects
 * @param {Object} options - Formatting options
 * @returns {string} Formatted markdown table
 */
export function formatHealthchecksAsTable(healthchecks, options = {}) {
  const { includeHeader = true } = options

  const upChecks = healthchecks.filter(hc => hc.status === 'up')
  const downChecks = healthchecks.filter(hc => hc.status === 'down')
  const unknownChecks = healthchecks.filter(hc => hc.status !== 'up' && hc.status !== 'down')

  let output = ''

  if (includeHeader) {
    output = `## 🏥 Health Checks: ${upChecks.length}✅ ${downChecks.length}❌ ${unknownChecks.length}⚠️ (${healthchecks.length} total)

`
  }

  output += `| Status | Name | Last Heartbeat | Grace Period | Tags |
|--------|------|----------------|--------------|------|
`

  // Down checks first (most important)
  for (const hc of downChecks) {
    const tags = hc.tags && hc.tags.length > 0 ? hc.tags.join(', ') : '-'
    const lastHeartbeat = hc.lastHeartbeat ? new Date(hc.lastHeartbeat).toLocaleString() : 'Never'
    const gracePeriod = hc.gracePeriod || '-'
    output += `| ❌ | ${hc.name} | ${lastHeartbeat} | ${gracePeriod} | ${tags} |\n`
  }

  // Up checks
  for (const hc of upChecks) {
    const tags = hc.tags && hc.tags.length > 0 ? hc.tags.join(', ') : '-'
    const lastHeartbeat = hc.lastHeartbeat ? new Date(hc.lastHeartbeat).toLocaleString() : 'Never'
    const gracePeriod = hc.gracePeriod || '-'
    output += `| ✅ | ${hc.name} | ${lastHeartbeat} | ${gracePeriod} | ${tags} |\n`
  }

  // Unknown checks
  for (const hc of unknownChecks) {
    const tags = hc.tags && hc.tags.length > 0 ? hc.tags.join(', ') : '-'
    const lastHeartbeat = hc.lastHeartbeat ? new Date(hc.lastHeartbeat).toLocaleString() : 'Never'
    const gracePeriod = hc.gracePeriod || '-'
    output += `| ⚠️ | ${hc.name} | ${lastHeartbeat} | ${gracePeriod} | ${tags} |\n`
  }

  return output
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

    const output = `# 🏥 Health Check Status Report

${formatHealthchecksAsTable(filteredData.healthchecks, { includeHeader: false })}
💡 Focus on ❌ down services - they need immediate attention`

    return {
      content: [
        {
          type: 'text',
          text: output,
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
          text: `❌ **Error Getting Health Status**

**Message:** ${error.message}
**Type:** ${error.name || 'Error'}

**Debug Information:**
\`\`\`json
${JSON.stringify(errorResponse.debug, null, 2)}
\`\`\``,
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
  // Note: Health check status methods have been consolidated into helpmetest_status
  // See status.js for the unified status method with options:
  // - healthOnly: true - to get only health checks
  // - verbose: true - for additional metadata
}