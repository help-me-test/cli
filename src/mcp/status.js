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
 * @param {string|Array<string>} [args.id] - Filter by ID (test ID, health check name, or deployment ID)
 * @param {boolean} [args.verbose] - Enable verbose output
 * @param {boolean} [args.testsOnly] - Only show tests
 * @param {boolean} [args.healthOnly] - Only show health checks
 * @param {number} [args.testRunLimit] - Number of recent test runs to show (default: 0)
 * @param {boolean} [args.includeDeployments] - Include deployment history
 * @param {number} [args.deploymentsLimit] - Limit for deployments (default: 10)
 * @returns {Object} Comprehensive status result
 */
async function handleStatus(args) {
  const {
    id = null,
    verbose = false,
    testsOnly = false,
    healthOnly = false,
    includeDeployments = false,
    testRunLimit = 0,
    deploymentsLimit = 10
  } = args

  debug(config, 'Getting comprehensive status for MCP client')

  try {
    const statusData = await getFormattedStatusData({ verbose })

    debug(config, `Retrieved status data: ${statusData.tests.length} tests, ${statusData.healthchecks.length} healthchecks`)

    // Filter by ID if provided
    let filteredTests = statusData.tests
    let filteredHealthchecks = statusData.healthchecks

    if (id) {
      const ids = Array.isArray(id) ? id : [id]
      filteredTests = statusData.tests.filter(t =>
        ids.includes(t.id) || ids.includes(t.name)
      )
      filteredHealthchecks = statusData.healthchecks.filter(h =>
        ids.includes(h.name) || ids.includes(h.id)
      )

      debug(config, `Filtered to ${filteredTests.length} tests, ${filteredHealthchecks.length} healthchecks`)
    }

    let output = `# 🔍 Complete System Status - ${statusData.company}\n\n`

    // Add tests section (unless healthOnly)
    if (!healthOnly) {
      output += formatTestsAsTable(filteredTests, { includeHeader: true, verbose }) + '\n\n'
    }

    // Add health checks section (unless testsOnly) - only if there are any
    if (!testsOnly && filteredHealthchecks.length > 0) {
      output += formatHealthchecksAsTable(filteredHealthchecks, { includeHeader: true }) + '\n\n'
    }

    // Add test runs if testRunLimit > 0
    if (testRunLimit > 0 && !healthOnly) {
      try {
        const ids = id ? (Array.isArray(id) ? id : [id]) : null
        const runsResponse = await getTestRuns({
          tests: ids,
          limit: testRunLimit
        })
        const testRuns = runsResponse.runs || []

        if (testRuns.length > 0) {
          const formattedRuns = testRuns.map(run => ({
            testId: run.test,
            status: run.status,
            duration: run.elapsedTime,
            timestamp: run.timestamp,
            errors: run.errors || []
          }))

          const statusCounts = formattedRuns.reduce((acc, run) => {
            acc[run.status] = (acc[run.status] || 0) + 1
            return acc
          }, {})

          const singleTestFilter = id && !Array.isArray(id)

          output += `## 🏃 Recent Test Runs\n\n`
          output += `**Summary:** ${Object.entries(statusCounts).map(([status, count]) => `${status}: ${count}`).join(', ')} (${formattedRuns.length} total)\n\n`

          // Show all runs in chronological order
          formattedRuns.slice(0, testRunLimit).forEach(run => {
            const time = run.timestamp ? new Date(run.timestamp).toLocaleString() : '-'
            const duration = run.duration ? `${(run.duration / 1000).toFixed(1)}s` : '-'
            const statusIcon = run.status === 'PASS' ? '✅' : '❌'

            if (!singleTestFilter) {
              output += `${statusIcon} **${run.status}** - ${run.testId} - ${time} (${duration})\n`
            } else {
              output += `${statusIcon} **${run.status}** - ${time} (${duration})\n`
            }

            if (run.status === 'FAIL' && run.errors?.length > 0) {
              // Deduplicate errors by keyword+message
              const uniqueErrors = run.errors.reduce((acc, error) => {
                const key = `${error.keyword}:${error.message}`
                if (!acc.has(key)) {
                  acc.set(key, error)
                }
                return acc
              }, new Map())

              uniqueErrors.forEach(error => {
                output += `  **Keyword:** ${error.keyword || 'unknown'}\n`
                output += `  **Error:**\n\`\`\`\n${error.message}\n\`\`\`\n`
              })
            }
            output += '\n'
          })
        }
      } catch (error) {
        debug(config, `Error getting test runs: ${error.message}`)
      }
    }

    // Add deployments if requested
    if (includeDeployments) {
      try {
        const deployments = await getDeployments(new Date(), deploymentsLimit)

        if (deployments && deployments.length > 0) {
          output += `## 🚀 Recent Deployments (${deployments.length} total)\n\n`
          output += `| Time | App/Environment | Description |\n`
          output += `|------|-----------------|-------------|\n`

          for (const dep of deployments.slice(0, deploymentsLimit)) {
            const time = dep.timestamp ? new Date(dep.timestamp).toLocaleString() : '-'
            const appEnv = `${dep.data?.app || 'unknown'}/${dep.data?.environment || 'unknown'}`
            const desc = dep.data?.description ? dep.data.description.substring(0, 50) + '...' : '-'
            output += `| ${time} | ${appEnv} | ${desc} |\n`
          }
          output += '\n'
        }
      } catch (error) {
        debug(config, `Error getting deployments: ${error.message}`)
      }
    }

    output += `💡 **Action Items:**\n`
    output += `- Focus on ❌ failed tests and down services\n`
    if (includeDeployments) {
      output += `- Check recent deployments if you see new failures`
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

    // Build detailed list for failed runs
    const failedRuns = formattedRuns.filter(r => r.status === 'FAIL')
    let failedOutput = ''
    if (failedRuns.length > 0) {
      const singleTestFilter = tests?.length === 1
      failedOutput = `\n**❌ Failed Test Runs:**\n\n`

      failedRuns.slice(0, limit).forEach(run => {
        const duration = run.duration || 'unknown'
        const time = run.startTime ? new Date(run.startTime).toLocaleString() : '-'

        if (!singleTestFilter) {
          failedOutput += `**Test:** ${run.testName}\n`
        }
        failedOutput += `🕐 ${time} (${duration})\n\n`

        if (run.errors?.length > 0) {
          // Deduplicate errors by keyword+message
          const uniqueErrors = run.errors.reduce((acc, error) => {
            const key = `${error.keyword}:${error.message}`
            if (!acc.has(key)) {
              acc.set(key, error)
            }
            return acc
          }, new Map())

          uniqueErrors.forEach(error => {
            failedOutput += `🔴 **Keyword:** ${error.keyword || 'unknown'}\n`
            failedOutput += `**Error:**\n\`\`\`\n${error.message}\n\`\`\`\n\n`
          })
        }
        failedOutput += '---\n\n'
      })

      if (failedRuns.length > limit) {
        failedOutput += `*Showing ${limit} of ${failedRuns.length} failed runs*\n`
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
${failedOutput}

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
  // Register comprehensive status tool (enhanced - replaces get_test_runs and get_deployments)
  server.registerTool(
    'helpmetest_status',
    {
      title: 'Help Me Test: Complete Status Tool',
      description: `Get comprehensive status of tests, health checks, test runs, and deployments. Single source of truth for system status. Supports filtering by ID (test ID/name, health check name, or deployment ID).`,
      inputSchema: {
        id: z.union([z.string(), z.array(z.string())]).optional().describe('Filter by ID - test ID/name, health check name, or deployment ID (single string or array)'),
        verbose: z.boolean().optional().default(false).describe('Enable verbose output with test content and additional debug information'),
        testsOnly: z.boolean().optional().default(false).describe('Only show tests (filter out health checks)'),
        healthOnly: z.boolean().optional().default(false).describe('Only show health checks (filter out tests)'),
        testRunLimit: z.number().optional().default(0).describe('Number of recent test runs to show (0 = none, default: 0). Shows both passed and failed runs with full error details.'),
        includeDeployments: z.boolean().optional().default(false).describe('Include recent deployment history for debugging'),
        deploymentsLimit: z.number().optional().default(10).describe('Limit for deployments when includeDeployments=true (default: 10)'),
      },
    },
    async (args) => {
      debug(config, `Status tool called with args: ${JSON.stringify(args)}`)
      return await handleStatus(args)
    }
  )
}