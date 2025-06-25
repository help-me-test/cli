/**
 * Status Data Utility
 * 
 * Reusable functions for collecting and formatting status data
 * Used by both CLI status command and MCP server
 */

import { getAllHealthChecks, getAllTests, getTestStatus, getUserInfo } from './api.js'
import { debug, config } from './config.js'
import * as R from 'ramda'

/**
 * Format duration since last heartbeat
 * @param {string} lastHeartbeat - ISO timestamp of last heartbeat
 * @returns {string} Formatted duration string
 */
export function formatTimeSince(lastHeartbeat) {
  if (!lastHeartbeat) return 'Never'
  
  const now = new Date()
  const then = new Date(lastHeartbeat)
  const diffMs = now - then
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  const remainingSecs = diffSecs % 60
  const remainingMins = diffMins % 60

  if (diffMins < 1) return `${diffSecs}s`
  if (diffHours < 1) return `${diffMins}m ${remainingSecs}s`
  if (diffHours < 24) return `${diffHours}h ${remainingMins}m`
  return `${diffDays}d`
}

/**
 * Get emoji and color for status
 * @param {string} status - Status string
 * @returns {Object} Status formatting object
 */
export function getStatusFormat(status) {
  switch (status?.toLowerCase()) {
    case 'up':
    case 'pass':
      return {
        emoji: '✅',
        text: 'UP',
      }
    case 'down':
    case 'fail':
      return {
        emoji: '❌',
        text: 'DOWN',
      }
    default:
      return {
        emoji: '❔',
        text: 'UNKNOWN',
      }
  }
}

/**
 * Generic multi-field sorter
 * @param {Array} items - Items to sort
 * @param {Array} sortFields - Array of sort field objects with {field, order, getValue}
 * @returns {Array} Sorted items
 */
export function multiSort(items, sortFields) {
  // Ensure items is an array
  if (!Array.isArray(items)) {
    console.warn('multiSort: items is not an array, returning empty array:', items)
    return []
  }
  
  return items.sort((a, b) => {
    for (const { field, order = 'ASC', getValue } of sortFields) {
      const aVal = getValue(a, field)
      const bVal = getValue(b, field)
      
      let comparison = 0
      if (aVal < bVal) comparison = -1
      else if (aVal > bVal) comparison = 1
      
      if (comparison !== 0) {
        return order === 'DESC' ? -comparison : comparison
      }
    }
    return 0
  })
}

/**
 * Generic formatter for API responses - picks fields and adds minimal formatting
 * @param {Array} baseFields - Fields to always include
 * @param {Array} verboseFields - Additional fields when verbose=true
 * @param {Object} item - API response item
 * @param {boolean} verbose - Include verbose fields
 * @returns {Object} Formatted item
 */
const formatApiResponse = R.curry((baseFields, verboseFields, item, verbose) => {
  const fieldsToInclude = verbose ? R.concat(baseFields, verboseFields) : baseFields
  
  return R.pipe(
    R.pick(fieldsToInclude),
    R.when(
      R.has('status'),
      R.assoc('emoji', getStatusFormat(item.status).emoji)
    )
  )(item)
})

/**
 * Format healthcheck for JSON output
 */
export const formatHealthcheck = formatApiResponse(
  ['name', 'status', 'last_heartbeat', 'grace_period', 'tags'],
  ['id', 'grace_period_seconds', 'created_at', 'updated_at', 'latest_elapsed_time', 'latest_env', 'latest_heartbeat_data']
)

/**
 * Format test for JSON output  
 */
export const formatTest = formatApiResponse(
  ['name', 'status', 'last_run', 'duration', 'tags'],
  ['id', 'content', 'description']
)

/**
 * Collect all status data from APIs
 * @param {Object} options - Collection options
 * @param {boolean} options.verbose - Enable verbose logging
 * @returns {Promise<Object>} Complete status data
 */
export async function collectStatusData(options = {}) {
  const { verbose = false } = options
  
  try {
    // Get all data in parallel
    const [userInfo, healthChecks, tests, testStatus] = await Promise.all([
      getUserInfo().catch(() => ({ activeCompany: 'Unknown Company', requestCompany: { name: 'Unknown Company' } })),
      getAllHealthChecks().catch(() => []),
      getAllTests().catch(() => []),
      getTestStatus().catch(() => [])
    ])

    // Ensure arrays are actually arrays
    const safeHealthChecks = Array.isArray(healthChecks) ? healthChecks : []
    const safeTests = Array.isArray(tests) ? tests : []
    const safeTestStatus = testStatus && typeof testStatus === 'object' ? testStatus : {}

    // Debug output
    if (verbose) {
      debug(config, `Debug - userInfo: ${JSON.stringify(userInfo, null, 2)}`)
      debug(config, `Debug - tests count: ${safeTests.length}`)
      debug(config, `Debug - testStatus keys: ${Object.keys(safeTestStatus).length}`)
      debug(config, `Debug - healthChecks count: ${safeHealthChecks.length}`)
    }

    return {
      userInfo,
      healthChecks: safeHealthChecks,
      tests: safeTests,
      testStatus: safeTestStatus,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    throw new Error(`Failed to collect status data: ${error.message}`)
  }
}

/**
 * Format status data for JSON output
 * @param {Object} statusData - Raw status data from collectStatusData
 * @param {Object} options - Formatting options
 * @param {boolean} options.verbose - Include verbose data like test content
 * @returns {Object} Formatted JSON data
 */
export function formatStatusDataForJson(statusData, options = {}) {
  const { userInfo, healthChecks, tests, testStatus } = statusData
  const { verbose = false } = options
  
  // Sort tests by status priority (fail, pass, unknown) and then by last run time
  const sortedTests = multiSort(tests, [
    {
      field: 'status',
      order: 'ASC',
      getValue: (test) => {
        const status = (testStatus[test.id]?.[0]?.status || 'unknown').toLowerCase()
        const statusOrder = { 'fail': 0, 'pass': 1, 'unknown': 2 }
        return statusOrder[status] ?? 2
      }
    },
    {
      field: 'timestamp',
      order: 'DESC',
      getValue: (test) => testStatus[test.id]?.[0]?.timestamp ? new Date(testStatus[test.id][0].timestamp).getTime() : 0
    }
  ])
  
  const testsWithStatus = sortedTests.map(test => {
    const statusRecords = testStatus[test.id] || []
    const latestStatus = statusRecords.length > 0 ? statusRecords[0] : null
    
    // Add execution data (don't override existing content/description from API)
    const testWithExecution = R.mergeRight(test, {
      status: latestStatus?.status || 'unknown',
      last_run: latestStatus?.timestamp,
      duration: latestStatus?.elapsedtime ? `${Math.round(latestStatus.elapsedtime / 1000)}s` : 'N/A'
    })
    
    return formatTest(testWithExecution, verbose)
  })

  // Sort healthchecks by status priority (down, up, unknown) and then by last heartbeat
  const sortedHealthChecks = multiSort(healthChecks, [
    {
      field: 'status',
      order: 'ASC',
      getValue: (hc) => {
        const status = (hc.status || 'unknown').toLowerCase()
        const statusOrder = { 'down': 0, 'up': 1, 'unknown': 2 }
        return statusOrder[status] ?? 2
      }
    },
    {
      field: 'lastHeartbeat',
      order: 'DESC',
      getValue: (hc) => hc.lastHeartbeat ? new Date(hc.lastHeartbeat).getTime() : 0
    }
  ])

  const formattedHealthChecks = sortedHealthChecks.map(hc => formatHealthcheck(hc, verbose))

  return {
    company: userInfo.requestCompany?.name || userInfo.activeCompany || 'Unknown Company',
    total: testsWithStatus.length + formattedHealthChecks.length,
    tests: testsWithStatus,
    healthchecks: formattedHealthChecks,
    timestamp: statusData.timestamp
  }
}

/**
 * Get complete formatted status data
 * @param {Object} options - Options for data collection and formatting
 * @param {boolean} options.verbose - Enable verbose logging and include verbose data
 * @returns {Promise<Object>} Complete formatted status data
 */
export async function getFormattedStatusData(options = {}) {
  const statusData = await collectStatusData(options)
  return formatStatusDataForJson(statusData, options)
}

// Export all functions for convenience
export default {
  formatTimeSince,
  getStatusFormat,
  multiSort,
  formatHealthcheck,
  formatTest,
  collectStatusData,
  formatStatusDataForJson,
  getFormattedStatusData
}