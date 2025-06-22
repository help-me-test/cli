/**
 * Status Command Implementation
 * 
 * This module handles displaying status of all checks in the system
 */

import { output, colors } from '../utils/colors.js'
import { config, validateConfiguration } from '../utils/config.js'
import { getAllHealthChecks, getAllTests, getTestStatus, getUserInfo } from '../utils/api.js'
import { 
  formatTimeSince, 
  getStatusFormat, 
  multiSort, 
  formatCheckForJson,
  collectStatusData,
  formatStatusDataForJson,
  getFormattedStatusData
} from '../utils/status-data.js'
import Table from 'cli-table3'



/**
 * Create a clean table without borders and minimal padding
 * @param {Array} headers - Table headers
 * @param {Array} rows - Table rows (array of arrays)
 * @returns {string} Formatted table string
 */
function createCleanTable(headers, rows) {
  const table = new Table({
    head: headers,
    style: {
      head: ['cyan'],
      border: [],
      'padding-left': 0,
      'padding-right': 1
    },
    chars: {
      'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
      'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
      'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '',
      'right': '', 'right-mid': '', 'middle': ' '
    }
  })
  
  rows.forEach(row => table.push(row))
  return table.toString()
}



/**
 * Status command handler
 * Shows status of all checks in the system in the desired format
 * @param {Object} options - Command options
 * @param {boolean} options.json - Output in JSON format
 * @param {boolean} options.verbose - Show detailed information
 */
async function statusCommand(options) {
  // Validate configuration first
  if (!validateConfiguration(config, options.verbose)) {
    output.error('Configuration validation failed')
    output.info('Please set HELPMETEST_API_TOKEN environment variable')
    process.exit(1)
  }

  try {
    // Handle JSON output using reusable functions
    if (options.json) {
      const jsonData = await getFormattedStatusData(options)
      console.log(JSON.stringify(jsonData, null, 2))
      return
    }

    // For non-JSON output, collect data manually for table formatting
    const statusData = await collectStatusData(options)
    const { userInfo, healthChecks, tests, testStatus } = statusData

    // Show formatted output matching the desired style
    console.log(colors.title(userInfo.requestCompany?.name || userInfo.activeCompany))
    console.log()

    // Tests section
    console.log(colors.subtitle('Tests'))
    if (tests.length === 0) {
      console.log('No tests found')
    } else {
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
      
      // Prepare tests table data
      const testsRows = sortedTests.map(test => {
        const statusRecords = testStatus[test.id] || []
        const latestStatus = statusRecords.length > 0 ? statusRecords[0] : null
        const testName = test.name || test.id
        const testStatus_ = latestStatus?.status || 'unknown'
        const statusSymbol = getStatusFormat(testStatus_).emoji
        const lastRun = formatTimeSince(latestStatus?.timestamp)
        const duration = latestStatus?.elapsedtime ? `${Math.round(latestStatus.elapsedtime / 1000)}s` : 'N/A'
        const tags = test.tags && test.tags.length > 0 ? test.tags.join(', ') : ''
        
        return [statusSymbol, testName, lastRun, duration, tags]
      })
      
      console.log(createCleanTable(['Status', 'Name', 'Last Run', 'Duration', 'Tags'], testsRows))
    }
    
    console.log()

    // Healthchecks section
    console.log(colors.subtitle('Healthchecks'))
    if (healthChecks.length === 0) {
      console.log('No healthchecks found')
    } else {
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
      
      // Prepare healthchecks table data
      const healthchecksRows = sortedHealthChecks.map(hc => {
        const statusSymbol = getStatusFormat(hc.status).emoji
        const lastHeartbeat = formatTimeSince(hc.lastHeartbeat || hc.last_heartbeat)
        const gracePeriod = hc.gracePeriod || hc.grace_period || 'N/A'
        const tags = hc.tags && hc.tags.length > 0 ? hc.tags.join(', ') : ''
        
        // Extract environment and hostname from heartbeat data
        const env = hc.latestEnv || hc.latest_env || 
                   (hc.latestHeartbeatData || hc.latest_heartbeat_data)?.environment || 
                   hc.data?.environment || 'N/A'
        const hostname = (hc.latestHeartbeatData || hc.latest_heartbeat_data)?.hostname || 
                        hc.data?.hostname || 'N/A'
        
        return [statusSymbol, hc.name, lastHeartbeat, gracePeriod, env, hostname, tags]
      })
      
      console.log(createCleanTable(['Status', 'Name', 'Last Heartbeat', 'Grace', 'Env', 'Host', 'Tags'], healthchecksRows))
    }

    // Show totals if verbose
    if (options.verbose) {
      console.log()
      console.log(`Total: ${tests.length} tests, ${healthChecks.length} healthchecks`)
    }

  } catch (error) {
    output.error(`Failed to get status: ${error.message}`)
    
    if (options.verbose) {
      output.section('Error Details:')
      console.error(error)
    }
    
    process.exit(1)
  }
}

export default statusCommand
