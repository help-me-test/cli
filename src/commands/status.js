/**
 * Status Command Implementation
 * 
 * This module handles displaying status of all checks in the system
 */

import { output, colors } from '../utils/colors.js'
import { config, validateConfiguration } from '../utils/config.js'
import {
  formatTimeSince,
  getStatusFormat,
  multiSort,
  collectStatusData,
  getFormattedStatusData
} from '../utils/status-data.js'
import Table from 'cli-table3'
import { log } from '../utils/log.js'



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
 * Display tests section
 * @param {Array} tests - Tests data
 * @param {Object} testStatus - Test status data
 * @param {Object} options - Display options
 */
function displayTestsSection(tests, testStatus, options) {
  log(colors.subtitle('Tests'))
  if (tests.length === 0) {
    log('No tests found')
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
    const headers = options.verbose 
      ? ['Status', 'Name', 'Last Run', 'Duration', 'Tags', 'Content']
      : ['Status', 'Name', 'Last Run', 'Duration', 'Tags']
    
    const testsRows = sortedTests.map(test => {
      const statusRecords = testStatus[test.id] || []
      const latestStatus = statusRecords.length > 0 ? statusRecords[0] : null
      const testName = test.name || test.id
      const testStatus_ = latestStatus?.status || 'unknown'
      const statusSymbol = getStatusFormat(testStatus_).emoji
      const lastRun = formatTimeSince(latestStatus?.timestamp)
      const duration = latestStatus?.elapsedtime ? `${Math.round(latestStatus.elapsedtime / 1000)}s` : 'N/A'
      const tags = test.tags && test.tags.length > 0 ? test.tags.join(', ') : ''
      
      const row = [statusSymbol, testName, lastRun, duration, tags]
      
      if (options.verbose) {
        // Add test content (truncated and sanitized for table display)
        const content = test.content || test.description || ''
        // Replace problematic characters but keep newlines
        const sanitizedContent = content
          .replace(/\r\n/g, '\n') // Normalize CRLF to LF
          .replace(/\r/g, '\n')   // Replace CR with LF
          .replace(/\t/g, '    ') // Replace tabs with 4 spaces
          .replace(/ +/g, ' ')    // Replace multiple spaces with single space (but preserve newlines)
          .trim()
        
        // Limit by both lines and characters to prevent hanging
        const maxLength = 1000  // Good balance of content vs performance
        const maxLines = 10     // Keep it fast
        
        let displayContent = sanitizedContent
        
        // First truncate by character length to prevent table rendering issues
        if (displayContent.length > maxLength) {
          displayContent = displayContent.substring(0, maxLength) + '...'
        }
        
        // Then truncate by number of lines
        const lines = displayContent.split('\n')
        if (lines.length > maxLines) {
          displayContent = lines.slice(0, maxLines).join('\n') + '\n...'
        }
          
        row.push(displayContent)
      }
      
      return row
    })
    
    log(createCleanTable(headers, testsRows))
  }
}

/**
 * Display healthchecks section
 * @param {Array} healthChecks - Healthchecks data
 * @param {Object} options - Display options
 */
function displayHealthchecksSection(healthChecks, options) {
  log(colors.subtitle('Healthchecks'))
  if (healthChecks.length === 0) {
    log('No healthchecks found')
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
    const headers = options.verbose 
      ? ['Status', 'Name', 'Last Heartbeat', 'Grace', 'Env', 'Host', 'Tags', 'Data']
      : ['Status', 'Name', 'Last Heartbeat', 'Grace', 'Env', 'Host', 'Tags']
    
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
      
      const row = [statusSymbol, hc.name, lastHeartbeat, gracePeriod, env, hostname, tags]
      
      if (options.verbose) {
        // Add additional data (formatted and truncated for table display)
        const additionalData = hc.latestHeartbeatData || hc.latest_heartbeat_data || hc.data || {}
        const dataStr = JSON.stringify(additionalData, null, 2) // Pretty format JSON
        
        // Sanitize and truncate the JSON data but preserve structure
        const sanitizedData = dataStr
          .replace(/\r\n/g, '\n') // Normalize CRLF to LF
          .replace(/\r/g, '\n')   // Replace CR with LF
          .replace(/\t/g, '  ')   // Replace tabs with 2 spaces
          .trim()
        
        // Limit by both lines and characters to prevent hanging
        const maxLength = 150  // Back to working limit
        const maxLines = 8     // Back to working limit
        
        let displayData = sanitizedData
        
        // First truncate by character length to prevent table rendering issues
        if (displayData.length > maxLength) {
          displayData = displayData.substring(0, maxLength) + '...'
        }
        
        // Then truncate by number of lines
        const lines = displayData.split('\n')
        if (lines.length > maxLines) {
          displayData = lines.slice(0, maxLines).join('\n') + '\n...'
        }
          
        row.push(displayData)
      }
      
      return row
    })
    
    log(createCleanTable(headers, healthchecksRows))
  }
}

/**
 * Status command handler
 * Shows status of all checks in the system in the desired format
 * @param {string} subcommand - Optional subcommand ('test' or 'health')
 * @param {Object} options - Command options
 * @param {boolean} options.json - Output in JSON format
 * @param {boolean} options.verbose - Show detailed information
 */
async function statusCommand(subcommand, options) {
  // Validate configuration first (don't show verbose output if JSON is requested)
  if (!validateConfiguration(config, options.json ? false : options.verbose)) {
    output.error('Configuration validation failed')
    output.info('Please set HELPMETEST_API_TOKEN environment variable')
    process.exit(1)
  }

  try {
    // Handle JSON output using reusable functions
    if (options.json) {
      const jsonData = await getFormattedStatusData(options)
      
      // Filter JSON data based on subcommand
      if (subcommand === 'test') {
        const filteredData = {
          company: jsonData.company,
          total: jsonData.tests.length,
          tests: jsonData.tests,
          timestamp: jsonData.timestamp
        }
        log(JSON.stringify(filteredData, null, 2))
      } else if (subcommand === 'health') {
        const filteredData = {
          company: jsonData.company,
          total: jsonData.healthchecks.length,
          healthchecks: jsonData.healthchecks,
          timestamp: jsonData.timestamp
        }
        log(JSON.stringify(filteredData, null, 2))
      } else {
        log(JSON.stringify(jsonData, null, 2))
      }
      return
    }

    // For non-JSON output, collect data manually for table formatting
    const statusData = await collectStatusData(options)
    const { userInfo, healthChecks, tests, testStatus } = statusData

    // Show formatted output matching the desired style
    log(colors.title(userInfo.requestCompany?.name || userInfo.companyName || userInfo.activeCompany))
    log()

    // Display sections based on subcommand
    if (!subcommand || subcommand === 'test') {
      displayTestsSection(tests, testStatus, options)
      
      if (!subcommand) {
        log()
      }
    }
    
    if (!subcommand || subcommand === 'health') {
      displayHealthchecksSection(healthChecks, options)
    }

    // Show totals if verbose
    if (options.verbose) {
      log()
      if (subcommand === 'test') {
        log(`Total: ${tests.length} tests`)
      } else if (subcommand === 'health') {
        log(`Total: ${healthChecks.length} healthchecks`)
      } else {
        log(`Total: ${tests.length} tests, ${healthChecks.length} healthchecks`)
      }
    }

  } catch (error) {
    output.error(`Failed to get status: ${error.message}`)
    
    if (options.verbose) {
      output.section('Error Details:')
      error(error)
    }
    
    process.exit(1)
  }
}

export default statusCommand
