/**
 * Configuration Management Utility
 * 
 * Handles environment variables, API settings, and configuration validation
 * for the HelpMeTest CLI application using functional approach.
 */

// Load environment variables from .env file first
import 'dotenv/config'

import { output } from './colors.js'
import { getUserAgent } from './version.js'

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  apiBaseUrl: 'https://helpmetest.com',
  timeout: 30000, // 30 seconds
  retries: 3,
  userAgent: getUserAgent(),
}

/**
 * Get all custom environment variables starting with HELPMETEST_ (excluding known config vars)
 * @returns {Object} Custom health data
 */
const getHealthEnvironmentVariables = () => {
  const healthVars = {}
  const excludedKeys = new Set([
    'HELPMETEST_API_TOKEN',
    'HELPMETEST_API_URL', 
    'HELPMETEST_TIMEOUT',
    'HELPMETEST_RETRIES',
    'HELPMETEST_DEBUG',
  ])
  
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('HELPMETEST_') && !excludedKeys.has(key)) {
      // Convert HELPMETEST_DATABASE_VERSION to database_version
      const cleanKey = key.substring(11).toLowerCase() // Remove HELPMETEST_ prefix
      healthVars[cleanKey] = process.env[key]
    }
  })

  return healthVars
}

/**
 * Load configuration from environment variables
 * @returns {Object} Configuration object
 */
const loadConfiguration = () => {
  const config = { ...DEFAULT_CONFIG }

  // API Configuration
  if (process.env.HELPMETEST_API_URL) {
    config.apiBaseUrl = process.env.HELPMETEST_API_URL
  }

  if (process.env.HELPMETEST_API_TOKEN) {
    config.apiToken = process.env.HELPMETEST_API_TOKEN
  }

  // Timeout configuration
  if (process.env.HELPMETEST_TIMEOUT) {
    const timeout = parseInt(process.env.HELPMETEST_TIMEOUT, 10)
    if (!isNaN(timeout) && timeout > 0) {
      config.timeout = timeout * 1000 // Convert to milliseconds
    }
  }

  // Retry configuration
  if (process.env.HELPMETEST_RETRIES) {
    const retries = parseInt(process.env.HELPMETEST_RETRIES, 10)
    if (!isNaN(retries) && retries >= 0) {
      config.retries = retries
    }
  }

  // Environment identifier
  if (process.env.ENV) {
    config.environment = process.env.ENV
  }

  // Custom health data (any env var starting with HELPMETEST_ excluding known config vars)
  config.customData = getHealthEnvironmentVariables()

  // Debug mode
  if (process.env.HELPMETEST_DEBUG) {
    config.debug = process.env.HELPMETEST_DEBUG.toLowerCase() === 'true'
  }

  return config
}

/**
 * Validate configuration
 * @param {Object} config - Configuration object
 * @param {boolean} verbose - Show detailed validation output
 * @returns {boolean} True if configuration is valid
 */
const validateConfiguration = (config, verbose = false) => {
  const errors = []
  const warnings = []

  // Check required API token
  if (!config.apiToken) {
    errors.push('HELPMETEST_API_TOKEN environment variable is required')
  }

  // Validate API URL format
  if (config.apiBaseUrl) {
    try {
      new URL(config.apiBaseUrl)
    } catch (error) {
      errors.push(`Invalid API URL format: ${config.apiBaseUrl}`)
    }
  }

  // Check timeout range
  if (config.timeout < 1000 || config.timeout > 300000) {
    warnings.push(`Timeout ${config.timeout}ms is outside recommended range (1-300 seconds)`)
  }

  // Check retries range
  if (config.retries > 10) {
    warnings.push(`Retry count ${config.retries} is higher than recommended (max 10)`)
  }

  // Display validation results if verbose
  if (verbose) {
    if (errors.length === 0 && warnings.length === 0) {
      output.success('Configuration validation passed')
    }

    if (warnings.length > 0) {
      output.section('Configuration Warnings:')
      warnings.forEach(warning => output.warning(warning))
    }

    if (errors.length > 0) {
      output.section('Configuration Errors:')
      errors.forEach(error => output.error(error))
    }
  }

  return errors.length === 0
}

/**
 * Display current configuration (for debugging)
 * @param {Object} config - Configuration object
 * @param {boolean} showSensitive - Whether to show sensitive data like API tokens
 */
const displayConfiguration = (config, showSensitive = false) => {
  output.title('Current Configuration')

  output.section('API Settings:')
  output.keyValue('Base URL', config.apiBaseUrl)
  output.keyValue('API Token', showSensitive ? config.apiToken || 'Not set' : '***hidden***')
  output.keyValue('Timeout', `${config.timeout}ms`)
  output.keyValue('Retries', config.retries)
  output.keyValue('User Agent', config.userAgent)

  if (config.environment) {
    output.section('Environment:')
    output.keyValue('Environment', config.environment)
  }

  if (Object.keys(config.customData).length > 0) {
    output.section('Custom Health Data:')
    Object.entries(config.customData).forEach(([key, value]) => {
      output.keyValue(key, value)
    })
  }

  if (config.debug) {
    output.section('Debug:')
    output.keyValue('Debug Mode', 'Enabled')
  }
}

/**
 * Get API headers for requests
 * @param {Object} config - Configuration object
 * @returns {Object} Headers object
 */
const getApiHeaders = (config) => {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': config.userAgent,
  }

  if (config.apiToken) {
    headers['Authorization'] = `Bearer ${config.apiToken}`
  }

  return headers
}

/**
 * Get request configuration for axios
 * @param {Object} config - Configuration object
 * @returns {Object} Axios configuration
 */
const getRequestConfig = (config) => {
  return {
    baseURL: config.apiBaseUrl,
    timeout: config.timeout,
    headers: getApiHeaders(config),
    validateStatus: (status) => status < 500, // Don't throw on 4xx errors
  }
}

/**
 * Get environment-specific configuration
 * @param {Object} config - Configuration object
 * @returns {Object} Environment configuration
 */
const getEnvironmentConfig = (config) => {
  return {
    environment: config.environment,
    customData: config.customData,
    debug: config.debug,
  }
}

/**
 * Check if running in debug mode
 * @param {Object} config - Configuration object
 * @returns {boolean} True if debug mode is enabled
 */
const isDebugMode = (config) => {
  return config.debug === true
}

/**
 * Log debug message if debug mode is enabled
 * @param {Object} config - Configuration object
 * @param {string} message - Debug message
 */
const debug = (config, message) => {
  if (isDebugMode(config)) {
    output.verbose(`[DEBUG] ${message}`)
  }
}

/**
 * Ensure configuration is valid, exit if not
 * @param {Object} config - Configuration object
 * @param {boolean} verbose - Show validation details
 */
const validateOrExit = (config, verbose = false) => {
  if (!validateConfiguration(config, verbose)) {
    output.error('Configuration validation failed')
    output.info('Please check your environment variables and try again')
    process.exit(1)
  }
}

// Load configuration once at module level
const config = loadConfiguration()

// Export configuration object and utility functions
export {
  config,
  loadConfiguration,
  validateConfiguration,
  displayConfiguration,
  getApiHeaders,
  getRequestConfig,
  getEnvironmentConfig,
  isDebugMode,
  debug,
  validateOrExit,
}

// Export utility object for backward compatibility
export const configUtils = {
  validateOrExit: (verbose) => validateOrExit(config, verbose),
  getEnvironmentConfig: () => getEnvironmentConfig(config),
  isDebugMode: () => isDebugMode(config),
  debug: (message) => debug(config, message),
}