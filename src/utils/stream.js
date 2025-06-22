/**
 * Streaming utilities for CLI
 * 
 * Replicates the STREAM function from frontend CRUD.js for real-time streaming
 */

import { config, debug } from './config.js'

// Ensure fetch is available (Node.js 18+ has it built-in)
const ensureFetch = async () => {
  if (typeof fetch === 'undefined') {
    const { default: fetch } = await import('node-fetch')
    global.fetch = fetch
  }
}

/**
 * Trim whitespace from string
 * @param {string} str - String to trim
 * @returns {string} Trimmed string
 */
const trim = (str) => str?.trim?.() || ''

/**
 * Test regex against string
 * @param {RegExp} regex - Regular expression
 * @param {string} str - String to test
 * @returns {boolean} True if regex matches
 */
const test = (regex, str) => regex.test(str)

/**
 * Stream data from API endpoint with real-time processing
 * @param {string} uri - API endpoint URI
 * @param {Object} data - Request body data
 * @param {Function} onToken - Callback for each streaming token/event
 * @param {Function} parse - Parser function for streaming data
 * @returns {Promise<Array>} Promise that resolves with all streaming events
 */
export const STREAM = (
  uri,
  data = {},
  onToken = console.log,
  parse = x => trim(x).split('\n').map(JSON.parse),
) =>
  new Promise(async (resolve, reject) => {
    // Ensure fetch is available
    await ensureFetch()
    
    const controller = new AbortController()

    // Handle process termination gracefully
    const cleanup = () => {
      debug(config, 'Aborting stream due to process termination')
      controller.abort('process_exit')
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)

    try {
      // Construct full URL
      const baseUrl = config.apiBaseUrl || 'https://helpmetest.com'
      const fullUrl = uri.startsWith('http') ? uri : `${baseUrl}${uri}`
      
      debug(config, `Starting stream to: ${fullUrl}`)
      debug(config, `Request headers: ${JSON.stringify({
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "Authorization": config.apiToken ? `Bearer ${config.apiToken}` : undefined,
        "User-Agent": config.userAgent || 'HelpMeTest-CLI/1.0.0',
      })}`)
      debug(config, `Request body: ${JSON.stringify(data)}`)

      const response = await fetch(fullUrl, {
        signal: controller.signal,
        method: "POST",
        headers: {
          "Cache-Control": "no-cache",
          "Content-Type": "application/json",
          "Authorization": config.apiToken ? `Bearer ${config.apiToken}` : undefined,
          "User-Agent": config.userAgent || 'HelpMeTest-CLI/1.0.0',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorText = await response.text()
        debug(config, `HTTP Error ${response.status}: ${response.statusText}`)
        debug(config, `Error response: ${errorText}`)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      debug(config, `Response status: ${response.status}`)
      debug(config, `Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`)

      const reader = response.body.getReader()
      let buffer = ''
      let result = []

      try {
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) {
            debug(config, `Stream completed with ${result.length} events`)
            break
          }

          const string = new TextDecoder("utf-8").decode(value, { stream: true })
          debug(config, `Received chunk: ${string.substring(0, 200)}${string.length > 200 ? '...' : ''}`)

          for (const event of string.split('\n\n').filter(trim)) {
            try {
              if (!event) continue

              debug(config, `Processing event: ${event.substring(0, 100)}${event.length > 100 ? '...' : ''}`)

              for (const e of parse(buffer + event)) {
                if (!e) continue
                buffer = ''
                result.push(e)
                debug(config, `Parsed event: ${JSON.stringify(e)}`)
                onToken(e)
              }
            } catch (e) {
              if (test(/Unterminated/, e.message)) {
                buffer = buffer + event
                debug(config, `Buffering unterminated JSON: ${buffer.substring(0, 100)}...`)
              } else {
                debug(config, `Parse error: ${e.message}`)
                debug(config, `Failed to parse: ${event.substring(0, 100)}...`)
              }
            }
          }
        }

        return resolve(result)
      } catch (streamError) {
        debug(config, `Stream error: ${streamError.message}`)
        throw streamError
      }
    } catch (error) {
      debug(config, `Stream failed: ${error.message}`)
      reject(error)
    } finally {
      // Cleanup event listeners
      process.off('SIGINT', cleanup)
      process.off('SIGTERM', cleanup)
    }
  })

/**
 * Stream a test execution with real-time output
 * @param {string} identifier - Test identifier (name, tag, or ID)
 * @param {Function} onEvent - Callback for each streaming event
 * @returns {Promise<Array>} Promise that resolves with all events
 */
export const streamTestRun = async (identifier, onEvent = console.log) => {
  // Determine the endpoint based on identifier format
  let endpoint
  if (identifier.startsWith('tag:')) {
    endpoint = `/api/run/${encodeURIComponent(identifier)}.json`
  } else if (identifier.length > 20 && !identifier.includes(' ')) {
    // Looks like an ID (long alphanumeric string)
    endpoint = `/api/run/${encodeURIComponent(identifier)}.json`
  } else {
    // For names, we need to resolve to ID first - this will be handled by the caller
    endpoint = `/api/run/${encodeURIComponent(identifier)}.json`
  }

  debug(config, `Streaming test execution: ${identifier}`)

  return STREAM(endpoint, {}, onEvent)
}

export default {
  STREAM,
  streamTestRun,
}