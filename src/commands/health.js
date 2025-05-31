/**
 * Health Check Command Implementation
 * 
 * This module handles the health check command functionality including
 * argument validation, grace period parsing, and API calls.
 */

import { output } from '../utils/colors.js'
import { config, configUtils, validateConfiguration } from '../utils/config.js'
import { collectSystemMetrics } from '../utils/metrics.js'
import { createApiClient } from '../utils/api.js'
import { 
  parseSystemdTimerFile, 
  calculateGracePeriodFromTimer, 
  validateGracePeriod,
  displayTimerConfiguration,
  displayGracePeriodInfo,
  isSystemdTimerFile
} from '../utils/systemd.js'

/**
 * Health check command handler
 * @param {string} name - Health check name
 * @param {string} gracePeriod - Grace period string (e.g., "5m", "30s")
 * @param {Object} options - Command options
 * @param {string} options.fromTimer - Systemd timer file to parse
 * @param {boolean} options.dryRun - Show what would be sent without sending
 * @param {boolean} options.verbose - Show detailed output
 */
async function healthCommand(name, gracePeriod, options) {
  configUtils.debug('Starting health check command')
  
  // Validate configuration first
  if (!validateConfiguration(config, options.verbose)) {
    output.error('Configuration validation failed')
    output.info('Please set HELPMETEST_API_TOKEN environment variable')
    process.exit(1)
  }
  
  try {
    // Step 1: Validate and process arguments
    const processedArgs = await validateAndProcessArguments(name, gracePeriod, options)
    
    // Step 2: Collect system metrics
    const metrics = await collectSystemMetrics()
    
    // Step 3: Prepare heartbeat data
    const heartbeatData = prepareHeartbeatData(processedArgs, metrics)
    
    // Step 4: Display information (if verbose or dry-run)
    if (options.verbose || options.dryRun) {
      displayHealthCheckInfo(processedArgs, heartbeatData, options)
    }
    
    // Step 5: Send heartbeat (unless dry-run)
    if (!options.dryRun) {
      await sendHeartbeat(processedArgs, heartbeatData, options)
    } else {
      output.warning('Dry run mode - heartbeat not sent')
    }
    
  } catch (error) {
    output.error(`Health check failed: ${error.message}`)
    
    if (options.verbose) {
      output.section('Error Details:')
      console.error(error)
    }
    
    process.exit(1)
  }
}

/**
 * Validate and process command arguments
 * @param {string} name - Health check name
 * @param {string} gracePeriod - Grace period string
 * @param {Object} options - Command options
 * @returns {Object} Processed arguments
 */
async function validateAndProcessArguments(name, gracePeriod, options) {
  configUtils.debug('Validating and processing arguments')
  
  // Validate health check name
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Health check name is required and cannot be empty')
  }
  
  const cleanName = name.trim()
  
  // Validate name format (alphanumeric, hyphens, underscores, dots)
  if (!/^[a-zA-Z0-9._-]+$/.test(cleanName)) {
    throw new Error('Health check name can only contain letters, numbers, dots, hyphens, and underscores')
  }
  
  // Validate name length
  if (cleanName.length > 100) {
    throw new Error('Health check name cannot exceed 100 characters')
  }
  
  let finalGracePeriod = gracePeriod
  let timerConfig = null
  
  // Handle --from-timer option
  if (options.fromTimer) {
    configUtils.debug(`Parsing timer file: ${options.fromTimer}`)
    
    if (!isSystemdTimerFile(options.fromTimer)) {
      output.warning(`File '${options.fromTimer}' does not appear to be a systemd timer file`)
    }
    
    try {
      timerConfig = parseSystemdTimerFile(options.fromTimer)
      finalGracePeriod = calculateGracePeriodFromTimer(timerConfig)
      
      configUtils.debug(`Grace period from timer: ${finalGracePeriod}`)
      
    } catch (error) {
      throw new Error(`Failed to parse timer file: ${error.message}`)
    }
  }
  
  // Validate grace period
  if (!finalGracePeriod || typeof finalGracePeriod !== 'string' || finalGracePeriod.trim().length === 0) {
    throw new Error('Grace period is required and cannot be empty')
  }
  
  const validation = validateGracePeriod(finalGracePeriod.trim())
  
  if (!validation.isValid) {
    throw new Error(`Invalid grace period: ${validation.message}`)
  }
  
  return {
    name: cleanName,
    gracePeriod: finalGracePeriod.trim(),
    gracePeriodSeconds: validation.seconds,
    timerConfig: timerConfig,
    validation: validation,
  }
}

/**
 * Prepare heartbeat data for API call
 * @param {Object} processedArgs - Processed arguments
 * @param {Object} metrics - System metrics
 * @returns {Object} Heartbeat data
 */
function prepareHeartbeatData(processedArgs, metrics) {
  configUtils.debug('Preparing heartbeat data')
  
  const envConfig = configUtils.getEnvironmentConfig()
  
  const heartbeatData = {
    name: processedArgs.name,
    grace_period: processedArgs.gracePeriod,
    grace_period_seconds: processedArgs.gracePeriodSeconds,
    timestamp: new Date().toISOString(),
    hostname: metrics.hostname,
    ip_address: metrics.ip_address,
    system_metrics: {
      cpu_usage: metrics.cpu_usage,
      memory_usage: metrics.memory_usage,
      disk_usage: metrics.disk_usage,
    },
    platform_info: metrics.platform,
    environment: envConfig.environment || null,
    custom_data: envConfig.customData || {},
  }
  
  // Add timer information if available
  if (processedArgs.timerConfig) {
    heartbeatData.timer_info = {
      file_path: processedArgs.timerConfig.filePath,
      on_calendar: processedArgs.timerConfig.onCalendar,
      persistent: processedArgs.timerConfig.persistent,
    }
  }
  
  return heartbeatData
}

/**
 * Display health check information
 * @param {Object} processedArgs - Processed arguments
 * @param {Object} heartbeatData - Heartbeat data
 * @param {Object} options - Command options
 */
function displayHealthCheckInfo(processedArgs, heartbeatData, options) {
  if (!options.dryRun) {
    output.title('Health Check Heartbeat')
  } else {
    output.title('Health Check Heartbeat (Dry Run)')
  }
  
  output.section('Health Check Configuration:')
  output.keyValue('Name', processedArgs.name)
  output.keyValue('Grace Period', processedArgs.gracePeriod)
  output.keyValue('Grace Period (seconds)', processedArgs.gracePeriodSeconds)
  
  // Display timer information if available
  if (processedArgs.timerConfig) {
    console.log()
    displayTimerConfiguration(processedArgs.timerConfig, options.verbose)
  }
  
  // Display grace period validation
  if (options.verbose) {
    console.log()
    displayGracePeriodInfo(processedArgs.gracePeriod, processedArgs.validation)
  }
  
  // Display system information
  output.section('System Information:')
  output.keyValue('Hostname', heartbeatData.hostname)
  output.keyValue('IP Address', heartbeatData.ip_address)
  output.keyValue('Timestamp', heartbeatData.timestamp)
  
  if (heartbeatData.environment) {
    output.keyValue('Environment', heartbeatData.environment)
  }
  
  // Display system metrics
  output.section('System Metrics:')
  output.keyValue('CPU Usage', `${heartbeatData.system_metrics.cpu_usage}%`)
  output.keyValue('Memory Usage', `${heartbeatData.system_metrics.memory_usage}%`)
  output.keyValue('Disk Usage', `${heartbeatData.system_metrics.disk_usage}%`)
  
  // Display custom data if available
  if (Object.keys(heartbeatData.custom_data).length > 0) {
    output.section('Custom Data:')
    Object.entries(heartbeatData.custom_data).forEach(([key, value]) => {
      const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      output.keyValue(displayKey, value)
    })
  }
  
  // Display API configuration if verbose
  if (options.verbose) {
    output.section('API Configuration:')
    output.keyValue('Base URL', config.apiBaseUrl)
    output.keyValue('Timeout', `${config.timeout}ms`)
    output.keyValue('Retries', config.retries)
  }
}

/**
 * Send heartbeat to API
 * @param {Object} processedArgs - Processed arguments
 * @param {Object} heartbeatData - Heartbeat data
 * @param {Object} options - Command options
 */
async function sendHeartbeat(processedArgs, heartbeatData, options) {
  configUtils.debug('Sending heartbeat to API')
  
  const startTime = Date.now()
  
  try {
    // Construct API endpoint
    const endpoint = `/api/healthcheck/${encodeURIComponent(processedArgs.name)}/${encodeURIComponent(processedArgs.gracePeriod)}`
    
    configUtils.debug(`API endpoint: ${endpoint}`)
    
    // Create API client and send POST request
    const apiClient = createApiClient()
    const response = await apiClient.post(endpoint, heartbeatData)
    
    const duration = Date.now() - startTime
    
    // Display success message
    if (!options.verbose) {
      output.success(`Health check sent successfully (${duration}ms)`)
    } else {
      output.section('API Response:')
      output.keyValue('Status', 'Success')
      output.keyValue('Duration', `${duration}ms`)
      output.keyValue('Response Status', response.status)
      
      if (response.data) {
        output.keyValue('Response Data', JSON.stringify(response.data, null, 2))
      }
      
      output.success('Health check heartbeat sent successfully')
    }
    
    configUtils.debug(`Heartbeat sent successfully in ${duration}ms`)
    
  } catch (error) {
    const duration = Date.now() - startTime
    
    configUtils.debug(`Heartbeat failed after ${duration}ms: ${error.message}`)
    
    // Handle different types of API errors
    if (error.response) {
      // Server responded with error status
      const status = error.response.status
      const statusText = error.response.statusText || 'Unknown Error'
      
      if (status === 401) {
        throw new Error('Authentication failed - please check your HELPMETEST_API_TOKEN')
      } else if (status === 403) {
        throw new Error('Access forbidden - insufficient permissions')
      } else if (status === 404) {
        throw new Error('API endpoint not found - please check your API URL')
      } else if (status === 429) {
        throw new Error('Rate limit exceeded - please try again later')
      } else if (status >= 500) {
        throw new Error(`Server error (${status}): ${statusText}`)
      } else {
        throw new Error(`API error (${status}): ${statusText}`)
      }
    } else if (error.request) {
      // Network error
      throw new Error(`Network error: Unable to reach API server at ${config.apiBaseUrl}`)
    } else {
      // Other error
      throw new Error(`Request failed: ${error.message}`)
    }
  }
}

export default healthCommand