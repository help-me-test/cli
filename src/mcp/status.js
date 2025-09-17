/**
 * Status MCP Tools
 * Provides comprehensive status and monitoring tools for the helpmetest system
 */

import { z } from 'zod'
import { config, debug } from '../utils/config.js'
import { getTestRuns } from '../utils/api.js'
import { getFormattedStatusData } from '../utils/status-data.js'

/**
 * Handle comprehensive status tool call
 * @param {Object} args - Tool arguments
 * @param {boolean} [args.verbose] - Enable verbose output
 * @returns {Object} Comprehensive status result
 */
async function handleStatus(args) {
  const { verbose = false } = args
  
  debug(config, 'Getting comprehensive status for MCP client')
  
  try {
    const statusData = await getFormattedStatusData({ verbose })
    
    debug(config, `Retrieved status data: ${statusData.tests.length} tests, ${statusData.healthchecks.length} healthchecks`)
    
    return {
      content: [
        {
          type: 'text',
          text: `🔍 HelpMeTest Complete System Status

Raw Status Data:
\`\`\`json
${JSON.stringify(statusData, null, 2)}
\`\`\`

🚨 CRITICAL AI INSTRUCTION: 
1. CAREFULLY analyze the raw status data above
2. BE HONEST about system health - don't assume everything is working
3. Look for actual status indicators in both tests and health checks
4. Focus on what the data actually shows, not assumptions

### Analysis Requirements:
1. **Tests**: Count total tests, check recent run statuses (PASS/FAIL), identify failing tests
2. **Health Checks**: Count total health checks, check status fields (up/down), identify failing services
3. **Overall Health**: Provide honest assessment of system health
4. **Issues**: Report any problems that need immediate attention
5. **Trends**: Note any patterns in failures or system degradation

### Key Findings to Report:
- Total tests and how many are passing/failing
- Total health checks and how many are up/down
- Any critical issues requiring immediate attention
- System health summary (healthy/degraded/failing)

The raw data contains all the information you need - analyze it carefully and be honest about what you find.`,
        },
      ],
    }
  } catch (error) {
    debug(config, `Error getting comprehensive status: ${error.message}`)
    
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
 * Handle test runs tool call
 * @param {Object} args - Tool arguments
 * @param {Array<string>} [args.tests] - Array of test IDs to filter by
 * @param {Array<string>} [args.status] - Array of statuses to filter by
 * @param {string} [args.startDate] - Start date for filtering (ISO format)
 * @param {string} [args.endDate] - End date for filtering (ISO format)
 * @param {number} [args.limit] - Maximum number of results to return
 * @returns {Object} Test runs result
 */
async function handleTestRuns(args) {
  const { tests, status, startDate, endDate, limit = 50 } = args
  
  debug(config, `Getting test runs with filters: ${JSON.stringify(args)}`)
  
  try {
    const testRuns = await getTestRuns({
      tests,
      status,
      startDate,
      endDate,
      limit
    })
    
    debug(config, `Retrieved ${testRuns?.length || 0} test runs`)
    
    if (!testRuns?.length) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              total: 0,
              runs: [],
              message: 'No test runs found with the specified filters',
              filters: { tests, status, startDate, endDate, limit },
              debug: {
                apiUrl: config.apiBaseUrl,
                hasToken: !!config.apiToken
              }
            }),
          },
        ],
      }
    }

    // Format runs for analysis
    const formattedRuns = testRuns.map(run => ({
      id: run.id,
      testId: run.testId,
      testName: run.testName,
      status: run.status,
      startTime: run.startTime,
      endTime: run.endTime,
      duration: run.duration,
      errorMessage: run.errorMessage || null,
      tags: run.tags || []
    }))

    // Calculate summary statistics
    const statusCounts = formattedRuns.reduce((acc, run) => {
      acc[run.status] = (acc[run.status] || 0) + 1
      return acc
    }, {})

    const summary = {
      total: formattedRuns.length,
      statusBreakdown: statusCounts,
      filters: { tests, status, startDate, endDate, limit },
      timestamp: new Date().toISOString()
    }

    return {
      content: [
        {
          type: 'text',
          text: `🏃 Test Runs Analysis

**Summary:**
- Total runs: ${summary.total}
- Status breakdown: ${Object.entries(statusCounts).map(([status, count]) => `${status}: ${count}`).join(', ')}

**Applied Filters:**
${tests ? `- Tests: ${tests.join(', ')}` : ''}
${status ? `- Status: ${status.join(', ')}` : ''}
${startDate ? `- Start Date: ${startDate}` : ''}
${endDate ? `- End Date: ${endDate}` : ''}
- Limit: ${limit}

**Raw Test Runs Data:**
\`\`\`json
${JSON.stringify({ summary, runs: formattedRuns }, null, 2)}
\`\`\`

🚨 CRITICAL AI INSTRUCTION:
1. CAREFULLY analyze the test runs data above
2. Look for patterns in test failures and success rates
3. Identify any tests that are consistently failing
4. Check for recent trend changes in test reliability
5. Be honest about test execution health

### Analysis Requirements:
1. Identify failing test runs and their error messages
2. Calculate success/failure rates over time
3. Spot any tests that need immediate attention
4. Report on overall test execution health
5. Suggest debugging steps for failing tests

The raw data contains detailed information about each test run - use it to provide meaningful insights.`,
        },
      ],
    }
  } catch (error) {
    debug(config, `Error getting test runs: ${error.message}`)
    
    const errorResponse = {
      error: true,
      message: error.message,
      type: error.name || 'Error',
      timestamp: new Date().toISOString(),
      filters: { tests, status, startDate, endDate, limit },
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
 * Register status-related MCP tools
 * @param {Object} server - MCP server instance
 */
export function registerStatusTools(server) {
  // Register comprehensive status tool
  server.registerTool(
    'helpmetest_status',
    {
      title: 'Help Me Test: Complete Status Tool',
      description: `Get comprehensive status of all tests and health checks in the helpmetest system. When verbose=true, includes full test content and additional healthcheck data.

🚨 INSTRUCTION FOR AI: When using this tool, ALWAYS explain to the user what you're checking and why. After getting results, summarize the key findings in plain language - don't just say "Done". Tell the user about test statuses, any failures, health check issues, etc.`,
      inputSchema: {
        verbose: z.boolean().optional().default(false).describe('Enable verbose output with test content, descriptions, and additional debug information'),
      },
    },
    async (args) => {
      debug(config, `Status tool called with args: ${JSON.stringify(args)}`)
      return await handleStatus(args)
    }
  )

  // Register test runs tool
  server.registerTool(
    'helpmetest_get_test_runs',
    {
      title: 'Help Me Test: Get Test Runs Tool',
      description: 'Retrieve test run statuses with filtered error messages from the record data. Returns test runs with their status and any error messages that occurred during execution. Useful for analyzing test failures and debugging issues.',
      inputSchema: {
        tests: z.array(z.string()).optional().describe('Array of test IDs to filter by (optional)'),
        status: z.array(z.string()).optional().describe('Array of statuses to filter by (optional, e.g., ["FAIL", "PASS"])'),
        startDate: z.string().optional().describe('Start date for filtering (ISO format, optional)'),
        endDate: z.string().optional().describe('End date for filtering (ISO format, optional)'),
        limit: z.number().optional().default(50).describe('Maximum number of results to return (default: 50, max: 1000)'),
      },
    },
    async (args) => {
      debug(config, `Test runs tool called with args: ${JSON.stringify(args)}`)
      return await handleTestRuns(args)
    }
  )
}