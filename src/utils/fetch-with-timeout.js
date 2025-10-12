/**
 * Fetch with Timeout Utility
 *
 * Wraps native fetch with configurable timeout to prevent hanging
 * on network issues or unresponsive servers.
 */

/**
 * Fetch with automatic timeout
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns {Promise<Response>} Fetch response
 * @throws {Error} If timeout is reached or fetch fails
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`)
    }
    throw error
  }
}

export default fetchWithTimeout
