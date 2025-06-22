/**
 * Systemd Timer Parsing Utility
 * 
 * Handles parsing of systemd timer configurations and automatic grace period
 * calculation using the timespan-parser library for systemd-compatible time formats.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import timespanParser from 'timespan-parser'
const { parse: parseTimespan } = timespanParser
import { output } from './colors.js'
import { debug, config } from './config.js'

/**
 * Parse systemd timer file and extract OnCalendar configuration
 * @param {string} timerFilePath - Path to systemd timer file
 * @returns {Object} Parsed timer configuration
 */
const parseSystemdTimerFile = (timerFilePath) => {
  debug(config, `Parsing systemd timer file: ${timerFilePath}`)
  
  try {
    const resolvedPath = resolve(timerFilePath)
    const content = readFileSync(resolvedPath, 'utf8')
    
    const timerConfig = {
      filePath: resolvedPath,
      onCalendar: null,
      persistent: false,
      accuracySec: null,
      randomizedDelaySec: null,
      onBootSec: null,
      onStartupSec: null,
      onUnitActiveSec: null,
      onUnitInactiveSec: null,
      unit: null,
      rawContent: content,
    }
    
    // Parse the timer file line by line
    const lines = content.split('\n')
    let currentSection = null
    
    for (const line of lines) {
      const trimmedLine = line.trim()
      
      // Skip comments and empty lines
      if (trimmedLine.startsWith('#') || trimmedLine === '') {
        continue
      }
      
      // Check for section headers
      if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
        currentSection = trimmedLine.slice(1, -1).toLowerCase()
        continue
      }
      
      // Parse key-value pairs
      if (trimmedLine.includes('=')) {
        const [key, ...valueParts] = trimmedLine.split('=')
        const value = valueParts.join('=').trim()
        const cleanKey = key.trim().toLowerCase()
        
        if (currentSection === 'timer') {
          switch (cleanKey) {
            case 'oncalendar':
              timerConfig.onCalendar = value
              break
            case 'persistent':
              timerConfig.persistent = value.toLowerCase() === 'true'
              break
            case 'accuracysec':
              timerConfig.accuracySec = value
              break
            case 'randomizeddelaysec':
              timerConfig.randomizedDelaySec = value
              break
            case 'onbootsec':
              timerConfig.onBootSec = value
              break
            case 'onstartupsec':
              timerConfig.onStartupSec = value
              break
            case 'onunitactivesec':
              timerConfig.onUnitActiveSec = value
              break
            case 'onunitinactivesec':
              timerConfig.onUnitInactiveSec = value
              break
          }
        } else if (currentSection === 'unit') {
          if (cleanKey === 'requires' || cleanKey === 'wants' || cleanKey === 'after') {
            timerConfig.unit = value
          }
        }
      }
    }
    
    debug(config, `Timer configuration parsed: ${JSON.stringify(timerConfig, null, 2)}`)
    return timerConfig
    
  } catch (error) {
    debug(config, `Error parsing timer file: ${error.message}`)
    throw new Error(`Failed to parse systemd timer file '${timerFilePath}': ${error.message}`)
  }
}

/**
 * Calculate appropriate grace period from systemd timer configuration
 * @param {Object} timerConfig - Parsed timer configuration
 * @param {number} bufferMultiplier - Buffer multiplier (default: 1.2 = 20% buffer)
 * @returns {string} Grace period string (e.g., "25h", "8d")
 */
const calculateGracePeriodFromTimer = (timerConfig, bufferMultiplier = 1.2) => {
  debug(config, 'Calculating grace period from timer configuration')
  
  if (!timerConfig.onCalendar) {
    throw new Error('No OnCalendar configuration found in timer file')
  }
  
  const onCalendar = timerConfig.onCalendar.toLowerCase()
  
  // Handle common systemd calendar expressions
  let baseIntervalSeconds = 0
  
  if (onCalendar === 'daily' || onCalendar === '*-*-* 00:00:00') {
    baseIntervalSeconds = 24 * 60 * 60 // 24 hours
  } else if (onCalendar === 'weekly' || onCalendar === 'mon *-*-* 00:00:00') {
    baseIntervalSeconds = 7 * 24 * 60 * 60 // 7 days
  } else if (onCalendar === 'monthly' || onCalendar === '*-*-01 00:00:00') {
    baseIntervalSeconds = 30 * 24 * 60 * 60 // 30 days (approximate)
  } else if (onCalendar === 'yearly' || onCalendar === '*-01-01 00:00:00') {
    baseIntervalSeconds = 365 * 24 * 60 * 60 // 365 days
  } else if (onCalendar === 'hourly' || onCalendar === '*:00:00') {
    baseIntervalSeconds = 60 * 60 // 1 hour
  } else if (onCalendar.includes('minutely') || onCalendar === '*:*:00') {
    baseIntervalSeconds = 60 // 1 minute
  } else {
    // Try to parse more complex expressions
    baseIntervalSeconds = parseComplexCalendarExpression(onCalendar)
  }
  
  if (baseIntervalSeconds === 0) {
    throw new Error(`Unable to determine interval from OnCalendar expression: ${timerConfig.onCalendar}`)
  }
  
  // Apply buffer multiplier
  const gracePeriodSeconds = Math.ceil(baseIntervalSeconds * bufferMultiplier)
  
  debug(config, `Base interval: ${baseIntervalSeconds}s, Grace period: ${gracePeriodSeconds}s`)
  
  // Convert to human-readable format
  const gracePeriod = formatSecondsToTimespan(gracePeriodSeconds)
  
  debug(config, `Calculated grace period: ${gracePeriod} (base: ${baseIntervalSeconds}s, buffer: ${bufferMultiplier})`)
  
  return gracePeriod
}

/**
 * Parse complex systemd calendar expressions
 * @param {string} expression - OnCalendar expression
 * @returns {number} Interval in seconds, or 0 if unable to parse
 */
const parseComplexCalendarExpression = (expression) => {
  debug(config, `Parsing complex calendar expression: ${expression}`)
  
  // Handle expressions like "*:0/15" (every 15 minutes)
  if (expression.includes('/')) {
    const parts = expression.split('/')
    if (parts.length === 2) {
      const interval = parseInt(parts[1], 10)
      if (!isNaN(interval)) {
        if (expression.includes(':')) {
          // Minute-based interval
          return interval * 60
        } else {
          // Could be hour-based or other
          return interval * 60 * 60
        }
      }
    }
  }
  
  // Handle expressions like "Mon *-*-* 02:00:00" (weekly at 2 AM)
  if (expression.includes('mon') || expression.includes('tue') || expression.includes('wed') ||
      expression.includes('thu') || expression.includes('fri') || expression.includes('sat') ||
      expression.includes('sun')) {
    return 7 * 24 * 60 * 60 // Weekly
  }
  
  // Handle expressions with specific times like "*-*-* 02:00:00" (daily at 2 AM)
  if (expression.match(/\*-\*-\* \d{2}:\d{2}:\d{2}/)) {
    return 24 * 60 * 60 // Daily
  }
  
  // Handle expressions like "*-*-01 00:00:00" (monthly)
  if (expression.match(/\*-\*-\d{2} \d{2}:\d{2}:\d{2}/)) {
    return 30 * 24 * 60 * 60 // Monthly (approximate)
  }
  
  debug(config, `Unable to parse complex expression: ${expression}`)
  return 0
}

/**
 * Format seconds to human-readable timespan
 * @param {number} seconds - Number of seconds
 * @returns {string} Formatted timespan (e.g., "25h", "8d")
 */
const formatSecondsToTimespan = (seconds) => {
  if (seconds < 60) {
    return `${seconds}s`
  } else if (seconds < 3600) {
    const minutes = Math.ceil(seconds / 60)
    return `${minutes}m`
  } else if (seconds < 172800) { // Less than 2 days, use hours
    const hours = Math.ceil(seconds / 3600)
    return `${hours}h`
  } else {
    const days = Math.ceil(seconds / 86400)
    return `${days}d`
  }
}

/**
 * Parse grace period string using timespan-parser
 * @param {string} gracePeriod - Grace period string (e.g., "5m", "2h", "1d")
 * @returns {number} Grace period in seconds
 */
const parseGracePeriod = (gracePeriod) => {
  debug(config, `Parsing grace period: ${gracePeriod}`)
  
  try {
    // timespan-parser returns seconds for this library
    const seconds = parseTimespan(gracePeriod)
    
    debug(config, `Parsed grace period: ${seconds} seconds`)
    return seconds
    
  } catch (error) {
    debug(config, `Error parsing grace period: ${error.message}`)
    throw new Error(`Invalid grace period format '${gracePeriod}': ${error.message}`)
  }
}

/**
 * Validate grace period format and range
 * @param {string} gracePeriod - Grace period string
 * @returns {Object} Validation result with isValid and message
 */
const validateGracePeriod = (gracePeriod) => {
  try {
    const seconds = parseGracePeriod(gracePeriod)
    
    // Check minimum (10 seconds)
    if (seconds < 10) {
      return {
        isValid: false,
        message: 'Grace period must be at least 10 seconds',
        seconds: seconds,
      }
    }
    
    // Check maximum (30 days)
    if (seconds > 30 * 24 * 60 * 60) {
      return {
        isValid: false,
        message: 'Grace period must not exceed 30 days',
        seconds: seconds,
      }
    }
    
    return {
      isValid: true,
      message: 'Grace period is valid',
      seconds: seconds,
    }
    
  } catch (error) {
    return {
      isValid: false,
      message: error.message,
      seconds: 0,
    }
  }
}

/**
 * Get suggested grace periods for common intervals
 * @returns {Array<Object>} Array of suggested grace periods
 */
const getSuggestedGracePeriods = () => {
  return [
    { interval: 'Every minute', gracePeriod: '2m', description: 'For frequent health checks' },
    { interval: 'Every 5 minutes', gracePeriod: '6m', description: 'For regular monitoring' },
    { interval: 'Every 15 minutes', gracePeriod: '20m', description: 'For periodic checks' },
    { interval: 'Every 30 minutes', gracePeriod: '40m', description: 'For less frequent monitoring' },
    { interval: 'Hourly', gracePeriod: '75m', description: 'For hourly tasks' },
    { interval: 'Every 6 hours', gracePeriod: '8h', description: 'For periodic maintenance' },
    { interval: 'Daily', gracePeriod: '25h', description: 'For daily backups/tasks' },
    { interval: 'Weekly', gracePeriod: '8d', description: 'For weekly maintenance' },
    { interval: 'Monthly', gracePeriod: '32d', description: 'For monthly tasks' },
  ]
}

/**
 * Display systemd timer configuration in formatted way
 * @param {Object} timerConfig - Parsed timer configuration
 * @param {boolean} detailed - Show detailed information
 */
const displayTimerConfiguration = (timerConfig, detailed = false) => {
  output.section('Systemd Timer Configuration:')
  
  output.keyValue('File Path', timerConfig.filePath)
  
  if (timerConfig.onCalendar) {
    output.keyValue('OnCalendar', timerConfig.onCalendar)
  }
  
  if (timerConfig.persistent) {
    output.keyValue('Persistent', 'Yes')
  }
  
  if (timerConfig.unit) {
    output.keyValue('Unit', timerConfig.unit)
  }
  
  if (detailed) {
    if (timerConfig.accuracySec) {
      output.keyValue('Accuracy', timerConfig.accuracySec)
    }
    
    if (timerConfig.randomizedDelaySec) {
      output.keyValue('Randomized Delay', timerConfig.randomizedDelaySec)
    }
    
    if (timerConfig.onBootSec) {
      output.keyValue('OnBootSec', timerConfig.onBootSec)
    }
    
    if (timerConfig.onStartupSec) {
      output.keyValue('OnStartupSec', timerConfig.onStartupSec)
    }
    
    if (timerConfig.onUnitActiveSec) {
      output.keyValue('OnUnitActiveSec', timerConfig.onUnitActiveSec)
    }
    
    if (timerConfig.onUnitInactiveSec) {
      output.keyValue('OnUnitInactiveSec', timerConfig.onUnitInactiveSec)
    }
  }
}

/**
 * Display grace period information
 * @param {string} gracePeriod - Grace period string
 * @param {Object} validation - Validation result
 */
const displayGracePeriodInfo = (gracePeriod, validation) => {
  output.section('Grace Period Information:')
  
  output.keyValue('Grace Period', gracePeriod)
  output.keyValue('Duration (seconds)', validation.seconds)
  output.keyValue('Duration (formatted)', formatSecondsToTimespan(validation.seconds))
  
  if (validation.isValid) {
    output.success('Grace period is valid')
  } else {
    output.error(`Invalid grace period: ${validation.message}`)
  }
}

/**
 * Display suggested grace periods
 */
const displaySuggestedGracePeriods = () => {
  output.section('Suggested Grace Periods:')
  
  const suggestions = getSuggestedGracePeriods()
  
  suggestions.forEach(suggestion => {
    output.keyValue(suggestion.interval, `${suggestion.gracePeriod} - ${suggestion.description}`)
  })
}

/**
 * Check if a file path looks like a systemd timer file
 * @param {string} filePath - File path to check
 * @returns {boolean} True if it looks like a timer file
 */
const isSystemdTimerFile = (filePath) => {
  return filePath.endsWith('.timer') || filePath.includes('systemd')
}

/**
 * Get common systemd timer file locations
 * @returns {Array<string>} Array of common timer file paths
 */
const getCommonTimerLocations = () => {
  return [
    '/etc/systemd/system/',
    '/lib/systemd/system/',
    '/usr/lib/systemd/system/',
    '/run/systemd/system/',
    '~/.config/systemd/user/',
  ]
}

// Export all functions
export {
  parseSystemdTimerFile,
  calculateGracePeriodFromTimer,
  parseComplexCalendarExpression,
  formatSecondsToTimespan,
  parseGracePeriod,
  validateGracePeriod,
  getSuggestedGracePeriods,
  displayTimerConfiguration,
  displayGracePeriodInfo,
  displaySuggestedGracePeriods,
  isSystemdTimerFile,
  getCommonTimerLocations,
}

// Export default object for convenience
export default {
  parseSystemdTimerFile,
  calculateGracePeriodFromTimer,
  parseGracePeriod,
  validateGracePeriod,
  getSuggestedGracePeriods,
  displayTimerConfiguration,
  displayGracePeriodInfo,
  displaySuggestedGracePeriods,
  isSystemdTimerFile,
  getCommonTimerLocations,
  formatSecondsToTimespan,
}