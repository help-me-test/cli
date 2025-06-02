/**
 * Status Command Implementation
 * 
 * This module handles displaying status of all checks in the system
 */

import { output } from '../utils/colors.js'
import { config, validateConfiguration } from '../utils/config.js'
import { getAllHealthChecks } from '../utils/api.js'

/**
 * Format duration since last heartbeat
 * @param {string} lastHeartbeat - ISO timestamp of last heartbeat
 * @returns {string} Formatted duration string
 */
function formatTimeSince(lastHeartbeat) {
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
function getStatusFormat(status) {
  switch (status?.toLowerCase()) {
    case 'up':
      return {
        emoji: '✅',
        text: 'UP',
      }
    case 'down':
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
 * Format check data for JSON output
 * @param {Object} check - Health check data
 * @returns {Object} Formatted check data
 */
function formatCheckForJson(check) {
  const fmt = getStatusFormat(check.status)
  return {
    name: check.name,
    status: check.status?.toLowerCase() || 'unknown',
    emoji: fmt.emoji,
    lastHeartbeat: check.lastHeartbeat,
    lastHeartbeatFormatted: formatTimeSince(check.lastHeartbeat),
    gracePeriod: check.gracePeriod,
    data: check.data || {},
  }
}

/**
 * Status command handler
 * Shows status of all checks in the system
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
    // Get all health checks
    const healthChecks = await getAllHealthChecks()
    
    if (!healthChecks?.length) {
      if (options.json) {
        console.log(JSON.stringify({ checks: [] }, null, 2))
      } else {
        output.info('No health checks found')
        output.dim('Run health checks first:')
        output.command('helpmetest health "my-service" "5m"')
      }
      return
    }

    // Handle JSON output
    if (options.json) {
      const jsonData = {
        total: healthChecks.length,
        checks: healthChecks.map(formatCheckForJson),
      }
      console.log(JSON.stringify(jsonData, null, 2))
      return
    }

    // Show formatted output
    // Calculate column widths
    const nameWidth = Math.max(20, ...healthChecks.map(c => c.name.length))
    const lastHeartbeatWidth = 15
    const graceWidth = 10
    
    // Print table header
    // Print table header with tabs for alignment
    console.log(
      'Status\t' +
      'Name'.padEnd(nameWidth) + '\t' +
      'Last Heartbeat'.padEnd(lastHeartbeatWidth) + '\t' +
      'Grace',
    )
    console.log('─'.repeat(nameWidth + lastHeartbeatWidth + graceWidth + 24))

    // Print each check as a table row
    healthChecks.forEach(check => {
      const status = check.status?.toLowerCase()
      const statusSymbol = status === 'up' ? '✅' : status === 'down' ? '❌' : '❔'
      
      console.log(
        `${statusSymbol}\t` +
        check.name.padEnd(nameWidth) + '\t' +
        formatTimeSince(check.lastHeartbeat).padEnd(lastHeartbeatWidth) + '\t' +
        (check.gracePeriod || '-'),
      )
      
      if (options.verbose && check.data) {
        const data = []
        if (check.data.hostname) data.push(`host: ${check.data.hostname}`)
        if (check.data.environment) data.push(`env: ${check.data.environment}`)
        if (check.data.system_metrics) {
          const { cpu_usage, memory_usage, disk_usage } = check.data.system_metrics
          data.push(`cpu: ${cpu_usage}%`, `mem: ${memory_usage}%`, `disk: ${disk_usage}%`)
        }
        if (data.length > 0) {
          console.log('       ' + data.join(', '))
        }
      }
    })

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
