/**
 * API Client Utility
 * 
 * Handles authenticated requests to the HelpMeTest backend with proper
 * error handling, retries, and response processing.
 */

import axios from 'axios'
import { output } from './colors.js'
import { config, getRequestConfig, debug, getUserSubdomain } from './config.js'

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
 * @param {boolean} enableDebug - Whether to enable debug logging for this client
 * @param {string} [subdomain] - Optional subdomain to use for URL construction
 * @returns {Object} Configured axios instance
 */
const createApiClient = (enableDebug = false, subdomain = null) => {
  const requestConfig = getRequestConfig(config, subdomain)
  const client = axios.create(requestConfig)

  // Request interceptor for debugging (only if debug is enabled)
  client.interceptors.request.use(
    (config) => {
      if (enableDebug) {
        debug(config, `Making ${config.method?.toUpperCase()} request to ${config.url}`)
      }
      return config
    },
    (error) => {
      if (enableDebug) {
        debug(config, `Request error: ${error.message}`)
      }
      return Promise.reject(error)
    },
  )

  // Response interceptor for debugging and error handling (only if debug is enabled)
  client.interceptors.response.use(
    (response) => {
      if (enableDebug) {
        debug(config, `Response ${response.status} from ${response.config.url}`)
      }
      return response
    },
    (error) => {
      if (enableDebug) {
        debug(config, `Response error: ${error.message}`)
      }
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
 * @param {boolean} enableDebug - Whether to enable debug logging
 * @returns {Promise<Object>} API response
 */
const sendHealthCheckHeartbeat = async (name, gracePeriod, heartbeatData = {}, enableDebug = false) => {
  const client = createApiClient(enableDebug, getUserSubdomain())
  
  const requestInfo = {
    name,
    gracePeriod,
    endpoint: `/api/healthcheck/${encodeURIComponent(name)}/${encodeURIComponent(gracePeriod)}`,
  }

  if (enableDebug) {
    debug(config, `Sending heartbeat for ${name} with grace period ${gracePeriod}`)
  }

  try {
    const response = await retryWithBackoff(async () => {
      return await client.post(requestInfo.endpoint, heartbeatData)
    })

    if (enableDebug) {
      debug(config, `Heartbeat sent successfully: ${response.status}`)
    }
    return response.data
  } catch (error) {
    throw handleApiError(error, requestInfo)
  }
}

/**
 * Generic API GET request with retry and error handling
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @param {string} debugMessage - Debug message for logging
 * @param {boolean} enableDebug - Whether to enable debug logging
 * @returns {Promise<Object>} API response data
 */
const apiGet = async (endpoint, params = {}, debugMessage = '', enableDebug = false) => {
  const client = createApiClient(enableDebug)
  
  const requestInfo = {
    endpoint,
    params,
  }

  if (enableDebug) {
    debug(config, debugMessage || `Making GET request to ${endpoint}`)
  }

  try {
    const response = await retryWithBackoff(async () => {
      return await client.get(endpoint, { params })
    })

    if (enableDebug) {
      debug(config, `Request successful: ${response.status}`)
    }
    return response.data
  } catch (error) {
    throw handleApiError(error, requestInfo)
  }
}

/**
 * Get health check details from the API
 * @param {string} name - Health check name
 * @param {boolean} enableDebug - Whether to enable debug logging
 * @returns {Promise<Object>} Health check data
 */
const getHealthCheck = async (name, enableDebug = false) => {
  return apiGet(
    `/api/healthcheck/${encodeURIComponent(name)}`,
    {},
    `Getting health check details for ${name}`,
    enableDebug
  )
}

/**
 * Get all health checks from the API
 * @param {Object} filters - Optional filters
 * @param {boolean} enableDebug - Whether to enable debug logging
 * @returns {Promise<Object>} List of health checks
 */
const getAllHealthChecks = async (filters = {}, enableDebug = false) => {
  return apiGet('/api/healthchecks', filters, 'Getting all health checks', enableDebug)
}

/**
 * Get all tests from the API
 * @param {Object} filters - Optional filters
 * @param {boolean} enableDebug - Whether to enable debug logging
 * @returns {Promise<Object>} List of tests
 */
const getAllTests = async (filters = {}, enableDebug = false) => {
  return apiGet('/api/test', filters, 'Getting all tests', enableDebug)
}

/**
 * Generic API POST request with retry and error handling
 * @param {string} endpoint - API endpoint
 * @param {Object} data - Request body data
 * @param {string} debugMessage - Debug message for logging
 * @param {boolean} enableDebug - Whether to enable debug logging
 * @returns {Promise<Object>} API response data
 */
const apiPost = async (endpoint, data = {}, debugMessage = '', enableDebug = false) => {
  const client = createApiClient(enableDebug)
  
  const requestInfo = {
    endpoint,
    data,
  }

  if (enableDebug) {
    debug(config, debugMessage || `Making POST request to ${endpoint}`)
  }

  try {
    const response = await retryWithBackoff(async () => {
      return await client.post(endpoint, data)
    })

    if (enableDebug) {
      debug(config, `Request successful: ${response.status}`)
    }
    return response.data
  } catch (error) {
    throw handleApiError(error, requestInfo)
  }
}

/**
 * Generic streaming POST request using the STREAM function
 * @param {string} endpoint - API endpoint
 * @param {Object} data - Request body data
 * @param {Function} onEvent - Callback for each streaming event
 * @param {string} debugMessage - Debug message for logging
 * @returns {Promise<Array>} Array of all streaming events
 */
const apiStreamPost = async (endpoint, data = {}, onEvent = () => {}, debugMessage = '') => {
  debug(config, debugMessage || `Making streaming POST request to ${endpoint}`)

  try {
    // Import streaming function dynamically to avoid circular imports
    const { STREAM } = await import('./stream.js')
    
    const events = await STREAM(endpoint, data, onEvent)
    debug(config, `Streaming request completed with ${events.length} events`)
    return events
  } catch (error) {
    throw handleApiError(error, { endpoint, data })
  }
}

/**
 * Run a test by name, tag, or ID with real-time streaming
 * @param {string} identifier - Test name, tag (with tag: prefix), or ID
 * @param {Function} onEvent - Callback for each streaming event
 * @returns {Promise<Array>} Array of all streaming events
 */
const runTest = async (identifier, onEvent = () => {}) => {
  // For names, we need to resolve to ID first
  let resolvedIdentifier = identifier
  
  if (!identifier.startsWith('tag:') && (identifier.length < 15 || identifier.includes(' '))) {
    // Treat as name - look up the test first
    const tests = await getAllTests()
    const matchingTest = tests.find(test => 
      test.name === identifier || 
      test.doc === identifier ||
      test.id === identifier
    )
    
    if (!matchingTest) {
      throw new ApiError(`Test not found: ${identifier}`, 404)
    }
    
    resolvedIdentifier = matchingTest.id
  }

  // Determine the endpoint based on identifier format
  let endpoint
  if (resolvedIdentifier.startsWith('tag:')) {
    endpoint = `/api/run/${encodeURIComponent(resolvedIdentifier)}.json`
  } else {
    endpoint = `/api/run/${encodeURIComponent(resolvedIdentifier)}.json`
  }

  debug(config, `Running test: ${identifier} (resolved: ${resolvedIdentifier})`)

  try {
    const events = await apiStreamPost(endpoint, {}, onEvent, `Running test: ${identifier}`)
    return events
  } catch (error) {
    throw handleApiError(error, { identifier, resolvedIdentifier, endpoint })
  }
}

/**
 * Get test status from the API
 * @param {boolean} enableDebug - Whether to enable debug logging
 * @returns {Promise<Object>} Test status data
 */
const getTestStatus = async (enableDebug = false) => {
  return apiGet('/api/status/tests', {}, 'Getting test status', enableDebug)
}

/**
 * Get test runs with error details from the API
 * @param {Object} filters - Optional filters
 * @param {Array<string>} [filters.tests] - Array of test IDs to filter by
 * @param {Array<string>} [filters.status] - Array of statuses to filter by (e.g., ['FAIL', 'PASS'])
 * @param {string} [filters.startDate] - Start date for filtering (ISO format)
 * @param {string} [filters.endDate] - End date for filtering (ISO format)
 * @param {number} [filters.limit=50] - Maximum number of results to return
 * @param {boolean} enableDebug - Whether to enable debug logging
 * @returns {Promise<Object>} Test runs data with error details
 */
const getTestRuns = async (filters = {}, enableDebug = false) => {
  return apiGet('/api/test/runs', filters, 'Getting test runs with error details', enableDebug)
}

/**
 * Get user information from the API
 * @param {boolean} enableDebug - Whether to enable debug logging
 * @returns {Promise<Object>} User data including company information
 */
const getUserInfo = async (enableDebug = false) => {
  return apiGet('/api/user', {}, 'Getting user information', enableDebug)
}



/**
 * Create a new test
 * @param {Object} testData - Test data
 * @param {string} testData.id - Test ID (use "new" for auto-generated)
 * @param {string} testData.name - Test name
 * @param {string} [testData.description] - Test description
 * @param {Array<string>} [testData.tags] - Test tags
 * @param {Object} [testData.data] - Additional test data
 * @returns {Promise<Object>} Created test data
 */
const createTest = async (testData) => {
  return apiPost('/api/test', testData, `Creating test: ${testData.name}`)
}

/**
 * Generic API DELETE request with retry and error handling
 * @param {string} endpoint - API endpoint
 * @param {string} debugMessage - Debug message for logging
 * @returns {Promise<Object>} API response data
 */
const apiDelete = async (endpoint, debugMessage = '') => {
  const client = createApiClient()
  
  const requestInfo = {
    endpoint,
  }

  debug(config, debugMessage || `Making DELETE request to ${endpoint}`)

  try {
    const response = await retryWithBackoff(async () => {
      return await client.delete(endpoint)
    })

    debug(config, `Request successful: ${response.status}`)
    return response.data
  } catch (error) {
    throw handleApiError(error, requestInfo)
  }
}

/**
 * Delete a test by ID
 * @param {string} testId - ID of the test to delete
 * @returns {Promise<Object>} Deletion result with update record ID
 */
const deleteTest = async (testId) => {
  return apiDelete(
    `/api/test/${encodeURIComponent(testId)}`,
    `Deleting test: ${testId}`
  )
}

/**
 * Delete a health check by name
 * @param {string} name - Name of the health check to delete
 * @returns {Promise<Object>} Deletion result with update record ID
 */
const deleteHealthCheck = async (name) => {
  return apiDelete(
    `/api/healthcheck/${encodeURIComponent(name)}`,
    `Deleting health check: ${name}`
  )
}

/**
 * Undo an update by ID
 * @param {string} updateId - ID of the update to undo
 * @returns {Promise<Object>} Result of the undo operation
 */
const undoUpdate = async (updateId) => {
  return apiPost(`/api/updates/undo/${updateId}`, {}, `Undoing update: ${updateId}`)
}

/**
 * Run an interactive Robot Framework command
 * @param {string} command - Robot Framework command to execute
 * @param {number} line - Line number for debugging context
 * @param {string} sessionId - Session ID to maintain state
 * @param {string} timestamp - Timestamp for the command execution
 * @returns {Promise<Object>} Result of the interactive command execution
 */
const runInteractiveCommand = async (command, line = 0, sessionId = 'interactive', timestamp = new Date().toISOString()) => {
  const requestData = {
    command,
    line,
    test: sessionId,
    timestamp
  }
  
  debug(config, `Running interactive command: ${command} (session: ${sessionId})`)
  
  try {
    // Use streaming post to handle the real-time response from the robot service
    const response = await apiStreamPost(
      '/api/test/command',
      requestData,
      `Running interactive command: ${command}`
    )
    
    return response
  } catch (error) {
    debug(config, `Error running interactive command: ${error.message}`)
    throw error
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
  apiGet,
  apiPost,
  apiDelete,
  apiStreamPost,
  sendHealthCheckHeartbeat,
  getHealthCheck,
  getAllHealthChecks,
  getAllTests,
  runTest,
  getTestStatus,
  getTestRuns,
  getUserInfo,
  createTest,
  deleteTest,
  deleteHealthCheck,
  undoUpdate,
  runInteractiveCommand,
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
  apiGet,
  apiPost,
  apiDelete,
  apiStreamPost,
  sendHealthCheckHeartbeat,
  getHealthCheck,
  getAllHealthChecks,
  getAllTests,
  runTest,
  getTestStatus,
  getTestRuns,
  getUserInfo,
  createTest,
  deleteTest,
  deleteHealthCheck,
  undoUpdate,
  runInteractiveCommand,
  testConnection,
  displayApiError,
  validateResponse,
  getApiConfig,
  ApiError,
}