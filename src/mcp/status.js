/**
 * Status MCP Tools
 * Provides comprehensive status and monitoring tools for the helpmetest system
 */

import { z } from 'zod'
import { config, debug } from '../utils/config.js'
import { getTestRuns, getDeployments } from '../utils/api.js'
import { getFormattedStatusData } from '../utils/status-data.js'
import { formatTestsAsTable } from './tests.js'
import { formatHealthchecksAsTable } from './healthchecks.js'

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

    const output = `# 🔍 Complete System Status - ${statusData.company}

${formatTestsAsTable(statusData.tests, { includeHeader: true })}

${formatHealthchecksAsTable(statusData.healthchecks, { includeHeader: true })}

💡 **Action Items:**
- Focus on ❌ failed tests and down services
- Check recent deployments if you see new failures`

    return {
      content: [
        {
          type: 'text',
          text: output,
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
          text: `❌ **Error Getting System Status**

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
    const response = await getTestRuns({
      tests,
      status,
      startDate,
      endDate,
      limit
    })

    const testRuns = response.runs || []

    debug(config, `Retrieved ${testRuns.length} test runs`)

    if (!testRuns.length) {
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
      id: `${run.test}-${run.timestamp}`,
      testId: run.test,
      testName: run.test,
      status: run.status,
      startTime: run.timestamp,
      endTime: null,
      duration: run.elapsedTime,
      errorMessage: run.errors?.length > 0 ? run.errors.map(e => e.message).join('; ') : null,
      errors: run.errors || [],
      tags: []
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

    // Build table for failed runs
    const failedRuns = formattedRuns.filter(r => r.status === 'FAIL')
    let failedTable = ''
    if (failedRuns.length > 0) {
      failedTable = `\n**Failed Test Runs:**

| Test Name | Status | Duration | Error | Time |
|-----------|--------|----------|-------|------|
`
      for (const run of failedRuns.slice(0, 10)) { // Show max 10 failures
        const error = run.errorMessage ? run.errorMessage.substring(0, 50) + '...' : '-'
        const duration = run.duration || '-'
        const time = run.startTime ? new Date(run.startTime).toLocaleString() : '-'
        failedTable += `| ${run.testName} | ❌ ${run.status} | ${duration} | ${error} | ${time} |\n`
      }
      if (failedRuns.length > 10) {
        failedTable += `\n*Showing 10 of ${failedRuns.length} failed runs*`
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `# 🏃 Test Runs Analysis

**Summary:**
- Total runs: ${summary.total}
- Status breakdown: ${Object.entries(statusCounts).map(([status, count]) => `${status}: ${count}`).join(', ')}

**Applied Filters:**
${tests ? `- Tests: ${tests.join(', ')}` : ''}
${status ? `- Status: ${status.join(', ')}` : ''}
${startDate ? `- Start Date: ${startDate}` : ''}
${endDate ? `- End Date: ${endDate}` : ''}
- Limit: ${limit}
${failedTable}

💡 Focus on failed runs to identify patterns and fix flaky tests`,
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

    // Build recent deployments table
    let deploymentsTable = `\n**Recent Deployments:**

| Time | App/Environment | Description |
|------|-----------------|-------------|
`
    for (const dep of formattedDeployments.slice(0, 20)) { // Show max 20 deployments
      const time = dep.timestamp ? new Date(dep.timestamp).toLocaleString() : '-'
      const appEnv = `${dep.app || 'unknown'}/${dep.environment || 'unknown'}`
      const desc = dep.description ? dep.description.substring(0, 60) + '...' : '-'
      deploymentsTable += `| ${time} | ${appEnv} | ${desc} |\n`
    }
    if (formattedDeployments.length > 20) {
      deploymentsTable += `\n*Showing 20 of ${formattedDeployments.length} deployments*`
    }

    return {
      content: [
        {
          type: 'text',
          text: `# 🚀 Deployments Analysis

**Summary:**
- Total deployments: ${summary.total}
- App/Environment breakdown:
${summary.byAppEnvironment.map(({ appEnvironment, count, latest }) =>
  `  - ${appEnvironment}: ${count} deployments (latest: ${new Date(latest.timestamp).toLocaleString()})`
).join('\n')}

**Applied Filters:**
${startDate ? `- Start Date: ${startDate}` : ''}
- Limit: ${limit}
${deploymentsTable}

💡 **Debugging Tip:** When investigating errors, check if they started after a deployment - that deployment is likely the cause`,
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