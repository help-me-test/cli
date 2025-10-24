/**
 * Status MCP Tools
 * Provides comprehensive status and monitoring tools for the helpmetest system
 */

import { z } from 'zod'
import { config, debug } from '../utils/config.js'
import { getTestRuns, getDeployments } from '../utils/api.js'
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
 * Handle deployments tool call
 * @param {Object} args - Tool arguments
 * @param {string} [args.startDate] - Start date for filtering (ISO format)
 * @param {number} [args.limit] - Maximum number of results to return
 * @returns {Object} Deployments result
 */
async function handleDeployments(args) {
  const { startDate, limit = 1000 } = args

  debug(config, `Getting deployments with filters: ${JSON.stringify(args)}`)

  try {
    const timestamp = startDate ? new Date(startDate) : new Date()
    const deployments = await getDeployments(timestamp, limit)

    debug(config, `Retrieved ${deployments?.length || 0} deployments`)

    if (!deployments?.length) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              total: 0,
              deployments: [],
              message: 'No deployments found',
              filters: { startDate, limit },
              debug: {
                apiUrl: config.apiBaseUrl,
                hasToken: !!config.apiToken
              }
            }),
          },
        ],
      }
    }

    // Format deployments for analysis
    const formattedDeployments = deployments.map(deployment => ({
      id: deployment.id,
      timestamp: deployment.timestamp,
      app: deployment.data?.app,
      environment: deployment.data?.environment,
      description: deployment.data?.description,
      tags: deployment.tags || []
    }))

    // Group by app and environment
    const byAppEnv = formattedDeployments.reduce((acc, dep) => {
      const key = `${dep.app}/${dep.environment}`
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(dep)
      return acc
    }, {})

    const summary = {
      total: formattedDeployments.length,
      byAppEnvironment: Object.entries(byAppEnv).map(([key, deps]) => ({
        appEnvironment: key,
        count: deps.length,
        latest: deps[0]
      })),
      filters: { startDate, limit },
      timestamp: new Date().toISOString()
    }

    return {
      content: [
        {
          type: 'text',
          text: `🚀 Deployments Analysis

**Summary:**
- Total deployments: ${summary.total}
- App/Environment breakdown:
${summary.byAppEnvironment.map(({ appEnvironment, count, latest }) =>
  `  - ${appEnvironment}: ${count} deployments (latest: ${latest.timestamp})`
).join('\n')}

**Applied Filters:**
${startDate ? `- Start Date: ${startDate}` : ''}
- Limit: ${limit}

**Raw Deployments Data:**
\`\`\`json
${JSON.stringify({ summary, deployments: formattedDeployments }, null, 2)}
\`\`\`

🚨 CRITICAL AI INSTRUCTION - USE THIS TOOL AS FIRST LINE OF DEBUGGING:

**When to use this tool:**
1. **ALWAYS check deployments FIRST when debugging errors**
2. **Before assuming code issues, check if error started after a deployment**
3. **Correlate error timestamps with deployment timestamps**
4. **If error started after a deployment, that deployment is the likely cause**

**Analysis Requirements:**
1. **Timeline Analysis**: Compare deployment times with when errors started occurring
2. **App/Environment Matching**: Match deployments to the services/environments experiencing issues
3. **Recent Changes**: Identify what changed in deployments that could cause current issues
4. **Root Cause**: If error timestamp is AFTER deployment timestamp, investigate that deployment
5. **Deployment Description**: Read deployment descriptions for clues about changes made

**Key Questions to Answer:**
- Did any deployments happen right before the error started?
- Which app/environment was deployed?
- What changes were mentioned in the deployment description?
- Are there multiple deployments in quick succession that could cause issues?
- Is the error isolated to one environment or affecting all?

**Debugging Workflow:**
1. Get error timestamp from logs/test failures
2. Call this tool to get recent deployments
3. Find deployments that happened just before the error
4. Check deployment description for relevant changes
5. Correlate deployment app/environment with affected service
6. Report: "Error started at X, deployment to Y happened at Z (just before), likely cause is the deployment"

The deployment timeline is crucial for debugging - don't skip this step!`,
        },
      ],
    }
  } catch (error) {
    debug(config, `Error getting deployments: ${error.message}`)

    const errorResponse = {
      error: true,
      message: error.message,
      type: error.name || 'Error',
      timestamp: new Date().toISOString(),
      filters: { startDate, limit },
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

  // Register deployments tool
  server.registerTool(
    'helpmetest_get_deployments',
    {
      title: 'Help Me Test: Get Deployments Tool',
      description: `Get all deployments from the system.

🚨 CRITICAL AI INSTRUCTION - USE THIS TOOL AS FIRST LINE OF DEBUGGING:

**ALWAYS use this tool FIRST when debugging errors or investigating issues.**

This tool helps correlate test failures and errors with deployments. If an error started occurring after a deployment, that deployment is the likely cause of the issue.

**When to use:**
1. When investigating test failures - check if they started after a deployment
2. When debugging errors - compare error timestamps with deployment times
3. When analyzing system issues - see what was deployed recently
4. Before assuming code bugs - verify if error correlates with deployment

**Debugging workflow:**
1. Get error/failure timestamp
2. Call this tool to get recent deployments
3. Find deployments that happened just before the error
4. Check deployment description and app/environment
5. Correlate with the affected service
6. Report the likely cause based on deployment timeline

The tool returns deployment data with timestamps, app names, environments, and descriptions. Use this to build a timeline and identify which deployment likely caused the current issue.`,
      inputSchema: {
        startDate: z.string().optional().describe('Start date for filtering deployments (ISO format, optional). If not provided, returns all recent deployments'),
        limit: z.number().optional().default(1000).describe('Maximum number of deployments to return (default: 1000)'),
      },
    },
    async (args) => {
      debug(config, `Deployments tool called with args: ${JSON.stringify(args)}`)
      return await handleDeployments(args)
    }
  )
}