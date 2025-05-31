/**
 * API Client Utility
 * 
 * Handles authenticated requests to the HelpMeTest backend with proper
 * error handling, retries, and response processing.
 */

import axios from 'axios'
import { output } from './colors.js'
import { config, getRequestConfig, debug } from './config.js'

/**
 * API Error class for structured error handling
 */
class ApiError extends Error {
  /**
   * Create an API error
   * @param {string} message - Error message
   * @param {number} status - HTTP status code
   * @param {Object} response - Response data
   * @param {Object} request - Request configuration
   */
  constructor(message, status = null, response = null, request = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.response = response
    this.request = request
  }
}

/**
 * Create axios instance with default configuration
 * @returns {Object} Configured axios instance
 */
const createApiClient = () => {
  const requestConfig = getRequestConfig(config)
  const client = axios.create(requestConfig)

  // Request interceptor for debugging
  client.interceptors.request.use(
    (config) => {
      debug(config, `Making ${config.method?.toUpperCase()} request to ${config.url}`)
      return config
    },
    (error) => {
      debug(config, `Request error: ${error.message}`)
      return Promise.reject(error)
    },
  )

  // Response interceptor for debugging and error handling
  client.interceptors.response.use(
    (response) => {
      debug(config, `Response ${response.status} from ${response.config.url}`)
      return response
    },
    (error) => {
      debug(config, `Response error: ${error.message}`)
      return Promise.reject(error)
    },
  )

  return client
}

/**
 * Handle API errors and convert to structured format
 * @param {Error} error - Axios error object
 * @param {Object} requestInfo - Information about the request
 * @returns {ApiError} Structured API error
 */
const handleApiError = (error, requestInfo = {}) => {
  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response
    const message = data?.message || data?.error || `HTTP ${status} error`
    
    debug(config, `API Error ${status}: ${message}`)
    
    return new ApiError(
      message,
      status,
      data,
      requestInfo,
    )
  } else if (error.request) {
    // Request was made but no response received
    const message = 'No response received from server'
    debug(config, `Network Error: ${message}`)
    
    return new ApiError(
      message,
      null,
      null,
      requestInfo,
    )
  } else {
    // Something else happened
    const message = error.message || 'Unknown error occurred'
    debug(config, `Request Error: ${message}`)
    
    return new ApiError(
      message,
      null,
      null,
      requestInfo,
    )
  }
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} retries - Number of retries
 * @param {number} delay - Initial delay in milliseconds
 * @returns {Promise} Result of the function
 */
const retryWithBackoff = async (fn, retries = config.retries, delay = 1000) => {
  try {
    return await fn()
  } catch (error) {
    if (retries > 0 && shouldRetry(error)) {
      debug(config, `Retrying request in ${delay}ms (${retries} retries left)`)
      await new Promise(resolve => setTimeout(resolve, delay))
      return retryWithBackoff(fn, retries - 1, delay * 2)
    }
    throw error
  }
}

/**
 * Determine if an error should trigger a retry
 * @param {Error} error - Error to check
 * @returns {boolean} True if should retry
 */
const shouldRetry = (error) => {
  // Retry on network errors
  if (!error.response) {
    return true
  }

  // Retry on server errors (5xx)
  if (error.response.status >= 500) {
    return true
  }

  // Retry on rate limiting (429)
  if (error.response.status === 429) {
    return true
  }

  // Don't retry on client errors (4xx)
  return false
}

/**
 * Send health check heartbeat to the API
 * @param {string} name - Health check name
 * @param {string} gracePeriod - Grace period string
 * @param {Object} heartbeatData - Additional heartbeat data
 * @returns {Promise<Object>} API response
 */
const sendHealthCheckHeartbeat = async (name, gracePeriod, heartbeatData = {}) => {
  const client = createApiClient()
  
  const requestInfo = {
    name,
    gracePeriod,
    endpoint: `/api/healthcheck/${encodeURIComponent(name)}/${encodeURIComponent(gracePeriod)}`,
  }

  debug(config, `Sending heartbeat for ${name} with grace period ${gracePeriod}`)

  try {
    const response = await retryWithBackoff(async () => {
      return await client.post(requestInfo.endpoint, heartbeatData)
    })

    debug(config, `Heartbeat sent successfully: ${response.status}`)
    return response.data
  } catch (error) {
    throw handleApiError(error, requestInfo)
  }
}

/**
 * Get health check details from the API
 * @param {string} name - Health check name
 * @returns {Promise<Object>} Health check data
 */
const getHealthCheck = async (name) => {
  const client = createApiClient()
  
  const requestInfo = {
    name,
    endpoint: `/api/healthcheck/${encodeURIComponent(name)}`,
  }

  debug(config, `Getting health check details for ${name}`)

  try {
    const response = await retryWithBackoff(async () => {
      return await client.get(requestInfo.endpoint)
    })

    debug(config, `Health check details retrieved: ${response.status}`)
    return response.data
  } catch (error) {
    throw handleApiError(error, requestInfo)
  }
}

/**
 * Get all health checks from the API
 * @param {Object} filters - Optional filters
 * @returns {Promise<Object>} List of health checks
 */
const getAllHealthChecks = async (filters = {}) => {
  const client = createApiClient()
  
  const requestInfo = {
    endpoint: '/api/healthchecks',
    filters,
  }

  debug(config, 'Getting all health checks')

  try {
    const response = await retryWithBackoff(async () => {
      return await client.get(requestInfo.endpoint, { params: filters })
    })

    debug(config, `Health checks retrieved: ${response.status}`)
    return response.data
  } catch (error) {
    throw handleApiError(error, requestInfo)
  }
}

/**
 * Test API connectivity and authentication
 * @returns {Promise<Object>} Connection test result
 */
const testConnection = async () => {
  const client = createApiClient()
  
  const requestInfo = {
    endpoint: '/api/health',
  }

  debug(config, 'Testing API connection')

  try {
    const response = await client.get(requestInfo.endpoint)
    
    debug(config, `Connection test successful: ${response.status}`)
    return {
      success: true,
      status: response.status,
      data: response.data,
    }
  } catch (error) {
    const apiError = handleApiError(error, requestInfo)
    
    return {
      success: false,
      error: apiError,
    }
  }
}

/**
 * Display API error in user-friendly format
 * @param {ApiError} error - API error to display
 * @param {boolean} verbose - Show detailed error information
 */
const displayApiError = (error, verbose = false) => {
  output.error(`API Error: ${error.message}`)

  if (error.status) {
    output.keyValue('Status Code', error.status)
  }

  if (error.request?.endpoint) {
    output.keyValue('Endpoint', error.request.endpoint)
  }

  if (verbose && error.response) {
    output.section('Response Details:')
    console.log(JSON.stringify(error.response, null, 2))
  }

  // Provide helpful suggestions based on error type
  if (error.status === 401) {
    output.info('Check your HELPMETEST_API_TOKEN environment variable')
  } else if (error.status === 403) {
    output.info('Your API token may not have permission for this operation')
  } else if (error.status === 404) {
    output.info('The requested resource was not found')
  } else if (error.status >= 500) {
    output.info('Server error - please try again later')
  } else if (!error.status) {
    output.info('Check your internet connection and API URL')
  }
}

/**
 * Validate API response structure
 * @param {Object} response - API response to validate
 * @param {Array<string>} requiredFields - Required fields in response
 * @returns {boolean} True if response is valid
 */
const validateResponse = (response, requiredFields = []) => {
  if (!response || typeof response !== 'object') {
    return false
  }

  return requiredFields.every(field => {
    const hasField = field in response
    if (!hasField) {
      debug(config, `Missing required field in response: ${field}`)
    }
    return hasField
  })
}

/**
 * Get API client configuration for debugging
 * @returns {Object} Current API configuration
 */
const getApiConfig = () => {
  return {
    baseURL: config.apiBaseUrl,
    timeout: config.timeout,
    retries: config.retries,
    hasToken: !!config.apiToken,
    userAgent: config.userAgent,
  }
}

// Export API functions
export {
  ApiError,
  sendHealthCheckHeartbeat,
  getHealthCheck,
  getAllHealthChecks,
  testConnection,
  displayApiError,
  validateResponse,
  getApiConfig,
  createApiClient,
  handleApiError,
  retryWithBackoff,
  shouldRetry,
}

// Export default object for convenience
export default {
  sendHealthCheckHeartbeat,
  getHealthCheck,
  getAllHealthChecks,
  testConnection,
  displayApiError,
  validateResponse,
  getApiConfig,
  ApiError,
}