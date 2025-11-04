/**
 * Health Check Command Implementation
 * 
 * This module handles the health check command functionality including
 * argument validation, grace period parsing, and API calls.
 * 
 * IMPORTANT: The health check exit code is determined ONLY by the command execution result.
 * API failures (network issues, service downtime, authentication errors) are logged as 
 * warnings but do NOT affect the exit code. This ensures that container orchestrators 
 * (Kubernetes, Docker, etc.) get accurate health status based on the actual service 
 * state, not on the availability of the HelpMeTest API.
 */

import os from 'os'
import { output } from '../utils/colors.js'
import { config, configUtils, validateConfiguration } from '../utils/config.js'
import { collectSystemMetrics } from '../utils/metrics.js'
import { createApiClient } from '../utils/api.js'
import { fetchWithTimeout } from '../utils/fetch-with-timeout.js'
import {
  parseSystemdTimerFile,
  calculateGracePeriodFromTimer,
  validateGracePeriod,
  displayTimerConfiguration,
  displayGracePeriodInfo,
  isSystemdTimerFile,
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
async function healthCommand(name, gracePeriod, command, options) {
  configUtils.debug('Starting health check command')

  const startTime = Date.now()
  
  // Execute commands if provided
  let commandResults = []
  if (command && command.length > 0) {
    // Each command is treated as a separate string
    for (const commandStr of command) {
      const commandStartTime = Date.now()
      
      try {
        let result = null
        
        // Special case 1: Port check syntax ":port"
        if (/^:\d+$/.test(commandStr)) {
          const port = parseInt(commandStr.slice(1))
          const { createServer } = await import('net')
          
          result = await new Promise((resolve) => {
            const server = createServer()
            server.on('error', (error) => {
              resolve({
                success: false,
                exitCode: 1,
                error: `Port ${port} is not available: ${error.message}`,
                elapsedTime: Date.now() - commandStartTime,
                command: commandStr,
              })
            })
            
            server.listen(port, () => {
              server.close()
              resolve({
                success: true,
                exitCode: 0,
                elapsedTime: Date.now() - commandStartTime,
                command: commandStr,
              })
            })
          })
        }
        // Special case 2: HTTP health check syntax "GET /health" or "POST /health"
        else if (/^(GET|POST)\s+\S+$/.test(commandStr)) {
          const [method, url] = commandStr.split(' ')
          result = await performHttpHealthCheck(url, method, commandStartTime)
        }
        // Special case 3: File age check syntax "file-updated 2m /path/to/file"
        else if (commandStr.startsWith('file-updated ')) {
          result = await performFileAgeHealthCheck(commandStr, commandStartTime)
        }
        // Default case: Execute shell command
        else {
          const { execSync } = await import('child_process')
          execSync(commandStr)
          result = {
            success: true,
            exitCode: 0,
            elapsedTime: Date.now() - commandStartTime,
            command: commandStr,
          }
        }
        
        commandResults.push(result)
        
      } catch (error) {
        commandResults.push({
          success: false,
          exitCode: error.status || 1,
          error: error.message,
          elapsedTime: Date.now() - commandStartTime,
          command: commandStr,
        })
      }
    }
  }
  
  // Validate configuration - but don't fail the health check if invalid
  // Configuration issues should not prevent the actual health check from running
  const configValid = validateConfiguration(config, options.verbose)
  if (!configValid) {
    output.warning('⚠ Configuration validation failed - API reporting will be disabled')
    if (options.verbose) {
      output.info('Please set HELPMETEST_API_TOKEN environment variable for API reporting')
    }
  }
  
  try {
    // Step 1: Validate and process arguments
    const processedArgs = await validateAndProcessArguments(name, gracePeriod, options)

    // Step 2: Collect system metrics (skip if --skip-metrics flag is set for faster health checks)
    const metrics = options.skipMetrics ? {
      hostname: os.hostname(),
      ip_address: '127.0.0.1',
      cpu_usage: 0,
      memory_usage: 0,
      disk_usage: 0,
    } : await collectSystemMetrics()

    // Step 3: Calculate elapsed time for the health check operation
    const elapsedTime = Date.now() - startTime
    
    // Step 4: Prepare heartbeat data
    const heartbeatData = prepareHeartbeatData(processedArgs, metrics, elapsedTime, commandResults)
    
    // Step 5: Display information (if verbose or dry-run)
    if (options.verbose || options.dryRun) {
      displayHealthCheckInfo(processedArgs, heartbeatData, options)
    }
    
    // Step 6: Send heartbeat (unless dry-run, no-api, or config invalid)
    if (options.api === false) {
      // Skip API call entirely for fast local health checks
      if (options.verbose) {
        output.warning('⚠ Skipping API heartbeat (--no-api flag)')
      }
    } else if (!options.dryRun && configValid) {
      // Use a short timeout (3s) to prevent blocking K8s probes
      // K8s probes typically timeout after 5-10s, so we need to fail fast
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('API heartbeat timeout (3s)')), 3000)
      )

      try {
        await Promise.race([
          sendHeartbeat(processedArgs, heartbeatData, options),
          timeoutPromise
        ])
      } catch (apiError) {
        // CRITICAL: API failures should not affect the health check result
        // This ensures that if slava.helpmetest.com is down, it doesn't cause
        // Kubernetes to kill healthy pods. Only the actual command result matters.
        output.warning(`⚠ Failed to send heartbeat to API: ${apiError.message}`)
        if (options.verbose) {
          output.section('API Error Details:')
          console.error(apiError)
        }
      }
    } else if (!options.dryRun && !configValid) {
      output.warning('⚠ Skipping API heartbeat due to configuration issues')
    } else {
      output.warning('Dry run mode - heartbeat not sent')
    }

    // Exit with command result status regardless of API success/failure
    // If any command failed, exit with the first failure's exit code
    const failedCommand = commandResults.find(result => !result.success)
    if (failedCommand) {
      process.exit(failedCommand.exitCode)
    }

    // Success - exit immediately
    process.exit(0)

  } catch (error) {
    // Only fail for non-API errors (validation, system errors, etc.)
    output.error(`⨯ Health check failed: ${error.message}`)

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
 * @param {number} elapsedTime - Elapsed time in milliseconds (optional)
 * @returns {Object} Heartbeat data
 */
function prepareHeartbeatData(processedArgs, metrics, elapsedTime = 0, commandResults = []) {
  configUtils.debug('Preparing heartbeat data')
  
  const envConfig = configUtils.getEnvironmentConfig()
  
  // Determine overall status - PASS only if all commands passed
  const allCommandsSucceeded = commandResults.length === 0 || commandResults.every(result => result.success)
  
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
    environment: envConfig.environment || 'dev',
    elapsed_time: elapsedTime,
    custom_data: envConfig.customData || {},
    status: allCommandsSucceeded ? 'PASS' : 'FAIL',
  }

  // Add command execution information if available
  if (commandResults.length > 0) {
    heartbeatData.commands_info = commandResults.map(result => ({
      command: result.command,
      success: result.success,
      exit_code: result.exitCode,
      elapsed_time: result.elapsedTime,
      error: result.error,
      file_results: result.fileResults, // For file age checks
    }))
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

  // Display command execution status if available
  if (heartbeatData.commands_info && heartbeatData.commands_info.length > 0) {
    output.section('Command Execution:')
    
    heartbeatData.commands_info.forEach((cmdInfo, index) => {
      if (heartbeatData.commands_info.length > 1) {
        output.keyValue(`Command ${index + 1}`, cmdInfo.command)
      } else {
        output.keyValue('Command', cmdInfo.command)
      }
      output.keyValue('Status', cmdInfo.success ? 'Success' : 'Failed')
      output.keyValue('Exit Code', cmdInfo.exit_code)
      output.keyValue('Execution Time', `${cmdInfo.elapsed_time}ms`)
      
      if (cmdInfo.error) {
        output.keyValue('Error', cmdInfo.error)
      }
      
      // Display file results for file age checks
      if (cmdInfo.file_results && cmdInfo.file_results.length > 0) {
        output.keyValue('File Check Results', '')
        cmdInfo.file_results.forEach(fileResult => {
          const status = fileResult.isValid ? '✓' : '✗'
          if (fileResult.exists) {
            output.keyValue(`  ${status} ${fileResult.path}`, `${fileResult.ageSeconds}s old (max: ${fileResult.maxAgeSeconds}s)`)
          } else {
            output.keyValue(`  ${status} ${fileResult.path}`, 'File not found')
          }
        })
      }
      
      if (index < heartbeatData.commands_info.length - 1) {
        console.log() // Add spacing between commands
      }
    })
    
    console.log()
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
  output.keyValue('Environment', heartbeatData.environment)
  output.keyValue('Elapsed Time', `${heartbeatData.elapsed_time}ms`)
  
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
 * Perform HTTP health check
 * @param {string} url - URL to check
 * @param {string} method - HTTP method (GET or POST)
 * @param {number} startTime - Start time for elapsed calculation
 * @returns {Object} Health check result
 */
async function performHttpHealthCheck(url, method, startTime) {
  let finalUrl

  // Handle URLs with hostname:port format
  if (url.match(/^[\w.-]+:\d+/)) {
    finalUrl = `http://${url}`
  } else {
    finalUrl = url.startsWith('http') ? url : `http://localhost${url.startsWith('/') ? '' : '/'}${url}`
  }

  try {
    // Use fetchWithTimeout for consistent timeout handling (5s)
    const response = await fetchWithTimeout(finalUrl, { method }, 5000)
    const ok = response.status >= 200 && response.status < 300

    return {
      success: ok,
      exitCode: ok ? 0 : 1,
      error: ok ? null : `HTTP ${response.status} ${response.statusText}`,
      elapsedTime: Date.now() - startTime,
      command: `${method} ${url}`,
      url: finalUrl,
      status: response.status,
      statusText: response.statusText,
    }
  } catch (error) {
    return {
      success: false,
      exitCode: 1,
      error: error.message,
      elapsedTime: Date.now() - startTime,
      command: `${method} ${url}`,
      url: finalUrl,
    }
  }
}

/**
 * Perform file age health check
 * @param {string} commandStr - Command string like "file-updated 2m /tmp/service.live"
 * @param {number} startTime - Start time for elapsed calculation
 * @returns {Object} Health check result
 */
async function performFileAgeHealthCheck(commandStr, startTime) {
  const { stat } = await import('fs/promises')
  const ms = (await import('ms')).default
  
  // Parse command: "file-updated 2m /path"
  const parts = commandStr.split(' ')
  if (parts.length !== 3) {
    return {
      success: false,
      exitCode: 1,
      error: 'Invalid file-updated syntax. Expected: file-updated 2m /path/to/file',
      elapsedTime: Date.now() - startTime,
      command: commandStr,
    }
  }
  
  const [, maxAgeStr, filePath] = parts
  
  // Parse duration using ms module
  let maxAgeMs
  try {
    maxAgeMs = ms(maxAgeStr)
    if (!maxAgeMs || maxAgeMs <= 0) {
      throw new Error('Invalid duration')
    }
  } catch (error) {
    return {
      success: false,
      exitCode: 1,
      error: `Invalid duration: ${maxAgeStr}. Use format like '2m', '30s', '1h'`,
      elapsedTime: Date.now() - startTime,
      command: commandStr,
    }
  }
  
  const maxAgeSeconds = Math.floor(maxAgeMs / 1000)
  
  const now = Date.now()
  let result
  
  try {
    const stats = await stat(filePath)
    const ageMs = now - stats.mtime.getTime()
    const ageSeconds = Math.floor(ageMs / 1000)
    const isValid = ageMs <= maxAgeMs
    
    result = {
      path: filePath,
      exists: true,
      ageSeconds,
      maxAgeSeconds,
      isValid,
      lastModified: stats.mtime.toISOString(),
    }
  } catch (error) {
    result = {
      path: filePath,
      exists: false,
      error: error.message,
      isValid: false,
    }
  }
  
  let errorMessage = null
  if (!result.isValid) {
    if (!result.exists) {
      errorMessage = `File not found: ${result.path} (${result.error})`
    } else {
      errorMessage = `File too old: ${result.path} (${result.ageSeconds}s > ${result.maxAgeSeconds}s)`
    }
  }
  
  return {
    success: result.isValid,
    exitCode: result.isValid ? 0 : 1,
    error: errorMessage,
    elapsedTime: Date.now() - startTime,
    command: commandStr,
    fileResults: [result], // Keep as array for consistent display logic
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
  
  const apiStartTime = Date.now()
  
  const endpoint = `/api/healthcheck/${encodeURIComponent(processedArgs.name)}/${encodeURIComponent(processedArgs.gracePeriod)}`
  try {
    // Construct API endpoint
    
    configUtils.debug(`API endpoint: ${endpoint}`)
    
    // Create API client and send POST request
    const apiClient = createApiClient()
    const response = await apiClient.post(endpoint, heartbeatData)
    
    const apiDuration = Date.now() - apiStartTime
    const totalDuration = heartbeatData.elapsed_time + apiDuration
    
    if (response.status > 200) {
      throw response
    }

    if (!options.verbose) {
      const message = `Health check sent ${heartbeatData.status === 'PASS' ? 'successfully' : 'as failed'} (API: ${apiDuration}ms, Total: ${totalDuration}ms)`
      if (heartbeatData.status === 'PASS') {
        output.success(`${message}`)
      } else {
        output.error(`${message}`)
      }
    } else {
      output.section('API Response:')
      output.keyValue('Status', 'Success')
      output.keyValue('API Duration', `${apiDuration}ms`)
      output.keyValue('Total Duration', `${totalDuration}ms`)
      output.keyValue('Response Status', response.status)
      
      if (response.data) {
        output.keyValue('Response Data', JSON.stringify(response.data, null, 2))
      }
      
      output.success('Health check heartbeat sent successfully')
    }
    configUtils.debug(`Heartbeat sent successfully in ${apiDuration}ms (total: ${totalDuration}ms)`)
    
  } catch (error) {
    const apiDuration = Date.now() - apiStartTime
    const totalDuration = heartbeatData.elapsed_time + apiDuration
    
    configUtils.debug(`Heartbeat failed after ${apiDuration}ms (total: ${totalDuration}ms): ${error.message}`)
    
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
        throw new Error(`Server error (${status}): ${statusText} ${endpoint}`)
      } else {
        throw new Error(`API error (${status}): ${statusText}`)
      }
    } else if (error.request) {
      // Network error - connection issues, DNS resolution, etc.
      throw new Error(`Network error: Unable to reach HelpMeTest API (${config.apiBaseUrl})`)
    } else {
      // Other error
      throw new Error(`Request failed: ${error.message}`)
    }
  }
}

export default healthCommand
export { performHttpHealthCheck }