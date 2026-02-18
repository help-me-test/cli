import fs from 'fs'
import path from 'path'
import os from 'os'
import { config } from './config.js'

const logDir = path.join(os.homedir(), '.helpmetest', 'debug')

/**
 * Get company name from api.js cached user info
 */
function getCompanyName() {
  try {
    // Dynamic import to avoid circular dependency
    const { cachedUserInfo } = require('./api.js')
    if (cachedUserInfo) {
      return cachedUserInfo.companyName || cachedUserInfo.activeCompany || null
    }
  } catch (e) {
    // Ignore - api.js may not be loaded yet
  }
  return null
}

/**
 * Write message to debug file
 */
function writeToFile(messageStr) {
  const company = getCompanyName()
  const appName = company ? `mcp-${company}` : 'mcp'
  const logFile = path.join(logDir, `${appName}.debug.log`)
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] ${messageStr}\n`

  try {
    fs.mkdirSync(logDir, { recursive: true })
    fs.appendFileSync(logFile, line)
  } catch (e) {
    // Ignore write errors
  }
}

/**
 * log() - for user-facing output
 * - Always writes to stdout
 * - Always writes to debug file
 *
 * @param {string|Object} message - Message to log
 */
export const log = (message) => {
  const messageStr = typeof message === 'string' ? message : JSON.stringify(message, null, 2)

  // Always to stdout
  console.log(messageStr)

  // Always to file
  writeToFile(messageStr)
}

/**
 * error() - for error output
 * - Always writes to stderr
 * - Always writes to debug file
 *
 * @param {string|Object} message - Error message to log
 */
export const error = (message) => {
  const messageStr = typeof message === 'string' ? message : JSON.stringify(message, null, 2)

  // Always to stderr
  console.error(messageStr)

  // Always to file
  writeToFile(messageStr)
}

/**
 * debug() - for internal/debug output
 * - Writes to stdout only when --verbose
 * - Always writes to debug file
 *
 * @param {string|Object} message - Message to log
 */
export const debug = (message) => {
  const messageStr = typeof message === 'string' ? message : JSON.stringify(message, null, 2)

  // To stdout only if verbose
  if (config.debug) {
    console.log(messageStr)
  }

  // Always to file
  writeToFile(messageStr)
}
